"""Loop-decision endpoint tests (offline: fakes only, no network).

Covers the v1 state ceiling (shape + caps + owner scope), the fake-Jev
verdict mapping through the fail-closed router, typed failure mapping,
and the `X-Request-ID` join.
"""

from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime, timedelta

import httpx
import jwt
import pytest

import app.routers.loop as loop_module
from app.dependencies import get_user_client
from app.jev.client import JevError
from app.main import app

TEST_AUTH_SECRET = "test-supabase-jwt-secret-32-bytes-min"


def _body(**overrides) -> dict:
    payload = {
        "materialIds": ["m1"],
        "materialTitles": ["Kinematics"],
        "signals": [
            {
                "material": "m1",
                "skill": "Motion",
                "mastery": 0.3,
                "confidence": 0.9,
                "observations": 8,
                "trend": -0.2,
            }
        ],
        "evidence_summary": {
            "total_attempts": 20,
            "skills_observed": 3,
            "min_obs_per_skill": 4,
            "max_obs_per_skill": 9,
            "days_span": 12,
        },
        "posture": {
            "behind_days": 2.0,
            "days_left": 20,
            "pace_vs_plan": 0.9,
            "capacity_hours_per_week": 6.0,
        },
    }
    payload.update(overrides)
    return payload


class FakeUserClient:
    """Owner-scoped double: only m1 exists."""

    def __init__(self) -> None:
        self.material_calls: list[str] = []

    def get_material(self, material_id: str) -> dict:
        self.material_calls.append(material_id)
        if material_id != "m1":
            from app.ingestion.models import IngestionError

            raise IngestionError("not_found", "material not found")
        return {"id": "m1"}


class _FakeResult:
    def __init__(self, answers: dict, model: str = "typesafe/jev-1.13-20260917") -> None:
        self.answers = answers
        self.model = model
        self.input_tokens = 800
        self.output_tokens = 0


class FakeJev:
    """Jev double returning canned answers; records the state it was given."""

    def __init__(self, answers: dict) -> None:
        self._answers = answers
        self.calls: list[dict] = []

    def decide(self, state, questions, *, request_id: str = "", trace_id: str = ""):
        self.calls.append({"state": state, "questions": questions, "request_id": request_id})
        return _FakeResult(dict(self._answers))


class FailingJev:
    def __init__(self, error: Exception) -> None:
        self._error = error
        self.calls: list[dict] = []

    def decide(self, state, questions, *, request_id: str = "", trace_id: str = ""):
        self.calls.append({"state": state})
        raise self._error


def _answers(choice: str, confidence: float, sufficient: float) -> dict:
    return {
        "loop_action": {"choice": choice, "confidence": confidence},
        "evidence_sufficient": {"noul": sufficient},
    }


def _auth_headers(**overrides) -> dict[str, str]:
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "aud": "authenticated",
            "exp": now + timedelta(minutes=5),
            "iat": now,
            "sub": "fixture-user",
            "role": "authenticated",
        },
        TEST_AUTH_SECRET,
        algorithm="HS256",
    )
    headers = {"Authorization": f"Bearer {token}", "Idempotency-Key": "x" * 16}
    headers.update(overrides)
    return headers


async def _request(
    method: str, path: str, body: dict | None = None, headers: dict | None = None
) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, path, headers=headers, json=body)


def _post(body: dict, headers: dict | None = None) -> httpx.Response:
    return asyncio.run(_request("POST", "/v1/loop/decision", body, headers or _auth_headers()))


@pytest.fixture(autouse=True)
def _override_client():
    os.environ["SUPABASE_JWT_SECRET"] = TEST_AUTH_SECRET
    fake = FakeUserClient()
    app.dependency_overrides[get_user_client] = lambda: fake
    yield fake
    app.dependency_overrides.clear()
    loop_module._jev_client = None


def _use_jev(answers: dict) -> FakeJev:
    fake = FakeJev(answers)
    loop_module._jev_client = fake  # type: ignore[assignment]
    return fake


def test_decision_passes_through_each_verdict():
    for choice in ("hold", "reprioritize", "suggest_replan"):
        loop_module._jev_client = None
        fake = _use_jev(_answers(choice, 0.95, 0.9))
        response = _post(_body())
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["verdict"] == choice
        assert payload["choice"] == choice
        assert payload["confidence"] == pytest.approx(0.95)
        assert payload["sufficiency"] == pytest.approx(0.9)
        assert payload["model"]
        assert fake.calls[0]["request_id"]
        assert response.headers.get("X-Request-ID") == fake.calls[0]["request_id"]
        # The Jev state is the v1 ceiling only: no chunk text, answers, or rubrics.
        state = fake.calls[0]["state"]
        assert set(state) == {"signals", "evidence_summary", "posture"}
        assert set(fake.calls[0]["questions"]) == {"loop_action", "evidence_sufficient"}


def test_guard_hold_on_thin_evidence():
    _use_jev(_answers("reprioritize", 0.95, 0.2))
    assert _post(_body()).json()["verdict"] == "hold"


def test_mid_confidence_holds():
    _use_jev(_answers("reprioritize", 0.5, 0.9))
    assert _post(_body()).json()["verdict"] == "hold"


def test_unknown_choice_holds():
    _use_jev(_answers("unknown", 0.95, 0.9))
    assert _post(_body()).json()["verdict"] == "hold"


def test_bad_shape_rejected_before_jev():
    fake = _use_jev(_answers("hold", 0.95, 0.9))
    bad = _body()
    bad["signals"][0]["mastery"] = 2.0
    response = _post(bad)
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_request"
    assert fake.calls == []


def test_over_caps_rejected_before_jev():
    fake = _use_jev(_answers("hold", 0.95, 0.9))
    signal = {
        "material": "m1",
        "skill": "s",
        "mastery": 0.5,
        "confidence": 0.5,
        "observations": 1,
        "trend": 0.0,
    }
    response = _post(_body(signals=[dict(signal) for _ in range(201)]))
    assert response.status_code == 400
    assert fake.calls == []


def test_unowned_material_rejected(_override_client):
    fake = _use_jev(_answers("hold", 0.95, 0.9))
    body = _body()
    body["signals"][0]["material"] = "m2"
    response = _post(body)
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
    assert fake.calls == []


def test_unowned_material_id_rejected(_override_client):
    fake = _use_jev(_answers("hold", 0.95, 0.9))
    response = _post(_body(materialIds=["m2"]))
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"
    assert fake.calls == []


def test_jev_failure_maps_to_typed_error():
    loop_module._jev_client = FailingJev(JevError("quota_failure", "slow", True, "r1"))  # type: ignore[assignment]
    response = _post(_body())
    assert response.status_code == 500
    payload = response.json()
    assert payload["code"] == "quota_exhausted"
    assert payload["retryable"] is True
    assert payload["requestId"]


def test_missing_idempotency_key_rejected():
    headers = _auth_headers()
    del headers["Idempotency-Key"]
    assert _post(_body(), headers).status_code == 422


def test_missing_auth_rejected():
    headers = _auth_headers(Authorization="Bearer invalid")
    assert _post(_body(), headers).status_code == 401
