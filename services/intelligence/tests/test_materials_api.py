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


class FakeUserClient:
    """In-memory UserScopedClient double; rows are owner-scoped like RLS."""

    def __init__(self) -> None:
        self.materials: dict[str, dict] = {}
        self.jobs: dict[str, dict] = {}
        self.fulltext: dict[str, bytes] = {}

    def seed(self, material: dict, jobs: list[dict] | None = None) -> None:
        self.materials[material["id"]] = material
        for job in jobs or []:
            self.jobs[job["id"]] = job

    def get_material(self, material_id: str) -> dict:
        if material_id not in self.materials:
            raise IngestionError("not_found", "material not found")
        return self.materials[material_id]

    def get_job(self, job_id: str) -> dict:
        if job_id not in self.jobs:
            raise IngestionError("not_found", "ingestion job not found")
        return self.jobs[job_id]

    def latest_job(self, material_id: str) -> dict | None:
        rows = [row for row in self.jobs.values() if row["material_id"] == material_id]
        if not rows:
            return None
        return sorted(rows, key=lambda row: int(row.get("attempt") or 1), reverse=True)[0]

    def download_fulltext(self, material_id: str, path: str) -> bytes:
        if path not in self.fulltext:
            raise IngestionError("not_found", "extracted content not available")
        return self.fulltext[path]


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


def _material(material_id: str = "mat-1", state: str = "extracting") -> dict:
    return {
        "id": material_id,
        "user_id": "fixture-user",
        "title": "A material",
        "kind": "url",
        "source": "https://example.com/a",
        "ingestion_state": state,
        "ingestion_progress": 0.25,
        "ingestion_error": None,
        "chunk_count": 3,
        "content_version": "v1",
        "grounding_version": "v1",
        "extracted_text_path": "fixture-user/mat-1/fulltext.txt",
        "upload_complete_at": None,
        "created_at": "2026-08-14T00:00:00Z",
        "updated_at": "2026-08-14T00:01:00Z",
    }


def _job(job_id: str = "job-1", material_id: str = "mat-1", attempt: int = 1) -> dict:
    return {
        "id": job_id,
        "user_id": "fixture-user",
        "material_id": material_id,
        "kind": "ingestion",
        "status": "queued",
        "attempt": attempt,
        "correlation_id": "corr-1",
        "result_id": None,
        "error_code": None,
        "error_message": None,
        "retryable": False,
        "created_at": "2026-08-14T00:00:00Z",
        "completed_at": None,
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


def test_ingestion_status_success(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material(), jobs=[_job()])
    response = asyncio.run(_request("GET", "/v1/materials/mat-1/ingestion"))
    assert response.status_code == 200
    body = response.json()
    assert body["materialId"] == "mat-1"
    assert body["state"] == "extracting"
    assert body["attempt"] == 1
    assert body["progress"] >= 0 and body["progress"] <= 1


def test_ingestion_status_echoes_stored_worker_progress(_override_client: FakeUserClient) -> None:
    # The API must surface exactly what the worker wrote (single source of
    # truth), not a router-side map that can drift from the worker.
    material = _material(state="embedding")
    material["ingestion_progress"] = 0.6
    _override_client.seed(material, jobs=[_job()])
    response = asyncio.run(_request("GET", "/v1/materials/mat-1/ingestion"))
    assert response.status_code == 200
    assert response.json()["progress"] == 0.6


def test_ingestion_status_missing_material_is_404_with_service_error_shape(
    _override_client: FakeUserClient,
) -> None:
    response = asyncio.run(_request("GET", "/v1/materials/mat-9/ingestion"))
    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "not_found"
    assert "requestId" in body
    assert "retryable" in body


def test_content_preview_is_truncated_and_ready_gated(_override_client: FakeUserClient) -> None:
    material = _material(state="chunking")
    _override_client.seed(material)
    _override_client.fulltext["fixture-user/mat-1/fulltext.txt"] = b"word " * 3000
    response = asyncio.run(_request("GET", "/v1/materials/mat-1/content"))
    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "chunking"
    assert body["ready"] is False
    assert body["chunkCount"] == 3
    assert len(body["previewText"]) <= 4001
    assert body["previewText"].endswith("…")


def test_content_preview_empty_before_extraction(_override_client: FakeUserClient) -> None:
    material = _material(state="pending")
    material["extracted_text_path"] = None
    _override_client.seed(material)
    response = asyncio.run(_request("GET", "/v1/materials/mat-1/content"))
    assert response.status_code == 200
    assert response.json()["previewText"] == ""


def test_content_preview_ready_material(_override_client: FakeUserClient) -> None:
    material = _material(state="ready")
    _override_client.seed(material)
    _override_client.fulltext["fixture-user/mat-1/fulltext.txt"] = b"short text"
    response = asyncio.run(_request("GET", "/v1/materials/mat-1/content"))
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert body["previewText"] == "short text"


def test_job_status_returns_async_job(_override_client: FakeUserClient) -> None:
    job = _job()
    job["status"] = "succeeded"
    job["result_id"] = "mat-1"
    job["completed_at"] = "2026-08-14T00:02:00Z"
    _override_client.seed(_material(), jobs=[job])
    response = asyncio.run(_request("GET", "/v1/jobs/job-1"))
    assert response.status_code == 200
    body = response.json()
    assert body["jobId"] == "job-1"
    assert body["status"] == "succeeded"
    assert body["resultId"] == "mat-1"
    assert body["attempt"] == 1


def test_job_status_returns_generation_kind(_override_client: FakeUserClient) -> None:
    job = _job()
    job["kind"] = "generation"
    job["result_id"] = "assessment-1"
    _override_client.seed(_material(), jobs=[job])
    response = asyncio.run(_request("GET", "/v1/jobs/job-1"))
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "generation"
    assert body["resultId"] == "assessment-1"


def test_job_status_missing_job_is_404(_override_client: FakeUserClient) -> None:
    response = asyncio.run(_request("GET", "/v1/jobs/nope"))
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_cross_user_row_is_not_visible(_override_client: FakeUserClient) -> None:
    # RLS scoping is enforced by Supabase; the injected client must raise
    # not_found for rows the caller cannot see, and the API must map it to 404.
    _override_client.seed(_material())
    del _override_client.materials["mat-1"]  # other user's row is invisible
    response = asyncio.run(_request("GET", "/v1/materials/mat-1/ingestion"))
    assert response.status_code == 404
