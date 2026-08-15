"""Reranker client tests: typed errors, retries, and passthrough behavior.

Follows rule 22: failures normalize into stable IngestionError codes
(provider_timeout for abort-shaped, provider_unavailable for network-shaped
and non-2xx responses), the retryable classification survives wrapping, and
callers never see raw httpx exceptions.
"""

from __future__ import annotations

import httpx
import pytest

from app.ingestion.models import IngestionError
from app.rerank import RerankerClient


def _handler(status: int = 200, body: dict | None = None) -> httpx.MockTransport:
    payload = body if body is not None else {"indices": [2, 0, 1]}
    return httpx.MockTransport(
        lambda request: httpx.Response(status, json=payload)
    )


def _client(transport: httpx.MockTransport) -> RerankerClient:
    return RerankerClient(
        "http://reranker.test",
        sleep_fn=lambda seconds: None,
        random_fn=lambda: 0.5,
        timeout_seconds=5.0,
        client=httpx.Client(transport=transport),
    )


def test_rerank_returns_top_k_indices() -> None:
    client = _client(_handler(body={"indices": [5, 3, 9, 1, 7]}))
    assert client.rerank("q", ["a", "b", "c"], top_k=3) == [5, 3, 9]


def test_rerank_empty_passages_returns_empty() -> None:
    client = _client(_handler())
    assert client.rerank("q", [], top_k=3) == []


def test_rerank_missing_indices_raises_terminal_error() -> None:
    client = _client(_handler(body={"scores": [1.0]}))
    with pytest.raises(IngestionError) as excinfo:
        client.rerank("q", ["a"], top_k=3)
    assert excinfo.value.code == "provider_unavailable"
    assert not excinfo.value.retryable


def test_rerank_retries_then_succeeds() -> None:
    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        if calls["count"] < 3:
            return httpx.Response(503, json={"detail": "transient"})
        return httpx.Response(200, json={"indices": [1, 0]})

    client = _client(httpx.MockTransport(handler))
    assert client.rerank("q", ["a", "b"], top_k=2) == [1, 0]
    assert calls["count"] == 3


def test_rerank_exhausts_retries_on_5xx() -> None:
    client = _client(_handler(status=503, body={"detail": "busy"}))
    with pytest.raises(IngestionError) as excinfo:
        client.rerank("q", ["a"], top_k=3)
    assert excinfo.value.code == "provider_unavailable"
    assert excinfo.value.retryable


def test_rerank_timeout_is_provider_timeout_and_retryable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out")

    client = _client(httpx.MockTransport(handler))
    with pytest.raises(IngestionError) as excinfo:
        client.rerank("q", ["a"], top_k=3)
    assert excinfo.value.code == "provider_timeout"
    assert excinfo.value.retryable
