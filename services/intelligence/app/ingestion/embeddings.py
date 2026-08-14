"""Embedding adapters.

The production adapter calls Gemini `gemini-embedding-001` and L2-normalizes
every vector before it reaches storage (approved #8 decision). Tests inject
deterministic doubles; the retry matrix follows the contract's failure table.
"""

from __future__ import annotations

import math
import time
from collections.abc import Callable
from typing import Protocol

import httpx

from .models import IngestionError

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768
DEFAULT_BATCH_SIZE = 100
EMBEDDING_TIMEOUT_SECONDS = 10.0
_MAX_RETRIES = 2
_RETRY_DELAYS_MS = (250, 1000)


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


def l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0.0:
        raise IngestionError("internal_error", "zero vector cannot be normalized")
    return [value / norm for value in vector]


def _parse_embedding(payload: dict) -> list[float]:
    # batchEmbedContents returns {"embeddings": [{"values": [...]}]};
    # embedContent returns {"embedding": {"values": [...]}}. Accept both.
    if isinstance(payload.get("values"), list):
        values = payload["values"]
    else:
        try:
            values = payload["embedding"]["values"]
        except (KeyError, TypeError) as exc:
            raise IngestionError("malformed_output", "embedding response missing values") from exc
    if not isinstance(values, list) or len(values) != EMBEDDING_DIMENSIONS:
        raise IngestionError("malformed_output", "embedding has wrong dimensions")
    try:
        parsed = [float(value) for value in values]
    except (TypeError, ValueError) as exc:
        raise IngestionError("malformed_output", "embedding contains non-numeric values") from exc
    if not all(math.isfinite(value) for value in parsed):
        raise IngestionError("malformed_output", "embedding contains non-finite values")
    return parsed


class GeminiEmbedder:
    """Batch embedder backed by the Gemini REST API."""

    def __init__(
        self,
        api_key: str,
        *,
        model: str = EMBEDDING_MODEL,
        client: httpx.Client | None = None,
        timeout_seconds: float = EMBEDDING_TIMEOUT_SECONDS,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._timeout = timeout_seconds
        self._client = client
        self._sleep = sleep_fn

    def _post(self, url: str, payload: dict) -> dict:
        client = self._client or httpx.Client(timeout=self._timeout)
        try:
            response = client.post(
                url,
                json=payload,
                headers={"x-goog-api-key": self._api_key},
            )
        except httpx.TimeoutException as exc:
            raise IngestionError(
                "provider_timeout", "embedding request timed out", retryable=True
            ) from exc
        except httpx.HTTPError as exc:
            raise IngestionError(
                "provider_unavailable", "embedding request failed", retryable=True
            ) from exc
        finally:
            if self._client is None:
                client.close()
        if response.status_code == 429:
            raise IngestionError("quota_exhausted", "embedding quota exhausted", retryable=False)
        if response.status_code >= 500:
            raise IngestionError("provider_unavailable", "embedding provider error", retryable=True)
        if response.status_code >= 400:
            raise IngestionError(
                "provider_unavailable", "embedding request rejected", retryable=False
            )
        try:
            return response.json()
        except ValueError as exc:
            raise IngestionError("malformed_output", "embedding response is not json") from exc

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}"
            ":batchEmbedContents"
        )
        request = {
            "requests": [
                {
                    "model": f"models/{self._model}",
                    "content": {"parts": [{"text": text}]},
                    # Without an explicit dimensionality, batchEmbedContents
                    # returns the model default (3072 for gemini-embedding-001),
                    # which would not fit the halfvec(768) schema.
                    "outputDimensionality": EMBEDDING_DIMENSIONS,
                }
                for text in texts
            ]
        }
        last_error: IngestionError | None = None
        for attempt in range(_MAX_RETRIES + 1):
            try:
                payload = self._post(url, request)
                break
            except IngestionError as exc:
                if not exc.retryable or attempt >= _MAX_RETRIES:
                    raise
                last_error = exc
                self._sleep(_RETRY_DELAYS_MS[attempt] / 1000.0)
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
        return [l2_normalize(_parse_embedding(item)) for item in embeddings]
