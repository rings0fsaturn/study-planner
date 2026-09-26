"""Slice-4 flag queue tests (#77 Phase B): pure mapping, aggregation, fail-open.

Offline only: ScriptJev/ExplodingJev stand in for JevClient and the rubric
adapter/repo/queue fakes are reused from test_grading_worker, so no network and
no spend. The mapping is advisory: it must never change the composed grade, and
a malformed pair must never queue a question.
"""

from __future__ import annotations

import app.jev.questions as questions_module
from app.grading.worker import (
    ANSWER_EXCERPT_MAX,
    GradingWorker,
    GradingWorkerConfig,
    _summarize_rubric_shadow,
)
from app.ingestion.models import IngestionError
from app.jev.client import JevError
from app.jev.measure import criterion_action, map_scores
from app.jev.questions import RUBRIC_THRESHOLDS
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

# The shipped thresholds, so every boundary case below reads the declaration
# instead of a copied literal (the #75/#76 locked-declaration precedent).
CUTOFF = RUBRIC_THRESHOLDS["cutoff"]
MARGIN = RUBRIC_THRESHOLDS["margin"]
INSIDE_BAND = CUTOFF + MARGIN / 2.0


def _pairs(*specs: tuple[float, bool]) -> list[dict]:
    return [
        {
            "index": index,
            "scored": True,
            "jev_score": score,
            "grade_met": met,
            "agree": (score >= CUTOFF) == met,
        }
        for index, (score, met) in enumerate(specs)
    ]


def _unscored(index: int, met: bool) -> dict:
    return {"index": index, "scored": False, "jev_score": None, "grade_met": met, "agree": None}


# ---------------------------------------------------------------------------
# Locked declaration
# ---------------------------------------------------------------------------


def test_rubric_thresholds_declared_on_the_grid() -> None:
    """The pick is one declaration: the mapping, the sweep, and the report read it."""
    assert set(RUBRIC_THRESHOLDS) == {"cutoff", "margin"}
    assert RUBRIC_THRESHOLDS["cutoff"] in (0.5, 0.6, 0.7)
    assert RUBRIC_THRESHOLDS["margin"] in (0.05, 0.10, 0.15)
    assert all(isinstance(value, float) for value in RUBRIC_THRESHOLDS.values())


def test_shipped_thresholds_are_what_the_grid_tuned() -> None:
    """Guards the pick against a silent drift back to a default literal."""
    assert questions_module.RUBRIC_THRESHOLDS is RUBRIC_THRESHOLDS


# ---------------------------------------------------------------------------
# Pure mapping (D-02)
# ---------------------------------------------------------------------------


def test_confident_agreement_does_not_flag() -> None:
    """Far from the band and agreeing with the server grade: nothing to review."""
    verdict = criterion_action(0, 0.95, True, cutoff=CUTOFF, margin=MARGIN)
    assert verdict["action"] == "ok"
    assert verdict["reason"] is None
    assert verdict["jev_score"] == 0.95
    assert verdict["server_met"] is True


def test_disagreement_flags() -> None:
    """Jev confident met, server says not met: a disagreement worth a human."""
    verdict = criterion_action(1, 0.95, False, cutoff=CUTOFF, margin=MARGIN)
    assert verdict["action"] == "flag"
    assert verdict["reason"] == "disagreement"


def test_review_band_flags_even_when_agreed() -> None:
    """Inside the band the verdict is not trusted, agree or not."""
    agreeing = criterion_action(0, INSIDE_BAND, True, cutoff=CUTOFF, margin=MARGIN)
    assert agreeing["action"] == "flag"
    assert agreeing["reason"] == "review_band"
    dissenting = criterion_action(0, CUTOFF - MARGIN / 2.0, False, cutoff=CUTOFF, margin=MARGIN)
    assert dissenting["action"] == "flag"
    assert dissenting["reason"] == "review_band"


def test_band_edge_is_inclusive() -> None:
    """The band is `<= margin` in ``summarize_measurement``; the mapping must match."""
    assert criterion_action(0, CUTOFF + MARGIN, True, cutoff=CUTOFF, margin=MARGIN)["action"] == (
        "flag"
    )
    assert criterion_action(0, CUTOFF - MARGIN, False, cutoff=CUTOFF, margin=MARGIN)["action"] == (
        "flag"
    )
    outside = CUTOFF + MARGIN + 1e-9
    assert criterion_action(0, outside, True, cutoff=CUTOFF, margin=MARGIN)["action"] == "ok"


def test_unscored_pair_never_flags_even_on_disagreement() -> None:
    """Fail-open: no score means no verdict, so nothing is queued for review."""
    verdict = criterion_action(0, None, False, cutoff=CUTOFF, margin=MARGIN)
    assert verdict["action"] == "skipped"
    assert verdict["reason"] is None
    assert verdict["jev_score"] is None


def test_map_scores_aggregates_any_flag_across_criteria() -> None:
    """One flagged criterion queues the question; the others stay individually ok."""
    verdicts = map_scores(
        _pairs((0.99, True), (INSIDE_BAND, True), (0.05, False)),
        cutoff=CUTOFF,
        margin=MARGIN,
    )
    assert [verdict["action"] for verdict in verdicts["criteria"]] == ["ok", "flag", "ok"]
    assert verdicts["flagged"] == [1]
    assert verdicts["question_flags"] is True


def test_map_scores_reports_no_flag_when_everything_agrees() -> None:
    verdicts = map_scores(_pairs((0.99, True), (0.02, False)), cutoff=CUTOFF, margin=MARGIN)
    assert verdicts["flagged"] == []
    assert verdicts["question_flags"] is False


def test_map_scores_never_flags_on_malformed_pairs() -> None:
    verdicts = map_scores([_unscored(0, False), _unscored(1, True)], cutoff=CUTOFF, margin=MARGIN)
    assert verdicts["flagged"] == []
    assert verdicts["question_flags"] is False


def test_map_scores_agrees_with_the_summarizer_band_count() -> None:
    """The mapping and the #74 summarizer must read the same band or the report lies."""
    pairs = _pairs((0.99, True), (INSIDE_BAND, False), (CUTOFF - MARGIN, True), (0.02, False))
    verdicts = map_scores(pairs, cutoff=CUTOFF, margin=MARGIN)
    banded = sum(
        1 for pair in pairs if pair["scored"] and abs(pair["jev_score"] - CUTOFF) <= MARGIN
    )
    assert sum(1 for verdict in verdicts["criteria"] if verdict["action"] == "flag") >= banded


# ---------------------------------------------------------------------------
# Worker wiring: the queue insert is advisory and fail-open
# ---------------------------------------------------------------------------


class RecordingGradingRepo(FakeGradingRepo):
    """FakeGradingRepo plus the flag-queue write the slice-4 path uses."""

    def __init__(self, attempt: dict, question: dict, *, fail_insert: bool = False) -> None:
        super().__init__(attempt, question)
        self.flag_rows: list[dict] = []
        self.insert_calls = 0
        self.fail_insert = fail_insert

    def insert_jev_flags(self, rows: list[dict]) -> None:
        self.insert_calls += 1
        if self.fail_insert:
            raise IngestionError("provider_unavailable", "storage POST rejected", retryable=True)
        self.flag_rows.extend(rows)


def _score_answers(*scores: float) -> tuple[str, object]:
    """One scored answer per criterion index (3-level scale, raw 0..2)."""
    return (
        "answer",
        {
            f"criterion_{index}": {"type": "score", "score": score, "confidence": 0.9}
            for index, score in enumerate(scores)
        },
    )


def _flag_worker(repo, adapter, queue, jev, *, shadow=False, flags=True) -> GradingWorker:
    return GradingWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        config=GradingWorkerConfig(
            model="deepseek/deepseek-v4-flash-0731",
            jev_shadow_enabled=shadow,
            jev_flags_enabled=flags,
        ),
        jev=jev,
    )


def test_insert_fault_never_reaches_the_composed_grade() -> None:
    """Regression: a fault in the flag path must never reach the composed grade.

    Found live 2026-09-26: a lazy import raised outside the guard, the exception
    escaped `_grade_written`, and the attempt was left queued with no grade at
    all. The grade is composed before this path runs, so every fault in it -
    including an import fault - has to be swallowed.
    """
    repo = RecordingGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION, fail_insert=True)
    jev = ScriptJev([_score_answers(1.9, 1.9, 1.9)])
    worker = _flag_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
    )
    assert worker.run_once() == 1
    outcome = repo.finished[0]
    assert outcome["status"] == "graded"
    assert outcome["grade"] is not None
    assert outcome["grade"]["grader"] == "llm_rubric"


def test_missing_flag_insert_method_fails_open() -> None:
    """A repo without the queue method (or any import fault) still grades."""
    repo = FakeGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)  # no insert_jev_flags
    jev = ScriptJev([_score_answers(1.9, 1.9, 1.9)])
    worker = _flag_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
    )
    assert worker.run_once() == 1
    assert repo.finished[0]["status"] == "graded"
    assert repo.finished[0]["grade"] is not None


def test_flags_off_makes_zero_jev_calls_and_writes_nothing() -> None:
    repo = RecordingGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    jev = ExplodingJev()
    worker = _flag_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
        flags=False,
    )
    assert worker.run_once() == 1
    assert jev.calls == []
    assert repo.insert_calls == 0
    assert repo.finished[0]["status"] == "graded"


def test_flags_on_queues_one_row_per_flagged_criterion() -> None:
    """Jev is confident everywhere; the server meets only criteria 0-1.

    Criterion 2 is therefore a real disagreement (Jev met at 0.95, server not
    met), while 0-1 are confident agreements. Exactly one row queues.
    """
    repo = RecordingGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    jev = ScriptJev([_score_answers(1.9, 1.9, 1.9)])
    worker = _flag_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
    )
    assert worker.run_once() == 1

    grade = repo.finished[0]["grade"]
    assert [item["met"] for item in grade["rubricBreakdown"]] == [True, True, False]
    assert len(repo.flag_rows) == 1
    row = repo.flag_rows[0]
    assert row["question_id"] == "question-written-01"
    assert row["attempt_id"] == "attempt-written-01"
    assert row["criterion"] == grade["rubricBreakdown"][2]["criterion"]
    assert row["jev_score"] == 0.95
    assert row["server_met"] is False
    # The id is client-minted: the table's TEXT primary key is NOT NULL, so
    # omitting it answers 400/23502 live (found 2026-09-26).
    assert row["id"]
    assert isinstance(row["id"], str)


def test_flag_rows_carry_an_answer_excerpt_and_no_full_text() -> None:
    attempt = {**WRITTEN_ATTEMPT, "correlation_id": "corr-slice4-01"}
    question = {**WRITTEN_QUESTION, "user_id": "owner-01"}
    repo = RecordingGradingRepo(attempt, question)
    jev = ScriptJev([_score_answers(1.9, 1.9, 1.9)])
    worker = _flag_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
    )
    worker.run_once()
    row = repo.flag_rows[0]
    assert row["owner"] == "owner-01"
    assert row["answer_excerpt"] == WRITTEN_ATTEMPT["answer"]["text"][:ANSWER_EXCERPT_MAX]
    assert row["correlation_id"] == "corr-slice4-01"


def test_flag_insert_failure_fails_open_with_grade_intact() -> None:
    repo = RecordingGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION, fail_insert=True)
    jev = ScriptJev([_score_answers(1.9, 1.9, 1.9)])
    worker = _flag_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
    )
    assert worker.run_once() == 1
    assert repo.finished[0]["status"] == "graded"
    assert repo.finished[0]["grade"]["grader"] == "llm_rubric"


def test_flags_only_no_shadow_still_runs_one_call() -> None:
    """The shadow flag and the queue flag are independent; either one runs Jev."""
    repo = RecordingGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    jev = ScriptJev([_score_answers(1.9, 1.9, 1.9)])
    worker = _flag_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
        shadow=False,
        flags=True,
    )
    assert worker.run_once() == 1
    assert len(jev.calls) == 1
    assert repo.insert_calls == 1


def test_jev_error_fails_open_and_writes_nothing() -> None:
    repo = RecordingGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    jev = ScriptJev([("error", JevError("timeout", "deadline", True, "r1"))])
    worker = _flag_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
    )
    assert worker.run_once() == 1
    assert repo.insert_calls == 0
    assert repo.finished[0]["status"] == "graded"


def test_malformed_pairs_queue_nothing() -> None:
    repo = RecordingGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    jev = ScriptJev([("answer", {"criterion_0": {"type": "score", "confidence": 0.1}})])
    worker = _flag_worker(
        repo,
        FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667)),
        FakeQueue([_message("attempt-written-01")]),
        jev,
    )
    assert worker.run_once() == 1
    assert repo.insert_calls == 0
    pairs = _summarize_rubric_shadow(
        {"criterion_0": {"type": "score", "confidence": 0.1}},
        repo.finished[0]["grade"]["rubricBreakdown"],
    )
    assert all(pair["scored"] is False for pair in pairs)
