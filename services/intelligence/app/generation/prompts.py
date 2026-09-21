"""Prompt template v1 for grounded MCQ generation plus the JSON schemas.

The prompt shapes mirror the #56 probe (`scripts/generation_probe.py:48-84`)
with the authored difficulty band injected. The #41 written arm adds a second
schema and message builder: one typed call returns the visible written payload
plus the server-only rubric block the grader consumes. The #42 coding arm adds
a third: one call returns either the judge rejection, a tests-bearing question
with its reference solution, or an output_prediction question.
"""

from __future__ import annotations

from collections.abc import Iterable

from app.generation.models import GenerationBlueprint, RetrievedChunk
from app.grading.coding_grader import (
    CODING_LANGUAGE,
    CODING_STDIN_MAX_LENGTH,
    MAX_HIDDEN_TESTS,
    MAX_VISIBLE_TESTS,
)

prompt_template_version = "v1"
# Written generation is a different prompt over the same pipeline, so it
# carries its own version label in telemetry.
WRITTEN_PROMPT_TEMPLATE_VERSION = "written-v1"
CODING_PROMPT_TEMPLATE_VERSION = "coding-v2"


def _citation_schema(citation_ids: Iterable[str] | None = None) -> dict:
    """Citations block shared by the MCQ and written schemas (fresh copy).

    With `citation_ids`, `chunkId` is enum-constrained to this generation's
    retrieval context, so the provider cannot emit a chunk id that does not
    exist. Without it any string passes the schema and only the citation gate
    catches it, which fails the whole generation: live 2026-09-11 the written
    arm returned the same invented id on four consecutive attempts, so every
    "Retry generation" repeated the same failure.
    """
    chunk_id: dict = {"type": "string"}
    if citation_ids:
        chunk_id = {"type": "string", "enum": sorted(citation_ids)}
    return {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "chunkId": chunk_id,
                "quote": {"type": "string"},
            },
            "required": ["chunkId", "quote"],
            "additionalProperties": False,
        },
        "minItems": 1,
    }


def mcq_schema(citation_ids: Iterable[str] | None = None) -> dict:
    """Objective-arm response schema, bound to the retrieved ids when given."""
    return {
        "type": "object",
        "properties": {
            "stem": {"type": "string"},
            "options": {"type": "array", "items": {"type": "string"}, "minItems": 4, "maxItems": 4},
            "correctIndex": {"type": "integer", "minimum": 0, "maximum": 3},
            "difficulty": {"type": "integer", "minimum": 1, "maximum": 5},
            "skillTags": {"type": "array", "items": {"type": "string"}, "minItems": 1},
            "citations": _citation_schema(citation_ids),
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
def written_schema(citation_ids: Iterable[str] | None = None) -> dict:
    """Written-arm response schema, bound to the retrieved ids when given."""
    return {
        "type": "object",
        "properties": {
            "stem": {"type": "string"},
            "subtype": {"type": "string", "enum": ["short_answer", "long_form"]},
            "expectedLengthWords": {"type": "integer", "minimum": 10, "maximum": 1200},
            "difficulty": {"type": "integer", "minimum": 1, "maximum": 5},
            "skillTags": {"type": "array", "items": {"type": "string"}, "minItems": 1},
            "citations": _citation_schema(citation_ids),
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


# D-02: both arms carry this blocklist verbatim. Nothing forbade exam-format
# questions before, so on a front-matter steer the model authored them for
# 25/25 stored questions; the blocklist is the arm that holds even when the
# retrieved chunks are meta (an unscoped steer, a material with no outline).
META_BLOCKLIST = (
    "The question must test one concept, technique or piece of subject content from those "
    "chunks - define or identify it, explain why or how it works, compare it with a related "
    "idea, apply it to a scenario, or compute with it. Never ask about the examination, the "
    "syllabus, marks, duration, pass marks, section structure or question formats; never ask "
    "about study or revision guidance, how to use the material, or the structure of the "
    "document (its chapters, contents, index or page layout); never ask about the material or "
    "study text itself. If the chunks carry only that kind of front or back matter, still ask "
    "the closest subject-content question they support. "
)

SYSTEM_TEMPLATE = (
    "You author one multiple-choice exam question grounded STRICTLY in the provided source chunks. "
    + META_BLOCKLIST
    + "Rules: cite every chunk you used by its chunkId and quote the exact sentence fragment you "
    "grounded the question on; invent nothing outside the chunks; make distractors plausible but "
    "clearly wrong to an expert; do not copy a full sentence verbatim into the stem; target "
    "difficulty {difficulty_hint}; respond only with the required JSON object."
)

# {title_line} carries the material title as document context (never as the
# steer: the title is what retrieved the cover and the contents page, D-01).
USER_TEMPLATE = (
    "{title_line}Learner need (topic steer): {steer}\n\n"
    "Source chunks:\n{chunks}\n\nAuthor one grounded MCQ."
)

CHUNK_FMT = '<chunk id="{cid}">{text}</chunk>'

REPAIR_SUFFIX = "Return ONLY the corrected JSON object."


def chunk_block(chunks: list[RetrievedChunk]) -> str:
    return "\n".join(CHUNK_FMT.format(cid=chunk.chunk_id, text=chunk.text) for chunk in chunks)


def _topic_steer(blueprint: GenerationBlueprint) -> str:
    """The topic steer: the learner's skill tags, never the material title (D-01)."""
    return ", ".join(tag for tag in blueprint.skill_tags if tag)


def _title_line(title: str) -> str:
    """The material title as document context; empty when the caller has none."""
    return f"Material: {title}\n" if title else ""


def build_messages(
    blueprint: GenerationBlueprint,
    chunks: list[RetrievedChunk],
    *,
    title: str = "",
    repair_feedback: str | None = None,
    assistant_content: str | None = None,
) -> list[dict]:
    """Assemble the system/user messages (plus one repair pair when asked)."""
    messages: list[dict] = [
        {
            "role": "system",
            "content": SYSTEM_TEMPLATE.format(
                difficulty_hint=f"band {blueprint.difficulty} (1..5)"
            ),
        },
        {
            "role": "user",
            "content": USER_TEMPLATE.format(
                title_line=_title_line(title),
                steer=_topic_steer(blueprint),
                chunks=chunk_block(chunks),
            ),
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
    "together with the rubric that will grade the answer. "
    + META_BLOCKLIST
    + "Rules: cite every chunk you used by "
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
    "{title_line}Learner need (topic steer): {steer}\n\nSource chunks:\n{chunks}\n\n"
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
    messages: list[dict] = [
        {
            "role": "system",
            "content": WRITTEN_SYSTEM_TEMPLATE.format(
                difficulty_hint=f"band {blueprint.difficulty} (1..5)"
            ),
        },
        {
            "role": "user",
            "content": WRITTEN_USER_TEMPLATE.format(
                title_line=_title_line(title),
                steer=_topic_steer(blueprint),
                chunks=chunk_block(chunks),
            ),
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


# --- #42 coding arm ---
#
# One schema with three shapes because nothing carries a subtype: the recipe
# says `formats: ['coding']` and the UI offers one Coding family, so the
# provider chooses between the unsuitable judgement, a tests-bearing question
# (implement_fn|debug|complete_code), and an output_prediction question. The
# local validator is the authority; the schema keeps a well-behaved provider
# from drifting into a shape the validator would have to reject.

CODING_SUBTYPES = ("implement_fn", "debug", "complete_code", "output_prediction")
TESTS_BEARING_SUBTYPES = ("implement_fn", "debug", "complete_code")
OUTPUT_PREDICTION_SUBTYPE = "output_prediction"
# Authoring floor: two visible tests make the contract legible; the grader cap
# is three (coding_grader.MAX_VISIBLE_TESTS).
MIN_VISIBLE_TESTS = 2


def _coding_test_schema() -> dict:
    """One authored test case: stdin in, exact stdout expected out."""
    return {
        "type": "object",
        "properties": {
            "name": {"type": "string", "minLength": 1, "maxLength": 200},
            "stdin": {"type": "string", "maxLength": CODING_STDIN_MAX_LENGTH},
            "expectedOutput": {"type": "string", "maxLength": CODING_STDIN_MAX_LENGTH},
        },
        "required": ["name", "stdin", "expectedOutput"],
        "additionalProperties": False,
    }


def coding_schema(citation_ids: Iterable[str] | None = None) -> dict:
    """Coding-arm response schema: rejection | tests-bearing | output_prediction.

    `chunkId` stays enum-bound to this generation's retrieval context like the
    other arms, so a hallucinated chunk id cannot reach the citation gate.
    """
    common = {
        "difficulty": {"type": "integer", "minimum": 1, "maximum": 5},
        "skillTags": {"type": "array", "items": {"type": "string"}, "minItems": 1},
        "citations": _citation_schema(citation_ids),
    }
    tests_schema = {
        "type": "object",
        "properties": {
            "stem": {"type": "string"},
            "subtype": {"type": "string", "enum": list(TESTS_BEARING_SUBTYPES)},
            "language": {"type": "string", "enum": [CODING_LANGUAGE]},
            "starterCode": {"type": "string"},
            "visibleTests": {
                "type": "array",
                "minItems": MIN_VISIBLE_TESTS,
                "maxItems": MAX_VISIBLE_TESTS,
                "items": _coding_test_schema(),
            },
            "hiddenTests": {
                "type": "array",
                "minItems": 1,
                "maxItems": MAX_HIDDEN_TESTS,
                "items": _coding_test_schema(),
            },
            "referenceSolution": {"type": "string"},
            **common,
        },
        "required": [
            "stem",
            "subtype",
            "language",
            "starterCode",
            "visibleTests",
            "hiddenTests",
            "referenceSolution",
            "difficulty",
            "skillTags",
            "citations",
        ],
        "additionalProperties": False,
    }
    prediction_schema = {
        "type": "object",
        "properties": {
            "stem": {"type": "string"},
            "subtype": {"type": "string", "enum": [OUTPUT_PREDICTION_SUBTYPE]},
            "codeSnippet": {"type": "string"},
            "acceptedValue": {"type": "number"},
            **common,
        },
        "required": [
            "stem",
            "subtype",
            "codeSnippet",
            "acceptedValue",
            "difficulty",
            "skillTags",
            "citations",
        ],
        "additionalProperties": False,
    }
    unsuitable_schema = {
        "type": "object",
        "properties": {
            "unsuitable": {"type": "boolean", "enum": [True]},
            "reason": {"type": "string", "minLength": 1},
        },
        "required": ["unsuitable", "reason"],
        "additionalProperties": False,
    }
    return {"oneOf": [unsuitable_schema, tests_schema, prediction_schema]}


# The prompt carries the whole authoring contract because the grader executes
# it literally: a whole Python program per test, stdin in, stdout compared.
# Everything a model typically gets wrong (fenced code, prose outputs,
# nondeterminism, input() prompts) is named here, and the validator and the
# generation-time self-check catch what the prompt misses.
CODING_SYSTEM_TEMPLATE = (
    "You author one coding exam question grounded STRICTLY in the provided source chunks, "
    "together with the tests and reference solution that will grade it. "
    + META_BLOCKLIST
    + "Rules: cite every chunk you used by its chunkId and quote the exact sentence fragment you "
    "grounded the question on; invent nothing outside the chunks; keep every task self-contained "
    "and deterministic - no randomness, clock, network, files, or input beyond stdin; choose "
    "exactly one subtype:\n"
    "- implement_fn: the learner implements a function or algorithm named in the stem; "
    "starterCode carries the signature and any input plumbing, with the body left as `pass` or a "
    "TODO.\n"
    "- debug: starterCode is a complete but broken program; the stem states the expected "
    "behaviour and the learner fixes the bug.\n"
    "- complete_code: starterCode is an almost complete program with one marked gap; the learner "
    "fills the gap.\n"
    "- output_prediction: a short deterministic snippet whose printed output the learner must "
    "predict; return codeSnippet and acceptedValue only, with no tests, no reference solution, and "
    "no starterCode; the snippet prints exactly one numeric value and acceptedValue is that "
    "number as a JSON number.\n"
    "A tests-bearing question (implement_fn, debug, complete_code) must carry: language "
    '"python"; a complete referenceSolution as raw Python 3 source with no markdown fences; the '
    "reference reads its input from stdin and prints the answer to stdout, with no prompts or "
    "labels in the output; the grader runs the whole program with each test's stdin and compares "
    "stdout to that test's expectedOutput, ignoring trailing whitespace. Author "
    f"{MIN_VISIBLE_TESTS} or {MAX_VISIBLE_TESTS} visibleTests that demonstrate the contract and "
    f"one to {MAX_HIDDEN_TESTS} hiddenTests that cover edge cases; every expectedOutput is the "
    "exact stdout the reference prints for that stdin, so the reference solution must pass every "
    "test you author. "
    "If the chunks describe an algorithm or a technique but do not state an exercise, you may "
    "author the question yourself: name the algorithm in the stem, and let the tests and the "
    "reference solution define the contract. The contract must follow the behaviour described in "
    "the cited chunks. Refuse only when the chunks contain no code, no algorithm, and no "
    "implementable technique: return exactly "
    '{{"unsuitable": true, "reason": "<one or two learner-facing sentences naming what the '
    'material lacks>"}} instead of a question. '
    "Target difficulty {difficulty_hint}; respond only with the required JSON object."
)

CODING_USER_TEMPLATE = (
    "{title_line}Learner need (topic steer): {steer}\n\nSource chunks:\n{chunks}\n\n"
    "Author one grounded coding question with its tests and reference solution, or return the "
    "unsuitable judgement."
)


def build_coding_messages(
    blueprint: GenerationBlueprint,
    chunks: list[RetrievedChunk],
    *,
    title: str = "",
    repair_feedback: str | None = None,
    assistant_content: str | None = None,
) -> list[dict]:
    """Assemble the coding-arm system/user messages (plus one repair pair)."""
    messages: list[dict] = [
        {
            "role": "system",
            "content": CODING_SYSTEM_TEMPLATE.format(
                difficulty_hint=f"band {blueprint.difficulty} (1..5)"
            ),
        },
        {
            "role": "user",
            "content": CODING_USER_TEMPLATE.format(
                title_line=_title_line(title),
                steer=_topic_steer(blueprint),
                chunks=chunk_block(chunks),
            ),
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
