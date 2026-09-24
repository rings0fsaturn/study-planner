from __future__ import annotations

import asyncio
import json
import os
from datetime import UTC, datetime, timedelta

import httpx
import jwt
import pytest

import app.routers.guide as guide_module
from app.dependencies import get_user_client
from app.generation.models import RetrievedChunk
from app.generation.openrouter_client import GenerationStreamError
from app.ingestion.models import IngestionError
from app.main import app
from app.userrest import QUESTION_PUBLIC_COLUMNS, UserScopedClient

TEST_AUTH_SECRET = "test-supabase-jwt-secret-32-bytes-min"

QUESTION = {
    "id": "q1",
    "assessment_id": "a1",
    "material_id": "m1",
    "format": "coding",
    "subtype": "implement_fn",
    "prompt": "Write is_palindrome(s).",
    "skill_tags": ["Strings"],
}

# Captured before the autouse fixture replaces `_retrieve` with a stub.
_REAL_RETRIEVE = guide_module._retrieve


class FakeUserClient:
    """Owner-scoped double: only the guide's two reads are implemented."""

    def __init__(self) -> None:
        self.question = dict(QUESTION)
        self.attempts: list[dict] = [{"id": "att-1", "assessment_id": "a1", "question_id": "q1"}]
        self.get_question_calls: list[str] = []

    def get_question(self, question_id: str) -> dict:
        self.get_question_calls.append(question_id)
        if question_id != self.question["id"]:
            raise IngestionError("not_found", "question not found")
        return dict(self.question)

    def list_attempts(self, assessment_id: str) -> list[dict]:
        return list(self.attempts)


class FakeAdapter:
    def __init__(self, deltas: list[str] | None = None, error: Exception | None = None) -> None:
        self._deltas = list(deltas or [])
        self._error = error
        self.calls: list[dict] = []

    def stream_text(self, messages: list[dict], *, request_id: str = "", correlation_id: str = ""):
        self.calls.append({"messages": messages, "request_id": request_id})
        yield from self._deltas
        if self._error is not None:
            raise self._error


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
    return {"Authorization": f"Bearer {token}", "Idempotency-Key": "x" * 16}


async def _request(method: str, path: str, body: dict | None = None) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, path, headers=_auth_headers(), json=body)


def _frames(response: httpx.Response) -> list[dict]:
    return [
        json.loads(line[len("data: ") :])
        for line in response.text.splitlines()
        if line.startswith("data: ")
    ]


@pytest.fixture(autouse=True)
def _override_client(monkeypatch: pytest.MonkeyPatch):
    os.environ["SUPABASE_JWT_SECRET"] = TEST_AUTH_SECRET
    fake = FakeUserClient()
    app.dependency_overrides[get_user_client] = lambda: fake
    monkeypatch.setattr(guide_module, "_retrieve", lambda *args, **kwargs: [])
    monkeypatch.setattr(guide_module, "_adapter", None)
    yield fake
    app.dependency_overrides.clear()
    guide_module._adapter = None


def _stream(body: dict | None = None) -> httpx.Response:
    payload = {
        "questionId": "q1",
        "tier": "nudge",
        "learnerWork": "cleaned += c",
        "correlationId": "corr-1",
        "activeLine": 4,
    }
    payload.update(body or {})
    return asyncio.run(_request("POST", "/v1/guide/stream", payload))


def test_stream_orders_frames_with_monotonic_sequence(_override_client: FakeUserClient) -> None:
    guide_module._adapter = FakeAdapter(deltas=["Hel", "lo"])
    response = _stream()
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/event-stream")
    frames = _frames(response)
    assert [f["frame"] for f in frames] == ["start", "delta", "done"]
    assert [f["sequence"] for f in frames] == [0, 1, 2]
    assert frames[0]["text"] == "Hel"
    assert frames[1]["text"] == "lo"
    assert all(f["correlationId"] == "corr-1" for f in frames)


def test_stream_emits_citations_after_start(
    _override_client: FakeUserClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        guide_module,
        "_retrieve",
        lambda *a, **k: [
            RetrievedChunk(chunk_id="c1", material_id="m1", text="body one", ordinal=0)
        ],
    )
    guide_module._adapter = FakeAdapter(deltas=["One"])
    frames = _frames(_stream())
    assert [f["frame"] for f in frames] == ["start", "citation", "done"]
    citation = frames[1]["citations"]
    assert citation == [{"chunkId": "c1", "materialId": "m1", "quote": "body one"}]


def test_stream_error_frame_before_any_delta(_override_client: FakeUserClient) -> None:
    guide_module._adapter = FakeAdapter(
        error=GenerationStreamError("provider_timeout", "deadline", True)
    )
    frames = _frames(_stream())
    assert [f["frame"] for f in frames] == ["error"]
    assert frames[0]["error"]["code"] == "provider_timeout"
    assert frames[0]["error"]["retryable"] is True
    assert isinstance(frames[0]["error"]["requestId"], str)
    assert frames[0]["error"]["requestId"]


def test_stream_error_frame_after_a_delta(_override_client: FakeUserClient) -> None:
    guide_module._adapter = FakeAdapter(
        deltas=["Hel"], error=GenerationStreamError("provider_unavailable", "gone", True)
    )
    frames = _frames(_stream())
    assert [f["frame"] for f in frames] == ["start", "error"]
    assert frames[1]["sequence"] == 1


def test_stream_rejects_unknown_tier(_override_client: FakeUserClient) -> None:
    response = _stream({"tier": "answer"})
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_request"


def test_stream_unknown_question_is_404(_override_client: FakeUserClient) -> None:
    response = _stream({"questionId": "nope"})
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_stream_does_not_leak_hidden_fields(_override_client: FakeUserClient) -> None:
    _override_client.question["answer_block"] = {"correctIndex": 2, "referenceSolution": "SECRET"}
    guide_module._adapter = FakeAdapter(deltas=["Think about the loop."])
    response = _stream()
    assert response.status_code == 200
    assert "answer_block" not in response.text
    assert "referenceSolution" not in response.text
    assert "SECRET" not in response.text
    assert _override_client.get_question_calls == ["q1"]


def test_stream_requires_auth() -> None:
    os.environ["SUPABASE_JWT_SECRET"] = TEST_AUTH_SECRET
    transport = httpx.ASGITransport(app=app)

    async def request_without_token() -> httpx.Response:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post("/v1/guide/stream", json={"questionId": "q1"})

    assert asyncio.run(request_without_token()).status_code == 401


def _reveal(body: dict) -> httpx.Response:
    payload = {
        "questionId": "q1",
        "attemptId": "att-1",
        "confirmation": True,
        "correlationId": "corr-1",
    }
    payload.update(body)
    return asyncio.run(_request("POST", "/v1/guide/reveal", payload))


def test_reveal_requires_confirmation(_override_client: FakeUserClient) -> None:
    response = _reveal({"confirmation": False})
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


def test_reveal_rejects_a_foreign_attempt(_override_client: FakeUserClient) -> None:
    response = _reveal({"attemptId": "someone-else"})
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


def test_reveal_acknowledges_an_owned_attempt_without_content(
    _override_client: FakeUserClient,
) -> None:
    response = _reveal({})
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["gateSatisfied"] is True
    assert payload["questionId"] == "q1"
    assert payload["attemptId"] == "att-1"
    assert payload["explanation"]
    assert "content" not in payload
    assert "referenceSolution" not in response.text


def test_reveal_unknown_question_is_404(_override_client: FakeUserClient) -> None:
    response = _reveal({"questionId": "nope"})
    assert response.status_code == 404


def test_reveal_rejects_an_attempt_on_a_sibling_question(
    _override_client: FakeUserClient,
) -> None:
    # D-05 binds the attempt to the question, not just to the assessment.
    _override_client.attempts = [{"id": "att-1", "assessment_id": "a1", "question_id": "q2"}]
    response = _reveal({})
    assert response.status_code == 403
    assert response.json()["code"] == "forbidden"


def test_retrieve_degrades_on_an_unexpected_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """D-06: a non-IngestionError retrieval crash still yields no citations."""
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "svc")
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")

    def boom(*_args, **_kwargs):
        raise RuntimeError("malformed chunk row")

    monkeypatch.setattr(guide_module, "build_context", boom)
    assert _REAL_RETRIEVE(dict(QUESTION), "cleaned += c", "cleaned += c", "rid-1") == []


def test_get_question_selects_public_columns_only() -> None:
    """The real hidden-content guarantee: the query never names a hidden column."""
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(200, json=[{"id": "q1", "prompt": "Write is_palindrome(s)."}])

    client = UserScopedClient(
        supabase_url="https://example.supabase.co",
        anon_key="anon",
        user_token="token",
        _http=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    row = client.get_question("q1")

    assert row == {"id": "q1", "prompt": "Write is_palindrome(s)."}
    assert f"select={QUESTION_PUBLIC_COLUMNS}" in seen["url"]
    for hidden in ("answer_block", "reference_solution", "hidden_tests", "accepted_value"):
        assert hidden not in QUESTION_PUBLIC_COLUMNS
