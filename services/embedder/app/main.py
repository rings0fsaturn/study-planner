"""ROCm GPU inference sidecar: embeddings + reranking.

Loads a SentenceTransformer (Qwen3-Embedding-0.6B) and a CrossEncoder
(Qwen3-Reranker-0.6B) once at startup and serves `/embed`, `/rerank`, and
`/health` from a single GPU context.

The models run out-of-process on purpose: they pull torch into their own
container so the Intelligence service stays lean. This container targets ROCm
GPU access via Docker Desktop WSL2 passthrough (`/dev/dxg` + WSL driver
shims); CPU fallback is possible but loudly warned about because silent CPU
fallback is the main failure mode.

Embedding model: Qwen/Qwen3-Embedding-0.6B (overridden with `EMBEDDING_MODEL`).
Dimensions: the model's native 1024 is Matryoshka-truncated to
`EMBEDDING_DIMENSIONS` (default 768, matching the `halfvec(768)` schema);
sentence-transformers re-normalizes after truncation, and `normalize_embeddings`
keeps every returned vector L2-normalized. This reproduces the frozen research
baseline (2026-08-15 retrieval quality program): fp32, 768-dim, prompt-aware,
no title prefix, no int8 quantization.

Reranker model: Qwen/Qwen3-Reranker-0.6B (overridden with `RERANKER_MODEL`),
batch size `RERANKER_BATCH_SIZE` (default 8).

Queries and passages are asymmetric for the embedding family: the request
carries `is_query` and the encoder applies the model's own prompt from its
config (candidates `retrieval.query`/`search_query`/`query` for queries and
`retrieval.document`/`search_document`/`passage` for passages). Qwen3-Embedding
exposes only `query`, so passages embed without an instruction prompt, exactly
the configuration the frozen research baseline measured.
"""

from __future__ import annotations

import logging
import os
import time

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import CrossEncoder, SentenceTransformer

logger = logging.getLogger("gpu-sidecar")

DEFAULT_MODEL = "Qwen/Qwen3-Embedding-0.6B"
DEFAULT_DIMENSIONS = 768
DEFAULT_BATCH_SIZE = 64
MAX_TEXTS = 100
MAX_TEXT_CHARS = 8192
_QUERY_PROMPT_CANDIDATES = ("retrieval.query", "search_query", "query")
_DOC_PROMPT_CANDIDATES = ("retrieval.document", "search_document", "passage")

DEFAULT_RERANKER_MODEL = "Qwen/Qwen3-Reranker-0.6B"
DEFAULT_RERANKER_BATCH_SIZE = 8
MAX_PAIRS = 100
MAX_PASSAGE_CHARS = 8192

app = FastAPI(title="gpu-sidecar", version="0.3.0")

_model: SentenceTransformer | None = None
_device: str | None = None
_query_prompt: str | None = None
_doc_prompt: str | None = None
_reranker: CrossEncoder | None = None
_reranker_batch_size: int = DEFAULT_RERANKER_BATCH_SIZE


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=MAX_TEXTS)
    # Queries use the model's query instruction; passages use the passage
    # instruction (or none when the model family has no prompts configured).
    is_query: bool = False


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]


class RerankRequest(BaseModel):
    query: str = Field(min_length=1)
    passages: list[str] = Field(min_length=1, max_length=MAX_PAIRS)


class RerankResponse(BaseModel):
    indices: list[int]
    scores: list[float]
    latency_ms: float


class HealthResponse(BaseModel):
    status: str
    model: str
    dimensions: int
    device: str
    cuda_available: bool
    device_name: str | None
    torch_version: str
    loaded: bool
    reranker_model: str
    reranker_loaded: bool


def _detect_device() -> str:
    if torch.cuda.is_available():
        return f"cuda:{torch.cuda.current_device()}"
    logger.warning(
        "torch.cuda.is_available() is False - running on CPU. "
        "GPU passthrough (/dev/dxg, /usr/lib/wsl, libdxcore, HSA runtime) is "
        "missing or misconfigured."
    )
    return "cpu"


def _resolve_prompt(available: set[str], candidates: tuple[str, ...]) -> str | None:
    for candidate in candidates:
        if candidate in available:
            return candidate
    return None


def _load_embedder() -> None:
    global _model, _device, _query_prompt, _doc_prompt
    model_id = os.getenv("EMBEDDING_MODEL", DEFAULT_MODEL)
    dimensions = int(os.getenv("EMBEDDING_DIMENSIONS", str(DEFAULT_DIMENSIONS)))
    _device = _detect_device()
    started = time.perf_counter()
    _model = SentenceTransformer(
        model_id,
        device=_device,
        trust_remote_code=True,
        truncate_dim=dimensions,
    )
    available = set(getattr(_model, "prompts", {}) or {})
    _query_prompt = _resolve_prompt(available, _QUERY_PROMPT_CANDIDATES)
    _doc_prompt = _resolve_prompt(available, _DOC_PROMPT_CANDIDATES)
    logger.info(
        "loaded %s on %s in %.1fs (dims=%d, query_prompt=%r, doc_prompt=%r)",
        model_id,
        _device,
        time.perf_counter() - started,
        dimensions,
        _query_prompt,
        _doc_prompt,
    )


def _load_reranker() -> None:
    global _reranker, _reranker_batch_size
    model_id = os.getenv("RERANKER_MODEL", DEFAULT_RERANKER_MODEL)
    _reranker_batch_size = int(
        os.getenv("RERANKER_BATCH_SIZE", str(DEFAULT_RERANKER_BATCH_SIZE))
    )
    started = time.perf_counter()
    _reranker = CrossEncoder(model_id, device=_device, trust_remote_code=True)
    logger.info(
        "loaded %s on %s in %.1fs",
        model_id,
        _device,
        time.perf_counter() - started,
    )


@app.on_event("startup")
def _load_models() -> None:
    _load_embedder()
    _load_reranker()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    cuda = torch.cuda.is_available()
    device_name = None
    if cuda:
        try:
            device_name = torch.cuda.get_device_name(0)
        except Exception:  # device name lookup can fail on some backends
            device_name = None
    return HealthResponse(
        status="ok",
        model=os.getenv("EMBEDDING_MODEL", DEFAULT_MODEL),
        dimensions=int(os.getenv("EMBEDDING_DIMENSIONS", str(DEFAULT_DIMENSIONS))),
        device=_device,
        cuda_available=cuda,
        device_name=device_name,
        torch_version=torch.__version__,
        loaded=_model is not None,
        reranker_model=os.getenv("RERANKER_MODEL", DEFAULT_RERANKER_MODEL),
        reranker_loaded=_reranker is not None,
    )


@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest) -> EmbedResponse:
    if _model is None:
        raise HTTPException(status_code=503, detail="model not loaded")
    started = time.perf_counter()
    clipped = [text[:MAX_TEXT_CHARS] for text in request.texts]
    kwargs = {
        "batch_size": int(os.getenv("EMBEDDING_BATCH_SIZE", str(DEFAULT_BATCH_SIZE))),
        "normalize_embeddings": True,
        "show_progress_bar": False,
    }
    prompt = _query_prompt if request.is_query else _doc_prompt
    if prompt:
        kwargs["prompt_name"] = prompt
    try:
        vectors = _model.encode(clipped, **kwargs)
    except Exception as exc:  # provider-side failures are 5xx, not crashes
        logger.exception("embed prediction failed")
        raise HTTPException(status_code=500, detail=f"embed failed: {exc}") from exc
    embeddings = [v.tolist() for v in vectors]
    logger.info(
        "embedded %d texts (%s) in %.1fs",
        len(embeddings),
        "query" if request.is_query else "passage",
        time.perf_counter() - started,
    )
    return EmbedResponse(embeddings=embeddings)


@app.post("/rerank", response_model=RerankResponse)
def rerank(request: RerankRequest) -> RerankResponse:
    if _reranker is None:
        raise HTTPException(status_code=503, detail="model not loaded")
    started = time.perf_counter()
    clipped = [passage[:MAX_PASSAGE_CHARS] for passage in request.passages]
    pairs = [(request.query, passage) for passage in clipped]
    try:
        scores = _reranker.predict(pairs, batch_size=_reranker_batch_size)
    except Exception as exc:  # provider-side failures are 5xx, not crashes
        logger.exception("rerank prediction failed")
        raise HTTPException(status_code=500, detail=f"rerank failed: {exc}") from exc
    order = sorted(range(len(scores)), key=lambda i: -float(scores[i]))
    return RerankResponse(
        indices=order,
        scores=[float(scores[i]) for i in order],
        latency_ms=(time.perf_counter() - started) * 1000.0,
    )
