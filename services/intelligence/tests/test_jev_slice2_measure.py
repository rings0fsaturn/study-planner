"""Slice-2 sweep summarizer tests (#76 Phase A): offline threshold grids.

Offline only: pure functions over recorded Noul calls.
No network, no spend. Reruns the PASSAGE_THRESHOLDS grid offline with pure
route logic, so the grid costs zero spend.
"""

from __future__ import annotations

import pytest

from app.jev.measure_slice2 import summarize_passage


def _p_call(row_id, label, nouls, *, scored=True):
    return {
        "row_id": row_id,
        "label": label,
        "nouls": dict(nouls),
        "scored": scored,
    }


def _nouls(relevant, evidence, contradicts=0.03, injection=0.05):
    return {
        "is_relevant": relevant,
        "contains_answer_evidence": evidence,
        "contradicts_query_premise": contradicts,
        "contains_prompt_injection": injection,
    }


def _thresholds(**over):
    base = {
        "injection_max": 0.70,
        "contradicts_min": 0.70,
        "relevant_min": 0.45,
        "evidence_min": 0.55,
    }
    base.update(over)
    return base


def test_passage_counts_include_exclude_conflict() -> None:
    calls = [
        _p_call("r1", "include", _nouls(0.99, 0.98)),
        _p_call("r2", "exclude", _nouls(0.10, 0.10)),
        _p_call("r3", "conflicting_evidence", _nouls(0.49, 0.51, contradicts=0.92)),
    ]
    report = summarize_passage(calls, thresholds=_thresholds())
    assert report["n"] == 3
    assert report["n_scored"] == 3
    assert report["include"] == 1
    assert report["exclude"] == 1
    assert report["conflicting"] == 1


def test_passage_starvation_and_floor_rates() -> None:
    calls = [
        _p_call("w1-p0", "exclude", _nouls(0.10, 0.10)),
        _p_call("w1-p1", "exclude", _nouls(0.20, 0.40)),
        _p_call("w2-p0", "include", _nouls(0.99, 0.98)),
        _p_call("w2-p1", "exclude", _nouls(0.10, 0.10)),
    ]
    windows = {"w1": ["w1-p0", "w1-p1"], "w2": ["w2-p0", "w2-p1"]}
    report = summarize_passage(calls, thresholds=_thresholds(), windows=windows)
    assert report["starvation_rate"] == pytest.approx(0.5)
    assert report["floor_rate"] == pytest.approx(0.5)
    assert report["include_precision"] == pytest.approx(1.0)
    assert report["include_recall"] == pytest.approx(1.0)


def test_passage_malformed_and_latency() -> None:
    calls = [
        _p_call("r1", "include", _nouls(0.99, 0.98)),
        _p_call("r2", "exclude", {}, scored=False),
    ]
    report = summarize_passage(calls, thresholds=_thresholds(), latencies_ms=[100.0, 200.0, 300.0])
    assert report["n"] == 2
    assert report["n_scored"] == 1
    assert report["malformed_rate"] == pytest.approx(0.5)
    assert report["latency_p50_ms"] == pytest.approx(200.0)
    assert report["latency_p95_ms"] == pytest.approx(300.0, abs=20.0)
