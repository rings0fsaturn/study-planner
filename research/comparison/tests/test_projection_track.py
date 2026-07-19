from __future__ import annotations

import json
import statistics
from datetime import date, timedelta

from py_progress import gp_regression
from research_comparison.baselines.projection import (
    conformal_abs_residual_quantile,
    forecast_analytic_required_rate,
    forecast_gp_finish,
    forecast_gp_plus_analytic_finish,
    forecast_kalman_finish,
    forecast_linear_finish,
)
from research_comparison.generator.generate import DEFAULT_ARCHETYPE_MIX, generate_dataset
from research_comparison.metrics.projection import projection_metrics
from research_comparison.runners.projection import (
    projection_candidates,
    run_projection_for_learner,
    run_projection_track,
)


def _sessions(minutes: list[float], start: date = date(2026, 3, 1)) -> list[dict]:
    return [
        {
            "date": (start + timedelta(days=index)).isoformat(),
            "source": "active",
            "plannedMinutes": 50.0,
            "activeMinutes": minutes_value,
            "duration": minutes_value,
            "materialRole": "foundation",
            "startedAt": f"{(start + timedelta(days=index)).isoformat()}T08:00:00Z",
            "sessionId": f"projection-{index}",
        }
        for index, minutes_value in enumerate(minutes)
    ]


def test_gp_forecast_contains_true_finish_date_on_low_noise_learner():
    sessions = _sessions([50.0] * 10)
    forecast = forecast_gp_finish(
        sessions[:5],
        total_minutes=500.0,
        start_date="2026-03-01",
        horizon_end_date="2026-03-18",
    )
    metrics = projection_metrics([forecast], true_finish_date="2026-03-10")

    assert metrics["coverage"] == 1.0
    assert metrics["mean_abs_error_days"] <= 2.0
    assert metrics["mean_sharpness_days"] > 0.0


def test_linear_baseline_interval_is_discriminating_not_fixed_to_nominal():
    sessions = _sessions([35.0, 45.0, 50.0, 65.0, 85.0, 110.0])
    forecasts = [
        forecast_linear_finish(sessions[:t], total_minutes=390.0)
        for t in [3, 4, 5, 6]
    ]
    metrics = projection_metrics(forecasts, true_finish_date="2026-03-06")

    assert 0.0 <= metrics["coverage"] <= 1.0
    assert abs(metrics["coverage"] - 0.95) > 0.01


def test_linear_forecast_caps_pathological_far_future_dates():
    sessions = _sessions([0.001] * 5)

    forecast = forecast_linear_finish(sessions, total_minutes=4501.986406618768)

    assert forecast["predicted_finish_date"] >= sessions[-1]["date"]
    assert forecast["interval_low"] <= forecast["predicted_finish_date"]
    assert forecast["interval_high"] >= forecast["predicted_finish_date"]


def test_analytic_required_rate_forecast_uses_actual_minutes_currency():
    sessions = _sessions([50.0, 50.0, 50.0, 50.0])

    forecast = forecast_analytic_required_rate(
        sessions,
        total_minutes=500.0,
        start_date="2026-03-01",
        horizon_end_date="2026-03-31",
    )

    assert forecast["candidate"] == "analytic_required_rate"
    assert forecast["predicted_finish_date"] == "2026-03-10"
    assert forecast["interval_low"] <= forecast["predicted_finish_date"]
    assert forecast["interval_high"] >= forecast["predicted_finish_date"]
    assert forecast["sharpness_days"] >= 1.0


def test_gp_plus_analytic_uses_analytic_for_cold_start():
    sessions = _sessions([50.0, 50.0, 50.0, 50.0])

    analytic = forecast_analytic_required_rate(
        sessions,
        total_minutes=500.0,
        start_date="2026-03-01",
        horizon_end_date="2026-03-31",
    )
    composite = forecast_gp_plus_analytic_finish(
        sessions,
        total_minutes=500.0,
        start_date="2026-03-01",
        horizon_end_date="2026-03-31",
    )

    assert composite["candidate"] == "gp_plus_analytic"
    assert composite["predicted_finish_date"] == analytic["predicted_finish_date"]
    assert composite["interval_low"] == analytic["interval_low"]
    assert composite["interval_high"] == analytic["interval_high"]


def test_gp_plus_analytic_rescues_gp_non_crossing_horizon():
    sessions = _sessions([1.0, 1.0, 1.0, 1.0, 1.0])

    composite = forecast_gp_plus_analytic_finish(
        sessions,
        total_minutes=1000.0,
        start_date="2026-03-01",
        horizon_end_date="2026-03-07",
    )
    analytic = forecast_analytic_required_rate(
        sessions,
        total_minutes=1000.0,
        start_date="2026-03-01",
        horizon_end_date="2026-03-07",
    )

    assert composite["candidate"] == "gp_plus_analytic"
    assert composite["predicted_finish_date"] == analytic["predicted_finish_date"]
    assert composite["predicted_finish_date"] > "2026-03-07"


def test_kalman_forecast_handles_negative_early_trend_without_date_overflow():
    sessions = _sessions([121.522702, 44.232158, 13.082674, 41.55206, 17.799342])

    forecast = forecast_kalman_finish(sessions, total_minutes=4501.986406618768)

    assert forecast["predicted_finish_date"] >= sessions[-1]["date"]
    assert forecast["interval_low"] <= forecast["predicted_finish_date"]
    assert forecast["interval_high"] >= forecast["predicted_finish_date"]


def test_projection_runner_reports_coverage_sharpness_and_error():
    sessions = _sessions([50.0] * 12)
    learner = {
        "learner_id": "projection-fixture",
        "band": "small",
        "archetype": "steady",
        "seed": 9,
        "sessions": sessions,
    }
    truth = {
        "true_finish_date": "2026-03-10",
        "r_star": [1.0] * len(sessions),
    }

    rows, forecasts = run_projection_for_learner(learner, truth, t_grid=[5, 8])

    assert rows
    assert forecasts
    assert all(0.0 <= row["coverage"] <= 1.0 for row in rows)
    assert all(row["mean_sharpness_days"] > 0.0 for row in rows)
    assert all(row["mean_abs_error_days"] >= 0.0 for row in rows)


def test_a1_projection_candidates_are_registered_without_removing_gp_incumbent():
    names = {candidate.name for candidate in projection_candidates()}

    assert {
        "gp_ard",
        "analytic_required_rate",
        "gp_plus_analytic",
        "conformal",
        "gp_hetero_t",
    }.issubset(names)


def test_conformal_quantile_math_matches_finite_sample_rank():
    assert conformal_abs_residual_quantile([1.0, 2.0, 3.0, 4.0], alpha=0.25) == 4.0
    assert conformal_abs_residual_quantile([1.0, 2.0, 3.0, 4.0], alpha=0.40) == 3.0


def test_default_gp_path_matches_explicit_gaussian_no_ar1():
    train_x = [0.0, 1.0, 2.0, 3.0]
    train_y = [0.0, 50.0, 103.0, 151.0]
    test_x = [4.0, 5.0]

    assert gp_regression(train_x, train_y, test_x) == gp_regression(
        train_x,
        train_y,
        test_x,
        likelihood="gaussian",
        ar1=False,
    )


def test_a3_projection_result_carries_ci_correction_and_heldout_split(tmp_path):
    dataset_id = generate_dataset(
        archetype_mix=DEFAULT_ARCHETYPE_MIX,
        bands=["medium"],
        seeds=[0],
        out_dir=str(tmp_path / "datasets"),
    )
    result_path = run_projection_track(
        dataset_dir=str(tmp_path / "datasets" / dataset_id),
        out_dir=str(tmp_path / "results" / "projection"),
    )

    payload = json.loads(result_path.read_text())
    split = payload["_provenance"]["archetype_split"]
    first_cell = next(iter(payload["paired_vs_incumbent"].values()))
    first_result = next(iter(first_cell.values()))

    assert set(split["train"]).isdisjoint(split["held_out"])
    assert payload["scored_split"] == "held_out"
    assert {"delta_ci_low", "delta_ci_high"} <= set(first_result)
    assert payload["mc_correction"]["comparisons"]


def test_across_learner_conformal_noisy_fixture_covers_medium_and_max(tmp_path):
    dataset_id = generate_dataset(
        archetype_mix=DEFAULT_ARCHETYPE_MIX,
        bands=["medium", "max"],
        seeds=list(range(12)),
        out_dir=str(tmp_path / "datasets"),
    )
    result_path = run_projection_track(
        dataset_dir=str(tmp_path / "datasets" / dataset_id),
        out_dir=str(tmp_path / "results" / "projection"),
    )
    payload = json.loads(result_path.read_text())

    for band in ["medium", "max"]:
        conformal = [
            row
            for row in payload["rows"]
            if row["split"] == "held_out"
            and row["band"] == band
            and row["candidate"] == "conformal"
        ]
        gp_ard = [
            row
            for row in payload["rows"]
            if row["split"] == "held_out"
            and row["band"] == band
            and row["candidate"] == "gp_ard"
        ]
        conformal_coverage = statistics.fmean(float(row["coverage"]) for row in conformal)
        gp_coverage = statistics.fmean(float(row["coverage"]) for row in gp_ard)
        sharpness = statistics.fmean(float(row["mean_sharpness_days"]) for row in conformal)

        assert 0.85 <= conformal_coverage <= 1.0
        assert conformal_coverage > gp_coverage + 0.20
        assert sharpness > 0.0
