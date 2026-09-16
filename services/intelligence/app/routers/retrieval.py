"""Retrieval endpoint: query-embed + match_content_chunks (+ optional rerank)."""

from __future__ import annotations

import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from app.middleware import request_id_from_request
from app.query_embedder import embed_queries
from app.rerank import RerankerClient
from app.security import require_user

logger = logging.getLogger("app.routers")

router = APIRouter()

MAX_TOP_K = 50
MAX_QUERY_CHARS = 8192


def _supabase_rest() -> tuple[str, str]:
    return (
        os.getenv("SUPABASE_URL", "").rstrip("/"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip(),
    )


@router.post("/retrieval/search")
def search(
    body: dict,
    request: Request,
    user_id: str = Depends(require_user),
) -> dict:
    if os.getenv("RETRIEVAL_ENABLED", "true").lower() not in ("1", "true", "yes"):
        raise HTTPException(status_code=404, detail="retrieval disabled")

    material_id = str(body.get("materialId") or body.get("material_id") or "").strip()
    query = str(body.get("query") or "").strip()
    try:
        top_k = int(body.get("topK", body.get("top_k", 10)))
    except Exception:
        logger.debug(
            "bad topK, using default",
            extra={"request_id": request_id_from_request(request)},
        )
        top_k = 10
    hybrid = bool(body.get("hybrid", True))
    rerank = bool(body.get("rerank", False))
    rerank_top = body.get("rerankTopK", body.get("rerank_top_k"))
    try:
        rerank_top = int(rerank_top) if rerank_top is not None else top_k
    except Exception:
        logger.debug(
            "bad rerankTopK, using top_k",
            extra={"request_id": request_id_from_request(request)},
        )
        rerank_top = top_k

    if not material_id or not query:
        raise HTTPException(status_code=400, detail="materialId and query are required")
    if len(query) > MAX_QUERY_CHARS:
        query = query[:MAX_QUERY_CHARS]
    top_k = max(1, min(top_k, MAX_TOP_K))
    rerank_top = max(1, min(rerank_top, MAX_TOP_K))

    supa_url, service_key = _supabase_rest()
    if not supa_url or not service_key:
        raise HTTPException(status_code=500, detail="search not configured")

    with httpx.Client(
        timeout=30.0, headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"}
    ) as client:
        row = client.get(
            f"{supa_url}/rest/v1/materials",
            params={
                "id": f"eq.{material_id}",
                "select": "id,user_id,ingestion_state,embedding_provider",
                "limit": 1,
            },
        )
        if row.status_code >= 400:
            raise HTTPException(status_code=500, detail="material lookup failed")
        rows = row.json()
        if not rows:
            raise HTTPException(status_code=404, detail="material not found")
        if str(rows[0].get("user_id")) != str(user_id):
            raise HTTPException(status_code=404, detail="material not found")

        vectors = embed_queries([query])
        if not vectors or vectors[0] is None:
            raise HTTPException(status_code=500, detail="query embedding failed")
        literal = "[" + ",".join(f"{v:.8f}" for v in vectors[0]) + "]"
        payload: dict = {
            "query_embedding": literal,
            "match_material_id": material_id,
            "top_k": 50,
            "query_text": query if hybrid else None,
        }

        rpc = client.post(
            f"{supa_url}/rest/v1/rpc/match_content_chunks",
            json=payload,
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            },
        )
        if rpc.status_code >= 300:
            raise HTTPException(status_code=500, detail=f"match failed: {rpc.text[:200]}")
        raw = rpc.json()
        if isinstance(raw, dict) and raw.get("code"):
            msg = str(raw.get("message", "unknown"))[:200]
            raise HTTPException(status_code=500, detail=f"match failed: {msg}")
        hits: list[dict] = raw  # type: ignore[assignment]

        reranked_indices: list[int] | None = None
        if rerank and hits:
            rc = RerankerClient()
            passages = [str(h.get("chunk_text") or "") for h in hits]
            try:
                reranked_indices = rc.rerank(query, passages, top_k=rerank_top)
            except Exception as exc:
                logger.warning(
                    "rerank failed",
                    extra={"request_id": request_id_from_request(request)},
                )
                raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not rerank or not reranked_indices:
        top = hits[:top_k]
    else:
        top = [hits[i] for i in reranked_indices[:top_k]]
    return {"chunks": top, "reranked": rerank, "indices": reranked_indices}
