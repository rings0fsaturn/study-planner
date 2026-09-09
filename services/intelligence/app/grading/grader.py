"""Deterministic objective grading (#39, PLAN D-03).

Compares the learner's submitted answer against the server-only
`questions.answer_block` and produces the public `QuestionGraded` shape.
No key material ever appears in the result: the output carries only
score / correct / perSkill / publicFeedback.

Objective grading is deterministic per PIPELINES.md; richer natural-language
feedback is the #50 contract and is intentionally out of scope here.
"""

from __future__ import annotations

from typing import Any

# Per-skill binary correctness threshold (map #6: tau ~= 0.6). A normalized
# score of exactly 1.0 is correct; anything below is not. The threshold is
# applied per observation so a future partial-credit grader can reuse it.
CORRECT_THRESHOLD = 0.6

MCQ_KEY = "correctIndex"
MULTI_KEY = "correctIndices"
TRUE_FALSE_KEY = "correctFlag"
CLOZE_KEY = "acceptedAnswers"
NUMERIC_KEY = "acceptedValue"


class GraderInputError(ValueError):
    """The submitted answer or the stored key is unusable; fail closed."""


def _per_skill(skill_tags: list[str], score: float) -> list[dict[str, Any]]:
    correct = score >= CORRECT_THRESHOLD
    return [
        {"skillTag": tag, "score": score, "correct": correct}
        for tag in skill_tags
    ]


def _as_index_list(value: Any) -> list[int] | None:
    if not isinstance(value, list) or not value:
        return None
    if not all(isinstance(item, int) and not isinstance(item, bool) for item in value):
        return None
    return value


def _normalized_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    return value.strip().casefold()


def _as_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def grade_objective(
    *,
    question_id: str,
    material_id: str,
    skill_tags: list[str],
    answer_block: dict[str, Any],
    answer: dict[str, Any],
    graded_at: str,
    attempt_id: str = "",
) -> dict[str, Any]:
    """Grade one objective answer. Raises GraderInputError on unusable input."""
    if not isinstance(answer_block, dict) or not answer_block:
        raise GraderInputError("answer_block is empty or not an object")

    if MCQ_KEY in answer_block:
        correct_index = answer_block[MCQ_KEY]
        index = answer.get("index")
        if not isinstance(correct_index, int) or isinstance(correct_index, bool):
            raise GraderInputError(f"{MCQ_KEY} must be an integer")
        if not isinstance(index, int) or isinstance(index, bool):
            raise GraderInputError("mcq answer requires an integer index")
        score = 1.0 if index == correct_index else 0.0
    elif MULTI_KEY in answer_block:
        expected = _as_index_list(answer_block[MULTI_KEY])
        submitted = _as_index_list(answer.get("indices"))
        if expected is None:
            raise GraderInputError(f"{MULTI_KEY} must be a non-empty integer list")
        if submitted is None:
            raise GraderInputError("multi_select answer requires indices")
        score = 1.0 if set(submitted) == set(expected) else 0.0
    elif TRUE_FALSE_KEY in answer_block:
        expected = answer_block[TRUE_FALSE_KEY]
        flag = answer.get("flag")
        if not isinstance(expected, bool) or not isinstance(flag, bool):
            raise GraderInputError(f"{TRUE_FALSE_KEY} and answer.flag must be booleans")
        score = 1.0 if flag == expected else 0.0
    elif CLOZE_KEY in answer_block:
        accepted = answer_block[CLOZE_KEY]
        if not isinstance(accepted, list) or not accepted:
            raise GraderInputError(f"{CLOZE_KEY} must be a non-empty string list")
        submitted = _normalized_text(answer.get("value"))
        if submitted is None:
            raise GraderInputError("cloze answer requires value")
        score = 1.0 if submitted in {_normalized_text(item) for item in accepted} else 0.0
    elif NUMERIC_KEY in answer_block:
        expected = _as_number(answer_block[NUMERIC_KEY])
        submitted = _as_number(answer.get("value"))
        if expected is None:
            raise GraderInputError(f"{NUMERIC_KEY} must be numeric")
        if submitted is None:
            raise GraderInputError("numeric answer requires a numeric value")
        tolerance = _as_number(answer_block.get("tolerance", 0)) or 0.0
        score = 1.0 if abs(submitted - expected) <= tolerance else 0.0
    else:
        raise GraderInputError("answer_block carries no supported objective key")

    correct = score >= CORRECT_THRESHOLD
    return {
        "attemptId": attempt_id,
        "questionId": question_id,
        "materialId": material_id,
        "score": score,
        "correct": correct,
        "perSkill": _per_skill(skill_tags, score),
        "explanation": None,
        "grader": "objective",
        "gradedAt": graded_at,
        "publicFeedback": "Correct." if correct else "Not correct.",
    }
