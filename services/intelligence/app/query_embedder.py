"""Shared query-embedder factory.

Ingestion (chunk) and retrieval (query) must be in the same embedding
space. The factory reuses the worker's ``SidecarEmbedder``/``GeminiEmbedder``
classes so there is exactly one provider selector (``EMBEDDING_PROVIDER``,
D-B). The query side passes ``is_query=True`` so the Qwen prompt is the
``query`` prompt (``embeddings_sidecar.py:47-49,114-144``).
"""

from __future__ import annotations

import os

import httpx

from app.ingestion.embeddings import GeminiEmbedder
from app.ingestion.embeddings_sidecar import DEFAULT_URL as SIDECAR_DEFAULT
from app.ingestion.embeddings_sidecar import SidecarEmbedder


def get_embedder(
    client: httpx.Client | None = None,
    token_counter=None,
):
    """Return the chunk/query embedder selected by EMBEDDING_PROVIDER (D-B)."""
    provider = os.getenv("EMBEDDING_PROVIDER", "gemini").strip().lower()
    if provider in ("sidecar", "qwen-sidecar"):
        return SidecarEmbedder(
            base_url=os.getenv("EMBEDDER_URL", SIDECAR_DEFAULT),
            client=client,
            token_counter=token_counter,
        )
    if provider == "gemini":
        return GeminiEmbedder(
            api_key=os.getenv("GEMINI_API_KEY", "").strip(),
            client=client,
            token_counter=token_counter,
        )
    raise SystemExit(f"unknown EMBEDDING_PROVIDER: {provider}")


def embed_queries(
    texts: list[str],
    client: httpx.Client | None = None,
    token_counter=None,
) -> list[list[float] | None]:
    """Embed user queries with the provider's query prompt/taskType."""
    embedder = get_embedder(client=client, token_counter=token_counter)
    # Sidecar honours is_query; Gemini honours taskType=retrieval_query internally.
    if hasattr(embedder, "embed"):
        try:
            # SidecarEmbedder supports is_query kwarg
            return embedder.embed(texts, is_query=True)  # type: ignore[call-arg,arg-type]
        except TypeError:
            return embedder.embed(texts)
    return embedder.embed(texts)


def embed_chunks(
    texts: list[str],
    client: httpx.Client | None = None,
    token_counter=None,
) -> list[list[float] | None]:
    """Embed chunk passages (is_query=False for sidecar)."""
    embedder = get_embedder(client=client, token_counter=token_counter)
    try:
        return embedder.embed(texts, is_query=False)  # type: ignore[call-arg,arg-type]
    except TypeError:
        return embedder.embed(texts)
