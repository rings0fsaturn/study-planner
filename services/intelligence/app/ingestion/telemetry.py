"""GenerationTelemetry contract implementation (approved phase-2 schema).

The wire shape follows `contracts/phase2/generation-telemetry.schema.json`
exactly (see `TelemetryRecord.to_contract_dict`; `additionalProperties: false`
is enforced by contract tests). Persistence adds server-owned columns only
(`material_id`, `attempt`, `stage`, `created_at`).

Sinks are best-effort by design: telemetry must never fail the pipeline stage
that produced it. The worker wraps every emit in a try/except and logs a
warning instead.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

import httpx

logger = logging.getLogger("ingestion.telemetry")

# Contract task/outcome enums (generation-telemetry.schema.json).
TASKS = (
    "ingestion",
    "embedding",
    "assessment_generation",
    "written_grading",
    "guide_hint",
    "guide_reveal",
)
OUTCOMES = (
    "ok",
    "partial",
    "safety_block",
    "quota_failure",
    "timeout",
    "malformed_output",
    "provider_error",
)

# Stage names the ingestion worker emits (persistence-only column).
STAGE_EXTRACT = "extract"
STAGE_CHUNK = "chunk"
STAGE_UPLOAD = "upload"
STAGE_EMBED = "embed"
STAGE_EMBED_BATCH = "embed-batch"
STAGE_PUBLISH = "publish"

INGESTION_TEMPLATE_VERSION = "ingestion-v1"
EMBEDDING_TEMPLATE_VERSION = "embedding-v1"

# Map normalized ingestion error codes to contract outcome values.
OUTCOME_BY_ERROR_CODE: dict[str, str] = {
    "provider_timeout": "timeout",
    "quota_exhausted": "quota_failure",
    "rate_limited": "provider_error",
    "provider_unavailable": "provider_error",
    "provider_credentials": "provider_error",
    "malformed_output": "malformed_output",
    "safety_block": "safety_block",
}


def outcome_for_error_code(code: str) -> str:
    return OUTCOME_BY_ERROR_CODE.get(code, "partial")


@dataclass(frozen=True)
class TelemetryRecord:
    """One contract-shaped telemetry record plus server-owned context."""

    trace_id: str
    owner_id: str
    task: str
    model: str
    prompt_template_version: str
    outcome: str
    latency_ms: float
    input_tokens: int = 0
    output_tokens: int = 0
    repair_attempted: bool = False
    questions_requested: int = 0
    questions_accepted: int = 0
    reasoning_tokens: int | None = None
    texts_count: int = 0
    material_id: str = ""
    attempt: int = 1
    stage: str = ""

    def to_contract_dict(self) -> dict[str, object]:
        """The exact wire shape validated by generation-telemetry.schema.json."""
        payload: dict[str, object] = {
            "traceId": self.trace_id,
            "ownerId": self.owner_id,
            "task": self.task,
            "model": self.model,
            "promptTemplateVersion": self.prompt_template_version,
            "outcome": self.outcome,
            "latencyMs": round(self.latency_ms, 1),
            "inputTokens": self.input_tokens,
            "outputTokens": self.output_tokens,
            "repairAttempted": self.repair_attempted,
            "questionsRequested": self.questions_requested,
            "questionsAccepted": self.questions_accepted,
        }
        if self.reasoning_tokens is not None:
            payload["reasoningTokens"] = self.reasoning_tokens
        return payload

    def to_row_dict(self) -> dict[str, object]:
        """The persistence row shape (snake_case columns)."""
        payload: dict[str, object] = {
            "trace_id": self.trace_id,
            "owner_id": self.owner_id,
            "material_id": self.material_id,
            "attempt": self.attempt,
            "stage": self.stage,
            "task": self.task,
            "model": self.model,
            "prompt_template_version": self.prompt_template_version,
            "outcome": self.outcome,
            "latency_ms": round(self.latency_ms, 1),
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "repair_attempted": self.repair_attempted,
            "questions_requested": self.questions_requested,
            "questions_accepted": self.questions_accepted,
            "texts_count": self.texts_count,
        }
        if self.reasoning_tokens is not None:
            payload["reasoning_tokens"] = self.reasoning_tokens
        return payload


class TelemetrySink(Protocol):
    def emit(self, records: Sequence[TelemetryRecord]) -> None: ...


class NullTelemetrySink:
    """No-op sink (default when telemetry is not wired)."""

    def emit(self, records: Sequence[TelemetryRecord]) -> None:
        pass


class LoggingTelemetrySink:
    """One JSON line per record on the ingestion.telemetry logger."""

    def emit(self, records: Sequence[TelemetryRecord]) -> None:
        for record in records:
            logger.info("telemetry %s", json.dumps(record.to_contract_dict(), sort_keys=True))


class SupabaseTelemetrySink:
    """Persist records to `generation_telemetry` with the service role.

    Writes go through PostgREST with a bare JSON array body (the `{"rows": ...}`
    envelope is rejected by the hosted PostgREST). Callers treat emission as
    best-effort and never let a sink failure fail the pipeline stage.
    """

    TABLE = "generation_telemetry"

    def __init__(
        self, supabase_url: str, service_role_key: str, client: httpx.Client | None = None
    ) -> None:
        self._base = supabase_url.rstrip("/")
        self._key = service_role_key
        self._client = client

    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    def emit(self, records: Sequence[TelemetryRecord]) -> None:
        if not records:
            return
        client = self._client or httpx.Client(timeout=10.0)
        try:
            response = client.post(
                f"{self._base}/rest/v1/{self.TABLE}",
                json=[record.to_row_dict() for record in records],
                headers=self._headers(),
            )
        except httpx.HTTPError as exc:
            raise RuntimeError("telemetry insert failed") from exc
        finally:
            if self._client is None:
                client.close()
        if response.status_code >= 400:
            raise RuntimeError(f"telemetry insert rejected ({response.status_code})")
