"""Unit tests for the deterministic objective grader (#39, PLAN D-03)."""

from __future__ import annotations

import pytest

from app.grading.grader import GraderInputError, grade_objective

QUESTION_MCQ = {
    "id": "question-01",
    "material_id": "material-01",
    "format": "objective",
    "skill_tags": ["Caching", "HTTP"],
    "answer_block": {"correctIndex": 2},
}

QUESTION_MULTI = {
    "id": "question-02",
    "material_id": "material-01",
    "format": "objective",
    "skill_tags": ["Consistency"],
    "answer_block": {"correctIndices": [0, 2]},
}

QUESTION_TRUE_FALSE = {
    "id": "question-03",
    "material_id": "material-02",
    "format": "objective",
    "skill_tags": ["Normalization"],
    "answer_block": {"correctFlag": True},
}

QUESTION_CLOZE = {
    "id": "question-04",
    "material_id": "material-02",
    "format": "objective",
    "skill_tags": ["Planning"],
    "answer_block": {"acceptedAnswers": ["planning gap", "the planning gap"]},
}

QUESTION_NUMERIC = {
    "id": "question-05",
    "material_id": "material-02",
    "format": "objective",
    "skill_tags": ["Big-O"],
    "answer_block": {"acceptedValue": 3, "tolerance": 0.5},
}


def _graded(question: dict, answer: dict) -> dict:
    return grade_objective(
        question_id=question["id"],
        material_id=question["material_id"],
        skill_tags=question["skill_tags"],
        answer_block=question["answer_block"],
        answer=answer,
        graded_at="2026-09-03T10:05:04Z",
    )


def test_mcq_correct() -> None:
    graded = _graded(QUESTION_MCQ, {"index": 2})
    assert graded["score"] == 1.0
    assert graded["correct"] is True
    assert graded["grader"] == "objective"
    assert graded["gradedAt"] == "2026-09-03T10:05:04Z"
    assert graded["publicFeedback"] == "Correct."
    assert graded["perSkill"] == [
        {"skillTag": "Caching", "score": 1.0, "correct": True},
        {"skillTag": "HTTP", "score": 1.0, "correct": True},
    ]


def test_mcq_incorrect_scores_zero() -> None:
    graded = _graded(QUESTION_MCQ, {"index": 0})
    assert graded["score"] == 0.0
    assert graded["correct"] is False
    assert graded["publicFeedback"] == "Not correct."
    assert all(obs["correct"] is False for obs in graded["perSkill"])


def test_multi_select_set_equality_ignores_order_and_duplicates() -> None:
    assert _graded(QUESTION_MULTI, {"indices": [2, 0, 0]})["correct"] is True
    assert _graded(QUESTION_MULTI, {"indices": [0, 1]})["correct"] is False


def test_true_false_compares_boolean() -> None:
    assert _graded(QUESTION_TRUE_FALSE, {"flag": True})["correct"] is True
    assert _graded(QUESTION_TRUE_FALSE, {"flag": False})["correct"] is False


def test_cloze_matches_case_insensitive_trimmed() -> None:
    assert _graded(QUESTION_CLOZE, {"value": "  Planning Gap "})["correct"] is True
    assert _graded(QUESTION_CLOZE, {"value": "efficiency gap"})["correct"] is False


def test_numeric_honors_tolerance() -> None:
    assert _graded(QUESTION_NUMERIC, {"value": "3.2"})["correct"] is True
    assert _graded(QUESTION_NUMERIC, {"value": "4"})["correct"] is False


def test_malformed_answer_is_a_validation_error_not_a_zero() -> None:
    with pytest.raises(GraderInputError):
        _graded(QUESTION_MCQ, {"value": "2"})  # mcq needs index
    with pytest.raises(GraderInputError):
        _graded(QUESTION_MULTI, {"index": 1})  # multi_select needs indices


def test_unsupported_answer_block_fails_closed() -> None:
    with pytest.raises(GraderInputError):
        _graded({**QUESTION_MCQ, "answer_block": {}}, {"index": 1})


def test_result_carries_only_public_fields() -> None:
    graded = _graded(QUESTION_MCQ, {"index": 2})
    assert set(graded) == {
        "attemptId",
        "questionId",
        "materialId",
        "score",
        "correct",
        "perSkill",
        "explanation",
        "grader",
        "gradedAt",
        "publicFeedback",
    }
