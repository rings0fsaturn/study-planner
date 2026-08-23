"""Neutralized OpenRouter generation adapter (D-08).

DeepSeek via OpenRouter with the OpenAI SDK, `max_retries=0`, exactly one
application-level retry for the retryable classes (rate limit honoring
`Retry-After` capped at 60 s, provider unavailability, provider deadline),
and the D-08 finish-reason/status to outcome mapping. Local schema
validation runs after every response regardless of strict mode.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any

import jsonschema
from openai import (
    APIConnectionError,
    APIError,
    APIStatusError,
    APITimeoutError,
    OpenAI,
)

from app.generation.models import NormalizedGenerationResponse

logger = logging.getLogger("generation.openrouter")

DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731"
MAX_RETRY_AFTER_SECONDS = 60
RETRY_DELAY_SECONDS = 0.25

# finish_reason -> outcome; `stop` is decided after local schema validation.
FINISH_TO_OUTCOME = {
    "length": "malformed_output",
    "content_filter": "safety_block",
    "refusal": "safety_block",
    "error": "provider_error",
}


def _error_envelope(
    code: str,
    message: str,
    retryable: bool,
    request_id: str,
    correlation_id: str,
    retry_after: float | None = None,
) -> dict:
    envelope: dict[str, Any] = {
        "code": code,
        "message": message,
        "retryable": retryable,
        "requestId": request_id,
        "correlationId": correlation_id,
    }
    if retry_after is not None:
        envelope["retryAfterSeconds"] = max(1, int(retry_after))
    return envelope


class OpenRouterGenerationClient:
    """One provider adapter instance; safe to share across worker threads."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        model: str = DEFAULT_MODEL,
        timeout_ms: int = 30000,
        max_output_tokens: int = 4096,
        temperature: float = 0.3,
        reasoning_effort: str = "off",
    ) -> None:
        self._client = OpenAI(base_url=base_url, api_key=api_key, max_retries=0)
        self._model = model
        self._timeout_s = timeout_ms / 1000.0
        self._max_output_tokens = max_output_tokens
        self._temperature = temperature
        self._reasoning_effort = reasoning_effort

    def _kwargs(self, messages: list[dict], response_schema: dict) -> dict:
        reasoning: dict[str, object] = {"enabled": False}
        if self._reasoning_effort != "off":
            reasoning = {"enabled": True, "effort": self._reasoning_effort}
        return {
            "model": self._model,
            "messages": messages,
            "max_tokens": self._max_output_tokens,
            "temperature": self._temperature,
            "timeout": self._timeout_s,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "grounded_mcq", "strict": True, "schema": response_schema},
            },
            "extra_body": {
                "provider": {"require_parameters": True},
                "reasoning": reasoning,
            },
        }

    def generate(
        self,
        messages: list[dict],
        response_schema: dict,
        *,
        repair: bool = False,
        request_id: str = "",
        correlation_id: str = "",
    ) -> NormalizedGenerationResponse:
        """One generation with at most one application-level retry (D-08)."""
        kwargs = self._kwargs(messages, response_schema)
        attempt = 0
        while True:
            attempt += 1
            start = time.monotonic()
            try:
                raw = self._client.chat.completions.with_raw_response.create(**kwargs)
                body = json.loads(raw.text)
            except APITimeoutError:
                if attempt == 1:
                    time.sleep(RETRY_DELAY_SECONDS)
                    continue
                return NormalizedGenerationResponse(
                    content=None,
                    refusal=None,
                    finish_reason="",
                    native_finish_reason=None,
                    structured_output=None,
                    usage={},
                    routed_provider=None,
                    outcome="timeout",
                    error=_error_envelope(
                        "provider_timeout",
                        "provider deadline exceeded",
                        True,
                        request_id,
                        correlation_id,
                    ),
                    latency_ms=(time.monotonic() - start) * 1000.0,
                )
            except APIStatusError as exc:
                if attempt == 1 and (exc.status_code == 429 or exc.status_code >= 500):
                    delay = (
                        self._retry_after_delay(exc)
                        if exc.status_code == 429
                        else RETRY_DELAY_SECONDS
                    )
                    time.sleep(delay)
                    continue
                outcome, code, retryable = self._classify_status(exc)
                return NormalizedGenerationResponse(
                    content=None,
                    refusal=None,
                    finish_reason="",
                    native_finish_reason=None,
                    structured_output=None,
                    usage={},
                    routed_provider=None,
                    outcome=outcome,
                    error=_error_envelope(
                        code,
                        self._message(exc),
                        retryable,
                        request_id,
                        correlation_id,
                        retry_after=self._retry_after(exc) if outcome == "quota_failure" else None,
                    ),
                    latency_ms=(time.monotonic() - start) * 1000.0,
                )
            except APIConnectionError:
                if attempt == 1:
                    time.sleep(RETRY_DELAY_SECONDS)
                    continue
                return NormalizedGenerationResponse(
                    content=None,
                    refusal=None,
                    finish_reason="",
                    native_finish_reason=None,
                    structured_output=None,
                    usage={},
                    routed_provider=None,
                    outcome="provider_error",
                    error=_error_envelope(
                        "provider_unavailable",
                        "provider connection failed",
                        True,
                        request_id,
                        correlation_id,
                    ),
                    latency_ms=(time.monotonic() - start) * 1000.0,
                )
            except APIError as exc:
                return NormalizedGenerationResponse(
                    content=None,
                    refusal=None,
                    finish_reason="",
                    native_finish_reason=None,
                    structured_output=None,
                    usage={},
                    routed_provider=None,
                    outcome="provider_error",
                    error=_error_envelope(
                        "provider_error", str(exc)[:300], False, request_id, correlation_id
                    ),
                    latency_ms=(time.monotonic() - start) * 1000.0,
                )
            return self._normalize(
                body,
                (time.monotonic() - start) * 1000.0,
                request_id,
                correlation_id,
                response_schema,
            )

    @staticmethod
    def _classify_status(exc: APIStatusError) -> tuple[str, str, bool]:
        status = exc.status_code
        message = str(exc).lower()
        if status == 429:
            return "quota_failure", "quota_exhausted", False
        if status == 400 and ("effort" in message or "reasoning" in message):
            return "provider_error", "unsupported_request", False
        if status in (401, 402, 403):
            return "provider_error", "provider_credentials", False
        if status >= 500:
            return "provider_error", "provider_unavailable", True
        return "provider_error", "provider_error", False

    @staticmethod
    def _retry_after(exc: APIStatusError) -> float | None:
        response = getattr(exc, "response", None)
        headers = response.headers if response is not None else {}
        raw = headers.get("retry-after")
        if raw is None:
            return None
        try:
            return float(raw)
        except ValueError:
            return None

    def _retry_after_delay(self, exc: APIStatusError) -> float:
        retry_after = self._retry_after(exc)
        if retry_after is not None:
            return min(retry_after, MAX_RETRY_AFTER_SECONDS)
        return RETRY_DELAY_SECONDS

    @staticmethod
    def _message(exc: APIStatusError) -> str:
        return str(exc)[:300]

    def _normalize(
        self,
        body: dict,
        latency_ms: float,
        request_id: str,
        correlation_id: str,
        response_schema: dict,
    ) -> NormalizedGenerationResponse:
        choice = (body.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        content = message.get("content")
        refusal = message.get("refusal")
        finish_reason = str(choice.get("finish_reason") or "").lower()
        native = choice.get("native_finish_reason")
        usage = body.get("usage") or {}
        details = usage.get("completion_tokens_details") or {}

        structured_output: dict | None = None
        outcome = FINISH_TO_OUTCOME.get(finish_reason)
        if outcome is None:
            if refusal or not content:
                outcome = "safety_block"
            elif finish_reason == "stop":
                try:
                    structured_output = json.loads(content)
                except Exception:
                    structured_output = None
                if structured_output is None:
                    outcome = "malformed_output"
                else:
                    outcome = (
                        "ok"
                        if self._schema_valid(structured_output, response_schema)
                        else "malformed_output"
                    )
            else:
                outcome = "provider_error"

        error: dict | None = None
        if outcome == "safety_block":
            message = "provider refusal" if refusal else "provider safety block"
            error = _error_envelope("safety_block", message, False, request_id, correlation_id)
        elif outcome == "provider_error":
            error = _error_envelope(
                "provider_error", "provider reported an error", False, request_id, correlation_id
            )
        elif outcome == "malformed_output":
            error = _error_envelope(
                "malformed_output",
                "output failed local schema validation",
                False,
                request_id,
                correlation_id,
            )

        normalized = {
            "content": content,
            "refusal": refusal,
            "finish_reason": finish_reason,
            "native_finish_reason": native,
            "structured_output": structured_output,
            "usage": {
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
                "reasoning_tokens": details.get("reasoning_tokens", 0) or 0,
            },
            "routed_provider": body.get("provider"),
            "outcome": outcome,
            "error": error,
            "latency_ms": round(latency_ms, 1),
        }
        return NormalizedGenerationResponse(**normalized)

    @staticmethod
    def _schema_valid(candidate: dict, response_schema: dict) -> bool:
        try:
            jsonschema.Draft202012Validator(response_schema).validate(candidate)
            return True
        except jsonschema.ValidationError:
            return False
