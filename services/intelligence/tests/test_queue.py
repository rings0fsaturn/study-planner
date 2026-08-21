from __future__ import annotations

import json

import httpx
import pytest

from app.ingestion.models import IngestionError
from app.ingestion.queue import SupabaseWorkQueue


def _queue_client() -> tuple[httpx.Client, list[dict]]:
    calls: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append({"method": request.method, "path": request.url.path, "json": request.content})
        return httpx.Response(204, request=request)

    return httpx.Client(transport=httpx.MockTransport(handler)), calls


def test_poll_calls_rpc_wrapper_with_visibility() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        payload = httpx.Response(
            200, json=[{"msg_id": 7, "payload": {"materialId": "m1"}}], request=request
        )
        return payload

    client = httpx.Client(transport=httpx.MockTransport(handler))
    queue = SupabaseWorkQueue("https://example.supabase.co", "service-key", client=client)
    messages = queue.poll("material_extract", visibility_seconds=45)
    assert len(messages) == 1
    assert messages[0].msg_id == 7
    assert messages[0].payload == {"materialId": "m1"}


def test_poll_exact_request_shape_and_auth_headers() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        captured["headers"] = dict(request.headers)
        captured["url"] = str(request.url)
        return httpx.Response(200, json=[], request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    queue = SupabaseWorkQueue("https://example.supabase.co", "service-key", client=client)
    queue.poll("material_extract", visibility_seconds=45)

    assert captured["url"].endswith("/rest/v1/rpc/ingestion_poll")
    assert captured["body"] == {"p_queue": "material_extract", "p_vt": 45, "p_qty": 1}
    headers = captured["headers"]
    assert headers["apikey"] == "service-key"
    assert headers["authorization"] == "Bearer service-key"


def test_poll_passes_bounded_quantity_through() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json=[], request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    queue = SupabaseWorkQueue("https://example.supabase.co", "service-key", client=client)
    queue.poll("material_extract", visibility_seconds=45, quantity=3)

    assert captured["body"] == {"p_queue": "material_extract", "p_vt": 45, "p_qty": 3}


def test_poll_maps_read_ct_and_skips_malformed_rows() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[
                {"msg_id": 7, "read_ct": 3, "payload": {"materialId": "m1"}},
                {"payload": {"materialId": "m2"}},
                "not-a-row",
            ],
            request=request,
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    queue = SupabaseWorkQueue("https://example.supabase.co", "service-key", client=client)
    messages = queue.poll("material_extract")
    assert len(messages) == 1
    assert messages[0].msg_id == 7
    assert messages[0].read_ct == 3


def test_poll_malformed_json_body_is_malformed_output() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"not json at all", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    queue = SupabaseWorkQueue("https://example.supabase.co", "service-key", client=client)
    with pytest.raises(IngestionError) as exc_info:
        queue.poll("material_extract")
    assert exc_info.value.code == "malformed_output"


def test_poll_timeout_is_provider_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("poll timed out", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    queue = SupabaseWorkQueue("https://example.supabase.co", "service-key", client=client)
    with pytest.raises(IngestionError) as exc_info:
        queue.poll("material_extract")
    assert exc_info.value.code == "provider_timeout"
    assert exc_info.value.retryable


def test_send_timeout_is_provider_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("send timed out", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    queue = SupabaseWorkQueue("https://example.supabase.co", "service-key", client=client)
    with pytest.raises(IngestionError) as exc_info:
        queue.send("material_embed", {"materialId": "m1"})
    assert exc_info.value.code == "provider_timeout"
    assert exc_info.value.retryable


def test_complete_posts_success_flag() -> None:
    client, calls = _queue_client()
    queue = SupabaseWorkQueue("https://example.supabase.co", "service-key", client=client)
    queue.complete("material_extract", 7, True)
    queue.complete("material_extract", 8, False)
    assert len(calls) == 2
    assert all(call["path"].endswith("/rpc/ingestion_complete") for call in calls)
    assert b"p_msg_id" in calls[0]["json"] and b"true" in calls[0]["json"]
    assert b"false" in calls[1]["json"]


def test_send_posts_payload_to_rpc_wrapper() -> None:
    client, calls = _queue_client()
    queue = SupabaseWorkQueue("https://example.supabase.co", "service-key", client=client)
    queue.send("material_embed", {"materialId": "m1"})
    assert len(calls) == 1
    assert calls[0]["path"].endswith("/rpc/ingestion_send")
    assert b"material_embed" in calls[0]["json"]


def test_poll_failure_normalizes_to_provider_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    queue = SupabaseWorkQueue("https://example.supabase.co", "service-key", client=client)
    try:
        queue.poll("material_extract")
        raise AssertionError("expected IngestionError")
    except Exception as exc:
        from app.ingestion.models import IngestionError

        assert isinstance(exc, IngestionError)
        assert exc.code == "provider_unavailable"
        assert exc.retryable