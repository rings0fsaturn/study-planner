from __future__ import annotations

from app.generation.models import GenerationBlueprint, RetrievedChunk
from app.generation.prompts import (
    MCQ_SCHEMA,
    REPAIR_SUFFIX,
    SYSTEM_TEMPLATE,
    USER_TEMPLATE,
    build_messages,
    chunk_block,
    prompt_template_version,
)


def blueprint(**overrides: object) -> GenerationBlueprint:
    values = dict(
        assessment_id="a1",
        job_id="j1",
        owner_id="u1",
        material_id="m1",
        difficulty=3,
        skill_tags=("core", "recall"),
        correlation_id="c1",
    )
    values.update(overrides)
    return GenerationBlueprint(**values)  # type: ignore[arg-type]


def chunks() -> list[RetrievedChunk]:
    return [
        RetrievedChunk(chunk_id="c1", material_id="m1", text="first chunk body", ordinal=0),
        RetrievedChunk(chunk_id="c2", material_id="m1", text="second chunk body", ordinal=1),
    ]


def test_prompt_template_version_is_v1() -> None:
    assert prompt_template_version == "v1"


def test_mcq_schema_pins_grounded_shape() -> None:
    assert MCQ_SCHEMA["required"] == [
        "stem",
        "options",
        "correctIndex",
        "difficulty",
        "skillTags",
        "citations",
    ]
    assert MCQ_SCHEMA["additionalProperties"] is False
    citations = MCQ_SCHEMA["properties"]["citations"]
    assert citations["minItems"] == 1
    assert citations["items"]["required"] == ["chunkId", "quote"]
    assert MCQ_SCHEMA["properties"]["options"]["maxItems"] == 4
    assert MCQ_SCHEMA["properties"]["correctIndex"]["maximum"] == 3


def test_chunk_block_formats_chunks() -> None:
    block = chunk_block(chunks())
    assert block == (
        '<chunk id="c1">first chunk body</chunk>\n<chunk id="c2">second chunk body</chunk>'
    )


def test_build_messages_assembles_system_and_user() -> None:
    messages = build_messages(blueprint(), chunks(), title="Book title")
    assert messages == [
        {"role": "system", "content": SYSTEM_TEMPLATE.format(difficulty_hint="band 3 (1..5)")},
        {
            "role": "user",
            "content": USER_TEMPLATE.format(
                steer="Book title, core, recall", chunks=chunk_block(chunks())
            ),
        },
    ]


def test_build_messages_steer_without_title() -> None:
    messages = build_messages(blueprint(), chunks())
    assert "Book title" not in messages[1]["content"]
    assert "core, recall" in messages[1]["content"]


def test_build_messages_injects_difficulty_hint() -> None:
    messages = build_messages(blueprint(difficulty=5), chunks())
    assert "band 5 (1..5)" in messages[0]["content"]
    assert messages[0]["content"].startswith("You author one multiple-choice")


def test_build_messages_repair_appends_assistant_user_pair() -> None:
    messages = build_messages(
        blueprint(), chunks(), repair_feedback="options_not_4", assistant_content='{"bad": 1}'
    )
    assert messages[2] == {"role": "assistant", "content": '{"bad": 1}'}
    assert messages[3]["role"] == "user"
    assert "options_not_4" in messages[3]["content"]
    assert messages[3]["content"].endswith(REPAIR_SUFFIX)


def test_build_messages_repair_without_assistant_content() -> None:
    messages = build_messages(blueprint(), chunks(), repair_feedback="stem_missing")
    assert [m["role"] for m in messages] == ["system", "user", "user"]
    assert messages[2]["content"].startswith("Validation failures:")
