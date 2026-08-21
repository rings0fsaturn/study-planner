"""Unit tests for scripts/embedding_bakeoff.py sidecar tuning surface.

Covers the Phase 2 changes: the `--sidecar-batch` argument flows into the
`SidecarEmbedder` spec inside `run_model`, `--json-out` persists the sidecar
result dict, and `main()` no longer demands `GEMINI_API_KEY` when only the
sidecar model is selected (plan decision D-03 keeps Gemini out of the sweep).
"""

from __future__ import annotations

import json
import sys

import httpx

import scripts.embedding_bakeoff as module


def _fake_sidecar_factory(captured: dict) -> type:
    class FakeSidecar:
        def __init__(self, **kwargs) -> None:
            captured.update(kwargs)

        def load(self) -> float:
            return 0.0

        def embed(self, texts: list[str], is_query: bool) -> list[list[float]]:
            return [[0.1] * module.EMBEDDING_DIMENSIONS for _ in texts]

    return FakeSidecar


def _run_main(monkeypatch, tmp_path) -> tuple[list[str], dict]:
    requested_env: list[str] = []
    captured: dict = {}

    monkeypatch.setattr(module, "load_env_file", lambda path: None)
    monkeypatch.setattr(module, "require_env", lambda name: requested_env.append(name) or "x")
    monkeypatch.setattr(module, "load_questions", lambda path: [])
    monkeypatch.setattr(
        module,
        "fetch_chunks",
        lambda *a, **k: [{"id": "1", "ordinal": 0, "text": "hello world"}],
    )
    monkeypatch.setattr(module, "run_model", lambda *a, **k: {"model": "sidecar", "note": ""})
    monkeypatch.setattr(module, "render_report", lambda *a, **k: "")
    monkeypatch.setattr(module, "SidecarEmbedder", _fake_sidecar_factory(captured))

    monkeypatch.setattr(
        sys,
        "argv",
        [
            "embedding_bakeoff.py",
            "--material",
            "m1",
            "--models",
            "sidecar",
            "--sidecar-batch",
            "48",
            "--json-out",
            str(tmp_path / "out.json"),
        ],
    )
    module.main()
    return requested_env, captured


def test_main_sidecar_skips_gemini_key(monkeypatch, tmp_path) -> None:
    requested_env, _captured = _run_main(monkeypatch, tmp_path)
    assert "GEMINI_API_KEY" not in requested_env


def test_main_sidecar_writes_json_out(monkeypatch, tmp_path) -> None:
    _run_main(monkeypatch, tmp_path)
    out = tmp_path / "out.json"
    assert out.is_file()
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert payload["model"] == "sidecar"


def test_run_model_sidecar_picks_up_http_batch(monkeypatch) -> None:
    captured: dict = {}
    monkeypatch.setattr(module, "SidecarEmbedder", _fake_sidecar_factory(captured))
    monkeypatch.setattr(module, "rank_corpus", lambda c, q, k: list(range(min(k, len(c)))))
    monkeypatch.setattr(module, "_l2_normalize", lambda vector: vector)

    chunks = [{"id": str(i), "ordinal": i, "text": f"chunk text {i}"} for i in range(8)]
    questions = [{"question": "q1", "answerSnippet": "chunk text 1"}]
    client = httpx.Client()
    result = module.run_model(
        "sidecar", chunks, questions, client, "", sidecar_batch=48
    )
    assert captured.get("http_batch") == 48
    assert result["model"] == "sidecar"
    assert result["embedded"] is True