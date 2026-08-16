"""Embedding adapters.

The production adapter calls Gemini `gemini-embedding-001` and L2-normalizes
every vector before it reaches storage (approved #8 decision). Tests inject
deterministic doubles; the retry matrix follows the contract's failure table.
"""

from __future__ import annotations

import logging
import math
import random
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

import httpx

from .models import IngestionError
from .telemetry import outcome_for_error_code

logger = logging.getLogger("ingestion.embeddings")

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768
DEFAULT_BATCH_SIZE = 100
EMBEDDING_TIMEOUT_SECONDS = 10.0
_MAX_RETRIES = 2
_BASE_RETRY_DELAY_MS = 250.0
_MAX_RETRY_SLEEP_SECONDS = 60.0


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> list[list[float] | None]: ...


@dataclass(frozen=True)
class EmbeddingStats:
    """Outcome of one batchEmbedContents call, reported to the observer."""

    texts_count: int
    tokens: int
    latency_ms: float
    attempts: int
    outcome: str


class EmbeddingObserver(Protocol):
    def on_completed(self, stats: EmbeddingStats) -> None: ...


def l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0.0:
        raise IngestionError("internal_error", "zero vector cannot be normalized")
    return [value / norm for value in vector]


def _parse_vector_values(values: object) -> list[float]:
    if not isinstance(values, list) or len(values) != EMBEDDING_DIMENSIONS:
        raise IngestionError("malformed_output", "embedding has wrong dimensions")
    try:
        parsed = [float(value) for value in values]
    except (TypeError, ValueError) as exc:
        raise IngestionError("malformed_output", "embedding contains non-numeric values") from exc
    if not all(math.isfinite(value) for value in parsed):
        raise IngestionError("malformed_output", "embedding contains non-finite values")
    return parsed


def _parse_embedding(payload: dict) -> list[float]:
    # batchEmbedContents returns {"embeddings": [{"values": [...]}]}; this
    # adapter only ever calls the batch endpoint, so the single-embed shape is
    # not accepted.
    try:
        values = payload["values"]
    except (KeyError, TypeError) as exc:
        raise IngestionError("malformed_output", "embedding response missing values") from exc
    return _parse_vector_values(values)


def _parse_retry_after(response: httpx.Response) -> float | None:
    value = response.headers.get("retry-after")
    if not value:
        return None
    try:
        seconds = float(value)
    except ValueError:
        return None
    return max(0.0, seconds)


def _is_rate_limit_error(response: httpx.Response) -> bool:
    # Per-minute quotas are transient and carry a "rate limit" hint; daily or
    # project quotas are terminal and mention the plan/billing instead.
    try:
        body = response.json()
    except ValueError:
        return False
    message = (body.get("error") or {}).get("message") or ""
    return "rate limit" in message.lower()


class GeminiEmbedder:
    """Batch embedder backed by the Gemini REST API.

    Retry budget: a batch is retried up to `_MAX_RETRIES` times with
    full-jitter exponential backoff (honoring the server `Retry-After` when
    the provider sends one), and the worker's pgmq stage allows up to
    `max_deliveries` redeliveries per message. A provider outage can therefore
    touch the same chunks up to (_MAX_RETRIES + 1) * max_deliveries times.
    `rate_limited` and `provider_unavailable` are retryable;
    `quota_exhausted`, `provider_credentials`, and client-side failures are
    terminal. Every call reports `EmbeddingStats` (latency, attempts, tokens,
    outcome) to the optional observer; telemetry is best-effort and never
    fails the embed.
    """

    # Identifier written into materials.embedding_provider when a material is
    # embedded by this adapter. The worker refuses to mix providers on a
    # material, because vectors from different models do not share a space.
    provider_name = "gemini"
    telemetry_model = EMBEDDING_MODEL

    def __init__(
        self,
        api_key: str,
        *,
        model: str = EMBEDDING_MODEL,
        client: httpx.Client | None = None,
        timeout_seconds: float = EMBEDDING_TIMEOUT_SECONDS,
        sleep_fn: Callable[[float], None] = time.sleep,
        random_fn: Callable[[float, float], float] = random.uniform,
        token_counter: Callable[[str], int] | None = None,
        observer: EmbeddingObserver | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._timeout = timeout_seconds
        self._client = client
        self._sleep = sleep_fn
        self._random = random_fn
        self._token_counter = token_counter
        self.observer = observer

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
            retry_after = _parse_retry_after(response)
            if retry_after is not None or _is_rate_limit_error(response):
                raise IngestionError(
                    "rate_limited",
                    "embedding rate limit exceeded",
                    retryable=True,
                    retry_after=retry_after,
                )
            raise IngestionError("quota_exhausted", "embedding quota exhausted", retryable=False)
        if response.status_code in (401, 403):
            raise IngestionError(
                "provider_credentials", "embedding credential rejected", retryable=False
            )
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

    def _retry_delay(self, error: IngestionError, attempt: int) -> float:
        if error.retry_after is not None:
            return min(error.retry_after, _MAX_RETRY_SLEEP_SECONDS)
        cap_ms = min(
            _BASE_RETRY_DELAY_MS * (2**attempt), _MAX_RETRY_SLEEP_SECONDS * 1000.0
        )
        return self._random(0.0, cap_ms / 1000.0)

    def embed(self, texts: list[str]) -> list[list[float] | None]:
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
        started = time.perf_counter()
        attempts = 0
        outcome = "ok"
        try:
            last_error: IngestionError | None = None
            for attempt in range(_MAX_RETRIES + 1):
                attempts += 1
                try:
                    payload = self._post(url, request)
                    break
                except IngestionError as exc:
                    if not exc.retryable or attempt >= _MAX_RETRIES:
                        raise
                    last_error = exc
                    self._sleep(self._retry_delay(exc, attempt))
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
                vector = _parse_embedding(item)
                try:
                    vectors.append(l2_normalize(vector))
                except IngestionError as exc:
                    # A zero vector is provider garbage for one chunk, not a
                    # pipeline failure: the worker flags the chunk and keeps the
                    # rest of the material moving. Any other normalization error
                    # still fails the material.
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
