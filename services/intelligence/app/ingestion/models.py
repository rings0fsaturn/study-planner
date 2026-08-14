"""Material ingestion domain models shared by the API, worker, and tests."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

MaterialKind = Literal["manual", "url", "youtube", "file"]
IngestionState = Literal["pending", "extracting", "chunking", "embedding", "ready", "failed"]
JobStatus = Literal["queued", "running", "succeeded", "partial", "failed", "cancelled"]

ERROR_CODES = (
    "invalid_request",
    "unauthorized",
    "forbidden",
    "not_found",
    "conflict",
    "safety_block",
    "quota_exhausted",
    "provider_unavailable",
    "provider_timeout",
    "malformed_output",
    "validation_failed",
    "internal_error",
)


class IngestionError(Exception):
    """Normalized ingestion failure following the contract ServiceError codes."""

    def __init__(self, code: str, message: str, retryable: bool = False) -> None:
        if code not in ERROR_CODES:
            raise ValueError(f"unknown ingestion error code: {code}")
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable


@dataclass(frozen=True)
class Material:
    """Server-owned material row as the worker and API see it."""

    id: str
    owner_id: str
    title: str
    kind: MaterialKind
    source: str
    ingestion_state: IngestionState
    ingestion_progress: float = 0.0
    ingestion_error: str | None = None
    upload_complete_at: str | None = None
    content_version: str = ""
    chunk_count: int = 0
    grounding_version: str | None = None
    extracted_text_path: str | None = None
    created_at: str = ""
    updated_at: str = ""


@dataclass(frozen=True)
class TextSegment:
    """A piece of extracted text, optionally anchored to a source timestamp."""

    text: str
    start_seconds: float | None = None


@dataclass(frozen=True)
class ExtractedContent:
    """Deterministically cleaned extraction result, displayable while processing."""

    text: str
    segments: tuple[TextSegment, ...] = ()

    def preview(self, limit: int = 4000) -> str:
        if len(self.text) <= limit:
            return self.text
        return self.text[:limit].rstrip() + "…"


@dataclass(frozen=True)
class ContentChunk:
    """One persisted content chunk (schema: content-chunk.schema.json)."""

    material_id: str
    text: str
    ordinal: int
    start_seconds: float | None = None
    chunk_id: str | None = None

    def to_schema_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "chunkId": self.chunk_id or "",
            "materialId": self.material_id,
            "text": self.text,
            "ordinal": self.ordinal,
        }
        if self.start_seconds is not None:
            payload["startSeconds"] = self.start_seconds
        return payload


@dataclass
class IngestionJob:
    """Owner-scoped ingestion job record (schema: async-job.schema.json)."""

    id: str
    owner_id: str
    material_id: str
    status: JobStatus
    attempt: int
    correlation_id: str
    result_id: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    retryable: bool = False
    created_at: str = ""
    completed_at: str | None = None

    def to_async_job(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "jobId": self.id,
            "kind": "ingestion",
            "status": self.status,
            "ownerId": self.owner_id,
            "correlationId": self.correlation_id,
            "attempt": self.attempt,
            "createdAt": self.created_at,
        }
        if self.result_id:
            payload["resultId"] = self.result_id
        if self.error_code:
            payload["error"] = {
                "code": self.error_code,
                "message": self.error_message or "",
                "requestId": "",
                "retryable": self.retryable,
            }
        if self.completed_at:
            payload["completedAt"] = self.completed_at
        return payload


@dataclass(frozen=True)
class QueueMessage:
    """A pgmq message with its visibility identity."""

    msg_id: int
    payload: dict = field(default_factory=dict)
    read_ct: int = 0
