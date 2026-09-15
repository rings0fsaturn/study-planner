"""Retrieval-driven RAG context for generation (D-01, D-02, D-05, D-08).

There are two honest ways to ground a question:

- a **steer** (the chosen section label plus any requested skill tags) is
  embedded and sent to `match_content_chunks` with the service role - exactly
  the proven path in `app/routers/retrieval.py` - bounded by the scope's pages
  when the learner chose a scope;
- **no steer at all** falls back to an evenly spread sample of the material's
  chunks, inside the chosen pages when there is a scope. An empty steer is
  never embedded: it degenerates into fragments (measured 2026-09-11:
  "likes". / "produced." / "369"), which is why a page-only scope spreads
  instead of querying (D-08).

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
) -> list[RetrievedChunk]:
    """Retrieve up to CONTEXT_TOP_K owner-scoped chunks for the steer or scope."""
    steer = _steer(skill_tags, scope)
    if not steer:
        return _spread_context(material_id, scope, supabase_url, service_key, client)

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
) -> list[RetrievedChunk]:
    """No steer: CONTEXT_TOP_K chunks spread evenly over the material or scope.

    Two light requests instead of shipping every chunk's text: the id/ordinal
    list decides the spread, then only the chosen rows are fetched with text.
    """
    base = f"{supabase_url.rstrip('/')}/rest/v1/{CHUNKS_TABLE}"
    query = (
        f"{base}?material_id=eq.{material_id}&select=id,ordinal&order=ordinal.asc&limit=10000"
    )
    if scope is not None:
        query += f"&page_start=lte.{scope.page_end}&page_end=gte.{scope.page_start}"
    rows = _json_rows(
        _request(client, "get", query, service_key=service_key),
        "chunk listing",
    )
    picks = _evenly_spaced(rows, CONTEXT_TOP_K)
    if not picks:
        return []
    ids = ",".join(str(row["id"]) for row in picks)
    detail = _json_rows(
        _request(
            client,
            "get",
            f"{base}?id=in.({ids})&select=id,ordinal,text,page_start,page_end&order=ordinal.asc",
            service_key=service_key,
        ),
        "chunk listing",
    )
    return [
        RetrievedChunk(
            chunk_id=str(row.get("id") or ""),
            material_id=material_id,
            text=str(row.get("text") or ""),
            ordinal=int(row.get("ordinal") or 0),
            page_start=_optional_int(row.get("page_start")),
            page_end=_optional_int(row.get("page_end")),
        )
        for row in detail
    ]


def _evenly_spaced(rows: list[dict], count: int) -> list[dict]:
    """`count` rows spread across `rows` (all of them when there are fewer)."""
    if len(rows) <= count:
        return list(rows)
    step = len(rows) / count
    return [rows[int(index * step)] for index in range(count)]


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
