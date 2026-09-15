from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from fastapi.testclient import TestClient

from app.logging_config import JsonFormatter, configure_logging
from app.main import app
from py_progress import PRODUCTION_PRIOR_STRATEGY

SECRET = "test-supabase-jwt-secret-32-bytes-min"


def _token(sub: str = "hardening-user") -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "aud": "authenticated",
            "exp": now + timedelta(minutes=5),
            "iat": now,
            "sub": sub,
            "role": "authenticated",
        },
        SECRET,
        algorithm="HS256",
    )


def _headers(sub: str = "hardening-user", request_id: str | None = None) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {_token(sub)}"}
    if request_id:
        headers["X-Request-ID"] = request_id
    return headers


def _calibration_body(sessions: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return {
        "sessions": sessions or [],
        "exceptionalTags": [],
        "resolutions": [],
    }


def _progress_body(sessions: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "sessions": sessions,
        "roadmap": {
            "startDate": "2026-01-01",
            "deadline": "2026-02-01",
            "weeks": 4,
            "weeklyHours": 4,
            "slots": [],
        },
        "calibration": {
            "globalMultiplier": 1,
            "globalPosterior": {"mean": 1, "variance": 0, "sessionCount": 0},
            "roleMultipliers": {},
            "trend": {
                "phases": [],
                "currentPhase": None,
                "projectionSlope": 0,
                "projectionUncertainty": 1,
            },
            "promptNeeded": False,
            "insightsByContext": [],
        },
        "today": "2026-01-01",
    }


@app.get("/__test__/boom")
def _boom() -> None:
    raise RuntimeError("exploded")


def test_request_id_model_version_and_structured_log(monkeypatch, caplog) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    client = TestClient(app)

    with caplog.at_level("INFO", logger="app.middleware"):
        response = client.post(
            "/v1/calibration",
            json=_calibration_body(),
            headers=_headers(request_id="req-hardening-1"),
        )

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "req-hardening-1"
    assert response.headers["X-Model-Version"] == PRODUCTION_PRIOR_STRATEGY

    request_records = [r for r in caplog.records if r.name == "app.middleware"]
    assert request_records, "expected a middleware request log line"
    logged = request_records[-1].__dict__
    assert {
        "request_id": "req-hardening-1",
        "method": "POST",
        "path": "/v1/calibration",
        "status": 200,
    }.items() <= logged.items()
    assert isinstance(logged["latency_ms"], (int, float))


def test_readiness_is_open_and_reports_model() -> None:
    client = TestClient(app)

    response = client.get("/readiness")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "model": PRODUCTION_PRIOR_STRATEGY}
    assert response.headers["X-Model-Version"] == PRODUCTION_PRIOR_STRATEGY


def test_oversized_sessions_are_rejected(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    client = TestClient(app)
    sessions = [{"date": "2026-01-01"} for _ in range(5001)]

    calibration = client.post(
        "/v1/calibration",
        json=_calibration_body(sessions),
        headers=_headers(sub="oversize-calibration"),
    )
    progress = client.post(
        "/v1/progress",
        json=_progress_body(sessions),
        headers=_headers(sub="oversize-progress"),
    )

    assert calibration.status_code == 422
    assert progress.status_code == 422


def test_unhandled_errors_return_envelope(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    client = TestClient(app, raise_server_exceptions=False)

    response = client.get("/__test__/boom", headers={"X-Request-ID": "req-boom"})

    assert response.status_code == 500
    assert response.json() == {
        "error": "internal server error",
        "code": "internal_error",
        "request_id": "req-boom",
    }
    assert "exploded" not in response.text
    assert response.headers["X-Request-ID"] == "req-boom"


def test_json_formatter_emits_parseable_line_with_extras() -> None:
    import logging

    record = logging.LogRecord(
        name="app.test",
        level=logging.WARNING,
        pathname=__file__,
        lineno=1,
        msg="service error",
        args=(),
        exc_info=None,
    )
    record.request_id = "req-1"
    record.code = "validation_failed"
    line = JsonFormatter().format(record)
    parsed = json.loads(line)
    assert parsed["level"] == "WARNING"
    assert parsed["logger"] == "app.test"
    assert parsed["msg"] == "service error"
    assert parsed["request_id"] == "req-1"
    assert parsed["code"] == "validation_failed"
    assert "ts" in parsed


def test_service_error_logs_request_id(monkeypatch, caplog) -> None:
    from fastapi import Request

    from app.ingestion.models import IngestionError
    from app.routers.serialization import service_error

    configure_logging()

    async def _receive() -> dict:
        return {"type": "http.request", "body": b""}

    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/v1/test",
            "headers": [(b"x-request-id", b"req-log-1")],
            "server": ("test", 80),
            "scheme": "http",
            "query_string": b"",
            "client": ("test", 50000),
            "receive": _receive,
        }
    )
    request.state.request_id = "req-log-1"

    with caplog.at_level("WARNING", logger="app.routers"):
        service_error(request, IngestionError("validation_failed", "bad input"))

    logged = [r for r in caplog.records if r.name == "app.routers"]
    assert logged, "expected service_error to log"
    assert logged[-1].__dict__["request_id"] == "req-log-1"
    assert logged[-1].__dict__["code"] == "validation_failed"


def test_rate_limit_stub_returns_429_past_threshold(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("INTELLIGENCE_RATE_LIMIT_PER_MINUTE", "2")
    client = TestClient(app)
    headers = _headers(sub=f"limited-{datetime.now(UTC).timestamp()}")

    first = client.post("/v1/calibration", json=_calibration_body(), headers=headers)
    second = client.post("/v1/calibration", json=_calibration_body(), headers=headers)
    third = client.post("/v1/calibration", json=_calibration_body(), headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429
