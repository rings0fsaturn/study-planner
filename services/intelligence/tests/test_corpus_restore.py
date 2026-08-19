"""Unit tests for scripts/corpus_restore.py helpers (no live services)."""

from __future__ import annotations

import httpx

from scripts.corpus_restore import run_id, snapshot_library


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