from __future__ import annotations

import asyncio
import json
import math
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import jwt
import pytest

from app.main import app
from py_progress import production_calibrator

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_ROOT = REPO_ROOT / "tests" / "fixtures" / "pillar-a"
TOLERANCE = 1e-6
TEST_AUTH_SECRET = "test-supabase-jwt-secret-32-bytes-min"

ENDPOINT_BY_FN = {
    "computeCalibration": "/v1/calibration",
    "getPromptDetail": "/v1/calibration/prompt-detail",
    "computeProgress": "/v1/progress",
    "generateRoadmap": "/v1/roadmap/generate",
    "regenerateRoadmap": "/v1/roadmap/regenerate",
}


def _fixture_cases() -> list[tuple[str, Path, str]]:
    cases: list[tuple[str, Path, str]] = []
    for area in ["progress", "roadmap"]:
        for input_path in sorted((FIXTURE_ROOT / area).glob("*.input.json")):
            payload = json.loads(input_path.read_text())
            endpoint = ENDPOINT_BY_FN.get(payload["fn"])
            if endpoint is None:
                continue
            cases.append((f"{area}/{input_path.stem.replace('.input', '')}", input_path, endpoint))
    return cases


def _auth_headers() -> dict[str, str]:
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
    return {"Authorization": f"Bearer {token}"}


async def _post_json(endpoint: str, payload: dict[str, Any]) -> httpx.Response:
    os.environ["SUPABASE_JWT_SECRET"] = TEST_AUTH_SECRET
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post(endpoint, json=payload, headers=_auth_headers())


def _assert_close(actual: Any, expected: Any, path: str = "") -> None:
    if actual is None and expected is None:
        return
    if isinstance(expected, bool):
        assert actual == expected, f"{path}: {actual!r} != {expected!r}"
        return
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        if isinstance(expected, int) and isinstance(actual, int) and not isinstance(
            expected, bool
        ):
            assert actual == expected, f"{path}: {actual!r} != {expected!r}"
            return
        if not math.isclose(float(actual), float(expected), rel_tol=TOLERANCE, abs_tol=TOLERANCE):
            raise AssertionError(f"{path}: {actual!r} != {expected!r} (tol={TOLERANCE})")
        return
    if isinstance(expected, str):
        assert actual == expected, f"{path}: {actual!r} != {expected!r}"
        return
    if isinstance(expected, list):
        assert isinstance(actual, list), f"{path}: expected list, got {type(actual)}"
        assert len(actual) == len(expected), f"{path}: length {len(actual)} != {len(expected)}"
        for i, (a, e) in enumerate(zip(actual, expected, strict=True)):
            _assert_close(a, e, f"{path}[{i}]")
        return
    if isinstance(expected, dict):
        assert isinstance(actual, dict), f"{path}: expected dict, got {type(actual)}"
        assert set(actual.keys()) == set(expected.keys()), (
            f"{path}: keys {sorted(actual.keys())!r} != {sorted(expected.keys())!r}"
        )
        for key in expected:
            _assert_close(actual[key], expected[key], f"{path}.{key}")
        return
    assert actual == expected, f"{path}: {actual!r} != {expected!r}"


@pytest.mark.parametrize(("case_name", "input_path", "endpoint"), _fixture_cases())
def test_v1_endpoint_matches_golden_fixture(case_name: str, input_path: Path, endpoint: str) -> None:
    payload = json.loads(input_path.read_text())
    expected_path = input_path.with_name(input_path.name.replace(".input.json", ".expected.json"))
    expected = json.loads(expected_path.read_text())

    body = dict(payload)
    body.pop("fn")

    response = asyncio.run(_post_json(endpoint, body))

    assert response.status_code == 200, response.text
    _assert_close(response.json(), expected, case_name)


def _calibration_sessions() -> list[dict[str, Any]]:
    return [
        {
            "date": f"2026-01-{index + 1:02d}",
            "source": "active",
            "plannedMinutes": 60,
            "activeMinutes": active,
            "duration": active,
            "materialRole": "anchor" if index % 3 == 0 else "foundation",
            "startedAt": f"2026-01-{index + 1:02d}T18:00:00Z",
            "sessionId": f"phase2-{index}",
        }
        for index, active in enumerate([48, 52, 55, 50, 58, 54])
    ]


def test_calibration_endpoint_uses_enriched_pace_and_optional_forecast() -> None:
    sessions = _calibration_sessions()
    next_context = {
        "date": "2026-01-07",
        "startedAt": "2026-01-07T18:00:00Z",
        "materialRole": "foundation",
        "session_index": 6,
        "planned_horizon": {
            "deadline": "2026-02-15",
            "planned_total_sessions": 24,
        },
    }

    response = asyncio.run(
        _post_json(
            "/v1/calibration",
            {
                "sessions": sessions,
                "exceptionalTags": [],
                "resolutions": [],
                "nextContext": next_context,
            },
        )
    )

    assert response.status_code == 200, response.text
    body = response.json()
    expected_pace = production_calibrator().fit_global(sessions)
    assert math.isclose(body["globalMultiplier"], expected_pace, rel_tol=1e-9)
    assert math.isclose(body["globalPosterior"]["mean"], expected_pace, rel_tol=1e-9)
    assert body["nextSessionForecast"] is not None
    assert body["nextSessionForecast"] > 0

    no_context_response = asyncio.run(
        _post_json(
            "/v1/calibration",
            {
                "sessions": sessions,
                "exceptionalTags": [],
                "resolutions": [],
            },
        )
    )

    assert no_context_response.status_code == 200, no_context_response.text
    assert no_context_response.json()["nextSessionForecast"] is None
