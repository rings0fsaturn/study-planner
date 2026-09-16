from __future__ import annotations

import pytest

from app.generation.models import (
    GenerationBlueprint,
    NormalizedGenerationResponse,
    RetrievedChunk,
)
from app.generation.prompts import (
    CODING_PROMPT_TEMPLATE_VERSION,
    CODING_SYSTEM_TEMPLATE,
    CODING_USER_TEMPLATE,
    build_coding_messages,
    chunk_block,
    coding_schema,
)
from app.generation.validation import (
    coding_format_failures,
    strip_code_fence,
    validate_coding,
)
from app.generation.worker import GenerationWorker, GenerationWorkerConfig
from app.grading.coding_grader import (
    MEMORY_MAX_MB,
    TIME_LIMIT_MAX_MS,
)
from app.grading.piston_client import RUN_FAILED, RUN_PASSED, SandboxRun
from app.ingestion.models import IngestionError, Material
from tests.ingestion_doubles import FakeQueue

CONTEXT_IDS = {"c1", "c2"}
CHUNK_TEXTS = {
    "c1": "The planning gap is the shortfall between forecast and target.",
    "c2": "Porter's five forces shape industry competition.",
}

VALID_CODING = {
    "stem": "Implement `fib(n)` returning the n-th Fibonacci number.",
    "subtype": "implement_fn",
    "language": "python",
    "starterCode": "def fib(n: int) -> int:\n    pass\n",
    "visibleTests": [
        {"name": "base case", "stdin": "", "expectedOutput": "0"},
        {"name": "small n", "stdin": "", "expectedOutput": "55"},
    ],
    "hiddenTests": [{"name": "edge", "stdin": "1", "expectedOutput": "1"}],
    "referenceSolution": (
        "import sys\n"
        "def fib(n: int) -> int:\n"
        "    return n if n < 2 else fib(n - 1) + fib(n - 2)\n"
        "print(fib(int(sys.stdin.read())))\n"
    ),
    "difficulty": 3,
    "skillTags": ["algorithms"],
    "citations": [{"chunkId": "c1", "quote": "the shortfall between forecast and target"}],
}

VALID_OUTPUT_PREDICTION = {
    "stem": "What does this snippet print?",
    "subtype": "output_prediction",
    "codeSnippet": "print(2 ** 5)",
    "acceptedValue": 32,
    "difficulty": 3,
    "skillTags": ["python"],
    "citations": [{"chunkId": "c1", "quote": "the shortfall between forecast and target"}],
}


def blueprint(difficulty: int = 3) -> GenerationBlueprint:
    return GenerationBlueprint(
        assessment_id="a1",
        job_id="j1",
        owner_id="u1",
        material_id="m1",
        difficulty=difficulty,
        skill_tags=("algorithms",),
        correlation_id="c1",
    )


# --- prompts ---


def test_coding_prompt_template_version_is_coding_v1() -> None:
    assert CODING_PROMPT_TEMPLATE_VERSION == "coding-v1"


def test_coding_schema_branches_and_chunk_binding() -> None:
    schema = coding_schema({"c1", "c2"})
    unsuitable, tests, prediction = schema["oneOf"]
    assert len(schema["oneOf"]) == 3
    assert unsuitable["required"] == ["unsuitable", "reason"]
    assert unsuitable["properties"]["unsuitable"]["enum"] == [True]
    assert tests["properties"]["subtype"]["enum"] == ["implement_fn", "debug", "complete_code"]
    assert tests["properties"]["language"]["enum"] == ["python"]
    assert tests["properties"]["visibleTests"]["minItems"] == 2
    assert tests["properties"]["visibleTests"]["maxItems"] == 3
    assert tests["properties"]["hiddenTests"]["minItems"] == 1
    assert tests["properties"]["hiddenTests"]["maxItems"] == 10
    assert tests["properties"]["citations"]["items"]["properties"]["chunkId"]["enum"] == [
        "c1",
        "c2",
    ]
    assert prediction["properties"]["subtype"]["enum"] == ["output_prediction"]
    assert prediction["properties"]["acceptedValue"] == {"type": "number"}
    assert "visibleTests" not in prediction["properties"]
    assert "referenceSolution" not in prediction["properties"]


def test_coding_system_prompt_carries_the_authoring_contract() -> None:
    system = CODING_SYSTEM_TEMPLATE.format(difficulty_hint="band 3 (1..5)")
    for needle in (
        "Never ask about the examination, the syllabus, marks, duration",
        "implement_fn",
        "debug",
        "complete_code",
        "output_prediction",
        "no markdown fences",
        "reads its input from stdin",
        "compares stdout",
        "trailing whitespace",
        "unsuitable",
        "band 3 (1..5)",
        "visibleTests",
        "hiddenTests",
    ):
        assert needle in system


def test_build_coding_messages_assembles_system_and_user() -> None:
    messages = build_coding_messages(blueprint(), chunks(), title="Book title")
    assert messages == [
        {
            "role": "system",
            "content": CODING_SYSTEM_TEMPLATE.format(difficulty_hint="band 3 (1..5)"),
        },
        {
            "role": "user",
            "content": CODING_USER_TEMPLATE.format(
                title_line="Material: Book title\n",
                steer="algorithms",
                chunks=chunk_block(chunks()),
            ),
        },
    ]


def test_build_coding_messages_repair_appends_assistant_user_pair() -> None:
    messages = build_coding_messages(
        blueprint(),
        chunks(),
        repair_feedback="visible_tests_missing",
        assistant_content='{"bad": 1}',
    )
    assert messages[2] == {"role": "assistant", "content": '{"bad": 1}'}
    assert messages[3]["role"] == "user"
    assert "visible_tests_missing" in messages[3]["content"]


# --- validation ---


def test_validate_coding_accepts_tests_bearing_candidate() -> None:
    accepted, warnings = validate_coding(VALID_CODING, blueprint(), CONTEXT_IDS, CHUNK_TEXTS)
    assert accepted is not None
    assert accepted["citations"] == [
        {"chunkId": "c1", "quote": "the shortfall between forecast and target", "materialId": "m1"}
    ]
    assert warnings == []


def test_validate_coding_accepts_output_prediction_candidate() -> None:
    accepted, warnings = validate_coding(
        VALID_OUTPUT_PREDICTION, blueprint(), CONTEXT_IDS, CHUNK_TEXTS
    )
    assert accepted is not None
    assert accepted["acceptedValue"] == 32
    assert warnings == []


@pytest.mark.parametrize(
    ("mutator", "expected"),
    [
        (lambda c: c.pop("stem"), "stem_missing"),
        (lambda c: c.update(subtype="essay"), "subtype_invalid"),
        (lambda c: c.pop("subtype"), "subtype_invalid"),
        (lambda c: c.update(language="javascript"), "language_invalid"),
        (lambda c: c.pop("starterCode"), "starter_code_missing"),
        (lambda c: c.update(visibleTests=[c["visibleTests"][0]]), "visible_tests_count"),
        (lambda c: c.pop("visibleTests"), "visible_tests_missing"),
        (lambda c: c.pop("hiddenTests"), "hidden_tests_missing"),
        (lambda c: c.update(hiddenTests=[{"name": "x"}]), "hidden_tests_invalid"),
        (lambda c: c.pop("referenceSolution"), "reference_solution_missing"),
        (lambda c: c.update(difficulty=4), "difficulty_mismatch"),
        (lambda c: c.update(skillTags=[]), "skillTags_invalid"),
    ],
)
def test_coding_format_gate_rejects_each_tests_bearing_failure(
    mutator, expected: str
) -> None:
    candidate = dict(VALID_CODING)
    mutator(candidate)
    failures = coding_format_failures(candidate, blueprint())
    assert expected in failures


@pytest.mark.parametrize(
    ("mutator", "expected"),
    [
        (lambda c: c.pop("codeSnippet"), "code_snippet_missing"),
        (lambda c: c.update(acceptedValue="thirty-two"), "accepted_value_invalid"),
        (lambda c: c.update(acceptedValue=True), "accepted_value_invalid"),
        (lambda c: c.pop("acceptedValue"), "accepted_value_invalid"),
    ],
)
def test_coding_format_gate_rejects_each_prediction_failure(
    mutator, expected: str
) -> None:
    candidate = dict(VALID_OUTPUT_PREDICTION)
    mutator(candidate)
    failures = coding_format_failures(candidate, blueprint())
    assert expected in failures


def test_coding_unsuitable_short_circuits_before_format_and_citations() -> None:
    rejected = {"unsuitable": True, "reason": "the material has no algorithmic content"}
    accepted, warnings = validate_coding(rejected, blueprint(), CONTEXT_IDS, CHUNK_TEXTS)
    assert accepted is None
    assert warnings == [{"code": "code_not_derivable", "message": rejected["reason"]}]


def test_coding_unsuitable_without_reason_gets_a_default_message() -> None:
    accepted, warnings = validate_coding({"unsuitable": True}, blueprint(), set(), {})
    assert accepted is None
    assert warnings[0]["code"] == "code_not_derivable"
    assert warnings[0]["message"]


def test_validate_coding_unwraps_fenced_code_fields() -> None:
    candidate = {
        **VALID_CODING,
        "starterCode": "```python\n" + VALID_CODING["starterCode"] + "\n```",
        "referenceSolution": "```\n" + VALID_CODING["referenceSolution"] + "\n```",
    }
    accepted, _ = validate_coding(candidate, blueprint(), CONTEXT_IDS, CHUNK_TEXTS)
    assert accepted is not None
    assert accepted["starterCode"] == VALID_CODING["starterCode"]
    assert accepted["referenceSolution"] == VALID_CODING["referenceSolution"]


def test_validate_coding_leaves_interior_fences_alone() -> None:
    snippet = "code = '''\nfence\n'''"
    assert strip_code_fence(snippet) == snippet


def test_validate_coding_citation_drop_and_unverified_warning() -> None:
    out_of_context = {**VALID_CODING, "citations": [{"chunkId": "nope", "quote": "x"}]}
    accepted, warnings = validate_coding(
        out_of_context, blueprint(), CONTEXT_IDS, CHUNK_TEXTS
    )
    assert accepted is None
    assert warnings[0]["code"] == "citation_missing"

    unverifiable = {
        **VALID_CODING,
        "citations": [{"chunkId": "c1", "quote": "not in the source"}],
    }
    accepted, warnings = validate_coding(
        unverifiable, blueprint(), CONTEXT_IDS, CHUNK_TEXTS
    )
    assert accepted is not None
    assert warnings[0]["code"] == "citation_unverified"


# --- worker ---


class FakeSandbox:
    """Mirrors the PistonClient.execute contract with scripted outcomes."""

    def __init__(
        self,
        outcomes: list[str] | None = None,
        error: IngestionError | None = None,
    ) -> None:
        self.outcomes = list(outcomes or [])
        self.error = error
        self.calls: list[dict] = []

    def execute(self, **kwargs) -> SandboxRun:
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        outcome = self.outcomes.pop(0) if self.outcomes else RUN_PASSED
        return SandboxRun(outcome=outcome, duration_ms=1)


class FakeGenerationRepo:
    def __init__(self) -> None:
        self.assessments: dict[str, dict] = {}
        self.materials: dict[str, Material] = {}
        self.questions: list[dict] = []
        self.completed: list[tuple[dict, str, str, list[dict]]] = []
        self.job_updates: list[dict] = []
        self.assessment_updates: list[tuple[str, str, list[dict]]] = []

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
            {
                "messages": messages,
                "schema": response_schema,
                "repair": repair,
                "correlation_id": correlation_id,
            }
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
        "recipe": {"formats": ["coding"], "questionCount": 1, "difficulty": 3},
        "status": "generating",
        "warnings": [],
        "correlation_id": "corr-1",
    }


def chunks() -> list[RetrievedChunk]:
    return [
        RetrievedChunk(
            chunk_id="c1",
            material_id="m1",
            text="The planning gap is the shortfall between forecast and target.",
            ordinal=0,
        )
    ]


def ok_response(**overrides: object) -> NormalizedGenerationResponse:
    values = dict(
        content='{"stem": "x"}',
        refusal=None,
        finish_reason="stop",
        native_finish_reason=None,
        structured_output=VALID_CODING,
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


def make_worker(repo, queue, adapter, telemetry, sandbox=None, **config_overrides: object):
    config = GenerationWorkerConfig(**config_overrides)
    return GenerationWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        telemetry=telemetry,
        config=config,
        context_builder=lambda material_id, skill_tags, scope: chunks(),
        sandbox=sandbox,
    )


def run_worker(repo, queue, adapter, telemetry, sandbox=None) -> None:
    queue.send(
        "assessment_generate",
        {"jobId": "j1", "assessmentId": "a1", "materialId": "m1", "correlationId": "corr-1"},
    )
    make_worker(repo, queue, adapter, telemetry, sandbox).run_once()


def test_coding_recipe_uses_coding_schema_and_accepts_coding_row() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([ok_response()])
    telemetry = FakeTelemetry()
    sandbox = FakeSandbox()

    run_worker(repo, queue, adapter, telemetry, sandbox)

    assert "oneOf" in adapter.calls[0]["schema"]
    assert adapter.calls[0]["messages"][0]["content"].startswith(
        "You author one coding exam question"
    )
    assert len(repo.completed) == 1
    question_row, job_id, status, warnings = repo.completed[0]
    assert (job_id, status, warnings) == ("j1", "ready", [])
    assert question_row["format"] == "coding"
    assert question_row["subtype"] == "implement_fn"
    assert question_row["language"] == "python"
    assert question_row["starter_code"] == VALID_CODING["starterCode"]
    assert question_row["visible_tests"] == VALID_CODING["visibleTests"]
    assert question_row["answer_block"] == {
        "referenceSolution": VALID_CODING["referenceSolution"],
        "hiddenTests": VALID_CODING["hiddenTests"],
    }
    assert telemetry.records[0].outcome == "ok"
    assert telemetry.records[0].questions_accepted == 1
    assert telemetry.records[0].prompt_template_version == CODING_PROMPT_TEMPLATE_VERSION
    assert not queue.queues["assessment_generate"]


def test_coding_answer_block_drops_unexpected_provider_keys() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    smuggled = {
        **VALID_CODING,
        "answerKey": "leak",
        "hiddenTests": [{**VALID_CODING["hiddenTests"][0], "expected": "leak"}],
    }
    adapter = FakeAdapter([ok_response(structured_output=smuggled)])
    telemetry = FakeTelemetry()

    run_worker(repo, queue, adapter, telemetry, FakeSandbox())

    row = repo.completed[0][0]
    assert "answerKey" not in row
    assert row["answer_block"]["hiddenTests"][0] == {
        "name": "edge",
        "stdin": "1",
        "expectedOutput": "1",
    }


def test_coding_format_failure_repairs_with_coding_schema() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    broken = {**VALID_CODING}
    broken.pop("referenceSolution")
    adapter = FakeAdapter(
        [ok_response(structured_output=broken), ok_response(structured_output=VALID_CODING)]
    )
    telemetry = FakeTelemetry()

    run_worker(repo, queue, adapter, telemetry, FakeSandbox())

    assert len(repo.questions) == 1
    assert adapter.calls[1]["repair"] is True
    assert "oneOf" in adapter.calls[1]["schema"]
    assert "reference_solution_missing" in adapter.calls[1]["messages"][-1]["content"]
    assert telemetry.records[0].repair_attempted is True
    assert telemetry.records[0].questions_accepted == 1


def test_coding_unsuitable_fails_without_repair() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    reason = "the material explains theory but never specifies an algorithm"
    adapter = FakeAdapter(
        [ok_response(structured_output={"unsuitable": True, "reason": reason})]
    )
    telemetry = FakeTelemetry()

    run_worker(repo, queue, adapter, telemetry)

    assert len(adapter.calls) == 1
    assert repo.questions == []
    assert repo.assessment_updates == [
        ("a1", "failed", [{"code": "code_not_derivable", "message": reason}])
    ]
    assert repo.job_updates[-1]["error_code"] == "code_not_derivable"
    assert repo.job_updates[-1]["retryable"] is False
    assert telemetry.records[0].outcome == "partial"
    assert telemetry.records[0].questions_accepted == 0


def test_coding_self_check_runs_reference_through_the_sandbox() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([ok_response()])
    telemetry = FakeTelemetry()
    sandbox = FakeSandbox()

    run_worker(repo, queue, adapter, telemetry, sandbox)

    # Visible 2 + hidden 1 = 3 executions of the reference solution.
    assert len(sandbox.calls) == 3
    first = sandbox.calls[0]
    assert first["source"] == VALID_CODING["referenceSolution"]
    assert first["time_limit_ms"] == TIME_LIMIT_MAX_MS
    assert first["memory_limit_mb"] == MEMORY_MAX_MB
    assert first["attempt_id"] == "a1"
    assert first["trace_id"] == "corr-1"
    assert repo.questions[0]["format"] == "coding"


def test_coding_self_check_failure_drops_the_question() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([ok_response()])
    telemetry = FakeTelemetry()
    sandbox = FakeSandbox(outcomes=[RUN_PASSED, RUN_FAILED])

    run_worker(repo, queue, adapter, telemetry, sandbox)

    assert repo.questions == []
    assert repo.assessment_updates[0][1] == "failed"
    warning = repo.assessment_updates[0][2][0]
    assert warning["code"] == "self_check_failed"
    assert "passed 1/3" in warning["message"]
    assert "small n" in warning["message"]
    assert repo.job_updates[-1]["error_code"] == "malformed_output"
    assert repo.job_updates[-1]["retryable"] is False
    assert telemetry.records[0].outcome == "malformed_output"
    assert telemetry.records[0].questions_accepted == 0


def test_coding_self_check_retryable_sandbox_error_keeps_generating() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([ok_response()])
    telemetry = FakeTelemetry()
    sandbox = FakeSandbox(
        error=IngestionError("provider_unavailable", "piston is down", retryable=True)
    )

    run_worker(repo, queue, adapter, telemetry, sandbox)

    assert repo.questions == []
    assert repo.assessment_updates == [
        ("a1", "generating", [{"code": "provider_unavailable", "message": "piston is down"}])
    ]
    assert repo.job_updates[-1]["status"] == "failed"
    assert repo.job_updates[-1]["retryable"] is True
    assert not queue.queues["assessment_generate"]


def test_coding_self_check_without_sandbox_is_retryable() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([ok_response()])
    telemetry = FakeTelemetry()

    run_worker(repo, queue, adapter, telemetry, sandbox=None)

    assert repo.questions == []
    assert repo.assessment_updates[0][1] == "generating"
    assert repo.job_updates[-1]["retryable"] is True


def test_coding_self_check_non_retryable_sandbox_error_fails_closed() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter([ok_response()])
    telemetry = FakeTelemetry()
    sandbox = FakeSandbox(
        error=IngestionError("provider_unavailable", "piston rejected the request", retryable=False)
    )

    run_worker(repo, queue, adapter, telemetry, sandbox)

    assert repo.questions == []
    assert repo.assessment_updates[0][1] == "failed"
    assert repo.assessment_updates[0][2][0]["code"] == "provider_unavailable"
    assert repo.job_updates[-1]["retryable"] is False
    assert telemetry.records[0].outcome == "provider_error"


def test_output_prediction_skips_the_sandbox_and_writes_accepted_value() -> None:
    repo = FakeGenerationRepo()
    repo.seed(assessment(), material())
    queue = FakeQueue()
    adapter = FakeAdapter(
        [ok_response(structured_output=VALID_OUTPUT_PREDICTION)]
    )
    telemetry = FakeTelemetry()
    sandbox = FakeSandbox()

    run_worker(repo, queue, adapter, telemetry, sandbox)

    assert sandbox.calls == []
    assert len(repo.completed) == 1
    row = repo.completed[0][0]
    assert row["format"] == "coding"
    assert row["subtype"] == "output_prediction"
    assert row["starter_code"] == VALID_OUTPUT_PREDICTION["codeSnippet"]
    assert "visible_tests" not in row
    assert row["answer_block"] == {"acceptedValue": 32}
    assert repo.assessment_updates == []