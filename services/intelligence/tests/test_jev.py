"""Jev client + question-builder tests (offline: fakes only, no network).

Covers the typed-error contract (codes + retryable survive wrapping), the
missing-answer guard, and every pure router against its cookbook table case.
"""

from __future__ import annotations

import pytest

from app.jev.client import JevClient, JevError, estimate_cost_usd
from app.jev.questions import (
    citation_questions,
    criterion_score_questions,
    passage_questions,
    relevance_question,
    route_citation,
    route_passage,
    route_suitability,
    suitability_questions,
)


class _Answer:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def model_dump(self) -> dict:
        return dict(self._payload)


class _Usage:
    def __init__(self, input_tokens: int, output_tokens: int) -> None:
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens


class _Response:
    def __init__(
        self,
        answers: dict,
        model: str = "typesafe/jev-1.13-20260917",
        usage: _Usage | None = None,
        cost: float | None = None,
    ) -> None:
        self.answers = {qid: _Answer(payload) for qid, payload in answers.items()}
        self.model = model
        self.usage = usage or _Usage(476, 70)
        self._cost = cost

    def model_dump(self) -> dict:
        usage: dict = {
            "input_tokens": self.usage.input_tokens,
            "output_tokens": self.usage.output_tokens,
        }
        if self._cost is not None:
            usage["cost"] = self._cost
        return {"usage": usage}


class _FakeClient:
    def __init__(self, response: _Response | None = None, error: Exception | None = None) -> None:
        self._response = response
        self._error = error
        self.calls: list[dict] = []

    def system_one(self, *, state, questions, model=None):
        self.calls.append({"state": state, "questions": questions, "model": model})
        if self._error is not None:
            raise self._error
        assert self._response is not None
        return self._response


def _client(fake: _FakeClient) -> JevClient:
    return JevClient(api_key="test", client=fake)


def test_decide_ok_extracts_usage_and_cost() -> None:
    fake = _FakeClient(_Response({"is_bug": {"type": "noul", "noul": 0.96}}, cost=0.000019992))
    result = _client(fake).decide(
        {"ticket": "x"}, {"is_bug": {"type": "noul", "instructions": "y?"}}, request_id="r1"
    )
    assert result.answers["is_bug"]["noul"] == 0.96
    assert result.input_tokens == 476
    assert result.cost_usd == pytest.approx(0.000019992)
    assert result.model == "typesafe/jev-1.13-20260917"
    assert result.request_id == "r1"
    assert fake.calls[0]["model"] == "jev-1.13"


def test_decide_missing_answer_is_malformed() -> None:
    fake = _FakeClient(_Response({"other": {"type": "noul", "noul": 0.1}}))
    with pytest.raises(JevError) as excinfo:
        _client(fake).decide(
            {}, {"wanted": {"type": "noul", "instructions": "y?"}}, request_id="r2"
        )
    assert excinfo.value.code == "malformed"
    assert excinfo.value.retryable is False
    assert excinfo.value.request_id == "r2"


def test_decide_error_mapping() -> None:
    import httpx
    from typesafe_sdk import (
        TypeSafeAPIConnectionError,
        TypeSafeAPITimeoutError,
        TypeSafeAuthenticationError,
        TypeSafeBadRequestError,
        TypeSafeRateLimitError,
    )

    def _err(cls: type, status: int, message: str) -> Exception:
        try:
            return cls(status, {"message": message}, httpx.Headers(), message)
        except TypeError:  # timeout/connection errors take a plain message
            return cls(message)

    cases = [
        (_err(TypeSafeAuthenticationError, 401, "bad key"), "provider_credentials", False),
        (_err(TypeSafeRateLimitError, 429, "slow down"), "quota_failure", True),
        (_err(TypeSafeAPITimeoutError, 524, "deadline"), "timeout", True),
        (_err(TypeSafeAPIConnectionError, 503, "conn refused"), "provider_unavailable", True),
        (_err(TypeSafeBadRequestError, 400, "bad shape"), "malformed", False),
    ]
    for error, code, retryable in cases:
        with pytest.raises(JevError) as excinfo:
            _client(_FakeClient(error=error)).decide(
                {}, {"q": {"type": "noul", "instructions": "y?"}}
            )
        assert excinfo.value.code == code, error
        assert excinfo.value.retryable is retryable, error


def test_estimate_cost_usd_input_only() -> None:
    assert estimate_cost_usd(1_000_000) == pytest.approx(0.042)
    assert estimate_cost_usd(476) == pytest.approx(0.000019992)


def test_suitability_questions_shape() -> None:
    questions = suitability_questions()
    assert set(questions) == {"suitability"}
    assert questions["suitability"]["type"] == "choice"
    assert set(questions["suitability"]["criteria"]) == {"derivable", "not_derivable"}


def test_route_suitability() -> None:
    assert route_suitability("derivable", 0.95) == "derivable"
    assert route_suitability("not_derivable", 0.95) == "not_derivable"
    assert route_suitability("derivable", 0.5) == "review"
    assert route_suitability("not_derivable", 0.05) == "not_derivable"


def test_citation_router_table() -> None:
    assert route_citation("supports", 0.93) == ("verified", True)
    assert route_citation("contradicts", 0.99) == ("contradicted", True)
    assert route_citation("says_nothing", 0.27) == ("unsupported", False)
    assert set(citation_questions()) == {"relation"}


def test_passage_router_table() -> None:
    injection = {
        "is_relevant": 0.71,
        "contains_answer_evidence": 0.36,
        "contradicts_query_premise": 0.90,
        "contains_prompt_injection": 0.99,
    }
    assert route_passage(injection) == "exclude"
    conflict = {
        "is_relevant": 0.49,
        "contains_answer_evidence": 0.51,
        "contradicts_query_premise": 0.92,
        "contains_prompt_injection": 0.15,
    }
    assert route_passage(conflict) == "conflicting_evidence"
    evidence = {
        "is_relevant": 0.99,
        "contains_answer_evidence": 0.98,
        "contradicts_query_premise": 0.03,
        "contains_prompt_injection": 0.23,
    }
    assert route_passage(evidence) == "include"
    assert set(passage_questions()) == {
        "is_relevant",
        "contains_answer_evidence",
        "contradicts_query_premise",
        "contains_prompt_injection",
    }
    assert set(relevance_question()) == {"is_relevant"}


def test_criterion_scores_one_per_criterion() -> None:
    questions = criterion_score_questions(["reads the data", "handles empty input"])
    assert set(questions) == {"criterion_0", "criterion_1"}
    assert all(q["type"] == "score" and len(q["criteria"]) == 3 for q in questions.values())
