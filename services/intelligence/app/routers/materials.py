"""Owner-scoped material ingestion endpoints (Phase 2 contract).

Every read/write flows through Supabase REST with the caller's access token,
so RLS enforces owner scoping. The worker owns the actual pipeline.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.dependencies import get_user_client
from app.ingestion.models import IngestionError
from app.middleware import request_id_from_request
from app.userrest import UserScopedClient

router = APIRouter()

_STATES = {
    "pending": 0.0,
    "extracting": 0.25,
    "chunking": 0.5,
    "embedding": 0.7,
    "ready": 1.0,
    "failed": 0.0,
}

_INTERNAL_STATE_NAMES = {
    "pending": "pending",
    "extracting": "extracting",
    "chunking": "chunking",
    "embedding": "embedding",
    "ready": "ready",
    "failed": "failed",
}


def _service_error(request: Request, exc: IngestionError) -> JSONResponse:
    return JSONResponse(
        status_code={
            "not_found": 404,
            "conflict": 409,
            "invalid_request": 400,
            "validation_failed": 400,
        }.get(exc.code, 500),
        content={
            "code": exc.code,
            "message": exc.message,
            "requestId": request_id_from_request(request),
            "retryable": exc.retryable,
        },
    )


def _ingestion_status(request: Request, client: UserScopedClient, material: dict) -> dict:
    state = material.get("ingestion_state") or "pending"
    latest = client.latest_job(material["id"])
    error = None
    if latest and latest.get("error_code"):
        error = {
            "code": latest["error_code"],
            "message": latest.get("error_message") or "",
            "requestId": request_id_from_request(request),
            "retryable": bool(latest.get("retryable")),
        }
    status: dict = {
        "materialId": material["id"],
        "state": state,
        "progress": _STATES.get(state, 0.0),
        "updatedAt": material.get("updated_at") or material.get("created_at") or "",
    }
    if latest:
        status["attempt"] = int(latest.get("attempt") or 1)
    if error:
        status["error"] = error
    return status


@router.get("/materials/{materialId}/ingestion")
def get_ingestion_status(
    materialId: str,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
) -> dict:
    try:
        material = client.get_material(materialId)
        return _ingestion_status(request, client, material)
    except IngestionError as exc:
        return _service_error(request, exc)


@router.get("/materials/{materialId}/content")
def get_material_content_preview(
    materialId: str,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
) -> dict:
    try:
        material = client.get_material(materialId)
        state = material.get("ingestion_state") or "pending"
        preview_text = ""
        path = material.get("extracted_text_path")
        if path and state not in {"pending", "failed"}:
            raw = client.download_fulltext(materialId, path)
            text = raw.decode("utf-8", errors="replace")
            preview_text = text[:4000] + ("…" if len(text) > 4000 else "")
        return {
            "materialId": materialId,
            "state": _INTERNAL_STATE_NAMES.get(state, state),
            "previewText": preview_text,
            "chunkCount": int(material.get("chunk_count") or 0),
            "ready": state == "ready",
            "updatedAt": material.get("updated_at") or material.get("created_at") or "",
        }
    except IngestionError as exc:
        return _service_error(request, exc)


def _async_job(row: dict) -> dict:
    job: dict = {
        "jobId": row["id"],
        "kind": row.get("kind") or "ingestion",
        "status": row.get("status") or "queued",
        "ownerId": row.get("user_id") or "",
        "correlationId": row.get("correlation_id") or "",
        "createdAt": row.get("created_at") or "",
    }
    if row.get("attempt") is not None:
        job["attempt"] = int(row["attempt"])
    if row.get("result_id"):
        job["resultId"] = row["result_id"]
    if row.get("completed_at"):
        job["completedAt"] = row["completed_at"]
    if row.get("error_code"):
        job["error"] = {
            "code": row["error_code"],
            "message": row.get("error_message") or "",
            "requestId": "",
            "retryable": bool(row.get("retryable")),
        }
    return job
