"""Mastery-snapshot wiring (#43 Q11, Slice 4).

Client sends the snapshot it already builds guidance from; the router
validates + stores it inside the recipe JSONB (no new column); the worker
steers the single-question blueprint by the weakest in-scope skill within
the one-family-per-call gate. Absent proceeds legacy.
"""

from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime, timedelta

import httpx
import jwt
import pytest

from app.dependencies import get_user_client
from app.generation.models import GenerationRequest
from app.generation.worker import apply_mastery_snapshot
from app.main import app
from app.routers.assessments import _validate_mastery_snapshot
from tests.test_assessments_api import FakeUserClient, _material

TEST_AUTH_SECRET = "test-supabase-jwt-secret-32-bytes-min"


def _snapshot(**overrides) -> dict:
    base: dict = {
        "version": "bkt-v1",
        "entries": [
            {"materialId": "mat-1", "skillTag": "Algebra", "mastery": 0.2},
            {"materialId": "mat-1", "skillTag": "Geometry", "mastery": 0.9},
        ],
    }
    base.update(overrides)
    return base


# --- validation ---


def test_absent_snapshot_is_legacy() -> None:
    assert _validate_mastery_snapshot(None) == []


def test_valid_snapshot_accepted() -> None:
    assert _validate_mastery_snapshot(_snapshot()) == []


def test_non_object_rejected() -> None:
    assert _validate_mastery_snapshot([]) != []


def test_unknown_top_key_rejected() -> None:
    snap = _snapshot(extra=1)
    assert any("unsupported keys" in f for f in _validate_mastery_snapshot(snap))


def test_blank_version_rejected() -> None:
    assert _validate_mastery_snapshot(_snapshot(version="  ")) != []


def test_over_cap_entries_rejected() -> None:
    snap = _snapshot(
        entries=[{"materialId": "mat-1", "skillTag": f"s{i}", "mastery": 0.5} for i in range(51)]
    )
    assert any("at most" in f for f in _validate_mastery_snapshot(snap))


def test_bad_mastery_rejected() -> None:
    over = _snapshot(entries=[{"materialId": "m", "skillTag": "s", "mastery": 1.5}])
    assert _validate_mastery_snapshot(over) != []
    boolean = _snapshot(entries=[{"materialId": "m", "skillTag": "s", "mastery": True}])
    assert _validate_mastery_snapshot(boolean) != []


def test_blank_skill_rejected() -> None:
    blank = _snapshot(entries=[{"materialId": "m", "skillTag": "  ", "mastery": 0.5}])
    assert _validate_mastery_snapshot(blank) != []


def test_unknown_entry_key_rejected() -> None:
    snap = _snapshot(entries=[{"materialId": "m", "skillTag": "s", "mastery": 0.5, "n": 3}])
    assert any("unsupported keys" in f for f in _validate_mastery_snapshot(snap))


def test_generation_request_dataclass_accepts_snapshot() -> None:
    request = GenerationRequest(
        client_id="c",
        material_id="m",
        recipe={"formats": ["objective"], "questionCount": 1, "difficulty": 3},
        correlation_id="corr",
        mastery_snapshot=_snapshot(),
    )
    assert request.mastery_snapshot is not None
    assert request.mastery_snapshot["version"] == "bkt-v1"


def test_generation_request_defaults_to_no_snapshot() -> None:
    request = GenerationRequest(
        client_id="c",
        material_id="m",
        recipe={"formats": ["objective"], "questionCount": 1, "difficulty": 3},
        correlation_id="corr",
    )
    assert request.mastery_snapshot is None


# --- steering ---


def test_no_snapshot_returns_inputs() -> None:
    assert apply_mastery_snapshot(3, ("Algebra",), "mat-1", None) == (3, ("Algebra",))


def test_malformed_snapshot_returns_inputs() -> None:
    assert apply_mastery_snapshot(3, ("Algebra",), "mat-1", {"version": "bkt-v1"}) == (
        3,
        ("Algebra",),
    )


def test_weak_skill_steps_band_down_and_reorders_topics() -> None:
    difficulty, tags = apply_mastery_snapshot(3, ("Geometry", "Algebra"), "mat-1", _snapshot())
    assert difficulty == 2
    assert tags == ("Algebra", "Geometry")


def test_strong_weakest_steps_band_up() -> None:
    snap = _snapshot(
        entries=[
            {"materialId": "mat-1", "skillTag": "Algebra", "mastery": 0.9},
            {"materialId": "mat-1", "skillTag": "Geometry", "mastery": 0.8},
        ]
    )
    difficulty, tags = apply_mastery_snapshot(3, ("Algebra",), "mat-1", snap)
    assert difficulty == 4
    assert tags == ("Algebra",)


def test_mid_weakest_keeps_band() -> None:
    snap = _snapshot(entries=[{"materialId": "mat-1", "skillTag": "Algebra", "mastery": 0.7}])
    assert apply_mastery_snapshot(3, ("Algebra",), "mat-1", snap) == (3, ("Algebra",))


def test_no_skill_tags_injects_weakest() -> None:
    difficulty, tags = apply_mastery_snapshot(3, (), "mat-1", _snapshot())
    assert (difficulty, tags) == (2, ("Algebra",))


def test_other_material_ignored() -> None:
    snap = _snapshot(entries=[{"materialId": "other", "skillTag": "Algebra", "mastery": 0.1}])
    assert apply_mastery_snapshot(3, ("Algebra",), "mat-1", snap) == (3, ("Algebra",))


def test_band_clamps_at_floor_and_ceiling() -> None:
    weak = _snapshot(entries=[{"materialId": "mat-1", "skillTag": "s", "mastery": 0.0}])
    assert apply_mastery_snapshot(1, ("s",), "mat-1", weak)[0] == 1
    strong = _snapshot(entries=[{"materialId": "mat-1", "skillTag": "s", "mastery": 1.0}])
    assert apply_mastery_snapshot(5, ("s",), "mat-1", strong)[0] == 5


def _boundary_snapshot(mastery: float) -> dict:
    return _snapshot(entries=[{"materialId": "mat-1", "skillTag": "s", "mastery": mastery}])


def test_boundary_065_steps_down() -> None:
    assert apply_mastery_snapshot(3, ("s",), "mat-1", _boundary_snapshot(0.65))[0] == 2


def test_boundary_075_steps_up() -> None:
    assert apply_mastery_snapshot(3, ("s",), "mat-1", _boundary_snapshot(0.75))[0] == 4


def test_oversized_snapshot_is_truncated_defensively() -> None:
    snap = _snapshot(
        entries=[{"materialId": "mat-1", "skillTag": f"s{i}", "mastery": 0.1} for i in range(5000)]
    )
    difficulty, tags = apply_mastery_snapshot(3, (), "mat-1", snap)
    assert difficulty == 2
    assert tags == ("s0",)


def test_overlong_skill_tag_is_skipped() -> None:
    snap = _snapshot(entries=[{"materialId": "mat-1", "skillTag": "x" * 121, "mastery": 0.1}])
    assert apply_mastery_snapshot(3, (), "mat-1", snap) == (3, ())


# --- router threading ---


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


async def _request(method: str, path: str, **kwargs) -> httpx.Response:
    os.environ["SUPABASE_JWT_SECRET"] = TEST_AUTH_SECRET
    headers = {**_auth_headers(), **kwargs.pop("headers", {})}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, path, headers=headers, **kwargs)


@pytest.fixture()
def _client():
    fake = FakeUserClient()
    app.dependency_overrides[get_user_client] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def _body(**overrides) -> dict:
    base: dict = {
        "clientId": "client-1",
        "materialIds": ["mat-1"],
        "recipe": {"formats": ["objective"], "questionCount": 1, "difficulty": 3},
        "correlationId": "corr-1",
    }
    base.update(overrides)
    return base


def test_generate_accepts_snapshot_and_stores_it(_client: FakeUserClient) -> None:
    _client.seed(_material())
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=_body(masterySnapshot=_snapshot()),
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )
    assert response.status_code == 202, response.text
    stored = next(iter(_client.assessments.values()))
    assert stored["recipe"]["masterySnapshot"]["version"] == "bkt-v1"
    assert stored["recipe"]["difficulty"] == 3


def test_generate_without_snapshot_stores_legacy_recipe(_client: FakeUserClient) -> None:
    _client.seed(_material())
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=_body(),
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )
    assert response.status_code == 202, response.text
    stored = next(iter(_client.assessments.values()))
    assert "masterySnapshot" not in stored["recipe"]


def test_generate_rejects_bad_snapshot(_client: FakeUserClient) -> None:
    _client.seed(_material())
    bad = _snapshot(entries=[{"materialId": "m", "skillTag": "s", "mastery": 9}])
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=_body(masterySnapshot=bad),
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_request"
    assert not _client.assessments


def test_generate_rejects_recipe_carried_snapshot(_client: FakeUserClient) -> None:
    """A recipe-embedded snapshot would bypass the top-level caps."""
    _client.seed(_material())
    body = _body()
    body["recipe"] = {
        "formats": ["objective"],
        "questionCount": 1,
        "difficulty": 3,
        "masterySnapshot": _snapshot(),
    }
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=body,
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )
    assert response.status_code == 400
    assert "top-level" in response.json()["message"]
    assert not _client.assessments


def test_get_assessment_strips_snapshot_from_echo(_client: FakeUserClient) -> None:
    _client.seed(_material())
    _client.assessments["a1"] = {
        "id": "a1",
        "user_id": "fixture-user",
        "client_id": "client-1",
        "material_id": "mat-1",
        "recipe": {
            "formats": ["objective"],
            "questionCount": 1,
            "difficulty": 3,
            "masterySnapshot": _snapshot(),
        },
        "status": "ready",
        "warnings": [],
        "correlation_id": "corr-1",
        "created_at": "2026-08-14T00:00:00Z",
        "updated_at": "2026-08-14T00:02:00Z",
    }
    response = asyncio.run(_request("GET", "/v1/assessments/a1"))
    assert response.status_code == 200, response.text
    assert "masterySnapshot" not in response.json()["recipe"]


# --- worker threading: snapshot reaches the blueprint ---


def _steered_candidate(difficulty: int) -> dict:
    return {
        "stem": "What does the planning gap measure?",
        "options": ["Shortfall vs target", "Budget surplus", "Headcount", "Cycle time"],
        "correctIndex": 0,
        "difficulty": difficulty,
        "skillTags": ["Algebra"],
        "citations": [{"chunkId": "c1", "quote": "the shortfall between forecast and target"}],
    }


def test_process_steers_blueprint_from_snapshot() -> None:
    from tests.ingestion_doubles import FakeQueue
    from tests.test_generation_worker import (
        FakeAdapter,
        FakeGenerationRepo,
        FakeTelemetry,
        assessment,
        make_worker,
        material,
        ok_response,
    )

    repo = FakeGenerationRepo()
    row = assessment()
    row["material_id"] = "m1"
    row["recipe"] = {
        "formats": ["objective"],
        "questionCount": 1,
        "difficulty": 3,
        "skillTags": ["Algebra"],
        "masterySnapshot": {
            "version": "bkt-v1",
            "entries": [{"materialId": "m1", "skillTag": "Algebra", "mastery": 0.2}],
        },
    }
    repo.seed(row, material())
    queue = FakeQueue()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )
    adapter = FakeAdapter([ok_response(structured_output=_steered_candidate(2))])
    telemetry = FakeTelemetry()

    assert make_worker(repo, queue, adapter, telemetry).run_once() == 1
    assert "band 2" in adapter.calls[0]["messages"][0]["content"]
    question_row, _, status, _ = repo.completed[0]
    assert status == "ready"
    assert question_row["authored_difficulty"] == 2


def test_process_without_snapshot_keeps_legacy_band() -> None:
    from tests.ingestion_doubles import FakeQueue
    from tests.test_generation_worker import (
        FakeAdapter,
        FakeGenerationRepo,
        FakeTelemetry,
        assessment,
        make_worker,
        material,
        ok_response,
    )

    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )
    adapter = FakeAdapter([ok_response()])
    telemetry = FakeTelemetry()

    assert make_worker(repo, queue, adapter, telemetry).run_once() == 1
    assert "band 3" in adapter.calls[0]["messages"][0]["content"]
