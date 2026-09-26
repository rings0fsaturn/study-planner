"""Slice-4 sweep tests (#77 Phase A): grid, pick, and report are pure and offline.

No network, no spend: the recorded ``calls`` shape is synthetic here, so these
exercise the 3x3 grid and the train-pick/test-report rule directly.
"""

from __future__ import annotations

import scripts.jev_sweep_slice4 as sweep


def _call(split: str, *specs: tuple[float, bool], question: str = "q1") -> dict:
    return {
        "answer_id": f"a-{split}-{question}",
        "question_id": question,
        "criterion_source": "authored_met_topup",
        "split": split,
        "answer_excerpt": "an answer",
        "criteria": [f"criterion {index}" for index in range(len(specs))],
        "pairs": [
            {
                "index": index,
                "scored": True,
                "jev_score": score,
                "grade_met": met,
                "agree": (score >= 0.6) == met,
            }
            for index, (score, met) in enumerate(specs)
        ],
    }


def test_grid_has_nine_cells_per_split() -> None:
    calls = [_call("train", (0.9, True), (0.1, False)), _call("test", (0.9, True))]
    grid = sweep.summarize_grid(calls)
    assert set(grid) == {"train", "test"}
    assert len(grid["train"]) == 9
    assert len(grid["test"]) == 9
    assert {(cell["cutoff"], cell["margin"]) for cell in grid["train"]} == {
        (cutoff, margin) for cutoff in sweep.CUTOFFS for margin in sweep.MARGINS
    }


def test_grid_cell_agreement_tracks_the_cutoff() -> None:
    """A score of 0.55 is met at cutoff 0.5 and not met at 0.6/0.7."""
    calls = [_call("train", (0.55, True))]
    grid = {
        cell["cutoff"]: cell
        for cell in sweep.summarize_grid(calls)["train"]
        if cell["margin"] == 0.05
    }
    assert grid[0.5]["agreement"] == 1.0
    assert grid[0.7]["agreement"] == 0.0


def test_pick_prefers_train_and_reports_test_without_using_it() -> None:
    """A thick train met class: the pick is train's, and test is sampled at it."""
    calls = [
        _call("train", *[(0.9, True)] * 20),
        _call("test", (0.9, False), question="q2"),
    ]
    grid = sweep.summarize_grid(calls)
    picked = sweep.pick_thresholds(grid)
    assert picked["cutoff"] in sweep.CUTOFFS
    assert picked["margin"] in sweep.MARGINS
    assert picked["train_agreement"] == 1.0
    # The test split is sampled at the picked cell even when it disagrees.
    assert picked["test_agreement"] is not None
    assert picked["prior"] == {"cutoff": 0.6, "margin": 0.10}


def test_pick_prefers_the_narrowest_band_at_equal_agreement() -> None:
    calls = [_call("train", *[(0.95, True)] * 20)]
    picked = sweep.pick_thresholds(sweep.summarize_grid(calls))
    assert picked["margin"] == 0.05


def test_pick_falls_back_when_met_class_is_below_the_floor() -> None:
    """Below min_met the cells are not separable; the pick says so."""
    calls = [_call("train", (0.9, True))]
    grid = sweep.summarize_grid(calls)
    picked = sweep.pick_thresholds(grid, min_met=15)
    assert "thin met class" in picked["basis"]


def test_pick_cautions_when_test_contradicts_a_non_prior_cutoff() -> None:
    """The named #77 risk: a non-prior train cutoff the test split does not support.

    Train favors cutoff 0.7: the 0.62 scores are graded not-met, so Jev's
    "met" at a 0.6 cutoff disagrees while 0.7 agrees. Test says the opposite -
    it scores those rows met at 0.62, so only the 0.6 prior agrees. The picker
    keeps the train cutoff and records the caution rather than silently
    switching to the prior.
    """
    calls = [
        _call("train", *[(0.9, True)] * 20, *[(0.62, False)] * 3),
        _call("test", *[(0.9, True)] * 3, *[(0.62, True)] * 3, question="q2"),
    ]
    grid = sweep.summarize_grid(calls)
    picked = sweep.pick_thresholds(grid, min_met=15)
    assert picked["cutoff"] == 0.7
    assert picked["caution"] is not None
    assert "prior cutoff" in picked["caution"]
    assert picked["test_agreement"] < 1.0


def test_no_caution_when_the_train_pick_is_the_prior_cutoff() -> None:
    """A clean 0.9-met / 0.1-notmet split makes the 0.6 prior the train winner."""
    calls = [
        _call("train", *[(0.9, True)] * 20, *[(0.1, False)] * 10),
        _call("test", *[(0.9, True)] * 3, question="q2"),
        _call("test", *[(0.1, False)] * 3, question="q3"),
    ]
    picked = sweep.pick_thresholds(sweep.summarize_grid(calls), min_met=15)
    assert picked["cutoff"] == 0.6
    assert picked["caution"] is None


def test_report_lists_flagged_criteria_with_excerpts() -> None:
    calls = [
        _call("train", (0.95, False), (0.02, False)),
        _call("train", (0.02, False), (0.02, False)),
    ]
    grid = sweep.summarize_grid(calls)
    picked = sweep.pick_thresholds(grid)
    report = sweep.calibration_report(calls, grid, picked)
    assert report["n_flagged"] >= 1
    assert any(item["reason"] in ("disagreement", "review_band") for item in report["flagged"])
    assert report["flagged"][0]["answer_excerpt"] == "an answer"
    assert report["picked"]["cutoff"] == picked["cutoff"]


def test_report_md_renders_the_grid_and_pick() -> None:
    calls = [_call("train", (0.95, True)), _call("test", (0.95, True), question="q2")]
    grid = sweep.summarize_grid(calls)
    report = sweep.calibration_report(calls, grid, sweep.pick_thresholds(grid))
    rendered = sweep.render_report_md(report)
    assert "Slice-4 rubric calibration report" in rendered
    assert "| cutoff | margin |" in rendered
    assert "### train" in rendered
