"""Coding grading arm tests (#42 P2): sandbox client, grader, worker dispatch.

The sandbox client is exercised through httpx.MockTransport (no live sandbox
in unit tests); the grader is pure composition; the worker arm runs through
the shared FakeGradingRepo/FakeQueue doubles with a scripted fake sandbox, so
no execution leaves the test.
"""

from __future__ import annotations

import json
import logging

import httpx
import pytest

from app.grading.coding_grader import (
    TestVerdict,
    coding_submission,
    grade_coding,
    hidden_test_name,
    hidden_tests,
    visible_tests,
)
from app.grading.grader import CORRECT_THRESHOLD, GraderInputError
from app.grading.piston_client import (
    RUN_COMPILE_ERROR,
    RUN_FAILED,
    RUN_PASSED,
    RUN_RUNTIME_ERROR,
    RUN_TIMEOUT,
    PistonClient,
    SandboxRun,
)
from app.grading.worker import GradingWorker, GradingWorkerConfig
from app.ingestion.models import IngestionError
from tests.test_grading_worker import FakeGradingRepo, FakeQueue, _message

HIDDEN_EXPECTED = "0\n1\n2\n3\n"
HIDDEN_STDIN = "hidden-stdin-marker\n"


def _piston(transport: httpx.MockTransport, **kwargs) -> PistonClient:
    return PistonClient(client=httpx.Client(transport=transport), **kwargs)


def _run_response(run: dict) -> dict:
    return {"run": run, "language": "python", "version": "3.12.0"}


def _handler(run: dict, *, status: int = 200) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/v2/execute" and request.method == "POST":
            return httpx.Response(status, json=_run_response(run))
        return httpx.Response(404, json={})

    return httpx.MockTransport(handler)


def _ok_run(stdout: str = "ok\n") -> dict:
    return {"status": None, "code": 0, "signal": None, "stdout": stdout, "stderr": ""}


# --- sandbox client: verdict mapping and error normalization ---


def test_client_passed_on_matching_stdout() -> None:
    client = _piston(_handler(_ok_run()))
    run = client.execute(
        source="print(input())",
        stdin="ok",
        expected_output="ok",
        time_limit_ms=30000,
        memory_limit_mb=1024,
    )
    assert run.outcome == RUN_PASSED
    assert run.duration_ms >= 0


def test_client_failed_on_stdout_mismatch() -> None:
    client = _piston(_handler(_ok_run(stdout="nope\n")))
    run = client.execute(
        source="print('nope')",
        stdin="",
        expected_output="ok",
        time_limit_ms=2000,
        memory_limit_mb=128,
    )
    assert run.outcome == RUN_FAILED


def test_client_ignores_trailing_whitespace_on_both_sides() -> None:
    client = _piston(_handler(_ok_run(stdout="ok  \r\n")))
    run = client.execute(
        source="print('ok')",
        stdin="",
        expected_output="ok\n",
        time_limit_ms=2000,
        memory_limit_mb=128,
    )
    assert run.outcome == RUN_PASSED


def test_client_timeout_status() -> None:
    run = {"status": "TO", "code": None, "signal": "SIGKILL", "stdout": "", "stderr": ""}
    result = _piston(_handler(run)).execute(
        source="while True: pass",
        stdin="",
        expected_output="",
        time_limit_ms=2000,
        memory_limit_mb=128,
    )
    assert result.outcome == RUN_TIMEOUT


def test_client_syntax_error_is_compile_error() -> None:
    run = {
        "status": "RE",
        "code": 1,
        "signal": None,
        "stdout": "",
        "stderr": '  File "x", line 1\n    def foo(:\nSyntaxError: invalid syntax\n',
    }
    result = _piston(_handler(run)).execute(
        source="def foo(:",
        stdin="",
        expected_output="",
        time_limit_ms=2000,
        memory_limit_mb=128,
    )
    assert result.outcome == RUN_COMPILE_ERROR


def test_client_runtime_error_is_runtime() -> None:
    run = {
        "status": "RE",
        "code": 1,
        "signal": None,
        "stdout": "",
        "stderr": "Traceback (most recent call last):\nZeroDivisionError\n",
    }
    result = _piston(_handler(run)).execute(
        source="print(1/0)",
        stdin="",
        expected_output="",
        time_limit_ms=2000,
        memory_limit_mb=128,
    )
    assert result.outcome == RUN_RUNTIME_ERROR


def test_client_internal_error_is_retryable() -> None:
    run = {"status": "XX", "code": None, "signal": None, "stdout": "", "stderr": ""}
    with pytest.raises(IngestionError) as excinfo:
        _piston(_handler(run)).execute(
            source="x",
            stdin="",
            expected_output="",
            time_limit_ms=2000,
            memory_limit_mb=128,
        )
    assert excinfo.value.retryable is True
    assert excinfo.value.code == "provider_unavailable"


def test_client_5xx_is_retryable() -> None:
    with pytest.raises(IngestionError) as excinfo:
        _piston(_handler({}, status=500)).execute(
            source="x",
            stdin="",
            expected_output="",
            time_limit_ms=2000,
            memory_limit_mb=128,
        )
    assert excinfo.value.retryable is True


def test_client_4xx_is_not_retryable() -> None:
    with pytest.raises(IngestionError) as excinfo:
        _piston(_handler({}, status=400)).execute(
            source="x",
            stdin="",
            expected_output="",
            time_limit_ms=2000,
            memory_limit_mb=128,
        )
    assert excinfo.value.retryable is False


def test_client_transport_timeout_is_provider_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out")

    with pytest.raises(IngestionError) as excinfo:
        _piston(httpx.MockTransport(handler)).execute(
            source="x",
            stdin="",
            expected_output="",
            time_limit_ms=2000,
            memory_limit_mb=128,
        )
    assert excinfo.value.code == "provider_timeout"
    assert excinfo.value.retryable is True


def test_client_missing_run_object_is_retryable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"language": "python"})

    with pytest.raises(IngestionError) as excinfo:
        _piston(httpx.MockTransport(handler)).execute(
            source="x",
            stdin="",
            expected_output="",
            time_limit_ms=2000,
            memory_limit_mb=128,
        )
    assert excinfo.value.retryable is True


def test_client_clamps_learner_limits_and_sends_python_payload() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json=_run_response(_ok_run()))

    client = _piston(
        httpx.MockTransport(handler),
        python_version="3.12.0",
        max_cpu_time_ms=15000,
        wall_time_extra_ms=1000,
        max_memory_mb=256,
    )
    client.execute(
        source="print('ok')",
        stdin="",
        expected_output="ok",
        time_limit_ms=30000,
        memory_limit_mb=1024,
    )
    body = captured["body"]
    assert body["language"] == "python"
    assert body["version"] == "3.12.0"
    assert body["files"] == [{"content": "print('ok')"}]
    assert body["run_cpu_time"] == 15000
    assert body["run_timeout"] == 16000
    assert body["run_memory_limit"] == 256 * 1024 * 1024


def test_client_logs_verdict_with_trace_id_and_never_source(caplog) -> None:
    caplog.set_level(logging.INFO, logger="grading.piston")
    client = _piston(_handler(_ok_run()))
    client.execute(
        source="SECRET_SOURCE_MARKER",
        stdin="SECRET_STDIN_MARKER",
        expected_output="ok",
        time_limit_ms=2000,
        memory_limit_mb=128,
        attempt_id="attempt-01",
        test_index=2,
        trace_id="corr-trace-01",
    )
    records = [record for record in caplog.records if record.name == "grading.piston"]
    assert records
    record = records[-1]
    assert record.__dict__["trace_id"] == "corr-trace-01"
    assert record.getMessage().count("attempt-01") == 1
    assert record.getMessage().count("test=2") == 1
    assert record.getMessage().count("outcome=passed") == 1
    for _logger, _level, message in caplog.record_tuples:
        assert "SECRET_SOURCE_MARKER" not in message
        assert "SECRET_STDIN_MARKER" not in message


# --- grader: score math, templates, redaction ---


def _verdicts(visible: int, hidden: int, *, passed_hidden: int) -> list[TestVerdict]:
    verdicts = [
        TestVerdict(name=f"Visible {index}", visible=True, outcome=RUN_PASSED)
        for index in range(1, visible + 1)
    ]
    for index in range(1, hidden + 1):
        outcome = RUN_PASSED if index <= passed_hidden else RUN_FAILED
        verdicts.append(TestVerdict(name=hidden_test_name(index), visible=False, outcome=outcome))
    return verdicts


def _grade(verdicts: list[TestVerdict]) -> dict:
    return grade_coding(
        question_id="question-01",
        material_id="material-01",
        skill_tags=["algorithms"],
        verdicts=verdicts,
        graded_at="2026-09-16T10:00:00Z",
        attempt_id="attempt-01",
    )


def test_grade_coding_all_pass() -> None:
    grade = _grade(_verdicts(visible=2, hidden=5, passed_hidden=5))
    assert grade["score"] == 1.0
    assert grade["correct"] is True
    assert grade["grader"] == "judge0"
    assert grade["explanation"] is None
    assert grade["publicFeedback"] == "Passed 5/5 hidden tests."
    assert grade["perSkill"] == [{"skillTag": "algorithms", "score": 1.0, "correct": True}]
    names = [case["name"] for case in grade["testCases"]]
    assert names[:2] == ["Visible 1", "Visible 2"]
    assert names[2:] == [hidden_test_name(i) for i in range(1, 6)]
    assert [case["visible"] for case in grade["testCases"]] == [
        True,
        True,
        False,
        False,
        False,
        False,
        False,
    ]
    assert all(case["passed"] for case in grade["testCases"])


def test_grade_coding_partial_score() -> None:
    grade = _grade(_verdicts(visible=2, hidden=10, passed_hidden=7))
    assert grade["score"] == 0.7
    assert grade["correct"] is True
    assert grade["publicFeedback"] == "Passed 7/10 hidden tests."


def test_grade_coding_zero_score() -> None:
    grade = _grade(_verdicts(visible=1, hidden=3, passed_hidden=0))
    assert grade["score"] == 0.0
    assert grade["correct"] is False


def test_grade_coding_threshold_boundary() -> None:
    verdicts = _verdicts(visible=1, hidden=10, passed_hidden=6)
    grade = _grade(verdicts)
    assert grade["score"] == 0.6
    assert grade["correct"] is (0.6 >= CORRECT_THRESHOLD)


def test_grade_coding_compile_error_template() -> None:
    verdicts = [
        TestVerdict(name="Visible 1", visible=True, outcome=RUN_COMPILE_ERROR),
        TestVerdict(name="Hidden test 1", visible=False, outcome=RUN_FAILED),
    ]
    assert _grade(verdicts)["publicFeedback"] == "Your code did not compile."


def test_grade_coding_timeout_template() -> None:
    verdicts = [
        TestVerdict(name="Visible 1", visible=True, outcome=RUN_TIMEOUT),
        TestVerdict(name="Hidden test 1", visible=False, outcome=RUN_FAILED),
    ]
    assert _grade(verdicts)["publicFeedback"] == "Your submission timed out."


def test_grade_coding_runtime_error_template() -> None:
    verdicts = [
        TestVerdict(name="Visible 1", visible=True, outcome=RUN_RUNTIME_ERROR),
        TestVerdict(name="Hidden test 1", visible=False, outcome=RUN_FAILED),
    ]
    assert _grade(verdicts)["publicFeedback"] == "Your submission raised a runtime error."


def test_grade_coding_redacts_hidden_content() -> None:
    grade = _grade(_verdicts(visible=2, hidden=3, passed_hidden=2))

    def walk(value):
        yield value
        if isinstance(value, dict):
            for key, child in value.items():
                yield key
                yield from walk(child)
        elif isinstance(value, list):
            for child in value:
                yield from walk(child)

    serialized = json.dumps(grade)
    assert "hiddenTests" not in serialized
    assert "referenceSolution" not in serialized
    assert HIDDEN_EXPECTED not in serialized
    assert HIDDEN_STDIN not in serialized
    assert "h1" not in serialized
    for item in walk(grade):
        if isinstance(item, str):
            assert item.replace("_", "").replace("-", "").lower() not in {
                "hiddentests",
                "referencesolution",
                "hiddenanswer",
            }


def test_grade_coding_requires_hidden_verdicts() -> None:
    with pytest.raises(GraderInputError):
        _grade([TestVerdict(name="Visible 1", visible=True, outcome=RUN_PASSED)])
    with pytest.raises(GraderInputError):
        _grade([])


# --- validators ---


def test_hidden_test_name_is_veiled() -> None:
    assert hidden_test_name(1) == "Hidden test 1"
    assert hidden_test_name(10) == "Hidden test 10"


def test_coding_submission_accepts_valid_answer() -> None:
    answer = {
        "language": "python",
        "source": "def fib(n):\n    return n",
        "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 128},
    }
    assert coding_submission(answer) == ("def fib(n):\n    return n", 2000, 128)


@pytest.mark.parametrize(
    "answer",
    [
        {},
        {
            "language": "javascript",
            "source": "x",
            "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 128},
        },
        {
            "language": "python",
            "source": "",
            "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 128},
        },
        {
            "language": "python",
            "source": "x" * 100001,
            "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 128},
        },
        {"language": "python", "source": "x"},
        {
            "language": "python",
            "source": "x",
            "config": {"stdin": 42, "timeLimitMs": 2000, "memoryLimitMb": 128},
        },
        {
            "language": "python",
            "source": "x",
            "config": {"stdin": "", "timeLimitMs": 99, "memoryLimitMb": 128},
        },
        {
            "language": "python",
            "source": "x",
            "config": {"stdin": "", "timeLimitMs": 30001, "memoryLimitMb": 128},
        },
        {
            "language": "python",
            "source": "x",
            "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 15},
        },
        {
            "language": "python",
            "source": "x",
            "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 1025},
        },
    ],
)
def test_coding_submission_rejects_bad_shapes(answer: dict) -> None:
    with pytest.raises(GraderInputError):
        coding_submission(answer)


def test_hidden_tests_validation() -> None:
    good = {"hiddenTests": [{"name": "h1", "stdin": "", "expectedOutput": "x"}]}
    assert len(hidden_tests(good)) == 1
    with pytest.raises(GraderInputError):
        hidden_tests({"hiddenTests": []})
    with pytest.raises(GraderInputError):
        hidden_tests({"hiddenTests": "nope"})
    with pytest.raises(GraderInputError):
        hidden_tests({"hiddenTests": [{"name": "", "stdin": "", "expectedOutput": "x"}]})
    with pytest.raises(GraderInputError):
        hidden_tests({"hiddenTests": [{"name": "h", "stdin": "", "expectedOutput": 42}]})
    with pytest.raises(GraderInputError):
        hidden_tests({})
    too_many = {
        "hiddenTests": [{"name": f"h{i}", "stdin": "", "expectedOutput": "x"} for i in range(11)]
    }
    with pytest.raises(GraderInputError):
        hidden_tests(too_many)


def test_visible_tests_validation() -> None:
    assert visible_tests({"visible_tests": None}) == []
    assert visible_tests({}) == []
    good = {"visible_tests": [{"name": "v", "stdin": "", "expectedOutput": "x"}]}
    assert len(visible_tests(good)) == 1
    with pytest.raises(GraderInputError):
        visible_tests({"visible_tests": "nope"})
    too_many = {
        "visible_tests": [{"name": f"v{i}", "stdin": "", "expectedOutput": "x"} for i in range(4)]
    }
    with pytest.raises(GraderInputError):
        visible_tests(too_many)


# --- worker arm: dispatch, short-circuit, infra split ---


class FakeSandbox:
    """Scripted stand-in for PistonClient; records every call."""

    def __init__(self, *runs: SandboxRun) -> None:
        self.runs = list(runs)
        self.calls: list[dict] = []

    def execute(self, **kwargs) -> SandboxRun:
        self.calls.append(kwargs)
        if not self.runs:
            raise AssertionError("sandbox called with no scripted run")
        return self.runs.pop(0)


CODING_QUESTION = {
    "id": "question-coding-01",
    "material_id": "material-01",
    "format": "coding",
    "subtype": "implement_fn",
    "prompt": "Implement fib(n).",
    "skill_tags": ["algorithms"],
    "citations": [],
    "visible_tests": [
        {"name": "base cases", "stdin": "", "expectedOutput": "0\n1\n"},
        {"name": "small n", "stdin": "", "expectedOutput": "55\n"},
    ],
    "answer_block": {
        "hiddenTests": [
            {"name": "h1", "stdin": HIDDEN_STDIN, "expectedOutput": HIDDEN_EXPECTED},
            {"name": "h2", "stdin": HIDDEN_STDIN, "expectedOutput": HIDDEN_EXPECTED},
            {"name": "h3", "stdin": HIDDEN_STDIN, "expectedOutput": HIDDEN_EXPECTED},
        ],
        "referenceSolution": "def fib(n):\n    return n",
    },
}

CODING_ATTEMPT = {
    "id": "attempt-coding-01",
    "job_id": "job-grade-01",
    "question_id": "question-coding-01",
    "status": "queued",
    "correlation_id": "corr-coding-01",
    "answer": {
        "language": "python",
        "source": "def fib(n):\n    return n",
        "config": {"stdin": "", "timeLimitMs": 2000, "memoryLimitMb": 128},
    },
}


def _coding_worker(repo: FakeGradingRepo, queue: FakeQueue, sandbox) -> GradingWorker:
    return GradingWorker(
        repo=repo,
        queue=queue,
        adapter=None,
        sandbox=sandbox,
        config=GradingWorkerConfig(),
    )


def test_coding_question_grades_through_sandbox() -> None:
    repo = FakeGradingRepo(CODING_ATTEMPT, CODING_QUESTION)
    queue = FakeQueue([_message("attempt-coding-01")])
    sandbox = FakeSandbox(*(SandboxRun(RUN_PASSED, 12) for _ in range(5)))
    _coding_worker(repo, queue, sandbox).run_once()

    assert len(sandbox.calls) == 5
    assert sandbox.calls[0]["source"] == "def fib(n):\n    return n"
    assert sandbox.calls[0]["trace_id"] == "corr-coding-01"
    assert sandbox.calls[0]["time_limit_ms"] == 2000
    assert sandbox.calls[0]["memory_limit_mb"] == 128
    outcome = repo.finished[0]
    grade = outcome["grade"]
    assert outcome["status"] == "graded"
    assert grade["grader"] == "judge0"
    assert grade["score"] == 1.0
    assert len(grade["testCases"]) == 5
    assert grade["testCases"][0] == {"name": "base cases", "passed": True, "visible": True}
    assert grade["testCases"][2] == {"name": "Hidden test 1", "passed": True, "visible": False}
    assert queue.completed == [(7, True)]
    assert repo.job_status[-1] == ("job-grade-01", "succeeded")


def test_coding_compile_error_short_circuits_and_pads() -> None:
    repo = FakeGradingRepo(CODING_ATTEMPT, CODING_QUESTION)
    queue = FakeQueue([_message("attempt-coding-01")])
    sandbox = FakeSandbox(SandboxRun(RUN_COMPILE_ERROR, 8))
    _coding_worker(repo, queue, sandbox).run_once()

    assert len(sandbox.calls) == 1
    grade = repo.finished[0]["grade"]
    assert grade["score"] == 0.0
    assert grade["correct"] is False
    assert grade["publicFeedback"] == "Your code did not compile."
    assert len(grade["testCases"]) == 5
    assert [case["passed"] for case in grade["testCases"]] == [False] * 5


def test_output_prediction_grades_objective_without_sandbox() -> None:
    question = {
        **CODING_QUESTION,
        "subtype": "output_prediction",
        "answer_block": {"acceptedValue": 42},
    }
    attempt = {
        **CODING_ATTEMPT,
        "question_id": "question-coding-01",
        "answer": {"value": "42"},
    }
    repo = FakeGradingRepo(attempt, question)
    queue = FakeQueue([_message("attempt-coding-01")])
    sandbox = FakeSandbox()
    _coding_worker(repo, queue, sandbox).run_once()

    assert sandbox.calls == []
    grade = repo.finished[0]["grade"]
    assert grade["grader"] == "objective"
    assert grade["score"] == 1.0
    assert grade["correct"] is True
    assert "testCases" not in grade


def test_output_prediction_wrong_value_scores_zero() -> None:
    question = {
        **CODING_QUESTION,
        "subtype": "output_prediction",
        "answer_block": {"acceptedValue": 42},
    }
    attempt = {**CODING_ATTEMPT, "answer": {"value": "7"}}
    repo = FakeGradingRepo(attempt, question)
    queue = FakeQueue([_message("attempt-coding-01")])
    _coding_worker(repo, queue, FakeSandbox()).run_once()

    assert repo.finished[0]["grade"]["score"] == 0.0


def test_sandbox_infra_error_redelivers_when_retryable() -> None:
    repo = FakeGradingRepo(CODING_ATTEMPT, CODING_QUESTION)
    queue = FakeQueue([_message("attempt-coding-01")])

    class FlakySandbox(FakeSandbox):
        def execute(self, **kwargs) -> SandboxRun:
            raise IngestionError("provider_unavailable", "sandbox down", retryable=True)

    _coding_worker(repo, queue, FlakySandbox()).run_once()

    assert repo.finished == []
    assert repo.job_status[-1] == ("job-grade-01", "failed")
    assert repo.job_errors[-1][1]["error_code"] == "provider_unavailable"
    assert repo.job_errors[-1][1]["retryable"] is True
    assert queue.completed == [(7, False)]


def test_sandbox_error_fails_closed_when_not_retryable() -> None:
    repo = FakeGradingRepo(CODING_ATTEMPT, CODING_QUESTION)
    queue = FakeQueue([_message("attempt-coding-01")])

    class RejectingSandbox(FakeSandbox):
        def execute(self, **kwargs) -> SandboxRun:
            raise IngestionError("provider_unavailable", "rejected", retryable=False)

    _coding_worker(repo, queue, RejectingSandbox()).run_once()

    outcome = repo.finished[0]
    assert outcome["status"] == "failed"
    assert outcome["grade"]["grader"] == "judge0"
    assert outcome["grade"]["score"] == 0.0
    assert "ungradable" in outcome["grade"]["publicFeedback"]
    assert queue.completed == [(7, True)]


def test_coding_without_sandbox_client_fails_closed() -> None:
    repo = FakeGradingRepo(CODING_ATTEMPT, CODING_QUESTION)
    queue = FakeQueue([_message("attempt-coding-01")])
    worker = GradingWorker(repo=repo, queue=queue, adapter=None, config=GradingWorkerConfig())
    worker.run_once()

    outcome = repo.finished[0]
    assert outcome["status"] == "failed"
    assert outcome["grade"]["grader"] == "judge0"
    assert "requires a sandbox client" in outcome["grade"]["publicFeedback"]


def test_coding_malformed_answer_fails_closed_without_sandbox_call() -> None:
    attempt = {**CODING_ATTEMPT, "answer": {"language": "javascript", "source": "x"}}
    repo = FakeGradingRepo(attempt, CODING_QUESTION)
    queue = FakeQueue([_message("attempt-coding-01")])
    sandbox = FakeSandbox()
    _coding_worker(repo, queue, sandbox).run_once()

    assert sandbox.calls == []
    assert repo.finished[0]["grade"]["grader"] == "judge0"
    assert "ungradable" in repo.finished[0]["grade"]["publicFeedback"]


def test_objective_question_never_calls_sandbox() -> None:
    attempt = {
        "id": "attempt-obj-01",
        "job_id": "job-grade-01",
        "question_id": "question-obj-01",
        "status": "queued",
        "answer": {"index": 2},
    }
    question = {
        "id": "question-obj-01",
        "material_id": "material-01",
        "format": "objective",
        "skill_tags": ["algorithms"],
        "answer_block": {"correctIndex": 2},
    }
    repo = FakeGradingRepo(attempt, question)
    queue = FakeQueue([_message("attempt-obj-01")])
    sandbox = FakeSandbox()
    _coding_worker(repo, queue, sandbox).run_once()

    assert sandbox.calls == []
    assert repo.finished[0]["grade"]["grader"] == "objective"
    assert repo.finished[0]["grade"]["score"] == 1.0


def test_coding_grading_logs_trace_id_on_verdicts(caplog) -> None:
    caplog.set_level(logging.INFO, logger="grading.worker")
    repo = FakeGradingRepo(CODING_ATTEMPT, CODING_QUESTION)
    queue = FakeQueue([_message("attempt-coding-01")])
    sandbox = FakeSandbox(*(SandboxRun(RUN_PASSED, 10) for _ in range(5)))
    _coding_worker(repo, queue, sandbox).run_once()

    records = [record for record in caplog.records if record.name == "grading.worker"]
    assert records
    record = records[-1]
    assert record.__dict__["trace_id"] == "corr-coding-01"
    assert "score=1.0000" in record.getMessage()
    assert "def fib" not in record.getMessage()
