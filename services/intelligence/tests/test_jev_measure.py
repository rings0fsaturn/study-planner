"""Rubric measurement summarizer tests (#74): agreement, bands, latency, spend.

Offline only: pure function over recorded pairs, no network, no spend.
Gate 3 needs distributions (not point estimates) and gate 4 needs the
train/test split declared by the caller - this module only summarizes the
pairs it is given, one split at a time.
"""

from __future__ import annotations

import pytest

from app.jev.measure import summarize_measurement
from scripts.jev_measure import load_rows, measure_rows
from tests.test_generation_jev_slice1 import ScriptJev


def _pair(score, met, *, scored=True):
    return {"jev_score": score, "grade_met": met, "scored": scored}


def test_agreement_overall_and_per_class() -> None:
    pairs = [
        _pair(0.9, True),
        _pair(0.8, True),
        _pair(0.2, False),
        _pair(0.7, False),  # the one disagreement
    ]
    report = summarize_measurement(pairs, cutoff=0.6)
    assert report["n"] == 4
    assert report["n_scored"] == 4
    assert report["agreement"] == pytest.approx(0.75)
    assert report["agree_met"] == pytest.approx(1.0)
    assert report["agree_notmet"] == pytest.approx(0.5)


def test_unscored_pairs_count_toward_malformed_not_agreement() -> None:
    pairs = [_pair(0.9, True), _pair(None, False, scored=False)]
    report = summarize_measurement(pairs, cutoff=0.6)
    assert report["n"] == 2
    assert report["n_scored"] == 1
    assert report["malformed_rate"] == pytest.approx(0.5)
    assert report["agreement"] == pytest.approx(1.0)


def test_review_band_and_latency_spend_passthrough() -> None:
    pairs = [_pair(0.62, True), _pair(0.95, True), _pair(0.1, False)]
    report = summarize_measurement(
        pairs, cutoff=0.6, margin=0.1, latencies_ms=[120.0, 200.0, 340.0]
    )
    assert report["n_review"] == 1
    assert report["latency_p50_ms"] == pytest.approx(200.0)
    assert report["latency_p95_ms"] == pytest.approx(340.0, abs=20.0)


def _row(answer_id, criteria, breakdown, *, split="train"):
    return {
        "answer_id": answer_id,
        "question_id": "q1",
        "answer": "learner text",
        "criteria": criteria,
        "breakdown": breakdown,
        "split": split,
    }


def test_measure_rows_batches_criteria_into_one_decide() -> None:
    rows = [
        _row(
            "a1",
            ["c0", "c1"],
            [
                {"criterion": "c0", "score": 0.9, "met": True},
                {"criterion": "c1", "score": 0.2, "met": False},
            ],
        )
    ]
    jev = ScriptJev(
        [
            (
                "answer",
                {
                    "criterion_0": {"type": "score", "score": 1.8},
                    "criterion_1": {"type": "score", "score": 0.2},
                },
            )
        ]
    )
    result = measure_rows(jev, rows, cutoff=0.6)
    assert len(jev.calls) == 1
    assert set(jev.calls[0]["questions"]) == {"criterion_0", "criterion_1"}
    assert jev.calls[0]["state"]["learner_answer"] == "learner text"
    assert result["report"]["agreement"] == pytest.approx(1.0)
    assert result["disagreements"] == []
    assert result["spent_input_tokens"] == 10


def test_measure_rows_fail_open_marks_pairs_unscored() -> None:
    from app.jev.client import JevError

    rows = [_row("a1", ["c0"], [{"criterion": "c0", "score": 0.9, "met": True}])]
    jev = ScriptJev([("error", JevError("timeout", "deadline", True, "r1"))])
    result = measure_rows(jev, rows, cutoff=0.6)
    assert result["report"]["n_scored"] == 0
    assert result["report"]["malformed_rate"] == pytest.approx(1.0)
    assert result["errors"] == ["timeout"]


def test_load_rows_filters_split(tmp_path) -> None:
    import json

    payload = {
        "split": "declared",
        "rows": [
            _row("a1", ["c0"], [], split="train"),
            _row("a2", ["c0"], [], split="test"),
        ],
    }
    path = tmp_path / "rows.json"
    path.write_text(json.dumps(payload))
    assert [r["answer_id"] for r in load_rows(str(path), "train")] == ["a1"]
    assert [r["answer_id"] for r in load_rows(str(path), "test")] == ["a2"]
    assert len(load_rows(str(path), "all")) == 2
