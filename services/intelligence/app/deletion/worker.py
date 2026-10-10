"""Deletion worker arm: poll `assessment_delete`, remove the assessment.

Mirrors the generation/grading arms (D-04 arm pattern): narrow repo protocol,
WorkQueue through the generic pgmq wrappers, one message per poll, retryable
faults redelivered, terminal ones archived. The arm exists for privilege, not
business logic: `authenticated` holds no DELETE grant on assessments or their
dependents (018/025/033), so the service-role worker runs the delete and the
cascades wipe questions, attempts, and review flags.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

from app.ingestion.arm import fail_job, run_assessment_arm_once
from app.ingestion.models import QueueMessage
from app.ingestion.queue import WorkQueue

logger = logging.getLogger("deletion.worker")

DELETION_QUEUE = "assessment_delete"


@dataclass(frozen=True)
class DeletionWorkerConfig:
    poll_interval_seconds: float = 1.0
    visibility_seconds: int = 30
    max_in_flight: int = 1
    # Retryable storage faults redeliver at most this many times before the
    # message is archived (the generation/grading max_deliveries precedent).
    max_deliveries: int = 3


class DeletionRepo(Protocol):
    """Narrow persistence contract; SupabaseIngestionRepo implements it."""

    def delete_assessment(self, assessment_id: str) -> None: ...

    def update_job_status(self, job_id: str, status: str, **meta) -> None: ...


class DeletionWorker:
    """One queue arm; poll `assessment_delete` and process one message."""

    def __init__(
        self,
        *,
        repo: DeletionRepo,
        queue: WorkQueue,
        config: DeletionWorkerConfig,
    ) -> None:
        self._repo = repo
        self._queue = queue
        self.config = config

    def run_once(self) -> int:
        return run_assessment_arm_once(
            queue_name=DELETION_QUEUE,
            label="deletion",
            process=self._process,
            repo=self._repo,
            queue=self._queue,
            visibility_seconds=self.config.visibility_seconds,
            quantity=self.config.max_in_flight,
            max_deliveries=self.config.max_deliveries,
        )

    def _process(self, message: QueueMessage) -> None:
        payload = message.payload
        job_id = str(payload.get("jobId") or "")
        assessment_id = str(payload.get("assessmentId") or "")
        correlation_id = str(payload.get("correlationId") or "")
        if not (job_id and assessment_id):
            # A message without identity can never succeed: fail the job (when
            # one is named) and archive the message so it cannot block the arm.
            logger.error(
                "deletion message missing identity fields: %s",
                payload,
                extra={"trace_id": correlation_id},
            )
            fail_job(
                self._repo,
                job_id,
                code="invalid_request",
                message="deletion message missing identity fields",
            )
            self._queue.complete(DELETION_QUEUE, message.msg_id, True)
            return

        self._repo.update_job_status(job_id, "running")
        # The DELETE is idempotent: an already-gone row (a cleanup, or an
        # earlier delivery that crashed after the delete) answers 204, which is
        # the same success path. That is the orphan guard - a message for a
        # deleted assessment archives instead of redelivering forever.
        self._repo.delete_assessment(assessment_id)
        self._repo.update_job_status(job_id, "succeeded")
        logger.info(
            "assessment %s deleted",
            assessment_id,
            extra={"trace_id": correlation_id},
        )
        self._queue.complete(DELETION_QUEUE, message.msg_id, True)
