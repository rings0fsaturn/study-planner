from __future__ import annotations

import json
import math

from research_comparison.baselines.detection import detect_csd, detect_ewma
from research_comparison.generator.generate import DEFAULT_ARCHETYPE_MIX, generate_dataset
from research_comparison.metrics.detection import (
    roc_points,
    score_detections,
    winner_by_shift_type,
)
from research_comparison.runners.detection import (
    detect_cusum,
    latency_false_alarm_frontier,
    run_detection_for_learner,
    run_detection_track,
    tune_cusum_params,
)


def _sessions(ratios: list[float]) -> list[dict]:
    return [
        {
            "date": f"2026-02-{index + 1:02d}",
            "source": "active",
            "plannedMinutes": 50.0,
            "activeMinutes": 50.0 * ratio,
            "duration": 50.0 * ratio,
            "materialRole": "foundation",
            "startedAt": f"2026-02-{index + 1:02d}T08:00:00Z",
            "sessionId": f"detection-{index}",
        }
        for index, ratio in enumerate(ratios)
    ]


def test_cusum_detects_planted_step_with_finite_latency():
    ratios = [1.0] * 16 + [1.34] * 16
    breakpoints = detect_cusum(ratios, reference_mean=1.0, std=0.04)
    score = score_detections(
        breakpoints,
        shifts=[{"onset_index": 16, "type": "step", "pre_mean": 1.0, "post_mean": 1.34}],
        n_observations=len(ratios),
    )

    assert score["by_type"]["step"]["n_detected"] == 1
    assert math.isfinite(score["by_type"]["step"]["mean_latency"])
    assert score["by_type"]["step"]["mean_latency"] >= 0


def test_drift_detection_is_recorded_under_drift_type():
    ratios = [1.0] * 8 + [1.0 + (index * 0.018) for index in range(28)]
    ewma_breakpoints = detect_ewma(ratios, reference_mean=1.0, std=0.04, threshold=2.0)
    csd_breakpoints = detect_csd(ratios, window=6, threshold=0.010)
    detected = sorted(set(ewma_breakpoints + csd_breakpoints))

    score = score_detections(
        detected,
        shifts=[{"onset_index": 8, "type": "drift", "pre_mean": 1.0, "post_mean": 1.49}],
        n_observations=len(ratios),
    )

    assert detected
    assert score["by_type"]["drift"]["n_detected"] == 1
    assert score["by_type"]["drift"]["mean_latency"] >= 0


def test_runner_reports_latency_separately_for_step_and_drift():
    ratios = [1.0] * 10 + [1.28] * 12 + [1.28 + index * 0.018 for index in range(18)]
    learner = {
        "learner_id": "learner-detection-fixture",
        "band": "medium",
        "archetype": "fixture",
        "seed": 7,
        "sessions": _sessions(ratios),
    }
    truth = {
        "regime_schedule": [
            {"onset_index": 10, "type": "step", "pre_mean": 1.0, "post_mean": 1.28},
            {"onset_index": 22, "type": "drift", "pre_mean": 1.28, "post_mean": 1.60},
        ]
    }

    rows, _roc = run_detection_for_learner(learner, truth)
    seen_types = {(row["candidate"], row["shift_type"]) for row in rows}

    assert ("cusum", "step") in seen_types
    assert ("ewma_control_chart", "drift") in seen_types
    assert all(row["shift_type"] in {"step", "drift"} for row in rows)


def test_a4_detection_candidates_and_upper_bound_shape_on_fixture():
    ratios = [1.0] * 12 + [1.30] * 12 + [1.30 + index * 0.014 for index in range(20)]
    learner = {
        "learner_id": "learner-detection-a4",
        "band": "medium",
        "archetype": "fixture",
        "seed": 9,
        "sessions": _sessions(ratios),
    }
    truth = {
        "regime_schedule": [
            {"onset_index": 12, "type": "step", "pre_mean": 1.0, "post_mean": 1.30},
            {"onset_index": 24, "type": "drift", "pre_mean": 1.30, "post_mean": 1.58},
        ]
    }

    rows, frontier_rows = run_detection_for_learner(learner, truth)
    seen = {row["candidate"] for row in rows}

    assert {"bocpd", "page_hinkley", "adwin", "ruptures_pelt_binseg"} <= seen
    upper = [row for row in rows if row["candidate"] == "ruptures_pelt_binseg"]
    assert upper and all(row["candidate_kind"] == "upper_bound" for row in upper)
    assert all("comparison_score" in row for row in rows)
    assert frontier_rows


def test_a4_pareto_frontier_is_monotone_and_upper_bounds_do_not_win():
    rows = [
        {
            "frontier_kind": "latency_false_alarm",
            "shift_type": "step",
            "family": "cusum_h",
            "threshold": 3.0,
            "mean_latency": 8.0,
            "missed": 0,
            "false_alarm_rate": 0.01,
            "true_detection_rate": 0.8,
        },
        {
            "frontier_kind": "latency_false_alarm",
            "shift_type": "step",
            "family": "cusum_h",
            "threshold": 2.0,
            "mean_latency": 4.0,
            "missed": 0,
            "false_alarm_rate": 0.05,
            "true_detection_rate": 1.0,
        },
    ]

    frontier = latency_false_alarm_frontier(rows)["step"]

    assert frontier == sorted(frontier, key=lambda point: point["false_alarm_rate"])
    assert all(
        left["mean_latency"] >= right["mean_latency"]
        for left, right in zip(frontier, frontier[1:], strict=False)
    )

    winners = winner_by_shift_type(
        [
            {
                "candidate": "ruptures_pelt_binseg",
                "candidate_kind": "upper_bound",
                "shift_type": "step",
                "mean_latency": 0.0,
                "missed": 0.0,
                "false_alarm_rate": 0.0,
            },
            {
                "candidate": "cusum",
                "candidate_kind": "deployable",
                "shift_type": "step",
                "mean_latency": 6.0,
                "missed": 0.0,
                "false_alarm_rate": 0.02,
            },
        ]
    )
    assert winners["step"]["winner"] == "cusum"


def test_a4_cusum_tuning_uses_train_archetype_only():
    ratios = [1.0] * 12 + [1.28] * 12
    learner = {
        "learner_id": "train-learner",
        "band": "medium",
        "archetype": "steady",
        "seed": 1,
        "sessions": _sessions(ratios),
    }
    sidecars = {
        "train-learner": {
            "regime_schedule": [
                {"onset_index": 12, "type": "step", "pre_mean": 1.0, "post_mean": 1.28}
            ]
        }
    }

    tuning = tune_cusum_params([learner], sidecars, ["steady"])

    assert tuning["method"] == "grid_search_train_archetypes_only"
    assert tuning["train_archetypes"] == ["steady"]
    assert set(tuning["selected"]) == {"step_k", "step_h", "drift_k", "drift_h"}


def test_roc_points_are_bounded_and_monotone_by_threshold_order():
    ratios = [1.0] * 12 + [1.30] * 12 + [1.30 + index * 0.014 for index in range(20)]
    shifts = [
        {"onset_index": 12, "type": "step", "pre_mean": 1.0, "post_mean": 1.30},
        {"onset_index": 24, "type": "drift", "pre_mean": 1.30, "post_mean": 1.58},
    ]

    points = roc_points(
        ratios,
        shifts,
        detector=lambda series, threshold: detect_ewma(
            series,
            reference_mean=1.0,
            std=0.04,
            threshold=threshold,
        ),
        thresholds=[3.0, 2.4, 1.8, 1.2],
    )

    assert points == sorted(points, key=lambda point: point["threshold"], reverse=True)
    assert all(0.0 <= point["true_detection_rate"] <= 1.0 for point in points)
    assert all(0.0 <= point["false_alarm_rate"] <= 1.0 for point in points)


def test_a3_detection_result_carries_ci_correction_and_heldout_split(tmp_path):
    dataset_id = generate_dataset(
        archetype_mix=DEFAULT_ARCHETYPE_MIX,
        bands=["medium"],
        seeds=[0],
        out_dir=str(tmp_path / "datasets"),
    )
    result_path = run_detection_track(
        dataset_dir=str(tmp_path / "datasets" / dataset_id),
        out_dir=str(tmp_path / "results" / "detection"),
    )

    payload = json.loads(result_path.read_text())
    split = payload["_provenance"]["archetype_split"]
    first_cell = next(iter(payload["paired_vs_incumbent"].values()))
    first_result = next(iter(first_cell.values()))

    assert set(split["train"]).isdisjoint(split["held_out"])
    assert payload["scored_split"] == "held_out"
    assert {"delta_ci_low", "delta_ci_high"} <= set(first_result)
    assert payload["mc_correction"]["comparisons"]
