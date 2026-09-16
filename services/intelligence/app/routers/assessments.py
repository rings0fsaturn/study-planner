"""Owner-scoped assessment endpoints (issue #38, Phase 2 contract).

`POST /v1/assessments/generate` creates the assessment row through the
caller's token (RLS INSERT), then enqueues the generation job through the
DB-atomic `enqueue_assessment_generation` RPC (owner-checked, one
transaction). `GET /v1/assessments/{assessmentId}` assembles the redacted
Assessment from the owner-scoped row and the column-granted question
columns; `answer_block` is service-role-only and never serialized.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse

from app.dependencies import get_user_client
from app.grading.coding_grader import (
    CODING_LANGUAGE,
    CODING_SOURCE_MAX_LENGTH,
    CODING_STDIN_MAX_LENGTH,
    MEMORY_MAX_MB,
    MEMORY_MIN_MB,
    TIME_LIMIT_MAX_MS,
    TIME_LIMIT_MIN_MS,
)
from app.ingestion.models import IngestionError
from app.routers.serialization import async_job_from_row, service_error
from app.security import require_user
from app.userrest import UserScopedClient

router = APIRouter()

DIFFICULTY_MIN = 1
DIFFICULTY_MAX = 5
# One question family per assessment in this slice (#41, D-01); mixed-family
# generation is out of scope. #42 adds the coding family; the grading arm
# that drains coding attempts landed in P2.
SUPPORTED_FORMATS = (["objective"], ["written"], ["coding"])
# Contract bound for WrittenAnswer.text (openapi, Phase 2 #41).
WRITTEN_TEXT_MAX_LENGTH = 20000


def _coding_answer_failures(answer: dict) -> list[str]:
    """Shape validation for a coding submit, mirroring the openapi caps.

    The worker re-validates before grading; this gate keeps malformed
    submissions out of the queue with an honest 400 instead of a silent
    queue death.
    """
    failures: list[str] = []
    if answer.get("language") != CODING_LANGUAGE:
        failures.append(f"language must be '{CODING_LANGUAGE}' for this slice")
    source = answer.get("source")
    if not isinstance(source, str) or not source.strip():
        failures.append("source must be a non-empty string")
    elif len(source) > CODING_SOURCE_MAX_LENGTH:
        failures.append(f"source exceeds {CODING_SOURCE_MAX_LENGTH} characters")
    config = answer.get("config")
    if not isinstance(config, dict):
        failures.append("config must be an object")
    else:
        stdin = config.get("stdin")
        if not isinstance(stdin, str) or len(stdin) > CODING_STDIN_MAX_LENGTH:
            failures.append(f"config.stdin exceeds {CODING_STDIN_MAX_LENGTH} characters")
        time_limit_ms = config.get("timeLimitMs")
        if (
            isinstance(time_limit_ms, bool)
            or not isinstance(time_limit_ms, int)
            or not TIME_LIMIT_MIN_MS <= time_limit_ms <= TIME_LIMIT_MAX_MS
        ):
            failures.append(
                f"config.timeLimitMs must be an integer from "
                f"{TIME_LIMIT_MIN_MS} to {TIME_LIMIT_MAX_MS}"
            )
        memory_limit_mb = config.get("memoryLimitMb")
        if (
            isinstance(memory_limit_mb, bool)
            or not isinstance(memory_limit_mb, int)
            or not MEMORY_MIN_MB <= memory_limit_mb <= MEMORY_MAX_MB
        ):
            failures.append(
                f"config.memoryLimitMb must be an integer from "
                f"{MEMORY_MIN_MB} to {MEMORY_MAX_MB}"
            )
    return failures


def _validate_recipe(recipe: dict) -> list[str]:
    failures: list[str] = []
    formats = recipe.get("formats")
    if formats not in SUPPORTED_FORMATS:
        failures.append(
            "formats must be ['objective'], ['written'], or ['coding'] for this slice"
        )
    question_count = recipe.get("questionCount")
    if question_count != 1:
        failures.append("questionCount must be 1 for this slice")
    difficulty = recipe.get("difficulty")
    if not isinstance(difficulty, int) or not DIFFICULTY_MIN <= difficulty <= DIFFICULTY_MAX:
        failures.append(f"difficulty must be an integer from {DIFFICULTY_MIN} to {DIFFICULTY_MAX}")
    # skillTags is optional in the contract (openapi AssessmentRecipe). A
    # missing key stays missing: every tag rides into the retrieval steer and
    # the prompt, so a placeholder ("core") only drags retrieval off topic.
    skill_tags = recipe.get("skillTags")
    if skill_tags is not None and (
        not isinstance(skill_tags, list)
        or not all(isinstance(tag, str) and tag.strip() for tag in skill_tags)
    ):
        failures.append("skillTags must be a list of non-empty strings")
    failures.extend(_validate_scope(recipe.get("scope")))
    return failures


def _validate_scope(scope: object) -> list[str]:
    """Shape check for `recipe.scope` (D-05); the page range is checked later."""
    if scope is None:
        return []
    if not isinstance(scope, dict):
        failures = ["scope must be an object with pageStart and pageEnd"]
    else:
        failures = []
        start, end = scope.get("pageStart"), scope.get("pageEnd")
        if not _is_page(start) or not _is_page(end):
            failures.append("scope.pageStart and scope.pageEnd must be integers of at least 1")
        elif start > end:
            failures.append("scope.pageStart must not be greater than scope.pageEnd")
        label = scope.get("sectionLabel")
        if label is not None and (not isinstance(label, str) or not label.strip()):
            failures.append("scope.sectionLabel must be a non-empty string when present")
        unknown = sorted(set(scope) - {"pageStart", "pageEnd", "sectionLabel"})
        if unknown:
            failures.append(f"scope has unsupported keys: {', '.join(unknown)}")
    return failures


def _is_page(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 1


def _scope_range_failure(recipe: dict, material: dict) -> str:
    """The scope must fit the material's own page count (D-05).

    `materials.page_count` is written by the ingestion worker from the parsed
    PDF, so a material without page numbering cannot be scoped by page at all.
    """
    scope = recipe.get("scope")
    if not isinstance(scope, dict):
        return ""
    page_count = _material_page_count(material)
    if page_count == 0:
        return "this material has no page numbering to scope by"
    if int(scope["pageEnd"]) > page_count:
        return f"scope.pageEnd must not exceed the material's {page_count} pages"
    return ""


def _material_page_count(material: dict) -> int:
    """The stored page count, or 0 when the material has no page numbering."""
    value = material.get("page_count")
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        return 0
    return value


def _question(row: dict) -> dict:
    question = {
        "id": row["id"],
        "assessmentId": row["assessment_id"],
        "materialId": row["material_id"],
        "format": row.get("format") or "objective",
        "prompt": row.get("prompt") or "",
        "options": row.get("options") or [],
        "skillTags": row.get("skill_tags") or [],
        "authoredDifficulty": int(row.get("authored_difficulty") or 1),
        "citations": row.get("citations") or [],
    }
    # Optional by contract: written questions carry the authored subtype, and
    # objective rows omit the key entirely rather than sending a null.
    subtype = row.get("subtype")
    if subtype:
        question["subtype"] = subtype
    # #42: coding questions carry the visible coding payload; pre-coding rows
    # omit all three keys rather than sending nulls.
    if (row.get("format") or "") == "coding":
        for key, column in (
            ("language", "language"),
            ("starterCode", "starter_code"),
            ("visibleTests", "visible_tests"),
        ):
            value = row.get(column)
            if value is not None:
                question[key] = value
    return question


@router.post("/assessments/generate")
def generate_assessment(
    body: dict,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
    user_id: str = Depends(require_user),
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16),  # noqa: ARG001
) -> JSONResponse:
    material_ids = body.get("materialIds") or []
    if len(material_ids) != 1:
        return service_error(
            request, IngestionError("invalid_request", "exactly one materialId is required")
        )
    material_id = str(material_ids[0])
    recipe = body.get("recipe") or {}
    failures = _validate_recipe(recipe)
    if failures:
        return service_error(request, IngestionError("invalid_request", "; ".join(failures)))

    try:
        material = client.get_material(material_id)
        if (material.get("ingestion_state") or "pending") != "ready":
            return service_error(
                request, IngestionError("validation_failed", "material is not ready")
            )
        scope_failure = _scope_range_failure(recipe, material)
        if scope_failure:
            return service_error(request, IngestionError("validation_failed", scope_failure))
    except IngestionError as exc:
        return service_error(request, exc)

    assessment_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    correlation_id = str(body.get("correlationId") or uuid.uuid4())
    try:
        client.insert_assessment(
            {
                "id": assessment_id,
                "user_id": user_id,
                "client_id": str(body.get("clientId") or ""),
                "material_id": material_id,
                "recipe": recipe,
                "status": "generating",
                "warnings": [],
                "correlation_id": correlation_id,
            }
        )
        job_row = client.enqueue_generation(assessment_id, job_id, material_id, correlation_id)
    except IngestionError as exc:
        return service_error(request, exc)
    return JSONResponse(status_code=202, content=async_job_from_row(job_row))


@router.post("/assessments/{assessmentId}/regenerate")
def regenerate_assessment(
    assessmentId: str,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
    user_id: str = Depends(require_user),  # noqa: ARG001
) -> JSONResponse:
    """Re-enqueue generation for an assessment stuck `generating`.

    A practice-run pointer holds assessment ids immutably, so retrying a stuck
    problem must re-queue the SAME assessment rather than mint a new one (the
    `AssessmentDetail` navigate-away path cannot join a run). Reuses the
    owner-checked `enqueue_assessment_generation` RPC; `failed` assessments are
    terminal by contract (the worker's re-entry guard drops messages for
    non-`generating` rows), so only `generating` is retryable here.
    """
    try:
        assessment = client.get_assessment(assessmentId)
        if (assessment.get("status") or "") != "generating":
            return service_error(
                request, IngestionError("conflict", "only a generating assessment can be retried")
            )
        material_id = str(assessment.get("material_id") or "")
        material = client.get_material(material_id)
        if (material.get("ingestion_state") or "pending") != "ready":
            return service_error(
                request, IngestionError("validation_failed", "material is not ready")
            )
    except IngestionError as exc:
        return service_error(request, exc)

    job_id = str(uuid.uuid4())
    correlation_id = str(uuid.uuid4())
    try:
        job_row = client.enqueue_generation(assessmentId, job_id, material_id, correlation_id)
    except IngestionError as exc:
        return service_error(request, exc)
    return JSONResponse(status_code=202, content=async_job_from_row(job_row))


@router.get("/assessments/{assessmentId}")
def get_assessment(
    assessmentId: str,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
) -> dict:
    try:
        assessment = client.get_assessment(assessmentId)
        questions = client.list_questions(assessmentId)
        payload = {
            "id": assessment["id"],
            "ownerId": str(assessment.get("user_id") or ""),
            "materialIds": [assessment["material_id"]],
            "status": assessment.get("status") or "generating",
            "questions": [_question(row) for row in questions],
            "warnings": assessment.get("warnings") or [],
            "groundingStale": False,
            "createdAt": assessment.get("created_at") or "",
        }
        # The stored recipe is echoed so the client can re-request the same
        # shape after a failed generation. The retry path used to infer the
        # family from questions[0] — which does not exist when generation
        # failed, so a written retry silently became objective (#41).
        recipe = assessment.get("recipe")
        if isinstance(recipe, dict) and recipe:
            payload["recipe"] = recipe
        return payload
    except IngestionError as exc:
        return service_error(request, exc)


@router.post("/assessments/{assessmentId}/questions/{questionId}/attempts")
def submit_assessment_attempt(
    assessmentId: str,
    questionId: str,
    body: dict,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
    user_id: str = Depends(require_user),  # noqa: ARG001
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16),  # noqa: ARG001
) -> JSONResponse:
    """Record an attempt and enqueue grading atomically (#39, PLAN D-02).

    The answer is learner input and is stored server-side only; the durable
    QuestionAttempted event stays answer-free by contract. 201 = new attempt,
    200 = idempotent replay of the same clientAttemptId.
    """
    client_attempt_id = str(body.get("clientAttemptId") or "")
    if not client_attempt_id or body.get("questionId") != questionId:
        return service_error(
            request,
            IngestionError(
                "invalid_request", "clientAttemptId and questionId must match the route"
            ),
        )
    if not isinstance(body.get("answer"), dict):
        return service_error(
            request, IngestionError("invalid_request", "answer must be an object")
        )
    # Coding answers (#42): `{language, source, config}` is the only accepted
    # shape, and the contract caps are enforced here so a malformed submission
    # never reaches the queue. Output-prediction answers (`{value}`) carry no
    # `source` key and fall through to the generic gate, then grade
    # deterministically server-side.
    answer = body["answer"]
    if "source" in answer:
        failures = _coding_answer_failures(answer)
        if failures:
            return service_error(
                request, IngestionError("invalid_request", "; ".join(failures))
            )
    # Written answers (#41, D-02): `{ text }` is the only accepted shape, and an
    # empty or oversized submission never reaches the queue. Objective answers
    # carry no `text` key, so this gate cannot touch them.
    text = answer.get("text")
    if text is not None:
        if not isinstance(text, str) or not text.strip():
            return service_error(
                request,
                IngestionError("invalid_request", "written answer text must be a non-empty string"),
            )
        if len(text) > WRITTEN_TEXT_MAX_LENGTH:
            return service_error(
                request,
                IngestionError(
                    "invalid_request",
                    f"written answer text exceeds {WRITTEN_TEXT_MAX_LENGTH} characters",
                ),
            )

    attempt_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    try:
        result = client.submit_attempt(assessmentId, questionId, body, attempt_id, job_id)
    except IngestionError as exc:
        return service_error(request, exc)
    if result.get("replayed"):
        # Same clientAttemptId seen before: return the first attempt's ids.
        return JSONResponse(
            status_code=200,
            content={
                "attemptId": str(result.get("attemptId") or ""),
                "questionId": questionId,
                "status": "queued",
                "jobId": "",
            },
        )
    return JSONResponse(status_code=201, content=result)


def _attempt_record(row: dict) -> dict:
    """Serialize one attempt row to the public AttemptRecord contract.

    The learner's own answer is echoed back on this owner-scoped read route
    (#40, PLAN D-01); the grade block is the public QuestionGraded
    (score/correct/perSkill) with no key material. Key material
    (answer_block/rubrics/reference solutions) stays service_role-only.
    """
    grade = row.get("grade")
    record: dict = {
        "attemptId": row["id"],
        "clientAttemptId": row.get("client_attempt_id") or "",
        "questionId": row.get("question_id") or "",
        "assessmentId": row.get("assessment_id") or "",
        "submittedAt": row.get("submitted_at") or "",
        "status": row.get("status") or "queued",
    }
    if row.get("elapsed_seconds") is not None:
        record["elapsedSeconds"] = int(row["elapsed_seconds"])
    if row.get("answer") is not None:
        record["answer"] = row["answer"]
    record["grade"] = grade
    return record


@router.get("/assessments/{assessmentId}/attempts")
def list_assessment_attempts(
    assessmentId: str,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
) -> JSONResponse:
    try:
        # 404 when the assessment itself is not in owner scope.
        client.get_assessment(assessmentId)
        rows = client.list_attempts(assessmentId)
    except IngestionError as exc:
        return service_error(request, exc)
    return JSONResponse(
        status_code=200, content=[_attempt_record(row) for row in rows]
    )
