from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from datetime import date
from pathlib import Path
from statistics import mean
from typing import Any

import numpy as np

from research_comparison.progress_log import ProgressLogger, run_with_heartbeat


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def _pace_ratios(sessions: list[dict[str, Any]]) -> list[float]:
    ratios: list[float] = []
    for session in sessions:
        if session.get("source") != "active":
            continue
        planned = float(session.get("plannedMinutes") or 0.0)
        if planned <= 0.0:
            continue
        ratios.append(float(session["activeMinutes"]) / planned)
    return ratios


def _lag1(values: list[float]) -> float | None:
    if len(values) < 3:
        return None
    left = np.asarray(values[:-1], dtype=float)
    right = np.asarray(values[1:], dtype=float)
    if float(np.std(left)) == 0.0 or float(np.std(right)) == 0.0:
        return None
    return float(np.corrcoef(left, right)[0, 1])


def _gap_days(sessions: list[dict[str, Any]]) -> list[int]:
    dates = [date.fromisoformat(str(session["date"])) for session in sessions]
    return [(right - left).days for left, right in zip(dates, dates[1:])]


def _date_span_days(sessions: list[dict[str, Any]]) -> int:
    if len(sessions) < 2:
        return 1
    dates = [date.fromisoformat(str(session["date"])) for session in sessions]
    return max(1, (max(dates) - min(dates)).days)


def _quantiles(values: list[float], qs: list[float]) -> dict[str, float]:
    if not values:
        return {f"p{int(q * 100)}": 0.0 for q in qs}
    arr = np.asarray(values, dtype=float)
    return {f"p{int(q * 100)}": float(np.quantile(arr, q)) for q in qs}


def _summarise_group(pairs: list[tuple[dict[str, Any], dict[str, Any]]]) -> dict[str, Any]:
    sampled_phi: list[float] = []
    observed_phi: list[float] = []
    shift_frequency: list[float] = []
    all_gaps: list[int] = []
    dropped = 0

    for learner, sidecar in pairs:
        sessions = list(learner["sessions"])
        metadata = sidecar.get("missingness", {})
        traits = sidecar.get("continuous_traits", {})
        if "ar1_phi" in traits:
            sampled_phi.append(float(traits["ar1_phi"]))
        observed = _lag1(_pace_ratios(sessions))
        if observed is not None and math.isfinite(observed):
            observed_phi.append(observed)
        shifts = sidecar.get("ground_truth", {}).get("regime_schedule", [])
        shift_frequency.append(len(shifts) / _date_span_days(sessions) * 100.0)
        all_gaps.extend(_gap_days(sessions))
        planned = learner.get("planned_horizon", {}).get("planned_total_sessions")
        if bool(metadata.get("dropped_out")) or (
            planned is not None and len(sessions) < int(planned)
        ):
            dropped += 1

    return {
        "n_learners": len(pairs),
        "ar1_phi": mean(sampled_phi) if sampled_phi else 0.0,
        "observed_lag1_phi": mean(observed_phi) if observed_phi else 0.0,
        "shift_frequency_per_100_days": mean(shift_frequency) if shift_frequency else 0.0,
        "gap_days": _quantiles([float(value) for value in all_gaps], [0.50, 0.75, 0.90, 0.95]),
        "dropout_probability": dropped / max(1, len(pairs)),
    }


def _range_check(value: float, bounds: dict[str, Any], name: str) -> dict[str, Any]:
    spec = bounds["bounds"][name]
    low = float(spec["low"])
    high = float(spec["high"])
    return {
        "value": value,
        "low": low,
        "high": high,
        "within_bounds": bool(low <= value <= high),
    }


def _gap_check(gaps: dict[str, float], bounds: dict[str, Any]) -> dict[str, Any]:
    spec = bounds["bounds"]["gap_days"]
    checks = {}
    for key in ["p50", "p75", "p90", "p95"]:
        observed = float(gaps.get(key, 0.0))
        high = float(spec[key])
        checks[key] = {
            "value": observed,
            "high": high,
            "within_bounds": bool(observed <= high),
        }
    return checks


def _overall_checks(summary: dict[str, Any], bounds: dict[str, Any]) -> dict[str, Any]:
    return {
        "ar1_phi": _range_check(float(summary["ar1_phi"]), bounds, "ar1_phi"),
        "shift_frequency_per_100_days": _range_check(
            float(summary["shift_frequency_per_100_days"]),
            bounds,
            "shift_frequency_per_100_days",
        ),
        "gap_days": _gap_check(dict(summary["gap_days"]), bounds),
        "dropout_probability": _range_check(
            float(summary["dropout_probability"]),
            bounds,
            "dropout_probability",
        ),
    }


def _all_checks_pass(checks: dict[str, Any]) -> bool:
    for key, value in checks.items():
        if key == "gap_days":
            if not all(row["within_bounds"] for row in value.values()):
                return False
            continue
        if not value["within_bounds"]:
            return False
    return True


def verify_reality_bounds(
    dataset_dir: Path,
    moment_bounds: dict[str, Any],
    *,
    output_dir: Path,
    quiet: bool = False,
) -> Path:
    logger = ProgressLogger(label="reality-bounds", enabled=not quiet)
    output_dir.mkdir(parents=True, exist_ok=True)
    logger.log(0, "bounds.start", f"dataset={dataset_dir}")

    def load() -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
        manifest = json.loads((dataset_dir / "manifest.json").read_text(encoding="utf-8"))
        learners = _read_jsonl(dataset_dir / "learners.jsonl")
        sidecars = _read_jsonl(dataset_dir / "sidecars.jsonl")
        return manifest, learners, sidecars

    manifest, learners, sidecars = run_with_heartbeat(
        load,
        logger=logger,
        percent=10,
        state="bounds.load",
        detail=str(dataset_dir),
        heartbeat_seconds=10,
    )
    logger.log(30, "bounds.loaded", f"learners={len(learners)}")

    by_id = {str(row["learner_id"]): row for row in sidecars}
    pairs = [(learner, by_id[str(learner["learner_id"])]) for learner in learners]
    by_archetype: dict[str, list[tuple[dict[str, Any], dict[str, Any]]]] = defaultdict(list)
    for pair in pairs:
        by_archetype[str(pair[0]["archetype"])].append(pair)

    overall = _summarise_group(pairs)
    archetype_summaries = {
        archetype: _summarise_group(group) for archetype, group in sorted(by_archetype.items())
    }
    checks = _overall_checks(overall, moment_bounds)
    status = "pass" if _all_checks_pass(checks) else "fail"
    payload = {
        "status": status,
        "dataset_id": manifest.get("dataset_id", dataset_dir.name),
        "params_version_hash": manifest.get("params_version_hash"),
        "base_params_version_hash": manifest.get("base_params_version_hash"),
        "bounds_version": moment_bounds.get("bounds_version"),
        "moment_bounds_hash": moment_bounds.get("moment_bounds_hash"),
        "summary": overall,
        "by_archetype": archetype_summaries,
        "checks": checks,
    }
    output_path = output_dir / "reality_bounds_check.json"
    output_path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    logger.log(100, "bounds.complete", f"status={status} output={output_path}")
    if status != "pass":
        raise AssertionError(f"Reality bounds check failed; see {output_path}")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset-dir", type=Path, required=True)
    parser.add_argument("--moment-bounds-file", type=Path, required=True)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=_repo_root() / "research/doc/verification-runs/2026-06-19-a6-dataset-v2",
    )
    parser.add_argument("--quiet", action="store_true", help="suppress progress output")
    args = parser.parse_args()

    bounds = json.loads(args.moment_bounds_file.read_text(encoding="utf-8"))
    print(
        verify_reality_bounds(
            args.dataset_dir,
            bounds,
            output_dir=args.output_dir,
            quiet=args.quiet,
        )
    )


if __name__ == "__main__":
    main()
