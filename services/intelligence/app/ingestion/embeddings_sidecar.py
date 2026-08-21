"""Embedding adapter backed by the local Docker embedder sidecar.

The sidecar (`services/embedder/`) loads Qwen3-Embedding-0.6B on a ROCm GPU
and serves `POST /embed` with `{"texts": [...], "is_query": bool}` returning
`{"embeddings": [[...]]}`. The adapter mirrors the Gemini adapter contract:
same normalization, same zero-vector-to-None semantics, same retry budget,
same telemetry, and the same stable `IngestionError` codes (rule 22). The
provider is pluggable at the worker entrypoint, so swapping Gemini for the
local sidecar (or any future provider) never touches the worker stages.
"""

from __future__ import annotations

import logging
import os
import random
import time
from collections.abc import Callable

import httpx

from .embeddings import (
    _MAX_RETRIES,
    _MAX_RETRY_SLEEP_SECONDS,
    EMBEDDING_TIMEOUT_SECONDS,
    EmbeddingObserver,
    EmbeddingStats,
    _parse_vector_values,
    l2_normalize,
)
from .models import IngestionError
from .telemetry import outcome_for_error_code

logger = logging.getLogger("ingestion.embeddings_sidecar")

DEFAULT_URL = os.getenv("EMBEDDER_URL", "http://localhost:8200")
_BASE_RETRY_DELAY_MS = 250.0


class SidecarEmbedder:
    """Batch embedder backed by the local sentence-transformers sidecar.

    Retry budget mirrors the Gemini adapter: up to `_MAX_RETRIES` retries with
    full-jitter exponential backoff, then the worker's pgmq redelivery.
    `provider_timeout` and `provider_unavailable` (including the sidecar's 503
    "model not loaded" during cold start) are retryable; non-5xx client
    rejections and malformed responses are terminal. Ingestion always sends
    passage-side requests (`is_query=False`); the flag is exposed so a future
    retrieval flow can embed user questions with the same container.
    """

    # Identifier written into materials.embedding_provider; see
    # GeminiEmbedder.provider_name for the mixing-guard contract.
    provider_name = "qwen-sidecar"
    telemetry_model = "qwen3-embedding-0.6b"

    def __init__(
        self,
        base_url: str = DEFAULT_URL,
        *,
        timeout_seconds: float = EMBEDDING_TIMEOUT_SECONDS,
        sleep_fn: Callable[[float], None] = time.sleep,
        random_fn: Callable[[float, float], float] = random.uniform,
        client: httpx.Client | None = None,
        token_counter: Callable[[str], int] | None = None,
        observer: EmbeddingObserver | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds
        self._sleep = sleep_fn
        self._random = random_fn
        self._client = client
        self._token_counter = token_counter
        self.observer = observer

    def _post(self, payload: dict) -> dict:
        client = self._client or httpx.Client(timeout=self._timeout)
        try:
            response = client.post(f"{self._base_url}/embed", json=payload)
        except httpx.TimeoutException as exc:
            raise IngestionError(
                "provider_timeout", "embedding sidecar request timed out", retryable=True
            ) from exc
        except httpx.HTTPError as exc:
            raise IngestionError(
                "provider_unavailable", f"embedding sidecar request failed: {exc}", retryable=True
            ) from exc
        finally:
            if self._client is None:
                client.close()
        if response.status_code >= 500:
            # The sidecar returns 503 until its model is loaded and 500 when a
            # prediction fails; both are transient and worth a retry.
            raise IngestionError(
                "provider_unavailable",
                f"embedding sidecar responded {response.status_code}: {response.text[:200]}",
                retryable=True,
            )
        if response.status_code >= 400:
            raise IngestionError(
                "provider_unavailable",
                f"embedding sidecar rejected request {response.status_code}: {response.text[:200]}",
                retryable=False,
            )
        try:
            return response.json()
        except ValueError as exc:
            raise IngestionError("malformed_output", "embedding response is not json") from exc

    def _retry_delay(self, attempt: int) -> float:
        cap_ms = min(
            _BASE_RETRY_DELAY_MS * (2**attempt), _MAX_RETRY_SLEEP_SECONDS * 1000.0
        )
        return self._random(0.0, cap_ms / 1000.0)

    def embed(
        self, texts: list[str], is_query: bool = False
    ) -> list[list[float] | None]:
        """Embed one batch of texts; passage-side by default, query-side on request.

        Returns one vector (or `None` for a provider zero vector) per input
        text, positionally aligned. Raises `IngestionError` after retries are
        exhausted; `malformed_output` is terminal.
        """
        if not texts:
            return []
        request = {"texts": texts, "is_query": is_query}
        started = time.perf_counter()
        attempts = 0
        outcome = "ok"
        try:
            last_error: IngestionError | None = None
            for attempt in range(_MAX_RETRIES + 1):
                attempts += 1
                try:
                    payload = self._post(request)
                    break
                except IngestionError as exc:
                    if not exc.retryable or attempt >= _MAX_RETRIES:
                        raise
                    last_error = exc
                    self._sleep(self._retry_delay(attempt))
            else:
                raise last_error  # pragma: no cover - guarded by raise in the loop

            try:
                embeddings = payload["embeddings"]
            except (KeyError, TypeError) as exc:
                raise IngestionError(
                    "malformed_output", "embedding response missing embeddings"
                ) from exc
            if not isinstance(embeddings, list) or len(embeddings) != len(texts):
                raise IngestionError("malformed_output", "embedding count mismatch")
            vectors: list[list[float] | None] = []
            for item in embeddings:
                try:
                    vectors.append(l2_normalize(_parse_vector_values(item)))
                except IngestionError as exc:
                    # Same zero-vector contract as the Gemini adapter: provider
                    # garbage for one chunk becomes None so the worker flags
                    # that chunk and keeps the material moving.
                    if exc.code != "internal_error":
                        raise
                    vectors.append(None)
            return vectors
        except IngestionError as exc:
            outcome = outcome_for_error_code(exc.code)
            raise
        finally:
            self._notify(texts, started, attempts, outcome)

    def _notify(
        self, texts: list[str], started: float, attempts: int, outcome: str
    ) -> None:
        """Report one completed provider call to the observer (best-effort)."""
        if self.observer is None:
            return
        tokens = 0
        if self._token_counter is not None:
            tokens = sum(self._token_counter(text) for text in texts)
        stats = EmbeddingStats(
            texts_count=len(texts),
            tokens=tokens,
            latency_ms=(time.perf_counter() - started) * 1000.0,
            attempts=attempts,
            outcome=outcome,
        )
        try:
            self.observer.on_completed(stats)
        except Exception:
            logger.warning("embedding observer failed", exc_info=True)
