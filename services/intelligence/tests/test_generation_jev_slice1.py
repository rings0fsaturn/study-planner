"""Slice-1 Jev gate tests (#70): flag-off parity, suitability pre-gate, citation adjudication.

Offline only: FakeJev stands in for JevClient; repo/adapter/queue fakes are
reused from test_generation_worker. No network, no spend.
"""

from __future__ import annotations

from app.generation.worker import GenerationWorker, GenerationWorkerConfig
from app.jev.client import JevError, JevResult
from tests.ingestion_doubles import FakeQueue
from tests.test_generation_worker import (
    VALID_MCQ,
    FakeAdapter,
    FakeGenerationRepo,
    FakeTelemetry,
    assessment,
    chunks,
    material,
    ok_response,
)

BAD_QUOTE_MCQ = dict(
    VALID_MCQ,
    citations=[{"chunkId": "c1", "quote": "quantum entanglement explains photosynthesis"}],
)


class ExplodingJev:
    """Any decide() call is a failure: proves the flag-off path is call-free."""

    def __init__(self) -> None:
        self.calls: list[dict] = []

    def decide(self, state, questions, *, request_id="", trace_id=""):
        self.calls.append({"state": state, "questions": questions})
        raise AssertionError("jev must not be called when the slice-1 flag is off")


class ScriptJev:
    """Pop scripted ("answer", answers-dict) / ("error", JevError) outcomes in order."""

    def __init__(self, script: list[tuple[str, object]]) -> None:
        self._script = list(script)
        self.calls: list[dict] = []

    def decide(self, state, questions, *, request_id="", trace_id=""):
        self.calls.append({"state": state, "questions": questions})
        assert self._script, "unexpected jev decide() call"
        kind, payload = self._script.pop(0)
        if kind == "error":
            raise payload  # type: ignore[misc]
        return JevResult(
            answers=dict(payload),  # type: ignore[arg-type]
            model="test-jev",
            input_tokens=10,
            request_id=request_id,
        )


def _answer(choice: str, confidence: float) -> dict:
    return {"choice": choice, "confidence": confidence, "type": "choice"}


def slice1_worker(repo, queue, adapter, telemetry, jev, *, enabled=True):
    return GenerationWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        telemetry=telemetry,
        config=GenerationWorkerConfig(jev_slice1_enabled=enabled),
        context_builder=lambda material_id, skill_tags, scope, **_: chunks(),
        jev=jev,
    )


def send(repo, queue, seed=None):
    seed = seed or assessment()
    repo.seed(seed, material())
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )


def coding_seed():
    seed = assessment()
    seed["recipe"] = {
        "formats": ["coding"],
        "questionCount": 1,
        "difficulty": 3,
        "skillTags": ["Algorithms"],
    }
    return seed


def test_flag_off_makes_zero_jev_calls() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ExplodingJev()
    send(repo, queue)
    processed = slice1_worker(
        repo, queue, FakeAdapter([ok_response()]), telemetry, jev, enabled=False
    ).run_once()
    assert processed == 1
    assert len(repo.completed) == 1
    assert jev.calls == []


def test_suitability_derivable_proceeds() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev([("answer", {"suitability": _answer("derivable", 0.95)})])
    send(repo, queue)
    slice1_worker(repo, queue, FakeAdapter([ok_response()]), telemetry, jev).run_once()
    assert len(repo.completed) == 1
    assert len(jev.calls) == 1
    assert "chunk_text" in jev.calls[0]["state"]


def test_suitability_review_proceeds() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev([("answer", {"suitability": _answer("derivable", 0.5)})])
    send(repo, queue)
    slice1_worker(repo, queue, FakeAdapter([ok_response()]), telemetry, jev).run_once()
    assert len(repo.completed) == 1


def test_suitability_not_derivable_blocks_coding_terminal() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev([("answer", {"suitability": _answer("not_derivable", 0.95)})] * 3)
    adapter = FakeAdapter([])
    send(repo, queue, coding_seed())
    slice1_worker(repo, queue, adapter, telemetry, jev).run_once()
    assert adapter.calls == []
    assert len(jev.calls) == 3  # D-02 resample path: one verdict per window
    assert repo.completed == []
    _, status, warnings = repo.assessment_updates[-1]
    assert status == "failed"
    assert warnings == [{"code": "code_not_derivable", "message": warnings[0]["message"]}]
    assert repo.job_updates[-1]["error_code"] == "code_not_derivable"


def test_suitability_not_derivable_advisory_for_objective() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev([("answer", {"suitability": _answer("not_derivable", 0.95)})])
    send(repo, queue)
    slice1_worker(repo, queue, FakeAdapter([ok_response()]), telemetry, jev).run_once()
    assert len(repo.completed) == 1  # advisory-only outside the coding arm


def test_suitability_error_fails_open() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev([("error", JevError("timeout", "deadline", True, "r1"))])
    send(repo, queue)
    slice1_worker(repo, queue, FakeAdapter([ok_response()]), telemetry, jev).run_once()
    assert len(repo.completed) == 1


def test_citation_match_pass_makes_no_citation_call() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev([("answer", {"suitability": _answer("derivable", 0.95)})])
    send(repo, queue)
    slice1_worker(repo, queue, FakeAdapter([ok_response()]), telemetry, jev).run_once()
    assert len(repo.completed) == 1
    _, _, _, warnings = repo.completed[0]
    assert warnings == []
    assert len(jev.calls) == 1  # suitability only; verified quote needs no judge


def test_citation_supports_clears_unverified() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev(
        [
            ("answer", {"suitability": _answer("derivable", 0.95)}),
            ("answer", {"relation": _answer("supports", 0.93)}),
        ]
    )
    send(repo, queue)
    slice1_worker(
        repo, queue, FakeAdapter([ok_response(structured_output=BAD_QUOTE_MCQ)]), telemetry, jev
    ).run_once()
    assert len(repo.completed) == 1
    _, _, _, warnings = repo.completed[0]
    assert warnings == []
    assert len(jev.calls) == 2


def test_citation_contradicted_drops_without_repair() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev(
        [
            ("answer", {"suitability": _answer("derivable", 0.95)}),
            ("answer", {"relation": _answer("contradicts", 0.99)}),
        ]
    )
    adapter = FakeAdapter([ok_response(structured_output=BAD_QUOTE_MCQ)])
    send(repo, queue)
    slice1_worker(repo, queue, adapter, telemetry, jev).run_once()
    assert repo.completed == []
    assert len(adapter.calls) == 1  # citation drops never trigger repair
    _, status, warnings = repo.assessment_updates[-1]
    assert status == "failed"
    assert warnings[0]["code"] == "citation_missing"
    assert repo.job_updates[-1]["error_code"] == "malformed_output"


def test_citation_error_keeps_soft_warning() -> None:
    repo, queue, telemetry = FakeGenerationRepo(), FakeQueue(), FakeTelemetry()
    jev = ScriptJev(
        [
            ("answer", {"suitability": _answer("derivable", 0.95)}),
            ("error", JevError("timeout", "deadline", True, "r1")),
        ]
    )
    send(repo, queue)
    slice1_worker(
        repo, queue, FakeAdapter([ok_response(structured_output=BAD_QUOTE_MCQ)]), telemetry, jev
    ).run_once()
    assert len(repo.completed) == 1
    _, _, _, warnings = repo.completed[0]
    assert [w["code"] for w in warnings] == ["citation_unverified"]
