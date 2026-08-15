"""Cross-encoder reranker sidecar.

Loads a sentence-transformers CrossEncoder once at startup and serves a
single `/rerank` endpoint: score (query, passage) pairs and return the
passages reordered by descending relevance.

The model is served out-of-process on purpose: it pulls torch into its own
container so the Intelligence service stays lean, and it is the natural
home for the future local embedder as well (see the retrieval-quality
program plan).

Model: Qwen/Qwen3-Reranker-0.6B (Apache-2.0), overridden with `RERANKER_MODEL`.
"""

from __future__ import annotations

import logging
import os
import time

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import CrossEncoder

logger = logging.getLogger("reranker")

DEFAULT_MODEL = "Qwen/Qwen3-Reranker-0.6B"
DEFAULT_BATCH_SIZE = 8
MAX_PAIRS = 100
MAX_PASSAGE_CHARS = 8192

app = FastAPI(title="reranker", version="0.1.0")

_model: CrossEncoder | None = None
_batch_size: int = DEFAULT_BATCH_SIZE


class RerankRequest(BaseModel):
    query: str = Field(min_length=1)
    passages: list[str] = Field(min_length=1, max_length=MAX_PAIRS)


class RerankResponse(BaseModel):
    indices: list[int]
    scores: list[float]
    latency_ms: float


@app.on_event("startup")
def _load_model() -> None:
    global _model, _batch_size
    model_id = os.getenv("RERANKER_MODEL", DEFAULT_MODEL)
    _batch_size = int(os.getenv("RERANKER_BATCH_SIZE", str(DEFAULT_BATCH_SIZE)))
    started = time.perf_counter()
    _model = CrossEncoder(model_id, trust_remote_code=True)
    logger.info("loaded %s in %.1fs", model_id, time.perf_counter() - started)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": os.getenv("RERANKER_MODEL", DEFAULT_MODEL),
        "loaded": _model is not None,
    }


@app.post("/rerank", response_model=RerankResponse)
def rerank(request: RerankRequest) -> RerankResponse:
    if _model is None:
        raise HTTPException(status_code=503, detail="model not loaded")
    started = time.perf_counter()
    clipped = [passage[:MAX_PASSAGE_CHARS] for passage in request.passages]
    pairs = [(request.query, passage) for passage in clipped]
    try:
        scores = _model.predict(pairs, batch_size=_batch_size)
    except Exception as exc:  # provider-side failures are 5xx, not crashes
        logger.exception("rerank prediction failed")
        raise HTTPException(status_code=500, detail=f"rerank failed: {exc}") from exc
    order = sorted(range(len(scores)), key=lambda i: -float(scores[i]))
    return RerankResponse(
        indices=order,
        scores=[float(scores[i]) for i in order],
        latency_ms=(time.perf_counter() - started) * 1000.0,
    )
