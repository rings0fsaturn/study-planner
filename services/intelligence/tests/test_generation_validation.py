from __future__ import annotations

import pytest

from app.generation.models import GenerationBlueprint
from app.generation.validation import format_failures, validate_question

CONTEXT_IDS = {"c1", "c2"}
CHUNK_TEXTS = {
    "c1": "The planning gap is the shortfall between forecast and target.",
    "c2": "Porter's five forces shape industry competition.",
}


def blueprint(difficulty: int = 3) -> GenerationBlueprint:
    return GenerationBlueprint(
        assessment_id="a1",
        job_id="j1",
        owner_id="u1",
        material_id="m1",
        difficulty=difficulty,
        skill_tags=("core",),
        correlation_id="c1",
    )


def valid_candidate() -> dict:
    return {
        "stem": "What does the planning gap measure?",
        "options": ["Shortfall vs target", "Budget surplus", "Headcount", "Cycle time"],
        "correctIndex": 0,
        "difficulty": 3,
        "skillTags": ["Strategic Planning"],
        "citations": [{"chunkId": "c1", "quote": "the shortfall between forecast and target"}],
    }


def test_format_gate_accepts_valid_candidate() -> None:
    failures = format_failures(valid_candidate(), blueprint())
    assert failures == []


@pytest.mark.parametrize(
    ("mutator", "expected"),
    [
        (lambda c: c.pop("stem"), "stem_missing"),
        (lambda c: c.update(stem="   "), "stem_missing"),
        (lambda c: c.update(options=["a", "b", "c"]), "options_not_4"),
        (lambda c: c.update(options=["a", "a", "b", "c"]), "duplicate_options"),
        (lambda c: c.update(options=["a", "", "b", "c"]), "options_empty"),
        (lambda c: c.update(correctIndex=9), "correctIndex_out_of_range"),
        (lambda c: c.update(correctIndex="0"), "correctIndex_out_of_range"),
        (lambda c: c.update(difficulty=4), "difficulty_mismatch"),
        (lambda c: c.update(difficulty=None), "difficulty_mismatch"),
        (lambda c: c.pop("skillTags"), "skillTags_invalid"),
        (lambda c: c.update(skillTags=[]), "skillTags_invalid"),
        (lambda c: c.update(skillTags=["core", ""]), "skillTags_invalid"),
    ],
)
def test_format_gate_rejects_each_failure_kind(mutator, expected: str) -> None:
    candidate = valid_candidate()
    mutator(candidate)
    failures = format_failures(candidate, blueprint())
    assert expected in failures


def test_format_gate_rejects_non_object() -> None:
    assert format_failures("not-a-dict", blueprint())[0] == "not_an_object"  # type: ignore[arg-type]


def test_validate_question_accepts_in_context_citations() -> None:
    accepted, warnings = validate_question(valid_candidate(), blueprint(), CONTEXT_IDS, CHUNK_TEXTS)
    assert accepted is not None
    assert accepted["citations"] == [
        {"chunkId": "c1", "quote": "the shortfall between forecast and target", "materialId": "m1"}
    ]
    assert warnings == []


def test_validate_question_drops_out_of_context_citation() -> None:
    candidate = valid_candidate()
    candidate["citations"] = [{"chunkId": "nope", "quote": "x"}]
    accepted, warnings = validate_question(candidate, blueprint(), CONTEXT_IDS, CHUNK_TEXTS)
    assert accepted is None
    assert warnings[0]["code"] == "citation_missing"


def test_validate_question_drops_mixed_citations_with_out_of_context() -> None:
    candidate = valid_candidate()
    candidate["citations"] = [
        {"chunkId": "c1", "quote": "the shortfall between forecast and target"},
        {"chunkId": "nope", "quote": "x"},
    ]
    accepted, warnings = validate_question(candidate, blueprint(), CONTEXT_IDS, CHUNK_TEXTS)
    assert accepted is None
    assert warnings[0]["code"] == "citation_missing"


def test_validate_question_drops_candidate_without_citations() -> None:
    candidate = valid_candidate()
    candidate["citations"] = []
    accepted, warnings = validate_question(candidate, blueprint(), CONTEXT_IDS, CHUNK_TEXTS)
    assert accepted is None
    assert warnings[0]["code"] == "citation_missing"


def test_validate_question_keeps_unverified_quote_with_warning() -> None:
    candidate = valid_candidate()
    candidate["citations"] = [{"chunkId": "c1", "quote": "invented quote not in the chunk"}]
    accepted, warnings = validate_question(candidate, blueprint(), CONTEXT_IDS, CHUNK_TEXTS)
    assert accepted is not None
    assert accepted["citations"][0]["chunkId"] == "c1"
    assert warnings == [{"code": "citation_unverified", "message": warnings[0]["message"]}]
    assert warnings[0]["code"] == "citation_unverified"


def test_validate_question_empty_quote_is_unverified_not_dropped() -> None:
    candidate = valid_candidate()
    candidate["citations"] = [{"chunkId": "c1", "quote": ""}]
    accepted, warnings = validate_question(candidate, blueprint(), CONTEXT_IDS, CHUNK_TEXTS)
    assert accepted is not None
    assert warnings[0]["code"] == "citation_unverified"


def test_validate_question_quote_is_substring_insensitive_to_whitespace() -> None:
    candidate = valid_candidate()
    candidate["citations"] = [{"chunkId": "c1", "quote": "  the   shortfall  between  "}]
    accepted, warnings = validate_question(candidate, blueprint(), CONTEXT_IDS, CHUNK_TEXTS)
    assert accepted is not None
    assert warnings == []


def test_validate_question_difficulty_mismatch_is_repairable_not_citation() -> None:
    candidate = valid_candidate()
    candidate["difficulty"] = 5
    accepted, warnings = validate_question(
        candidate, blueprint(difficulty=3), CONTEXT_IDS, CHUNK_TEXTS
    )
    assert accepted is None
    assert warnings[0]["code"] == "malformed_output"


def test_validate_question_non_object_is_malformed() -> None:
    accepted, warnings = validate_question({}, blueprint(), CONTEXT_IDS, CHUNK_TEXTS)  # type: ignore[arg-type]
    assert accepted is None
    assert warnings[0]["code"] == "malformed_output"
