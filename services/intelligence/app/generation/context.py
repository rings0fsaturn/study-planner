"""Retrieval-driven RAG context for generation (D-01, D-02, D-05, D-08).

There are two honest ways to ground a question:

- a **steer** (the chosen section label plus any requested skill tags) is
  embedded and sent to `match_content_chunks` with the service role - exactly
  the proven path in `app/routers/retrieval.py` - bounded by the scope's pages
  when the learner chose a scope;
- **no steer at all** falls back to a spread sample of the material's chunks,
  inside the chosen pages when there is a scope: evenly spread by default, or
  code-dense per ordinal band when the coding arm opts in (`code_seeking`).
  An empty steer is never embedded: it degenerates into fragments (measured
  2026-09-11: "likes". / "produced." / "369"), which is why a page-only scope
  spreads instead of querying (D-08).

The material title is deliberately NOT part of the steer: it matches the
cover, the contents page and the index, so a title-bearing query retrieves
front matter and the model can then only author exam-format questions.
Measured 2026-09-11 on the 572-page ACCA APM corpus: 5/5 retrieved chunks were
front or back matter for every steer that contained the title, while dropping
it retrieved the technical chapters. The title reaches the prompt as document
context in `prompts.py` instead.

If the embedder is unavailable the job fails retryable with
`provider_unavailable`; there is no silent ungrounded fallback.
"""

from __future__ import annotations

import httpx

from app.generation.models import AssessmentScope, RetrievedChunk
from app.ingestion.code_signal import code_proximity
from app.ingestion.models import IngestionError
from app.query_embedder import embed_queries

CONTEXT_TOP_K = 5
CHUNKS_TABLE = "content_chunks"


def build_context(
    material_id: str,
    skill_tags: tuple[str, ...],
    scope: AssessmentScope | None,
    supabase_url: str,
    service_key: str,
    client: httpx.Client,
    *,
    code_seeking: bool = False,
    exclude_chunk_ids: frozenset[str] = frozenset(),
) -> list[RetrievedChunk]:
    """Retrieve up to CONTEXT_TOP_K owner-scoped chunks for the steer or scope.

    `code_seeking` is opt-in on the coding arm (D-07): with no steer it picks
    the most code-dense chunk in each ordinal band instead of an even spread,
    so an algorithms listing is not missed in favour of chapter summaries.
    `exclude_chunk_ids` lets the coding resample ask for a different window.
    """
    steer = _steer(skill_tags, scope)
    if not steer:
        return _spread_context(
            material_id,
            scope,
            supabase_url,
            service_key,
            client,
            code_seeking=code_seeking,
            exclude_chunk_ids=exclude_chunk_ids,
        )

    vectors = embed_queries([steer], client=client)
    if not vectors or vectors[0] is None:
        raise IngestionError("provider_unavailable", "query embedding failed", retryable=True)

    literal = "[" + ",".join(f"{value:.8f}" for value in vectors[0]) + "]"
    payload: dict[str, object] = {
        "query_embedding": literal,
        "match_material_id": material_id,
        "top_k": CONTEXT_TOP_K,
        # query_text enables lexical fusion for the steer query.
        "query_text": steer,
    }
    if scope is not None:
        # Migration 029's page bounds: overlap, so the chunk carrying the
        # range's opening text is kept even when it straddles the boundary.
        payload["p_page_start"] = scope.page_start
        payload["p_page_end"] = scope.page_end
    response = _request(
        client,
        "post",
        f"{supabase_url.rstrip('/')}/rest/v1/rpc/match_content_chunks",
        service_key=service_key,
        json=payload,
    )
    return [
        RetrievedChunk(
            chunk_id=str(row.get("chunk_id") or ""),
            material_id=str(row.get("material_id") or material_id),
            text=str(row.get("chunk_text") or ""),
            ordinal=int(row.get("ordinal") or 0),
            page_start=_optional_int(row.get("page_start")),
            page_end=_optional_int(row.get("page_end")),
        )
        for row in _json_rows(response, "chunk retrieval")
    ]


def _steer(skill_tags: tuple[str, ...], scope: AssessmentScope | None) -> str:
    """The section label first, then the tags: never the material title (D-01)."""
    label = (scope.section_label,) if scope is not None else ()
    return " ".join(part for part in (*label, *skill_tags) if part).strip()


def _spread_context(
    material_id: str,
    scope: AssessmentScope | None,
    supabase_url: str,
    service_key: str,
    client: httpx.Client,
    *,
    code_seeking: bool = False,
    exclude_chunk_ids: frozenset[str] = frozenset(),
) -> list[RetrievedChunk]:
    """No steer: CONTEXT_TOP_K chunks spread over the material or scope.

    The default is an even spread. It sends two light requests instead of
    shipping every chunk's text: the id/ordinal list decides the spread, then
    only the chosen rows are fetched with text. `code_seeking` (coding arm
    only) fetches the candidate text and leans on `code_proximity`.
    """
    select = "id,ordinal,text,page_start,page_end" if code_seeking else "id,ordinal"
    query = (
        f"{supabase_url.rstrip('/')}/rest/v1/{CHUNKS_TABLE}"
        f"?material_id=eq.{material_id}&select={select}&order=ordinal.asc&limit=10000"
    )
    if scope is not None:
        query += f"&page_start=lte.{scope.page_end}&page_end=gte.{scope.page_start}"
    if code_seeking:
        return _code_seeking_context(
            query,
            material_id,
            exclude_chunk_ids,
            supabase_url,
            service_key,
            client,
        )
    rows = _json_rows(
        _request(client, "get", query, service_key=service_key),
        "chunk listing",
    )
    rows = [row for row in rows if str(row.get("id") or "") not in exclude_chunk_ids]
    picks = _evenly_spaced(rows, CONTEXT_TOP_K)
    if not picks:
        return []
    ids = ",".join(str(row["id"]) for row in picks)
    detail = _json_rows(
        _request(
            client,
            "get",
            (
                f"{supabase_url.rstrip('/')}/rest/v1/{CHUNKS_TABLE}"
                f"?id=in.({ids})&select=id,ordinal,text,page_start,page_end&order=ordinal.asc"
            ),
            service_key=service_key,
        ),
        "chunk listing",
    )
    return [_retrieved_chunk(row, material_id) for row in detail]


def _code_seeking_context(
    listing_query: str,
    material_id: str,
    exclude_chunk_ids: frozenset[str],
    supabase_url: str,
    service_key: str,
    client: httpx.Client,
) -> list[RetrievedChunk]:
    """Code-dense spread: one request with text, score in memory (D-03).

    The caller's listing query already carries the text in its `select`, so the
    scorer runs on candidate rows without a stored code column or a second
    fetch.
    """
    rows = _json_rows(
        _request(client, "get", listing_query, service_key=service_key),
        "chunk listing",
    )
    rows = [row for row in rows if str(row.get("id") or "") not in exclude_chunk_ids]
    return [_retrieved_chunk(row, material_id) for row in _top_code_picks(rows)]


def _top_code_picks(rows: list[dict]) -> list[dict]:
    """Highest code-proximity chunk in each of CONTEXT_TOP_K ordinal bands.

    Bands keep the five picks spread across the material instead of five
    adjacent chunks of one listing. Ties take the earliest ordinal in the band,
    so an all-prose candidate set degrades to the even spread.
    """
    if len(rows) <= CONTEXT_TOP_K:
        return list(rows)
    step = len(rows) / CONTEXT_TOP_K
    picks: list[dict] = []
    for band in range(CONTEXT_TOP_K):
        start = int(band * step)
        end = len(rows) if band == CONTEXT_TOP_K - 1 else int((band + 1) * step)
        window = rows[start:end]
        picks.append(max(window, key=lambda row: code_proximity(str(row.get("text") or ""))))
    return picks


def _evenly_spaced(rows: list[dict], count: int) -> list[dict]:
    """`count` rows spread across `rows` (all of them when there are fewer)."""
    if len(rows) <= count:
        return list(rows)
    step = len(rows) / count
    return [rows[int(index * step)] for index in range(count)]


def _retrieved_chunk(row: dict, material_id: str) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=str(row.get("id") or ""),
        material_id=material_id,
        text=str(row.get("text") or ""),
        ordinal=int(row.get("ordinal") or 0),
        page_start=_optional_int(row.get("page_start")),
        page_end=_optional_int(row.get("page_end")),
    )


def _request(
    client: httpx.Client, method: str, url: str, *, service_key: str, json: dict | None = None
):
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    if json is None:
        return client.get(url, headers=headers)
    return client.post(url, json=json, headers=headers)


def _json_rows(response, what: str) -> list[dict]:
    """Rows from a PostgREST response; any error shape becomes retryable."""
    if response.status_code >= 300:
        raise IngestionError(
            "provider_unavailable", f"{what} rejected ({response.status_code})", retryable=True
        )
    payload = response.json()
    if isinstance(payload, dict):
        raise IngestionError(
            "provider_unavailable",
            f"{what} rejected: {str(payload.get('message', 'unknown'))[:200]}",
            retryable=True,
        )
    return payload


def _optional_int(value: object) -> int | None:
    return None if value is None else int(value)  # type: ignore[arg-type]
