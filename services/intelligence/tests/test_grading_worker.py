"""Grading worker arm tests (#39/#41): poll assessment_grade, grade, persist.

The repo is a fake implementing the narrow GradingRepo protocol — the real
Supabase path is the worker's only dependency seam, mirroring how the
generation arm tests GenerationWorker with a fake GenerationRepo. The written
arm (#41) is driven by a fake adapter, so no provider call leaves the test.
"""

from __future__ import annotations

import json

import pytest

from app.generation.models import NormalizedGenerationResponse
from app.grading.worker import GRADING_QUEUE, GradingWorker, GradingWorkerConfig
from app.ingestion.models import IngestionError, QueueMessage
from app.ingestion.queue import WorkQueue


class FakeQueue(WorkQueue):
    def __init__(self, messages: list[QueueMessage] | None = None) -> None:
        self.messages = list(messages or [])
        self.completed: list[tuple[int, bool]] = []

    def poll(self, queue: str, *, visibility_seconds: int, quantity: int) -> list[QueueMessage]:
        take, self.messages = self.messages[:quantity], self.messages[quantity:]
        return take

    def complete(self, queue: str, msg_id: int, success: bool) -> None:
        self.completed.append((msg_id, success))

    def send(self, queue: str, payload: dict) -> None: ...


class FakeGradingRepo:
    """In-memory GradingRepo double; raises IngestionError to simulate faults."""

    def __init__(self, attempt: dict, question: dict) -> None:
        self.attempt = attempt
        self.question = question
        self.job_status: list[tuple[str, str]] = []
        self.job_errors: list[tuple[str, dict]] = []
        self.finished: list[dict] = []
        self.fail_on_get = False

    def get_attempt(self, attempt_id: str) -> dict:
        if self.fail_on_get:
            raise IngestionError("provider_unavailable", "storage GET failed", retryable=True)
        return self.attempt

    def get_question(self, question_id: str) -> dict:
        return self.question

    def update_job_status(self, job_id: str, status: str, **meta) -> None:
        self.job_status.append((job_id, status))
        if meta:
            self.job_errors.append((job_id, meta))

    def complete_attempt(
        self, attempt_id: str, job_id: str, status: str, grade: dict | None
    ) -> None:
        self.finished.append(
            {"attemptId": attempt_id, "jobId": job_id, "status": status, "grade": grade}
        )
        self.attempt = {**self.attempt, "status": status, "grade": grade}


def _message(attempt_id: str = "attempt-01") -> QueueMessage:
    return QueueMessage(msg_id=7, payload={"jobId": "job-grade-01", "attemptId": attempt_id})


ATTEMPT = {
    "id": "attempt-01",
    "job_id": "job-grade-01",
    "question_id": "question-01",
    "status": "queued",
    "answer": {"index": 2},
}

QUESTION = {
    "id": "question-01",
    "material_id": "material-01",
    "format": "objective",
    "skill_tags": ["Caching"],
    "answer_block": {"correctIndex": 2},
}


def test_run_once_grades_and_completes_attempt() -> None:
    repo = FakeGradingRepo(ATTEMPT, QUESTION)
    worker = GradingWorker(repo=repo, queue=FakeQueue([_message()]), config=GradingWorkerConfig())
    processed = worker.run_once()

    assert processed == 1
    assert len(repo.finished) == 1
    outcome = repo.finished[0]
    assert outcome["status"] == "graded"
    assert outcome["grade"]["score"] == 1.0
    assert outcome["grade"]["grader"] == "objective"
    assert repo.job_status == [("job-grade-01", "running"), ("job-grade-01", "succeeded")]


def test_run_once_empty_queue_is_noop() -> None:
    repo = FakeGradingRepo(ATTEMPT, QUESTION)
    worker = GradingWorker(repo=repo, queue=FakeQueue(), config=GradingWorkerConfig())
    assert worker.run_once() == 0
    assert repo.finished == []


def test_incorrect_answer_still_succeeds_the_job() -> None:
    wrong = {**ATTEMPT, "answer": {"index": 0}}
    repo = FakeGradingRepo(wrong, QUESTION)
    worker = GradingWorker(repo=repo, queue=FakeQueue([_message()]), config=GradingWorkerConfig())
    worker.run_once()

    outcome = repo.finished[0]
    assert outcome["status"] == "graded"
    assert outcome["grade"]["score"] == 0.0
    assert outcome["grade"]["publicFeedback"] == "Not correct."


def test_malformed_answer_fails_attempt_not_the_job_budget() -> None:
    malformed = {**ATTEMPT, "answer": {"value": "2"}}
    repo = FakeGradingRepo(malformed, QUESTION)
    worker = GradingWorker(repo=repo, queue=FakeQueue([_message()]), config=GradingWorkerConfig())
    worker.run_once()

    outcome = repo.finished[0]
    assert outcome["status"] == "failed"
    assert outcome["grade"] is not None
    assert outcome["grade"]["score"] == 0.0
    assert "ungradable" in outcome["grade"]["publicFeedback"]


def test_transient_storage_error_leaves_job_retryable() -> None:
    repo = FakeGradingRepo(ATTEMPT, QUESTION)
    repo.fail_on_get = True
    queue = FakeQueue([_message()])
    worker = GradingWorker(repo=repo, queue=queue, config=GradingWorkerConfig())
    worker.run_once()

    assert repo.finished == []
    assert repo.job_status[-1] == ("job-grade-01", "queued")
    assert queue.completed == [(7, False)]  # message returns for redelivery


def test_message_missing_attempt_id_is_dropped() -> None:
    repo = FakeGradingRepo(ATTEMPT, QUESTION)
    queue = FakeQueue([QueueMessage(msg_id=9, payload={"jobId": "job-grade-01"})])
    worker = GradingWorker(repo=repo, queue=queue, config=GradingWorkerConfig())
    worker.run_once()

    assert repo.finished == []
    assert queue.completed == [(9, False)]


def test_queue_name_is_assessment_grade() -> None:
    assert GRADING_QUEUE == "assessment_grade"


# --- #41 written arm: llm_rubric grading through the same queue ---

REFERENCE_ANSWER = (
    "Bias correction divides each running estimate by one minus beta raised to "
    "the step count, which undoes the zero initialisation pull."
)

WRITTEN_QUESTION = {
    "id": "question-written-01",
    "material_id": "material-01",
    "format": "written",
    "subtype": "long_form",
    "prompt": "Explain why Adam needs bias correction.",
    "skill_tags": ["Optimization"],
    "citations": [{"chunkId": "c1", "quote": "Adam keeps moment estimates."}],
    "answer_block": {
        "rubricVersion": "written-rubric-v1",
        "referenceAnswer": REFERENCE_ANSWER,
        "rubric": [
            {"criterion": "Names both running estimates", "weight": 0.3, "maxPoints": 3},
            {"criterion": "States the correction term", "weight": 0.4, "maxPoints": 4},
            {
                "criterion": "Explains why early steps are affected most",
                "weight": 0.3,
                "maxPoints": 3,
            },
        ],
    },
}

WRITTEN_ATTEMPT = {
    "id": "attempt-written-01",
    "job_id": "job-grade-01",
    "question_id": "question-written-01",
    "status": "queued",
    "answer": {
        "text": "Adam averages the gradient and its square, both start at zero, so "
        "the first estimates are biased low."
    },
}


def _ok_response(*scores: float) -> NormalizedGenerationResponse:
    payload = {
        "criteria": [
            {"score": score, "feedback": f"criterion {index}"}
            for index, score in enumerate(scores)
        ],
        "explanation": "You named both estimates; the mechanism is implied.",
    }
    return NormalizedGenerationResponse(
        content=json.dumps(payload),
        refusal=None,
        finish_reason="stop",
        native_finish_reason="stop",
        structured_output=payload,
        usage={"prompt_tokens": 900, "completion_tokens": 120, "total_tokens": 1020},
        routed_provider="deepseek",
        outcome="ok",
        error=None,
        latency_ms=1840.0,
    )


def _failure_response(
    outcome: str,
    code: str,
    retryable: bool,
    *,
    retry_after: float | None = None,
) -> NormalizedGenerationResponse:
    error: dict = {"code": code, "message": f"{code} from provider", "retryable": retryable}
    if retry_after is not None:
        error["retryAfterSeconds"] = retry_after
    return NormalizedGenerationResponse(
        content=None,
        refusal=None,
        finish_reason="",
        native_finish_reason=None,
        structured_output=None,
        usage={},
        routed_provider=None,
        outcome=outcome,
        error=error,
        latency_ms=42.0,
    )


class FakeRubricAdapter:
    """Fake of the shared OpenRouter adapter; records every call it receives."""

    def __init__(self, *responses: NormalizedGenerationResponse) -> None:
        self.responses = list(responses)
        self.calls: list[dict] = []

    def generate(
        self,
        messages: list[dict],
        response_schema: dict,
        *,
        repair: bool = False,
        request_id: str = "",
        correlation_id: str = "",
    ) -> NormalizedGenerationResponse:
        self.calls.append(
            {
                "messages": messages,
                "schema": response_schema,
                "repair": repair,
                "correlationId": correlation_id,
            }
        )
        if not self.responses:
            raise AssertionError("rubric adapter called with no scripted response")
        return self.responses.pop(0)


def _written_worker(repo: FakeGradingRepo, adapter, queue: FakeQueue) -> GradingWorker:
    return GradingWorker(
        repo=repo,
        queue=queue,
        adapter=adapter,
        config=GradingWorkerConfig(model="deepseek/deepseek-v4-flash-0731"),
    )


def test_written_question_grades_through_the_rubric_arm() -> None:
    repo = FakeGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    queue = FakeQueue([_message("attempt-written-01")])
    adapter = FakeRubricAdapter(_ok_response(1.0, 1.0, 0.1667))
    _written_worker(repo, adapter, queue).run_once()

    outcome = repo.finished[0]
    grade = outcome["grade"]
    assert outcome["status"] == "graded"
    assert grade["grader"] == "llm_rubric"
    assert grade["modelVersion"] == "deepseek/deepseek-v4-flash-0731"
    assert grade["score"] == pytest.approx(0.75, abs=1e-3)
    assert grade["correct"] is True
    assert len(grade["rubricBreakdown"]) == 3
    assert grade["perSkill"] == [
        {"skillTag": "Optimization", "score": pytest.approx(0.75, abs=1e-3), "correct": True}
    ]
    assert repo.job_status == [("job-grade-01", "running"), ("job-grade-01", "succeeded")]
    assert queue.completed == [(7, True)]


def test_written_grading_call_carries_rubric_reference_and_learner_text() -> None:
    repo = FakeGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    adapter = FakeRubricAdapter(_ok_response(1.0, 1.0, 1.0))
    _written_worker(repo, adapter, FakeQueue([_message("attempt-written-01")])).run_once()

    assert len(adapter.calls) == 1
    call = adapter.calls[0]
    assert call["repair"] is False
    assert "criteria" in call["schema"]["properties"]
    user = call["messages"][1]["content"]
    assert "Names both running estimates" in user
    assert REFERENCE_ANSWER in user
    assert WRITTEN_ATTEMPT["answer"]["text"] in user
    assert "Adam keeps moment estimates." in user


def test_written_grade_never_persists_hidden_grading_material() -> None:
    repo = FakeGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    adapter = FakeRubricAdapter(_ok_response(0.5, 0.5, 0.5))
    _written_worker(repo, adapter, FakeQueue([_message("attempt-written-01")])).run_once()

    persisted = json.dumps(repo.finished[0]["grade"])
    assert REFERENCE_ANSWER not in persisted
    assert "rubricVersion" not in persisted
    assert "maxPoints" not in persisted


@pytest.mark.parametrize(
    ("outcome", "code", "retry_after"),
    [
        ("timeout", "provider_timeout", None),
        ("provider_error", "provider_unavailable", None),
        ("quota_failure", "quota_exhausted", 30.0),
        ("malformed_output", "malformed_output", None),
    ],
)
def test_retryable_provider_failure_redelivers_without_consuming_the_attempt(
    outcome: str, code: str, retry_after: float | None
) -> None:
    repo = FakeGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    queue = FakeQueue([_message("attempt-written-01")])
    adapter = FakeRubricAdapter(
        _failure_response(outcome, code, True, retry_after=retry_after)
    )
    _written_worker(repo, adapter, queue).run_once()

    assert repo.finished == []
    assert repo.job_status[-1] == ("job-grade-01", "failed")
    assert repo.job_errors[-1][1]["error_code"] == code
    assert repo.job_errors[-1][1]["retryable"] is True
    assert queue.completed == [(7, False)]  # message returns for redelivery


@pytest.mark.parametrize(
    ("outcome", "code"),
    [
        ("safety_block", "safety_block"),
        ("provider_error", "provider_credentials"),
        ("provider_error", "unsupported_request"),
        ("provider_error", "provider_error"),
    ],
)
def test_non_retryable_provider_failure_fails_the_attempt_closed(
    outcome: str, code: str
) -> None:
    repo = FakeGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    queue = FakeQueue([_message("attempt-written-01")])
    adapter = FakeRubricAdapter(_failure_response(outcome, code, False))
    _written_worker(repo, adapter, queue).run_once()

    outcome_row = repo.finished[0]
    assert outcome_row["status"] == "failed"
    assert outcome_row["grade"]["score"] == 0.0
    assert "ungradable" in outcome_row["grade"]["publicFeedback"]
    assert repo.job_status[-1] == ("job-grade-01", "succeeded")
    assert queue.completed == [(7, True)]


def test_written_missing_rubric_fails_closed_without_provider_spend() -> None:
    question = {**WRITTEN_QUESTION, "answer_block": {}}
    repo = FakeGradingRepo(WRITTEN_ATTEMPT, question)
    adapter = FakeRubricAdapter()
    _written_worker(repo, adapter, FakeQueue([_message("attempt-written-01")])).run_once()

    assert adapter.calls == []
    assert repo.finished[0]["status"] == "failed"
    assert repo.finished[0]["grade"]["grader"] == "llm_rubric"
    assert "ungradable" in repo.finished[0]["grade"]["publicFeedback"]


@pytest.mark.parametrize("answer", [{"text": "   "}, {}, {"text": 7}])
def test_written_empty_answer_fails_closed_without_provider_spend(answer: dict) -> None:
    attempt = {**WRITTEN_ATTEMPT, "answer": answer}
    repo = FakeGradingRepo(attempt, WRITTEN_QUESTION)
    adapter = FakeRubricAdapter()
    _written_worker(repo, adapter, FakeQueue([_message("attempt-written-01")])).run_once()

    assert adapter.calls == []
    assert repo.finished[0]["status"] == "failed"


def test_written_grading_without_an_adapter_fails_closed() -> None:
    repo = FakeGradingRepo(WRITTEN_ATTEMPT, WRITTEN_QUESTION)
    queue = FakeQueue([_message("attempt-written-01")])
    worker = GradingWorker(repo=repo, queue=queue, config=GradingWorkerConfig())
    worker.run_once()

    assert repo.finished[0]["status"] == "failed"
    assert queue.completed == [(7, True)]


def test_objective_questions_never_call_the_rubric_adapter() -> None:
    class ExplodingAdapter(FakeRubricAdapter):
        def generate(self, *args, **kwargs):
            raise AssertionError("objective grading must stay deterministic")

    repo = FakeGradingRepo(ATTEMPT, QUESTION)
    worker = _written_worker(repo, ExplodingAdapter(), FakeQueue([_message()]))
    worker.run_once()

    assert repo.finished[0]["status"] == "graded"
    assert repo.finished[0]["grade"]["grader"] == "objective"
