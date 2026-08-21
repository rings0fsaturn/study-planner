"""Owner-scoped material ingestion endpoints (Phase 2 contract).

Every read/write flows through Supabase REST with the caller's access token,
so RLS enforces owner scoping. The worker owns the actual pipeline.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.dependencies import get_user_client
from app.ingestion.models import PROGRESS_BY_STAGE, IngestionError
from app.middleware import request_id_from_request
from app.routers.serialization import service_error
from app.userrest import UserScopedClient

router = APIRouter()


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
    # The stored progress is the worker's own write and is the source of
    # truth; the stage map is only the fallback for rows without one.
    stored_progress = material.get("ingestion_progress")
    progress = (
        float(stored_progress)
        if stored_progress is not None
        else PROGRESS_BY_STAGE.get(state, 0.0)
    )
    status: dict = {
        "materialId": material["id"],
        "state": state,
        "progress": progress,
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
        return service_error(request, exc)


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
            "state": state,
            "previewText": preview_text,
            "chunkCount": int(material.get("chunk_count") or 0),
            "ready": state == "ready",
            "updatedAt": material.get("updated_at") or material.get("created_at") or "",
        }
    except IngestionError as exc:
        return service_error(request, exc)
