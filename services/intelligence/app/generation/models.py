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
class AssessmentScope:
    """The learner's chosen page range (D-05): one shape for both pickers.

    `page_start`/`page_end` are PDF page numbers - the numbering the viewer
    shows and `content_chunks.page_start/page_end` carry - so the retrieval
    predicate is a direct comparison. `section_label` is the outline row's
    title when the learner picked a chapter (it becomes the retrieval steer);
    a typed range has no label, so retrieval spreads across the range instead
    of embedding an empty query (D-08).
    """

    page_start: int
    page_end: int
    section_label: str = ""

    @classmethod
    def from_recipe(cls, recipe: dict) -> "AssessmentScope | None":
        """The recipe's `scope` object, or None when the request is unscoped."""
        raw = recipe.get("scope")
        if not isinstance(raw, dict):
            return None
        try:
            start, end = int(raw["pageStart"]), int(raw["pageEnd"])
        except (KeyError, TypeError, ValueError):
            return None
        return cls(start, end, str(raw.get("sectionLabel") or ""))

    def widened(self, pad: int) -> "AssessmentScope":
        """The same scope padded by `pad` pages on both sides (D-06)."""
        return AssessmentScope(
            max(1, self.page_start - pad), self.page_end + pad, self.section_label
        )

    def to_dict(self) -> dict:
        payload: dict = {"pageStart": self.page_start, "pageEnd": self.page_end}
        if self.section_label:
            payload["sectionLabel"] = self.section_label
        return payload


@dataclass(frozen=True)
class GenerationBlueprint:
    """What the worker executes: one grounded question for one assessment.

    `question_format` is the family this assessment generates (`objective` or
    `written`, one family per assessment); it selects the prompt, response
    schema, validator, and accepted row shape. `prompt_template_version` labels
    the prompt that produced the question in telemetry. `scope` is the
    learner's page range when one was requested (P4), carried through the whole
    pipeline so retrieval and the prompt agree on what was asked for.
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
    scope: AssessmentScope | None = None


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
