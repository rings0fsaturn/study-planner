"""Retrieval-driven RAG context for generation (D-01, D-02).

The pipeline embeds the learner's topic steer - the chosen section label plus
any requested skill tags - and calls `match_content_chunks` with the service
role, exactly the proven path in `app/routers/retrieval.py`. The material
title is deliberately NOT part of the steer: it matches the cover, the
contents page and the index, so a title-bearing query retrieves front matter
and the model can then only author exam-format questions. Measured 2026-09-11
on the 572-page ACCA APM corpus: 5/5 retrieved chunks were front or back
matter for every steer that contained the title, while dropping it retrieved
the technical chapters (`gap analysis` -> the F0/F1/F2 planning-gap chunks).
The title reaches the prompt as document context in `prompts.py` instead.

If the embedder is unavailable the job fails retryable with
`provider_unavailable`; there is no silent ungrounded fallback.
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
    supabase_url: str,
    service_key: str,
    client: httpx.Client,
) -> list[RetrievedChunk]:
    """Retrieve up to CONTEXT_TOP_K owner-scoped chunks for the steer query."""
    steer = " ".join(tag for tag in skill_tags if tag).strip()
    if not steer:
        # No title fallback: the title is what retrieved the cover and the
        # contents page. With nothing to steer on there is no honest query -
        # an empty steer embeds to a degenerate vector and returns fragments
        # (measured 2026-09-11: "likes". / "produced." / "369"), so refuse
        # instead of grounding a question on noise.
        raise IngestionError(
            "validation_failed",
            "no topic steer: a section scope or at least one skill tag is required",
            retryable=False,
        )
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
            # query_text disambiguates the live 4-arg hybrid overload (016)
            # and enables lexical fusion for the steer query.
            "query_text": steer,
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
            page_start=_optional_int(row.get("page_start")),
            page_end=_optional_int(row.get("page_end")),
        )
        for row in hits
    ]


def _optional_int(value: object) -> int | None:
    return None if value is None else int(value)  # type: ignore[arg-type]
