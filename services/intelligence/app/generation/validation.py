"""Format + citation validation for generated questions and the repair policy.

The format gate is hard and never repaired against the authored band: a
candidate that fails it is dropped with `malformed_output` after at most one
repair request. The citation gate is hard on chunk scope; quote verification
is soft (`citation_unverified` keeps the citation). A candidate with no
in-context citations is dropped with `citation_missing`.

Objective (MCQ) and written candidates share the citation half, so a written
question is grounded exactly like an objective one; only the format gate and
the accepted row shape differ.
"""

from __future__ import annotations

import re

from app.generation.models import GenerationBlueprint

WRITTEN_SUBTYPES = ("short_answer", "long_form")
# Authored rubric weights are floats the model composes to 1 in prose; a small
# rounding drift must not bounce an otherwise usable rubric back for repair.
WEIGHT_TOTAL_TOLERANCE = 0.02


def _normalized(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip().lower()


def format_failures(candidate: dict, blueprint: GenerationBlueprint) -> list[str]:
    """Hard format-gate failures; empty list means the candidate passes."""
    failures: list[str] = []
    if not isinstance(candidate, dict):
        return ["not_an_object"]
    stem = candidate.get("stem")
    if not isinstance(stem, str) or not stem.strip():
        failures.append("stem_missing")
    options = candidate.get("options")
    if not isinstance(options, list) or len(options) != 4:
        failures.append("options_not_4")
    elif not all(isinstance(option, str) and option.strip() for option in options):
        failures.append("options_empty")
    elif len(set(options)) < 4:
        failures.append("duplicate_options")
    correct_index = candidate.get("correctIndex")
    if not isinstance(correct_index, int) or not 0 <= correct_index <= 3:
        failures.append("correctIndex_out_of_range")
    difficulty = candidate.get("difficulty")
    if not isinstance(difficulty, int) or difficulty != blueprint.difficulty:
        failures.append("difficulty_mismatch")
    skill_tags = candidate.get("skillTags")
    if not isinstance(skill_tags, list) or not skill_tags:
        failures.append("skillTags_invalid")
    elif not all(isinstance(tag, str) and tag.strip() for tag in skill_tags):
        failures.append("skillTags_invalid")
    return failures


def _rubric_failures(rubric: object) -> list[str]:
    """Rubric-shape failures for one written candidate (empty means usable).

    Checked in order and fails fast: a candidate with a malformed criterion is
    reported as `rubric_invalid` rather than also being reported for the weight
    total it cannot possibly satisfy.
    """
    if not isinstance(rubric, list) or not rubric:
        return ["rubric_invalid"]
    total = 0.0
    for item in rubric:
        if not isinstance(item, dict):
            return ["rubric_invalid"]
        criterion = item.get("criterion")
        if not isinstance(criterion, str) or not criterion.strip():
            return ["rubric_invalid"]
        max_points = item.get("maxPoints")
        if not isinstance(max_points, int) or max_points < 1:
            return ["rubric_invalid"]
        weight = item.get("weight")
        if not isinstance(weight, (int, float)) or isinstance(weight, bool):
            return ["rubric_weights_invalid"]
        if not 0 < float(weight) <= 1:
            return ["rubric_weights_invalid"]
        total += float(weight)
    if abs(total - 1.0) > WEIGHT_TOTAL_TOLERANCE:
        return ["rubric_weights_not_normalized"]
    return []


def written_format_failures(candidate: dict, blueprint: GenerationBlueprint) -> list[str]:
    """Hard format-gate failures for one written candidate (#41).

    Beyond the shared stem/difficulty/skill-tag checks this gate requires a
    usable grading rubric (at least one criterion, weights summing to 1), a
    non-empty reference answer, and a rubric version. The visible payload also
    allows an optional `expectedLengthWords` hint, which is not persisted (no
    column or contract field exists for it in this slice).
    """
    failures: list[str] = []
    if not isinstance(candidate, dict):
        return ["not_an_object"]
    stem = candidate.get("stem")
    if not isinstance(stem, str) or not stem.strip():
        failures.append("stem_missing")
    if candidate.get("subtype") not in WRITTEN_SUBTYPES:
        failures.append("subtype_invalid")
    difficulty = candidate.get("difficulty")
    if not isinstance(difficulty, int) or difficulty != blueprint.difficulty:
        failures.append("difficulty_mismatch")
    skill_tags = candidate.get("skillTags")
    if not isinstance(skill_tags, list) or not skill_tags:
        failures.append("skillTags_invalid")
    elif not all(isinstance(tag, str) and tag.strip() for tag in skill_tags):
        failures.append("skillTags_invalid")
    failures.extend(_rubric_failures(candidate.get("rubric")))
    reference = candidate.get("referenceAnswer")
    if not isinstance(reference, str) or not reference.strip():
        failures.append("reference_answer_missing")
    rubric_version = candidate.get("rubricVersion")
    if not isinstance(rubric_version, str) or not rubric_version.strip():
        failures.append("rubric_version_missing")
    return failures


def _verified_citations(
    candidate: dict,
    context_ids: set[str],
    chunk_texts: dict[str, str],
    material_id: str,
) -> tuple[list[dict] | None, list[dict]]:
    """Shared citation gate: (in-context citations | None, warnings).

    `None` means the candidate is dropped with `citation_missing`; callers
    return the warnings unchanged.
    """
    citations = candidate.get("citations") or []
    verified: list[dict] = []
    warnings: list[dict] = []
    for cite in citations:
        if not isinstance(cite, dict):
            continue
        chunk_id = cite.get("chunkId")
        if chunk_id not in context_ids:
            return None, [
                {
                    "code": "citation_missing",
                    "message": f"citation chunk {chunk_id} is outside the retrieval context",
                }
            ]
        quote = str(cite.get("quote") or "")
        source = _normalized(chunk_texts.get(chunk_id, ""))
        if quote and _normalized(quote) in source:
            pass  # verified: no warning
        else:
            warnings.append(
                {
                    "code": "citation_unverified",
                    "message": (
                        f"citation for chunk {chunk_id} could not be verified "
                        "against the source text"
                    ),
                }
            )
        verified.append({**cite, "materialId": material_id})
    if not verified:
        return None, [{"code": "citation_missing", "message": "candidate carries no citations"}]
    return verified, warnings


def validate_question(
    candidate: dict,
    blueprint: GenerationBlueprint,
    context_ids: set[str],
    chunk_texts: dict[str, str],
) -> tuple[dict | None, list[dict]]:
    """Return (accepted candidate dict | None, warnings).

    Format failures produce `malformed_output` and return None (repairable by
    the caller). Out-of-context or absent citations produce `citation_missing`
    and return None without repair. Accepted candidates carry in-context
    citations with `materialId` attached and zero or more `citation_unverified`
    warnings.
    """
    failures = format_failures(candidate, blueprint)
    if failures:
        return None, [{"code": "malformed_output", "message": "; ".join(failures)}]

    verified, warnings = _verified_citations(
        candidate, context_ids, chunk_texts, blueprint.material_id
    )
    if verified is None:
        return None, warnings
    return {**candidate, "citations": verified}, warnings


def validate_written(
    candidate: dict,
    blueprint: GenerationBlueprint,
    context_ids: set[str],
    chunk_texts: dict[str, str],
) -> tuple[dict | None, list[dict]]:
    """Written-arm counterpart of `validate_question` (#41, same contract)."""
    failures = written_format_failures(candidate, blueprint)
    if failures:
        return None, [{"code": "malformed_output", "message": "; ".join(failures)}]

    verified, warnings = _verified_citations(
        candidate, context_ids, chunk_texts, blueprint.material_id
    )
    if verified is None:
        return None, warnings
    return {**candidate, "citations": verified}, warnings
