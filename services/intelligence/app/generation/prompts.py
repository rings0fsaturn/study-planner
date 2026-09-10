"""Prompt template v1 for grounded MCQ generation plus the JSON schemas.

The prompt shapes mirror the #56 probe (`scripts/generation_probe.py:48-84`)
with the authored difficulty band injected. The #41 written arm adds a second
schema and message builder: one typed call returns the visible written payload
plus the server-only rubric block the grader consumes.
"""

from __future__ import annotations

from app.generation.models import GenerationBlueprint, RetrievedChunk

prompt_template_version = "v1"
# Written generation is a different prompt over the same pipeline, so it
# carries its own version label in telemetry.
WRITTEN_PROMPT_TEMPLATE_VERSION = "written-v1"


def _citation_schema() -> dict:
    """Citations block shared by the MCQ and written schemas (fresh copy)."""
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "chunkId": {"type": "string"},
                "quote": {"type": "string"},
            },
            "required": ["chunkId", "quote"],
            "additionalProperties": False,
        },
        "minItems": 1,
    }


MCQ_SCHEMA = {
    "type": "object",
    "properties": {
        "stem": {"type": "string"},
        "options": {"type": "array", "items": {"type": "string"}, "minItems": 4, "maxItems": 4},
        "correctIndex": {"type": "integer", "minimum": 0, "maximum": 3},
        "difficulty": {"type": "integer", "minimum": 1, "maximum": 5},
        "skillTags": {"type": "array", "items": {"type": "string"}, "minItems": 1},
        "citations": _citation_schema(),
    },
    "required": ["stem", "options", "correctIndex", "difficulty", "skillTags", "citations"],
    "additionalProperties": False,
}

# Written arm (#41): the visible payload (stem, subtype, difficulty, skillTags,
# citations) plus the hidden block that is written to `questions.answer_block`
# and never serialized to a client (rubric, referenceAnswer, rubricVersion).
# Two rubric criteria are required by the schema because a one-criterion rubric
# is holistic grading in disguise (the user chose per-criterion, 2.a); the hard
# gate in `validation.py` stays at one so an otherwise usable rubric is graded
# rather than dropped.
WRITTEN_SCHEMA = {
    "type": "object",
    "properties": {
        "stem": {"type": "string"},
        "subtype": {"type": "string", "enum": ["short_answer", "long_form"]},
        "expectedLengthWords": {"type": "integer", "minimum": 10, "maximum": 1200},
        "difficulty": {"type": "integer", "minimum": 1, "maximum": 5},
        "skillTags": {"type": "array", "items": {"type": "string"}, "minItems": 1},
        "citations": _citation_schema(),
        "rubric": {
            "type": "array",
            "minItems": 2,
            "maxItems": 6,
            "items": {
                "type": "object",
                "properties": {
                    "criterion": {"type": "string"},
                    "weight": {"type": "number", "minimum": 0.05, "maximum": 1},
                    "maxPoints": {"type": "integer", "minimum": 1, "maximum": 100},
                },
                "required": ["criterion", "weight", "maxPoints"],
                "additionalProperties": False,
            },
        },
        "referenceAnswer": {"type": "string"},
        "rubricVersion": {"type": "string"},
    },
    "required": [
        "stem",
        "subtype",
        "difficulty",
        "skillTags",
        "citations",
        "rubric",
        "referenceAnswer",
        "rubricVersion",
    ],
    "additionalProperties": False,
}

SYSTEM_TEMPLATE = (
    "You author one multiple-choice exam question grounded STRICTLY in the provided source chunks. "
    "Rules: cite every chunk you used by its chunkId and quote the exact sentence fragment you "
    "grounded the question on; invent nothing outside the chunks; make distractors plausible but "
    "clearly wrong to an expert; do not copy a full sentence verbatim into the stem; target "
    "difficulty {difficulty_hint}; respond only with the required JSON object."
)

USER_TEMPLATE = (
    "Learner need (topic steer): {steer}\n\nSource chunks:\n{chunks}\n\nAuthor one grounded MCQ."
)

CHUNK_FMT = '<chunk id="{cid}">{text}</chunk>'

REPAIR_SUFFIX = "Return ONLY the corrected JSON object."


def chunk_block(chunks: list[RetrievedChunk]) -> str:
    return "\n".join(CHUNK_FMT.format(cid=chunk.chunk_id, text=chunk.text) for chunk in chunks)


def build_messages(
    blueprint: GenerationBlueprint,
    chunks: list[RetrievedChunk],
    *,
    title: str = "",
    repair_feedback: str | None = None,
    assistant_content: str | None = None,
) -> list[dict]:
    """Assemble the system/user messages (plus one repair pair when asked)."""
    steer = ", ".join(part for part in (title, *blueprint.skill_tags) if part)
    messages: list[dict] = [
        {
            "role": "system",
            "content": SYSTEM_TEMPLATE.format(
                difficulty_hint=f"band {blueprint.difficulty} (1..5)"
            ),
        },
        {
            "role": "user",
            "content": USER_TEMPLATE.format(steer=steer, chunks=chunk_block(chunks)),
        },
    ]
    if repair_feedback is not None:
        if assistant_content is not None:
            messages.append({"role": "assistant", "content": assistant_content})
        messages.append(
            {
                "role": "user",
                "content": f"Validation failures:\n{repair_feedback}\n\n{REPAIR_SUFFIX}",
            }
        )
    return messages


# --- #41 written arm ---

WRITTEN_SYSTEM_TEMPLATE = (
    "You author one written exam question grounded STRICTLY in the provided source chunks, "
    "together with the rubric that will grade the answer. Rules: cite every chunk you used by "
    "its chunkId and quote the exact sentence fragment you grounded the question on; invent "
    "nothing outside the chunks; set subtype to short_answer for a focused explanation a learner "
    "can give in two to four sentences, or to long_form for a multi-part explanation, comparison, "
    "or derivation; author between two and six rubric criteria, each naming something a full-mark "
    "answer must do, whose weights sum to 1; write a reference answer that would earn full "
    "marks; keep the rubric and the reference answer out of the stem; do not copy a full sentence "
    "verbatim into the stem; target difficulty {difficulty_hint}; respond only with the required "
    "JSON object."
)

WRITTEN_USER_TEMPLATE = (
    "Learner need (topic steer): {steer}\n\nSource chunks:\n{chunks}\n\n"
    "Author one grounded written question with its grading rubric and reference answer."
)


def build_written_messages(
    blueprint: GenerationBlueprint,
    chunks: list[RetrievedChunk],
    *,
    title: str = "",
    repair_feedback: str | None = None,
    assistant_content: str | None = None,
) -> list[dict]:
    """Assemble the written-arm system/user messages (plus one repair pair)."""
    steer = ", ".join(part for part in (title, *blueprint.skill_tags) if part)
    messages: list[dict] = [
        {
            "role": "system",
            "content": WRITTEN_SYSTEM_TEMPLATE.format(
                difficulty_hint=f"band {blueprint.difficulty} (1..5)"
            ),
        },
        {
            "role": "user",
            "content": WRITTEN_USER_TEMPLATE.format(steer=steer, chunks=chunk_block(chunks)),
        },
    ]
    if repair_feedback is not None:
        if assistant_content is not None:
            messages.append({"role": "assistant", "content": assistant_content})
        messages.append(
            {
                "role": "user",
                "content": f"Validation failures:\n{repair_feedback}\n\n{REPAIR_SUFFIX}",
            }
        )
    return messages
