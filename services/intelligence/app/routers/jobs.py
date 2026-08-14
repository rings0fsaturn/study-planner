"""Owner-scoped async job status endpoint (Phase 2 contract)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.dependencies import get_user_client
from app.ingestion.models import IngestionError
from app.routers.materials import _async_job, _service_error
from app.userrest import UserScopedClient

router = APIRouter()


@router.get("/jobs/{jobId}")
def get_job(
    jobId: str,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
) -> dict:
    try:
        return _async_job(client.get_job(jobId))
    except IngestionError as exc:
        return _service_error(request, exc)
