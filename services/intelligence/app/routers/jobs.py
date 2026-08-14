"""Owner-scoped async job status endpoint (Phase 2 contract)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.dependencies import get_user_client
from app.ingestion.models import IngestionError
from app.routers.serialization import async_job_from_row, service_error
from app.userrest import UserScopedClient

router = APIRouter()


@router.get("/jobs/{jobId}")
def get_job(
    jobId: str,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
) -> dict:
    try:
        return async_job_from_row(client.get_job(jobId))
    except IngestionError as exc:
        return service_error(request, exc)
