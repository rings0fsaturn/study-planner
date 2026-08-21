from __future__ import annotations

import pytest

from app.ingestion.models import (
    ContentChunk,
    ExtractedContent,
    IngestionError,
    IngestionJob,
    QueueMessage,
)


def test_ingestion_error_accepts_known_codes() -> None:
    for code in (
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
    ):
        error = IngestionError(code, "message")
        assert error.code == code
        assert error.message == "message"
        assert error.retryable is False


def test_ingestion_error_rejects_unknown_code() -> None:
    with pytest.raises(ValueError):
        IngestionError("not_a_code", "message")


def test_ingestion_error_carries_retryable_flag() -> None:
    error = IngestionError("provider_unavailable", "boom", retryable=True)
    assert error.retryable is True


def test_extracted_content_preview_under_limit_returns_full_text() -> None:
    assert ExtractedContent(text="short").preview(limit=50) == "short"


def test_extracted_content_preview_exact_limit_no_ellipsis() -> None:
    text = "x" * 4000
    assert ExtractedContent(text=text).preview(limit=4000) == text


def test_extracted_content_preview_over_limit_truncates_with_ellipsis() -> None:
    preview = ExtractedContent(text="a" * 4001).preview(limit=4000)
    assert len(preview) == 4001
    assert preview.endswith("…")


def test_extracted_content_preview_over_limit_strips_trailing_whitespace() -> None:
    preview = ExtractedContent(text="word " * 500).preview(limit=50)
    assert preview.endswith("…")
    assert not preview[:-1].endswith(" ")


def test_content_chunk_to_schema_dict_includes_optional_fields() -> None:
    chunk = ContentChunk(
        material_id="m1",
        text="body",
        ordinal=0,
        start_seconds=1.5,
        chunk_id="c1",
    )
    assert chunk.to_schema_dict() == {
        "chunkId": "c1",
        "materialId": "m1",
        "text": "body",
        "ordinal": 0,
        "startSeconds": 1.5,
    }


def test_content_chunk_to_schema_dict_omits_optional_fields() -> None:
    chunk = ContentChunk(material_id="m1", text="body", ordinal=2)
    assert chunk.to_schema_dict() == {
        "chunkId": "",
        "materialId": "m1",
        "text": "body",
        "ordinal": 2,
    }


def test_ingestion_job_to_async_job_minimal() -> None:
    job = IngestionJob(
        id="j1",
        owner_id="u1",
        material_id="m1",
        status="queued",
        attempt=1,
        correlation_id="c1",
        created_at="2026-08-14T00:00:00Z",
    )
    assert job.to_async_job() == {
        "jobId": "j1",
        "kind": "ingestion",
        "status": "queued",
        "ownerId": "u1",
        "correlationId": "c1",
        "attempt": 1,
        "createdAt": "2026-08-14T00:00:00Z",
    }


def test_ingestion_job_to_async_job_with_error_and_result() -> None:
    job = IngestionJob(
        id="j1",
        owner_id="u1",
        material_id="m1",
        status="failed",
        attempt=2,
        correlation_id="c1",
        result_id="m1",
        error_code="provider_timeout",
        error_message="timed out",
        retryable=True,
        created_at="2026-08-14T00:00:00Z",
        completed_at="2026-08-14T00:00:01Z",
    )
    payload = job.to_async_job()
    assert payload["resultId"] == "m1"
    assert payload["completedAt"] == "2026-08-14T00:00:01Z"
    assert payload["error"] == {
        "code": "provider_timeout",
        "message": "timed out",
        "requestId": "",
        "retryable": True,
    }


def test_queue_message_defaults() -> None:
    message = QueueMessage(msg_id=7)
    assert message.payload == {}
    assert message.read_ct == 0
