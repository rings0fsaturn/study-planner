from __future__ import annotations

from app.generation.models import NormalizedGenerationResponse, RetrievedChunk
from app.generation.worker import GenerationWorker, GenerationWorkerConfig
from app.ingestion.models import IngestionError, Material
from tests.ingestion_doubles import FakeQueue

VALID_MCQ = {
    "stem": "What does the planning gap measure?",
    "options": ["Shortfall vs target", "Budget surplus", "Headcount", "Cycle time"],
    "correctIndex": 0,
    "difficulty": 3,
    "skillTags": ["Strategic Planning"],
    "citations": [{"chunkId": "c1", "quote": "the shortfall between forecast and target"}],
}


class FakeGenerationRepo:
    def __init__(self) -> None:
        self.assessments: dict[str, dict] = {}
        self.materials: dict[str, Material] = {}
        self.questions: list[dict] = []
        self.completed: list[tuple[dict, str, str, list[dict]]] = []
        self.job_updates: list[dict] = []
        self.assessment_updates: list[tuple[str, str, list[dict]]] = []
        self.embedder_failure: IngestionError | None = None

    def seed(self, assessment: dict, material: Material) -> None:
        self.assessments[assessment["id"]] = assessment
        self.materials[material.id] = material

    def get_assessment(self, assessment_id: str) -> dict:
        if assessment_id not in self.assessments:
            raise IngestionError("not_found", "assessment not found")
        return self.assessments[assessment_id]

    def get_material(self, material_id: str) -> Material:
        if material_id not in self.materials:
            raise IngestionError("not_found", "material not found")
        return self.materials[material_id]

    def update_job_status(
        self,
        job_id: str,
        status: str,
        *,
        error_code=None,
        error_message=None,
        retryable: bool = False,
        retry_after=None,
        result_id=None,
    ) -> None:
        self.job_updates.append(
            {
                "job_id": job_id,
                "status": status,
                "error_code": error_code,
                "error_message": error_message,
                "retryable": retryable,
                "retry_after": retry_after,
                "result_id": result_id,
            }
        )

    def update_assessment_status(
        self, assessment_id: str, status: str, warnings: list[dict]
    ) -> None:
        self.assessment_updates.append((assessment_id, status, warnings))

    def complete_assessment(
        self, question_row: dict, job_id: str, status: str, warnings: list[dict]
    ) -> None:
        self.completed.append((question_row, job_id, status, warnings))
        self.questions.append(question_row)


class FakeAdapter:
    def __init__(self, responses: list[NormalizedGenerationResponse]) -> None:
        self._responses = list(responses)
        self.calls: list[dict] = []

    def generate(
        self, messages, response_schema, *, repair=False, request_id="", correlation_id=""
    ):
        self.calls.append(
            {"messages": messages, "repair": repair, "correlation_id": correlation_id}
        )
        return self._responses.pop(0)


class FakeTelemetry:
    def __init__(self) -> None:
        self.records = []

    def emit(self, records) -> None:
        self.records.extend(records)


def material() -> Material:
    return Material(
        id="m1",
        owner_id="u1",
        title="Strategic Management",
        kind="url",
        source="https://example.com",
        ingestion_state="ready",
    )


def assessment() -> dict:
    return {
        "id": "a1",
        "user_id": "u1",
        "client_id": "client-1",
        "material_id": "m1",
        "recipe": {
            "formats": ["objective"],
            "questionCount": 1,
            "difficulty": 3,
            "skillTags": ["Strategic Planning"],
        },
        "status": "generating",
        "warnings": [],
        "correlation_id": "corr-1",
    }


def ok_response(**overrides: object) -> NormalizedGenerationResponse:
    values = dict(
        content='{"stem": "x"}',
        refusal=None,
        finish_reason="stop",
        native_finish_reason=None,
        structured_output=VALID_MCQ,
        usage={
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_tokens": 15,
            "reasoning_tokens": 0,
        },
        routed_provider="Phala",
        outcome="ok",
        error=None,
        latency_ms=1500.0,
    )
    values.update(overrides)
    return NormalizedGenerationResponse(**values)  # type: ignore[arg-type]


def failure_response(
    outcome: str, code: str, retryable: bool = False, retry_after: float | None = None
) -> NormalizedGenerationResponse:
    return NormalizedGenerationResponse(
        content=None,
        refusal=None,
        finish_reason="",
        native_finish_reason=None,
        structured_output=None,
        usage={},
        routed_provider=None,
        outcome=outcome,
        error={
            "code": code,
            "message": f"{code} message",
            "retryable": retryable,
            "requestId": "req-1",
            "correlationId": "corr-1",
            **({"retryAfterSeconds": int(retry_after)} if retry_after else {}),
        },
        latency_ms=100.0,
    )


def chunks() -> list[RetrievedChunk]:
    return [
        RetrievedChunk(
            chunk_id="c1",
            material_id="m1",
            text="The planning gap is the shortfall between forecast and target.",
            ordinal=0,
        )
    ]


def make_worker(repo, queue, adapter, telemetry, **config_overrides: object):
    config = GenerationWorkerConfig(**config_overrides)
    return GenerationWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        telemetry=telemetry,
        config=config,
        context_builder=lambda material_id, skill_tags, title: chunks(),
    )


def test_happy_path_inserts_question_and_marks_ready() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([ok_response()])
    telemetry = FakeTelemetry()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    processed = make_worker(repo, queue, adapter, telemetry).run_once()

    assert processed == 1
    assert len(repo.completed) == 1
    question_row, job_id, status, warnings = repo.completed[0]
    assert job_id == "j1"
    assert status == "ready"
    assert warnings == []
    assert question_row["assessment_id"] == "a1"
    assert question_row["user_id"] == "u1"
    assert question_row["format"] == "objective"
    assert question_row["prompt"] == VALID_MCQ["stem"]
    assert question_row["authored_difficulty"] == 3
    assert question_row["options"] == VALID_MCQ["options"]
    assert question_row["skill_tags"] == VALID_MCQ["skillTags"]
    assert question_row["answer_block"] == {"correctIndex": 0}
    assert repo.questions == [question_row]
    assert telemetry.records[0].outcome == "ok"
    assert telemetry.records[0].questions_requested == 1
    assert telemetry.records[0].questions_accepted == 1
    assert telemetry.records[0].reasoning_tokens == 0
    assert not queue.queues["assessment_generate"]


def test_redelivered_message_for_terminal_assessment_is_dropped() -> None:
    repo = FakeGenerationRepo()
    seeded = assessment()
    seeded["status"] = "ready"
    repo.seed(seeded, material())
    queue = FakeQueue()
    adapter = FakeAdapter([])
    telemetry = FakeTelemetry()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    make_worker(repo, queue, adapter, telemetry).run_once()

    assert adapter.calls == []  # no provider spend on a terminal assessment
    assert repo.completed == []
    assert not queue.queues["assessment_generate"]


def test_quota_failure_fails_job_retryable_and_keeps_assessment_generating() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([failure_response("quota_failure", "quota_exhausted", retry_after=60)])
    telemetry = FakeTelemetry()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    make_worker(repo, queue, adapter, telemetry).run_once()

    assert repo.questions == []
    assert repo.assessment_updates == [
        ("a1", "generating", [{"code": "quota_exhausted", "message": "quota_exhausted message"}])
    ]
    assert repo.job_updates[-1] == {
        "job_id": "j1",
        "status": "failed",
        "error_code": "quota_exhausted",
        "error_message": "quota_exhausted message",
        "retryable": False,
        "retry_after": 60,
        "result_id": None,
    }
    assert telemetry.records[0].outcome == "quota_failure"
    assert telemetry.records[0].questions_accepted == 0
    assert not queue.queues["assessment_generate"]


def test_timeout_fails_job_retryable() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([failure_response("timeout", "provider_timeout", retryable=True)])
    telemetry = FakeTelemetry()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    make_worker(repo, queue, adapter, telemetry).run_once()

    assert repo.job_updates[-1]["status"] == "failed"
    assert repo.job_updates[-1]["error_code"] == "provider_timeout"
    assert repo.job_updates[-1]["retryable"] is True
    assert repo.assessment_updates == [
        ("a1", "generating", [{"code": "provider_timeout", "message": "provider_timeout message"}])
    ]
    assert telemetry.records[0].outcome == "timeout"


def test_unsupported_request_fails_job_non_retryable() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([failure_response("provider_error", "unsupported_request")])
    telemetry = FakeTelemetry()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    make_worker(repo, queue, adapter, telemetry).run_once()

    assert repo.job_updates[-1]["error_code"] == "unsupported_request"
    assert repo.job_updates[-1]["retryable"] is False
    assert repo.assessment_updates == [
        (
            "a1",
            "generating",
            [{"code": "unsupported_request", "message": "unsupported_request message"}],
        )
    ]


def test_safety_block_fails_assessment_with_warning() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([failure_response("safety_block", "safety_block")])
    telemetry = FakeTelemetry()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    make_worker(repo, queue, adapter, telemetry).run_once()

    assert repo.questions == []
    assert repo.assessment_updates[0][1] == "failed"
    assert repo.assessment_updates[0][2] == [
        {"code": "safety_block", "message": "provider safety block"}
    ]
    assert repo.job_updates[-1]["error_code"] == "safety_block"
    assert repo.job_updates[-1]["retryable"] is False
    assert telemetry.records[0].outcome == "safety_block"
    assert not queue.queues["assessment_generate"]


def test_malformed_output_repairs_and_succeeds() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    malformed = NormalizedGenerationResponse(
        content='{"stem": "broken',
        refusal=None,
        finish_reason="length",
        native_finish_reason="length",
        structured_output=None,
        usage={
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "total_tokens": 15,
            "reasoning_tokens": 0,
        },
        routed_provider=None,
        outcome="malformed_output",
        error={
            "code": "malformed_output",
            "message": "output failed local schema validation",
            "retryable": False,
        },
        latency_ms=100.0,
    )
    adapter = FakeAdapter([malformed, ok_response()])
    telemetry = FakeTelemetry()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    make_worker(repo, queue, adapter, telemetry).run_once()

    assert len(repo.questions) == 1
    assert adapter.calls[0]["repair"] is False
    assert adapter.calls[1]["repair"] is True
    assert adapter.calls[1]["correlation_id"] == "corr-1"
    assert repo.completed[0][2] == "ready"
    assert repo.completed[0][1] == "j1"
    assert telemetry.records[0].repair_attempted is True
    assert telemetry.records[0].questions_accepted == 1


def test_malformed_output_repair_exhausted_fails_assessment() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    malformed = NormalizedGenerationResponse(
        content="not-json",
        refusal=None,
        finish_reason="stop",
        native_finish_reason=None,
        structured_output=None,
        usage={},
        routed_provider=None,
        outcome="malformed_output",
        error={
            "code": "malformed_output",
            "message": "output failed local schema validation",
            "retryable": False,
        },
        latency_ms=100.0,
    )
    adapter = FakeAdapter([malformed, malformed])
    telemetry = FakeTelemetry()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    make_worker(repo, queue, adapter, telemetry).run_once()

    assert repo.questions == []
    assert repo.assessment_updates[0][1] == "failed"
    assert repo.assessment_updates[0][2][0]["code"] == "malformed_output"
    assert repo.job_updates[-1]["error_code"] == "malformed_output"
    assert repo.job_updates[-1]["retryable"] is False
    assert telemetry.records[0].outcome == "malformed_output"
    assert telemetry.records[0].repair_attempted is True


def test_format_failure_repairs_and_succeeds() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    wrong_difficulty = {**VALID_MCQ, "difficulty": 5}
    adapter = FakeAdapter([ok_response(structured_output=wrong_difficulty), ok_response()])
    telemetry = FakeTelemetry()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    make_worker(repo, queue, adapter, telemetry).run_once()

    assert len(repo.questions) == 1
    assert adapter.calls[1]["repair"] is True
    assert "difficulty_mismatch" in adapter.calls[1]["messages"][-1]["content"]
    assert telemetry.records[0].repair_attempted is True


def test_citation_drop_fails_without_repair() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    out_of_context = {**VALID_MCQ, "citations": [{"chunkId": "nope", "quote": "x"}]}
    adapter = FakeAdapter([ok_response(structured_output=out_of_context)])
    telemetry = FakeTelemetry()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    make_worker(repo, queue, adapter, telemetry).run_once()

    assert len(adapter.calls) == 1  # no repair for citation-gate failures
    assert repo.questions == []
    assert repo.assessment_updates[0][2][0]["code"] == "citation_missing"
    assert repo.job_updates[-1]["error_code"] == "malformed_output"
    assert telemetry.records[0].outcome == "malformed_output"


def test_unverified_quote_warning_lands_on_ready_assessment() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    unverified = {**VALID_MCQ, "citations": [{"chunkId": "c1", "quote": "invented"}]}
    adapter = FakeAdapter([ok_response(structured_output=unverified)])
    telemetry = FakeTelemetry()
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    make_worker(repo, queue, adapter, telemetry).run_once()

    assert len(repo.questions) == 1
    assert repo.completed[0][2] == "ready"
    assert repo.completed[0][3][0]["code"] == "citation_unverified"


def test_embedder_unavailable_fails_job_retryable() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([])
    telemetry = FakeTelemetry()

    def failing_context(material_id, skill_tags, title):
        raise IngestionError("provider_unavailable", "query embedding failed", retryable=True)

    worker = GenerationWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        telemetry=telemetry,
        config=GenerationWorkerConfig(),
        context_builder=failing_context,
    )
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    worker.run_once()

    assert adapter.calls == []
    assert repo.job_updates[-1] == {
        "job_id": "j1",
        "status": "failed",
        "error_code": "provider_unavailable",
        "error_message": "query embedding failed",
        "retryable": True,
        "retry_after": None,
        "result_id": None,
    }
    assert repo.assessment_updates == [
        (
            "a1",
            "generating",
            [{"code": "provider_unavailable", "message": "query embedding failed"}],
        )
    ]
    assert telemetry.records == []
    assert not queue.queues["assessment_generate"]


def test_unexpected_exception_redelivers_message() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([])
    telemetry = FakeTelemetry()

    def broken_context(material_id, skill_tags, title):
        raise RuntimeError("boom")

    worker = GenerationWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        telemetry=telemetry,
        config=GenerationWorkerConfig(),
        context_builder=broken_context,
    )
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )

    worker.run_once()

    assert queue.redelivered == [("assessment_generate", 1)]
