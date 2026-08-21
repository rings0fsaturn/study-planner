"""Probe provider-branch smoke (no live call)."""

from __future__ import annotations

import json

import httpx


def test_probe_sidecar_sends_is_query_true(monkeypatch):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "sidecar")
    monkeypatch.setenv("EMBEDDER_URL", "http://x:8200")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")

    import services.intelligence.scripts.retrieval_probe as probe  # noqa: F401

    captured: dict = {}

    def handler(req: httpx.Request) -> httpx.Response:
        body = json.loads(req.content or b"{}")
        captured.update(body)
        return httpx.Response(200, json={"embeddings": [[1.0] * 768]})

    # Patch httpx.post used by embed_query_sidecar
    import services.intelligence.scripts.retrieval_probe as mod

    orig_post = httpx.post

    def fake_post(url, json=None, timeout=None, headers=None):  # noqa: ANN001
        # Capture the sidecar payload
        if isinstance(json, dict) and "texts" in json:
            captured.update(json)
            return httpx.Response(200, json={"embeddings": [[1.0] * 768]})
        return orig_post(url, json=json, timeout=timeout, headers=headers)

    monkeypatch.setattr(httpx, "post", fake_post)

    vec = mod.embed_query_sidecar("hello")
    assert vec == [1.0] * 768
    assert captured.get("is_query") is True


def test_probe_defaults_to_sidecar_provider(monkeypatch, tmp_path):
    monkeypatch.setenv("EMBEDDING_PROVIDER", "sidecar")
    monkeypatch.setenv("EMBEDDER_URL", "http://x:8200")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")
    # Provide a minimal question file so probe() doesn't require live DB for the embed branch gate
    # We only assert the provider resolution doesn't require GEMINI_API_KEY
    import services.intelligence.scripts.retrieval_probe as mod

    monkeypatch.setenv("GEMINI_API_KEY", "")

    monkeypatch.setattr(
        mod, "fetch_chunks", lambda *a, **kw: [{"id": "c1", "ordinal": 0, "text": "x"}]
    )
    monkeypatch.setattr(
        mod,
        "rank_with_rpc",
        lambda *a, **kw: [{"chunk_id": "c1", "similarity": 0.9}],
    )

    def fake_post(url, json=None, timeout=None, headers=None):  # noqa: ANN001
        if isinstance(json, dict) and "texts" in json:
            return httpx.Response(200, json={"embeddings": [[1.0] * 768]})
        return httpx.Response(200, json=[])

    monkeypatch.setattr(httpx, "post", fake_post)

    # Provide a tiny question set via a temp file
    q_file = tmp_path / "q.json"
    q_file.write_text(
        json.dumps([{"label": "Q1", "question": "hello?", "answerSnippet": "hello world"}]),
        encoding="utf-8",
    )
    result = mod.probe("m1", str(q_file), hybrid=False, provider="sidecar")
    assert "Provider: `sidecar`" in result
