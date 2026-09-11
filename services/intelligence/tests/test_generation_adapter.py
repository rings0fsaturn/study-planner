from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from openai import APIConnectionError, APIError, APIStatusError, APITimeoutError

import app.generation.openrouter_client as adapter_module
from app.generation.openrouter_client import OpenRouterGenerationClient
from app.generation.prompts import mcq_schema

# Adapter tests only need a representative schema; the worker binds the real one
# to its retrieved chunk ids (see `test_generation_worker.py`).
MCQ_SCHEMA = mcq_schema({"c1"})

VALID_MCQ = {
    "stem": "What is the planning gap?",
    "options": ["A shortfall", "A surplus", "A budget", "A deadline"],
    "correctIndex": 0,
    "difficulty": 3,
    "skillTags": ["Strategic Planning"],
    "citations": [{"chunkId": "c1", "quote": "the planning gap is a shortfall"}],
}


class FakeClient:
    """OpenAI-shaped double recording every call; responses are queued."""

    def __init__(self, responses: list[Any]) -> None:
        self._responses = list(responses)
        self.calls: list[dict] = []
        self._chat = _FakeChat(self)

    @property
    def chat(self):
        return self._chat

    def _next(self, kwargs: dict) -> Any:
        self.calls.append(kwargs)
        item = self._responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return _RawResponse(json.dumps(item))


class _RawResponse:
    def __init__(self, text: str) -> None:
        self.text = text


class _FakeChat:
    def __init__(self, fake: FakeClient) -> None:
        self._fake = fake

    @property
    def completions(self):
        return _FakeCompletions(self._fake)


class _FakeCompletions:
    def __init__(self, fake: FakeClient) -> None:
        self._fake = fake

    @property
    def with_raw_response(self):
        return _FakeRaw(self._fake)


class _FakeRaw:
    def __init__(self, fake: FakeClient) -> None:
        self._fake = fake

    def create(self, **kwargs: Any) -> _RawResponse:
        return self._fake._next(kwargs)


@pytest.fixture
def fake(monkeypatch: pytest.MonkeyPatch):
    client = FakeClient([])
    monkeypatch.setattr(adapter_module, "OpenAI", lambda **kwargs: client)
    monkeypatch.setattr(adapter_module.time, "sleep", lambda seconds: seconds)
    return client


def _client() -> OpenRouterGenerationClient:
    return OpenRouterGenerationClient(api_key="test-key")


def _body(
    content: str | None = None,
    finish: str = "stop",
    refusal: str | None = None,
    native: str | None = None,
    usage: dict | None = None,
    provider: str = "Phala",
) -> dict:
    message: dict[str, Any] = {}
    if content is not None:
        message["content"] = content
    if refusal is not None:
        message["refusal"] = refusal
    return {
        "choices": [{"message": message, "finish_reason": finish, "native_finish_reason": native}],
        "usage": usage or {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
        "provider": provider,
    }


def _status_error(status: int, message: str, headers: dict | None = None) -> APIStatusError:
    response = httpx.Response(
        status, request=httpx.Request("POST", "http://test"), headers=headers or {}
    )
    return APIStatusError(message, response=response, body=None)


def test_ok_outcome_normalizes_envelope(fake: FakeClient) -> None:
    fake._responses.append(
        _body(
            content=json.dumps(VALID_MCQ),
            usage={
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15,
                "completion_tokens_details": {"reasoning_tokens": 2},
            },
        )
    )
    response = _client().generate(
        [{"role": "user", "content": "hi"}], MCQ_SCHEMA, request_id="req-1", correlation_id="corr-1"
    )
    assert response.outcome == "ok"
    assert response.content == json.dumps(VALID_MCQ)
    assert response.structured_output == VALID_MCQ
    assert response.finish_reason == "stop"
    assert response.native_finish_reason is None
    assert response.routed_provider == "Phala"
    assert response.error is None
    assert response.usage == {
        "prompt_tokens": 10,
        "completion_tokens": 5,
        "total_tokens": 15,
        "reasoning_tokens": 2,
    }
    assert response.latency_ms >= 0


def test_request_kwargs_match_d08_locks(fake: FakeClient) -> None:
    fake._responses.append(_body(content=json.dumps(VALID_MCQ)))
    _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    kwargs = fake.calls[0]
    assert kwargs["model"] == "deepseek/deepseek-v4-flash-0731"
    assert kwargs["max_tokens"] == 4096
    assert kwargs["temperature"] == 0.3
    assert kwargs["timeout"] == 30.0
    assert "seed" not in kwargs
    assert "top_p" not in kwargs
    assert kwargs["response_format"] == {
        "type": "json_schema",
        "json_schema": {"name": "grounded_mcq", "strict": True, "schema": MCQ_SCHEMA},
    }
    assert kwargs["extra_body"] == {
        "provider": {"require_parameters": True},
        "reasoning": {"enabled": False},
    }


def test_stop_with_schema_invalid_json_is_malformed(fake: FakeClient) -> None:
    invalid = {**VALID_MCQ, "options": ["a", "b", "c"]}
    fake._responses.append(_body(content=json.dumps(invalid)))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert response.outcome == "malformed_output"
    assert response.structured_output == invalid


def test_stop_with_unparseable_content_is_malformed(fake: FakeClient) -> None:
    fake._responses.append(_body(content="not-json"))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert response.outcome == "malformed_output"
    assert response.structured_output is None


def test_length_finish_is_malformed(fake: FakeClient) -> None:
    fake._responses.append(_body(content='{"stem": "truncated', finish="length", native="length"))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert response.outcome == "malformed_output"
    assert response.finish_reason == "length"


def test_content_filter_is_safety_block(fake: FakeClient) -> None:
    fake._responses.append(_body(content="", finish="content_filter"))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert response.outcome == "safety_block"
    assert response.error["code"] == "safety_block"
    assert response.error["retryable"] is False


def test_refusal_is_safety_block(fake: FakeClient) -> None:
    fake._responses.append(_body(content=None, refusal="I cannot help with that."))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert response.outcome == "safety_block"
    assert response.refusal == "I cannot help with that."
    assert response.error["code"] == "safety_block"


def test_null_content_is_safety_block(fake: FakeClient) -> None:
    fake._responses.append(_body(content=None, finish="stop"))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert response.outcome == "safety_block"


def test_error_finish_is_provider_error(fake: FakeClient) -> None:
    fake._responses.append(_body(content=None, finish="error"))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert response.outcome == "provider_error"


def test_unknown_finish_is_provider_error(fake: FakeClient) -> None:
    fake._responses.append(_body(content="x", finish="weird"))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert response.outcome == "provider_error"


def test_429_retries_once_with_retry_after_capped_then_quota_failure(
    fake: FakeClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr(adapter_module.time, "sleep", lambda seconds: sleeps.append(seconds))
    fake._responses.append(_status_error(429, "rate limited", headers={"retry-after": "120"}))
    fake._responses.append(_status_error(429, "rate limited", headers={"retry-after": "30"}))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert len(fake.calls) == 2
    assert sleeps == [60.0]  # capped at MAX_RETRY_AFTER_SECONDS
    assert response.outcome == "quota_failure"
    assert response.error == {
        "code": "quota_exhausted",
        "message": "rate limited",
        "retryable": False,
        "requestId": "",
        "correlationId": "",
        "retryAfterSeconds": 30,
    }


def test_429_recovers_on_second_attempt(fake: FakeClient) -> None:
    fake._responses.append(_status_error(429, "slow down", headers={"retry-after": "1"}))
    fake._responses.append(_body(content=json.dumps(VALID_MCQ)))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert len(fake.calls) == 2
    assert response.outcome == "ok"


def test_400_effort_message_is_unsupported_request_no_retry(fake: FakeClient) -> None:
    fake._responses.append(_status_error(400, "reasoning effort not supported by this model tier"))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert len(fake.calls) == 1
    assert response.outcome == "provider_error"
    assert response.error["code"] == "unsupported_request"
    assert response.error["retryable"] is False


def test_401_is_provider_credentials_no_retry(fake: FakeClient) -> None:
    fake._responses.append(_status_error(401, "invalid api key"))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert len(fake.calls) == 1
    assert response.outcome == "provider_error"
    assert response.error["code"] == "provider_credentials"


def test_5xx_retries_once_then_provider_unavailable(fake: FakeClient) -> None:
    fake._responses.append(_status_error(503, "upstream busy"))
    fake._responses.append(_status_error(503, "upstream busy"))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert len(fake.calls) == 2
    assert response.outcome == "provider_error"
    assert response.error["code"] == "provider_unavailable"
    assert response.error["retryable"] is True


def test_5xx_recovers_on_second_attempt(fake: FakeClient) -> None:
    fake._responses.append(_status_error(500, "boom"))
    fake._responses.append(_body(content=json.dumps(VALID_MCQ)))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert len(fake.calls) == 2
    assert response.outcome == "ok"


def test_timeout_retries_once_then_provider_timeout(fake: FakeClient) -> None:
    request = httpx.Request("POST", "http://test")
    fake._responses.append(APITimeoutError(request=request))
    fake._responses.append(APITimeoutError(request=request))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert len(fake.calls) == 2
    assert response.outcome == "timeout"
    assert response.error["code"] == "provider_timeout"
    assert response.error["retryable"] is True


def test_connection_error_retries_then_provider_unavailable(fake: FakeClient) -> None:
    request = httpx.Request("POST", "http://test")
    fake._responses.append(APIConnectionError(request=request))
    fake._responses.append(APIConnectionError(request=request))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert len(fake.calls) == 2
    assert response.error["code"] == "provider_unavailable"
    assert response.error["retryable"] is True


def test_generic_api_error_is_provider_error(fake: FakeClient) -> None:
    request = httpx.Request("POST", "http://test")
    fake._responses.append(APIError("mystery failure", request=request, body=None))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA)
    assert response.outcome == "provider_error"
    assert "mystery failure" in response.error["message"]


def test_repair_flag_is_adapter_detail_not_a_kwarg(fake: FakeClient) -> None:
    fake._responses.append(_body(content=json.dumps(VALID_MCQ)))
    response = _client().generate([{"role": "user", "content": "hi"}], MCQ_SCHEMA, repair=True)
    assert response.outcome == "ok"
    assert "repair" not in fake.calls[0]
