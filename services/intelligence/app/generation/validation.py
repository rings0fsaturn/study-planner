"""Format + citation validation for generated MCQs and the repair policy.

The format gate is hard and never repaired against the authored band: a
candidate that fails it is dropped with `malformed_output` after at most one
repair request. The citation gate is hard on chunk scope; quote verification
is soft (`citation_unverified` keeps the citation). A candidate with no
in-context citations is dropped with `citation_missing`.
"""

from __future__ import annotations

import re

from app.generation.models import GenerationBlueprint


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
        verified.append({**cite, "materialId": blueprint.material_id})
    if not verified:
        return None, [{"code": "citation_missing", "message": "candidate carries no citations"}]

    accepted = {**candidate, "citations": verified}
    return accepted, warnings
