from __future__ import annotations

import httpx
import pytest

import app.generation.context as context_module
from app.generation.context import build_context
from app.generation.models import AssessmentScope
from app.ingestion.models import IngestionError


class FakeRest:
    """Records requests and replays queued responses in order."""

    def __init__(self, responses: list[httpx.Response] | None = None) -> None:
        self.calls: list[dict] = []
        self.responses = list(responses or [])
        self.response: httpx.Response | None = None

    def _next(self, method: str, url: str, json=None, headers=None) -> httpx.Response:
        self.calls.append({"method": method, "url": url, "json": json, "headers": headers})
        if self.responses:
            return self.responses.pop(0)
        assert self.response is not None
        return self.response

    def post(self, url: str, json=None, headers=None) -> httpx.Response:
        return self._next("post", url, json=json, headers=headers)

    def get(self, url: str, headers=None) -> httpx.Response:
        return self._next("get", url, headers=headers)


def _chunk_rows(count: int) -> list[httpx.Response]:
    return [
        httpx.Response(
            200,
            json=[
                {"id": f"c{index}", "ordinal": index, "text": f"body {index}"}
                for index in range(count)
            ],
        )
    ]


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
        "m1", ("core", "recall"), None, "https://supabase.example", "svc-key", rest  # type: ignore[arg-type]
    )
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


def test_build_context_bounds_the_query_to_the_scope_pages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A scoped steer carries its pages into the RPC's overlap predicate (D-05)."""
    embedded: list[list[str]] = []
    monkeypatch.setattr(
        context_module, "embed_queries", lambda texts, client: embedded.append(texts) or [[0.5]]
    )
    rest = FakeRest()
    rest.response = httpx.Response(200, json=[])
    scope = AssessmentScope(156, 213, "Chapter 5 Budgeting and control")
    build_context("m1", (), scope, "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]

    payload = rest.calls[0]["json"]
    assert payload["p_page_start"] == 156
    assert payload["p_page_end"] == 213
    # The section label is the steer (D-01), never the material title.
    assert payload["query_text"] == "Chapter 5 Budgeting and control"
    assert embedded == [["Chapter 5 Budgeting and control"]]


def test_build_context_steer_is_the_label_then_the_tags(monkeypatch: pytest.MonkeyPatch) -> None:
    embedded: list[list[str]] = []
    monkeypatch.setattr(
        context_module, "embed_queries", lambda texts, client: embedded.append(texts) or [[0.5]]
    )
    rest = FakeRest()
    rest.response = httpx.Response(200, json=[])
    build_context(
        "m1",
        ("gap analysis",),
        AssessmentScope(34, 69, "Chapter 1 Introduction to performance management"),
        "https://supabase.example",
        "svc-key",
        rest,  # type: ignore[arg-type]
    )
    assert embedded == [["Chapter 1 Introduction to performance management gap analysis"]]


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
    build_context("m1", ("gap analysis",), None, "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]
    assert embedded == [["gap analysis"]]
    assert rest.calls[0]["json"]["query_text"] == "gap analysis"


def test_build_context_spreads_when_there_is_no_steer(monkeypatch: pytest.MonkeyPatch) -> None:
    """No steer: sample the chunks evenly instead of embedding an empty query."""
    embedded: list[list[str]] = []
    monkeypatch.setattr(
        context_module, "embed_queries", lambda texts, client: embedded.append(texts) or [[0.5]]
    )
    listing = httpx.Response(
        200, json=[{"id": f"c{index}", "ordinal": index} for index in range(10)]
    )
    detail = httpx.Response(
        200,
        json=[
            {"id": "c0", "ordinal": 0, "text": "body 0"},
            {"id": "c2", "ordinal": 2, "text": "body 2"},
            {"id": "c4", "ordinal": 4, "text": "body 4"},
            {"id": "c6", "ordinal": 6, "text": "body 6"},
            {"id": "c8", "ordinal": 8, "text": "body 8"},
        ],
    )
    rest = FakeRest([listing, detail])
    chunks = build_context("m1", (), None, "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]

    assert [chunk.chunk_id for chunk in chunks] == ["c0", "c2", "c4", "c6", "c8"]
    assert chunks[0].text == "body 0"
    assert embedded == []
    listing_call, detail_call = rest.calls
    assert listing_call["method"] == "get"
    assert listing_call["url"] == (
        "https://supabase.example/rest/v1/content_chunks"
        "?material_id=eq.m1&select=id,ordinal&order=ordinal.asc&limit=10000"
    )
    assert detail_call["url"].startswith(
        "https://supabase.example/rest/v1/content_chunks?id=in.(c0,c2,c4,c6,c8)"
    )


def test_build_context_spread_is_bounded_by_the_scope_pages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(context_module, "embed_queries", lambda texts, client: [[0.5]])
    rest = FakeRest(
        [
            httpx.Response(200, json=[{"id": "c1", "ordinal": 1}]),
            httpx.Response(200, json=[{"id": "c1", "ordinal": 1, "text": "body"}]),
        ]
    )
    chunks = build_context(
        "m1", (), AssessmentScope(100, 140), "https://supabase.example", "svc-key", rest  # type: ignore[arg-type]
    )
    assert [chunk.chunk_id for chunk in chunks] == ["c1"]
    assert rest.calls[0]["url"].endswith("&page_start=lte.140&page_end=gte.100")


def test_build_context_spread_with_no_chunks_returns_nothing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The worker turns an empty context into a validation failure, not this module."""
    monkeypatch.setattr(context_module, "embed_queries", lambda texts, client: [[0.5]])
    rest = FakeRest([httpx.Response(200, json=[])])
    assert build_context("m1", (), None, "https://supabase.example", "svc-key", rest) == []  # type: ignore[arg-type]
    assert len(rest.calls) == 1


def test_build_context_spread_failure_is_retryable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(context_module, "embed_queries", lambda texts, client: [[0.5]])
    rest = FakeRest([httpx.Response(500, text="boom")])
    with pytest.raises(IngestionError) as excinfo:
        build_context("m1", (), None, "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]
    assert excinfo.value.code == "provider_unavailable"
    assert excinfo.value.retryable is True


def test_build_context_embedder_unavailable_is_retryable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(context_module, "embed_queries", lambda texts, client: [None])
    rest = FakeRest()
    with pytest.raises(IngestionError) as excinfo:
        build_context("m1", ("core",), None, "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]
    assert excinfo.value.code == "provider_unavailable"
    assert excinfo.value.retryable is True


def test_build_context_embedder_empty_result_is_retryable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(context_module, "embed_queries", lambda texts, client: [])
    rest = FakeRest()
    with pytest.raises(IngestionError) as excinfo:
        build_context("m1", ("core",), None, "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]
    assert excinfo.value.retryable is True


def test_build_context_rpc_5xx_is_retryable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(context_module, "embed_queries", lambda texts, client: [[0.1]])
    rest = FakeRest()
    rest.response = httpx.Response(503, text="unavailable")
    with pytest.raises(IngestionError) as excinfo:
        build_context("m1", ("core",), None, "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]
    assert excinfo.value.code == "provider_unavailable"
    assert excinfo.value.retryable is True


def test_build_context_rpc_error_body_is_retryable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(context_module, "embed_queries", lambda texts, client: [[0.1]])
    rest = FakeRest()
    rest.response = httpx.Response(200, json={"code": "PGRST116", "message": "no rows"})
    with pytest.raises(IngestionError) as excinfo:
        build_context("m1", ("core",), None, "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]
    assert excinfo.value.retryable is True
