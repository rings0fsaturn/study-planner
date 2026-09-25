"""Slice-1 sweep summarizer tests (#75 Phase A2): offline threshold grids.

Offline only: pure functions over recorded choice/confidence calls.
No network, no spend. Reruns the threshold grid offline with pure
route logic, so the grid costs zero spend.
"""

from __future__ import annotations

import pytest

from app.jev.measure_slice1 import summarize_citation, summarize_suitability


def _s_call(row_id, label, choice, confidence, *, scored=True):
    return {
        "row_id": row_id,
        "label": label,
        "choice": choice,
        "confidence": confidence,
        "scored": scored,
    }


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
