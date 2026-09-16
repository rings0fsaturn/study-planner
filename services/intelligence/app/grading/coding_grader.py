"""Coding grading arm (#42, PLAN D-02/D-05/D-07).

The worker executes the authored tests through the sandbox client and this
module composes the public `QuestionGraded` from the per-test verdicts.
Composition is deterministic: `score` is the hidden-test pass rate, `correct`
uses the shared map-#6 threshold, per-skill observations ride the shared
shape, and the public `testCases` table never carries hidden content (hidden
tests are named `Hidden test N`).

The fourth subtype, `output_prediction`, never touches the sandbox (D-01):
it is a deterministic value match reusing `grade_objective` with the
`acceptedValue` key. The sandbox vendor is an internal detail: the grader
enum value `judge0` is the contract label for the whole coding arm.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.grading.grader import (
    CORRECT_THRESHOLD,
    GraderInputError,
    per_skill_observations,
)
from app.grading.piston_client import (
    RUN_COMPILE_ERROR,
    RUN_PASSED,
    RUN_RUNTIME_ERROR,
    RUN_TIMEOUT,
)

GRADER_NAME = "judge0"
SCORE_PRECISION = 4

OUTPUT_PREDICTION_SUBTYPE = "output_prediction"

CODING_LANGUAGE = "python"
CODING_SOURCE_MAX_LENGTH = 100000
CODING_STDIN_MAX_LENGTH = 20000
TIME_LIMIT_MIN_MS = 100
TIME_LIMIT_MAX_MS = 30000
MEMORY_MIN_MB = 16
MEMORY_MAX_MB = 1024
MAX_VISIBLE_TESTS = 3
MAX_HIDDEN_TESTS = 10


@dataclass(frozen=True)
class TestVerdict:
    """One public per-test verdict: name, visibility, and outcome."""

    __test__ = False  # data class, not a pytest collection target

    name: str
    visible: bool
    outcome: str

    @property
    def passed(self) -> bool:
        return self.outcome == RUN_PASSED


def hidden_test_name(index: int) -> str:
    """The public veil for hidden tests: `Hidden test N`, never content."""
    return f"Hidden test {index}"


def coding_submission(answer: Any) -> tuple[str, int, int]:
    """The learner's validated `(source, time_limit_ms, memory_limit_mb)`.

    Raises `GraderInputError` on any unusable shape; the router enforces the
    same caps on submit, so a malformed answer here is a storage-drift bug.
    The learner's `config.stdin` is advisory (client-side runs only): the
    authored tests carry their own stdin, and feeding learner input into a
    hidden test would corrupt its expected output.
    """
    if not isinstance(answer, dict):
        raise GraderInputError("coding answer requires an object")
    if answer.get("language") != CODING_LANGUAGE:
        raise GraderInputError(f"coding answers support {CODING_LANGUAGE} only")
    source = answer.get("source")
    if not isinstance(source, str) or not source.strip():
        raise GraderInputError("coding answer has no source")
    if len(source) > CODING_SOURCE_MAX_LENGTH:
        raise GraderInputError(
            f"coding source exceeds {CODING_SOURCE_MAX_LENGTH} characters"
        )
    config = answer.get("config")
    if not isinstance(config, dict):
        raise GraderInputError("coding answer has no config")
    stdin = config.get("stdin")
    if isinstance(stdin, bool) or not isinstance(stdin, str):
        raise GraderInputError("coding stdin must be a string")
    if len(stdin) > CODING_STDIN_MAX_LENGTH:
        raise GraderInputError(f"coding stdin exceeds {CODING_STDIN_MAX_LENGTH} characters")
    time_limit_ms = config.get("timeLimitMs")
    if (
        isinstance(time_limit_ms, bool)
        or not isinstance(time_limit_ms, int)
        or not TIME_LIMIT_MIN_MS <= time_limit_ms <= TIME_LIMIT_MAX_MS
    ):
        raise GraderInputError(
            f"timeLimitMs must be an integer from {TIME_LIMIT_MIN_MS} to {TIME_LIMIT_MAX_MS}"
        )
    memory_limit_mb = config.get("memoryLimitMb")
    if (
        isinstance(memory_limit_mb, bool)
        or not isinstance(memory_limit_mb, int)
        or not MEMORY_MIN_MB <= memory_limit_mb <= MEMORY_MAX_MB
    ):
        raise GraderInputError(
            f"memoryLimitMb must be an integer from {MEMORY_MIN_MB} to {MEMORY_MAX_MB}"
        )
    return source, time_limit_ms, memory_limit_mb


def _validate_tests(raw: Any, what: str, *, maximum: int) -> list[dict]:
    if not isinstance(raw, list) or not raw:
        raise GraderInputError(f"coding question has no authored {what}s")
    if len(raw) > maximum:
        raise GraderInputError(f"coding question carries more than {maximum} {what}s")
    tests: list[dict] = []
    for index, item in enumerate(raw):
        if not isinstance(item, dict):
            raise GraderInputError(f"{what} {index + 1} is not an object")
        name = item.get("name")
        stdin = item.get("stdin")
        expected = item.get("expectedOutput")
        if not isinstance(name, str) or not name.strip():
            raise GraderInputError(f"{what} {index + 1} has no name")
        if isinstance(stdin, bool) or not isinstance(stdin, str):
            raise GraderInputError(f"{what} {index + 1} stdin must be a string")
        if len(stdin) > CODING_STDIN_MAX_LENGTH:
            raise GraderInputError(f"{what} {index + 1} stdin is too long")
        if isinstance(expected, bool) or not isinstance(expected, str):
            raise GraderInputError(f"{what} {index + 1} has no expectedOutput")
        if len(expected) > CODING_STDIN_MAX_LENGTH:
            raise GraderInputError(f"{what} {index + 1} expectedOutput is too long")
        tests.append(item)
    return tests


def visible_tests(question: Any) -> list[dict]:
    """The learner-visible tests; absent or empty when the question has none."""
    raw = question.get("visible_tests") if isinstance(question, dict) else None
    if raw is None:
        return []
    return _validate_tests(raw, "visible test", maximum=MAX_VISIBLE_TESTS)


def hidden_tests(answer_block: Any) -> list[dict]:
    """The server-only hidden tests from `answer_block` (D-09 boundary)."""
    if not isinstance(answer_block, dict):
        raise GraderInputError("coding question has no answer_block")
    return _validate_tests(
        answer_block.get("hiddenTests"), "hidden test", maximum=MAX_HIDDEN_TESTS
    )


def _feedback(verdicts: list[TestVerdict], passed: int, total: int) -> str:
    """Deterministic template words (D-07); the table carries the detail."""
    if any(verdict.outcome == RUN_COMPILE_ERROR for verdict in verdicts):
        return "Your code did not compile."
    if any(verdict.outcome == RUN_TIMEOUT for verdict in verdicts):
        return "Your submission timed out."
    if any(verdict.outcome == RUN_RUNTIME_ERROR for verdict in verdicts):
        return "Your submission raised a runtime error."
    return f"Passed {passed}/{total} hidden tests."


def grade_coding(
    *,
    question_id: str,
    material_id: str,
    skill_tags: list[str],
    verdicts: list[TestVerdict],
    graded_at: str,
    attempt_id: str = "",
) -> dict[str, Any]:
    """Compose one public `QuestionGraded` from the per-test verdicts.

    Raises `GraderInputError` when the verdict list cannot produce a score
    (no verdicts at all, or no hidden verdicts): fail closed, never fabricate.
    """
    if not verdicts:
        raise GraderInputError("coding grading received no test verdicts")
    hidden = [verdict for verdict in verdicts if not verdict.visible]
    total = len(hidden)
    if total == 0:
        raise GraderInputError("coding question has no hidden tests")
    passed = sum(1 for verdict in hidden if verdict.passed)
    score = round(passed / total, SCORE_PRECISION)
    return {
        "attemptId": attempt_id,
        "questionId": question_id,
        "materialId": material_id,
        "score": score,
        "correct": score >= CORRECT_THRESHOLD,
        "perSkill": per_skill_observations(list(skill_tags), score),
        "explanation": None,
        "grader": GRADER_NAME,
        "gradedAt": graded_at,
        "publicFeedback": _feedback(verdicts, passed, total),
        "testCases": [
            {"name": verdict.name, "passed": verdict.passed, "visible": verdict.visible}
            for verdict in verdicts
        ],
    }