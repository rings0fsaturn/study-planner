from __future__ import annotations

import threading

import pytest

import app.worker_main as worker_main
from tests.test_generation_worker import FakeGenerationRepo, FakeTelemetry


def test_build_generation_worker_parses_env_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict = {}

    def fake_adapter_factory(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(
        "app.generation.openrouter_client.OpenRouterGenerationClient", fake_adapter_factory
    )
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("SUPABASE_URL", "https://supabase.example")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "svc-key")
    repo = FakeGenerationRepo()
    queue = object()
    telemetry = FakeTelemetry()

    worker = worker_main._build_generation_worker(object(), repo, queue, telemetry)

    assert captured["api_key"] == ""
    assert captured["base_url"] == "https://openrouter.ai/api/v1"
    assert captured["model"] == "deepseek/deepseek-v4-flash-0731"
    assert captured["timeout_ms"] == 30000
    assert captured["max_output_tokens"] == 4096
    assert captured["temperature"] == 0.3
    assert captured["reasoning_effort"] == "off"
    assert worker.config.poll_interval_seconds == 1.0
    assert worker.config.visibility_seconds == 90
    assert worker.config.model == "deepseek/deepseek-v4-flash-0731"


def test_build_generation_worker_parses_env_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict = {}

    def fake_adapter_factory(**kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(
        "app.generation.openrouter_client.OpenRouterGenerationClient", fake_adapter_factory
    )
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    monkeypatch.setenv("GENERATION_MODEL", "deepseek/deepseek-v4-flash-9999")
    monkeypatch.setenv("GENERATION_TIMEOUT_MS", "45000")
    monkeypatch.setenv("GENERATION_MAX_OUTPUT_TOKENS", "8192")
    monkeypatch.setenv("GENERATION_TEMPERATURE", "0.7")
    monkeypatch.setenv("GENERATION_REASONING_EFFORT", "low")
    monkeypatch.setenv("GENERATION_POLL_INTERVAL_SECONDS", "2.5")
    monkeypatch.setenv("GENERATION_VISIBILITY_SECONDS", "120")
    repo = FakeGenerationRepo()

    worker = worker_main._build_generation_worker(object(), repo, object(), FakeTelemetry())

    assert captured["api_key"] == "sk-test"
    assert captured["model"] == "deepseek/deepseek-v4-flash-9999"
    assert captured["timeout_ms"] == 45000
    assert captured["max_output_tokens"] == 8192
    assert captured["temperature"] == 0.7
    assert captured["reasoning_effort"] == "low"
    assert worker.config.poll_interval_seconds == 2.5
    assert worker.config.visibility_seconds == 120


class CountingWorker:
    def __init__(self) -> None:
        self.runs = 0
        self.config = type("Cfg", (), {"poll_interval_seconds": 0.0})()

    def run_once(self) -> int:
        self.runs += 1
        return 1


def test_arm_loop_stops_cleanly_on_event() -> None:
    worker = CountingWorker()
    stop = threading.Event()
    thread = threading.Thread(target=worker_main._arm_loop, args=(worker, stop, 0.0))
    thread.start()
    for _ in range(100):
        if worker.runs >= 2:
            break
        stop.wait(0.05)
    stop.set()
    thread.join(timeout=2.0)
    assert not thread.is_alive()
    assert worker.runs >= 2


def test_arm_loop_survives_iteration_exceptions(monkeypatch: pytest.MonkeyPatch) -> None:
    class FlakyWorker(CountingWorker):
        def run_once(self) -> int:
            if self.runs == 0:
                self.runs += 1
                raise RuntimeError("boom")
            return super().run_once()

    monkeypatch.setattr(worker_main, "logger", type("L", (), {"exception": lambda *a, **k: None})())
    worker = FlakyWorker()
    stop = threading.Event()
    thread = threading.Thread(target=worker_main._arm_loop, args=(worker, stop, 0.0))
    thread.start()
    for _ in range(100):
        if worker.runs >= 2:
            break
        stop.wait(0.05)
    stop.set()
    thread.join(timeout=2.0)
    assert not thread.is_alive()
    assert worker.runs >= 2
