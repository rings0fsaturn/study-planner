"""Grading worker arm (#39): poll `assessment_grade`, grade, persist.

Mirrors the generation arm's shape (D-04 two-arm pattern, now three-arm):
narrow repo protocol, WorkQueue via the generic pgmq wrappers, one message
per poll, re-queue on transient faults, and job transitions through
`ingestion_jobs` (kind='grading', pre-reserved in the 005 CHECK enum).
"""

from __future__ import annotations

import datetime as dt
import logging
from dataclasses import dataclass
from typing import Protocol

from app.grading.grader import GraderInputError, grade_objective
from app.ingestion.models import IngestionError, QueueMessage
from app.ingestion.queue import WorkQueue

logger = logging.getLogger("grading.worker")

GRADING_QUEUE = "assessment_grade"


@dataclass(frozen=True)
class GradingWorkerConfig:
    poll_interval_seconds: float = 1.0
    visibility_seconds: int = 30
    max_in_flight: int = 1


class GradingRepo(Protocol):
    """Narrow persistence contract; SupabaseIngestionRepo implements it."""

    def get_attempt(self, attempt_id: str) -> dict: ...
    def get_question(self, question_id: str) -> dict: ...
    def update_job_status(self, job_id: str, status: str) -> None: ...
    def complete_attempt(
        self, attempt_id: str, job_id: str, status: str, grade: dict | None
    ) -> None: ...


def _now_iso() -> str:
    return (
        dt.datetime.now(dt.UTC)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def _ungradable(attempt_id: str, question_id: str, reason: str, graded_at: str) -> dict:
    """A deterministic fail-closed result for unusable input: score 0, no key."""
    return {
        "attemptId": attempt_id,
        "questionId": question_id,
        "materialId": "",
        "score": 0.0,
        "correct": False,
        "perSkill": [],
        "explanation": None,
        "grader": "objective",
        "gradedAt": graded_at,
        "publicFeedback": f"Attempt ungradable: {reason}.",
    }


class GradingWorker:
    """One queue arm; poll `assessment_grade` and process one message."""

    def __init__(
        self,
        *,
        repo: GradingRepo,
        queue: WorkQueue,
        config: GradingWorkerConfig,
    ) -> None:
        self._repo = repo
        self._queue = queue
        self.config = config

    def run_once(self) -> int:
        messages = self._queue.poll(
            GRADING_QUEUE,
            visibility_seconds=self.config.visibility_seconds,
            quantity=self.config.max_in_flight,
        )
        for message in messages:
            try:
                self._process(message)
            except IngestionError:
                # Transient storage fault: return the message for redelivery
                # and reset the job to queued so no running row is orphaned.
                logger.exception("grading message %s failed transiently", message.msg_id)
                self._repo.update_job_status(str(message.payload.get("jobId") or ""), "queued")
                self._queue.complete(GRADING_QUEUE, message.msg_id, False)
            except Exception:
                logger.exception("grading message %s failed", message.msg_id)
                self._queue.complete(GRADING_QUEUE, message.msg_id, False)
        return len(messages)

    def _process(self, message: QueueMessage) -> None:
        payload = message.payload
        job_id = str(payload.get("jobId") or "")
        attempt_id = str(payload.get("attemptId") or "")
        if not (job_id and attempt_id):
            logger.error("grading message missing identity fields: %s", payload)
            self._queue.complete(GRADING_QUEUE, message.msg_id, False)
            return

        self._repo.update_job_status(job_id, "running")

        attempt = self._repo.get_attempt(attempt_id)
        question = self._repo.get_question(str(attempt.get("question_id") or ""))
        graded_at = _now_iso()

        try:
            grade = grade_objective(
                question_id=str(question.get("id") or ""),
                material_id=str(question.get("material_id") or ""),
                skill_tags=list(question.get("skill_tags") or []),
                answer_block=dict(question.get("answer_block") or {}),
                answer=dict(attempt.get("answer") or {}),
                graded_at=graded_at,
                attempt_id=attempt_id,
            )
            status = "graded"
        except GraderInputError as exc:
            # Malformed/unusable input is a deterministic fail-closed outcome,
            # not a retryable fault: the job succeeds with a failed attempt.
            logger.warning("attempt %s ungradable: %s", attempt_id, exc)
            grade = _ungradable(attempt_id, str(question.get("id") or ""), str(exc), graded_at)
            status = "failed"

        self._repo.complete_attempt(attempt_id, job_id, status, grade)
        self._repo.update_job_status(job_id, "succeeded")
        self._queue.complete(GRADING_QUEUE, message.msg_id, True)
