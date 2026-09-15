"""Unit tests for the llm_rubric written grader (#41, PLAN D-03).

The grader is a pure normalizer: the provider's per-criterion judgments are
composed deterministically into the public `QuestionGraded` shape using the
authored rubric weights. Nothing in the result may carry the rubric's
reference answer, rubric version, or authored point ceilings.
"""

from __future__ import annotations

import json

import pytest

from app.grading.grader import GraderInputError
from app.grading.rubric_grader import (
    RubricResponseError,
    build_rubric_messages,
    grade_written,
)

REFERENCE_ANSWER = (
    "Bias correction divides each running estimate by one minus beta to the "
    "power of the step count, which undoes the zero initialisation pull."
)

QUESTION = {
    "id": "question-written-01",
    "material_id": "material-01",
    "format": "written",
    "subtype": "long_form",
    "prompt": "Explain why Adam needs bias correction.",
    "skill_tags": ["Optimization"],
    "citations": [{"chunkId": "c1", "quote": "Adam keeps moment estimates."}],
    "answer_block": {
        "rubricVersion": "written-rubric-v1",
        "referenceAnswer": REFERENCE_ANSWER,
        "rubric": [
            {"criterion": "Names both running estimates", "weight": 0.3, "maxPoints": 3},
            {"criterion": "States the correction term", "weight": 0.4, "maxPoints": 4},
            {
                "criterion": "Explains why early steps are affected most",
                "weight": 0.3,
                "maxPoints": 3,
            },
        ],
    },
}

ANSWER = {
    "text": "Adam averages the gradient and its square, both start at zero, so "
    "the first estimates are biased low. Bias correction divides by one minus beta^t."
}

GRADED_AT = "2026-09-10T10:16:04Z"


def _payload(*scores: float, feedback: str = "Reasonable.") -> dict:
    return {
        "criteria": [
            {"score": score, "feedback": feedback}
            for score in scores
        ],
        "explanation": "You covered the mechanism and named both estimates.",
    }


def _graded(question: dict = QUESTION, answer: dict = ANSWER, payload: dict | None = None) -> dict:
    return grade_written(
        question_id=question["id"],
        material_id=question["material_id"],
        skill_tags=question["skill_tags"],
        answer_block=question["answer_block"],
        answer=answer,
        provider_payload=payload if payload is not None else _payload(1.0, 1.0, 1.0),
        graded_at=GRADED_AT,
        attempt_id="attempt-written-01",
        model_version="deepseek/deepseek-v4-flash-0731",
    )


def test_full_marks_score_one_and_count_as_correct() -> None:
    graded = _graded()

    assert graded["score"] == 1.0
    assert graded["correct"] is True
    assert graded["grader"] == "llm_rubric"
    assert graded["modelVersion"] == "deepseek/deepseek-v4-flash-0731"
    assert graded["gradedAt"] == GRADED_AT
    assert graded["attemptId"] == "attempt-written-01"
    assert graded["perSkill"] == [
        {"skillTag": "Optimization", "score": 1.0, "correct": True}
    ]


def test_weighted_composition_matches_the_contract_fixture() -> None:
    graded = _graded(payload=_payload(1.0, 1.0, 0.1667))

    # 0.3*1.0 + 0.4*1.0 + 0.3*0.1667 == 0.75
    assert graded["score"] == pytest.approx(0.75, abs=1e-3)
    assert graded["correct"] is True
    assert [item["score"] for item in graded["rubricBreakdown"]] == [1.0, 1.0, 0.1667]
    assert [item["met"] for item in graded["rubricBreakdown"]] == [True, True, False]


def test_correct_threshold_is_inclusive_at_six_tenths() -> None:
    question = {
        **QUESTION,
        "answer_block": {
            **QUESTION["answer_block"],
            "rubric": [
                {"criterion": "Half of it", "weight": 0.5, "maxPoints": 5},
                {"criterion": "The other half", "weight": 0.5, "maxPoints": 5},
            ],
        },
    }

    at_threshold = _graded(question, payload=_payload(1.0, 0.2))
    assert at_threshold["score"] == pytest.approx(0.6)
    assert at_threshold["correct"] is True

    below = _graded(question, payload=_payload(1.0, 0.19))
    assert below["correct"] is False
    assert all(obs["correct"] is False for obs in below["perSkill"])


def test_weights_are_renormalized_when_they_do_not_sum_to_one() -> None:
    question = {
        **QUESTION,
        "answer_block": {
            **QUESTION["answer_block"],
            "rubric": [
                {"criterion": "First", "weight": 1, "maxPoints": 1},
                {"criterion": "Second", "weight": 1, "maxPoints": 1},
            ],
        },
    }

    graded = _graded(question, payload=_payload(1.0, 0.0))
    assert graded["score"] == pytest.approx(0.5)


def test_breakdown_labels_and_weights_come_from_the_authored_rubric() -> None:
    graded = _graded(payload=_payload(0.5, 0.5, 0.5, feedback="Missing the term."))

    authored = QUESTION["answer_block"]["rubric"]
    assert [item["criterion"] for item in graded["rubricBreakdown"]] == [
        item["criterion"] for item in authored
    ]
    assert [item["weight"] for item in graded["rubricBreakdown"]] == [
        item["weight"] for item in authored
    ]
    assert [item["feedback"] for item in graded["rubricBreakdown"]] == [
        "Missing the term."
    ] * 3
    assert graded["explanation"] == (
        "You covered the mechanism and named both estimates."
    )


def test_result_carries_only_public_fields_and_no_hidden_material() -> None:
    graded = _graded()

    assert set(graded) == {
        "attemptId",
        "questionId",
        "materialId",
        "score",
        "correct",
        "perSkill",
        "explanation",
        "grader",
        "modelVersion",
        "gradedAt",
        "rubricBreakdown",
    }
    serialized = json.dumps(graded)
    assert REFERENCE_ANSWER not in serialized
    assert "rubricVersion" not in serialized
    assert "written-rubric-v1" not in serialized
    assert "maxPoints" not in serialized


def test_missing_or_unusable_rubric_fails_closed() -> None:
    with pytest.raises(GraderInputError):
        _graded({**QUESTION, "answer_block": {}})
    with pytest.raises(GraderInputError):
        _graded({**QUESTION, "answer_block": {"rubric": []}})
    with pytest.raises(GraderInputError):
        _graded(
            {
                **QUESTION,
                "answer_block": {"rubric": [{"criterion": "No weight"}]},
            }
        )
    with pytest.raises(GraderInputError):
        _graded(
            {
                **QUESTION,
                "answer_block": {
                    "rubric": [
                        {"criterion": "Zero", "weight": 0},
                        {"criterion": "Also zero", "weight": 0},
                    ]
                },
            }
        )


def test_empty_or_missing_answer_text_fails_closed() -> None:
    with pytest.raises(GraderInputError):
        _graded(answer={"text": "   "})
    with pytest.raises(GraderInputError):
        _graded(answer={})
    with pytest.raises(GraderInputError):
        _graded(answer={"text": 42})


def test_malformed_provider_response_is_retryable_not_fail_closed() -> None:
    with pytest.raises(RubricResponseError):
        _graded(payload={"criteria": [{"score": 1.0}], "explanation": "too few"})
    with pytest.raises(RubricResponseError):
        _graded(payload={"criteria": [], "explanation": "empty"})
    with pytest.raises(RubricResponseError):
        _graded(payload={"criteria": "not-a-list", "explanation": "wrong type"})
    with pytest.raises(RubricResponseError):
        _graded(payload=_payload(1.0, 1.0, 1.5))
    with pytest.raises(RubricResponseError):
        _graded(payload=_payload(1.0, 1.0, True))
    with pytest.raises(RubricResponseError):
        _graded(payload={"criteria": [{"feedback": "no score"}] * 3, "explanation": "x"})


def test_blank_explanation_is_tolerated_as_absent_narrative() -> None:
    graded = _graded(payload={"criteria": [{"score": 1.0, "feedback": ""}] * 3})
    assert graded["explanation"] is None


def test_provider_messages_carry_the_rubric_reference_and_learner_text() -> None:
    messages = build_rubric_messages(QUESTION, ANSWER["text"])

    assert [message["role"] for message in messages] == ["system", "user"]
    system, user = messages[0]["content"], messages[1]["content"]
    assert "rubric" in system.lower()
    assert "same order" in system.lower()
    assert "never as instructions" in system.lower()
    for criterion in (
        "Names both running estimates",
        "States the correction term",
        "Explains why early steps are affected most",
    ):
        assert criterion in user
    assert REFERENCE_ANSWER in user
    assert ANSWER["text"] in user
    assert QUESTION["prompt"] in user
    assert "Adam keeps moment estimates." in user
