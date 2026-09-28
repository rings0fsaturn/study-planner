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
        "m1",
        ("core", "recall"),
        None,
        "https://supabase.example",
        "svc-key",
        rest,  # type: ignore[arg-type]
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


def test_build_context_steer_override_replaces_skill_tag_steer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The guide steers by its own query text, not the skill-tag steer (D-06)."""
    embedded: list[list[str]] = []
    monkeypatch.setattr(
        context_module, "embed_queries", lambda texts, client: embedded.append(texts) or [[0.1]]
    )
    rest = FakeRest()
    rest.response = httpx.Response(200, json=[])
    build_context(
        "m1",
        ("core",),
        None,
        "https://supabase.example",
        "svc-key",
        rest,  # type: ignore[arg-type]
        steer_override="What does this function return?",
    )
    assert embedded == [["What does this function return?"]]
    assert rest.calls[0]["json"]["query_text"] == "What does this function return?"


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
        "?material_id=eq.m1&select=id,ordinal&order=ordinal.asc&limit=1000&offset=0"
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
        "m1",
        (),
        AssessmentScope(100, 140),
        "https://supabase.example",
        "svc-key",
        rest,  # type: ignore[arg-type]
    )
    assert [chunk.chunk_id for chunk in chunks] == ["c1"]
    assert "&page_start=lte.140&page_end=gte.100" in rest.calls[0]["url"]


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


# --- code-seeking spread (coding arm only, D-07) ---------------------------


def _prose(row_id: str, ordinal: int) -> dict:
    return {"id": row_id, "ordinal": ordinal, "text": "a plain sentence of prose"}


def _code(row_id: str, ordinal: int) -> dict:
    return {"id": row_id, "ordinal": ordinal, "text": "def f(x):\n    return x"}


def test_code_seeking_picks_the_code_dense_chunk_in_each_band() -> None:
    """Five ordinal bands, the top code-proximity chunk from each."""
    rows = [
        _prose("c0", 0),
        _prose("c1", 1),
        _prose("c2", 2),
        _code("c3", 3),
        _code("c4", 4),
        _prose("c5", 5),
        _prose("c6", 6),
        _prose("c7", 7),
        _prose("c8", 8),
        _prose("c9", 9),
    ]
    rest = FakeRest([httpx.Response(200, json=rows)])
    chunks = build_context(
        "m1",
        (),
        None,
        "https://supabase.example",
        "svc-key",
        rest,  # type: ignore[arg-type]
        code_seeking=True,
    )
    assert [chunk.chunk_id for chunk in chunks] == ["c0", "c3", "c4", "c6", "c8"]
    # The single listing request widened its select to carry the text.
    assert rest.calls[0]["url"].startswith(
        "https://supabase.example/rest/v1/content_chunks"
        "?material_id=eq.m1&select=id,ordinal,text,page_start,page_end&"
    )


def test_code_seeking_exclusion_removes_tried_chunks() -> None:
    rows = [_code(f"c{index}", index) for index in range(6)]
    rest = FakeRest([httpx.Response(200, json=rows)])
    chunks = build_context(
        "m1",
        (),
        None,
        "https://supabase.example",
        "svc-key",
        rest,  # type: ignore[arg-type]
        code_seeking=True,
        exclude_chunk_ids=frozenset({"c0"}),
    )
    assert [chunk.chunk_id for chunk in chunks] == ["c1", "c2", "c3", "c4", "c5"]


def test_code_seeking_spread_is_bounded_by_the_scope_pages() -> None:
    rest = FakeRest([httpx.Response(200, json=[_code("c1", 1)])])
    chunks = build_context(
        "m1",
        (),
        AssessmentScope(100, 140),
        "https://supabase.example",
        "svc-key",
        rest,  # type: ignore[arg-type]
        code_seeking=True,
    )
    assert [chunk.chunk_id for chunk in chunks] == ["c1"]
    assert "&page_start=lte.140&page_end=gte.100" in rest.calls[0]["url"]


def test_default_spread_is_unchanged_by_the_code_seeking_seam() -> None:
    """D-07: no flag means the original two-request even spread."""
    listing = httpx.Response(
        200, json=[{"id": f"c{index}", "ordinal": index} for index in range(10)]
    )
    detail = httpx.Response(
        200,
        json=[{"id": f"c{index}", "ordinal": index, "text": "body"} for index in (0, 2, 4, 6, 8)],
    )
    rest = FakeRest([listing, detail])
    chunks = build_context(
        "m1",
        (),
        None,
        "https://supabase.example",
        "svc-key",
        rest,  # type: ignore[arg-type]
    )
    assert [chunk.chunk_id for chunk in chunks] == ["c0", "c2", "c4", "c6", "c8"]
    assert "select=id,ordinal&" in rest.calls[0]["url"]


def test_listing_pages_until_a_short_page(monkeypatch: pytest.MonkeyPatch) -> None:
    """PostgREST caps collections at 1000 rows; the even spread must page."""
    monkeypatch.setattr(context_module, "LISTING_PAGE_SIZE", 2)
    pages = [
        httpx.Response(200, json=[{"id": "c0", "ordinal": 0}, {"id": "c1", "ordinal": 1}]),
        httpx.Response(200, json=[{"id": "c2", "ordinal": 2}, {"id": "c3", "ordinal": 3}]),
        httpx.Response(200, json=[{"id": "c4", "ordinal": 4}, {"id": "c5", "ordinal": 5}]),
        httpx.Response(200, json=[]),  # exact multiple: the loop ends on the short page
    ]
    detail = httpx.Response(
        200, json=[{"id": f"c{i}", "ordinal": i, "text": "body"} for i in range(5)]
    )
    rest = FakeRest([*pages, detail])
    chunks = build_context("m1", (), None, "https://supabase.example", "svc-key", rest)  # type: ignore[arg-type]

    assert [chunk.chunk_id for chunk in chunks] == ["c0", "c1", "c2", "c3", "c4"]
    assert [call["url"].split("&")[-2:] for call in rest.calls[:4]] == [
        ["limit=2", "offset=0"],
        ["limit=2", "offset=2"],
        ["limit=2", "offset=4"],
        ["limit=2", "offset=6"],
    ]


def test_code_seeking_scores_across_paged_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    """A code chunk past the cap still wins its band (the DDIA 1094-chunk case)."""
    monkeypatch.setattr(context_module, "LISTING_PAGE_SIZE", 4)
    rows = [
        _prose("c0", 0),
        _prose("c1", 1),
        _prose("c2", 2),
        _code("c3", 3),
        _code("c4", 4),
        _prose("c5", 5),
        _prose("c6", 6),
        _prose("c7", 7),
        _prose("c8", 8),
        _prose("c9", 9),
    ]
    rest = FakeRest(
        [httpx.Response(200, json=rows[offset : offset + 4]) for offset in range(0, len(rows), 4)]
    )
    chunks = build_context(
        "m1",
        (),
        None,
        "https://supabase.example",
        "svc-key",
        rest,
        code_seeking=True,  # type: ignore[arg-type]
    )
    assert [chunk.chunk_id for chunk in chunks] == ["c0", "c3", "c4", "c6", "c8"]
    assert len(rest.calls) == 3  # 4 + 4 + 2; the third page is short
