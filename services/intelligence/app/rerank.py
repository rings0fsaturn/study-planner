"""Typed client for the reranker endpoint of the GPU inference sidecar.

The sidecar (`services/embedder/`) serves `POST /rerank` on the same container
as `/embed` (port 8200): score (query, passage) pairs with a cross-encoder and
return the passage indices reordered by descending relevance.

Error normalization follows rule 22: retries exhaust into stable typed errors,
and raw httpx failures never reach callers. Abort-shaped failures are timeouts;
network-shaped failures are service errors; a non-2xx response is a service
error carrying the sidecar's status code. The client is stateless and cheap to
construct, so it is created per call or injected by FastAPI dependencies.
"""

from __future__ import annotations

import os
from collections.abc import Callable

import httpx

from .ingestion.models import IngestionError

DEFAULT_URL = os.getenv("RERANKER_URL", "http://localhost:8200")
DEFAULT_TIMEOUT_SECONDS = 30.0
_MAX_RETRIES = 2
_BASE_RETRY_DELAY_MS = 250.0


class RerankerClient:
    """HTTP client for the cross-encoder reranker sidecar."""

    def __init__(
        self,
        base_url: str = DEFAULT_URL,
        *,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        sleep_fn: Callable[[float], None] | None = None,
        random_fn: Callable[[], float] | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        import random
        import time

        self._base_url = base_url.rstrip("/")
        self._timeout = timeout_seconds
        self._sleep = sleep_fn or time.sleep
        self._random = random_fn or random.random
        self._client = client

    def _post(self, payload: dict) -> dict:
        client = self._client or httpx.Client(timeout=self._timeout)
        try:
            response = client.post(f"{self._base_url}/rerank", json=payload)
        except httpx.TimeoutException as exc:
            raise IngestionError(
                "provider_timeout", "reranker request timed out", retryable=True
            ) from exc
        except httpx.HTTPError as exc:
            raise IngestionError(
                "provider_unavailable", f"reranker request failed: {exc}", retryable=True
            ) from exc
        finally:
            if self._client is None:
                client.close()
        if response.status_code >= 400:
            raise IngestionError(
                "provider_unavailable",
                f"reranker responded {response.status_code}: {response.text[:200]}",
                retryable=True,
            )
        return response.json()

    def rerank(self, query: str, passages: list[str], top_k: int) -> list[int]:
        """Score (query, passage) pairs and return the top_k passage indices.

        Raises `IngestionError` (provider_timeout | provider_unavailable) after
        retries are exhausted. Passages are passed through unchanged; the
        sidecar clips them to its own length limit.
        """
        if not passages:
            return []
        payload = {"query": query, "passages": passages}
        last_error: IngestionError | None = None
        for attempt in range(_MAX_RETRIES + 1):
            try:
                body = self._post(payload)
                indices = body.get("indices")
                if not isinstance(indices, list):
                    raise IngestionError(
                        "provider_unavailable", "reranker response missing indices", retryable=False
                    )
                return [int(index) for index in indices[:top_k]]
            except IngestionError as exc:
                if not exc.retryable or attempt >= _MAX_RETRIES:
                    raise
                last_error = exc
                delay = (_BASE_RETRY_DELAY_MS * (2**attempt)) / 1000.0
                self._sleep(delay * (0.5 + self._random()))
        raise last_error  # pragma: no cover - guarded by the raise above
