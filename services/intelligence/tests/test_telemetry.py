from __future__ import annotations

import json
import logging
from pathlib import Path

import httpx
import jsonschema
import pytest

from app.ingestion.telemetry import (
    LoggingTelemetrySink,
    NullTelemetrySink,
    SupabaseTelemetrySink,
    TelemetryRecord,
    outcome_for_error_code,
)

CONTRACT_SCHEMA = (
    Path(__file__).parents[1] / "contracts" / "phase2" / "generation-telemetry.schema.json"
)


def make_record(**overrides: object) -> TelemetryRecord:
    base = dict(
        trace_id="trace-1",
        owner_id="user-1",
        task="embedding",
        model="gemini-embedding-001",
        prompt_template_version="embedding-v1",
        outcome="ok",
        latency_ms=150.0,
        input_tokens=400,
        output_tokens=0,
        material_id="mat-1",
        attempt=2,
        stage="embed-batch",
    )
    base.update(overrides)
    return TelemetryRecord(**base)  # type: ignore[arg-type]


def test_record_contract_dict_validates_against_schema() -> None:
    schema = json.loads(CONTRACT_SCHEMA.read_text(encoding="ascii"))
    record = make_record()
    jsonschema.Draft202012Validator(schema).validate(record.to_contract_dict())


def test_record_contract_dict_excludes_persistence_only_fields() -> None:
    payload = make_record().to_contract_dict()
    assert "stage" not in payload
    assert "material_id" not in payload
    assert "attempt" not in payload
    assert payload["traceId"] == "trace-1"
    assert payload["ownerId"] == "user-1"
    assert payload["promptTemplateVersion"] == "embedding-v1"
    assert payload["latencyMs"] == 150.0
    assert payload["repairAttempted"] is False


def test_record_carries_generation_fields_in_contract_dict() -> None:
    record = make_record(
        task="assessment_generation",
        questions_requested=1,
        questions_accepted=1,
        reasoning_tokens=12,
    )
    payload = record.to_contract_dict()
    assert payload["questionsRequested"] == 1
    assert payload["questionsAccepted"] == 1
    assert payload["reasoningTokens"] == 12
    schema = json.loads(CONTRACT_SCHEMA.read_text(encoding="ascii"))
    jsonschema.Draft202012Validator(schema).validate(payload)


def test_record_omits_reasoning_tokens_when_absent() -> None:
    payload = make_record().to_contract_dict()
    assert "reasoningTokens" not in payload
    assert "reasoning_tokens" not in make_record().to_row_dict()


def test_record_carries_generation_fields_in_row_dict() -> None:
    record = make_record(
        task="assessment_generation",
        questions_requested=1,
        questions_accepted=0,
        reasoning_tokens=None,
    )
    row = record.to_row_dict()
    assert row["questions_requested"] == 1
    assert row["questions_accepted"] == 0
    assert "reasoning_tokens" not in row


def test_record_row_dict_maps_to_snake_case_columns() -> None:
    row = make_record().to_row_dict()
    assert row["trace_id"] == "trace-1"
    assert row["owner_id"] == "user-1"
    assert row["material_id"] == "mat-1"
    assert row["prompt_template_version"] == "embedding-v1"
    assert row["latency_ms"] == 150.0
    assert row["attempt"] == 2
    assert row["stage"] == "embed-batch"
    assert row["texts_count"] == 0


def test_outcome_mapping_follows_contract_enum() -> None:
    assert outcome_for_error_code("provider_timeout") == "timeout"
    assert outcome_for_error_code("quota_exhausted") == "quota_failure"
    assert outcome_for_error_code("rate_limited") == "provider_error"
    assert outcome_for_error_code("provider_unavailable") == "provider_error"
    assert outcome_for_error_code("provider_credentials") == "provider_error"
    assert outcome_for_error_code("malformed_output") == "malformed_output"
    assert outcome_for_error_code("safety_block") == "safety_block"
    assert outcome_for_error_code("validation_failed") == "partial"
    assert outcome_for_error_code("internal_error") == "partial"


def test_null_sink_accepts_records() -> None:
    NullTelemetrySink().emit([make_record()])


def test_logging_sink_emits_one_json_line_per_record(caplog) -> None:
    with caplog.at_level(logging.INFO, logger="ingestion.telemetry"):
        LoggingTelemetrySink().emit([make_record(), make_record(latency_ms=10.0)])
    lines = [line for line in caplog.messages if line.startswith("telemetry ")]
    assert len(lines) == 2
    payload = json.loads(lines[0].removeprefix("telemetry "))
    assert payload["traceId"] == "trace-1"
    assert payload["task"] == "embedding"


def test_supabase_sink_posts_bare_array_with_mapped_columns() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(201, json=[])

    client = httpx.Client(transport=httpx.MockTransport(handler))
    sink = SupabaseTelemetrySink("https://db.example", "service-key", client=client)
    sink.emit([make_record(), make_record(latency_ms=10.0)])

    assert len(requests) == 1
    request = requests[0]
    assert request.url.path == "/rest/v1/generation_telemetry"
    assert request.headers["Authorization"] == "Bearer service-key"
    rows = json.loads(request.content)
    assert isinstance(rows, list) and len(rows) == 2
    assert rows[0]["trace_id"] == "trace-1"
    assert rows[0]["latency_ms"] == 150.0
    assert "traceId" not in rows[0]


def test_supabase_sink_skips_empty_batches() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(201, json=[])

    client = httpx.Client(transport=httpx.MockTransport(handler))
    SupabaseTelemetrySink("https://db.example", "key", client=client).emit([])
    assert calls == 0


def test_supabase_sink_raises_on_rejection() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={})

    client = httpx.Client(transport=httpx.MockTransport(handler))
    sink = SupabaseTelemetrySink("https://db.example", "key", client=client)
    with pytest.raises(RuntimeError):
        sink.emit([make_record()])
