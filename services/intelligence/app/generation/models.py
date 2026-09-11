"""Generation domain models shared by the API, worker, and tests.

Envelope shapes follow the #54-amended provider contracts
(`contracts/phase2/provider/generation-request.schema.json` and
`generation-response.schema.json`).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GenerationRequest:
    """One assessment-generation request as received by the API."""

    client_id: str
    material_id: str
    recipe: dict
    correlation_id: str


@dataclass(frozen=True)
class GenerationBlueprint:
    """What the worker executes: one grounded question for one assessment.

    `question_format` is the family this assessment generates (`objective` or
    `written`, one family per assessment); it selects the prompt, response
    schema, validator, and accepted row shape. `prompt_template_version` labels
    the prompt that produced the question in telemetry.
    """

    assessment_id: str
    job_id: str
    owner_id: str
    material_id: str
    difficulty: int
    skill_tags: tuple[str, ...]
    correlation_id: str
    question_format: str = "objective"
    prompt_template_version: str = "v1"


@dataclass(frozen=True)
class RetrievedChunk:
    """One retrieval hit used as generation context."""

    chunk_id: str
    material_id: str
    text: str
    ordinal: int
    page_start: int | None = None
    page_end: int | None = None


@dataclass(frozen=True)
class NormalizedGenerationResponse:
    """Flattened, provider-neutral result of one adapter call."""

    content: str | None
    refusal: str | None
    finish_reason: str
    native_finish_reason: str | None
    structured_output: dict | None
    usage: dict
    routed_provider: str | None
    outcome: str
    error: dict | None
    latency_ms: float


@dataclass(frozen=True)
class AcceptedQuestion:
    """One validated, redacted question plus its server-only answer block.

    `answer_block` (the correct index) is server-only by contract: it is
    written to `questions.answer_block` and never serialized to clients,
    events, or telemetry.
    """

    question_id: str
    assessment_id: str
    material_id: str
    format: str
    prompt: str
    options: tuple[str, ...]
    skill_tags: tuple[str, ...]
    authored_difficulty: int
    citations: tuple[dict, ...]
    answer_block: dict
    warnings: tuple[dict, ...]
