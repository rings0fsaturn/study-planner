from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from fastapi.testclient import TestClient

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

    log_lines = [json.loads(record.getMessage()) for record in caplog.records]
    assert {
        "request_id": "req-hardening-1",
        "method": "POST",
        "path": "/v1/calibration",
        "status": 200,
    }.items() <= log_lines[-1].items()
    assert isinstance(log_lines[-1]["latency_ms"], (int, float))


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
