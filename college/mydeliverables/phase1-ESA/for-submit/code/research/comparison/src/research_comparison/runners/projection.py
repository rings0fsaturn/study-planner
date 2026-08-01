from __future__ import annotations

import argparse
import json
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from research_comparison.baselines.projection import (
    COLD_START_N,
    _date_to_index,
    conformal_abs_residual_quantile,
    forecast_analytic_required_rate,
    forecast_conformal_finish,
    forecast_gp_finish,
    forecast_gp_hetero_t_finish,
    forecast_gp_plus_analytic_finish,
    forecast_kalman_finish,
    forecast_linear_finish,
)
from research_comparison.metrics.projection import projection_metrics, winner_by_band
from research_comparison.oracles.projection import forecast_projection_oracle
from research_comparison.progress_log import ProgressLogger
from research_comparison.runners.rigour import (
    DEFAULT_SEED_COUNT,
    annotate_archetype_split,
    attach_rigour_provenance,
    mc_correction_block,
    paired_by_group,
    read_jsonl,
    reporting_rows,
    resolve_dataset_dir,
)
from research_comparison.writers.results import manifest_from_dataset, write_stamped_json


@dataclass(frozen=True)
class ProjectionCandidate:
    name: str
    forecast: Callable[[list[dict[str, Any]], float, str, str], dict[str, Any]]


def projection_candidates(
    conformal_width_days: float | None = None,
) -> list[ProjectionCandidate]:
    return [
        ProjectionCandidate(
            "gp_ard",
            lambda sessions, total, start, end: forecast_gp_finish(
                sessions,
                total,
                start_date=start,
                horizon_end_date=end,
            ),
        ),
        ProjectionCandidate(
            "analytic_required_rate",
            lambda sessions, total, start, end: forecast_analytic_required_rate(
                sessions,
                total,
                start_date=start,
                horizon_end_date=end,
            ),
        ),
        ProjectionCandidate(
            "gp_plus_analytic",
            lambda sessions, total, start, end: forecast_gp_plus_analytic_finish(
                sessions,
                total,
                start_date=start,
                horizon_end_date=end,
            ),
        ),
        ProjectionCandidate(
            "linear",
            lambda sessions, total, _start, _end: forecast_linear_finish(sessions, total),
        ),
        ProjectionCandidate(
            "conformal",
            lambda sessions, total, start, end: forecast_conformal_finish(
                sessions,
                total,
                start_date=start,
                horizon_end_date=end,
                finish_residual_width_days=conformal_width_days,
            ),
        ),
        ProjectionCandidate(
            "gp_hetero_t",
            lambda sessions, total, start, end: forecast_gp_hetero_t_finish(
                sessions,
                total,
                start_date=start,
                horizon_end_date=end,
            ),
        ),
        ProjectionCandidate(
            "kalman",
            lambda sessions, total, _start, _end: forecast_kalman_finish(sessions, total),
        ),
    ]


def default_t_grid(n_sessions: int) -> list[int]:
    base = [3, 5, 8, 13, 21, 34, 55, 89, n_sessions]
    return sorted({value for value in base if 2 <= value <= n_sessions})


def _session_minutes_noise_free(session: dict[str, Any], latent_ratio: float) -> float:
    if session.get("plannedMinutes") is not None:
        return float(session["plannedMinutes"]) * latent_ratio
    return float(session.get("duration") or 0.0)


def _target_minutes_from_truth(
    sessions: list[dict[str, Any]],
    truth: dict[str, Any],
) -> float:
    true_finish = date.fromisoformat(str(truth["true_finish_date"]))
    cumulative = 0.0
    for session, latent_ratio in zip(sessions, truth["r_star"], strict=False):
        cumulative += _session_minutes_noise_free(session, float(latent_ratio))
        if date.fromisoformat(str(session["date"])) >= true_finish:
            return cumulative
    return cumulative


def _horizon_end_date(sessions: list[dict[str, Any]], true_finish_date: str) -> str:
    last = date.fromisoformat(str(sessions[-1]["date"]))
    true_date = date.fromisoformat(true_finish_date)
    return (max(last, true_date) + timedelta(days=30)).isoformat()


def run_projection_for_learner(
    learner: dict[str, Any],
    truth: dict[str, Any],
    t_grid: list[int] | None = None,
    conformal_width_days: float | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    sessions = [
        session for session in learner["sessions"] if float(session.get("duration") or 0) > 0
    ]
    if len(sessions) < 2:
        return [], []
    total_minutes = _target_minutes_from_truth(sessions, truth)
    true_finish_date = str(truth["true_finish_date"])
    grid = t_grid or default_t_grid(len(sessions))
    start_date = str(sessions[0]["date"])
    horizon_end = _horizon_end_date(sessions, true_finish_date)

    rows: list[dict[str, Any]] = []
    forecast_rows: list[dict[str, Any]] = []
    for candidate in projection_candidates(conformal_width_days=conformal_width_days):
        forecasts: list[dict[str, Any]] = []
        for t in grid:
            forecast = candidate.forecast(sessions[:t], total_minutes, start_date, horizon_end)
            forecasts.append(forecast)
            forecast_rows.append(
                {
                    "learner_id": learner["learner_id"],
                    "band": learner["band"],
                    "archetype": learner["archetype"],
                    "seed": learner["seed"],
                    "candidate": candidate.name,
                    "t": t,
                    "true_finish_date": true_finish_date,
                    **forecast,
                }
            )
        metrics = projection_metrics(forecasts, true_finish_date=true_finish_date)
        comparison_score = (
            metrics["mean_abs_error_days"]
            + abs(0.95 - metrics["coverage"]) * 10.0
            + metrics["mean_sharpness_days"] * 0.01
        )
        rows.append(
            {
                "learner_id": learner["learner_id"],
                "band": learner["band"],
                "archetype": learner["archetype"],
                "seed": learner["seed"],
                "candidate": candidate.name,
                "coverage": metrics["coverage"],
                "mean_sharpness_days": metrics["mean_sharpness_days"],
                "mean_abs_error_days": metrics["mean_abs_error_days"],
                "comparison_score": float(comparison_score),
                "n_forecasts": len(forecasts),
            }
        )
    oracle_forecasts = [forecast_projection_oracle(true_finish_date) for _t in grid]
    for t, forecast in zip(grid, oracle_forecasts, strict=True):
        forecast_rows.append(
            {
                "learner_id": learner["learner_id"],
                "band": learner["band"],
                "archetype": learner["archetype"],
                "seed": learner["seed"],
                "candidate": "oracle_projection",
                "t": t,
                "true_finish_date": true_finish_date,
                **forecast,
            }
        )
    oracle_metrics = projection_metrics(oracle_forecasts, true_finish_date=true_finish_date)
    oracle_comparison_score = (
        oracle_metrics["mean_abs_error_days"]
        + abs(0.95 - oracle_metrics["coverage"]) * 10.0
        + oracle_metrics["mean_sharpness_days"] * 0.01
    )
    rows.append(
        {
            "learner_id": learner["learner_id"],
            "band": learner["band"],
            "archetype": learner["archetype"],
            "seed": learner["seed"],
            "candidate": "oracle_projection",
            "coverage": oracle_metrics["coverage"],
            "mean_sharpness_days": oracle_metrics["mean_sharpness_days"],
            "mean_abs_error_days": oracle_metrics["mean_abs_error_days"],
            "comparison_score": float(oracle_comparison_score),
            "n_forecasts": len(oracle_forecasts),
        }
    )
    return rows, forecast_rows


def _max_finish_residual_days(
    learner: dict[str, Any],
    truth: dict[str, Any],
) -> float | None:
    sessions = [
        session for session in learner["sessions"] if float(session.get("duration") or 0) > 0
    ]
    if len(sessions) < 2:
        return None
    total_minutes = _target_minutes_from_truth(sessions, truth)
    true_finish_date = str(truth["true_finish_date"])
    grid = default_t_grid(len(sessions))
    start_date = str(sessions[0]["date"])
    horizon_end = _horizon_end_date(sessions, true_finish_date)
    true_index = _date_to_index(true_finish_date, start_date)
    residuals = [
        abs(
            _date_to_index(
                str(
                    forecast_gp_finish(
                        sessions[:t],
                        total_minutes,
                        start_date=start_date,
                        horizon_end_date=horizon_end,
                    )["predicted_finish_date"]
                ),
                start_date,
            )
            - true_index
        )
        for t in grid
    ]
    return max(residuals) if residuals else None


def _forecast_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    usable = [
        row
        for row in rows
        if row.get("predicted_finish_date")
        and row.get("interval_low")
        and row.get("interval_high")
        and row.get("true_finish_date")
    ]
    if not usable:
        return {
            "n_forecasts": 0,
            "coverage": 0.0,
            "mean_abs_error_days": 0.0,
            "mean_sharpness_days": 0.0,
        }

    covered = 0
    errors: list[float] = []
    sharpness: list[float] = []
    for row in usable:
        true_date = date.fromisoformat(str(row["true_finish_date"]))
        low = date.fromisoformat(str(row["interval_low"]))
        high = date.fromisoformat(str(row["interval_high"]))
        predicted = date.fromisoformat(str(row["predicted_finish_date"]))
        if low <= true_date <= high:
            covered += 1
        errors.append(float(abs((predicted - true_date).days)))
        sharpness.append(float(max(0, (high - low).days)))
    return {
        "n_forecasts": len(usable),
        "coverage": covered / len(usable),
        "mean_abs_error_days": sum(errors) / len(errors),
        "mean_sharpness_days": sum(sharpness) / len(sharpness),
    }


def cold_start_eval_block(
    forecasts: list[dict[str, Any]],
    cold_start_n: int = COLD_START_N,
) -> dict[str, Any]:
    candidates = {"gp_ard", "analytic_required_rate", "gp_plus_analytic"}
    selected = [
        row
        for row in forecasts
        if row.get("split") == "held_out"
        and str(row.get("candidate")) in candidates
        and int(row.get("t", 0)) < cold_start_n
    ]
    bands = sorted({str(row["band"]) for row in selected})
    by_band: dict[str, dict[str, Any]] = {}
    for band in bands:
        by_band[band] = {
            candidate: _forecast_summary(
                [
                    row
                    for row in selected
                    if row["band"] == band and row["candidate"] == candidate
                ]
            )
            for candidate in sorted(candidates)
        }
    return {
        "method": "held_out_forecasts_with_t_below_cold_start_n",
        "cold_start_n": cold_start_n,
        "t_values": sorted({int(row["t"]) for row in selected}),
        "by_band": by_band,
    }


def calibrate_across_learner_conformal_widths(
    learners: list[dict[str, Any]],
    sidecars: dict[str, dict[str, Any]],
    train_archetypes: set[str],
) -> dict[str, float]:
    residuals_by_band: dict[str, list[float]] = {}
    for learner in learners:
        if str(learner["archetype"]) not in train_archetypes:
            continue
        residual = _max_finish_residual_days(learner, sidecars[learner["learner_id"]])
        if residual is None:
            continue
        residuals_by_band.setdefault(str(learner["band"]), []).append(residual)
    return {
        band: conformal_abs_residual_quantile(residuals, alpha=0.05)
        for band, residuals in residuals_by_band.items()
    }


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    return read_jsonl(path)


def run_projection_track(
    dataset_dir: str | None = None,
    out_dir: str | None = None,
    seed_count: int | None = DEFAULT_SEED_COUNT,
    progress: ProgressLogger | None = None,
) -> Path:
    root = _repo_root()
    dataset_path = resolve_dataset_dir(root, dataset_dir, seed_count, progress=progress)
    result_root = Path(out_dir) if out_dir else root / "research/results/projection"
    if progress:
        progress.log(0, "projection.start", f"dataset={dataset_path}")
    raw_manifest = json.loads((dataset_path / "manifest.json").read_text(encoding="utf-8"))
    manifest = manifest_from_dataset(raw_manifest)
    sidecars = {
        row["learner_id"]: row["ground_truth"]
        for row in _read_jsonl(dataset_path / "sidecars.jsonl")
    }

    rows: list[dict[str, Any]] = []
    forecasts: list[dict[str, Any]] = []
    learners = _read_jsonl(dataset_path / "learners.jsonl")
    train_archetypes = {"steady", "marathon_runner", "morning_lark"}
    conformal_widths = calibrate_across_learner_conformal_widths(
        learners,
        sidecars,
        train_archetypes,
    )
    total_learners = len(learners)
    if progress:
        progress.log(10, "projection.loaded", f"learners={total_learners}")
    for learner_index, learner in enumerate(learners, start=1):
        learner_rows, learner_forecasts = run_projection_for_learner(
            learner,
            sidecars[learner["learner_id"]],
            conformal_width_days=conformal_widths.get(str(learner["band"])),
        )
        rows.extend(learner_rows)
        forecasts.extend(learner_forecasts)
        if progress and (
            learner_index == 1
            or learner_index == total_learners
            or learner_index % max(1, total_learners // 20) == 0
        ):
            progress.log(
                10 + (learner_index / max(1, total_learners)) * 80,
                "projection.learners",
                f"processed={learner_index}/{total_learners} "
                f"rows={len(rows)} forecasts={len(forecasts)}",
            )

    dataset_archetypes = {str(learner["archetype"]) for learner in learners}
    annotate_archetype_split(rows, archetypes=dataset_archetypes)
    annotate_archetype_split(forecasts, archetypes=dataset_archetypes)
    for row in rows:
        if row["candidate"] == "conformal":
            row["conformal_width_days"] = conformal_widths.get(str(row["band"]))
    for row in forecasts:
        if row["candidate"] == "conformal":
            row["conformal_width_days"] = conformal_widths.get(str(row["band"]))
    scored_rows, scored_split = reporting_rows(rows)
    paired = paired_by_group(
        scored_rows,
        metric="comparison_score",
        baseline_candidate="gp_ard",
        group_fields=["band"],
    )
    paired_cells = paired_by_group(
        scored_rows,
        metric="comparison_score",
        baseline_candidate="gp_ard",
        group_fields=["band", "archetype"],
    )
    manifest = attach_rigour_provenance(
        manifest,
        raw_manifest,
        rows,
        archetypes=dataset_archetypes,
    )
    payload = {
        "dataset_id": raw_manifest["dataset_id"],
        "scored_split": scored_split,
        "conformal_calibration": {
            "method": "across_learner_finish_date_residual",
            "alpha": 0.05,
            "train_archetypes": sorted(train_archetypes),
            "width_days_by_band": conformal_widths,
            "residual_unit": "one max finish-date residual per train learner",
        },
        "rows": rows,
        "forecasts": forecasts,
        "winner_by_band": winner_by_band(scored_rows),
        "paired_vs_incumbent": paired,
        "paired_by_cell": paired_cells,
        "cold_start_eval": cold_start_eval_block(forecasts),
        "reference_line_eval": {
            "status": "deferred",
            "reason": (
                "R4 prioritized candidate selection and cold-start scoring; linear-to-deadline "
                "vs capacity-shaped reference-line evaluation is lower-priority per PLAN D-07."
            ),
            "options": ["linear_to_deadline", "capacity_shaped"],
        },
        "mc_correction": mc_correction_block(
            paired_cells,
            metric="comparison_score",
            baseline_candidate="gp_ard",
        ),
    }
    if progress:
        progress.log(95, "projection.write", f"rows={len(rows)} forecasts={len(forecasts)}")
    out_path = write_stamped_json(result_root / "projection_results.json", payload, manifest)
    if progress:
        progress.log(100, "projection.complete", str(out_path))
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-dir", default=None)
    parser.add_argument("--out-dir", default=None)
    parser.add_argument("--seeds", type=int, default=DEFAULT_SEED_COUNT)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    logger = ProgressLogger(label="research-projection", enabled=not args.quiet)
    print(
        run_projection_track(
            dataset_dir=args.dataset_dir,
            out_dir=args.out_dir,
            seed_count=args.seeds,
            progress=logger,
        )
    )


if __name__ == "__main__":
    main()
