"""Jev System One client via OpenRouter (slices 1+2+4).

Thin wrapper around the official ``typesafe_sdk`` pointed at OpenRouter's
System One API (``base_url=https://openrouter.ai/api`` + ``OPENROUTER_JEV_API_KEY``).
Mirrors ``OpenRouterGenerationClient`` conventions: one module logger, one id
per logical call carried as ``request_id``/``trace_id`` in ``extra``, and typed
``JevError`` failures that callers branch on. The SDK's default ``RetryPolicy``
already retries 429/5xx with backoff honoring ``retry-after``, so this wrapper
makes a single call and classifies the outcome.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("jev.client")

JEV_BASE_URL_DEFAULT = "https://openrouter.ai/api"
JEV_MODEL_DEFAULT = "jev-1.13"
JEV_TIMEOUT_S_DEFAULT = 30.0
# TypeSafe list price per million input tokens (output is free). The SystemOne
# surface returns no usage.cost, so spend is estimated at this rate; override
# via JEV_PRICE_PER_MTOK if OpenRouter publishes a different Jev price.
JEV_PRICE_PER_MTOK_DEFAULT = 0.042


def estimate_cost_usd(
    input_tokens: int, price_per_mtok: float = JEV_PRICE_PER_MTOK_DEFAULT
) -> float:
    """Estimated spend for a call (input tokens only; output is free)."""
    return input_tokens * price_per_mtok / 1_000_000


class JevError(RuntimeError):
    """A typed Jev failure carrying the normalized code (cf. service_error codes)."""

    def __init__(self, code: str, message: str, retryable: bool, request_id: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.request_id = request_id


@dataclass
class JevResult:
    """One decided request: plain-dict answers plus usage for cost tracking."""

    answers: dict[str, dict[str, Any]]
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float | None = None
    request_id: str = ""
    extras: dict[str, Any] = field(default_factory=dict)


def _cost_of(response: Any) -> float | None:
    try:
        usage = response.model_dump().get("usage") or {}
        cost = usage.get("cost")
        return float(cost) if cost is not None else None
    except Exception:
        return None


class JevClient:
    """One Jev adapter instance; safe to share across worker threads."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str = JEV_BASE_URL_DEFAULT,
        model: str = JEV_MODEL_DEFAULT,
        timeout_s: float = JEV_TIMEOUT_S_DEFAULT,
        client: Any = None,
    ) -> None:
        if client is not None:
            self._client = client
        else:
            from typesafe_sdk import TypeSafeClient

            self._client = TypeSafeClient(api_key=api_key, base_url=base_url, timeout=timeout_s)
        self._model = model

    @classmethod
    def from_env(cls, prefix: str = "JEV") -> JevClient:
        """Build from ``OPENROUTER_JEV_API_KEY`` + ``<prefix>_MODEL/_BASE_URL/_TIMEOUT_MS``."""
        api_key = os.getenv("OPENROUTER_JEV_API_KEY", "").strip()
        if not api_key:
            logger.warning(
                "OPENROUTER_JEV_API_KEY is not set: jev jobs will fail with provider_credentials"
            )
        return cls(
            api_key=api_key,
            base_url=os.getenv(f"{prefix}_BASE_URL", JEV_BASE_URL_DEFAULT),
            model=os.getenv(f"{prefix}_MODEL", JEV_MODEL_DEFAULT),
            timeout_s=int(os.getenv(f"{prefix}_TIMEOUT_MS", "30000")) / 1000.0,
        )

    def decide(
        self,
        state: Any,
        questions: dict[str, Any],
        *,
        request_id: str = "",
        trace_id: str = "",
    ) -> JevResult:
        """Ask Jev one batch of independent questions about the same state."""
        from typesafe_sdk import (
            TypeSafeAPIConnectionError,
            TypeSafeAPIError,
            TypeSafeAPITimeoutError,
            TypeSafeAuthenticationError,
            TypeSafeBadRequestError,
            TypeSafeRateLimitError,
            TypeSafeUnprocessableEntityError,
        )

        log_extra = {"request_id": request_id, "trace_id": trace_id}
        logger.info(
            "jev decide: model=%s questions=%s", self._model, sorted(questions), extra=log_extra
        )
        try:
            response = self._client.system_one(state=state, questions=questions, model=self._model)
        except TypeSafeAuthenticationError as exc:
            raise self._fail("provider_credentials", str(exc)[:300], False, request_id, log_extra)
        except TypeSafeRateLimitError as exc:
            raise self._fail("quota_failure", str(exc)[:300], True, request_id, log_extra)
        except TypeSafeAPITimeoutError as exc:
            raise self._fail(
                "timeout", "provider deadline exceeded", True, request_id, log_extra
            ) from exc
        except TypeSafeAPIConnectionError as exc:
            raise self._fail("provider_unavailable", str(exc)[:300], True, request_id, log_extra)
        except (TypeSafeBadRequestError, TypeSafeUnprocessableEntityError) as exc:
            raise self._fail("malformed", str(exc)[:300], False, request_id, log_extra)
        except TypeSafeAPIError as exc:
            raise self._fail("provider_error", str(exc)[:300], False, request_id, log_extra)

        answers = {qid: ans.model_dump() for qid, ans in response.answers.items()}
        missing = [qid for qid in questions if qid not in answers]
        if missing:
            raise self._fail(
                "malformed",
                f"jev did not answer: {', '.join(missing)}",
                False,
                request_id,
                log_extra,
            )
        usage = response.usage
        result = JevResult(
            answers=answers,
            model=response.model,
            input_tokens=usage.input_tokens or 0,
            output_tokens=usage.output_tokens or 0,
            cost_usd=_cost_of(response),
            request_id=request_id,
        )
        logger.info(
            "jev ok: model=%s input_tokens=%d cost_usd=%s",
            result.model,
            result.input_tokens,
            result.cost_usd,
            extra=log_extra,
        )
        return result

    @staticmethod
    def _fail(
        code: str, message: str, retryable: bool, request_id: str, log_extra: dict
    ) -> JevError:
        logger.warning("jev fail: code=%s retryable=%s", code, retryable, extra=log_extra)
        return JevError(code, message, retryable, request_id)
