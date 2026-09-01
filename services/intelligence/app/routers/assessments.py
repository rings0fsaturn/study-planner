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
from app.ingestion.models import IngestionError
from app.routers.serialization import async_job_from_row, service_error
from app.security import require_user
from app.userrest import UserScopedClient

router = APIRouter()

DIFFICULTY_MIN = 1
DIFFICULTY_MAX = 5
DEFAULT_SKILL_TAGS = ["core"]


def _validate_recipe(recipe: dict) -> list[str]:
    failures: list[str] = []
    formats = recipe.get("formats")
    if formats != ["objective"]:
        failures.append("formats must be ['objective'] for this slice")
    question_count = recipe.get("questionCount")
    if question_count != 1:
        failures.append("questionCount must be 1 for this slice")
    difficulty = recipe.get("difficulty")
    if not isinstance(difficulty, int) or not DIFFICULTY_MIN <= difficulty <= DIFFICULTY_MAX:
        failures.append(f"difficulty must be an integer from {DIFFICULTY_MIN} to {DIFFICULTY_MAX}")
    skill_tags = recipe.get("skillTags", DEFAULT_SKILL_TAGS)
    if not isinstance(skill_tags, list) or not all(
        isinstance(tag, str) and tag.strip() for tag in skill_tags
    ):
        failures.append("skillTags must be a list of non-empty strings")
    return failures


def _question(row: dict) -> dict:
    return {
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


@router.get("/assessments/{assessmentId}")
def get_assessment(
    assessmentId: str,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
) -> dict:
    try:
        assessment = client.get_assessment(assessmentId)
        questions = client.list_questions(assessmentId)
        return {
            "id": assessment["id"],
            "ownerId": str(assessment.get("user_id") or ""),
            "materialIds": [assessment["material_id"]],
            "status": assessment.get("status") or "generating",
            "questions": [_question(row) for row in questions],
            "warnings": assessment.get("warnings") or [],
            "groundingStale": False,
            "createdAt": assessment.get("created_at") or "",
        }
    except IngestionError as exc:
        return service_error(request, exc)
