"""Slice-2 passage tests: batched shadow (#72) and worker filter (#76 Phase B).

Offline only: ScriptJev/ExplodingJev stand in for JevClient; repo/adapter/queue
fakes are reused from test_generation_worker. No network, no spend.

Shadow-first (#72): with enforce off the hook logs verdicts and never changes
the built question. The retrieval-path slot is spec-only (staged, worker first).

Enforce (#76): with `jev_slice2_enforce` on the hook decides the window the
prompt sees - the verdicts in `PASSAGE_ENFORCE_VERDICTS` are kept, everything
else drops, and the top-by-relevance floor applies when that leaves nothing.
The floor never resurrects an injection-flagged chunk (D-04). Every failure
still fails open.
"""

from __future__ import annotations

import logging

from app.generation.models import RetrievedChunk
from app.generation.worker import (
    GenerationWorker,
    GenerationWorkerConfig,
    _summarize_passage,
)
from app.jev.client import JevError
from app.jev.questions import PASSAGE_ENFORCE_VERDICTS, PASSAGE_THRESHOLDS
from tests.ingestion_doubles import FakeQueue
from tests.test_generation_jev_slice1 import ExplodingJev, ScriptJev, _answer
from tests.test_generation_worker import (
    VALID_MCQ,
    FakeAdapter,
    FakeGenerationRepo,
    FakeTelemetry,
    assessment,
    material,
    ok_response,
)


def two_chunks() -> list[RetrievedChunk]:
    return [
        RetrievedChunk(
            chunk_id="c1",
            material_id="m1",
            text="The planning gap is the shortfall between forecast and target.",
            ordinal=0,
        ),
        RetrievedChunk(
            chunk_id="c2",
            material_id="m1",
            text="Variance analysis compares actual cost against the flexed budget.",
            ordinal=1,
        ),
    ]


def slice2_worker(repo, queue, adapter, telemetry, jev, *, enabled=True, enforce=False):
    return GenerationWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        telemetry=telemetry,
        config=GenerationWorkerConfig(jev_slice1_enabled=enabled, jev_slice2_enforce=enforce),
        context_builder=lambda material_id, skill_tags, scope, **_: two_chunks(),
        jev=jev,
    )


def _noul(value: float) -> dict:
    return {"noul": value, "type": "noul"}


def _nouls(
    relevant: float, evidence: float, *, contradicts: float = 0.03, injection: float = 0.05
) -> dict:
    """One passage's four Noul values, for a per-index batched answer dict."""
    return {
        "is_relevant": _noul(relevant),
        "contains_answer_evidence": _noul(evidence),
        "contradicts_query_premise": _noul(contradicts),
        "contains_prompt_injection": _noul(injection),
    }


def _index_answers(relevant: float, evidence: float) -> dict:
    return _nouls(relevant, evidence)


def _batched(all_relevant: float, all_evidence: float) -> dict:
    return _mixed(_nouls(all_relevant, all_evidence), _nouls(all_relevant, all_evidence))


def _mixed(first: dict, second: dict) -> dict:
    """Batched answers with an independent verdict for each of the two passages."""
    answers: dict = {}
    for i, nouls in enumerate((first, second)):
        for key, value in nouls.items():
            answers[f"p{i}_{key}"] = value
    return answers


def _prompt_text(adapter, call: int = 0) -> str:
    return adapter.calls[call]["messages"][1]["content"]


def _citation_enum(adapter, call: int = 0) -> list[str]:
    """The chunk ids the provider is allowed to cite on that call."""
    return adapter.calls[call]["schema"]["properties"]["citations"]["items"]["properties"][
        "chunkId"
    ]["enum"]


SUITABILITY_OK = ("answer", {"suitability": _answer("derivable", 0.95)})

# c2 is two_chunks()[1]; the tests that keep only c2 cite it, not VALID_MCQ's c1.
C2_MCQ = dict(
    VALID_MCQ,
    citations=[
        {
            "chunkId": "c2",
            "quote": "Variance analysis compares actual cost against the flexed budget",
        }
    ],
)


def _seed(repo, queue, seed=None) -> None:
    seed = seed or assessment()
    repo.seed(seed, material())
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )


def _completed_row(repo):
    assert len(repo.completed) == 1
    return repo.completed[0][0]


def test_flag_off_makes_zero_shadow_calls() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ExplodingJev()
    _seed(repo, queue)
    worker = slice2_worker(repo, queue, FakeAdapter([ok_response()]), telemetry, jev, enabled=False)
    assert worker.run_once() == 1
    assert jev.calls == []


def test_shadow_single_batched_call_never_reorders() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev(
        [
            ("answer", {"suitability": _answer("derivable", 0.95)}),
            ("answer", _batched(0.10, 0.10)),
        ]
    )
    _seed(repo, queue)
    baseline_repo, baseline_queue = FakeGenerationRepo(), FakeQueue()
    _seed(baseline_repo, baseline_queue)
    baseline = slice2_worker(
        baseline_repo,
        baseline_queue,
        FakeAdapter([ok_response()]),
        FakeTelemetry(),
        ExplodingJev(),
        enabled=False,
    )
    assert baseline.run_once() == 1
    worker = slice2_worker(repo, queue, FakeAdapter([ok_response()]), telemetry, jev)
    assert worker.run_once() == 1
    # Two decide() calls exactly: suitability pre-gate + one batched shadow.
    assert len(jev.calls) == 2
    shadow = jev.calls[1]
    assert [p["id"] for p in shadow["state"]["passages"]] == ["c1", "c2"]
    assert len(shadow["questions"]) == 8
    # All-exclude verdicts, yet the built question matches the baseline
    # modulo the random row id.
    row, baseline_row = _completed_row(repo), _completed_row(baseline_repo)
    assert {k: v for k, v in row.items() if k != "id"} == {
        k: v for k, v in baseline_row.items() if k != "id"
    }


def test_shadow_fail_open_on_jev_error() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev(
        [
            ("answer", {"suitability": _answer("derivable", 0.95)}),
            ("error", JevError("timeout", "provider deadline exceeded", True, "corr-1")),
        ]
    )
    _seed(repo, queue)
    worker = slice2_worker(repo, queue, FakeAdapter([ok_response()]), telemetry, jev)
    assert worker.run_once() == 1
    assert len(repo.completed) == 1


def test_summarize_floor_is_top_by_relevance() -> None:
    answers = dict(_batched(0.10, 0.10))
    answers["p1_is_relevant"] = _noul(0.40)
    summary = _summarize_passage(two_chunks(), answers)
    assert summary["verdicts"] == ["exclude", "exclude"]
    assert summary["would_keep"] == []
    assert summary["would_drop"] == ["c1", "c2"]
    assert summary["floor"] == "c2"


def test_summarize_empty_is_empty() -> None:
    assert _summarize_passage([], {}) == {
        "verdicts": [],
        "would_keep": [],
        "would_drop": [],
        "floor": None,
    }


def _include_c1_exclude_c2() -> dict:
    """c1 is the include (and the chunk VALID_MCQ cites); c2 is the exclude."""
    return _mixed(_nouls(0.95, 0.95), _nouls(0.10, 0.10))


def test_enforce_drops_excluded_chunks_from_prompt() -> None:
    """#76 enforce: the prompt sees the kept window, and the schema agrees with it."""
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev([SUITABILITY_OK, ("answer", _include_c1_exclude_c2())])
    _seed(repo, queue)
    adapter = FakeAdapter([ok_response()])
    worker = slice2_worker(repo, queue, adapter, telemetry, jev, enforce=True)
    assert worker.run_once() == 1
    assert _citation_enum(adapter) == ["c1"]
    assert "planning gap" in _prompt_text(adapter)
    assert "Variance analysis" not in _prompt_text(adapter)
    assert len(repo.completed) == 1


def test_enforce_floor_keeps_only_the_top_relevance_chunk() -> None:
    """A starved window floors to one chunk, so a generation still has context."""
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev([SUITABILITY_OK, ("answer", _mixed(_nouls(0.05, 0.05), _nouls(0.40, 0.05)))])
    _seed(repo, queue)
    adapter = FakeAdapter([ok_response(structured_output=C2_MCQ)])
    worker = slice2_worker(repo, queue, adapter, telemetry, jev, enforce=True)
    assert worker.run_once() == 1
    assert _citation_enum(adapter) == ["c2"]
    assert "Variance analysis" in _prompt_text(adapter)
    assert "planning gap" not in _prompt_text(adapter)
    assert len(repo.completed) == 1


def test_enforce_conflict_only_window_floors_to_the_most_relevant_chunk() -> None:
    """Ceiling, recorded deliberately: the floor is injection-aware, not conflict-aware.

    A window where every chunk denies the query premise still floors, because
    starving the prompt is worse than grounding on the closest chunk. A
    conflict-aware floor would need a different fallback than "no context".
    """
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev(
        [
            SUITABILITY_OK,
            (
                "answer",
                _mixed(
                    _nouls(0.72, 0.07, contradicts=0.96),
                    _nouls(0.20, 0.05, contradicts=0.93),
                ),
            ),
        ]
    )
    _seed(repo, queue)
    adapter = FakeAdapter([ok_response()])
    worker = slice2_worker(repo, queue, adapter, telemetry, jev, enforce=True)
    assert worker.run_once() == 1
    assert _citation_enum(adapter) == ["c1"]


def test_enforce_conflicting_evidence_is_not_kept() -> None:
    """#76 D-01: a premise-denying passage never grounds a question.

    Data-driven off the declaration, so the shipped keep-set and this test
    cannot drift: a verdict added to `PASSAGE_ENFORCE_VERDICTS` without fresh
    evidence fails here.
    """
    assert "conflicting_evidence" not in PASSAGE_ENFORCE_VERDICTS
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev(
        [
            SUITABILITY_OK,
            ("answer", _mixed(_nouls(0.72, 0.07, contradicts=0.96), _nouls(0.95, 0.95))),
        ]
    )
    _seed(repo, queue)
    adapter = FakeAdapter([ok_response(structured_output=C2_MCQ)])
    worker = slice2_worker(repo, queue, adapter, telemetry, jev, enforce=True)
    assert worker.run_once() == 1
    assert _citation_enum(adapter) == ["c2"]
    assert "planning gap" not in _prompt_text(adapter)


def test_enforce_fail_open_on_jev_error() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev(
        [
            SUITABILITY_OK,
            ("error", JevError("timeout", "provider deadline exceeded", True, "corr-1")),
        ]
    )
    _seed(repo, queue)
    adapter = FakeAdapter([ok_response()])
    worker = slice2_worker(repo, queue, adapter, telemetry, jev, enforce=True)
    assert worker.run_once() == 1
    assert _citation_enum(adapter) == ["c1", "c2"]


def test_enforce_runs_with_slice1_flag_off() -> None:
    """D-03: the filter's switch is independent of the slice-1 gate.

    One scripted response only: no suitability pre-gate call happened.
    """
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev([("answer", _include_c1_exclude_c2())])
    _seed(repo, queue)
    adapter = FakeAdapter([ok_response()])
    worker = slice2_worker(repo, queue, adapter, telemetry, jev, enabled=False, enforce=True)
    assert worker.run_once() == 1
    assert len(jev.calls) == 1
    assert _citation_enum(adapter) == ["c1"]


def test_enforce_without_client_is_inert() -> None:
    """A misconfigured worker (flag on, no client) generates exactly as before."""
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    _seed(repo, queue)
    adapter = FakeAdapter([ok_response()])
    worker = slice2_worker(repo, queue, adapter, telemetry, None, enabled=False, enforce=True)
    assert worker.run_once() == 1
    assert len(repo.completed) == 1
    assert _citation_enum(adapter) == ["c1", "c2"]


def test_enforce_logs_the_applied_set(caplog) -> None:
    """The live verification (B3) reads these fields; keep them truthful."""
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev([SUITABILITY_OK, ("answer", _include_c1_exclude_c2())])
    _seed(repo, queue)
    adapter = FakeAdapter([ok_response()])
    worker = slice2_worker(repo, queue, adapter, telemetry, jev, enforce=True)
    with caplog.at_level(logging.INFO, logger="generation.worker"):
        assert worker.run_once() == 1
    record = next(r for r in caplog.records if hasattr(r, "jev_applied"))
    assert record.jev_kept == ["c1"]
    assert record.jev_dropped == ["c2"]
    assert record.jev_applied == 1
    assert record.jev_enforce is True


def test_summarize_floor_skips_injection_flagged_chunk() -> None:
    """D-04: the floor must not resurrect what the injection judge rejected."""
    answers = _mixed(_nouls(0.90, 0.30, injection=0.95), _nouls(0.20, 0.10))
    summary = _summarize_passage(two_chunks(), answers)
    assert summary["verdicts"] == ["exclude", "exclude"]
    assert summary["would_drop"] == ["c1", "c2"]
    assert summary["floor"] == "c2"


def test_summarize_floor_falls_back_when_every_chunk_is_injection_flagged() -> None:
    """Ceiling: an all-injection window has nothing safe to floor to."""
    answers = _mixed(_nouls(0.90, 0.30, injection=0.95), _nouls(0.20, 0.10, injection=0.90))
    summary = _summarize_passage(two_chunks(), answers)
    assert summary["floor"] == "c1"


def test_locked_passage_thresholds_and_enforce_verdicts() -> None:
    """#76 lock: the tuned bands (#75 Phase A + the Phase B conflict split) hold."""
    assert PASSAGE_THRESHOLDS == {
        "injection_max": 0.70,
        "contradicts_min": 0.70,
        "relevant_min": 0.45,
        "evidence_min": 0.55,
    }
    assert PASSAGE_ENFORCE_VERDICTS == frozenset({"include"})
