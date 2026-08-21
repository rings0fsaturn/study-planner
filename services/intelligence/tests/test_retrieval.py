"""Unit tests for POST /v1/retrieval/search (mocked I/O)."""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import httpx
import jwt
from fastapi.testclient import TestClient

from app.main import app

SECRET = "test-supabase-jwt-secret-32-bytes-min"


def _token(sub: str = "user-123") -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {"aud": "authenticated", "exp": now + timedelta(minutes=5), "iat": now, "sub": sub, "role": "authenticated"},
        SECRET,
        algorithm="HS256",
    )


def _auth_headers(sub: str = "user-123") -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(sub=sub)}"}


def test_retrieval_rejects_missing_auth(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    client = TestClient(app)
    resp = client.post("/v1/retrieval/search", json={"materialId": "m1", "query": "hello"})
    assert resp.status_code == 401


def test_retrieval_disabled_returns_404(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("RETRIEVAL_ENABLED", "false")
    client = TestClient(app)
    resp = client.post("/v1/retrieval/search", headers=_auth_headers(), json={"materialId": "m1", "query": "hi"})
    assert resp.status_code == 404


def test_retrieval_returns_hits_for_owner(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("RETRIEVAL_ENABLED", "true")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")
    monkeypatch.setenv("EMBEDDING_PROVIDER", "sidecar")
    monkeypatch.setenv("EMBEDDER_URL", "http://x:8200")

    # Mock query embedding
    import app.routers.retrieval as mod

    monkeypatch.setattr(mod, "embed_queries", lambda texts: [[0.1] * 768 for _ in texts])

    # Mock Supabase REST + RPC via httpx.Client transport
    hits = [
        {"chunk_id": "c2", "chunk_text": "text 2", "similarity": 0.9, "ordinal": 2},
        {"chunk_id": "c1", "chunk_text": "text 1", "similarity": 0.8, "ordinal": 1},
    ]

    def handler(req: httpx.Request) -> httpx.Response:
        path = req.url.path
        if path.endswith("/rest/v1/materials"):
            return httpx.Response(200, json=[{"id": "m1", "user_id": "user-123"}])
        if path.endswith("/rest/v1/rpc/match_content_chunks"):
            body = json.loads(req.content or b"{}")
            assert "query_embedding" in body
            assert body["match_material_id"] == "m1"
            # hybrid true should include query_text
            assert body.get("query_text") == "hello"
            return httpx.Response(200, json=hits)
        return httpx.Response(404, json={})

    transport = httpx.MockTransport(handler)
    # Patch httpx.Client to use our transport for both material lookup and rpc

    orig_client = httpx.Client

    def client_factory(*args, **kwargs):  # noqa: ANN002, ANN003
        kwargs["transport"] = transport
        return orig_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "Client", client_factory)

    client = TestClient(app)
    resp = client.post(
        "/v1/retrieval/search",
        headers=_auth_headers(),
        json={"materialId": "m1", "query": "hello", "topK": 1, "hybrid": True},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["chunks"]) == 1
    assert data["chunks"][0]["chunk_id"] == "c2"


def test_retrieval_hybrid_false_omits_query_text(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("RETRIEVAL_ENABLED", "true")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")
    monkeypatch.setenv("EMBEDDING_PROVIDER", "sidecar")
    monkeypatch.setenv("EMBEDDER_URL", "http://x:8200")

    import app.routers.retrieval as mod

    monkeypatch.setattr(mod, "embed_queries", lambda texts: [[0.1] * 768 for _ in texts])

    captured: dict = {}

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/rest/v1/materials"):
            return httpx.Response(200, json=[{"id": "m1", "user_id": "user-123"}])
        if req.url.path.endswith("/rest/v1/rpc/match_content_chunks"):
            body = json.loads(req.content or b"{}")
            captured.update(body)
            return httpx.Response(200, json=[{"chunk_id": "c1", "chunk_text": "x", "similarity": 0.5}])
        return httpx.Response(404, json={})

    transport = httpx.MockTransport(handler)
    orig_client = httpx.Client

    def client_factory(*args, **kwargs):  # noqa: ANN002, ANN003
        kwargs["transport"] = transport
        return orig_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "Client", client_factory)

    client = TestClient(app)
    resp = client.post(
        "/v1/retrieval/search",
        headers=_auth_headers(),
        json={"materialId": "m1", "query": "hello", "hybrid": False},
    )
    assert resp.status_code == 200
    # Must send query_text as null to avoid PostgREST overload ambiguity (016 4-arg is the only live function)
    assert captured.get("query_text") is None


def test_retrieval_wrong_owner_404(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("RETRIEVAL_ENABLED", "true")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")

    import app.routers.retrieval as mod

    monkeypatch.setattr(mod, "embed_queries", lambda texts: [[0.1] * 768 for _ in texts])

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/rest/v1/materials"):
            return httpx.Response(200, json=[{"id": "m1", "user_id": "other-user"}])
        return httpx.Response(404, json={})

    transport = httpx.MockTransport(handler)
    orig_client = httpx.Client

    def client_factory(*args, **kwargs):  # noqa: ANN002, ANN003
        kwargs["transport"] = transport
        return orig_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "Client", client_factory)

    client = TestClient(app)
    resp = client.post(
        "/v1/retrieval/search",
        headers=_auth_headers(sub="user-123"),
        json={"materialId": "m1", "query": "hello"},
    )
    assert resp.status_code == 404


def test_retrieval_rerank_branch(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("RETRIEVAL_ENABLED", "true")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")
    monkeypatch.setenv("EMBEDDING_PROVIDER", "sidecar")
    monkeypatch.setenv("EMBEDDER_URL", "http://x:8200")

    import app.routers.retrieval as mod

    monkeypatch.setattr(mod, "embed_queries", lambda texts: [[0.1] * 768 for _ in texts])

    hits = [
        {"chunk_id": "c1", "chunk_text": "alpha", "similarity": 0.9},
        {"chunk_id": "c2", "chunk_text": "beta", "similarity": 0.8},
    ]

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/rest/v1/materials"):
            return httpx.Response(200, json=[{"id": "m1", "user_id": "user-123"}])
        if req.url.path.endswith("/rest/v1/rpc/match_content_chunks"):
            return httpx.Response(200, json=hits)
        return httpx.Response(404, json={})

    transport = httpx.MockTransport(handler)
    orig_client = httpx.Client

    def client_factory(*args, **kwargs):  # noqa: ANN002, ANN003
        kwargs["transport"] = transport
        return orig_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "Client", client_factory)

    # Mock reranker
    class FakeReranker:
        def rerank(self, query, passages, top_k):  # noqa: ANN001
            # Reverse order
            return [1, 0]

    monkeypatch.setattr(mod, "RerankerClient", lambda: FakeReranker())

    client = TestClient(app)
    resp = client.post(
        "/v1/retrieval/search",
        headers=_auth_headers(),
        json={"materialId": "m1", "query": "hello", "rerank": True, "topK": 2},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["reranked"] is True
    assert data["indices"] == [1, 0]
    assert data["chunks"][0]["chunk_id"] == "c2"
