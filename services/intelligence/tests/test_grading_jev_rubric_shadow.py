"""Slice-4 rubric shadow tests (#73): flag-off parity, log-only pairs, fail-open.

Offline only: ScriptJev/ExplodingJev stand in for JevClient; the rubric
adapter and repo/queue fakes are reused from test_grading_worker. No network,
no spend. The shadow must never change the composed grade.
"""

from __future__ import annotations

from app.grading.worker import GradingWorker, GradingWorkerConfig, _summarize_rubric_shadow
from app.jev.client import JevError
from tests.test_generation_jev_slice1 import ExplodingJev, ScriptJev
from tests.test_grading_worker import (
    WRITTEN_ATTEMPT,
    WRITTEN_QUESTION,
    FakeGradingRepo,
    FakeQueue,
    FakeRubricAdapter,
    _message,
    _ok_response,
)


def _shadow_worker(repo, adapter, queue, jev, *, enabled=True) -> GradingWorker:
    return GradingWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        config=GradingWorkerConfig(
            model="deepseek/deepseek-v4-flash-0731", jev_shadow_enabled=enabled
        ),
        jev=jev,
    )


def _score_answers(*scores: float) -> tuple[str, object]:
    """One scored answer per criterion index (3-level scale, raw 0..2)."""
    return (
        "answer",
        {
            f"criterion_{index}": {
                "type": "score",
                "score": score,
                "confidence": 0.9,
            }
            for index, score in enumerate(scores)
        },
    )


def test_shadow_off_makes_zero_jev_calls() -> None:
    repo = FakeGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    jev = ExplodingJev()
    worker = _shadow_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
        enabled=False,
    )
    assert worker.run_once() == 1
    assert repo.finished[0]["status"] == "graded"
    assert repo.finished[0]["grade"]["grader"] == "llm_rubric"
    assert jev.calls == []


def test_shadow_logs_pairs_without_touching_grade() -> None:
    repo = FakeGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    jev = ScriptJev([_score_answers(1.8, 1.9, 0.2)])
    worker = _shadow_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
    )
    assert worker.run_once() == 1

    grade = repo.finished[0]["grade"]
    assert grade["grader"] == "llm_rubric"
    assert [item["met"] for item in grade["rubricBreakdown"]] == [True, True, False]

    assert len(jev.calls) == 1
    assert set(jev.calls[0]["questions"]) == {"criterion_0", "criterion_1", "criterion_2"}
    assert "learner_answer" in jev.calls[0]["state"]


def test_shadow_jev_error_fails_open_with_grade_intact() -> None:
    repo = FakeGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    jev = ScriptJev([("error", JevError("timeout", "deadline", True, "r1"))])
    worker = _shadow_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
    )
    assert worker.run_once() == 1
    assert repo.finished[0]["status"] == "graded"
    assert repo.finished[0]["grade"]["grader"] == "llm_rubric"


def test_shadow_unscored_answer_marks_pair_without_touching_grade() -> None:
    repo = FakeGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    jev = ScriptJev([("answer", {"criterion_0": {"type": "score", "confidence": 0.1}})])
    worker = _shadow_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
    )
    assert worker.run_once() == 1
    assert repo.finished[0]["status"] == "graded"
    pairs = _summarize_rubric_shadow(
        {"criterion_0": {"type": "score", "confidence": 0.1}},
        repo.finished[0]["grade"]["rubricBreakdown"],
    )
    assert pairs[0]["scored"] is False


def test_summarize_normalizes_score_and_marks_agreement() -> None:
    breakdown = [
        {"criterion": "a", "met": True},
        {"criterion": "b", "met": True},
        {"criterion": "c", "met": False},
    ]
    pairs = _summarize_rubric_shadow(
        {
            "criterion_0": {"score": 1.8, "confidence": 0.9},
            "criterion_1": {"score": 1.9, "confidence": 0.9},
            "criterion_2": {"score": 0.2, "confidence": 0.9},
        },
        breakdown,
    )
    assert [pair["jev_score"] for pair in pairs] == [0.9, 0.95, 0.1]
    assert [pair["agree"] for pair in pairs] == [True, True, True]

    disagree = _summarize_rubric_shadow({"criterion_0": {"score": 0.2}}, breakdown[:1])
    assert disagree[0]["agree"] is False
