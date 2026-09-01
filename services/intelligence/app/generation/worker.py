"""Generation worker arm: one grounded question per assessment_generate message.

Runs the D-06 outcome dispatch: accepted questions make the assessment
`ready` and the job `succeeded` (one DB transaction via
`complete_assessment_generation`); dropped slots (repair exhausted, no valid
citations) fail the assessment with a warning; quota/timeout/provider errors
fail the job retryable, keep the assessment `generating`, and surface the
failure as an assessment warning so the UI can offer retry/resume.
`partial` is reserved for multi-question slices and is never produced here.

Note on drop codes: a candidate dropped purely for the citation gate carries
`Warning(code=citation_missing)`, while the job error_code and telemetry
outcome record `malformed_output` (the closest public ServiceError /
telemetry enum member for "unusable output"); the warning is the specific
cause, the code is the public bucket.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from dataclasses import dataclass

from app.generation.context import build_context
from app.generation.models import GenerationBlueprint, RetrievedChunk
from app.generation.openrouter_client import OpenRouterGenerationClient
from app.generation.prompts import MCQ_SCHEMA, build_messages, prompt_template_version
from app.generation.repo import GenerationRepo
from app.generation.validation import validate_question
from app.ingestion.models import IngestionError, QueueMessage
from app.ingestion.queue import WorkQueue
from app.ingestion.telemetry import TelemetryRecord, TelemetrySink

logger = logging.getLogger("generation.worker")

GENERATION_QUEUE = "assessment_generate"
DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731"


@dataclass(frozen=True)
class GenerationWorkerConfig:
    poll_interval_seconds: float = 1.0
    visibility_seconds: int = 90
    max_in_flight: int = 1
    model: str = DEFAULT_MODEL


ContextBuilder = Callable[[str, tuple[str, ...], str], list[RetrievedChunk]]


class GenerationWorker:
    """One queue arm; poll `assessment_generate` and process one message."""

    def __init__(
        self,
        *,
        repo: GenerationRepo,
        queue: WorkQueue,
        adapter: OpenRouterGenerationClient,
        telemetry: TelemetrySink,
        config: GenerationWorkerConfig,
        context_builder: ContextBuilder | None = None,
    ) -> None:
        self._repo = repo
        self._queue = queue
        self._adapter = adapter
        self._telemetry = telemetry
        self.config = config
        self._context_builder = context_builder or build_context

    def run_once(self) -> int:
        messages = self._queue.poll(
            GENERATION_QUEUE,
            visibility_seconds=self.config.visibility_seconds,
            quantity=self.config.max_in_flight,
        )
        for message in messages:
            try:
                self._process(message)
            except Exception:
                logger.exception("generation message %s failed", message.msg_id)
                self._queue.complete(GENERATION_QUEUE, message.msg_id, False)
        return len(messages)

    def _process(self, message: QueueMessage) -> None:
        payload = message.payload
        job_id = str(payload.get("jobId") or "")
        assessment_id = str(payload.get("assessmentId") or "")
        material_id = str(payload.get("materialId") or "")
        correlation_id = str(payload.get("correlationId") or "")
        if not (job_id and assessment_id and material_id):
            logger.error("generation message missing identity fields: %s", payload)
            self._queue.complete(GENERATION_QUEUE, message.msg_id, False)
            return

        self._repo.update_job_status(job_id, "running")
        assessment = self._repo.get_assessment(assessment_id)
        if (assessment.get("status") or "") != "generating":
            # Re-entry guard: a redelivered message must not re-spend the
            # provider budget on an assessment that already completed or
            # failed (the completion RPC enforces the same guard in DB).
            logger.info("generation message for terminal assessment %s dropped", assessment_id)
            self._queue.complete(GENERATION_QUEUE, message.msg_id, True)
            return
        material = self._repo.get_material(material_id)
        recipe = assessment.get("recipe") or {}
        difficulty = int(recipe.get("difficulty") or 3)
        skill_tags = tuple(str(tag) for tag in (recipe.get("skillTags") or ["core"]))
        blueprint = GenerationBlueprint(
            assessment_id=assessment_id,
            job_id=job_id,
            owner_id=str(assessment.get("user_id") or ""),
            material_id=material_id,
            difficulty=difficulty,
            skill_tags=skill_tags,
            correlation_id=correlation_id,
        )
        if not blueprint.owner_id:
            self._fail_assessment(
                blueprint,
                warnings=[{"code": "internal_error", "message": "assessment owner is unknown"}],
                error_code="internal_error",
                error_message="assessment owner is unknown",
                retryable=False,
                outcome="provider_error",
                latency_ms=0.0,
                repair_attempted=False,
                message_id=message.msg_id,
            )
            return

        try:
            chunks = self._context_builder(material_id, skill_tags, material.title)
        except IngestionError as exc:
            self._mark_job_retryable(job_id, exc)
            self._repo.update_assessment_status(
                assessment_id,
                "generating",
                [{"code": exc.code, "message": exc.message}],
            )
            self._queue.complete(GENERATION_QUEUE, message.msg_id, True)
            return

        context_ids = {chunk.chunk_id for chunk in chunks}
        chunk_texts = {chunk.chunk_id: chunk.text for chunk in chunks}
        messages = build_messages(blueprint, chunks, title=material.title)
        response = self._adapter.generate(messages, MCQ_SCHEMA, correlation_id=correlation_id)
        repair_attempted = False
        accepted = None
        warnings: list[dict] = []

        if response.outcome == "ok" and response.structured_output is not None:
            accepted, warnings = validate_question(
                response.structured_output, blueprint, context_ids, chunk_texts
            )
            if accepted is None and any(w["code"] == "malformed_output" for w in warnings):
                repair_feedback = "; ".join(str(w["message"]) for w in warnings)
                accepted, warnings = self._repair_once(
                    blueprint,
                    chunks,
                    material.title,
                    response,
                    context_ids,
                    chunk_texts,
                    repair_feedback=repair_feedback,
                )
                repair_attempted = True
        elif response.outcome == "malformed_output":
            repair_feedback = str(
                (response.error or {}).get("message") or "output failed validation"
            )
            accepted, warnings = self._repair_once(
                blueprint,
                chunks,
                material.title,
                response,
                context_ids,
                chunk_texts,
                repair_feedback=repair_feedback,
            )
            repair_attempted = True

        if accepted is not None:
            self._accept_question(blueprint, accepted, warnings, response, repair_attempted)
            self._queue.complete(GENERATION_QUEUE, message.msg_id, True)
            return

        if response.outcome in ("quota_failure", "timeout", "provider_error"):
            retryable = bool((response.error or {}).get("retryable", False))
            error_code = str((response.error or {}).get("code") or "provider_error")
            error_message = str((response.error or {}).get("message") or "generation failed")
            self._repo.update_job_status(
                job_id,
                "failed",
                error_code=error_code,
                error_message=error_message,
                retryable=retryable,
                retry_after=(response.error or {}).get("retryAfterSeconds"),
            )
            # The assessment stays `generating` (D-06) so the UI can offer
            # retry/resume; surface the retryable failure as a warning so the
            # page is not stuck on an eternal spinner.
            self._repo.update_assessment_status(
                blueprint.assessment_id,
                "generating",
                [{"code": error_code, "message": error_message}],
            )
            self._emit_telemetry(blueprint, response.outcome, response, repair_attempted, 0)
            self._queue.complete(GENERATION_QUEUE, message.msg_id, True)
            return

        if response.outcome == "safety_block":
            self._fail_assessment(
                blueprint,
                warnings=[{"code": "safety_block", "message": "provider safety block"}],
                error_code="safety_block",
                error_message="provider safety block",
                retryable=False,
                outcome=response.outcome,
                latency_ms=response.latency_ms,
                repair_attempted=repair_attempted,
                message_id=message.msg_id,
            )
            return

        if not warnings:
            warnings = [
                {"code": "malformed_output", "message": "generation produced no usable output"}
            ]
        self._fail_assessment(
            blueprint,
            warnings=warnings,
            error_code="malformed_output",
            error_message="; ".join(w["message"] for w in warnings),
            retryable=False,
            outcome="malformed_output" if response.outcome == "ok" else response.outcome,
            latency_ms=response.latency_ms,
            repair_attempted=repair_attempted,
            message_id=message.msg_id,
        )

    def _repair_once(
        self,
        blueprint: GenerationBlueprint,
        chunks: list[RetrievedChunk],
        title: str,
        response,
        context_ids: set[str],
        chunk_texts: dict[str, str],
        *,
        repair_feedback: str,
    ) -> tuple[dict | None, list[dict]]:
        messages = build_messages(
            blueprint,
            chunks,
            title=title,
            repair_feedback=repair_feedback,
            assistant_content=response.content,
        )
        repaired = self._adapter.generate(
            messages, MCQ_SCHEMA, repair=True, correlation_id=blueprint.correlation_id
        )
        if repaired.outcome == "ok" and repaired.structured_output is not None:
            return validate_question(
                repaired.structured_output, blueprint, context_ids, chunk_texts
            )
        return None, [{"code": "malformed_output", "message": "repair validation failed"}]

    def _accept_question(
        self,
        blueprint: GenerationBlueprint,
        accepted: dict,
        warnings: list[dict],
        response,
        repair_attempted: bool,
    ) -> None:
        question_row = {
            "id": str(uuid.uuid4()),
            "assessment_id": blueprint.assessment_id,
            "user_id": blueprint.owner_id,
            "material_id": blueprint.material_id,
            "format": "objective",
            "prompt": str(accepted["stem"]),
            # Real JSON values, not dumps() strings: PostgREST stores a
            # JSON string literally in jsonb, which breaks clients.
            "options": list(accepted["options"]),
            "skill_tags": list(accepted["skillTags"]),
            "authored_difficulty": int(accepted["difficulty"]),
            "citations": list(accepted["citations"]),
            "answer_block": {"correctIndex": accepted["correctIndex"]},
        }
        # One DB transaction (migration 023): question insert + assessment
        # ready + job succeeded. The RPC refuses to run when the assessment
        # is not `generating`, so a redelivered message cannot duplicate.
        self._repo.complete_assessment(question_row, blueprint.job_id, "ready", warnings)
        self._emit_telemetry(blueprint, "ok", response, repair_attempted, 1)

    def _fail_assessment(
        self,
        blueprint: GenerationBlueprint,
        *,
        warnings: list[dict],
        error_code: str,
        error_message: str,
        retryable: bool,
        outcome: str,
        latency_ms: float,
        repair_attempted: bool,
        message_id: int,
    ) -> None:
        self._repo.update_assessment_status(blueprint.assessment_id, "failed", warnings)
        self._repo.update_job_status(
            blueprint.job_id,
            "failed",
            error_code=error_code,
            error_message=error_message,
            retryable=retryable,
        )
        self._emit_telemetry(blueprint, outcome, None, repair_attempted, 0)
        self._queue.complete(GENERATION_QUEUE, message_id, True)

    def _mark_job_retryable(self, job_id: str, exc: IngestionError) -> None:
        self._repo.update_job_status(
            job_id,
            "failed",
            error_code=exc.code,
            error_message=exc.message,
            retryable=exc.retryable,
            retry_after=exc.retry_after,
        )

    def _emit_telemetry(
        self,
        blueprint: GenerationBlueprint,
        outcome: str,
        response,
        repair_attempted: bool,
        questions_accepted: int,
    ) -> None:
        usage = (response.usage if response is not None else {}) or {}
        record = TelemetryRecord(
            trace_id=blueprint.correlation_id,
            owner_id=blueprint.owner_id,
            task="assessment_generation",
            model=self.config.model,
            prompt_template_version=prompt_template_version,
            outcome=outcome,
            latency_ms=response.latency_ms if response is not None else 0.0,
            input_tokens=int(usage.get("prompt_tokens", 0)),
            output_tokens=int(usage.get("completion_tokens", 0)),
            repair_attempted=repair_attempted,
            questions_requested=1,
            questions_accepted=questions_accepted,
            reasoning_tokens=usage.get("reasoning_tokens"),
        )
        try:
            self._telemetry.emit([record])
        except Exception:
            logger.exception("generation telemetry emit failed; ignoring")
