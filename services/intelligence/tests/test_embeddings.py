from __future__ import annotations

import math

import httpx
import pytest

from app.ingestion.embeddings import (
    EMBEDDING_DIMENSIONS,
    GeminiEmbedder,
    l2_normalize,
)
from app.ingestion.models import IngestionError


def _embedding_response(vectors: list[list[float]]) -> dict:
    return {
        "embeddings": [
            {"values": vector, "dimension": EMBEDDING_DIMENSIONS}
            for vector in vectors
        ]
    }


def _make_vectors(count: int) -> list[list[float]]:
    return [
        [1.0 + index * 0.001 + dim * 0.0001 for dim in range(EMBEDDING_DIMENSIONS)]
        for index in range(count)
    ]


def test_l2_normalize_produces_unit_vectors() -> None:
    vector = l2_normalize([3.0, 4.0])
    assert vector == pytest.approx([0.6, 0.8])


def test_l2_normalize_rejects_zero_vectors() -> None:
    with pytest.raises(IngestionError) as exc_info:
        l2_normalize([0.0, 0.0])
    assert exc_info.value.code == "internal_error"


def test_gemini_embedder_returns_normalized_vectors() -> None:
    vectors = _make_vectors(2)

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("batchEmbedContents")
        return httpx.Response(200, json=_embedding_response(vectors))

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(api_key="test-key", client=client)
    result = embedder.embed(["first", "second"])
    assert len(result) == 2
    for vector in result:
        norm = math.sqrt(sum(value * value for value in vector))
        assert norm == pytest.approx(1.0, abs=1e-9)


def test_gemini_embedder_quota_is_terminal() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(429, json={"error": {"message": "quota"}})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(api_key="test-key", client=client)
    with pytest.raises(IngestionError) as exc_info:
        embedder.embed(["text"])
    assert exc_info.value.code == "quota_exhausted"
    assert not exc_info.value.retryable
    assert calls == 1


def test_gemini_embedder_retries_transient_failures_then_fails() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(503, json={})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(api_key="test-key", client=client)
    with pytest.raises(IngestionError) as exc_info:
        embedder.embed(["text"])
    assert exc_info.value.code == "provider_unavailable"
    assert exc_info.value.retryable
    assert calls == 3  # initial + 2 retries


def test_gemini_embedder_timeout_is_normalized() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("slow")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(api_key="test-key", client=client)
    with pytest.raises(IngestionError) as exc_info:
        embedder.embed(["text"])
    assert exc_info.value.code == "provider_timeout"
    assert exc_info.value.retryable


def test_gemini_embedder_malformed_shape_is_rejected() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"embeddings": [{"values": [1.0, 2.0]}]})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(api_key="test-key", client=client)
    with pytest.raises(IngestionError) as exc_info:
        embedder.embed(["text"])
    assert exc_info.value.code == "malformed_output"


def test_gemini_embedder_count_mismatch_is_rejected() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_embedding_response(_make_vectors(1)))

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(api_key="test-key", client=client)
    with pytest.raises(IngestionError) as exc_info:
        embedder.embed(["one", "two"])
    assert exc_info.value.code == "malformed_output"


def test_gemini_embedder_empty_input_makes_no_request() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("no request should be made for an empty batch")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(api_key="test-key", client=client)
    assert embedder.embed([]) == []


def test_gemini_embedder_request_contract() -> None:
    captured: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(
            {
                "url": str(request.url),
                "method": request.method,
                "key": request.headers.get("x-goog-api-key"),
                "body": request.content.decode(),
            }
        )
        return httpx.Response(200, json=_embedding_response(_make_vectors(2)))

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(api_key="test-key", client=client)
    embedder.embed(["alpha", "beta"])

    assert len(captured) == 1
    request = captured[0]
    assert request["method"] == "POST"
    assert request["url"].endswith(
        "/v1beta/models/gemini-embedding-001:batchEmbedContents"
    )
    assert request["key"] == "test-key"
    import json

    body = json.loads(request["body"])
    requests = body["requests"]
    assert len(requests) == 2
    for item, text in zip(requests, ["alpha", "beta"]):
        assert item["model"] == "models/gemini-embedding-001"
        assert item["outputDimensionality"] == EMBEDDING_DIMENSIONS
        assert item["content"]["parts"] == [{"text": text}]


def test_gemini_embedder_non_numeric_values_are_malformed() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={"embeddings": [{"values": ["not-a-number"] * EMBEDDING_DIMENSIONS}]},
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(api_key="test-key", client=client)
    with pytest.raises(IngestionError) as exc_info:
        embedder.embed(["text"])
    assert exc_info.value.code == "malformed_output"


def test_gemini_embedder_non_finite_values_are_malformed() -> None:
    import json as json_lib

    raw = json_lib.dumps(
        {"embeddings": [{"values": [float("nan")] * EMBEDDING_DIMENSIONS}]},
        allow_nan=True,
    )

    def handler(request: httpx.Request) -> httpx.Response:
        headers = {"content-type": "application/json"}
        return httpx.Response(200, content=raw.encode(), headers=headers)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(api_key="test-key", client=client)
    with pytest.raises(IngestionError) as exc_info:
        embedder.embed(["text"])
    assert exc_info.value.code == "malformed_output"


def test_gemini_embedder_400_is_non_retryable() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(400, json={"error": {"message": "bad request"}})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(api_key="test-key", client=client)
    with pytest.raises(IngestionError) as exc_info:
        embedder.embed(["text"])
    assert exc_info.value.code == "provider_unavailable"
    assert not exc_info.value.retryable
    assert calls == 1


def test_gemini_embedder_invalid_json_is_malformed() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"not json at all")

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(api_key="test-key", client=client)
    with pytest.raises(IngestionError) as exc_info:
        embedder.embed(["text"])
    assert exc_info.value.code == "malformed_output"


def test_gemini_embedder_retries_use_injected_sleep() -> None:
    calls = 0
    sleeps: list[float] = []

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(503, json={})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    embedder = GeminiEmbedder(
        api_key="test-key",
        client=client,
        sleep_fn=sleeps.append,
    )
    with pytest.raises(IngestionError) as exc_info:
        embedder.embed(["text"])
    assert exc_info.value.code == "provider_unavailable"
    assert exc_info.value.retryable
    assert calls == 3
    assert sleeps == pytest.approx([0.25, 1.0])
