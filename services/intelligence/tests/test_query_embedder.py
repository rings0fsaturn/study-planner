"""Unit tests for app/query_embedder.py (no live services)."""

from __future__ import annotations

import json

import httpx


def _mock_client(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_factory_returns_sidecar_when_provider_sidecar(monkeypatch):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "sidecar")
    monkeypatch.setenv("EMBEDDER_URL", "http://x:8200")
    from app.ingestion.embeddings_sidecar import SidecarEmbedder
    from app.query_embedder import get_embedder

    assert isinstance(get_embedder(), SidecarEmbedder)


def test_factory_returns_gemini_when_provider_gemini(monkeypatch):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "gemini")
    from app.ingestion.embeddings import GeminiEmbedder
    from app.query_embedder import get_embedder

    assert isinstance(get_embedder(), GeminiEmbedder)


def test_embed_queries_sends_is_query_true(monkeypatch):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "sidecar")
    monkeypatch.setenv("EMBEDDER_URL", "http://x:8200")

    captured: dict = {}

    def handler(req: httpx.Request) -> httpx.Response:
        body = json.loads(req.content or b"{}")
        captured.update(body)
        return httpx.Response(200, json={"embeddings": [[1.0] * 768 for _ in body["texts"]]})

    client = _mock_client(handler)
    from app.query_embedder import embed_queries

    embed_queries(["hello"], client=client)
    assert captured.get("is_query") is True


def test_embed_chunks_sends_is_query_false(monkeypatch):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "sidecar")
    monkeypatch.setenv("EMBEDDER_URL", "http://x:8200")

    captured: dict = {}

    def handler(req: httpx.Request) -> httpx.Response:
        body = json.loads(req.content or b"{}")
        captured.update(body)
        return httpx.Response(200, json={"embeddings": [[1.0] * 768 for _ in body["texts"]]})

    client = _mock_client(handler)
    from app.query_embedder import embed_chunks

    embed_chunks(["hello"], client=client)
    assert captured.get("is_query") is False


def test_factory_unknown_provider_raises(monkeypatch):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "unknown")
    from app.query_embedder import get_embedder

    try:
        get_embedder()
        assert False, "expected SystemExit"
    except SystemExit as exc:
        assert "unknown EMBEDDING_PROVIDER" in str(exc)
