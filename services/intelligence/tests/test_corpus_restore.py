"""Unit tests for scripts/corpus_restore.py helpers (no live services)."""

from __future__ import annotations

import httpx

from scripts.corpus_restore import (
    _check_vectors,
    _material_payload,
    run_id,
    snapshot_library,
)


def test_run_id_is_utc_timestamp() -> None:
    value = run_id()
    parts = value.split("-")
    assert len(parts) == 2
    assert len(parts[0]) == 8 and len(parts[1]) == 6


def test_snapshot_library_counts_everything() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/rest/v1/materials":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "m1",
                        "title": "t",
                        "ingestion_state": "ready",
                        "embedding_provider": "qwen-sidecar",
                        "chunk_count": 788,
                    }
                ],
            )
        if path == "/rest/v1/content_chunks":
            return httpx.Response(200, json=[{"id": "c1"}] * 3)
        if path == "/rest/v1/ingestion_jobs":
            return httpx.Response(200, json=[{"id": "j1", "status": "succeeded"}])
        if path == "/rest/v1/generation_telemetry":
            return httpx.Response(200, json=[{"id": "t1"}])
        if path == "/storage/v1/object/list/material-raw" and request.method == "POST":
            body = request.read()
            prefix = "owner/m1" if b"owner/m1" in body else "owner/"
            if prefix == "owner/":
                return httpx.Response(200, json=[{"name": "m1", "id": None}])
            return httpx.Response(200, json=[{"name": "pdf.pdf", "id": "f1"}])
        return httpx.Response(404, json={})

    client = httpx.Client(
        transport=httpx.MockTransport(handler),
        headers={"apikey": "k", "Authorization": "Bearer k"},
    )
    snap = snapshot_library(client, "https://example.supabase.co", "k", "owner")
    assert snap["material_count"] == 1
    assert snap["chunk_count"] == 3
    assert snap["job_count"] == 1
    assert snap["telemetry_count"] == 1
    assert snap["storage_objects"] == [{"name": "owner/m1/pdf.pdf", "material_id": "m1"}]


def test_material_payload_shape() -> None:
    payload = _material_payload("owner", "m1", "T", "book.pdf")
    assert payload["id"] == "m1"
    assert payload["user_id"] == "owner"
    assert payload["kind"] == "file"
    assert payload["source"] == "book.pdf"
    assert payload["ingestion_state"] == "pending"
    assert payload["ingestion_progress"] == 0
    assert payload["client_id"] and payload["content_version"]


def _unit_vector(dims: int = 768) -> list[float]:
    return [1.0 / (dims ** 0.5)] * dims


def test_check_vectors_accepts_healthy_chunks() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[
                {"id": f"c{i}", "embedding": _unit_vector(), "skipped": False}
                for i in range(3)
            ],
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    chunks = _check_vectors(client, "https://example.supabase.co", "m1", 3)
    assert len(chunks) == 3
    assert chunks[0]["embedding"]


def test_check_vectors_rejects_null_vectors() -> None:

    import pytest

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[
                {"id": "c1", "embedding": None, "skipped": False},
                {"id": "c2", "embedding": None, "skipped": False},
            ],
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(SystemExit, match="NULL vectors"):
        _check_vectors(client, "https://example.supabase.co", "m1", 2)


def test_check_vectors_rejects_wrong_dims() -> None:

    import pytest

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[
                {"id": "c1", "embedding": _unit_vector(4), "skipped": False}
                for _ in range(2)
            ],
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(SystemExit, match="dims"):
        _check_vectors(client, "https://example.supabase.co", "m1", 2)


def test_check_vectors_rejects_wrong_chunk_count() -> None:
    import pytest

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=[])

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(SystemExit, match="chunk count"):
        _check_vectors(client, "https://example.supabase.co", "m1", 788)