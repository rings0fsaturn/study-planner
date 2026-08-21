"""Tests for the Supabase-backed ingestion repository adapters."""

from __future__ import annotations

import json

import httpx
import pytest

from app.ingestion.embeddings import EMBEDDING_DIMENSIONS
from app.ingestion.models import ContentChunk, IngestionError
from app.ingestion.repository import (
    SupabaseIngestionRepo,
    SupabaseStorageClient,
    _embedding_to_halfvec,
)


def test_storage_upload_sends_upsert_header() -> None:
    """The deterministic fulltext path must overwrite on redelivery."""
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["headers"] = dict(request.headers)
        return httpx.Response(200, content=b"")

    client = SupabaseStorageClient("https://example.supabase.co", "service-key")
    client._client = httpx.Client(transport=httpx.MockTransport(handler))

    client.upload("user/mat/fulltext.txt", b"text", "text/plain")

    assert captured["method"] == "POST"
    assert captured["url"].endswith("/storage/v1/object/material-raw/user/mat/fulltext.txt")
    assert captured["headers"]["x-upsert"] == "true"
    assert captured["headers"]["content-type"] == "text/plain"


def test_storage_upload_rejection_is_retryable_provider_error() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["request"] = request
        return httpx.Response(409, content=b'{"message":"already exists"}')

    client = SupabaseStorageClient("https://example.supabase.co", "service-key")
    client._client = httpx.Client(transport=httpx.MockTransport(handler))

    try:
        client.upload("user/mat/fulltext.txt", b"text", "text/plain")
    except Exception as exc:
        from app.ingestion.models import IngestionError

        assert isinstance(exc, IngestionError)
        assert exc.code == "provider_unavailable"
        assert exc.retryable is True
    else:
        raise AssertionError("upload should raise on 4xx")


def test_replace_chunks_posts_bare_array_with_owner_id() -> None:
    """PostgREST bulk insert needs a bare JSON array, not a rows wrapper."""
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        if request.content:
            captured["body"] = json.loads(request.content)
        return httpx.Response(204, content=b"")

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    chunk = ContentChunk(
        chunk_id="chunk-1",
        material_id="mat-1",
        text="some text",
        ordinal=3,
        start_seconds=None,
    )
    repo.replace_chunks("mat-1", [chunk], "user-1")

    assert captured["method"] == "POST"
    assert captured["url"].endswith("/rest/v1/content_chunks")
    body = captured["body"]
    assert isinstance(body, list)
    assert body == [
        {
            "id": "chunk-1",
            "user_id": "user-1",
            "material_id": "mat-1",
            "ordinal": 3,
            "text": "some text",
            "start_seconds": None,
        }
    ]


def test_embedding_halfvec_formatting() -> None:
    vector = [0.25] * EMBEDDING_DIMENSIONS
    formatted = _embedding_to_halfvec(vector)
    assert formatted.startswith("[0.25000000,")
    assert formatted.endswith("]")
    assert formatted.count(",") == EMBEDDING_DIMENSIONS - 1


def test_embedding_halfvec_rejects_wrong_dimensions() -> None:
    with pytest.raises(IngestionError) as exc_info:
        _embedding_to_halfvec([0.0, 1.0])
    assert exc_info.value.code == "internal_error"


def test_embedding_halfvec_rejects_non_finite_values() -> None:
    vector = [float("nan")] + [0.0] * (EMBEDDING_DIMENSIONS - 1)
    with pytest.raises(IngestionError) as exc_info:
        _embedding_to_halfvec(vector)
    assert exc_info.value.code == "internal_error"


def test_update_chunk_embedding_posts_halfvec_string() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(204, content=b"")

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    repo.update_chunk_embedding("chunk-1", [0.5] * EMBEDDING_DIMENSIONS)

    assert captured["method"] == "PATCH"
    assert captured["url"].endswith("/rest/v1/content_chunks?id=eq.chunk-1")
    assert captured["body"] == {"embedding": _embedding_to_halfvec([0.5] * EMBEDDING_DIMENSIONS)}


def test_update_chunk_embeddings_posts_one_bulk_rpc_call() -> None:
    captured: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(
            {
                "method": request.method,
                "url": str(request.url),
                "body": json.loads(request.content),
            }
        )
        return httpx.Response(204, content=b"")

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    repo.update_chunk_embeddings(
        "mat-1",
        [
            ("chunk-1", [0.5] * EMBEDDING_DIMENSIONS),
            ("chunk-2", [0.25] * EMBEDDING_DIMENSIONS),
        ],
    )

    assert len(captured) == 1
    assert captured[0]["method"] == "POST"
    assert captured[0]["url"].endswith("/rest/v1/rpc/ingestion_update_chunk_embeddings")
    chunks = captured[0]["body"]["p_chunks"]
    assert [chunk["chunkId"] for chunk in chunks] == ["chunk-1", "chunk-2"]
    assert chunks[0]["embedding"] == _embedding_to_halfvec([0.5] * EMBEDDING_DIMENSIONS)
    assert captured[0]["body"]["p_material_id"] == "mat-1"


def test_update_chunk_embeddings_with_no_rows_makes_no_request() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("no request should be made for an empty batch")

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))
    repo.update_chunk_embeddings("mat-1", [])


def test_flag_chunk_patches_skipped_with_material_guard() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(204, content=b"")

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    repo.flag_chunk("mat-1", "chunk-1")

    assert captured["method"] == "PATCH"
    assert captured["url"].endswith(
        "/rest/v1/content_chunks?id=eq.chunk-1&material_id=eq.mat-1"
    )
    assert captured["body"] == {"skipped": True}


def test_set_job_running_excludes_terminal_statuses() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        return httpx.Response(204, content=b"")

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    repo.set_job_running("job-1")

    assert "status=not.in.(succeeded,failed,cancelled)" in captured["url"]


def test_get_material_maps_row_to_model() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        return httpx.Response(
            200,
            json=[
                {
                    "id": "mat-1",
                    "user_id": "user-1",
                    "title": "T",
                    "kind": "manual",
                    "source": "s",
                    "ingestion_state": "embedding",
                    "ingestion_progress": 0.6,
                }
            ],
        )

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    material = repo.get_material("mat-1")

    assert captured["url"].endswith("/rest/v1/materials?id=eq.mat-1&select=*")
    assert material.id == "mat-1"
    assert material.owner_id == "user-1"
    assert material.ingestion_state == "embedding"
    assert material.ingestion_progress == 0.6


def test_get_material_missing_is_not_found() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(IngestionError) as exc_info:
        repo.get_material("mat-missing")
    assert exc_info.value.code == "not_found"


def test_set_material_state_patch_shape() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(204, content=b"")

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    repo.set_material_state(
        "mat-1",
        "chunking",
        0.5,
        chunk_count=4,
        extracted_text_path="user/mat/fulltext.txt",
    )

    assert captured["body"] == {
        "ingestion_state": "chunking",
        "ingestion_progress": 0.5,
        "ingestion_error": None,
        "chunk_count": 4,
        "extracted_text_path": "user/mat/fulltext.txt",
    }


def test_set_material_state_failure_clears_error() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(204, content=b"")

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    repo.set_material_state(
        "mat-1", "failed", 0.0, error_code="provider_timeout", error_message="slow"
    )

    assert captured["body"] == {
        "ingestion_state": "failed",
        "ingestion_progress": 0.0,
        "ingestion_error": "slow",
    }


def test_replace_chunks_deletes_before_inserting() -> None:
    events: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        events.append(f"{request.method} {request.url.path}")
        return httpx.Response(204, content=b"")

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    chunk = ContentChunk(
        chunk_id="chunk-1",
        material_id="mat-1",
        text="some text",
        ordinal=0,
        start_seconds=None,
    )
    repo.replace_chunks("mat-1", [chunk], "user-1")

    assert events == [
        "DELETE /rest/v1/content_chunks",
        "POST /rest/v1/content_chunks",
    ]


def test_replace_chunks_with_no_chunks_only_deletes() -> None:
    methods: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        return httpx.Response(204, content=b"")

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    repo.replace_chunks("mat-1", [], "user-1")

    assert methods == ["DELETE"]


def test_publish_ready_calls_atomic_rpc() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["method"] = request.method
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(204, content=b"")

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    repo.publish_ready("mat-1", "job-1", chunk_count=7, grounding_version="v1", result_id="mat-1")

    assert captured["method"] == "POST"
    assert captured["url"].endswith("/rest/v1/rpc/ingestion_publish_ready")
    assert captured["body"] == {
        "p_material_id": "mat-1",
        "p_job_id": "job-1",
        "p_chunk_count": 7,
        "p_grounding_version": "v1",
    }


def test_storage_download_404_is_validation_failed() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, content=b"{}")

    client = SupabaseStorageClient("https://example.supabase.co", "service-key")
    client._client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(IngestionError) as exc_info:
        client.download("user/mat/paper.pdf")
    assert exc_info.value.code == "validation_failed"
    assert not exc_info.value.retryable


def test_storage_download_server_error_is_retryable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, content=b"{}")

    client = SupabaseStorageClient("https://example.supabase.co", "service-key")
    client._client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(IngestionError) as exc_info:
        client.download("user/mat/paper.pdf")
    assert exc_info.value.code == "provider_unavailable"
    assert exc_info.value.retryable


def test_repo_get_timeout_is_provider_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("read timed out", request=request)

    repo = SupabaseIngestionRepo("https://example.supabase.co", "service-key")
    repo._client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(IngestionError) as exc_info:
        repo.get_material("mat-1")
    assert exc_info.value.code == "provider_timeout"
    assert exc_info.value.retryable


def test_storage_download_timeout_is_provider_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("download timed out", request=request)

    client = SupabaseStorageClient("https://example.supabase.co", "service-key")
    client._client = httpx.Client(transport=httpx.MockTransport(handler))

    with pytest.raises(IngestionError) as exc_info:
        client.download("user/mat/paper.pdf")
    assert exc_info.value.code == "provider_timeout"
    assert exc_info.value.retryable
