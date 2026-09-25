"""Slice-1 sweep summarizer tests (#75 Phase A2): offline threshold grids.

Offline only: pure functions over recorded choice/confidence calls.
No network, no spend. Reruns the threshold grid offline with pure
route logic, so the grid costs zero spend.
"""

from __future__ import annotations

import pytest

from app.jev.measure_slice1 import summarize_citation, summarize_suitability
from scripts.jev_sweep_slice1 import load_rows, sweep_rows
from tests.test_generation_jev_slice1 import ScriptJev


def _s_call(row_id, label, choice, confidence, *, scored=True):
    return {
        "row_id": row_id,
        "label": label,
        "choice": choice,
        "confidence": confidence,
        "scored": scored,
    }


def test_suitability_variant_kwarg_defaults_to_current_wording() -> None:
    from app.jev.questions import citation_questions, suitability_questions

    assert suitability_questions() == suitability_questions(variant="v1")
    assert citation_questions() == citation_questions(variant="v1")


def test_suitability_counts_per_threshold() -> None:
    calls = [
        _s_call("r1", "derivable", "derivable", 0.95),
        _s_call("r2", "not_derivable", "not_derivable", 0.95),
        _s_call("r3", "derivable", "derivable", 0.5),
        _s_call("r4", "not_derivable", "not_derivable", 0.05),
    ]
    report = summarize_suitability(calls, approve_at=0.9, block_at=0.1)
    assert report["n"] == 4
    assert report["n_scored"] == 4
    assert report["approve"] == 1
    assert report["block"] == 2
    assert report["review"] == 1


def test_suitability_confident_reject_precision_recall() -> None:
    calls = [
        _s_call("r1", "not_derivable", "not_derivable", 0.95),
        _s_call("r2", "not_derivable", "not_derivable", 0.05),
        _s_call("r3", "derivable", "not_derivable", 0.95),
        _s_call("r4", "derivable", "derivable", 0.5),
    ]
    report = summarize_suitability(calls, approve_at=0.9, block_at=0.1)
    # predicted reject: r1, r2, r3 (3); true reject among them: r1, r2
    assert report["reject_precision"] == pytest.approx(2 / 3)
    # true reject rows: r1, r2 (2); both predicted
    assert report["reject_recall"] == pytest.approx(1.0)


def test_suitability_jitter_flip_malformed_latency() -> None:
    calls = [
        _s_call("r1", "derivable", "derivable", 0.95),
        _s_call("r1", "derivable", "derivable", 0.87),
        _s_call("r2", "derivable", "derivable", 0.95),
        _s_call("r2", "derivable", "not_derivable", 0.95),
        _s_call("r3", "derivable", "derivable", 0.5, scored=False),
    ]
    report = summarize_suitability(
        calls, approve_at=0.9, block_at=0.1, latencies_ms=[100.0, 200.0, 300.0]
    )
    assert report["n"] == 5
    assert report["n_scored"] == 4
    assert report["malformed_rate"] == pytest.approx(0.2)
    # r1 spread 0.08, r2 spread 0.0 -> mean 0.04, max 0.08
    assert report["jitter_mean"] == pytest.approx(0.04)
    assert report["jitter_max"] == pytest.approx(0.08)
    # r1 derivable vs review, r2 derivable vs not_derivable -> 2/2
    assert report["flip_rate"] == pytest.approx(1.0)
    assert report["latency_p50_ms"] == pytest.approx(200.0)
    assert report["latency_p95_ms"] == pytest.approx(300.0, abs=20.0)


def test_citation_stands_grid_and_precision() -> None:
    calls = [
        _s_call("c1", "contradicted", "contradicts", 0.95),
        _s_call("c2", "unsupported", "says_nothing", 0.9),
        _s_call("c3", "verified", "contradicts", 0.95),
        _s_call("c4", "verified", "supports", 0.5),
    ]
    report = summarize_citation(calls, stands_at=0.8)
    assert report["n_scored"] == 4
    assert report["stands_true"] == 3
    assert report["stands_false"] == 1
    # predicted confident reject: c1, c2, c3; true reject among them: c1, c2
    assert report["reject_precision"] == pytest.approx(2 / 3)
    # true reject rows: c1, c2; both predicted
    assert report["reject_recall"] == pytest.approx(1.0)


def test_citation_low_confidence_never_confident_reject() -> None:
    calls = [_s_call("c1", "contradicted", "contradicts", 0.5)]
    report = summarize_citation(calls, stands_at=0.8)
    assert report["stands_true"] == 0
    assert report["reject_precision"] is None
    assert report["reject_recall"] == pytest.approx(0.0)


def _sweep_jev(script):
    """ScriptJev answers need choice/confidence/type shape like worker tests."""
    shaped = []
    for kind, payload in script:
        if kind == "error":
            shaped.append((kind, payload))
            continue
        shaped.append(
            (
                kind,
                {
                    key: {
                        "choice": value["choice"],
                        "confidence": value["confidence"],
                        "type": "choice",
                    }
                    for key, value in payload.items()
                },
            )
        )
    return ScriptJev(shaped)


def _s_row(row_id, *, split="sweep"):
    return {
        "row_id": row_id,
        "split": split,
        "kind": "suitability",
        "family": "coding",
        "label": "derivable",
        "chunk_text": "Write a function parse_log(lines) that yields (level, message).",
    }


def _c_row(row_id, *, split="sweep"):
    return {
        "row_id": row_id,
        "split": split,
        "kind": "citation",
        "label": "verified",
        "claim": "The default access token expiry is 1 hour.",
        "section": "The default and recommended access token expiry is 1 hour.",
    }


def test_sweep_rows_spends_one_call_per_row_per_repeat() -> None:
    jev = _sweep_jev(
        [
            ("answer", {"suitability": {"choice": "derivable", "confidence": 0.95}}),
            ("answer", {"suitability": {"choice": "derivable", "confidence": 0.87}}),
            ("answer", {"relation": {"choice": "supports", "confidence": 0.93}}),
            ("answer", {"relation": {"choice": "supports", "confidence": 0.91}}),
        ]
    )
    outcome = sweep_rows(jev, [_s_row("s1"), _c_row("c1")], repeats=2)
    assert outcome["n_calls"] == 4
    assert len(jev.calls) == 4
    assert "chunk_text" in jev.calls[0]["state"]
    assert set(jev.calls[2]["state"]) == {"claim", "section"}
    assert len(outcome["suitability_grid"]) == 9
    assert len(outcome["citation_grid"]) == 3
    assert outcome["suitability_calls"][0]["variant"] == "v1"
    assert outcome["spent_input_tokens"] == 40
    assert outcome["errors"] == []


def test_sweep_rows_fail_open_marks_call_unscored() -> None:
    from app.jev.client import JevError

    jev = _sweep_jev([("error", JevError("timeout", "deadline", True, "r1"))])
    outcome = sweep_rows(jev, [_s_row("s1")], repeats=1)
    assert outcome["n_calls"] == 0
    assert outcome["errors"] == ["timeout"]
    assert outcome["suitability_calls"][0]["scored"] is False


def test_load_rows_filters_split(tmp_path) -> None:
    import json

    payload = {"rows": [_s_row("s1", split="sweep"), _s_row("s2", split="final")]}
    path = tmp_path / "rows.json"
    path.write_text(json.dumps(payload))
    assert [r["row_id"] for r in load_rows(str(path), "sweep")] == ["s1"]
    assert [r["row_id"] for r in load_rows(str(path), "final")] == ["s2"]
    assert len(load_rows(str(path), "all")) == 2
