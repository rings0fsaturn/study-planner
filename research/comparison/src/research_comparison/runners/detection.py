from __future__ import annotations

import argparse
import json
import math
import statistics
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from research_comparison.baselines.detection import (
    detect_adwin,
    detect_bocpd,
    detect_csd,
    detect_cusum_robust,
    detect_ewma,
    detect_page_hinkley,
    detect_ruptures_upper_bound,
)
from research_comparison.metrics.detection import (
    SHIFT_TYPES,
    roc_points,
    score_detections,
    winner_by_shift_type,
)
from research_comparison.oracles.detection import detection_oracle_breakpoints
from research_comparison.progress_log import ProgressLogger
from research_comparison.runners.rigour import (
    DEFAULT_SEED_COUNT,
    annotate_archetype_split,
    archetype_split_for_rows,
    attach_rigour_provenance,
    mc_correction_block,
    paired_by_group,
    read_jsonl,
    reporting_rows,
    resolve_dataset_dir,
)
from research_comparison.writers.results import manifest_from_dataset, write_stamped_json


@dataclass(frozen=True)
class DetectionCandidate:
    name: str
    detector: Callable[[list[float]], list[int]]
    candidate_kind: str = "deployable"
    metadata: dict[str, Any] | None = None


DEFAULT_CUSUM_PARAMS = {
    "step_k": 0.35,
    "step_h": 3.0,
    "drift_k": 0.15,
    "drift_h": 4.5,
}

CUSUM_TUNING_GRID = {
    "step": [
        {"step_k": 0.25, "step_h": 2.5},
        {"step_k": 0.35, "step_h": 3.0},
        {"step_k": 0.45, "step_h": 3.5},
    ],
    "drift": [
        {"drift_k": 0.08, "drift_h": 3.5},
        {"drift_k": 0.15, "drift_h": 4.5},
        {"drift_k": 0.22, "drift_h": 5.5},
    ],
}


def _std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.05
    value = float(statistics.stdev(values))
    return value if value > 1e-6 else 0.05


def _comparison_score(row: dict[str, Any]) -> float:
    latency = float(row["mean_latency"])
    if not math.isfinite(latency):
        latency = 100.0
    return latency + float(row["missed"]) * 100.0 + float(row["false_alarm_rate"]) * 25.0


def detect_cusum(
    pace_ratios: list[float],
    reference_mean: float,
    std: float,
) -> list[int]:
    del reference_mean, std
    return detect_cusum_robust(pace_ratios, **DEFAULT_CUSUM_PARAMS)


def detection_candidates(
    pace_ratios: list[float],
    cusum_params: dict[str, float] | None = None,
) -> list[DetectionCandidate]:
    baseline = pace_ratios[: min(8, len(pace_ratios))]
    reference_mean = float(statistics.fmean(baseline)) if baseline else 1.0
    std = _std(baseline)
    selected_cusum = {**DEFAULT_CUSUM_PARAMS, **(cusum_params or {})}
    return [
        DetectionCandidate(
            "cusum",
            lambda series: detect_cusum_robust(series, **selected_cusum),
            metadata={"tuned_on": "heldout_train_archetypes", **selected_cusum},
        ),
        DetectionCandidate(
            "ewma_control_chart",
            lambda series: detect_ewma(
                series,
                reference_mean=reference_mean,
                std=std,
                threshold=2.4,
            ),
        ),
        DetectionCandidate("csd", lambda series: detect_csd(series, window=8, threshold=0.07)),
        DetectionCandidate("bocpd", lambda series: detect_bocpd(series)),
        DetectionCandidate("page_hinkley", lambda series: detect_page_hinkley(series)),
        DetectionCandidate("adwin", lambda series: detect_adwin(series)),
        DetectionCandidate(
            "ruptures_pelt_binseg",
            lambda series: detect_ruptures_upper_bound(series),
            candidate_kind="upper_bound",
            metadata={"retrospective": True, "models": ["pelt", "binseg"]},
        ),
    ]


def _active_series_with_indices(sessions: list[dict[str, Any]]) -> tuple[list[float], list[int]]:
    pace_ratios: list[float] = []
    original_indices: list[int] = []
    for index, session in enumerate(sessions):
        planned = session.get("plannedMinutes")
        active = session.get("activeMinutes")
        if session.get("source") != "active" or planned is None or active is None:
            continue
        planned_value = float(planned)
        if planned_value <= 0:
            continue
        pace_ratios.append(float(active) / planned_value)
        original_indices.append(index)
    return pace_ratios, original_indices


def _shifts_on_active_axis(
    raw_shifts: list[dict[str, Any]],
    active_original_indices: list[int],
) -> list[dict[str, Any]]:
    active_shifts: list[dict[str, Any]] = []
    for shift in raw_shifts:
        onset = int(shift["onset_index"])
        active_index = next(
            (
                active_position
                for active_position, original_index in enumerate(active_original_indices)
                if original_index >= onset
            ),
            None,
        )
        if active_index is None:
            continue
        active_shifts.append({**shift, "onset_index": active_index})
    return active_shifts


def _score_cusum_params(
    learners: list[dict[str, Any]],
    sidecars: dict[str, dict[str, Any]],
    train_archetypes: set[str],
    shift_type: str,
    params: dict[str, float],
) -> float:
    scores: list[float] = []
    for learner in learners:
        if str(learner["archetype"]) not in train_archetypes:
            continue
        pace_ratios, original_indices = _active_series_with_indices(learner["sessions"])
        shifts = _shifts_on_active_axis(
            sidecars[learner["learner_id"]].get("regime_schedule", []),
            original_indices,
        )
        if len(pace_ratios) < 3 or not shifts:
            continue
        score = score_detections(
            detect_cusum_robust(pace_ratios, **{**DEFAULT_CUSUM_PARAMS, **params}),
            shifts,
            n_observations=len(pace_ratios),
        )
        type_score = score["by_type"][shift_type]
        if type_score["n_shifts"] == 0:
            continue
        latency = float(type_score["mean_latency"])
        if not math.isfinite(latency):
            latency = 100.0
        scores.append(
            latency
            + float(type_score["missed"]) * 100.0
            + float(score["false_alarm_rate"]) * 25.0
        )
    return float(statistics.fmean(scores)) if scores else math.inf


def tune_cusum_params(
    learners: list[dict[str, Any]],
    sidecars: dict[str, dict[str, Any]],
    train_archetypes: list[str],
) -> dict[str, Any]:
    train = set(train_archetypes)
    selected = dict(DEFAULT_CUSUM_PARAMS)
    audit: dict[str, list[dict[str, float]]] = {}
    for shift_type, grid in CUSUM_TUNING_GRID.items():
        scored: list[dict[str, float]] = []
        for option in grid:
            score = _score_cusum_params(learners, sidecars, train, shift_type, option)
            scored.append({**option, "score": score})
        audit[shift_type] = scored
        finite = [row for row in scored if math.isfinite(row["score"])]
        if not finite:
            continue
        best = min(finite, key=lambda row: row["score"])
        for key, value in best.items():
            if key != "score":
                selected[key] = float(value)
    return {
        "method": "grid_search_train_archetypes_only",
        "train_archetypes": sorted(train),
        "selected": selected,
        "grid_scores": audit,
    }


def _pareto_probe_rows(
    learner: dict[str, Any],
    pace_ratios: list[float],
    shifts: list[dict[str, Any]],
    cusum_params: dict[str, float],
) -> list[dict[str, Any]]:
    probes: list[tuple[str, float, Callable[[list[float]], list[int]]]] = [
        (
            "cusum_h",
            threshold,
            lambda series, threshold=threshold: detect_cusum_robust(
                series,
                **{
                    **cusum_params,
                    "step_h": threshold,
                    "drift_h": max(threshold + 1.0, cusum_params["drift_h"]),
                },
            ),
        )
        for threshold in [4.0, 3.5, 3.0, 2.5, 2.0]
    ]
    probes.extend(
        (
            "csd_threshold",
            threshold,
            lambda series, threshold=threshold: detect_csd(series, window=8, threshold=threshold),
        )
        for threshold in [0.10, 0.08, 0.06, 0.04, 0.025]
    )

    rows: list[dict[str, Any]] = []
    for family, threshold, detector in probes:
        breakpoints = detector(pace_ratios)
        score = score_detections(breakpoints, shifts, n_observations=len(pace_ratios))
        for shift_type in SHIFT_TYPES:
            type_score = score["by_type"][shift_type]
            if type_score["n_shifts"] == 0:
                continue
            rows.append(
                {
                    "frontier_kind": "latency_false_alarm",
                    "learner_id": learner["learner_id"],
                    "band": learner["band"],
                    "archetype": learner["archetype"],
                    "seed": learner["seed"],
                    "family": family,
                    "threshold": float(threshold),
                    "shift_type": shift_type,
                    "n_shifts": type_score["n_shifts"],
                    "n_detected": type_score["n_detected"],
                    "missed": type_score["missed"],
                    "mean_latency": type_score["mean_latency"],
                    "false_alarm_rate": score["false_alarm_rate"],
                    "true_detection_rate": score["true_detection_rate"],
                }
            )
    return rows


def latency_false_alarm_frontier(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    frontier: dict[str, list[dict[str, Any]]] = {}
    selected_rows = [row for row in rows if row.get("frontier_kind") == "latency_false_alarm"]
    for shift_type in SHIFT_TYPES:
        grouped: dict[tuple[str, float], list[dict[str, Any]]] = {}
        for row in selected_rows:
            if row["shift_type"] != shift_type:
                continue
            grouped.setdefault((str(row["family"]), float(row["threshold"])), []).append(row)
        points: list[dict[str, Any]] = []
        for (family, threshold), group in sorted(grouped.items()):
            finite_latencies = [
                float(row["mean_latency"])
                for row in group
                if math.isfinite(float(row["mean_latency"]))
            ]
            mean_latency = (
                float(statistics.fmean(finite_latencies)) if finite_latencies else math.inf
            )
            missed = float(statistics.fmean(float(row["missed"]) for row in group))
            false_alarm = float(
                statistics.fmean(float(row["false_alarm_rate"]) for row in group)
            )
            detection_rate = float(
                statistics.fmean(float(row["true_detection_rate"]) for row in group)
            )
            points.append(
                {
                    "family": family,
                    "threshold": threshold,
                    "mean_latency": mean_latency,
                    "missed": missed,
                    "false_alarm_rate": false_alarm,
                    "true_detection_rate": detection_rate,
                }
            )
        monotone: list[dict[str, Any]] = []
        best_latency = math.inf
        for point in sorted(points, key=lambda row: row["false_alarm_rate"]):
            latency = float(point["mean_latency"])
            if latency <= best_latency:
                monotone.append(point)
                best_latency = latency
        frontier[shift_type] = monotone
    return frontier


def run_detection_for_learner(
    learner: dict[str, Any],
    truth: dict[str, Any],
    cusum_params: dict[str, float] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    pace_ratios, original_indices = _active_series_with_indices(learner["sessions"])
    shifts = _shifts_on_active_axis(truth.get("regime_schedule", []), original_indices)
    if len(pace_ratios) < 3 or not shifts:
        return [], []

    rows: list[dict[str, Any]] = []
    selected_cusum = {**DEFAULT_CUSUM_PARAMS, **(cusum_params or {})}
    for candidate in detection_candidates(pace_ratios, cusum_params=selected_cusum):
        breakpoints = candidate.detector(pace_ratios)
        score = score_detections(breakpoints, shifts, n_observations=len(pace_ratios))
        for shift_type in SHIFT_TYPES:
            type_score = score["by_type"][shift_type]
            if type_score["n_shifts"] == 0:
                continue
            rows.append(
                row := {
                    "learner_id": learner["learner_id"],
                    "band": learner["band"],
                    "archetype": learner["archetype"],
                    "seed": learner["seed"],
                    "candidate": candidate.name,
                    "candidate_kind": candidate.candidate_kind,
                    "shift_type": shift_type,
                    "n_shifts": type_score["n_shifts"],
                    "n_detected": type_score["n_detected"],
                    "missed": type_score["missed"],
                    "mean_latency": type_score["mean_latency"],
                    "false_alarms": score["false_alarms"],
                    "false_alarm_rate": score["false_alarm_rate"],
                    "breakpoints": breakpoints,
                    "candidate_metadata": candidate.metadata or {},
                }
            )
            row["comparison_score"] = _comparison_score(row)

    oracle_breakpoints = detection_oracle_breakpoints(shifts)
    oracle_score = score_detections(oracle_breakpoints, shifts, n_observations=len(pace_ratios))
    for shift_type in SHIFT_TYPES:
        type_score = oracle_score["by_type"][shift_type]
        if type_score["n_shifts"] == 0:
            continue
        rows.append(
            row := {
                "learner_id": learner["learner_id"],
                "band": learner["band"],
                "archetype": learner["archetype"],
                "seed": learner["seed"],
                "candidate": "oracle_detection",
                "candidate_kind": "upper_bound",
                "shift_type": shift_type,
                "n_shifts": type_score["n_shifts"],
                "n_detected": type_score["n_detected"],
                "missed": type_score["missed"],
                "mean_latency": type_score["mean_latency"],
                "false_alarms": oracle_score["false_alarms"],
                "false_alarm_rate": oracle_score["false_alarm_rate"],
                "breakpoints": oracle_breakpoints,
                "candidate_metadata": {"oracle": True},
            }
        )
        row["comparison_score"] = _comparison_score(row)

    baseline = pace_ratios[: min(8, len(pace_ratios))]
    reference_mean = float(statistics.fmean(baseline)) if baseline else 1.0
    std = _std(baseline)
    roc = [
        {
            "learner_id": learner["learner_id"],
            "band": learner["band"],
            "archetype": learner["archetype"],
            "seed": learner["seed"],
            "candidate": "ewma_control_chart",
            **point,
        }
        for point in roc_points(
            pace_ratios,
            shifts,
            detector=lambda series, threshold: detect_ewma(
                series,
                reference_mean=reference_mean,
                std=std,
                threshold=threshold,
            ),
            thresholds=[3.0, 2.4, 1.8, 1.2],
        )
    ]
    roc.extend(_pareto_probe_rows(learner, pace_ratios, shifts, selected_cusum))
    return rows, roc


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    return read_jsonl(path)


def run_detection_track(
    dataset_dir: str | None = None,
    out_dir: str | None = None,
    seed_count: int | None = DEFAULT_SEED_COUNT,
    progress: ProgressLogger | None = None,
) -> Path:
    root = _repo_root()
    dataset_path = resolve_dataset_dir(root, dataset_dir, seed_count, progress=progress)
    result_root = Path(out_dir) if out_dir else root / "research/results/detection"
    if progress:
        progress.log(0, "detection.start", f"dataset={dataset_path}")
    raw_manifest = json.loads((dataset_path / "manifest.json").read_text(encoding="utf-8"))
    manifest = manifest_from_dataset(raw_manifest)
    sidecars = {
        row["learner_id"]: row["ground_truth"]
        for row in _read_jsonl(dataset_path / "sidecars.jsonl")
    }

    rows: list[dict[str, Any]] = []
    roc: list[dict[str, Any]] = []
    learners = _read_jsonl(dataset_path / "learners.jsonl")
    total_learners = len(learners)
    dataset_archetypes = {str(learner["archetype"]) for learner in learners}
    split = archetype_split_for_rows([], archetypes=dataset_archetypes)
    cusum_tuning = tune_cusum_params(learners, sidecars, split["train"])
    selected_cusum_params = dict(cusum_tuning["selected"])
    if progress:
        progress.log(
            10,
            "detection.loaded",
            f"learners={total_learners} cusum={json.dumps(selected_cusum_params, sort_keys=True)}",
        )
    for learner_index, learner in enumerate(learners, start=1):
        learner_rows, learner_roc = run_detection_for_learner(
            learner,
            sidecars[learner["learner_id"]],
            cusum_params=selected_cusum_params,
        )
        rows.extend(learner_rows)
        roc.extend(learner_roc)
        if progress and (
            learner_index == 1
            or learner_index == total_learners
            or learner_index % max(1, total_learners // 20) == 0
        ):
            progress.log(
                10 + (learner_index / max(1, total_learners)) * 80,
                "detection.learners",
                f"processed={learner_index}/{total_learners} rows={len(rows)} roc={len(roc)}",
            )

    annotate_archetype_split(rows, archetypes=dataset_archetypes)
    annotate_archetype_split(roc, archetypes=dataset_archetypes)
    scored_rows, scored_split = reporting_rows(rows)
    scored_roc, _scored_roc_split = reporting_rows(roc)
    paired = paired_by_group(
        [row for row in scored_rows if row.get("candidate_kind") != "upper_bound"],
        metric="comparison_score",
        baseline_candidate="cusum",
        group_fields=["shift_type"],
    )
    paired_cells = paired_by_group(
        [row for row in scored_rows if row.get("candidate_kind") != "upper_bound"],
        metric="comparison_score",
        baseline_candidate="cusum",
        group_fields=["band", "archetype", "shift_type"],
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
        "rows": rows,
        "roc": roc,
        "pareto_frontier": latency_false_alarm_frontier(scored_roc),
        "cusum_tuning": cusum_tuning,
        "winner_by_shift_type": winner_by_shift_type(scored_rows),
        "paired_vs_incumbent": paired,
        "paired_by_cell": paired_cells,
        "mc_correction": mc_correction_block(
            paired_cells,
            metric="comparison_score",
            baseline_candidate="cusum",
        ),
    }
    if progress:
        progress.log(95, "detection.write", f"rows={len(rows)} roc={len(roc)}")
    out_path = write_stamped_json(result_root / "detection_results.json", payload, manifest)
    if progress:
        progress.log(100, "detection.complete", str(out_path))
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-dir", default=None)
    parser.add_argument("--out-dir", default=None)
    parser.add_argument("--seeds", type=int, default=DEFAULT_SEED_COUNT)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    logger = ProgressLogger(label="research-detection", enabled=not args.quiet)
    print(
        run_detection_track(
            dataset_dir=args.dataset_dir,
            out_dir=args.out_dir,
            seed_count=args.seeds,
            progress=logger,
        )
    )


if __name__ == "__main__":
    main()
