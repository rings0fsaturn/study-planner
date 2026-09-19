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
# The learner's own answer IS echoed on the owner-scoped attempts read route
# (#40 D-01), so "answer" is allowed here; key material stays banned. The
# written arm's authored rubric text, reference answer, and rubric version are
# server-only (#41 AC1), so their key names are banned too -- "rubricBreakdown"
# stays legal because it is the public per-criterion outcome.
SECRET_KEYS = {
    "answerblock",
    "correctindex",
    "hiddenanswer",
    "rubric",
    "referenceanswer",
    "rubricversion",
}


class FakeUserClient:
    """In-memory UserScopedClient double for the assessment endpoints."""

    def __init__(self) -> None:
        self.materials: dict[str, dict] = {}
        self.jobs: dict[str, dict] = {}
        self.assessments: dict[str, dict] = {}
        self.questions: dict[str, list[dict]] = {}
        self.attempts: list[dict] = []
        self.submitted_jobs: dict[str, dict] = {}

    def seed(self, material: dict) -> None:
        self.materials[material["id"]] = material

    def seed_question(self, question: dict) -> None:
        self.questions.setdefault(question["assessment_id"], []).append(question)

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

    def submit_attempt(
        self,
        assessment_id: str,
        question_id: str,
        body: dict,
        attempt_id: str,
        job_id: str,
    ) -> dict:
        """Mirror of the 025/027/031 submit_assessment_attempt RPC semantics."""
        question = next(
            (q for q in self.questions.get(assessment_id, []) if q["id"] == question_id),
            None,
        )
        if question is None:
            raise IngestionError("not_found", "question not found")
        if question.get("format", "objective") not in (
            "objective",
            "written",
            "coding",
        ):
            raise IngestionError(
                "invalid_request",
                "only objective, written and coding questions grade in this slice",
            )
        client_attempt_id = str(body.get("clientAttemptId") or "")
        for attempt in self.attempts:
            if attempt["client_attempt_id"] == client_attempt_id:
                return {"attemptId": attempt["id"], "replayed": True}
        row = {
            "id": attempt_id,
            "client_attempt_id": client_attempt_id,
            "user_id": "fixture-user",
            "assessment_id": assessment_id,
            "question_id": question_id,
            "answer": body.get("answer"),
            "status": "queued",
            "elapsed_seconds": body.get("elapsedSeconds"),
            "correlation_id": str(body.get("correlationId") or ""),
            "job_id": job_id,
            "submitted_at": body.get("submittedAt"),
            "grade": None,
        }
        self.attempts.append(row)
        job_row = {
            "id": job_id,
            "user_id": "fixture-user",
            "material_id": question["material_id"],
            "kind": "grading",
            "status": "queued",
            "attempt": 1,
            "correlation_id": str(body.get("correlationId") or ""),
            "result_id": attempt_id,
        }
        self.jobs[job_id] = job_row
        self.submitted_jobs[job_id] = job_row
        return {
            "attemptId": attempt_id,
            "questionId": question_id,
            "status": "queued",
            "jobId": job_id,
        }

    def list_attempts(self, assessment_id: str) -> list[dict]:
        return [
            attempt
            for attempt in self.attempts
            if attempt["assessment_id"] == assessment_id
        ]


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


def _material(
    material_id: str = "mat-1", state: str = "ready", page_count: int | None = 572
) -> dict:
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
        "page_count": page_count,
        "page_offset": -33 if page_count else None,
        "outline": None,
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
    body["recipe"]["formats"] = ["adaptive"]
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


def test_generate_assessment_mixed_formats_is_400(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material())
    body = _request_body()
    body["recipe"]["formats"] = ["objective", "written"]
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


def test_generate_assessment_written_format_is_202(_override_client: FakeUserClient) -> None:
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
    assert response.status_code == 202, response.text
    assert response.json()["kind"] == "generation"
    assessment = next(iter(_override_client.assessments.values()))
    assert assessment["recipe"]["formats"] == ["written"]
    assert assessment["status"] == "generating"


def test_generate_assessment_coding_format_is_202(_override_client: FakeUserClient) -> None:
    """#42 P1: the router admits the coding family; the worker arm lands in P3."""
    _override_client.seed(_material())
    body = _request_body()
    body["recipe"]["formats"] = ["coding"]
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=body,
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )
    assert response.status_code == 202, response.text
    assert response.json()["kind"] == "generation"
    assessment = next(iter(_override_client.assessments.values()))
    assert assessment["recipe"]["formats"] == ["coding"]


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


# --- #62 P4: recipe.scope (D-05) ---


def _scoped_body(**scope: object) -> dict:
    body = _request_body()
    body["recipe"]["scope"] = {"pageStart": 156, "pageEnd": 213, **scope}
    return body


def _post_generate(body: dict) -> httpx.Response:
    return asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=body,
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )


def test_generate_assessment_keeps_the_scope_in_the_recipe(
    _override_client: FakeUserClient,
) -> None:
    _override_client.seed(_material())
    response = _post_generate(_scoped_body(sectionLabel="Chapter 5 Budgeting and control"))

    assert response.status_code == 202, response.text
    assessment = next(iter(_override_client.assessments.values()))
    assert assessment["recipe"]["scope"] == {
        "pageStart": 156,
        "pageEnd": 213,
        "sectionLabel": "Chapter 5 Budgeting and control",
    }


def test_generate_assessment_scope_beyond_the_page_count_is_409(
    _override_client: FakeUserClient,
) -> None:
    _override_client.seed(_material())
    response = _post_generate(_scoped_body(pageEnd=600))

    assert response.status_code == 409
    assert response.json()["code"] == "validation_failed"
    assert "572" in response.json()["message"]
    assert not _override_client.assessments


def test_generate_assessment_scope_without_page_numbers_is_409(
    _override_client: FakeUserClient,
) -> None:
    """A url/manual/youtube material has no page numbering to scope by."""
    _override_client.seed(_material(page_count=None))
    response = _post_generate(_scoped_body())

    assert response.status_code == 409
    assert response.json()["code"] == "validation_failed"
    assert not _override_client.assessments


def test_generate_assessment_inverted_scope_is_400(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material())
    response = _post_generate(_scoped_body(pageStart=300, pageEnd=200))

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_request"
    assert "pageStart" in response.json()["message"]


def test_generate_assessment_scope_with_a_non_integer_page_is_400(
    _override_client: FakeUserClient,
) -> None:
    _override_client.seed(_material())
    response = _post_generate(_scoped_body(pageStart="156"))

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_request"


def test_generate_assessment_scope_with_an_unknown_key_is_400(
    _override_client: FakeUserClient,
) -> None:
    """`scope` mirrors the contract's additionalProperties: false."""
    _override_client.seed(_material())
    response = _post_generate(_scoped_body(chapterId="ch-5"))

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_request"
    assert "chapterId" in response.json()["message"]


def test_generate_assessment_without_skill_tags_is_accepted(
    _override_client: FakeUserClient,
) -> None:
    """skillTags is optional in the contract: it must not be defaulted (D-01)."""
    _override_client.seed(_material())
    body = _request_body()
    body["recipe"].pop("skillTags")
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/generate",
            json=body,
            headers={"Idempotency-Key": "idem-key-000000000000"},
        )
    )
    assert response.status_code == 202, response.text
    stored = next(iter(_override_client.assessments.values()))
    assert "skillTags" not in stored["recipe"]


def test_generate_assessment_blank_skill_tag_is_400(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material())
    body = _request_body()
    body["recipe"]["skillTags"] = ["Strategic Planning", "  "]
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


def _seed_generating_assessment(client: FakeUserClient, assessment_id: str = "a1") -> None:
    client.seed(_material())
    client.assessments[assessment_id] = {
        "id": assessment_id,
        "user_id": "fixture-user",
        "client_id": "client-1",
        "material_id": "mat-1",
        "recipe": {"formats": ["written"], "questionCount": 1, "difficulty": 3},
        "status": "generating",
        "warnings": [{"code": "provider_error", "message": "generation interrupted"}],
        "correlation_id": "corr-1",
        "created_at": "2026-08-14T00:00:00Z",
    }


def test_regenerate_assessment_returns_202_async_job(_override_client: FakeUserClient) -> None:
    _seed_generating_assessment(_override_client)
    response = asyncio.run(_request("POST", "/v1/assessments/a1/regenerate"))
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["kind"] == "generation"
    assert body["status"] == "queued"
    assert body["ownerId"] == "fixture-user"
    assert body["resultId"] == "a1"
    assert body["jobId"]
    assert _override_client.jobs[body["jobId"]]["result_id"] == "a1"


def test_regenerate_assessment_ready_is_409(_override_client: FakeUserClient) -> None:
    _seed_generating_assessment(_override_client)
    _override_client.assessments["a1"]["status"] = "ready"
    response = asyncio.run(_request("POST", "/v1/assessments/a1/regenerate"))
    assert response.status_code == 409
    assert response.json()["code"] == "conflict"


def test_regenerate_assessment_failed_is_409(_override_client: FakeUserClient) -> None:
    _seed_generating_assessment(_override_client)
    _override_client.assessments["a1"]["status"] = "failed"
    response = asyncio.run(_request("POST", "/v1/assessments/a1/regenerate"))
    assert response.status_code == 409
    assert response.json()["code"] == "conflict"


def test_regenerate_assessment_missing_material_is_404(_override_client: FakeUserClient) -> None:
    _seed_generating_assessment(_override_client)
    _override_client.materials.clear()
    response = asyncio.run(_request("POST", "/v1/assessments/a1/regenerate"))
    assert response.status_code == 404


def test_regenerate_assessment_material_not_ready_is_409(_override_client: FakeUserClient) -> None:
    _seed_generating_assessment(_override_client)
    _override_client.materials["mat-1"]["ingestion_state"] = "embedding"
    response = asyncio.run(_request("POST", "/v1/assessments/a1/regenerate"))
    assert response.status_code == 409
    assert response.json()["code"] == "validation_failed"


def test_regenerate_assessment_unknown_is_404(_override_client: FakeUserClient) -> None:
    response = asyncio.run(_request("POST", "/v1/assessments/nope/regenerate"))
    assert response.status_code == 404


def test_regenerate_assessment_requires_auth() -> None:
    os.environ["SUPABASE_JWT_SECRET"] = TEST_AUTH_SECRET
    transport = httpx.ASGITransport(app=app)

    async def run() -> httpx.Response:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post("/v1/assessments/a1/regenerate")

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
    # The stored recipe is echoed so a failed generation can be retried with
    # the same family (#41); without it the client guessed from questions[0],
    # which does not exist on a failed generation.
    assert body["recipe"] == {"formats": ["objective"], "questionCount": 1, "difficulty": 3}
    _assert_no_secret_keys(body)


def test_get_assessment_omits_recipe_when_absent(_override_client: FakeUserClient) -> None:
    _override_client.seed(_material())
    _override_client.assessments["a1"] = {
        "id": "a1",
        "user_id": "fixture-user",
        "client_id": "client-1",
        "material_id": "mat-1",
        "recipe": None,
        "status": "generating",
        "warnings": [],
        "correlation_id": "corr-1",
        "created_at": "2026-08-14T00:00:00Z",
        "updated_at": "2026-08-14T00:02:00Z",
    }
    _override_client.questions["a1"] = []
    response = asyncio.run(_request("GET", "/v1/assessments/a1"))
    assert response.status_code == 200, response.text
    assert "recipe" not in response.json()


def test_get_assessment_serializes_written_subtype_and_omits_it_for_objective(
    _override_client: FakeUserClient,
) -> None:
    _override_client.seed(_material())
    _override_client.assessments["a1"] = {
        "id": "a1",
        "user_id": "fixture-user",
        "client_id": "client-1",
        "material_id": "mat-1",
        "recipe": {"formats": ["written"], "questionCount": 1, "difficulty": 3},
        "status": "ready",
        "warnings": [],
        "correlation_id": "corr-1",
        "created_at": "2026-09-10T00:00:00Z",
        "updated_at": "2026-09-10T00:02:00Z",
    }
    _override_client.questions["a1"] = [
        {
            "id": "q-written",
            "assessment_id": "a1",
            "user_id": "fixture-user",
            "material_id": "mat-1",
            "format": "written",
            "subtype": "short_answer",
            "prompt": "Explain bias correction in one paragraph.",
            "options": [],
            "skill_tags": ["Optimization"],
            "authored_difficulty": 2,
            "citations": [{"chunkId": "c1", "materialId": "mat-1", "quote": "shortfall"}],
            "created_at": "2026-09-10T00:02:00Z",
        },
        {
            "id": "q-objective",
            "assessment_id": "a1",
            "user_id": "fixture-user",
            "material_id": "mat-1",
            "format": "objective",
            "prompt": "What is the planning gap?",
            "options": ["Shortfall", "Surplus", "Budget", "Deadline"],
            "skill_tags": ["Strategic Planning"],
            "authored_difficulty": 3,
            "citations": [{"chunkId": "c1", "materialId": "mat-1", "quote": "shortfall"}],
            "created_at": "2026-09-10T00:02:00Z",
        },
    ]
    response = asyncio.run(_request("GET", "/v1/assessments/a1"))
    assert response.status_code == 200, response.text
    body = response.json()
    written, objective = body["questions"]
    assert written["format"] == "written"
    assert written["subtype"] == "short_answer"
    assert written["options"] == []
    assert objective["format"] == "objective"
    assert "subtype" not in objective
    _assert_no_secret_keys(body)


def test_get_assessment_serializes_coding_columns_and_omits_them_for_objective(
    _override_client: FakeUserClient,
) -> None:
    """#42 P1: the visible coding payload rides the public question columns."""
    _override_client.seed(_material())
    _override_client.assessments["a1"] = {
        "id": "a1",
        "user_id": "fixture-user",
        "client_id": "client-1",
        "material_id": "mat-1",
        "recipe": {"formats": ["coding"], "questionCount": 1, "difficulty": 3},
        "status": "ready",
        "warnings": [],
        "correlation_id": "corr-1",
        "created_at": "2026-09-16T00:00:00Z",
        "updated_at": "2026-09-16T00:02:00Z",
    }
    coding = _question(question_id="q-coding", format="coding", subtype="implement_fn")
    coding.update(
        {
            "language": "python",
            "starter_code": "def fib(n: int) -> int:\n    pass\n",
            "visible_tests": [
                {"name": "base cases", "stdin": "", "expectedOutput": "0\n1\n"}
            ],
        }
    )
    _override_client.questions["a1"] = [coding, _question(question_id="q-objective")]
    response = asyncio.run(_request("GET", "/v1/assessments/a1"))
    assert response.status_code == 200, response.text
    body = response.json()
    coding_out, objective_out = body["questions"]
    assert coding_out["format"] == "coding"
    assert coding_out["subtype"] == "implement_fn"
    assert coding_out["language"] == "python"
    assert coding_out["starterCode"] == "def fib(n: int) -> int:\n    pass\n"
    assert coding_out["visibleTests"][0]["name"] == "base cases"
    for key in ("language", "starterCode", "visibleTests"):
        assert key not in objective_out, key
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


# --- #39 assessment taking: attempt submission + read ---


def _question(
    question_id: str = "q-1",
    assessment_id: str = "ass-1",
    format: str = "objective",
    subtype: str | None = None,
) -> dict:
    row = {
        "id": question_id,
        "assessment_id": assessment_id,
        "user_id": "fixture-user",
        "material_id": "mat-1",
        "format": format,
        "prompt": "Which term names the shortfall?",
        "options": ["Planning gap", "Efficiency gap", "Expansion gap", "Diversification gap"],
        "skill_tags": ["Strategic Planning"],
        "authored_difficulty": 3,
        "citations": [{"chunkId": "chunk-1", "quote": "the planning gap is the shortfall"}],
    }
    if subtype is not None:
        row["subtype"] = subtype
    return row


def _attempt_body(
    client_attempt_id: str = "client-attempt-0000001", question_id: str = "q-1"
) -> dict:
    return {
        "clientAttemptId": client_attempt_id,
        "questionId": question_id,
        "answer": {"index": 0},
        "submittedAt": "2026-09-03T10:00:00Z",
        "elapsedSeconds": 30,
        "correlationId": "corr-attempt-1",
    }


def test_submit_assessment_attempt_returns_201_created(
    _override_client: FakeUserClient,
) -> None:
    _override_client.assessments["ass-1"] = {
        "id": "ass-1",
        "user_id": "fixture-user",
        "material_id": "mat-1",
        "status": "ready",
    }
    _override_client.seed_question(_question())
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-1/attempts",
            json=_attempt_body(),
            headers={"Idempotency-Key": "idem-key-000000000001"},
        )
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["attemptId"]
    assert body["questionId"] == "q-1"
    assert body["status"] == "queued"
    assert body["jobId"]
    assert len(_override_client.attempts) == 1
    stored = _override_client.attempts[0]
    assert stored["answer"] == {"index": 0}
    assert stored["grade"] is None
    job = _override_client.jobs[body["jobId"]]
    assert job["kind"] == "grading"
    assert job["result_id"] == body["attemptId"]


def test_submit_assessment_attempt_is_idempotent_on_client_attempt_id(
    _override_client: FakeUserClient,
) -> None:
    _override_client.assessments["ass-1"] = {
        "id": "ass-1",
        "user_id": "fixture-user",
        "material_id": "mat-1",
        "status": "ready",
    }
    _override_client.seed_question(_question())
    headers = {"Idempotency-Key": "idem-key-000000000002"}
    first = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-1/attempts",
            json=_attempt_body(),
            headers=headers,
        )
    )
    replay = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-1/attempts",
            json=_attempt_body(),
            headers=headers,
        )
    )
    assert first.status_code == 201, first.text
    assert replay.status_code == 200, replay.text
    assert replay.json()["attemptId"] == first.json()["attemptId"]
    assert len(_override_client.attempts) == 1


def test_submit_assessment_attempt_unknown_question_is_404(
    _override_client: FakeUserClient,
) -> None:
    _override_client.assessments["ass-1"] = {
        "id": "ass-1",
        "user_id": "fixture-user",
        "material_id": "mat-1",
        "status": "ready",
    }
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-missing/attempts",
            json=_attempt_body(
                client_attempt_id="client-attempt-missing01", question_id="q-missing"
            ),
            headers={"Idempotency-Key": "idem-key-000000000003"},
        )
    )
    assert response.status_code == 404, response.text


def test_submit_assessment_attempt_unsupported_format_is_400(
    _override_client: FakeUserClient,
) -> None:
    _override_client.assessments["ass-1"] = {
        "id": "ass-1",
        "user_id": "fixture-user",
        "material_id": "mat-1",
        "status": "ready",
    }
    _override_client.seed_question(_question(question_id="q-c", format="coding"))
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-c/attempts",
            json=_attempt_body(),
            headers={"Idempotency-Key": "idem-key-000000000004"},
        )
    )
    assert response.status_code == 400, response.text


def _coding_attempt_body(
    source: str = "def fib(n: int) -> int:\n    return n\n",
    client_attempt_id: str = "client-coding-0000001",
    question_id: str = "q-coding",
) -> dict:
    return {
        "clientAttemptId": client_attempt_id,
        "questionId": question_id,
        "answer": {
            "language": "python",
            "source": source,
            "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 128},
        },
        "submittedAt": "2026-09-16T10:00:00Z",
        "elapsedSeconds": 90,
        "correlationId": "corr-coding-1",
    }


def test_submit_assessment_attempt_coding_is_201(
    _override_client: FakeUserClient,
) -> None:
    """#42 P2: the coding arm landed, so a valid coding submit queues."""
    _override_client.assessments["ass-1"] = {
        "id": "ass-1",
        "user_id": "fixture-user",
        "material_id": "mat-1",
        "status": "ready",
    }
    _override_client.seed_question(_question(question_id="q-coding", format="coding"))
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-coding/attempts",
            json=_coding_attempt_body(),
            headers={"Idempotency-Key": "idem-key-000000000005"},
        )
    )
    assert response.status_code == 201, response.text
    assert response.json()["status"] == "queued"
    stored = _override_client.attempts[-1]["answer"]
    assert stored["source"].startswith("def fib")


@pytest.mark.parametrize(
    "answer",
    [
        {
            "language": "javascript",
            "source": "x",
            "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 128},
        },
        {
            "language": "python",
            "source": "",
            "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 128},
        },
        {
            "language": "python",
            "source": "x" * 100001,
            "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 128},
        },
        {"language": "python", "source": "x"},
        {
            "language": "python",
            "source": "x",
            "config": {"stdin": "y" * 20001, "timeLimitMs": 2000, "memoryLimitMb": 128},
        },
        {
            "language": "python",
            "source": "x",
            "config": {"stdin": "", "timeLimitMs": 99, "memoryLimitMb": 128},
        },
        {
            "language": "python",
            "source": "x",
            "config": {"stdin": "", "timeLimitMs": 30001, "memoryLimitMb": 128},
        },
        {
            "language": "python",
            "source": "x",
            "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 15},
        },
        {
            "language": "python",
            "source": "x",
            "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 1025},
        },
    ],
)
def test_submit_assessment_attempt_coding_rejects_bad_shape(
    _override_client: FakeUserClient, answer: dict
) -> None:
    """#42 P2: malformed coding submits are rejected, never queued."""
    _override_client.assessments["ass-1"] = {
        "id": "ass-1",
        "user_id": "fixture-user",
        "material_id": "mat-1",
        "status": "ready",
    }
    _override_client.seed_question(_question(question_id="q-coding", format="coding"))
    body = _coding_attempt_body()
    body["answer"] = answer
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-coding/attempts",
            json=body,
            headers={"Idempotency-Key": "idem-key-000000000006"},
        )
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "invalid_request"
    assert _override_client.attempts == []


def test_submit_assessment_attempt_output_prediction_value_is_admitted(
    _override_client: FakeUserClient,
) -> None:
    """#42 D-01: output_prediction answers are `{value}`, not code."""
    _override_client.assessments["ass-1"] = {
        "id": "ass-1",
        "user_id": "fixture-user",
        "material_id": "mat-1",
        "status": "ready",
    }
    _override_client.seed_question(
        _question(question_id="q-op", format="coding", subtype="output_prediction")
    )
    body = _coding_attempt_body(client_attempt_id="client-op-0000001", question_id="q-op")
    body["answer"] = {"value": "42"}
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-op/attempts",
            json=body,
            headers={"Idempotency-Key": "idem-key-000000000007"},
        )
    )
    assert response.status_code == 201, response.text
    assert _override_client.attempts[-1]["answer"] == {"value": "42"}


def _written_attempt_body(
    text: str = "Bias correction divides each estimate by one minus beta to the step count.",
    client_attempt_id: str = "client-written-0000001",
    question_id: str = "q-written",
) -> dict:
    return {
        "clientAttemptId": client_attempt_id,
        "questionId": question_id,
        "answer": {"text": text},
        "submittedAt": "2026-09-10T10:00:00Z",
        "elapsedSeconds": 120,
        "correlationId": "corr-written-1",
    }


def _seed_written_question(_override_client: FakeUserClient) -> None:
    _override_client.assessments["ass-1"] = {
        "id": "ass-1",
        "user_id": "fixture-user",
        "material_id": "mat-1",
        "status": "ready",
    }
    _override_client.seed_question(
        _question(question_id="q-written", format="written", subtype="long_form")
    )


def test_submit_assessment_attempt_written_is_201_and_grades(
    _override_client: FakeUserClient,
) -> None:
    _seed_written_question(_override_client)
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-written/attempts",
            json=_written_attempt_body(),
            headers={"Idempotency-Key": "idem-key-000000000006"},
        )
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["questionId"] == "q-written"
    stored = _override_client.attempts[0]
    assert stored["answer"] == {"text": _written_attempt_body()["answer"]["text"]}
    job = _override_client.jobs[body["jobId"]]
    assert job["kind"] == "grading"


@pytest.mark.parametrize("text", ["", "   ", "\n\t "])
def test_submit_assessment_attempt_empty_written_text_is_400(
    _override_client: FakeUserClient, text: str
) -> None:
    _seed_written_question(_override_client)
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-written/attempts",
            json=_written_attempt_body(text=text),
            headers={"Idempotency-Key": "idem-key-000000000007"},
        )
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "invalid_request"
    assert _override_client.attempts == []


def test_submit_assessment_attempt_non_string_written_text_is_400(
    _override_client: FakeUserClient,
) -> None:
    _seed_written_question(_override_client)
    body = _written_attempt_body()
    body["answer"] = {"text": 12345}
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-written/attempts",
            json=body,
            headers={"Idempotency-Key": "idem-key-000000000008"},
        )
    )
    assert response.status_code == 400, response.text
    assert _override_client.attempts == []


def test_submit_assessment_attempt_oversized_written_text_is_400(
    _override_client: FakeUserClient,
) -> None:
    _seed_written_question(_override_client)
    response = asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-written/attempts",
            json=_written_attempt_body(text="x" * 20001),
            headers={"Idempotency-Key": "idem-key-000000000009"},
        )
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "invalid_request"
    assert _override_client.attempts == []


def test_list_assessment_attempts_returns_public_records(
    _override_client: FakeUserClient,
) -> None:
    _override_client.assessments["ass-1"] = {
        "id": "ass-1",
        "user_id": "fixture-user",
        "material_id": "mat-1",
        "status": "ready",
    }
    _override_client.seed_question(_question())
    asyncio.run(
        _request(
            "POST",
            "/v1/assessments/ass-1/questions/q-1/attempts",
            json=_attempt_body(),
            headers={"Idempotency-Key": "idem-key-000000000005"},
        )
    )
    response = asyncio.run(_request("GET", "/v1/assessments/ass-1/attempts"))
    assert response.status_code == 200, response.text
    records = response.json()
    assert len(records) == 1
    record = records[0]
    assert record["attemptId"]
    assert record["questionId"] == "q-1"
    assert record["assessmentId"] == "ass-1"
    assert record["status"] == "queued"
    assert record["grade"] is None
    # D-01: the learner's own answer echoes on the owner-scoped read route;
    # the key stays out because it lives in questions.answer_block.
    assert record["answer"] == {"index": 0}
    _assert_no_secret_keys(record)
    assert "answer_block" not in record
    assert "correctIndex" not in record
