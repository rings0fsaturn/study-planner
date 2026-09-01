from __future__ import annotations

from app.generation.models import (
    AcceptedQuestion,
    GenerationBlueprint,
    GenerationRequest,
    NormalizedGenerationResponse,
    RetrievedChunk,
)


def test_generation_request_carries_all_fields() -> None:
    request = GenerationRequest(
        client_id="client-1",
        material_id="mat-1",
        recipe={
            "formats": ["objective"],
            "questionCount": 1,
            "difficulty": 3,
            "skillTags": ["core"],
        },
        correlation_id="corr-1",
    )
    assert request.client_id == "client-1"
    assert request.material_id == "mat-1"
    assert request.recipe["questionCount"] == 1
    assert request.correlation_id == "corr-1"


def test_blueprint_defaults_prompt_template_version() -> None:
    blueprint = GenerationBlueprint(
        assessment_id="a1",
        job_id="j1",
        owner_id="u1",
        material_id="m1",
        difficulty=3,
        skill_tags=("core",),
        correlation_id="c1",
    )
    assert blueprint.prompt_template_version == "v1"
    assert blueprint.difficulty == 3


def test_blueprint_accepts_explicit_template_version() -> None:
    blueprint = GenerationBlueprint(
        assessment_id="a1",
        job_id="j1",
        owner_id="u1",
        material_id="m1",
        difficulty=2,
        skill_tags=(),
        correlation_id="c1",
        prompt_template_version="v2",
    )
    assert blueprint.prompt_template_version == "v2"


def test_retrieved_chunk_fields() -> None:
    chunk = RetrievedChunk(chunk_id="c1", material_id="m1", text="body", ordinal=3)
    assert chunk.ordinal == 3
    assert chunk.text == "body"


def test_normalized_response_minimal() -> None:
    response = NormalizedGenerationResponse(
        content=None,
        refusal=None,
        finish_reason="",
        native_finish_reason=None,
        structured_output=None,
        usage={},
        routed_provider=None,
        outcome="timeout",
        error={"code": "provider_timeout", "retryable": True},
        latency_ms=100.0,
    )
    assert response.outcome == "timeout"
    assert response.latency_ms == 100.0


def test_accepted_question_carries_server_only_answer_block() -> None:
    question = AcceptedQuestion(
        question_id="q1",
        assessment_id="a1",
        material_id="m1",
        format="objective",
        prompt="stem?",
        options=("a", "b", "c", "d"),
        skill_tags=("core",),
        authored_difficulty=3,
        citations=({"chunkId": "c1", "materialId": "m1", "quote": "q"},),
        answer_block={"correctIndex": 0},
        warnings=(),
    )
    assert question.answer_block == {"correctIndex": 0}
    assert question.format == "objective"
