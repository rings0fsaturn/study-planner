"""Deletion worker arm tests (migration 034): poll `assessment_delete`, remove.

The repo is a fake implementing the narrow DeletionRepo protocol, mirroring the
generation/grading arm tests. The behavior worth pinning: the delete runs once
per message with the job running -> succeeded, retryable faults redeliver with
the job returned to queued, terminal faults archive and fail the job, and a
malformed message never blocks the single-in-flight arm. The idempotent
missing-row behavior lives in `SupabaseIngestionRepo.delete_assessment` and is
pinned by `test_repository.py`.
"""

from __future__ import annotations

import logging

import pytest

from app.deletion.worker import DELETION_QUEUE, DeletionWorker, DeletionWorkerConfig
from app.ingestion.models import IngestionError, QueueMessage
from app.ingestion.queue import WorkQueue


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


class FakeDeletionRepo:
    """In-memory DeletionRepo double; raises IngestionError to simulate faults."""

    def __init__(self) -> None:
        self.deleted: list[str] = []
        self.job_status: list[tuple[str, str]] = []
        self.job_errors: list[tuple[str, dict]] = []
        self.fail_delete: IngestionError | None = None

    def delete_assessment(self, assessment_id: str) -> None:
        if self.fail_delete is not None:
            raise self.fail_delete
        self.deleted.append(assessment_id)

    def update_job_status(self, job_id: str, status: str, **meta) -> None:
        self.job_status.append((job_id, status))
        if meta:
            self.job_errors.append((job_id, meta))


def _message(*, read_ct: int = 0, payload: dict | None = None) -> QueueMessage:
    return QueueMessage(
        msg_id=7,
        payload=payload
        if payload is not None
        else {"jobId": "job-del-01", "assessmentId": "a1", "correlationId": "corr-1"},
        read_ct=read_ct,
    )


def _worker(repo: FakeDeletionRepo, queue: FakeQueue) -> DeletionWorker:
    return DeletionWorker(repo=repo, queue=queue, config=DeletionWorkerConfig())


def test_queue_name_is_assessment_delete() -> None:
    assert DELETION_QUEUE == "assessment_delete"


def test_a_delete_message_removes_the_assessment_and_marks_the_job_succeeded() -> None:
    repo = FakeDeletionRepo()
    queue = FakeQueue([_message()])

    _worker(repo, queue).run_once()

    assert repo.deleted == ["a1"]
    assert repo.job_status == [("job-del-01", "running"), ("job-del-01", "succeeded")]
    assert queue.completed == [(7, True)]


def test_a_retryable_storage_fault_redelivers_then_archives_at_the_cap() -> None:
    repo = FakeDeletionRepo()
    repo.fail_delete = IngestionError(
        "provider_unavailable", "storage delete failed", retryable=True
    )
    queue = FakeQueue([_message(read_ct=1), _message(read_ct=2), _message(read_ct=3)])
    worker = _worker(repo, queue)

    worker.run_once()
    worker.run_once()
    assert queue.completed == [(7, False), (7, False)]
    assert repo.job_status[-1] == ("job-del-01", "queued")

    worker.run_once()

    assert queue.completed == [(7, False), (7, False), (7, True)]
    assert ("job-del-01", "failed") in repo.job_status


def test_a_non_retryable_fault_fails_the_job_and_archives(
    caplog: pytest.LogCaptureFixture,
) -> None:
    repo = FakeDeletionRepo()
    repo.fail_delete = IngestionError("invalid_request", "delete rejected")
    queue = FakeQueue([_message()])

    with caplog.at_level(logging.WARNING, logger="ingestion.arm"):
        _worker(repo, queue).run_once()

    assert queue.completed == [(7, True)]
    assert repo.job_status[-1] == ("job-del-01", "failed")
    assert repo.job_errors[-1] == (
        "job-del-01",
        {
            "error_code": "invalid_request",
            "error_message": "delete rejected",
            "retryable": False,
        },
    )
    # Rule 17: the dropped-message line joins the worker trail by trace id.
    assert caplog.records
    assert caplog.records[0].trace_id == "corr-1"


def test_a_message_missing_identity_fields_is_archived_and_fails_the_job() -> None:
    repo = FakeDeletionRepo()
    queue = FakeQueue([_message(payload={"jobId": "job-del-01"})])

    _worker(repo, queue).run_once()

    assert repo.deleted == []
    assert queue.completed == [(7, True)]
    assert repo.job_status[-1] == ("job-del-01", "failed")
