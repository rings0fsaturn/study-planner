"""Shared poll/classify/complete loop for the assessment worker arms.

The grading and deletion arms poll different queues but share one fault policy:
a retryable storage fault resets the job to `queued` and returns the message
for redelivery up to the delivery cap; a terminal fault (or a cap reached)
marks the job failed and archives the message instead of redelivering forever -
one orphaned message head-of-line blocks a single-in-flight arm (observed live
2026-09-20 in the generation arm: 276 redeliveries).
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Protocol

from app.ingestion.models import IngestionError, QueueMessage
from app.ingestion.queue import WorkQueue

logger = logging.getLogger("ingestion.arm")


class JobStatusRepo(Protocol):
    def update_job_status(self, job_id: str, status: str, **meta) -> None: ...


def fail_job(repo: JobStatusRepo, job_id: str, *, code: str, message: str) -> None:
    """Best-effort terminal transition; a repo fault never blocks the archive."""
    if not job_id:
        return
    try:
        repo.update_job_status(
            job_id, "failed", error_code=code, error_message=message, retryable=False
        )
    except Exception:
        logger.exception("job %s could not be marked failed", job_id)


def run_assessment_arm_once(
    *,
    queue_name: str,
    label: str,
    process: Callable[[QueueMessage], None],
    repo: JobStatusRepo,
    queue: WorkQueue,
    visibility_seconds: int,
    quantity: int,
    max_deliveries: int,
) -> int:
    """Drain one poll of an assessment arm; returns the message count."""
    messages = queue.poll(queue_name, visibility_seconds=visibility_seconds, quantity=quantity)
    for message in messages:
        job_id = str(message.payload.get("jobId") or "")
        correlation_id = str(message.payload.get("correlationId") or "")
        try:
            process(message)
        except IngestionError as exc:
            if not exc.retryable or message.read_ct >= max_deliveries:
                logger.warning(
                    "%s message %s dropped (%s): %s",
                    label,
                    message.msg_id,
                    exc.code,
                    exc.message,
                    extra={"trace_id": correlation_id},
                )
                fail_job(repo, job_id, code=exc.code, message=exc.message)
                queue.complete(queue_name, message.msg_id, True)
            else:
                # Transient storage fault: return the message for redelivery
                # and reset the job to queued so no running row is orphaned.
                logger.exception(
                    "%s message %s failed transiently",
                    label,
                    message.msg_id,
                    extra={"trace_id": correlation_id},
                )
                if job_id:
                    repo.update_job_status(job_id, "queued")
                queue.complete(queue_name, message.msg_id, False)
        except Exception:
            logger.exception(
                "%s message %s failed",
                label,
                message.msg_id,
                extra={"trace_id": correlation_id},
            )
            queue.complete(queue_name, message.msg_id, False)
    return len(messages)
