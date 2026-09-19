"""Typed client for the self-hosted Piston sandbox (#42, D-02 fallback).

Judge0 CE was rejected at the P2 isolate gate (its bundled isolate 1.8.1 is
cgroup-v1-only; this Docker Desktop/WSL2 host is cgroup-v2-only), so the
sandbox is Piston (MIT, single container, cgroup v2): `POST /api/v2/execute`
runs untrusted learner code under `isolate` and returns the result of the
run stage synchronously. This module is the only one in the grading path
that knows a sandbox exists: the grading arm talks verdicts, so swapping
the runner is one client module.

Verdict mapping (verified live 2026-09-16):
- `run.status == "TO"` (or signal SIGKILL) -> timeout
- `run.status == "XX"` -> internal sandbox error -> retryable infra
- `run.status == "RE"`, a signal, or a non-zero exit code -> runtime error;
  a non-zero exit whose stderr names a syntax fault is classified as a
  compile error (Python compiles at run time; the traceback always names
  SyntaxError/IndentationError/TabError)
- a clean zero-exit run -> compare `stdout` against `expected_output`
  (trailing whitespace and CRLF normalized on both sides)

Error normalization follows rule 22 and the reranker-client precedent: raw
httpx failures never reach callers. The pgmq redelivery owns retries, so the
client does no internal retry. Sandbox-infra conditions (transport faults,
5xx, internal verdicts) raise a retryable `IngestionError`; a 4xx on our own
request is a caller bug and raises non-retryable so the worker fails the
attempt closed instead of looping the queue.

The learner's source, stdin, expected outputs, stdout and stderr are
learner/author content and never appear in logs (D-11): each verdict logs
attempt id, test index and duration only.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Callable
from dataclasses import dataclass

import httpx

from app.ingestion.models import IngestionError

logger = logging.getLogger("grading.piston")

DEFAULT_URL = os.getenv("PISTON_URL", "http://127.0.0.1:2000")
# Piston python 3.12.0, installed on first use into the piston-packages
# volume (docker-compose.yml). Verified live at the P2 smoke test.
DEFAULT_PYTHON_VERSION = "3.12.0"

RUN_PASSED = "passed"
RUN_FAILED = "failed"
RUN_TIMEOUT = "timeout"
RUN_COMPILE_ERROR = "compile_error"
RUN_RUNTIME_ERROR = "runtime_error"

_STATUS_TIMEOUT = "TO"
_STATUS_RUNTIME = "RE"
_STATUS_INTERNAL = "XX"
_SYNTAX_FAULTS = ("SyntaxError", "IndentationError", "TabError")


@dataclass(frozen=True)
class SandboxRun:
    """One executed test's verdict: an outcome plus the round-trip duration."""

    outcome: str
    duration_ms: int


def _normalize_output(text: str) -> str:
    """Normalize both sides of the comparison; Judge0-style trailing trim."""
    return text.replace("\r\n", "\n").rstrip()


def _verdict(run: dict, expected_output: str) -> str:
    """Map one Piston run stage onto the grading outcomes.

    Raises a retryable `IngestionError` only for sandbox-internal faults
    (`XX` or a missing run shape); everything else is the learner's code.
    """
    if not isinstance(run, dict):
        raise IngestionError(
            "provider_unavailable", "piston response has no run object", retryable=True
        )
    status = run.get("status")
    if status == _STATUS_TIMEOUT:
        return RUN_TIMEOUT
    if status == _STATUS_INTERNAL:
        raise IngestionError(
            "provider_unavailable", "piston sandbox failed internally", retryable=True
        )
    signal = run.get("signal")
    code = run.get("code")
    if status == _STATUS_RUNTIME or signal is not None or (
        isinstance(code, int) and code != 0
    ):
        stderr = run.get("stderr") or ""
        if isinstance(code, int) and code != 0 and any(
            fault in stderr for fault in _SYNTAX_FAULTS
        ):
            return RUN_COMPILE_ERROR
        return RUN_RUNTIME_ERROR
    stdout = run.get("stdout")
    if not isinstance(stdout, str):
        raise IngestionError(
            "provider_unavailable", "piston run has no stdout", retryable=True
        )
    if _normalize_output(stdout) == _normalize_output(expected_output):
        return RUN_PASSED
    return RUN_FAILED


class PistonClient:
    """Execute one test through the Piston sandbox and return its verdict."""

    def __init__(
        self,
        base_url: str = DEFAULT_URL,
        *,
        python_version: str = DEFAULT_PYTHON_VERSION,
        http_timeout_seconds: float = 60.0,
        max_cpu_time_ms: int = 15000,
        wall_time_extra_ms: int = 1000,
        max_memory_mb: int = 256,
        time_fn: Callable[[], float] | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        import time

        self._base_url = base_url.rstrip("/")
        self._python_version = python_version
        self._http_timeout = http_timeout_seconds
        self._max_cpu_time_ms = max_cpu_time_ms
        self._wall_time_extra_ms = wall_time_extra_ms
        self._max_memory_mb = max_memory_mb
        self._time = time_fn or time.monotonic
        self._client = client

    def execute(
        self,
        *,
        source: str,
        stdin: str,
        expected_output: str,
        time_limit_ms: int,
        memory_limit_mb: int,
        attempt_id: str = "",
        test_index: int = 0,
        trace_id: str = "",
    ) -> SandboxRun:
        """Run `source` once against one test and return the terminal verdict.

        The learner-requested limits are clamped to the configured ceilings
        (D-05: pins live in PISTON_* env, not code). The execute call is
        synchronous: Piston runs the job before answering, so the HTTP
        timeout is set above the largest wall-time pin.
        """
        cpu_ms = min(int(time_limit_ms), self._max_cpu_time_ms)
        wall_ms = cpu_ms + self._wall_time_extra_ms
        memory_bytes = min(int(memory_limit_mb), self._max_memory_mb) * 1024 * 1024
        payload = {
            "language": "python",
            "version": self._python_version,
            "files": [{"content": source}],
            "stdin": stdin,
            "run_timeout": wall_ms,
            "run_cpu_time": cpu_ms,
            "run_memory_limit": memory_bytes,
        }
        started = self._time()
        run = self._execute(payload)
        outcome = _verdict(run, expected_output)
        elapsed_ms = int((self._time() - started) * 1000)
        logger.info(
            "piston execution attempt=%s test=%d outcome=%s duration_ms=%d",
            attempt_id,
            test_index,
            outcome,
            elapsed_ms,
            extra={"trace_id": trace_id},
        )
        return SandboxRun(outcome=outcome, duration_ms=elapsed_ms)

    def _execute(self, payload: dict) -> dict:
        client = self._client or httpx.Client(timeout=self._http_timeout)
        try:
            response = client.post(f"{self._base_url}/api/v2/execute", json=payload)
        except httpx.TimeoutException as exc:
            raise IngestionError(
                "provider_timeout", "piston execution request timed out", retryable=True
            ) from exc
        except httpx.HTTPError as exc:
            raise IngestionError(
                "provider_unavailable", f"piston execution request failed: {exc}",
                retryable=True,
            ) from exc
        finally:
            if self._client is None:
                client.close()
        if response.status_code >= 500:
            raise IngestionError(
                "provider_unavailable",
                f"piston responded {response.status_code} to the execution",
                retryable=True,
            )
        if response.status_code >= 400:
            raise IngestionError(
                "provider_unavailable",
                f"piston rejected the execution ({response.status_code}): {response.text[:200]}",
                retryable=False,
            )
        body = response.json()
        run = body.get("run") if isinstance(body, dict) else None
        if not isinstance(run, dict):
            raise IngestionError(
                "provider_unavailable", "piston response has no run object", retryable=True
            )
        return run