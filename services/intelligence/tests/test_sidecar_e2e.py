"""Unit tests for scripts/sidecar_e2e.py helpers (no live services)."""

from __future__ import annotations

import json

import httpx
import pytest

from scripts.sidecar_e2e import (
    run_id,
    save_evidence,
    snapshot_health,
)


def test_run_id_is_utc_timestamp() -> None:
    value = run_id()
    parts = value.split("-")
    assert len(parts) == 2
    assert len(parts[0]) == 8 and len(parts[1]) == 6


def test_snapshot_health_returns_payload(tmp_path) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/health"
        return httpx.Response(
            200,
            json={
                "status": "ok",
                "model": "Qwen/Qwen3-Embedding-0.6B",
                "dimensions": 768,
                "cuda_available": True,
                "device_name": "AMD Radeon RX 9070 XT",
                "loaded": True,
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    health = snapshot_health(client)
    assert health["status"] == "ok"
    assert health["dimensions"] == 768
    assert health["cuda_available"] is True


def test_snapshot_health_fails_on_non_200(tmp_path) -> None:
    client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(503, json={})))

    with pytest.raises(SystemExit):
        snapshot_health(client)


def test_save_evidence_writes_json_and_markdown(tmp_path) -> None:
    import scripts.sidecar_e2e as module
    from scripts.sidecar_e2e import EVIDENCE_DIR as _REAL

    module.EVIDENCE_DIR = tmp_path  # type: ignore[attr-defined]
    try:
        json_path, md_path = save_evidence(
            "20260817-120000",
            {"health": {"model": "m", "dimensions": 768}, "preflight": {"ok": True}},
        )
        assert json_path.exists() and md_path.exists()
        assert json.loads(json_path.read_text())["health"]["dimensions"] == 768
        assert "## preflight" in md_path.read_text()
    finally:
        module.EVIDENCE_DIR = _REAL  # type: ignore[attr-defined]


def test_cmd_sweep_parses_configs_and_aggregates(monkeypatch) -> None:
    import argparse

    import scripts.sidecar_e2e as module

    monkeypatch.setenv("SUPABASE_URL", "http://localhost")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")

    calls = []
    monkeypatch.setattr(module, "_recreate_embedder", lambda mb: calls.append(("recreate", mb)))
    monkeypatch.setattr(module, "_embedder_health_loaded", lambda c: {"loaded": True})
    monkeypatch.setattr(
        module, "_run_bakeoff", lambda a, hb, out: {"chunks_per_min": 1000 + hb, "mrr": 0.7}
    )
    monkeypatch.setattr(module, "save_evidence", lambda run, m: (None, None))

    ns = argparse.Namespace(
        http_batch="16,32", model_batch="64,128", material="m", questions="q.json", warm_runs=1
    )
    assert module.cmd_sweep(ns) == 0
    assert ("recreate", 64) in calls and ("recreate", 128) in calls