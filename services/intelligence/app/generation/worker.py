"""Generation worker arm: one grounded question per assessment_generate message.

Runs the D-06 outcome dispatch: accepted questions make the assessment
`ready` and the job `succeeded` (one DB transaction via
`complete_assessment_generation`); dropped slots (repair exhausted, no valid
citations) fail the assessment with a warning; quota/timeout/provider errors
fail the job retryable, keep the assessment `generating`, and surface the
failure as an assessment warning so the UI can offer retry/resume.
`partial` is reserved for multi-question slices and is never produced here.

Three question families ride this arm (#41, #42): an objective recipe authors
one MCQ (`mcq_schema(context_ids)`, answer block = correct index), a written
recipe authors one written question plus its server-only rubric block
(`written_schema(context_ids)`, migration 027 stores `format`/`subtype`), and
a coding recipe authors one coding question (`coding_schema(context_ids)`,
migration 031 stores the visible payload; hidden tests and the reference
solution ride `answer_block`). Every schema is built per message and binds
`citations[].chunkId` to the retrieved ids by enum, so a hallucinated chunk id
cannot reach the citation gate. Everything else in the pipeline is shared:
same context, same adapter, same one-repair policy, same completion RPC.

Coding adds two rules of its own (D-04/D-05): the provider may judge the
material unsuitable and return a `code_not_derivable` warning instead of a
question, and every tests-bearing question must pass its own reference
solution through the sandbox before it is stored (groundedness-over-count).

Note on drop codes: a candidate dropped purely for the citation gate carries
`Warning(code=citation_missing)`, while the job error_code and telemetry
outcome record `malformed_output` (the closest public ServiceError /
telemetry enum member for "unusable output"); the warning is the specific
cause, the code is the public bucket.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Protocol

from app.generation.context import CONTEXT_TOP_K
from app.generation.models import AssessmentScope, GenerationBlueprint, RetrievedChunk
from app.generation.openrouter_client import OpenRouterGenerationClient
from app.generation.prompts import (
    CODING_PROMPT_TEMPLATE_VERSION,
    WRITTEN_PROMPT_TEMPLATE_VERSION,
    build_coding_messages,
    build_messages,
    build_written_messages,
    coding_schema,
    mcq_schema,
    prompt_template_version,
    written_schema,
)
from app.generation.repo import GenerationRepo
from app.generation.validation import validate_coding, validate_question, validate_written
from app.grading.coding_grader import (
    CODING_LANGUAGE,
    MEMORY_MAX_MB,
    OUTPUT_PREDICTION_SUBTYPE,
    TIME_LIMIT_MAX_MS,
)
from app.grading.piston_client import RUN_PASSED, PistonClient
from app.ingestion.models import IngestionError, QueueMessage
from app.ingestion.queue import WorkQueue
from app.ingestion.telemetry import TelemetryRecord, TelemetrySink, outcome_for_error_code

logger = logging.getLogger("generation.worker")

GENERATION_QUEUE = "assessment_generate"
DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731"
OBJECTIVE_FORMAT = "objective"
WRITTEN_FORMAT = "written"
CODING_FORMAT = "coding"

_TEMPLATE_VERSIONS = {
    WRITTEN_FORMAT: WRITTEN_PROMPT_TEMPLATE_VERSION,
    CODING_FORMAT: CODING_PROMPT_TEMPLATE_VERSION,
}

# One arm per family: (message builder, response schema factory, validator).
# An unknown format falls back to the objective arm so a stored recipe cannot
# select an unvalidated path (the `_recipe_format` rule).
_ARM = {
    WRITTEN_FORMAT: (build_written_messages, written_schema, validate_written),
    CODING_FORMAT: (build_coding_messages, coding_schema, validate_coding),
}
_OBJECTIVE_ARM = (build_messages, mcq_schema, validate_question)


def _arm(question_format: str):
    return _ARM.get(question_format, _OBJECTIVE_ARM)


def _recipe_format(recipe: dict) -> str:
    """Question family this assessment generates (one family per assessment).

    The recipe gate (`routers/assessments.py`) admits `['objective']`,
    `['written']`, or `['coding']`; anything else is treated as objective so a
    stored recipe cannot select an unvalidated path.
    """
    formats = list(recipe.get("formats") or [])
    if formats == [WRITTEN_FORMAT]:
        return WRITTEN_FORMAT
    if formats == [CODING_FORMAT]:
        return CODING_FORMAT
    return OBJECTIVE_FORMAT


def _written_answer_block(accepted: dict) -> dict:
    """Server-only grading material written to `questions.answer_block`.

    Only the three authored rubric keys are copied, so a key the provider
    smuggled into its output can never ride into the hidden block.
    """
    return {
        "rubricVersion": str(accepted["rubricVersion"]),
        "referenceAnswer": str(accepted["referenceAnswer"]),
        "rubric": [
            {
                "criterion": str(item["criterion"]),
                "weight": float(item["weight"]),
                "maxPoints": int(item["maxPoints"]),
            }
            for item in accepted["rubric"]
        ],
    }


def _coding_answer_block(accepted: dict) -> dict:
    """Server-only coding material written to `questions.answer_block`.

    Only the authored keys are copied (the `_written_answer_block` rule): the
    hidden tests and reference solution for tests-bearing subtypes, the
    accepted value for output_prediction. Visible tests never appear here.
    """
    if str(accepted.get("subtype") or "") == OUTPUT_PREDICTION_SUBTYPE:
        return {"acceptedValue": accepted["acceptedValue"]}
    return {
        "referenceSolution": str(accepted["referenceSolution"]),
        "hiddenTests": [
            {
                "name": str(item["name"]),
                "stdin": str(item["stdin"]),
                "expectedOutput": str(item["expectedOutput"]),
            }
            for item in accepted["hiddenTests"]
        ],
    }


def _coding_row(blueprint: GenerationBlueprint, accepted: dict) -> dict:
    """The `questions` row for an accepted coding candidate (migration 031).

    Visible payload goes to real columns (D-09): `language`, `starter_code`,
    `visible_tests`. An output_prediction question reuses `starter_code` for
    the snippet and carries no visible tests.
    """
    subtype = str(accepted["subtype"])
    row = {
        "id": str(uuid.uuid4()),
        "assessment_id": blueprint.assessment_id,
        "user_id": blueprint.owner_id,
        "material_id": blueprint.material_id,
        "format": CODING_FORMAT,
        "subtype": subtype,
        "prompt": str(accepted["stem"]),
        "options": [],
        "skill_tags": list(accepted["skillTags"]),
        "authored_difficulty": int(accepted["difficulty"]),
        "citations": list(accepted["citations"]),
        "answer_block": _coding_answer_block(accepted),
        "language": CODING_LANGUAGE,
    }
    if subtype == OUTPUT_PREDICTION_SUBTYPE:
        row["starter_code"] = str(accepted["codeSnippet"])
    else:
        row["starter_code"] = str(accepted["starterCode"])
        row["visible_tests"] = [
            {
                "name": str(item["name"]),
                "stdin": str(item["stdin"]),
                "expectedOutput": str(item["expectedOutput"]),
            }
            for item in accepted["visibleTests"]
        ]
    return row


@dataclass(frozen=True)
class GenerationWorkerConfig:
    poll_interval_seconds: float = 1.0
    visibility_seconds: int = 90
    max_in_flight: int = 1
    # Retryable storage faults redeliver at most this many times before the
    # message is archived (the ingestion worker's max_deliveries precedent).
    max_deliveries: int = 3
    model: str = DEFAULT_MODEL


# The context builder is keyed on the steer parts and the learner's scope: the
# material title is document context for the prompt, never the retrieval query
# (D-01), and the scope's page bounds decide which part of the material is
# eligible (D-05). The keyword-only `code_seeking`/`exclude_chunk_ids` are the
# coding arm's seams (D-06/D-07); objective and written callers pass neither.
class ContextBuilder(Protocol):
    def __call__(
        self,
        material_id: str,
        skill_tags: tuple[str, ...],
        scope: AssessmentScope | None,
        *,
        code_seeking: bool = False,
        exclude_chunk_ids: frozenset[str] = frozenset(),
    ) -> list[RetrievedChunk]: ...


# D-06: a scoped context thinner than this widens to neighbouring pages.
WIDEN_STEPS = 2
WIDEN_MIN_PAD = 5

# D-02: a coding generation retries with a different code-dense window up to
# this many times before a terminal `code_not_derivable`. The success path is
# unchanged; only the refusal path spends the extra provider calls.
MAX_CODING_WINDOWS = 3


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
        context_builder: ContextBuilder,
        sandbox: PistonClient | None = None,
    ) -> None:
        self._repo = repo
        self._queue = queue
        self._adapter = adapter
        self._telemetry = telemetry
        self.config = config
        self._context_builder = context_builder
        # The generation-time self-check runs the reference solution through
        # the same sandbox client the grading arm uses (#42 P3).
        self._sandbox = sandbox

    def run_once(self) -> int:
        messages = self._queue.poll(
            GENERATION_QUEUE,
            visibility_seconds=self.config.visibility_seconds,
            quantity=self.config.max_in_flight,
        )
        for message in messages:
            try:
                self._process(message)
            except IngestionError as exc:
                # A message whose target row is gone (or any other terminal
                # error) can never succeed: archive it instead of redelivering
                # forever. Without this, one orphaned message head-of-line
                # blocks the single-in-flight generation arm (observed live
                # 2026-09-20: a cleanup deleted an in-flight assessment and the
                # worker re-read its message 276 times).
                if not exc.retryable or message.read_ct >= self.config.max_deliveries:
                    logger.warning(
                        "generation message %s dropped (%s): %s",
                        message.msg_id,
                        exc.code,
                        exc.message,
                    )
                    self._queue.complete(GENERATION_QUEUE, message.msg_id, True)
                else:
                    logger.exception("generation message %s failed transiently", message.msg_id)
                    self._queue.complete(GENERATION_QUEUE, message.msg_id, False)
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
        # No ["core"] default (D-01): a meaningless tag would ride into the
        # steer and the prompt. No tags and no scope means no steer, which the
        # context builder rejects rather than grounding on noise.
        skill_tags = tuple(str(tag) for tag in (recipe.get("skillTags") or []))
        # The learner's page range, when one was requested (P4/D-05). The
        # router already rejected a malformed or out-of-range scope; an
        # unparseable one is treated as absent rather than crashing the job.
        scope = AssessmentScope.from_recipe(recipe)
        question_format = _recipe_format(recipe)
        coding = question_format == CODING_FORMAT
        blueprint = GenerationBlueprint(
            assessment_id=assessment_id,
            job_id=job_id,
            owner_id=str(assessment.get("user_id") or ""),
            material_id=material_id,
            difficulty=difficulty,
            skill_tags=skill_tags,
            correlation_id=correlation_id,
            question_format=question_format,
            prompt_template_version=_TEMPLATE_VERSIONS.get(
                question_format, prompt_template_version
            ),
            scope=scope,
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

        build, schema_for, validate = _arm(question_format)
        tried_chunk_ids: set[str] = set()
        max_windows = MAX_CODING_WINDOWS if coding else 1
        last_refusal_reason: str | None = None
        response = None
        accepted = None
        warnings: list[dict] = []
        repair_attempted = False

        for window in range(1, max_windows + 1):
            try:
                chunks = self._build_context(
                    material_id,
                    skill_tags,
                    scope,
                    coding=coding,
                    exclude=frozenset(tried_chunk_ids),
                )
                if not chunks:
                    if last_refusal_reason is not None:
                        # The resample excluded every remaining candidate; use
                        # the last honest reason instead of "no content".
                        break
                    # D-06's only rejection: a scope (or a material) with no
                    # chunk to ground on cannot produce a grounded question.
                    raise IngestionError(
                        "validation_failed",
                        (
                            f"pages {scope.page_start}-{scope.page_end} contain no content"
                            if scope is not None
                            else "this material has no content chunks"
                        ),
                        retryable=False,
                    )
                chunks, scope_warnings = self._widen_thin_context(
                    material_id,
                    skill_tags,
                    scope,
                    chunks,
                    coding=coding,
                    exclude=frozenset(tried_chunk_ids),
                )
            except IngestionError as exc:
                if exc.retryable:
                    self._mark_job_retryable(job_id, exc)
                    self._repo.update_assessment_status(
                        assessment_id,
                        "generating",
                        [{"code": exc.code, "message": exc.message}],
                    )
                    self._queue.complete(GENERATION_QUEUE, message.msg_id, True)
                    return
                # A non-retryable context fault (no topic steer to ground on)
                # cannot succeed on a retry, so fail the assessment outright
                # instead of leaving it spinning with a warning.
                self._fail_assessment(
                    blueprint,
                    warnings=[{"code": exc.code, "message": exc.message}],
                    error_code=exc.code,
                    error_message=exc.message,
                    retryable=False,
                    outcome=outcome_for_error_code(exc.code),
                    latency_ms=0.0,
                    repair_attempted=False,
                    message_id=message.msg_id,
                )
                return

            context_ids = {chunk.chunk_id for chunk in chunks}
            chunk_texts = {chunk.chunk_id: chunk.text for chunk in chunks}
            schema = schema_for(context_ids)
            messages = build(blueprint, chunks, title=material.title)
            response = self._adapter.generate(messages, schema, correlation_id=correlation_id)
            repair_attempted = False
            accepted = None
            warnings = list(scope_warnings)

            if response.outcome == "ok" and response.structured_output is not None:
                accepted, warnings = validate(
                    response.structured_output, blueprint, context_ids, chunk_texts
                )
                # The scope's own warnings (D-06's widen) travel with the question.
                warnings = [*scope_warnings, *warnings]
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
                        question_format=question_format,
                    )
                    warnings = [*scope_warnings, *warnings]
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
                    question_format=question_format,
                )
                warnings = [*scope_warnings, *warnings]
                repair_attempted = True

            if accepted is not None:
                break

            if any(w["code"] == "code_not_derivable" for w in warnings):
                # The provider judged the material unsuitable (D-04): a
                # legitimate answer, not a format failure, so no repair. Try a
                # different code-dense window first (D-02); only the last
                # window's reason reaches the learner.
                last_refusal_reason = next(
                    str(w["message"]) for w in warnings if w["code"] == "code_not_derivable"
                )
                if window < max_windows:
                    tried_chunk_ids.update(context_ids)
                    logger.info(
                        "coding generation %s window %d/%d unsuitable; resampling (%s)",
                        assessment_id,
                        window,
                        max_windows,
                        last_refusal_reason,
                        extra={"trace_id": correlation_id},
                    )
                    continue
                break

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
                    {
                        "code": "malformed_output",
                        "message": "generation produced no usable output",
                    }
                ]
            self._fail_assessment(
                blueprint,
                warnings=warnings,
                error_code="malformed_output",
                error_message="; ".join(w["message"] for w in warnings),
                retryable=False,
                outcome=("malformed_output" if response.outcome == "ok" else response.outcome),
                latency_ms=response.latency_ms,
                repair_attempted=repair_attempted,
                message_id=message.msg_id,
            )
            return

        if accepted is not None:
            if window > 1:
                logger.info(
                    "coding generation %s accepted on window %d/%d",
                    assessment_id,
                    window,
                    max_windows,
                    extra={"trace_id": correlation_id},
                )
            if coding:
                try:
                    failure = self._coding_self_check(blueprint, accepted)
                except IngestionError as exc:
                    if exc.retryable:
                        # The sandbox is down (demand-start, rule 54): leave
                        # the assessment generating with a warning so the
                        # learner can retry once it is back.
                        logger.warning(
                            "coding self-check for assessment %s deferred (%s)",
                            assessment_id,
                            exc.code,
                            extra={"trace_id": correlation_id},
                        )
                        self._mark_job_retryable(job_id, exc)
                        self._repo.update_assessment_status(
                            assessment_id,
                            "generating",
                            [{"code": exc.code, "message": exc.message}],
                        )
                        self._queue.complete(GENERATION_QUEUE, message.msg_id, True)
                        return
                    # A non-retryable sandbox fault is our own bug: fail the
                    # assessment closed with its own bucket rather than looping
                    # the queue.
                    logger.warning(
                        "coding self-check for assessment %s failed closed (%s)",
                        assessment_id,
                        exc.code,
                        extra={"trace_id": correlation_id},
                    )
                    self._fail_assessment(
                        blueprint,
                        warnings=[{"code": exc.code, "message": exc.message}],
                        error_code=exc.code,
                        error_message=exc.message,
                        retryable=False,
                        outcome=outcome_for_error_code(exc.code),
                        latency_ms=response.latency_ms,
                        repair_attempted=repair_attempted,
                        message_id=message.msg_id,
                    )
                    return
                if failure is not None:
                    logger.warning(
                        "coding self-check %s failed: %s",
                        assessment_id,
                        failure["message"],
                        extra={"trace_id": correlation_id},
                    )
                    self._fail_assessment(
                        blueprint,
                        warnings=[failure],
                        error_code="malformed_output",
                        error_message=failure["message"],
                        retryable=False,
                        outcome="malformed_output",
                        latency_ms=response.latency_ms,
                        repair_attempted=repair_attempted,
                        message_id=message.msg_id,
                    )
                    return
            self._accept_question(
                blueprint,
                accepted,
                warnings,
                response,
                repair_attempted,
                question_format=question_format,
            )
            self._queue.complete(GENERATION_QUEUE, message.msg_id, True)
            return

        # Every window returned unsuitable (or a resample ran out of candidates):
        # fail terminal with the last honest reason, exactly as the one-shot path
        # did. The refusal path is preserved (D-04).
        reason = last_refusal_reason or (
            "this material does not support a grounded coding question"
        )
        logger.info(
            "coding generation %s unsuitable: %s",
            assessment_id,
            reason,
            extra={"trace_id": correlation_id},
        )
        self._fail_assessment(
            blueprint,
            warnings=[{"code": "code_not_derivable", "message": reason}],
            error_code="code_not_derivable",
            error_message=reason,
            retryable=False,
            outcome="partial",
            latency_ms=response.latency_ms if response is not None else 0.0,
            repair_attempted=repair_attempted,
            message_id=message.msg_id,
        )

    def _build_context(
        self,
        material_id: str,
        skill_tags: tuple[str, ...],
        scope: AssessmentScope | None,
        *,
        coding: bool,
        exclude: frozenset[str] = frozenset(),
    ) -> list[RetrievedChunk]:
        """Call the injected context builder; only coding opts into code-seeking."""
        if coding:
            return self._context_builder(
                material_id,
                skill_tags,
                scope,
                code_seeking=True,
                exclude_chunk_ids=exclude,
            )
        return self._context_builder(material_id, skill_tags, scope)

    def _widen_thin_context(
        self,
        material_id: str,
        skill_tags: tuple[str, ...],
        scope: AssessmentScope | None,
        chunks: list[RetrievedChunk],
        *,
        coding: bool,
        exclude: frozenset[str] = frozenset(),
    ) -> tuple[list[RetrievedChunk], list[dict]]:
        """D-06: a thin scoped context widens to neighbouring pages and warns.

        A scoped query can legitimately return fewer than CONTEXT_TOP_K chunks
        (a three-page range), and grounding a question on almost nothing is how
        the original front-matter defect hid. The widened range is a superset
        of the requested one, so the result can only grow; when it does not, the
        learner still gets the honest count in the warning. A coding widen keeps
        code-seeking so the widened window is not a plain even spread.
        """
        if scope is None or len(chunks) >= CONTEXT_TOP_K:
            return chunks, []
        found = len(chunks)
        widened = scope
        for _ in range(WIDEN_STEPS):
            widened = widened.widened(WIDEN_MIN_PAD)
            chunks = self._build_context(
                material_id, skill_tags, widened, coding=coding, exclude=exclude
            )
            if len(chunks) >= CONTEXT_TOP_K:
                break
        return chunks, [
            {
                "code": "scope_widened",
                "message": (
                    f"pages {scope.page_start}-{scope.page_end} held only {found} "
                    f"chunk(s); the search widened to pages "
                    f"{widened.page_start}-{widened.page_end}"
                ),
            }
        ]

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
        question_format: str,
    ) -> tuple[dict | None, list[dict]]:
        build, schema_for, validate = _arm(question_format)
        schema = schema_for(context_ids)
        messages = build(
            blueprint,
            chunks,
            title=title,
            repair_feedback=repair_feedback,
            assistant_content=response.content,
        )
        repaired = self._adapter.generate(
            messages, schema, repair=True, correlation_id=blueprint.correlation_id
        )
        if repaired.outcome == "ok" and repaired.structured_output is not None:
            return validate(repaired.structured_output, blueprint, context_ids, chunk_texts)
        return None, [{"code": "malformed_output", "message": "repair validation failed"}]

    def _coding_self_check(self, blueprint: GenerationBlueprint, accepted: dict) -> dict | None:
        """Run the reference solution over every authored test (D-05).

        Returns None when the reference passes all tests, a `self_check_failed`
        warning (passed/total + first failing test name, never content) when it
        does not, and raises `IngestionError` when the sandbox itself is
        unavailable. `output_prediction` has nothing to execute and always
        passes. Contract-max limits are passed in; the client clamps them to
        the configured ceilings.
        """
        if str(accepted.get("subtype") or "") == OUTPUT_PREDICTION_SUBTYPE:
            return None
        if self._sandbox is None:
            raise IngestionError(
                "provider_unavailable",
                "coding self-check requires a sandbox client",
                retryable=True,
            )
        tests = [*accepted["visibleTests"], *accepted["hiddenTests"]]
        passed = 0
        for index, test in enumerate(tests, start=1):
            run = self._sandbox.execute(
                source=str(accepted["referenceSolution"]),
                stdin=str(test.get("stdin") or ""),
                expected_output=str(test.get("expectedOutput") or ""),
                time_limit_ms=TIME_LIMIT_MAX_MS,
                memory_limit_mb=MEMORY_MAX_MB,
                attempt_id=blueprint.assessment_id,
                test_index=index,
                trace_id=blueprint.correlation_id,
            )
            if run.outcome != RUN_PASSED:
                name = str(test.get("name") or f"test {index}")
                return {
                    "code": "self_check_failed",
                    "message": (
                        f"reference solution passed {passed}/{len(tests)} tests; "
                        f"first failure: {name} ({run.outcome})"
                    ),
                }
            passed += 1
        return None

    def _accept_question(
        self,
        blueprint: GenerationBlueprint,
        accepted: dict,
        warnings: list[dict],
        response,
        repair_attempted: bool,
        *,
        question_format: str,
    ) -> None:
        if question_format == CODING_FORMAT:
            question_row = _coding_row(blueprint, accepted)
        elif question_format == WRITTEN_FORMAT:
            question_row = {
                "id": str(uuid.uuid4()),
                "assessment_id": blueprint.assessment_id,
                "user_id": blueprint.owner_id,
                "material_id": blueprint.material_id,
                "format": WRITTEN_FORMAT,
                "subtype": str(accepted["subtype"]),
                "prompt": str(accepted["stem"]),
                "options": [],
                "skill_tags": list(accepted["skillTags"]),
                "authored_difficulty": int(accepted["difficulty"]),
                "citations": list(accepted["citations"]),
                "answer_block": _written_answer_block(accepted),
            }
        else:
            question_row = {
                "id": str(uuid.uuid4()),
                "assessment_id": blueprint.assessment_id,
                "user_id": blueprint.owner_id,
                "material_id": blueprint.material_id,
                "format": OBJECTIVE_FORMAT,
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
            prompt_template_version=blueprint.prompt_template_version,
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
