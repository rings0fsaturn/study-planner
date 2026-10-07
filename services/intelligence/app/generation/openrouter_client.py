"""Neutralized OpenRouter generation adapter (D-08).

DeepSeek via OpenRouter with the OpenAI SDK, `max_retries=0`, exactly one
application-level retry for the retryable classes (rate limit honoring
`Retry-After` capped at 60 s, provider unavailability, provider deadline,
transient downstream 400 that classifies as generic `provider_error`),
and the D-08 finish-reason/status to outcome mapping. Local schema
validation runs after every response regardless of strict mode.
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Iterator
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


class GenerationStreamError(RuntimeError):
    """A guide stream failure carrying the normalized error code (D-03).

    The guide stream is prose, so it has no schema outcome; this is the one
    failure channel the SSE router turns into an `error` frame.
    """

    def __init__(self, code: str, message: str, retryable: bool) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable


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
        schema_name: str = "grounded_mcq",
    ) -> None:
        self._client = OpenAI(base_url=base_url, api_key=api_key, max_retries=0)
        self._model = model
        self._schema_name = schema_name
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
                "json_schema": {
                    "name": self._schema_name,
                    "strict": True,
                    "schema": response_schema,
                },
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
                    self._retry_sleep(attempt, RETRY_DELAY_SECONDS, "timeout", correlation_id)
                    continue
                return self._failure(
                    "timeout",
                    "provider_timeout",
                    "provider deadline exceeded",
                    True,
                    request_id,
                    correlation_id,
                    start,
                )
            except APIStatusError as exc:
                outcome, code, retryable = self._classify_status(exc)
                if attempt == 1 and self._should_retry_status(exc.status_code, code):
                    delay = (
                        self._retry_after_delay(exc)
                        if exc.status_code == 429
                        else RETRY_DELAY_SECONDS
                    )
                    reason = "rate_limit" if exc.status_code == 429 else "provider_status"
                    self._retry_sleep(attempt, delay, reason, correlation_id)
                    continue
                self._maybe_log_terminal_400(exc, code, correlation_id)
                return self._failure(
                    outcome,
                    code,
                    self._terminal_message(exc, code),
                    retryable,
                    request_id,
                    correlation_id,
                    start,
                    retry_after=self._retry_after(exc) if outcome == "quota_failure" else None,
                )
            except APIConnectionError:
                if attempt == 1:
                    self._retry_sleep(attempt, RETRY_DELAY_SECONDS, "connection", correlation_id)
                    continue
                return self._failure(
                    "provider_error",
                    "provider_unavailable",
                    "provider connection failed",
                    True,
                    request_id,
                    correlation_id,
                    start,
                )
            except APIError as exc:
                return self._failure(
                    "provider_error",
                    "provider_error",
                    str(exc)[:300],
                    False,
                    request_id,
                    correlation_id,
                    start,
                )
            return self._normalize(
                body,
                (time.monotonic() - start) * 1000.0,
                request_id,
                correlation_id,
                response_schema,
            )

    def _text_kwargs(self, messages: list[dict]) -> dict:
        """Plain-prose streaming request: no `response_format`, reasoning knob kept."""
        reasoning: dict[str, object] = {"enabled": False}
        if self._reasoning_effort != "off":
            reasoning = {"enabled": True, "effort": self._reasoning_effort}
        return {
            "model": self._model,
            "messages": messages,
            "max_tokens": self._max_output_tokens,
            "temperature": self._temperature,
            "timeout": self._timeout_s,
            "stream": True,
            "extra_body": {
                "provider": {"require_parameters": True},
                "reasoning": reasoning,
            },
        }

    def stream_text(
        self,
        messages: list[dict],
        *,
        request_id: str = "",
        correlation_id: str = "",
    ) -> Iterator[str]:
        """Yield plain-text deltas with at most one retry before the first delta.

        Prose tasks (the guide) have no schema, so this skips `response_format`
        and streams raw content. Once a delta has been yielded the stream cannot
        be retried (the client already rendered it); a later failure raises
        `GenerationStreamError` and the caller emits an `error` frame (D-03).
        """
        kwargs = self._text_kwargs(messages)
        attempt = 0
        while True:
            attempt += 1
            emitted = False
            try:
                stream = self._client.chat.completions.create(**kwargs)
                for chunk in stream:
                    text = self._delta_text(chunk)
                    if text:
                        emitted = True
                        yield text
                return
            except APITimeoutError:
                if attempt == 1 and not emitted:
                    self._retry_sleep(attempt, RETRY_DELAY_SECONDS, "timeout", correlation_id)
                    continue
                raise GenerationStreamError(
                    "provider_timeout", "provider deadline exceeded", True
                ) from None
            except APIStatusError as exc:
                _outcome, code, retryable = self._classify_status(exc)
                if (
                    attempt == 1
                    and not emitted
                    and self._should_retry_status(exc.status_code, code)
                ):
                    delay = (
                        self._retry_after_delay(exc)
                        if exc.status_code == 429
                        else RETRY_DELAY_SECONDS
                    )
                    reason = "rate_limit" if exc.status_code == 429 else "provider_status"
                    self._retry_sleep(attempt, delay, reason, correlation_id)
                    continue
                self._maybe_log_terminal_400(exc, code, correlation_id)
                raise GenerationStreamError(
                    code, self._terminal_message(exc, code), retryable
                ) from None
            except APIConnectionError:
                if attempt == 1 and not emitted:
                    self._retry_sleep(attempt, RETRY_DELAY_SECONDS, "connection", correlation_id)
                    continue
                raise GenerationStreamError(
                    "provider_unavailable", "provider connection failed", True
                ) from None
            except APIError as exc:
                raise GenerationStreamError("provider_error", str(exc)[:300], False) from None

    @staticmethod
    def _retry_sleep(attempt: int, delay: float, reason: str, correlation_id: str) -> None:
        """D-06: log the retry backoff so a silent multi-minute gap is explainable."""
        logger.info(
            "adapter retry attempt=%d delay=%.2fs reason=%s",
            attempt,
            delay,
            reason,
            extra={"trace_id": correlation_id},
        )
        time.sleep(delay)

    @staticmethod
    def _delta_text(chunk: Any) -> str:
        choices = getattr(chunk, "choices", None) or []
        if not choices:
            return ""
        delta = getattr(choices[0], "delta", None)
        content = getattr(delta, "content", None) if delta is not None else None
        return content or ""

    @staticmethod
    def _failure(
        outcome: str,
        code: str,
        message: str,
        retryable: bool,
        request_id: str,
        correlation_id: str,
        start: float,
        *,
        retry_after: float | None = None,
    ) -> NormalizedGenerationResponse:
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
                code, message, retryable, request_id, correlation_id, retry_after=retry_after
            ),
            latency_ms=(time.monotonic() - start) * 1000.0,
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
        except (ValueError, TypeError):
            return None

    def _retry_after_delay(self, exc: APIStatusError) -> float:
        retry_after = self._retry_after(exc)
        if retry_after is not None:
            return min(retry_after, MAX_RETRY_AFTER_SECONDS)
        return RETRY_DELAY_SECONDS

    @staticmethod
    def _should_retry_status(status_code: int, code: str) -> bool:
        """One in-adapter retry only; the terminal envelope stays non-retryable.

        `_classify_status` owns the queue-level `retryable` flag (terminal 400
        stays False so the worker parks the assessment in `generating` per D-06).
        This predicate owns the single internal retry that absorbs a transient
        downstream 400, so the two intentionally differ for 429/transient-400.
        """
        return (
            status_code == 429
            or status_code >= 500
            or (status_code == 400 and code == "provider_error")
        )

    @staticmethod
    def _message(exc: APIStatusError) -> str:
        return str(exc)[:300]

    @staticmethod
    def _terminal_message(exc: APIStatusError, code: str) -> str:
        if exc.status_code == 400 and code == "provider_error":
            return "A temporary provider issue interrupted generation; please try again."
        return OpenRouterGenerationClient._message(exc)

    @staticmethod
    def _as_dict(value: Any) -> dict:
        return value if isinstance(value, dict) else {}

    @staticmethod
    def _provider_details(exc: APIStatusError) -> tuple[str | None, str | None]:
        """Provider routing details from the error body; (None, None) when absent."""
        body = getattr(exc, "body", None)
        data: Any = None
        if isinstance(body, dict):
            data = body
        elif isinstance(body, str):
            try:
                data = json.loads(body)
            except (ValueError, TypeError):
                return (None, None)
        else:
            return (None, None)
        if not isinstance(data, dict):
            return (None, None)
        error = OpenRouterGenerationClient._as_dict(data.get("error"))
        metadata = OpenRouterGenerationClient._as_dict(error.get("metadata"))
        name = (
            metadata.get("provider_name") or error.get("provider_name") or data.get("provider_name")
        )
        code = (
            metadata.get("provider_error_code")
            or error.get("provider_error_code")
            or data.get("provider_error_code")
        )
        if not code:
            raw = metadata.get("raw")
            if isinstance(raw, str):
                try:
                    parsed = json.loads(raw)
                except (ValueError, TypeError):
                    parsed = None
                if isinstance(parsed, dict):
                    inner = OpenRouterGenerationClient._as_dict(parsed.get("error"))
                    candidate = inner.get("code") or parsed.get("code")
                    if isinstance(candidate, str) and candidate:
                        code = candidate
        provider_name = name if isinstance(name, str) and name else None
        provider_error_code = code if isinstance(code, str) and code else None
        return (provider_name, provider_error_code)

    @staticmethod
    def _log_terminal_400(exc: APIStatusError, correlation_id: str) -> None:
        provider_name, provider_error_code = OpenRouterGenerationClient._provider_details(exc)
        logger.warning(
            "adapter terminal 400 provider_name=%s provider_error_code=%s raw=%s",
            provider_name,
            provider_error_code,
            OpenRouterGenerationClient._message(exc),
            extra={"trace_id": correlation_id},
        )

    @staticmethod
    def _maybe_log_terminal_400(exc: APIStatusError, code: str, correlation_id: str) -> None:
        if exc.status_code == 400 and code == "provider_error":
            OpenRouterGenerationClient._log_terminal_400(exc, correlation_id)

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
                except (ValueError, TypeError):
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
