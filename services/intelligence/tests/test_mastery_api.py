from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime, timedelta

import httpx
import jwt
import pytest

from app.dependencies import get_user_client
from app.main import app
from py_progress import MODEL_VERSION

TEST_AUTH_SECRET = "test-supabase-jwt-secret-32-bytes-min"


class FakeUserClient:
    """In-memory UserScopedClient double for the mastery endpoints."""

    def __init__(self) -> None:
        self.graded_rows: list[dict] = []

    def list_graded_attempts(self) -> list[dict]:
        return list(self.graded_rows)


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


def _grade(score: float, correct: bool, skill_tag: str, material_id: str) -> dict:
    return {
        "score": score,
        "correct": correct,
        "perSkill": [{"score": score, "correct": correct, "skillTag": skill_tag}],
        "materialId": material_id,
    }


@pytest.fixture(autouse=True)
def _override_client():
    os.environ["SUPABASE_JWT_SECRET"] = TEST_AUTH_SECRET
    fake = FakeUserClient()
    app.dependency_overrides[get_user_client] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


async def _request(method: str, path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, path, headers=_auth_headers())


def test_mastery_empty_account_returns_empty_list(_override_client: FakeUserClient) -> None:
    response = asyncio.run(_request("GET", "/v1/mastery"))
    assert response.status_code == 200, response.text
    assert response.json() == []


def test_mastery_rebuilds_projections_from_graded_attempts(
    _override_client: FakeUserClient,
) -> None:
    _override_client.graded_rows = [
        {"grade": _grade(1.0, True, "Exam structure", "mat-1")},
        {"grade": _grade(1.0, True, "Exam structure", "mat-1")},
        {"grade": _grade(1.0, True, "Exam structure", "mat-1")},
        {"grade": _grade(0.0, False, "Professional skills", "mat-1")},
        {"grade": _grade(0.0, False, "Other topic", "mat-2")},
    ]
    response = asyncio.run(_request("GET", "/v1/mastery"))
    assert response.status_code == 200, response.text
    projections = response.json()
    assert len(projections) == 3
    by_key = {(p["materialId"], p["skillTag"]): p for p in projections}
    exam = by_key[("mat-1", "Exam structure")]
    assert exam["mastery"] > 0.9  # sustained corrects saturate
    assert exam["n"] == 3
    assert exam["modelVersion"] == MODEL_VERSION
    assert 0.0 <= exam["uncertainty"] <= 1.0
    assert exam["confidence"] == 1.0 - exam["uncertainty"]
    pro = by_key[("mat-1", "Professional skills")]
    assert pro["mastery"] < 0.2  # a single incorrect collapses belief
    assert pro["n"] == 1


def test_mastery_filters_by_material_and_skill(_override_client: FakeUserClient) -> None:
    _override_client.graded_rows = [
        {"grade": _grade(1.0, True, "A", "mat-1")},
        {"grade": _grade(1.0, True, "B", "mat-1")},
        {"grade": _grade(1.0, True, "A", "mat-2")},
    ]
    by_material = asyncio.run(_request("GET", "/v1/mastery?materialId=mat-2")).json()
    assert [p["materialId"] for p in by_material] == ["mat-2"]
    by_skill = asyncio.run(_request("GET", "/v1/mastery?skillTag=A")).json()
    assert sorted(p["skillTag"] for p in by_skill) == ["A", "A"]
    by_both = asyncio.run(_request("GET", "/v1/mastery?materialId=mat-1&skillTag=B")).json()
    assert len(by_both) == 1
    assert by_both[0]["skillTag"] == "B"


def test_mastery_projection_is_rebuildable(_override_client: FakeUserClient) -> None:
    rows = [{"grade": _grade(1.0, True, "A", "mat-1")}] * 4 + [
        {"grade": _grade(0.0, False, "A", "mat-1")}
    ]
    _override_client.graded_rows = rows
    first = asyncio.run(_request("GET", "/v1/mastery")).json()
    second = asyncio.run(_request("GET", "/v1/mastery")).json()
    assert first == second


def test_mastery_recommendations_move_one_band(_override_client: FakeUserClient) -> None:
    _override_client.graded_rows = [
        {"grade": _grade(1.0, True, "A", "mat-1")} for _ in range(6)
    ] + [{"grade": _grade(0.0, False, "B", "mat-1")} for _ in range(3)]
    response = asyncio.run(_request("GET", "/v1/mastery/recommendations?currentBand=3"))
    assert response.status_code == 200, response.text
    recs = {r["skillTag"]: r for r in response.json()}
    assert recs["A"]["recommendedBand"] == 4  # mastered -> one band harder
    assert recs["B"]["recommendedBand"] == 2  # struggling -> one band easier
    for rec in recs.values():
        assert abs(rec["recommendedBand"] - rec["currentBand"]) <= 1
        assert rec["currentBand"] == 3
        assert rec["targetExpectedCorrectness"] == 0.7
        assert rec["modelVersion"] == MODEL_VERSION


def test_mastery_recommendations_default_to_mid_band(
    _override_client: FakeUserClient,
) -> None:
    _override_client.graded_rows = [{"grade": _grade(1.0, True, "A", "mat-1")}]
    response = asyncio.run(_request("GET", "/v1/mastery/recommendations"))
    assert response.status_code == 200, response.text
    assert response.json()[0]["currentBand"] == 3


def test_mastery_requires_auth() -> None:
    import os as _os

    _os.environ["SUPABASE_JWT_SECRET"] = TEST_AUTH_SECRET
    transport = httpx.ASGITransport(app=app)
    async def request_without_token() -> httpx.Response:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get("/v1/mastery")
    response = asyncio.run(request_without_token())
    assert response.status_code == 401