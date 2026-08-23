from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime, timedelta

import httpx
import jwt
import pytest

from app.dependencies import get_user_client
from app.ingestion.models import IngestionError
from app.main import app

TEST_AUTH_SECRET = "test-supabase-jwt-secret-32-bytes-min"
SECRET_KEYS = {"answer", "answerblock", "correctindex", "hiddenanswer"}


class FakeUserClient:
    """In-memory UserScopedClient double for the assessment endpoints."""

    def __init__(self) -> None:
        self.materials: dict[str, dict] = {}
        self.jobs: dict[str, dict] = {}
        self.assessments: dict[str, dict] = {}
        self.questions: dict[str, list[dict]] = {}

    def seed(self, material: dict) -> None:
        self.materials[material["id"]] = material

    def get_material(self, material_id: str) -> dict:
        if material_id not in self.materials:
            raise IngestionError("not_found", "material not found")
        return self.materials[material_id]

    def get_job(self, job_id: str) -> dict:
        if job_id not in self.jobs:
            raise IngestionError("not_found", "ingestion job not found")
        return self.jobs[job_id]

    def get_assessment(self, assessment_id: str) -> dict:
        if assessment_id not in self.assessments:
            raise IngestionError("not_found", "assessment not found")
        return self.assessments[assessment_id]

    def list_questions(self, assessment_id: str) -> list[dict]:
        return self.questions.get(assessment_id, [])

    def insert_assessment(self, row: dict) -> None:
        for existing in self.assessments.values():
            if existing["client_id"] == row["client_id"]:
                raise IngestionError("conflict", "assessment with this client id already exists")
        self.assessments[row["id"]] = row

    def enqueue_generation(
        self, assessment_id: str, job_id: str, material_id: str, correlation_id: str
    ) -> dict:
        if assessment_id not in self.assessments:
            raise IngestionError("not_found", "assessment not found")
        row = {
            "id": job_id,
            "user_id": self.assessments[assessment_id]["user_id"],
            "material_id": material_id,
            "kind": "generation",
            "status": "queued",
            "attempt": 1,
            "correlation_id": correlation_id,
            "result_id": assessment_id,
        }
        self.jobs[job_id] = row
        return row


def fake_user_client() -> FakeUserClient:
    return FakeUserClient()


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


def _material(material_id: str = "mat-1", state: str = "ready") -> dict:
    return {
        "id": material_id,
        "user_id": "fixture-user",
        "title": "A ready material",
        "kind": "url",
        "source": "https://example.com/a",
        "ingestion_state": state,
        "ingestion_progress": 1.0,
        "ingestion_error": None,
        "chunk_count": 3,
        "content_version": "v1",
        "grounding_version": "v1",
        "extracted_text_path": None,
        "upload_complete_at": None,
        "created_at": "2026-08-14T00:00:00Z",
        "updated_at": "2026-08-14T00:01:00Z",
    }


def _request_body(client_id: str = "client-1") -> dict:
    return {
        "clientId": client_id,
        "materialIds": ["mat-1"],
        "recipe": {
            "formats": ["objective"],
            "questionCount": 1,
            "difficulty": 3,
            "skillTags": ["Strategic Planning"],
        },
        "correlationId": "corr-1",
    }


async def _request(method: str, path: str, **kwargs) -> httpx.Response:
    os.environ["SUPABASE_JWT_SECRET"] = TEST_AUTH_SECRET
    headers = {**_auth_headers(), **kwargs.pop("headers", {})}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, path, headers=headers, **kwargs)


@pytest.fixture(autouse=True)
def _override_client():
    fake = FakeUserClient()
    app.dependency_overrides[get_user_client] = lambda: fake
    yield fake
    app.dependency_overrides.clear()


def _walk_keys(value: object) -> list[str]:
    keys: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            keys.append(key)
            keys.extend(_walk_keys(child))
    elif isinstance(value, list):
        for child in value:
            keys.extend(_walk_keys(child))
    return keys


def _assert_no_secret_keys(payload: dict) -> None:
    for key in _walk_keys(payload):
        normalized = key.replace("_", "").replace("-", "").lower()
        assert normalized not in SECRET_KEYS, f"secret key leaked: {key}"


def test_generate_assessment_returns_202_async_job(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material())
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=_request_body(),
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["kind"] == "generation"
    assert body["status"] == "queued"
    assert body["ownerId"] == "fixture-user"
    assert body["resultId"]
    assert body["correlationId"] == "corr-1"
    assert body["jobId"]
    assert len(_override_client.assessments) == 1
    assessment = next(iter(_override_client.assessments.values()))
    assert assessment["user_id"] == "fixture-user"
    assert assessment["material_id"] == "mat-1"
    assert assessment["status"] == "generating"
    assert assessment["recipe"]["difficulty"] == 3


def test_generate_assessment_non_ready_material_is_409(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material(state="embedding"))
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=_request_body(),
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )
    assert response.status_code == 409
    assert response.json()["code"] == "validation_failed"


def test_generate_assessment_missing_material_is_404(_override_client: FakeUserClient) -> None:
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=_request_body(),
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_generate_assessment_wrong_format_is_400(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material())
    body = _request_body()
    body["recipe"]["formats"] = ["written"]
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=body,
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_request"


def test_generate_assessment_wrong_question_count_is_400(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material())
    body = _request_body()
    body["recipe"]["questionCount"] = 3
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=body,
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_request"


def test_generate_assessment_multi_material_is_400(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material())
    body = _request_body()
    body["materialIds"] = ["mat-1", "mat-2"]
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=body,
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_request"


def test_generate_assessment_duplicate_client_id_is_409(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material())
    for _ in range(2):
        response = asyncio.run(
            _request(
                "POST",
                "/v1/assessments/generate",
                json=_request_body(),
                headers={"Idempotency-Key": "idem-key-000000000000"},
            )
        )
    assert response.status_code == 409
    assert response.json()["code"] == "conflict"


def test_generate_assessment_requires_auth() -> None:
    os.environ["SUPABASE_JWT_SECRET"] = TEST_AUTH_SECRET
    transport = httpx.ASGITransport(app=app)

    async def run() -> httpx.Response:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post(
                "/v1/assessments/generate",
                json=_request_body(),
                headers={"Idempotency-Key": "idem-key-000000000000"},
            )

    response = asyncio.run(run())
    assert response.status_code in (401, 403)


def test_get_assessment_returns_redacted_shape(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material())
    _override_client.assessments["a1"] = {
        "id": "a1",
        "user_id": "fixture-user",
        "client_id": "client-1",
        "material_id": "mat-1",
        "recipe": {"formats": ["objective"], "questionCount": 1, "difficulty": 3},
        "status": "ready",
        "warnings": [{"code": "citation_unverified", "message": "quote drifted"}],
        "correlation_id": "corr-1",
        "created_at": "2026-08-14T00:00:00Z",
        "updated_at": "2026-08-14T00:02:00Z",
    }
    _override_client.questions["a1"] = [
        {
            "id": "q1",
            "assessment_id": "a1",
            "user_id": "fixture-user",
            "material_id": "mat-1",
            "format": "objective",
            "prompt": "What is the planning gap?",
            "options": ["Shortfall", "Surplus", "Budget", "Deadline"],
            "skill_tags": ["Strategic Planning"],
            "authored_difficulty": 3,
            "citations": [{"chunkId": "c1", "materialId": "mat-1", "quote": "shortfall"}],
            "created_at": "2026-08-14T00:02:00Z",
        }
    ]
    response = asyncio.run(_request("GET", "/v1/assessments/a1"))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == "a1"
    assert body["ownerId"] == "fixture-user"
    assert body["materialIds"] == ["mat-1"]
    assert body["status"] == "ready"
    assert body["warnings"][0]["code"] == "citation_unverified"
    question = body["questions"][0]
    assert question["prompt"] == "What is the planning gap?"
    assert question["options"] == ["Shortfall", "Surplus", "Budget", "Deadline"]
    assert question["skillTags"] == ["Strategic Planning"]
    assert question["authoredDifficulty"] == 3
    assert question["citations"][0]["chunkId"] == "c1"
    _assert_no_secret_keys(body)


def test_get_assessment_404_for_other_users_row(_override_client: FakeUserClient) -> None:
    response = asyncio.run(_request("GET", "/v1/assessments/nope"))
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_generation_job_readable_through_jobs_endpoint(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material())
    _override_client.assessments["a1"] = {
        "id": "a1",
        "user_id": "fixture-user",
        "client_id": "client-1",
        "material_id": "mat-1",
        "recipe": {"formats": ["objective"], "questionCount": 1, "difficulty": 3},
        "status": "generating",
        "warnings": [],
        "correlation_id": "corr-1",
        "created_at": "2026-08-14T00:00:00Z",
        "updated_at": "2026-08-14T00:00:00Z",
    }
    _override_client.enqueue_generation("a1", "job-gen-1", "mat-1", "corr-1")
    response = asyncio.run(_request("GET", "/v1/jobs/job-gen-1"))
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "generation"
    assert body["resultId"] == "a1"


def test_generation_job_error_carries_retry_after(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material())
    _override_client.jobs["job-1"] = {
        "id": "job-1",
        "user_id": "fixture-user",
        "material_id": "mat-1",
        "kind": "generation",
        "status": "failed",
        "attempt": 1,
        "correlation_id": "corr-1",
        "result_id": None,
        "error_code": "quota_exhausted",
        "error_message": "provider quota exhausted",
        "retryable": False,
        "retry_after_seconds": 60,
        "created_at": "2026-08-14T00:00:00Z",
        "completed_at": "2026-08-14T00:00:01Z",
    }
    response = asyncio.run(_request("GET", "/v1/jobs/job-1"))
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "generation"
    assert body["error"]["code"] == "quota_exhausted"
    assert body["error"]["retryAfterSeconds"] == 60
