from __future__ import annotations

import argparse
import itertools
import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

from research_comparison.generator.generate import generate_learner
from research_comparison.manifest import build_manifest
from research_comparison.params import SWEEP_GRID
from research_comparison.progress_log import ProgressLogger
from research_comparison.runners.detection import run_detection_for_learner
from research_comparison.runners.projection import run_projection_for_learner
from research_comparison.runners.scheduling import (
    run_scheduling_for_scenario,
    scenario_from_learner,
)
from research_comparison.writers.results import write_stamped_json


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


ADVERSARIAL_SWEEP_POINTS: list[dict[str, Any]] = [
    {
        "adversarial_case": "multi_shift",
        "ar1_phi": 0.50,
        "drift_total": 0.20,
        "manual_fraction": 0.15,
        "sigma_log": 0.18,
        "step_mag": 0.24,
    },
    {
        "adversarial_case": "step_drift_combined",
        "ar1_phi": 0.35,
        "drift_total": 0.32,
        "manual_fraction": 0.15,
        "sigma_log": 0.20,
        "step_mag": 0.20,
    },
    {
        "adversarial_case": "bursty_missingness",
        "ar1_phi": 0.35,
        "drift_total": 0.20,
        "manual_fraction": 0.32,
        "sigma_log": 0.23,
        "step_mag": 0.16,
    },
]


def sweep_grid_points(grid: dict[str, list[float]] | None = None) -> list[dict[str, Any]]:
    selected = grid or SWEEP_GRID
    keys = sorted(selected)
    return [
        dict(zip(keys, values, strict=True))
        for values in itertools.product(*(selected[key] for key in keys))
    ]


def ranking_stability(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    stability: dict[str, dict[str, Any]] = {}
    for track in sorted({row["track"] for row in rows}):
        selected = [row for row in rows if row["track"] == track]
        flips = [row for row in selected if row["winner"] != row["default_winner"]]
        stability[track] = {
            "status": "held" if not flips else "flipped",
            "n_points": len(selected),
            "n_flips": len(flips),
            "flip_points": flips[:10],
        }
    return stability


def flip_cells(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        row
        for row in rows
        if row["ranking_status"] == "flipped"
    ]


def per_archetype_worst_case(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for track in sorted({row["track"] for row in rows}):
        track_rows = [row for row in rows if row["track"] == track]
        archetypes = sorted({archetype for row in track_rows for archetype in row["archetypes"]})
        scored: dict[str, dict[str, float | int]] = {}
        for archetype in archetypes:
            selected = [row for row in track_rows if archetype in row["archetypes"]]
            flips = [row for row in selected if row["ranking_status"] == "flipped"]
            scored[archetype] = {
                "n_points": len(selected),
                "n_flips": len(flips),
                "flip_rate": len(flips) / max(1, len(selected)),
            }
        if scored:
            worst = max(scored, key=lambda key: float(scored[key]["flip_rate"]))
            out[track] = {"worst_archetype": worst, "archetypes": scored}
    return out


def _truth_dict(truth: Any) -> dict[str, Any]:
    return {**asdict(truth), "regime_schedule": [asdict(shift) for shift in truth.regime_schedule]}


def _learner_dict(
    archetype: str,
    band: str,
    seed: int,
    sessions: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "learner_id": f"sweep-{archetype}-{band}-{seed}",
        "archetype": archetype,
        "band": band,
        "seed": seed,
        "sessions": sessions,
    }


def _fixture_learners(
    point: dict[str, Any],
    point_index: int,
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    fixtures = []
    case = str(point.get("adversarial_case", "default"))
    if case == "multi_shift":
        archetypes = ["marathon_runner", "marathon_runner"]
        band = "max"
    elif case == "step_drift_combined":
        archetypes = ["fading_flame", "fading_flame"]
        band = "max"
    else:
        archetypes = ["marathon_runner", "fading_flame"]
        band = "medium"

    overrides = {
        key: float(value)
        for key, value in point.items()
        if key in {"ar1_phi", "drift_total", "manual_fraction", "sigma_log", "step_mag"}
    }
    for offset, archetype in enumerate(archetypes):
        seed = point_index * 1000 + offset + 17
        sessions, truth = generate_learner(archetype, band, seed, overrides=overrides)
        if case == "bursty_missingness":
            for session_index, session in enumerate(sessions):
                if 10 <= session_index % 24 <= 15 and session.get("source") == "active":
                    session["source"] = "manual"
                    session.pop("plannedMinutes", None)
                    session.pop("activeMinutes", None)
        truth_row = _truth_dict(truth)
        learner = _learner_dict(archetype, band, seed, sessions)
        fixtures.append((learner, truth_row))
    return fixtures


def _winner_from_scores(scores: dict[str, list[float]]) -> str:
    means = {
        candidate: sum(values) / len(values)
        for candidate, values in scores.items()
        if values and not candidate.startswith("oracle")
    }
    return min(means, key=means.__getitem__) if means else "none"


def _detection_winner(fixtures: list[tuple[dict[str, Any], dict[str, Any]]]) -> str:
    scores: dict[str, list[float]] = {}
    for learner, truth in fixtures:
        rows, _roc = run_detection_for_learner(learner, truth)
        for row in rows:
            candidate = str(row["candidate"])
            if candidate.startswith("oracle") or row.get("candidate_kind") == "upper_bound":
                continue
            score = (
                float(row["mean_latency"])
                + float(row["missed"]) * 100.0
                + float(row["false_alarm_rate"]) * 25.0
            )
            scores.setdefault(candidate, []).append(score)
    return _winner_from_scores(scores)


def _projection_winner(fixtures: list[tuple[dict[str, Any], dict[str, Any]]]) -> str:
    scores: dict[str, list[float]] = {}
    for learner, truth in fixtures:
        rows, _forecasts = run_projection_for_learner(learner, truth, t_grid=[5, 8, 13])
        for row in rows:
            candidate = str(row["candidate"])
            if candidate.startswith("oracle"):
                continue
            score = (
                float(row["mean_abs_error_days"])
                + abs(0.95 - float(row["coverage"])) * 10.0
                + float(row["mean_sharpness_days"]) * 0.01
            )
            scores.setdefault(candidate, []).append(score)
    return _winner_from_scores(scores)


def _scheduling_winner(fixtures: list[tuple[dict[str, Any], dict[str, Any]]]) -> str:
    scores: dict[str, list[float]] = {}
    for learner, truth in fixtures:
        scenario = scenario_from_learner(learner, truth)
        rows = run_scheduling_for_scenario(
            scenario.scenario_id,
            scenario.material_mix,
            scenario.input_data,
            scenario.deadline,
        )
        for row in rows:
            if row.get("candidate_kind") == "upper_bound":
                continue
            score = (
                abs(float(row["deadline_drift_days"]))
                + float(row["capacity_violation_rate"]) * 25.0
                + (1.0 - float(row["prereq_order_correctness"])) * 25.0
            )
            scores.setdefault(str(row["candidate"]), []).append(score)
    return _winner_from_scores(scores)


def _default_winners() -> dict[str, str]:
    fixtures = _fixture_learners(
        {
            "ar1_phi": 0.30,
            "drift_total": 0.20,
            "manual_fraction": 0.15,
            "sigma_log": 0.18,
            "step_mag": 0.15,
        },
        point_index=0,
    )
    return {
        "detection": _detection_winner(fixtures),
        "projection": _projection_winner(fixtures),
        "scheduling": _scheduling_winner(fixtures),
    }


def run_sweep(
    out_dir: str | None = None,
    grid: dict[str, list[float]] | None = None,
    progress: ProgressLogger | None = None,
) -> Path:
    root = _repo_root()
    result_root = Path(out_dir) if out_dir else root / "research/results/sweep"
    points = sweep_grid_points(grid)
    if grid is None:
        points = [*points, *ADVERSARIAL_SWEEP_POINTS]
    if progress:
        progress.log(0, "sweep.start", f"points={len(points)}")
    default_winners = _default_winners()
    if progress:
        progress.log(10, "sweep.default_winners", json.dumps(default_winners, sort_keys=True))

    rows: list[dict[str, Any]] = []
    for point_index, point in enumerate(points):
        fixtures = _fixture_learners(point, point_index)
        winners = {
            "detection": _detection_winner(fixtures),
            "projection": _projection_winner(fixtures),
            "scheduling": _scheduling_winner(fixtures),
        }
        for track, winner in winners.items():
            default_winner = default_winners[track]
            rows.append(
                {
                    "point_index": point_index,
                    "track": track,
                    "params": point,
                    "adversarial_case": point.get("adversarial_case", "none"),
                    "archetypes": sorted({learner["archetype"] for learner, _truth in fixtures}),
                    "default_winner": default_winner,
                    "winner": winner,
                    "ranking_status": "held" if winner == default_winner else "flipped",
                }
            )
        processed = point_index + 1
        if progress and (
            processed == 1
            or processed == len(points)
            or processed % max(1, len(points) // 20) == 0
        ):
            progress.log(
                10 + (processed / max(1, len(points))) * 80,
                "sweep.points",
                f"processed={processed}/{len(points)} rows={len(rows)}",
            )

    manifest = build_manifest(seed=0, archetype_mix={"sweep": 2}, n_learners=len(points) * 2)
    payload = {
        "grid": grid or SWEEP_GRID,
        "adversarial_regimes": ADVERSARIAL_SWEEP_POINTS,
        "rows": rows,
        "stability": ranking_stability(rows),
        "flip_cells": flip_cells(rows),
        "per_archetype_worst_case": per_archetype_worst_case(rows),
    }
    if progress:
        progress.log(95, "sweep.write", f"rows={len(rows)}")
    out_path = write_stamped_json(result_root / "sweep_results.json", payload, manifest)
    if progress:
        progress.log(100, "sweep.complete", str(out_path))
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default=None)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    logger = ProgressLogger(label="research-sweep", enabled=not args.quiet)
    print(run_sweep(out_dir=args.out_dir, progress=logger))


if __name__ == "__main__":
    main()
