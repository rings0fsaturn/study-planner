"""Grading worker arm tests (#39): poll assessment_grade, grade, persist.

The repo is a fake implementing the narrow GradingRepo protocol — the real
Supabase path is the worker's only dependency seam, mirroring how the
generation arm tests GenerationWorker with a fake GenerationRepo.
"""

from __future__ import annotations

import pytest

from app.ingestion.models import IngestionError, QueueMessage
from app.ingestion.queue import WorkQueue
from app.grading.worker import GradingWorker, GradingWorkerConfig, GRADING_QUEUE


class FakeQueue(WorkQueue):
    def __init__(self, messages: list[QueueMessage] | None = None) -> None:
        self.messages = list(messages or [])
        self.completed: list[tuple[int, bool]] = []

    def poll(self, queue: str, *, visibility_seconds: int, quantity: int) -> list[QueueMessage]:
        take, self.messages = self.messages[:quantity], self.messages[quantity:]
        return take

    def complete(self, queue: str, msg_id: int, success: bool) -> None:
        self.completed.append((msg_id, success))

    def send(self, queue: str, payload: dict) -> None: ...


class FakeGradingRepo:
    """In-memory GradingRepo double; raises IngestionError to simulate faults."""

    def __init__(self, attempt: dict, question: dict) -> None:
        self.attempt = attempt
        self.question = question
        self.job_status: list[tuple[str, str]] = []
        self.finished: list[dict] = []
        self.fail_on_get = False

    def get_attempt(self, attempt_id: str) -> dict:
        if self.fail_on_get:
            raise IngestionError("provider_unavailable", "storage GET failed", retryable=True)
        return self.attempt

    def get_question(self, question_id: str) -> dict:
        return self.question

    def update_job_status(self, job_id: str, status: str) -> None:
        self.job_status.append((job_id, status))

    def complete_attempt(
        self, attempt_id: str, job_id: str, status: str, grade: dict | None
    ) -> None:
        self.finished.append(
            {"attemptId": attempt_id, "jobId": job_id, "status": status, "grade": grade}
        )
        self.attempt = {**self.attempt, "status": status, "grade": grade}


def _message(attempt_id: str = "attempt-01") -> QueueMessage:
    return QueueMessage(msg_id=7, payload={"jobId": "job-grade-01", "attemptId": attempt_id})


ATTEMPT = {
    "id": "attempt-01",
    "job_id": "job-grade-01",
    "question_id": "question-01",
    "status": "queued",
    "answer": {"index": 2},
}

QUESTION = {
    "id": "question-01",
    "material_id": "material-01",
    "format": "objective",
    "skill_tags": ["Caching"],
    "answer_block": {"correctIndex": 2},
}


def test_run_once_grades_and_completes_attempt() -> None:
    repo = FakeGradingRepo(ATTEMPT, QUESTION)
    worker = GradingWorker(repo=repo, queue=FakeQueue([_message()]), config=GradingWorkerConfig())
    processed = worker.run_once()

    assert processed == 1
    assert len(repo.finished) == 1
    outcome = repo.finished[0]
    assert outcome["status"] == "graded"
    assert outcome["grade"]["score"] == 1.0
    assert outcome["grade"]["grader"] == "objective"
    assert repo.job_status == [("job-grade-01", "running"), ("job-grade-01", "succeeded")]


def test_run_once_empty_queue_is_noop() -> None:
    repo = FakeGradingRepo(ATTEMPT, QUESTION)
    worker = GradingWorker(repo=repo, queue=FakeQueue(), config=GradingWorkerConfig())
    assert worker.run_once() == 0
    assert repo.finished == []


def test_incorrect_answer_still_succeeds_the_job() -> None:
    wrong = {**ATTEMPT, "answer": {"index": 0}}
    repo = FakeGradingRepo(wrong, QUESTION)
    worker = GradingWorker(repo=repo, queue=FakeQueue([_message()]), config=GradingWorkerConfig())
    worker.run_once()

    outcome = repo.finished[0]
    assert outcome["status"] == "graded"
    assert outcome["grade"]["score"] == 0.0
    assert outcome["grade"]["publicFeedback"] == "Not correct."


def test_malformed_answer_fails_attempt_not_the_job_budget() -> None:
    malformed = {**ATTEMPT, "answer": {"value": "2"}}
    repo = FakeGradingRepo(malformed, QUESTION)
    worker = GradingWorker(repo=repo, queue=FakeQueue([_message()]), config=GradingWorkerConfig())
    worker.run_once()

    outcome = repo.finished[0]
    assert outcome["status"] == "failed"
    assert outcome["grade"] is not None
    assert outcome["grade"]["score"] == 0.0
    assert "ungradable" in outcome["grade"]["publicFeedback"]


def test_transient_storage_error_leaves_job_retryable() -> None:
    repo = FakeGradingRepo(ATTEMPT, QUESTION)
    repo.fail_on_get = True
    queue = FakeQueue([_message()])
    worker = GradingWorker(repo=repo, queue=queue, config=GradingWorkerConfig())
    worker.run_once()

    assert repo.finished == []
    assert repo.job_status[-1] == ("job-grade-01", "queued")
    assert queue.completed == [(7, False)]  # message returns for redelivery


def test_message_missing_attempt_id_is_dropped() -> None:
    repo = FakeGradingRepo(ATTEMPT, QUESTION)
    queue = FakeQueue([QueueMessage(msg_id=9, payload={"jobId": "job-grade-01"})])
    worker = GradingWorker(repo=repo, queue=queue, config=GradingWorkerConfig())
    worker.run_once()

    assert repo.finished == []
    assert queue.completed == [(9, False)]


def test_queue_name_is_assessment_grade() -> None:
    assert GRADING_QUEUE == "assessment_grade"
