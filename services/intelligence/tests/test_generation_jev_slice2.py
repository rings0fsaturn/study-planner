"""Slice-2 passage shadow tests (#72): batched single-call shadow, never-reorder, fail-open, floor.

Offline only: ScriptJev/ExplodingJev stand in for JevClient; repo/adapter/queue
fakes are reused from test_generation_worker. No network, no spend.

Shadow-first: the hook logs verdicts and never changes the built question.
The retrieval-path slot is spec-only in this ticket (staged, worker first).
"""

from __future__ import annotations

from app.generation.models import RetrievedChunk
from app.generation.worker import (
    GenerationWorker,
    GenerationWorkerConfig,
    _summarize_passage_shadow,
)
from app.jev.client import JevError
from tests.ingestion_doubles import FakeQueue
from tests.test_generation_jev_slice1 import ExplodingJev, ScriptJev, _answer
from tests.test_generation_worker import (
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


def slice2_worker(repo, queue, adapter, telemetry, jev, *, enabled=True):
    return GenerationWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        telemetry=telemetry,
        config=GenerationWorkerConfig(jev_slice1_enabled=enabled),
        context_builder=lambda material_id, skill_tags, scope, **_: two_chunks(),
        jev=jev,
    )


def _noul(value: float) -> dict:
    return {"noul": value, "type": "noul"}


def _index_answers(relevant: float, evidence: float) -> dict:
    return {
        "is_relevant": _noul(relevant),
        "contains_answer_evidence": _noul(evidence),
        "contradicts_query_premise": _noul(0.03),
        "contains_prompt_injection": _noul(0.05),
    }


def _batched(all_relevant: float, all_evidence: float) -> dict:
    answers: dict = {}
    for i in range(2):
        for key, value in _index_answers(all_relevant, all_evidence).items():
            answers[f"p{i}_{key}"] = value
    return answers


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
    summary = _summarize_passage_shadow(two_chunks(), answers)
    assert summary["verdicts"] == ["exclude", "exclude"]
    assert summary["would_keep"] == []
    assert summary["would_drop"] == ["c1", "c2"]
    assert summary["floor"] == "c2"


def test_summarize_empty_is_empty() -> None:
    assert _summarize_passage_shadow([], {}) == {
        "verdicts": [],
        "would_keep": [],
        "would_drop": [],
        "floor": None,
    }
