from __future__ import annotations

import json
import math
from dataclasses import replace
from pathlib import Path
from typing import Any

from research_comparison.generator.generate import (
    DEFAULT_ARCHETYPE_MIX,
    DEFAULT_BANDS,
    generate_dataset,
)
from research_comparison.manifest import Manifest
from research_comparison.metrics.paired import paired_difference
from research_comparison.metrics.rigour import (
    DEFAULT_HELDOUT_TRAIN_ARCHETYPES,
    benjamini_hochberg,
    bootstrap_delta_ci,
    heldout_archetype_split,
    holm_bonferroni,
)
from research_comparison.params import PARAMS_VERSION_HASH
from research_comparison.progress_log import ProgressLogger

DEFAULT_SEED_COUNT = 200
INCUMBENTS = {
    "calibration": "hierarchical_bayes",
    "detection": "cusum",
    "projection": "gp_ard",
    "scheduling": "greedy_incumbent",
}


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def latest_dataset_dir(root: Path) -> Path:
    datasets_root = root / "research/datasets"
    candidates = [path for path in datasets_root.iterdir() if (path / "learners.jsonl").exists()]
    if not candidates:
        raise FileNotFoundError("No generated dataset found under research/datasets")
    return max(candidates, key=lambda path: path.stat().st_mtime)


def dataset_for_seed_count(
    root: Path,
    seed_count: int,
    progress: ProgressLogger | None = None,
) -> Path:
    if seed_count < 1:
        raise ValueError("seed count must be positive")
    n_learners = sum(DEFAULT_ARCHETYPE_MIX.values()) * len(DEFAULT_BANDS) * seed_count
    dataset_id = f"synthetic-{PARAMS_VERSION_HASH}-seed0-n{n_learners}"
    dataset_path = root / "research/datasets" / dataset_id
    required = ["manifest.json", "learners.jsonl", "sidecars.jsonl"]
    if all((dataset_path / name).exists() for name in required):
        if progress:
            progress.log(2, "dataset.reuse", f"dataset={dataset_path}")
        return dataset_path

    if progress:
        progress.log(1, "dataset.generate", f"seeds={seed_count} learners={n_learners}")
    generated_id = generate_dataset(
        seeds=list(range(seed_count)),
        out_dir=str(root / "research/datasets"),
        progress=progress,
    )
    return root / "research/datasets" / generated_id


def resolve_dataset_dir(
    root: Path,
    dataset_dir: str | None,
    seed_count: int | None,
    progress: ProgressLogger | None = None,
) -> Path:
    if dataset_dir:
        return Path(dataset_dir)
    if seed_count is None:
        return latest_dataset_dir(root)
    return dataset_for_seed_count(root, seed_count, progress=progress)


def archetype_split_for_rows(
    rows: list[dict[str, Any]],
    archetypes: set[str] | None = None,
) -> dict[str, list[str]]:
    archetypes = archetypes or {str(row["archetype"]) for row in rows}
    try:
        train, held_out = heldout_archetype_split(archetypes)
    except ValueError:
        train = set(archetypes) & set(DEFAULT_HELDOUT_TRAIN_ARCHETYPES)
        if not train:
            train = set(archetypes)
        held_out = set(archetypes) - train
    return {"train": sorted(train), "held_out": sorted(held_out)}


def annotate_archetype_split(
    rows: list[dict[str, Any]],
    archetypes: set[str] | None = None,
) -> dict[str, list[str]]:
    split = archetype_split_for_rows(rows, archetypes=archetypes)
    train = set(split["train"])
    for row in rows:
        row["split"] = "train" if str(row["archetype"]) in train else "held_out"
    return split


def heldout_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in rows if row.get("split") == "held_out"]


def reporting_rows(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str]:
    selected = heldout_rows(rows)
    if selected:
        return selected, "held_out"
    return rows, "all"


def attach_rigour_provenance(
    manifest: Manifest,
    raw_manifest: dict[str, Any],
    rows: list[dict[str, Any]],
    archetypes: set[str] | None = None,
) -> Manifest:
    seed_count = len(raw_manifest.get("seeds", [])) or None
    bands = list(raw_manifest.get("bands", [])) or None
    n_archetypes = sum(dict(raw_manifest["archetype_mix"]).values())
    n_bands = len(bands or [])
    formula = (
        f"{n_archetypes} archetypes x {n_bands} bands x {seed_count} seeds"
        if seed_count is not None and n_bands
        else None
    )
    return replace(
        manifest,
        seed_count=seed_count,
        bands=bands,
        n_learners_formula=formula,
        archetype_split=archetype_split_for_rows(rows, archetypes=archetypes),
    )


def paired_metric_result(
    challenger: list[float],
    baseline: list[float],
    *,
    n_boot: int = 10000,
    seed: int = 0,
) -> dict[str, float]:
    result = paired_difference(challenger, baseline)
    deltas = [
        challenger_value - baseline_value
        for challenger_value, baseline_value in zip(challenger, baseline, strict=True)
    ]
    ci_low, ci_high, _point = bootstrap_delta_ci(deltas, n_boot=n_boot, seed=seed)
    result["delta_ci_low"] = ci_low
    result["delta_ci_high"] = ci_high
    return result


def _cell_key(row: dict[str, Any], fields: list[str]) -> tuple[Any, ...]:
    return tuple(row[field] for field in fields)


def paired_by_group(
    rows: list[dict[str, Any]],
    *,
    metric: str,
    baseline_candidate: str,
    group_fields: list[str],
    pair_fields: list[str] | None = None,
) -> dict[str, dict[str, dict[str, float]]]:
    pair_fields = pair_fields or ["seed"]
    values: dict[tuple[Any, ...], list[float]] = {}
    for row in rows:
        key = (
            *_cell_key(row, group_fields),
            *_cell_key(row, pair_fields),
            row["candidate"],
        )
        values.setdefault(key, []).append(float(row[metric]))

    groups = sorted({_cell_key(row, group_fields) for row in rows})
    candidates = sorted(
        {row["candidate"] for row in rows if row["candidate"] != baseline_candidate}
    )
    paired: dict[str, dict[str, dict[str, float]]] = {}
    for group in groups:
        group_key = "|".join(
            f"{field}={value}" for field, value in zip(group_fields, group, strict=True)
        )
        pair_keys = sorted(
            {_cell_key(row, pair_fields) for row in rows if _cell_key(row, group_fields) == group}
        )
        paired[group_key] = {}
        for candidate in candidates:
            challenger: list[float] = []
            baseline: list[float] = []
            for pair_key in pair_keys:
                baseline_key = (*group, *pair_key, baseline_candidate)
                challenger_key = (*group, *pair_key, candidate)
                if baseline_key not in values or challenger_key not in values:
                    continue
                baseline.append(float(sum(values[baseline_key]) / len(values[baseline_key])))
                challenger.append(float(sum(values[challenger_key]) / len(values[challenger_key])))
            if challenger and len(challenger) == len(baseline):
                paired[group_key][str(candidate)] = paired_metric_result(challenger, baseline)
    return {key: value for key, value in paired.items() if value}


def _improved(delta: float) -> bool:
    return math.isfinite(delta) and delta < 0.0


def mc_correction_block(
    paired: dict[str, dict[str, dict[str, float]]],
    *,
    metric: str,
    baseline_candidate: str,
    alpha: float = 0.05,
    q: float = 0.05,
) -> dict[str, Any]:
    comparisons: list[dict[str, Any]] = []
    pvalues: list[float] = []
    for cell, by_candidate in sorted(paired.items()):
        for candidate, result in sorted(by_candidate.items()):
            p_value = float(result.get("p_value", math.nan))
            comparisons.append(
                {
                    "cell": cell,
                    "candidate": candidate,
                    "delta": float(result.get("delta", math.nan)),
                    "p_value": p_value,
                    "effect_size": float(result.get("effect_size", math.nan)),
                    "delta_ci_low": float(result.get("delta_ci_low", math.nan)),
                    "delta_ci_high": float(result.get("delta_ci_high", math.nan)),
                }
            )
            pvalues.append(p_value)

    holm = holm_bonferroni(pvalues, alpha=alpha)
    bh = benjamini_hochberg(pvalues, q=q)
    for comparison, holm_reject, bh_reject in zip(comparisons, holm, bh, strict=True):
        comparison["holm_significant"] = bool(holm_reject)
        comparison["bh_significant"] = bool(bh_reject)
        comparison["survives_holm_win"] = bool(holm_reject and _improved(comparison["delta"]))
        comparison["survives_bh_win"] = bool(bh_reject and _improved(comparison["delta"]))

    return {
        "metric": metric,
        "baseline_candidate": baseline_candidate,
        "primary": "holm_bonferroni",
        "reported": "benjamini_hochberg",
        "alpha": alpha,
        "q": q,
        "comparisons": comparisons,
    }
