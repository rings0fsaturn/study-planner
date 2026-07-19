from __future__ import annotations

import argparse
import json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, NamedTuple

from research_comparison.progress_log import ProgressLogger, run_with_heartbeat


class CaptureOutputs(NamedTuple):
    evidence_path: Path
    summary_path: Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _mean(values: list[float]) -> float:
    return float(sum(values) / len(values)) if values else math.nan


def _scored_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = list(payload.get("rows", []))
    scored_split = payload.get("scored_split")
    if scored_split:
        selected = [row for row in rows if row.get("split") == scored_split]
        if selected:
            return selected
    return rows


def _metric_means_by_band(rows: list[dict[str, Any]], metric: str) -> dict[str, dict[str, float]]:
    grouped: dict[tuple[str, str], list[float]] = defaultdict(list)
    for row in rows:
        if metric not in row:
            continue
        grouped[(str(row["band"]), str(row["candidate"]))].append(float(row[metric]))

    by_band: dict[str, dict[str, float]] = defaultdict(dict)
    for (band, candidate), values in sorted(grouped.items()):
        by_band[band][candidate] = _mean(values)
    return dict(by_band)


def _mc_survivors(mc_correction: dict[str, Any]) -> dict[str, dict[str, dict[str, int]]]:
    summary: dict[str, dict[str, dict[str, int]]] = {}
    for metric, block in sorted(mc_correction.items()):
        wins: Counter[str] = Counter()
        significant_not_win: Counter[str] = Counter()
        for comparison in block.get("comparisons", []):
            candidate = str(comparison.get("candidate", "unknown"))
            if comparison.get("survives_holm_win"):
                wins[candidate] += 1
            elif comparison.get("holm_significant"):
                significant_not_win[candidate] += 1
        summary[metric] = {
            "holm_surviving_wins": dict(sorted(wins.items())),
            "holm_sig_but_not_win": dict(sorted(significant_not_win.items())),
        }
    return summary


def _delta_ci_present(mc_correction: dict[str, Any]) -> bool:
    for block in mc_correction.values():
        for comparison in block.get("comparisons", []):
            if {"delta_ci_low", "delta_ci_high"} <= set(comparison):
                return True
    return False


def _candidate_kinds(rows: list[dict[str, Any]]) -> dict[str, None]:
    return {candidate: None for candidate in sorted({str(row["candidate"]) for row in rows})}


def _summarize_result(label: str, path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    provenance = dict(payload.get("_provenance", {}))
    rows = list(payload.get("rows", []))
    scored_rows = _scored_rows(payload)
    mc_correction = dict(payload.get("mc_correction", {}))
    simple_baselines = payload.get("mc_correction_simple_baselines", {})
    reference_baselines = payload.get("mc_correction_reference_baselines", {})
    metrics = ["context_pred_mae", "recovery_mae"]

    return {
        "label": label,
        "source_path": str(path),
        "dataset_id": payload.get("dataset_id"),
        "params_version_hash": provenance.get("params_version_hash"),
        "seed_count": provenance.get("seed_count"),
        "n_learners": provenance.get("n_learners"),
        "scored_split": payload.get("scored_split"),
        "archetype_split": provenance.get("archetype_split"),
        "delta_ci_present": _delta_ci_present(mc_correction),
        "candidate_kinds": _candidate_kinds(rows),
        "baseline_bar": {
            metric: _metric_means_by_band(scored_rows, metric) for metric in metrics
        },
        "mc_survivors": _mc_survivors(mc_correction),
        "population_prior": payload.get("population_prior"),
        "mc_correction_simple_baselines": simple_baselines,
        "simple_baseline_mc_survivors": {
            baseline: _mc_survivors(block)
            for baseline, block in simple_baselines.items()
        },
        "mc_correction_reference_baselines": reference_baselines,
        "reference_baseline_mc_survivors": {
            baseline: _mc_survivors(block)
            for baseline, block in reference_baselines.items()
        },
    }


def _format_float(value: Any) -> str:
    if not isinstance(value, int | float) or not math.isfinite(float(value)):
        return "n/a"
    return f"{float(value):.6f}"


def _summary_markdown(evidence: dict[str, Any]) -> str:
    lines = [
        "# A6 Baseline Calibration Evidence",
        "",
        "Every later phase is measured against this baseline bar.",
        "",
        "| run | metric | band | candidate | held-out mean |",
        "|---|---|---|---|---:|",
    ]
    runs = evidence["calibration"]["runs"]
    for label, run in sorted(runs.items()):
        baseline_bar = run["baseline_bar"]
        for metric, by_band in sorted(baseline_bar.items()):
            for band, by_candidate in sorted(by_band.items()):
                for candidate, value in sorted(by_candidate.items()):
                    lines.append(
                        f"| {label} | {metric} | {band} | {candidate} | {_format_float(value)} |"
                    )

    lines.extend(["", "## Multiple-Comparison Survivors", ""])
    for label, run in sorted(runs.items()):
        lines.append(f"### {label}")
        for metric, survivor_block in sorted(run["mc_survivors"].items()):
            wins = survivor_block["holm_surviving_wins"]
            not_win = survivor_block["holm_sig_but_not_win"]
            lines.append(
                f"- `{metric}`: Holm wins={wins or '{}'}; significant not-win={not_win or '{}'}"
            )
        lines.append("")

    reference_runs = [
        (label, run.get("reference_baseline_mc_survivors", {}))
        for label, run in sorted(runs.items())
        if run.get("reference_baseline_mc_survivors")
    ]
    if reference_runs:
        lines.extend(["## Reference-Baseline Survivors", ""])
        for label, reference_blocks in reference_runs:
            lines.append(f"### {label}")
            for baseline, metric_blocks in sorted(reference_blocks.items()):
                lines.append(f"- baseline `{baseline}`:")
                for metric, survivor_block in sorted(metric_blocks.items()):
                    wins = survivor_block["holm_surviving_wins"]
                    not_win = survivor_block["holm_sig_but_not_win"]
                    lines.append(
                        f"  - `{metric}`: Holm wins={wins or '{}'}; "
                        f"significant not-win={not_win or '{}'}"
                    )
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def capture_evidence(
    results: list[tuple[str, Path]],
    *,
    output_dir: Path,
    quiet: bool = False,
) -> CaptureOutputs:
    logger = ProgressLogger(label="capture-evidence", enabled=not quiet)
    output_dir.mkdir(parents=True, exist_ok=True)
    logger.log(0, "capture.start", f"results={len(results)} output={output_dir}")

    runs: dict[str, Any] = {}
    total = max(1, len(results))
    for index, (label, path) in enumerate(results, start=1):
        percent = 5 + (index - 1) / total * 70
        runs[label] = run_with_heartbeat(
            lambda label=label, path=path: _summarize_result(label, path),
            logger=logger,
            percent=percent,
            state="capture.result",
            detail=f"label={label} path={path}",
            heartbeat_seconds=10,
        )
        logger.log(5 + index / total * 70, "capture.result_done", f"label={label}")

    evidence = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "calibration": {"runs": runs},
    }
    evidence_path = output_dir / "evidence.json"
    summary_path = output_dir / "SUMMARY.md"

    logger.log(85, "capture.write", str(evidence_path))
    evidence_path.write_text(
        json.dumps(evidence, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    summary_path.write_text(_summary_markdown(evidence), encoding="utf-8")
    logger.log(100, "capture.complete", str(output_dir))
    return CaptureOutputs(evidence_path=evidence_path, summary_path=summary_path)


def _parse_result_arg(value: str) -> tuple[str, Path]:
    if "=" in value:
        label, raw_path = value.split("=", 1)
        return label, Path(raw_path)
    path = Path(value)
    return path.stem, path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--result",
        action="append",
        default=[],
        help="Result JSON to capture, optionally label=path. Repeatable.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=_repo_root() / "research/doc/verification-runs/2026-06-19-a6-baseline",
    )
    parser.add_argument("--quiet", action="store_true", help="suppress progress output")
    args = parser.parse_args()

    result_args = args.result or [
        str(_repo_root() / "research/results/calibration/calibration_results.json")
    ]
    outputs = capture_evidence(
        [_parse_result_arg(value) for value in result_args],
        output_dir=args.output_dir,
        quiet=args.quiet,
    )
    print(outputs.evidence_path)


if __name__ == "__main__":
    main()
