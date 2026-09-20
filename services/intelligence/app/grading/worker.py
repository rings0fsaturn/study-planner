"""Grading worker arm (#39): poll `assessment_grade`, grade, persist.

Mirrors the generation arm's shape (D-04 two-arm pattern, now three-arm):
narrow repo protocol, WorkQueue via the generic pgmq wrappers, one message
per poll, re-queue on transient faults, and job transitions through
`ingestion_jobs` (kind='grading', pre-reserved in the 005 CHECK enum).

Two question families ride this arm (#41): objective answers grade
deterministically against the stored key, and written answers grade through the
rubric arm — the provider judges each authored criterion, `rubric_grader`
composes the public grade. Provider failures are classified by policy: a
transient one returns the message for redelivery and leaves the attempt in
flight, a terminal one (or unusable input) fails the attempt closed rather
than looping the queue. Coding answers (#42) add a third family: the sandbox
client executes the authored tests, `coding_grader` composes the public grade,
and sandbox-infra faults follow the same retryable-vs-terminal split.
"""

from __future__ import annotations

import datetime as dt
import logging
from dataclasses import dataclass
from typing import Protocol

from app.grading.coding_grader import (
    GRADER_NAME as JUDGE0_GRADER_NAME,
)
from app.grading.coding_grader import (
    OUTPUT_PREDICTION_SUBTYPE,
    TestVerdict,
    coding_submission,
    grade_coding,
    hidden_test_name,
    hidden_tests,
    visible_tests,
)
from app.grading.grader import GraderInputError, grade_objective
from app.grading.piston_client import RUN_COMPILE_ERROR, RUN_FAILED, PistonClient
from app.grading.rubric_grader import (
    GRADER_NAME as RUBRIC_GRADER_NAME,
)
from app.grading.rubric_grader import (
    RUBRIC_GRADING_SCHEMA,
    RubricAdapter,
    RubricProviderError,
    RubricResponseError,
    build_rubric_messages,
    classify_provider_failure,
    grade_written,
    rubric_criteria,
    written_answer_text,
)
from app.ingestion.models import IngestionError, QueueMessage
from app.ingestion.queue import WorkQueue

logger = logging.getLogger("grading.worker")

GRADING_QUEUE = "assessment_grade"
OBJECTIVE_FORMAT = "objective"
WRITTEN_FORMAT = "written"
CODING_FORMAT = "coding"
DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731"


@dataclass(frozen=True)
class GradingWorkerConfig:
    poll_interval_seconds: float = 1.0
    visibility_seconds: int = 30
    max_in_flight: int = 1
    # Retryable storage faults redeliver at most this many times before the
    # message is archived (the ingestion worker's max_deliveries precedent).
    max_deliveries: int = 3
    model: str = DEFAULT_MODEL


class GradingRepo(Protocol):
    """Narrow persistence contract; SupabaseIngestionRepo implements it."""

    def get_attempt(self, attempt_id: str) -> dict: ...
    def get_question(self, question_id: str) -> dict: ...

    def update_job_status(self, job_id: str, status: str, **meta) -> None: ...

    def complete_attempt(
        self, attempt_id: str, job_id: str, status: str, grade: dict | None
    ) -> None: ...


def _now_iso() -> str:
    return (
        dt.datetime.now(dt.UTC)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def _ungradable(
    attempt_id: str,
    question_id: str,
    reason: str,
    graded_at: str,
    *,
    grader: str = OBJECTIVE_FORMAT,
) -> dict:
    """A deterministic fail-closed result for unusable input: score 0, no key."""
    return {
        "attemptId": attempt_id,
        "questionId": question_id,
        "materialId": "",
        "score": 0.0,
        "correct": False,
        "perSkill": [],
        "explanation": None,
        "grader": grader,
        "gradedAt": graded_at,
        "publicFeedback": f"Attempt ungradable: {reason}.",
    }


def _is_written(question: dict) -> bool:
    return str(question.get("format") or "") == WRITTEN_FORMAT


def _is_coding(question: dict) -> bool:
    return str(question.get("format") or "") == CODING_FORMAT


def _grader_label(coding: bool, written: bool) -> str:
    """The contract grader label for a fail-closed outcome."""
    if coding:
        return JUDGE0_GRADER_NAME
    return RUBRIC_GRADER_NAME if written else OBJECTIVE_FORMAT


class GradingWorker:
    """One queue arm; poll `assessment_grade` and process one message."""

    def __init__(
        self,
        *,
        repo: GradingRepo,
        queue: WorkQueue,
        config: GradingWorkerConfig,
        adapter: RubricAdapter | None = None,
        sandbox: PistonClient | None = None,
    ) -> None:
        self._repo = repo
        self._queue = queue
        self._adapter = adapter
        self._sandbox = sandbox
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
            except IngestionError as exc:
                job_id = str(message.payload.get("jobId") or "")
                if not exc.retryable or message.read_ct >= self.config.max_deliveries:
                    # A terminal error (the attempt or question was deleted
                    # while the message was in flight, say) can never succeed:
                    # mark the job failed when it still exists and archive the
                    # message instead of redelivering forever — one orphaned
                    # message head-of-line blocks the single-in-flight arm.
                    logger.warning(
                        "grading message %s dropped (%s): %s",
                        message.msg_id,
                        exc.code,
                        exc.message,
                    )
                    try:
                        self._repo.update_job_status(
                            job_id,
                            "failed",
                            error_code=exc.code,
                            error_message=exc.message,
                            retryable=False,
                        )
                    except Exception:
                        logger.exception("grading job %s could not be marked failed", job_id)
                    self._queue.complete(GRADING_QUEUE, message.msg_id, True)
                else:
                    # Transient storage fault: return the message for redelivery
                    # and reset the job to queued so no running row is orphaned.
                    logger.exception("grading message %s failed transiently", message.msg_id)
                    self._repo.update_job_status(job_id, "queued")
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
        question_id = str(question.get("id") or "")
        graded_at = _now_iso()
        coding = _is_coding(question)
        written = _is_written(question)

        try:
            if coding:
                grade = self._grade_coding(
                    attempt=attempt,
                    question=question,
                    attempt_id=attempt_id,
                    graded_at=graded_at,
                )
            elif written:
                grade = self._grade_written(
                    attempt=attempt,
                    question=question,
                    attempt_id=attempt_id,
                    graded_at=graded_at,
                )
            else:
                grade = grade_objective(
                    question_id=question_id,
                    material_id=str(question.get("material_id") or ""),
                    skill_tags=list(question.get("skill_tags") or []),
                    answer_block=dict(question.get("answer_block") or {}),
                    answer=dict(attempt.get("answer") or {}),
                    graded_at=graded_at,
                    attempt_id=attempt_id,
                )
            status = "graded"
        except RubricResponseError as exc:
            # The provider is nondeterministic, so a payload that cannot be
            # mapped onto the rubric is retryable rather than a dead end
            # (PLAN D-03); the attempt stays in flight for the redelivery.
            logger.warning("written grading for attempt %s malformed: %s", attempt_id, exc)
            self._repo.update_job_status(
                job_id,
                "failed",
                error_code="malformed_output",
                error_message=str(exc)[:300],
                retryable=True,
            )
            self._queue.complete(GRADING_QUEUE, message.msg_id, False)
            return
        except RubricProviderError as exc:
            failure = exc.failure
            self._repo.update_job_status(
                job_id,
                "failed",
                error_code=failure.code,
                error_message=failure.message,
                retryable=failure.retryable,
                retry_after=failure.retry_after,
            )
            if failure.retryable:
                logger.warning(
                    "written grading for attempt %s deferred (%s)", attempt_id, failure.code
                )
                self._queue.complete(GRADING_QUEUE, message.msg_id, False)
                return
            # Terminal provider failure (safety block, credentials, unusable
            # capability): fail the attempt closed so the learner sees an
            # honest outcome instead of a queue entry that never completes.
            logger.error(
                "written grading for attempt %s failed closed: %s", attempt_id, failure.code
            )
            grade = _ungradable(
                attempt_id,
                question_id,
                failure.message,
                graded_at,
                grader=RUBRIC_GRADER_NAME,
            )
            status = "failed"
        except GraderInputError as exc:
            # Malformed/unusable input is a deterministic fail-closed outcome,
            # not a retryable fault: the job succeeds with a failed attempt.
            logger.warning("attempt %s ungradable: %s", attempt_id, exc)
            grade = _ungradable(
                attempt_id,
                question_id,
                str(exc),
                graded_at,
                grader=_grader_label(coding, written),
            )
            status = "failed"
        except IngestionError as exc:
            # Sandbox-infra fault (transport, 5xx, internal verdict): mirror
            # the llm_rubric retryable-vs-terminal split (D-05). Retryable
            # conditions return the message for redelivery with the attempt
            # left in flight; a non-retryable one (our own request bug) fails
            # the attempt closed so the learner sees an honest outcome.
            self._repo.update_job_status(
                job_id,
                "failed",
                error_code=exc.code,
                error_message=str(exc)[:300],
                retryable=exc.retryable,
                retry_after=exc.retry_after,
            )
            if exc.retryable:
                logger.warning(
                    "coding grading for attempt %s deferred (%s)", attempt_id, exc.code
                )
                self._queue.complete(GRADING_QUEUE, message.msg_id, False)
                return
            logger.error(
                "coding grading for attempt %s failed closed: %s", attempt_id, exc.code
            )
            grade = _ungradable(
                attempt_id,
                question_id,
                str(exc),
                graded_at,
                grader=_grader_label(coding, written),
            )
            status = "failed"

        self._repo.complete_attempt(attempt_id, job_id, status, grade)
        self._repo.update_job_status(job_id, "succeeded")
        self._queue.complete(GRADING_QUEUE, message.msg_id, True)

    def _grade_written(
        self,
        *,
        attempt: dict,
        question: dict,
        attempt_id: str,
        graded_at: str,
    ) -> dict:
        """One provider call plus deterministic composition into the grade."""
        if self._adapter is None:
            raise GraderInputError("written grading requires a provider adapter")
        # Both the answer and the rubric are validated before the call, so an
        # unusable submission or an unusable question costs no provider budget.
        answer_text = written_answer_text(attempt.get("answer"))
        rubric_criteria(question.get("answer_block"))
        messages = build_rubric_messages(question, answer_text)
        response = self._adapter.generate(
            messages,
            RUBRIC_GRADING_SCHEMA,
            correlation_id=str(attempt.get("correlation_id") or ""),
        )
        if response.outcome != "ok" or response.structured_output is None:
            raise RubricProviderError(classify_provider_failure(response))
        return grade_written(
            question_id=str(question.get("id") or ""),
            material_id=str(question.get("material_id") or ""),
            skill_tags=list(question.get("skill_tags") or []),
            answer_block=dict(question.get("answer_block") or {}),
            answer=dict(attempt.get("answer") or {}),
            provider_payload=response.structured_output,
            graded_at=graded_at,
            attempt_id=attempt_id,
            model_version=self.config.model,
        )

    def _grade_coding(
        self,
        *,
        attempt: dict,
        question: dict,
        attempt_id: str,
        graded_at: str,
    ) -> dict:
        """Execute the authored tests through the sandbox and compose the grade.

        `output_prediction` short-circuits to the deterministic objective
        value match (D-01): no sandbox call, no new code path. All other
        coding subtypes run the visible tests first, then the hidden tests,
        and stop at the first compile failure (every remaining test would
        fail identically); unrun tests are padded as failed verdicts so the
        public table stays complete.
        """
        if str(question.get("subtype") or "") == OUTPUT_PREDICTION_SUBTYPE:
            return grade_objective(
                question_id=str(question.get("id") or ""),
                material_id=str(question.get("material_id") or ""),
                skill_tags=list(question.get("skill_tags") or []),
                answer_block=dict(question.get("answer_block") or {}),
                answer=dict(attempt.get("answer") or {}),
                graded_at=graded_at,
                attempt_id=attempt_id,
            )
        if self._sandbox is None:
            raise GraderInputError("coding grading requires a sandbox client")
        source, time_limit_ms, memory_limit_mb = coding_submission(attempt.get("answer"))
        tests: list[tuple[str, bool, dict]] = [
            (
                str(test.get("name") or f"Visible test {index}"),
                True,
                test,
            )
            for index, test in enumerate(visible_tests(question), start=1)
        ]
        hidden = hidden_tests(question.get("answer_block"))
        tests.extend(
            (hidden_test_name(index), False, test)
            for index, test in enumerate(hidden, start=1)
        )
        verdicts: list[TestVerdict] = []
        for name, visible, test in tests:
            run = self._sandbox.execute(
                source=source,
                stdin=str(test.get("stdin") or ""),
                expected_output=str(test.get("expectedOutput") or ""),
                time_limit_ms=time_limit_ms,
                memory_limit_mb=memory_limit_mb,
                attempt_id=attempt_id,
                test_index=len(verdicts),
                trace_id=str(attempt.get("correlation_id") or ""),
            )
            verdicts.append(TestVerdict(name=name, visible=visible, outcome=run.outcome))
            if run.outcome == RUN_COMPILE_ERROR:
                break
        verdicts.extend(
            TestVerdict(name=name, visible=visible, outcome=RUN_FAILED)
            for name, visible, _test in tests[len(verdicts):]
        )
        grade = grade_coding(
            question_id=str(question.get("id") or ""),
            material_id=str(question.get("material_id") or ""),
            skill_tags=list(question.get("skill_tags") or []),
            verdicts=verdicts,
            graded_at=graded_at,
            attempt_id=attempt_id,
        )
        # D-11: the composed outcome joins the worker trail via the attempt's
        # correlation id; source, tests and expected outputs never log.
        logger.info(
            "coding grade composed attempt=%s score=%.4f correct=%s",
            attempt_id,
            grade["score"],
            grade["correct"],
            extra={"trace_id": str(attempt.get("correlation_id") or "")},
        )
        return grade
