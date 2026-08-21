"""Sidecar embedder client tests: typed errors, retries, and contract parity.

The adapter must expose the same stable contract as the Gemini adapter
(rule 22): normalized 768-dim vectors, per-item `None` for provider zero
vectors, `provider_timeout`/`provider_unavailable` retryable classification,
`malformed_output` terminal for bad shapes, and an optional observer. The
sidecar response shape is `{"embeddings": [[...]]}` (flat vectors), unlike
Gemini's `{"embeddings": [{"values": [...]}]}`.
"""

from __future__ import annotations

import json
import math

import httpx
import pytest

from app.ingestion.embeddings import EMBEDDING_DIMENSIONS
from app.ingestion.embeddings_sidecar import SidecarEmbedder
from app.ingestion.models import IngestionError


def _make_vectors(count: int) -> list[list[float]]:
    return [
        [1.0 + index * 0.001 + dim * 0.0001 for dim in range(EMBEDDING_DIMENSIONS)]
        for index in range(count)
    ]


def _sidecar_handler(body: dict | None = None, status: int = 200):
    payload = body if body is not None else {"embeddings": _make_vectors(1)}

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json=payload)

    return handler


def _client(transport: httpx.MockTransport) -> SidecarEmbedder:
    return SidecarEmbedder(
        "http://embedder.test",
        sleep_fn=lambda seconds: None,
        random_fn=lambda low, high: low,
        timeout_seconds=5.0,
        client=httpx.Client(transport=transport),
    )


def test_sidecar_embedder_returns_normalized_vectors() -> None:
    client = _client(httpx.MockTransport(_sidecar_handler({"embeddings": _make_vectors(2)})))
    result = client.embed(["first", "second"])
    assert len(result) == 2
    for vector in result:
        norm = math.sqrt(sum(value * value for value in vector))
        assert norm == pytest.approx(1.0, abs=1e-9)


def test_sidecar_embedder_sends_passage_side_request_by_default() -> None:
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"embeddings": _make_vectors(1)})

    client = _client(httpx.MockTransport(handler))
    client.embed(["passage text"])
    assert seen == [{"texts": ["passage text"], "is_query": False}]


def test_sidecar_embedder_sends_query_side_request_when_requested() -> None:
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"embeddings": _make_vectors(1)})

    client = _client(httpx.MockTransport(handler))
    client.embed(["a question"], is_query=True)
    assert seen == [{"texts": ["a question"], "is_query": True}]


def test_sidecar_embedder_empty_input_makes_no_request() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("no request should be made for an empty batch")

    client = _client(httpx.MockTransport(handler))
    assert client.embed([]) == []


def test_sidecar_embedder_zero_vector_becomes_none() -> None:
    zero = [0.0] * EMBEDDING_DIMENSIONS
    good = _make_vectors(1)[0]
    client = _client(
        httpx.MockTransport(_sidecar_handler({"embeddings": [zero, good]}))
    )
    result = client.embed(["bad", "good"])
    assert result[0] is None
    assert result[1] is not None


def test_sidecar_embedder_wrong_dimensions_are_malformed() -> None:
    client = _client(httpx.MockTransport(_sidecar_handler({"embeddings": [[1.0, 2.0]]})))
    with pytest.raises(IngestionError) as exc_info:
        client.embed(["text"])
    assert exc_info.value.code == "malformed_output"
    assert not exc_info.value.retryable


def test_sidecar_embedder_non_finite_values_are_malformed() -> None:
    import json as json_lib

    vector = [1.0] * EMBEDDING_DIMENSIONS
    vector[0] = float("nan")
    raw = json_lib.dumps({"embeddings": [vector]}, allow_nan=True)

    def handler(request: httpx.Request) -> httpx.Response:
        headers = {"content-type": "application/json"}
        return httpx.Response(200, content=raw.encode(), headers=headers)

    client = _client(httpx.MockTransport(handler))
    with pytest.raises(IngestionError) as exc_info:
        client.embed(["text"])
    assert exc_info.value.code == "malformed_output"


def test_sidecar_embedder_count_mismatch_is_rejected() -> None:
    client = _client(httpx.MockTransport(_sidecar_handler({"embeddings": _make_vectors(1)})))
    with pytest.raises(IngestionError) as exc_info:
        client.embed(["one", "two"])
    assert exc_info.value.code == "malformed_output"


def test_sidecar_embedder_missing_embeddings_is_malformed() -> None:
    client = _client(httpx.MockTransport(_sidecar_handler({"vectors": []})))
    with pytest.raises(IngestionError) as exc_info:
        client.embed(["text"])
    assert exc_info.value.code == "malformed_output"


def test_sidecar_embedder_invalid_json_is_malformed() -> None:
    client = _client(httpx.MockTransport(lambda request: httpx.Response(200, text="nope")))
    with pytest.raises(IngestionError) as exc_info:
        client.embed(["text"])
    assert exc_info.value.code == "malformed_output"


def test_sidecar_embedder_timeout_is_provider_timeout_and_retryable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out")

    client = _client(httpx.MockTransport(handler))
    with pytest.raises(IngestionError) as exc_info:
        client.embed(["text"])
    assert exc_info.value.code == "provider_timeout"
    assert exc_info.value.retryable


def test_sidecar_embedder_5xx_exhausts_retries() -> None:
    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        return httpx.Response(500, json={"detail": "embed failed"})

    client = _client(httpx.MockTransport(handler))
    with pytest.raises(IngestionError) as exc_info:
        client.embed(["text"])
    assert exc_info.value.code == "provider_unavailable"
    assert exc_info.value.retryable
    assert calls["count"] == 3  # initial + 2 retries


def test_sidecar_embedder_503_retries_then_succeeds() -> None:
    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        if calls["count"] < 3:
            return httpx.Response(503, json={"detail": "model not loaded"})
        return httpx.Response(200, json={"embeddings": _make_vectors(1)})

    client = _client(httpx.MockTransport(handler))
    result = client.embed(["text"])
    assert len(result) == 1
    assert calls["count"] == 3


def test_sidecar_embedder_4xx_is_terminal() -> None:
    handler = _sidecar_handler({"detail": "too many texts"}, status=422)
    client = _client(httpx.MockTransport(handler))
    with pytest.raises(IngestionError) as exc_info:
        client.embed(["text"])
    assert exc_info.value.code == "provider_unavailable"
    assert not exc_info.value.retryable


def test_sidecar_embedder_observer_reports_success_stats() -> None:
    class RecordingObserver:
        def __init__(self) -> None:
            self.stats = []

        def on_completed(self, stats) -> None:
            self.stats.append(stats)

    observer = RecordingObserver()
    client = _client(httpx.MockTransport(_sidecar_handler({"embeddings": _make_vectors(2)})))
    client.observer = observer
    client.embed(["alpha", "beta"], is_query=True)
    assert len(observer.stats) == 1
    stats = observer.stats[0]
    assert stats.texts_count == 2
    assert stats.attempts == 1
    assert stats.outcome == "ok"
    assert stats.latency_ms >= 0.0


def test_sidecar_embedder_observer_counts_retry_attempts() -> None:
    class RecordingObserver:
        def __init__(self) -> None:
            self.stats = []

        def on_completed(self, stats) -> None:
            self.stats.append(stats)

    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        if calls["count"] < 3:
            return httpx.Response(503, json={"detail": "cold start"})
        return httpx.Response(200, json={"embeddings": _make_vectors(1)})

    observer = RecordingObserver()
    client = _client(httpx.MockTransport(handler))
    client.observer = observer
    client.embed(["text"])
    assert observer.stats[0].attempts == 3
    assert observer.stats[0].outcome == "ok"
