from __future__ import annotations

from app.generation.models import GenerationBlueprint, RetrievedChunk
from app.generation.prompts import (
    REPAIR_SUFFIX,
    SYSTEM_TEMPLATE,
    USER_TEMPLATE,
    WRITTEN_PROMPT_TEMPLATE_VERSION,
    WRITTEN_SYSTEM_TEMPLATE,
    WRITTEN_USER_TEMPLATE,
    build_messages,
    build_written_messages,
    chunk_block,
    mcq_schema,
    prompt_template_version,
    written_schema,
)

# Bound to a fixed context so the id-enum assertions below are meaningful; the
# worker passes its real retrieved ids (see `test_generation_worker.py`).
CITATION_IDS = {"c1", "c2"}
MCQ_SCHEMA = mcq_schema(CITATION_IDS)
WRITTEN_SCHEMA = written_schema(CITATION_IDS)


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
    # chunkId is enum-bound to the retrieved context (#41): the provider cannot
    # return a chunk id that does not exist, which used to fail the whole
    # generation at the citation gate.
    assert citations["items"]["properties"]["chunkId"]["enum"] == ["c1", "c2"]


def test_schemas_leave_chunk_id_unconstrained_without_a_context() -> None:
    # No context handed in: the id stays a plain string, so the schema cannot
    # reject a legitimate id (callers with a context must pass it).
    unbound = mcq_schema()["properties"]["citations"]["items"]["properties"]["chunkId"]
    assert unbound == {"type": "string"}


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
                title_line="Material: Book title\n",
                steer="core, recall",
                chunks=chunk_block(chunks()),
            ),
        },
    ]


def test_build_messages_titles_the_document_and_steers_on_tags() -> None:
    """The title is document context; the steer is the learner's tags (D-01)."""
    messages = build_messages(blueprint(), chunks(), title="Book title")
    user = messages[1]["content"]
    assert "Material: Book title" in user
    assert "Learner need (topic steer): core, recall" in user


def test_build_messages_omits_the_document_line_without_a_title() -> None:
    messages = build_messages(blueprint(), chunks())
    assert "Material:" not in messages[1]["content"]
    assert "Learner need (topic steer): core, recall" in messages[1]["content"]


def test_both_system_prompts_carry_the_meta_blocklist() -> None:
    """D-02: the blocklist holds even when the retrieved chunks are front matter."""
    for template in (SYSTEM_TEMPLATE, WRITTEN_SYSTEM_TEMPLATE):
        assert "Never ask about the examination, the syllabus, marks, duration" in template
        assert "study or revision guidance" in template
        assert "the material or study text itself" in template
        assert "must test one concept, technique or piece of subject content" in template
    assert "or compute with it" in SYSTEM_TEMPLATE


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


# --- #41 written generation prompts ---


def test_written_schema_pins_visible_payload_and_hidden_block() -> None:
    assert WRITTEN_SCHEMA["additionalProperties"] is False
    assert WRITTEN_SCHEMA["required"] == [
        "stem",
        "subtype",
        "difficulty",
        "skillTags",
        "citations",
        "rubric",
        "referenceAnswer",
        "rubricVersion",
    ]
    assert WRITTEN_SCHEMA["properties"]["subtype"]["enum"] == ["short_answer", "long_form"]
    assert WRITTEN_SCHEMA["properties"]["citations"]["minItems"] == 1
    rubric = WRITTEN_SCHEMA["properties"]["rubric"]
    assert rubric["minItems"] == 2
    assert rubric["items"]["required"] == ["criterion", "weight", "maxPoints"]
    assert rubric["items"]["additionalProperties"] is False
    assert rubric["items"]["properties"]["weight"]["maximum"] == 1
    assert "correctIndex" not in WRITTEN_SCHEMA["properties"]
    assert "options" not in WRITTEN_SCHEMA["properties"]
    # Same id binding as the objective arm (#41).
    assert (
        WRITTEN_SCHEMA["properties"]["citations"]["items"]["properties"]["chunkId"]["enum"]
        == ["c1", "c2"]
    )


def test_written_prompt_template_version_is_written_v1() -> None:
    assert WRITTEN_PROMPT_TEMPLATE_VERSION == "written-v1"
    assert WRITTEN_PROMPT_TEMPLATE_VERSION != prompt_template_version


def test_build_written_messages_assembles_system_and_user() -> None:
    messages = build_written_messages(blueprint(), chunks(), title="Book title")
    assert messages == [
        {
            "role": "system",
            "content": WRITTEN_SYSTEM_TEMPLATE.format(difficulty_hint="band 3 (1..5)"),
        },
        {
            "role": "user",
            "content": WRITTEN_USER_TEMPLATE.format(
                title_line="Material: Book title\n",
                steer="core, recall",
                chunks=chunk_block(chunks()),
            ),
        },
    ]


def test_build_written_messages_asks_for_rubric_subtype_and_reference() -> None:
    messages = build_written_messages(blueprint(), chunks())
    system = messages[0]["content"]
    assert "short_answer" in system
    assert "long_form" in system
    assert "rubric" in system
    assert "reference answer" in system
    assert "weights sum to 1" in system
    assert "band 3 (1..5)" in system
    assert "difficulty 5" not in system


def test_build_written_messages_titles_the_document_and_steers_on_tags() -> None:
    """Same D-01 split as the objective arm: title = context, tags = steer."""
    messages = build_written_messages(blueprint(), chunks(), title="Book title")
    user = messages[1]["content"]
    assert "Material: Book title" in user
    assert "Learner need (topic steer): core, recall" in user


def test_build_written_messages_repair_appends_assistant_user_pair() -> None:
    messages = build_written_messages(
        blueprint(),
        chunks(),
        repair_feedback="rubric_weights_not_normalized",
        assistant_content='{"bad": 1}',
    )
    assert messages[2] == {"role": "assistant", "content": '{"bad": 1}'}
    assert messages[3]["role"] == "user"
    assert "rubric_weights_not_normalized" in messages[3]["content"]
    assert messages[3]["content"].endswith(REPAIR_SUFFIX)


def test_build_written_messages_repair_without_assistant_content() -> None:
    messages = build_written_messages(blueprint(), chunks(), repair_feedback="subtype_invalid")
    assert [m["role"] for m in messages] == ["system", "user", "user"]
    assert messages[2]["content"].startswith("Validation failures:")
