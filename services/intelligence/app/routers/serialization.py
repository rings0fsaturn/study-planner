"""Shared router serialization: normalized service errors and async-job payloads."""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

from app.ingestion.models import IngestionError, IngestionJob
from app.middleware import request_id_from_request

_STATUS_BY_CODE = {
    "not_found": 404,
    "conflict": 409,
    "invalid_request": 400,
    "validation_failed": 400,
}


def service_error(request: Request, exc: IngestionError) -> JSONResponse:
    return JSONResponse(
        status_code=_STATUS_BY_CODE.get(exc.code, 500),
        content={
            "code": exc.code,
            "message": exc.message,
            "requestId": request_id_from_request(request),
            "retryable": exc.retryable,
        },
    )


def async_job_from_row(row: dict) -> dict:
    """Serialize one REST job row through the shared IngestionJob contract."""
    job = IngestionJob(
        id=row["id"],
        owner_id=row.get("user_id") or "",
        material_id=row.get("material_id") or "",
        status=row.get("status") or "queued",
        attempt=int(row.get("attempt") or 1),
        correlation_id=row.get("correlation_id") or "",
        kind=row.get("kind") or "ingestion",
        result_id=row.get("result_id"),
        error_code=row.get("error_code"),
        error_message=row.get("error_message"),
        retryable=bool(row.get("retryable")),
        created_at=row.get("created_at") or "",
        completed_at=row.get("completed_at"),
    )
    payload = job.to_async_job()
    if payload.get("error") and row.get("retry_after_seconds"):
        payload["error"]["retryAfterSeconds"] = int(row["retry_after_seconds"])
    return payload
