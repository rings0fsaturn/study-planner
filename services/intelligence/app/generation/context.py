"""Retrieval-driven RAG context for generation (D-02).

The pipeline embeds a steer query (material title + requested skill tags)
and calls `match_content_chunks` with the service role, exactly the proven
path in `app/routers/retrieval.py`. If the embedder is unavailable the job
fails retryable with `provider_unavailable`; there is no silent ungrounded
fallback.
"""

from __future__ import annotations

import httpx

from app.generation.models import RetrievedChunk
from app.ingestion.models import IngestionError
from app.query_embedder import embed_queries

CONTEXT_TOP_K = 5


def build_context(
    material_id: str,
    skill_tags: tuple[str, ...],
    title: str,
    supabase_url: str,
    service_key: str,
    client: httpx.Client,
) -> list[RetrievedChunk]:
    """Retrieve up to CONTEXT_TOP_K owner-scoped chunks for the steer query."""
    steer = " ".join(part for part in (title, *skill_tags) if part).strip() or title
    vectors = embed_queries([steer], client=client)
    if not vectors or vectors[0] is None:
        raise IngestionError("provider_unavailable", "query embedding failed", retryable=True)

    literal = "[" + ",".join(f"{value:.8f}" for value in vectors[0]) + "]"
    response = client.post(
        f"{supabase_url.rstrip('/')}/rest/v1/rpc/match_content_chunks",
        json={
            "query_embedding": literal,
            "match_material_id": material_id,
            "top_k": CONTEXT_TOP_K,
        },
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        },
    )
    if response.status_code >= 300:
        raise IngestionError(
            "provider_unavailable",
            f"chunk retrieval rejected ({response.status_code})",
            retryable=True,
        )
    hits = response.json()
    if isinstance(hits, dict) and hits.get("code"):
        raise IngestionError(
            "provider_unavailable",
            f"chunk retrieval rejected: {str(hits.get('message', 'unknown'))[:200]}",
            retryable=True,
        )
    return [
        RetrievedChunk(
            chunk_id=str(row.get("chunk_id") or ""),
            material_id=str(row.get("material_id") or material_id),
            text=str(row.get("chunk_text") or ""),
            ordinal=int(row.get("ordinal") or 0),
        )
        for row in hits
    ]
