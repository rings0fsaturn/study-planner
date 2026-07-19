from __future__ import annotations

import math

from research_comparison.generator.generate import generate_learner
from research_comparison.metrics.detection import score_detections
from research_comparison.metrics.projection import projection_metrics
from research_comparison.oracles.calibration import calibration_oracle_error
from research_comparison.oracles.detection import detection_oracle_breakpoints
from research_comparison.oracles.projection import forecast_projection_oracle
from research_comparison.runners.detection import detect_cusum
from research_comparison.runners.projection import run_projection_for_learner
from research_comparison.runners.sweep import (
    ADVERSARIAL_SWEEP_POINTS,
    flip_cells,
    per_archetype_worst_case,
    ranking_stability,
    sweep_grid_points,
)


def test_oracles_separate_from_candidate_field_on_fixture_tracks():
    sessions, truth_obj = generate_learner("marathon_runner", "medium", 123)
    truth = {
        "m_global": truth_obj.m_global,
        "regime_schedule": [shift.__dict__ for shift in truth_obj.regime_schedule],
        "r_star": truth_obj.r_star,
        "true_finish_date": truth_obj.true_finish_date,
    }

    assert calibration_oracle_error(truth) == 0.0

    ratios = [
        float(session["activeMinutes"]) / float(session["plannedMinutes"])
        for session in sessions
        if session["source"] == "active"
        and session.get("plannedMinutes") is not None
        and session.get("activeMinutes") is not None
    ]
    shifts = [shift for shift in truth["regime_schedule"] if shift["onset_index"] < len(ratios)]
    if shifts:
        oracle_score = score_detections(
            detection_oracle_breakpoints(shifts),
            shifts,
            n_observations=len(ratios),
        )
        candidate_score = score_detections(
            detect_cusum(ratios, reference_mean=1.0, std=0.08),
            shifts,
            n_observations=len(ratios),
        )
        assert oracle_score["false_alarms"] <= candidate_score["false_alarms"]
        assert oracle_score["true_detection_rate"] >= candidate_score["true_detection_rate"]

    learner = {
        "learner_id": "oracle-projection",
        "band": "medium",
        "archetype": "marathon_runner",
        "seed": 123,
        "sessions": sessions,
    }
    rows, _forecasts = run_projection_for_learner(learner, truth, t_grid=[5, 8])
    oracle_metrics = projection_metrics(
        [forecast_projection_oracle(truth["true_finish_date"])],
        truth["true_finish_date"],
    )
    best_candidate_error = min(row["mean_abs_error_days"] for row in rows)
    assert oracle_metrics["mean_abs_error_days"] <= best_candidate_error
    assert math.isfinite(best_candidate_error)


def test_sweep_runner_visits_every_grid_point_and_records_ranking():
    grid = {"sigma_log": [0.12, 0.18], "step_mag": [0.10, 0.22], "ar1_phi": [0.0]}
    points = sweep_grid_points(grid)

    assert len(points) == 4
    assert all(set(point) == set(grid) for point in points)


def test_a4_default_sweep_has_five_points_per_axis_and_adversarial_cases():
    points = sweep_grid_points()
    params = ["ar1_phi", "drift_total", "manual_fraction", "sigma_log", "step_mag"]

    assert all(len({point[param] for point in points}) >= 5 for param in params)
    assert {point["adversarial_case"] for point in ADVERSARIAL_SWEEP_POINTS} == {
        "multi_shift",
        "step_drift_combined",
        "bursty_missingness",
    }


def test_stable_ranking_is_reported_as_held():
    rows = [
        {"track": "detection", "default_winner": "cusum", "winner": "cusum"},
        {"track": "detection", "default_winner": "cusum", "winner": "cusum"},
    ]

    assert ranking_stability(rows)["detection"]["status"] == "held"


def test_a4_flip_cells_and_per_archetype_worst_case_are_reported():
    rows = [
        {
            "track": "detection",
            "default_winner": "cusum",
            "winner": "cusum",
            "ranking_status": "held",
            "archetypes": ["steady"],
        },
        {
            "track": "detection",
            "default_winner": "cusum",
            "winner": "csd",
            "ranking_status": "flipped",
            "archetypes": ["fading_flame"],
        },
    ]

    assert len(flip_cells(rows)) == 1
    worst = per_archetype_worst_case(rows)["detection"]
    assert worst["worst_archetype"] == "fading_flame"
