#!/usr/bin/env python3
"""Extract compact paper evidence from large research result JSON files.

The research JSON files contain large row-level arrays. This script scans only
top-level JSON keys and materializes the selected summary sections needed for
the journal paper.
"""

from __future__ import annotations

import argparse
import json
import math
import mmap
import statistics
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[4]
RESULTS_ROOT = REPO_ROOT / "research" / "results"
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "paper_results_extract.md"

RESULT_FILES = {
    "calibration_frozen": RESULTS_ROOT / "calibration" / "calibration_results.json",
    "calibration_decoupled": RESULTS_ROOT
    / "calibration_decoupled"
    / "calibration_results.json",
    "detection_frozen": RESULTS_ROOT / "detection" / "detection_results.json",
    "detection_decoupled": RESULTS_ROOT
    / "detection_decoupled"
    / "detection_results.json",
    "projection_frozen": RESULTS_ROOT / "projection" / "projection_results.json",
    "projection_decoupled": RESULTS_ROOT
    / "projection_decoupled"
    / "projection_results.json",
    "scheduling": RESULTS_ROOT / "scheduling" / "scheduling_results.json",
}

DATASET_FILES = {
    "frozen": {
        "manifest": REPO_ROOT
        / "research"
        / "datasets"
        / "synthetic-21c2cdabfa91-seed0-n5400"
        / "manifest.json",
        "learners": REPO_ROOT
        / "research"
        / "datasets"
        / "synthetic-21c2cdabfa91-seed0-n5400"
        / "learners.jsonl",
    },
    "decoupled": {
        "manifest": REPO_ROOT
        / "research"
        / "datasets"
        / "synthetic-decoupled-9e6d48db2da8-seed0-n5400"
        / "manifest.json",
        "learners": REPO_ROOT
        / "research"
        / "datasets"
        / "synthetic-decoupled-9e6d48db2da8-seed0-n5400"
        / "learners.jsonl",
    },
    "scheduling": {
        "manifest": REPO_ROOT
        / "research"
        / "datasets"
        / "synthetic-reality-3b404c903563-seed0-n3600"
        / "manifest.json",
        "learners": REPO_ROOT
        / "research"
        / "datasets"
        / "synthetic-reality-3b404c903563-seed0-n3600"
        / "learners.jsonl",
    },
}

SELECTED_KEYS = {
    "calibration_frozen": {
        "_provenance",
        "dataset_id",
        "scored_split",
        "context_pred_winner_per_band",
        "winner_per_band",
        "paired_vs_incumbent",
        "mc_correction",
    },
    "calibration_decoupled": {
        "_provenance",
        "dataset_id",
        "scored_split",
        "context_pred_winner_per_band",
        "winner_per_band",
        "paired_vs_incumbent",
        "mc_correction",
    },
    "detection_frozen": {
        "_provenance",
        "dataset_id",
        "scored_split",
        "winner_by_shift_type",
        "cusum_tuning",
        "paired_vs_incumbent",
        "mc_correction",
        "pareto_frontier",
    },
    "detection_decoupled": {
        "_provenance",
        "dataset_id",
        "scored_split",
        "winner_by_shift_type",
        "cusum_tuning",
        "paired_vs_incumbent",
        "mc_correction",
        "pareto_frontier",
    },
    "projection_frozen": {
        "_provenance",
        "dataset_id",
        "scored_split",
        "winner_by_band",
        "conformal_calibration",
        "cold_start_eval",
        "paired_vs_incumbent",
        "mc_correction",
    },
    "projection_decoupled": {
        "_provenance",
        "dataset_id",
        "scored_split",
        "winner_by_band",
        "conformal_calibration",
        "cold_start_eval",
        "paired_vs_incumbent",
        "mc_correction",
    },
    "scheduling": {
        "_provenance",
        "dataset_id",
        "scored_split",
        "winner_by_material_mix",
        "prereq_order_summary",
        "paired_vs_incumbent",
        "mc_correction",
    },
}

BAND_ORDER = ["small", "medium", "max"]
SHIFT_ORDER = ["step", "drift"]

CALIBRATION_ABLATION_ROWS = [
    ("sma", "SMA window 8", "none", "none", "no"),
    ("ewma", "EWMA alpha 0.35", "none", "prior start", "no"),
    ("pooled_bayes", "pooled Bayes", "none", "Bayesian prior", "no"),
    ("hierarchical_bayes", "hierarchical Bayes", "none", "hierarchical prior", "no"),
    ("covariate_bayes", "ridge context model", "role/time/day", "ridge", "no"),
    ("eb_partial_pool", "context partial pooling", "role/time/day", "empirical Bayes", "no"),
    ("enriched_shrink", "10-feature shrinkage", "10 features", "population prior", "no"),
    ("enriched_dual_prior", "dual-prior ensemble", "10 features", "dual priors", "yes"),
]


class JsonScanError(RuntimeError):
    """Raised when a top-level JSON scan cannot proceed safely."""


def skip_ws(mm: mmap.mmap, index: int) -> int:
    size = len(mm)
    while index < size and mm[index] in b" \n\r\t":
        index += 1
    return index


def parse_json_string(mm: mmap.mmap, index: int) -> tuple[str, int]:
    if index >= len(mm) or mm[index] != ord('"'):
        raise JsonScanError(f"Expected JSON string at byte {index}")

    pos = index + 1
    escaped = False
    while pos < len(mm):
        char = mm[pos]
        if escaped:
            escaped = False
        elif char == ord("\\"):
            escaped = True
        elif char == ord('"'):
            raw = mm[index : pos + 1].decode("utf-8")
            return json.loads(raw), pos + 1
        pos += 1

    raise JsonScanError(f"Unterminated JSON string at byte {index}")


def scan_value(mm: mmap.mmap, index: int) -> tuple[int, int]:
    """Return byte start and end for a JSON value without consuming delimiter."""

    start = index
    pos = index
    depth = 0
    in_string = False
    escaped = False
    size = len(mm)

    while pos < size:
        char = mm[pos]

        if in_string:
            if escaped:
                escaped = False
            elif char == ord("\\"):
                escaped = True
            elif char == ord('"'):
                in_string = False
            pos += 1
            continue

        if char == ord('"'):
            in_string = True
            pos += 1
            continue

        if char in (ord("{"), ord("[")):
            depth += 1
            pos += 1
            continue

        if char in (ord("}"), ord("]")):
            if depth == 0:
                return start, pos
            depth -= 1
            pos += 1
            if depth == 0:
                return start, pos
            continue

        if depth == 0 and char in (ord(","), ord("}")):
            return start, pos

        pos += 1

    return start, pos


def load_top_level_keys(path: Path, keys: set[str]) -> dict[str, Any]:
    """Load selected top-level keys from a JSON object using an mmap scanner."""

    selected: dict[str, Any] = {}
    with path.open("rb") as handle:
        with mmap.mmap(handle.fileno(), length=0, access=mmap.ACCESS_READ) as mm:
            pos = skip_ws(mm, 0)
            if pos >= len(mm) or mm[pos] != ord("{"):
                raise JsonScanError(f"{path} does not start with a JSON object")
            pos += 1

            while True:
                pos = skip_ws(mm, pos)
                if pos >= len(mm):
                    break
                if mm[pos] == ord("}"):
                    break

                key, pos = parse_json_string(mm, pos)
                pos = skip_ws(mm, pos)
                if pos >= len(mm) or mm[pos] != ord(":"):
                    raise JsonScanError(f"Expected ':' after key {key!r} in {path}")
                pos = skip_ws(mm, pos + 1)

                value_start, value_end = scan_value(mm, pos)
                if key in keys:
                    raw = mm[value_start:value_end].decode("utf-8").strip()
                    selected[key] = json.loads(raw)

                pos = skip_ws(mm, value_end)
                if pos < len(mm) and mm[pos] == ord(","):
                    pos += 1
                    continue
                if pos < len(mm) and mm[pos] == ord("}"):
                    break
                if pos >= len(mm):
                    break
                raise JsonScanError(f"Unexpected byte {mm[pos]!r} after key {key!r}")

    return selected


def summarize_learners_jsonl(path: Path) -> dict[str, Any]:
    session_counts: list[int] = []
    ad_hoc_sessions = 0
    interrupted_sessions = 0

    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            sessions = record.get("sessions") or []
            session_counts.append(len(sessions))
            for session in sessions:
                if session.get("isAdHoc"):
                    ad_hoc_sessions += 1
                if session.get("resolution") == "interrupted":
                    interrupted_sessions += 1

    return {
        "learner_rows": len(session_counts),
        "sessions_total": sum(session_counts),
        "sessions_min": min(session_counts) if session_counts else None,
        "sessions_median": statistics.median(session_counts) if session_counts else None,
        "sessions_max": max(session_counts) if session_counts else None,
        "ad_hoc_sessions": ad_hoc_sessions,
        "interrupted_sessions": interrupted_sessions,
    }


def load_dataset_summaries(repo_root: Path) -> dict[str, dict[str, Any]]:
    dataset_files = {
        key: {
            name: Path(str(path).replace(str(REPO_ROOT), str(repo_root)))
            for name, path in paths.items()
        }
        for key, paths in DATASET_FILES.items()
    }
    summaries: dict[str, dict[str, Any]] = {}
    for label, paths in dataset_files.items():
        manifest = json.loads(paths["manifest"].read_text(encoding="utf-8"))
        summary = summarize_learners_jsonl(paths["learners"])
        summary.update(
            {
                "dataset_id": manifest.get("dataset_id"),
                "generator_regime": manifest.get("generator_regime"),
                "generator_version": manifest.get("generator_version"),
                "seed_count": manifest.get("seed_count"),
                "n_learners": manifest.get("n_learners"),
                "n_learners_formula": manifest.get("n_learners_formula"),
                "bands": ",".join(manifest.get("bands", [])),
                "archetypes": ",".join(sorted((manifest.get("archetype_mix") or {}).keys())),
                "moment_bounds": manifest.get("moment_bounds"),
            }
        )
        summaries[label] = summary
    return summaries


def fmt(value: Any, digits: int = 4) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and math.isinf(value):
            return "inf"
        if isinstance(value, float) and math.isnan(value):
            return "nan"
        if isinstance(value, int):
            return str(value)
        return f"{value:.{digits}f}".rstrip("0").rstrip(".")
    return json.dumps(value, sort_keys=True)


def pct(value: Any, digits: int = 1) -> str:
    if not isinstance(value, (int, float)) or math.isinf(value) or math.isnan(value):
        return fmt(value)
    return f"{value * 100:.{digits}f}%"


def md_table(headers: list[str], rows: list[list[Any]]) -> list[str]:
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(["---"] * len(headers)) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(str(cell) for cell in row) + " |")
    return lines


def nested_get(data: dict[str, Any], path: list[str], default: Any = None) -> Any:
    current: Any = data
    for key in path:
        if not isinstance(current, dict) or key not in current:
            return default
        current = current[key]
    return current


def comparison_counts(mc_correction: dict[str, Any], metric: str, candidate: str) -> str:
    metric_block = mc_correction.get(metric, {})
    comparisons = metric_block.get("comparisons", [])
    if not isinstance(comparisons, list):
        return ""

    selected = [
        item
        for item in comparisons
        if isinstance(item, dict) and item.get("candidate") == candidate
    ]
    if not selected:
        return ""

    holm_wins = sum(1 for item in selected if item.get("survives_holm_win"))
    bh_wins = sum(1 for item in selected if item.get("survives_bh_win"))
    return f"Holm {holm_wins}/{len(selected)}, BH {bh_wins}/{len(selected)}"


def append_config_section(
    lines: list[str],
    data: dict[str, dict[str, Any]],
    dataset_summaries: dict[str, dict[str, Any]],
) -> None:
    rows: list[list[Any]] = []
    for label, summary in dataset_summaries.items():
        rows.append(
            [
                label,
                summary.get("dataset_id", ""),
                summary.get("generator_regime", ""),
                summary.get("seed_count", ""),
                summary.get("n_learners", ""),
                summary.get("sessions_total", ""),
                f"{fmt(summary.get('sessions_min'))}/{fmt(summary.get('sessions_median'))}/{fmt(summary.get('sessions_max'))}",
                summary.get("bands", ""),
                str(summary.get("archetypes", "")).replace(",", ", "),
                summary.get("ad_hoc_sessions", ""),
                summary.get("interrupted_sessions", ""),
            ]
        )

    lines.extend(["## Experiment configuration", ""])
    lines.extend(
        md_table(
            [
                "source",
                "dataset_id",
                "regime",
                "seeds",
                "learners",
                "sessions",
                "sessions min/median/max",
                "bands",
                "archetypes",
                "ad hoc sessions",
                "interrupted sessions",
            ],
            rows,
        )
    )
    lines.append("")

    moment_bounds = nested_get(dataset_summaries, ["decoupled", "moment_bounds"]) or nested_get(
        dataset_summaries, ["frozen", "moment_bounds"]
    ) or nested_get(
        dataset_summaries, ["scheduling", "moment_bounds"]
    )
    if moment_bounds:
        source = moment_bounds.get("source", {})
        bounds = moment_bounds.get("bounds", {})
        lines.extend(["OULAD calibration source:", ""])
        lines.extend(
            md_table(
                ["field", "value"],
                [
                    ["dataset", source.get("dataset", "")],
                    ["license", source.get("license", "")],
                    ["rows seen", source.get("rows_seen", "")],
                    ["rows kept", source.get("rows_kept", "")],
                    ["usable series", source.get("usable_series", "")],
                    ["proxy mapping", moment_bounds.get("proxy_mapping", "")],
                    ["gap days p50/p75/p90/p95", json.dumps(bounds.get("gap_days", {}), sort_keys=True)],
                    [
                        "dropout probability low/high",
                        json.dumps(bounds.get("dropout_probability", {}), sort_keys=True),
                    ],
                    [
                        "shift frequency per 100 days low/high",
                        json.dumps(bounds.get("shift_frequency_per_100_days", {}), sort_keys=True),
                    ],
                ],
            )
        )
        lines.append("")


def append_calibration_section(lines: list[str], data: dict[str, dict[str, Any]]) -> None:
    candidates = ["hierarchical_bayes", "enriched_shrink", "enriched_dual_prior"]
    rows: list[list[Any]] = []
    for label in ["calibration_frozen", "calibration_decoupled"]:
        payload = data[label]
        winners = payload.get("context_pred_winner_per_band") or {}
        paired = payload.get("paired_vs_incumbent") or {}
        mc = payload.get("mc_correction") or {}
        for band in BAND_ORDER:
            band_block = winners.get(band) or {}
            band_candidates = band_block.get("candidates") or {}
            paired_band = paired.get(band) or {}
            for candidate in candidates:
                candidate_block = band_candidates.get(candidate) or {}
                paired_block = paired_band.get(candidate) or {}
                ci_low = paired_block.get("context_pred_mae_delta_ci_low")
                ci_high = paired_block.get("context_pred_mae_delta_ci_high")
                rows.append(
                    [
                        label,
                        band,
                        candidate,
                        fmt(candidate_block.get("mean"), 5),
                        fmt(paired_block.get("context_pred_mae_delta"), 5),
                        f"[{fmt(ci_low, 5)}, {fmt(ci_high, 5)}]"
                        if ci_low is not None or ci_high is not None
                        else "",
                        comparison_counts(mc, "context_pred_mae", candidate),
                    ]
                )

    lines.extend(["## Calibration context prediction", ""])
    lines.extend(
        md_table(
            [
                "source",
                "band",
                "candidate",
                "mean context_pred_mae",
                "delta vs incumbent",
                "CI",
                "multiplicity wins",
            ],
            rows,
        )
    )
    lines.append("")


def append_calibration_ablation_section(
    lines: list[str],
    data: dict[str, dict[str, Any]],
) -> None:
    winners = nested_get(
        data,
        ["calibration_decoupled", "context_pred_winner_per_band"],
        {},
    )
    rows: list[list[Any]] = []
    for candidate, role, context, prior, ensemble in CALIBRATION_ABLATION_ROWS:
        means = [
            fmt(
                nested_get(
                    winners,
                    [band, "candidates", candidate, "mean"],
                ),
                5,
            )
            for band in BAND_ORDER
        ]
        rows.append([candidate, role, context, prior, ensemble, *means])

    lines.extend(["## Calibration ablation-style comparison", ""])
    lines.append("Decoupled prospective context-prediction error; lower is better.")
    lines.append(
        "This is a candidate-family comparison rather than a strict causal ablation."
    )
    lines.append("")
    lines.extend(
        md_table(
            [
                "candidate",
                "model role",
                "context",
                "prior or pooling",
                "ensemble",
                "small",
                "medium",
                "max",
            ],
            rows,
        )
    )
    lines.append("")


def append_detection_section(lines: list[str], data: dict[str, dict[str, Any]]) -> None:
    rows: list[list[Any]] = []
    for label in ["detection_frozen", "detection_decoupled"]:
        payload = data[label]
        winners = payload.get("winner_by_shift_type") or {}
        for shift_type in SHIFT_ORDER:
            shift_block = winners.get(shift_type) or {}
            winner = shift_block.get("winner")
            candidates = shift_block.get("candidates") or {}
            for candidate, metrics in sorted(candidates.items()):
                rows.append(
                    [
                        label,
                        shift_type,
                        candidate,
                        "yes" if candidate == winner else "",
                        fmt(metrics.get("mean_latency"), 3),
                        pct(metrics.get("false_alarm_rate"), 2),
                        fmt(metrics.get("missed")),
                        fmt(metrics.get("score"), 3),
                    ]
                )

    lines.extend(["## Concept drift detection", ""])
    lines.extend(
        md_table(
            [
                "source",
                "shift",
                "candidate",
                "winner",
                "mean latency",
                "false alarms",
                "missed",
                "score",
            ],
            rows,
        )
    )
    lines.append("")

    tuning = nested_get(data, ["detection_decoupled", "cusum_tuning"], {})
    if tuning:
        selected = tuning.get("selected") or {}
        lines.extend(["Decoupled CUSUM tuning:", ""])
        lines.extend(
            md_table(
                ["method", "train archetypes", "selected parameters"],
                [
                    [
                        tuning.get("method", ""),
                        ",".join(tuning.get("train_archetypes", [])),
                        json.dumps(selected, sort_keys=True),
                    ]
                ],
            )
        )
        lines.append("")


def append_projection_section(lines: list[str], data: dict[str, dict[str, Any]]) -> None:
    rows: list[list[Any]] = []
    for label in ["projection_frozen", "projection_decoupled"]:
        payload = data[label]
        winners = payload.get("winner_by_band") or {}
        paired = payload.get("paired_vs_incumbent") or {}
        for band in BAND_ORDER:
            band_block = winners.get(band) or {}
            winner = band_block.get("winner")
            candidates = band_block.get("candidates") or {}
            paired_band = paired.get(f"band={band}") or paired.get(band) or {}
            for candidate, metrics in sorted(candidates.items()):
                paired_block = paired_band.get(candidate) or {}
                rows.append(
                    [
                        label,
                        band,
                        candidate,
                        "yes" if candidate == winner else "",
                        pct(metrics.get("coverage"), 2),
                        fmt(metrics.get("mean_abs_error_days"), 3),
                        fmt(metrics.get("mean_sharpness_days"), 3),
                        fmt(metrics.get("score"), 3),
                        fmt(paired_block.get("delta"), 3),
                    ]
                )

    lines.extend(["## Projection and interval calibration", ""])
    lines.extend(
        md_table(
            [
                "source",
                "band",
                "candidate",
                "score winner",
                "coverage",
                "MAE",
                "sharpness",
                "score",
                "MAE delta vs incumbent",
            ],
            rows,
        )
    )
    lines.append("")

    calibration = nested_get(data, ["projection_decoupled", "conformal_calibration"], {})
    if calibration:
        lines.extend(["Decoupled conformal calibration:", ""])
        lines.extend(
            md_table(
                ["alpha", "method", "residual unit", "train archetypes", "widths by band"],
                [
                    [
                        fmt(calibration.get("alpha")),
                        calibration.get("method", ""),
                        calibration.get("residual_unit", ""),
                        ",".join(calibration.get("train_archetypes", [])),
                        json.dumps(calibration.get("width_days_by_band", {}), sort_keys=True),
                    ]
                ],
            )
        )
        lines.append("")

    cold_start = nested_get(data, ["projection_decoupled", "cold_start_eval"], {})
    if cold_start:
        rows = []
        metrics_by_band = cold_start.get("by_band") or cold_start.get("metrics_by_band") or {}
        for band in BAND_ORDER:
            band_metrics = metrics_by_band.get(band) or {}
            for candidate, metrics in sorted(band_metrics.items()):
                rows.append(
                    [
                        band,
                        candidate,
                        pct(metrics.get("coverage"), 2),
                        fmt(metrics.get("mean_abs_error_days"), 3),
                        fmt(metrics.get("mean_sharpness_days"), 3),
                        fmt(metrics.get("n_forecasts") or metrics.get("n")),
                    ]
                )
        lines.extend(["Decoupled cold-start projection check:", ""])
        lines.extend(
            md_table(["band", "candidate", "coverage", "MAE", "sharpness", "n"], rows)
        )
        lines.append("")


def append_scheduling_section(lines: list[str], data: dict[str, dict[str, Any]]) -> None:
    payload = data["scheduling"]
    winners = payload.get("winner_by_material_mix") or {}
    paired = payload.get("paired_vs_incumbent") or {}
    rows: list[list[Any]] = []
    for material_mix, mix_block in sorted(winners.items()):
        if not isinstance(mix_block, dict):
            continue
        winner = mix_block.get("winner")
        candidates = mix_block.get("candidates") or {}
        paired_mix = paired.get(f"material_mix={material_mix}") or paired.get(material_mix) or {}
        for candidate, metrics in sorted(candidates.items()):
            paired_block = paired_mix.get(candidate) or {}
            rows.append(
                [
                    material_mix,
                    candidate,
                    "yes" if candidate == winner else "",
                    fmt(metrics.get("mean_abs_deadline_drift_days"), 3),
                    pct(metrics.get("capacity_violation_rate"), 2),
                    fmt(metrics.get("prereq_order_correctness"), 3),
                    fmt(metrics.get("score"), 3),
                    fmt(paired_block.get("delta"), 3),
                ]
            )

    lines.extend(["## Scheduling optimizer", ""])
    if rows:
        lines.extend(
            md_table(
                [
                    "material mix",
                    "candidate",
                    "winner",
                    "mean abs deadline drift days",
                    "capacity violations",
                    "prereq order correctness",
                    "score",
                    "score delta vs incumbent",
                ],
                rows,
            )
        )
    else:
        lines.append("No winner_by_material_mix candidate rows were found.")
    lines.append("")

    prereq = payload.get("prereq_order_summary") or {}
    if prereq:
        lines.extend(["Prerequisite ordering summary:", ""])
        lines.extend(md_table(["field", "value"], [[key, fmt(value)] for key, value in prereq.items()]))
        lines.append("")


def build_markdown(
    data: dict[str, dict[str, Any]],
    dataset_summaries: dict[str, dict[str, Any]],
) -> str:
    lines = [
        "# Paper Result Extract",
        "",
        "Produced by `extract_paper_results.py` from compact top-level JSON sections.",
        "Large row-level arrays such as `rows` and `forecasts` are not materialized.",
        "",
    ]
    append_config_section(lines, data, dataset_summaries)
    append_calibration_section(lines, data)
    append_calibration_ablation_section(lines, data)
    append_detection_section(lines, data)
    append_projection_section(lines, data)
    append_scheduling_section(lines, data)
    return "\n".join(lines).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract paper-ready summaries from large research JSON files."
    )
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=REPO_ROOT,
        help="Repository root. Defaults to the root inferred from this script path.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Markdown output path.",
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        default=None,
        help="Optional compact JSON output path for the selected sections.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    results_root = args.repo_root / "research" / "results"
    result_files = {
        key: Path(str(path).replace(str(RESULTS_ROOT), str(results_root)))
        for key, path in RESULT_FILES.items()
    }

    extracted: dict[str, dict[str, Any]] = {}
    for label, path in result_files.items():
        if not path.exists():
            raise FileNotFoundError(f"Missing result file for {label}: {path}")
        extracted[label] = load_top_level_keys(path, SELECTED_KEYS[label])

    dataset_summaries = load_dataset_summaries(args.repo_root)
    markdown = build_markdown(extracted, dataset_summaries)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(markdown, encoding="utf-8")

    if args.json_output is not None:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(
            json.dumps(extracted, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )

    print(f"Wrote {args.output}")
    if args.json_output is not None:
        print(f"Wrote {args.json_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
