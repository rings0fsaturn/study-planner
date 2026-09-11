from __future__ import annotations

import httpx
import pytest

import app.generation.context as context_module
from app.generation.context import build_context
from app.ingestion.models import IngestionError


class FakeRest:
    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.response: httpx.Response | None = None

    def post(self, url: str, json: dict, headers: dict) -> httpx.Response:
        self.calls.append({"url": url, "json": json, "headers": headers})
        assert self.response is not None
        return self.response


def test_build_context_returns_retrieved_chunks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(context_module, "embed_queries", lambda texts, client: [[0.1, 0.2]])
    rest = FakeRest()
    rest.response = httpx.Response(
        200,
        json=[
            {"chunk_id": "c1", "material_id": "m1", "chunk_text": "body one", "ordinal": 0},
            {"chunk_id": "c2", "material_id": "m1", "chunk_text": "body two", "ordinal": 1},
        ],
    )
    chunks = build_context(
        "m1", ("core", "recall"), "https://supabase.example", "svc-key", rest
    )  # type: ignore[arg-type]
    assert [chunk.chunk_id for chunk in chunks] == ["c1", "c2"]
    assert chunks[0].text == "body one"
    assert chunks[0].ordinal == 0
    call = rest.calls[0]
    assert call["url"] == "https://supabase.example/rest/v1/rpc/match_content_chunks"
    assert call["json"] == {
        "query_embedding": "[0.10000000,0.20000000]",
        "match_material_id": "m1",
        "top_k": 5,
        "query_text": "core recall",
    }
    assert call["headers"]["Authorization"] == "Bearer svc-key"


def test_build_context_steer_carries_no_material_title(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The title is front matter; it must never reach the retrieval query (D-01)."""
    embedded: list[list[str]] = []
    monkeypatch.setattr(
        context_module,
        "embed_queries",
        lambda texts, client: embedded.append(texts) or [[0.5]],
    )
    rest = FakeRest()
    rest.response = httpx.Response(200, json=[])
    build_context("m1", ("gap analysis",), "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]
    assert embedded == [["gap analysis"]]
    assert rest.calls[0]["json"]["query_text"] == "gap analysis"


def test_build_context_rejects_an_empty_steer(monkeypatch: pytest.MonkeyPatch) -> None:
    """No tags and no scope means no honest query: refuse, never embed junk."""
    embedded: list[list[str]] = []
    monkeypatch.setattr(
        context_module,
        "embed_queries",
        lambda texts, client: embedded.append(texts) or [[0.5]],
    )
    rest = FakeRest()
    with pytest.raises(IngestionError) as excinfo:
        build_context("m1", (), "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]
    assert excinfo.value.code == "validation_failed"
    assert excinfo.value.retryable is False
    assert embedded == []
    assert rest.calls == []


def test_build_context_embedder_unavailable_is_retryable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(context_module, "embed_queries", lambda texts, client: [None])
    rest = FakeRest()
    with pytest.raises(IngestionError) as excinfo:
        build_context("m1", ("core",), "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]
    assert excinfo.value.code == "provider_unavailable"
    assert excinfo.value.retryable is True


def test_build_context_embedder_empty_result_is_retryable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(context_module, "embed_queries", lambda texts, client: [])
    rest = FakeRest()
    with pytest.raises(IngestionError) as excinfo:
        build_context("m1", ("core",), "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]
    assert excinfo.value.retryable is True


def test_build_context_rpc_5xx_is_retryable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(context_module, "embed_queries", lambda texts, client: [[0.1]])
    rest = FakeRest()
    rest.response = httpx.Response(503, text="unavailable")
    with pytest.raises(IngestionError) as excinfo:
        build_context("m1", ("core",), "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]
    assert excinfo.value.code == "provider_unavailable"
    assert excinfo.value.retryable is True


def test_build_context_rpc_error_body_is_retryable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(context_module, "embed_queries", lambda texts, client: [[0.1]])
    rest = FakeRest()
    rest.response = httpx.Response(200, json={"code": "PGRST116", "message": "no rows"})
    with pytest.raises(IngestionError) as excinfo:
        build_context("m1", ("core",), "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]
    assert excinfo.value.retryable is True
