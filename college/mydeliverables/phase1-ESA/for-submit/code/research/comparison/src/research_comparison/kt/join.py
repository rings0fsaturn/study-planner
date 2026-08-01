from __future__ import annotations

import argparse
import json
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

from research_comparison.kt.progress_log import ProgressLogger
from research_comparison.plots.kt_coldstart import write_kt_plots
from research_comparison.writers.tables import write_kt_auc_table, write_kt_ece_table

DEFAULT_DATASETS = ["nips2020", "accoding"]
DEFAULT_MODELS = ["pybkt", "dkt", "akt", "deep_irt", "sakt", "dkt_clst_config"]
DEFAULT_FOLDS = [0, 1, 2, 3, 4]
DEFAULT_K_VALUES: list[str | int] = ["full", 3, 5, 10, 20]


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _model_registry_path() -> Path:
    return _repo_root() / "research/kt-bench/model_registry.json"


def load_reportable_allowlist(registry_path: Path | None = None) -> list[dict[str, str]]:
    path = registry_path or _model_registry_path()
    registry = json.loads(path.read_text(encoding="utf-8"))
    return [
        {"dataset": str(item["dataset"]), "model": str(item["model"]), "status": str(item["status"])}
        for item in registry.get("reportable_allowlist", [])
        if item.get("status") == "credible"
    ]


def _result_sort_key(row: dict[str, Any]) -> tuple[str, str, int, str]:
    return (str(row["dataset"]), str(row["model"]), int(row["fold"]), str(row["k"]))


def load_result_rows(results_dir: Path) -> list[dict[str, Any]]:
    rows = []
    for path in sorted(results_dir.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        if {"dataset", "model", "fold", "k"}.issubset(payload):
            rows.append(payload)
    return sorted(rows, key=_result_sort_key)


def expected_calibration_error(
    *,
    y_true: Iterable[int],
    y_score: Iterable[float],
    n_bins: int = 10,
) -> tuple[float, list[dict[str, float | int]]]:
    truth = [int(value) for value in y_true]
    scores = [float(value) for value in y_score]
    if len(truth) != len(scores):
        raise ValueError("y_true and y_score must have the same length")
    if not truth:
        raise ValueError("ECE requires at least one prediction")

    bins: list[dict[str, float | int]] = []
    ece = 0.0
    total = len(truth)
    for index in range(n_bins):
        lower = index / n_bins
        upper = (index + 1) / n_bins
        selected = [
            (actual, score)
            for actual, score in zip(truth, scores)
            if (score >= lower and (score < upper or index == n_bins - 1))
        ]
        if selected:
            count = len(selected)
            accuracy = sum(actual for actual, _ in selected) / count
            confidence = sum(score for _, score in selected) / count
            ece += (count / total) * abs(accuracy - confidence)
        else:
            count = 0
            accuracy = 0.0
            confidence = 0.0
        bins.append(
            {
                "lower": round(lower, 6),
                "upper": round(upper, 6),
                "count": count,
                "accuracy": round(accuracy, 6),
                "confidence": round(confidence, 6),
            }
        )
    return ece, bins


def _mean_by(rows: list[dict[str, Any]], key: str) -> dict[str, dict[str, float]]:
    grouped: dict[tuple[str, str], list[float]] = defaultdict(list)
    for row in rows:
        if key in row:
            grouped[(str(row["dataset"]), str(row["model"]))].append(float(row[key]))

    out: dict[str, dict[str, float]] = defaultdict(dict)
    for (dataset, model), values in grouped.items():
        out[dataset][model] = statistics.fmean(values)
    return {dataset: dict(models) for dataset, models in sorted(out.items())}


def _coldstart_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str, int], list[float]] = defaultdict(list)
    for row in rows:
        k = row["k"]
        if k == "full" or k == "ece":
            continue
        grouped[(str(row["dataset"]), str(row["model"]), int(k))].append(float(row["auc"]))

    return [
        {"dataset": dataset, "model": model, "k": k, "auc": statistics.fmean(values)}
        for (dataset, model, k), values in sorted(grouped.items())
    ]


def _gaps(
    rows: list[dict[str, Any]],
    *,
    expected_datasets: Iterable[str],
    expected_models: Iterable[str],
    expected_folds: Iterable[int],
    expected_k_values: Iterable[str | int],
    expected_pairs: Iterable[tuple[str, str]] | None = None,
) -> list[dict[str, Any]]:
    present = {
        (str(row["dataset"]), str(row["model"]), int(row["fold"]), row["k"])
        for row in rows
        if row["k"] != "ece"
    }
    missing = []
    pairs = (
        [(str(dataset), str(model)) for dataset, model in expected_pairs]
        if expected_pairs is not None
        else [
            (str(dataset), str(model))
            for dataset in expected_datasets
            for model in expected_models
        ]
    )
    for dataset, model in pairs:
        for fold in expected_folds:
            for k in expected_k_values:
                if (dataset, model, fold, k) not in present:
                    missing.append({"dataset": dataset, "model": model, "fold": fold, "k": k})
    return missing


def _filter_expected_rows(
    rows: list[dict[str, Any]],
    *,
    expected_datasets: Iterable[str],
    expected_models: Iterable[str],
    expected_folds: Iterable[int],
    expected_k_values: Iterable[str | int],
    expected_pairs: Iterable[tuple[str, str]] | None = None,
) -> list[dict[str, Any]]:
    datasets = {str(value) for value in expected_datasets}
    models = {str(value) for value in expected_models}
    folds = {int(value) for value in expected_folds}
    k_values = set(expected_k_values)
    pairs = (
        {(str(dataset), str(model)) for dataset, model in expected_pairs}
        if expected_pairs is not None
        else None
    )
    return [
        row
        for row in rows
        if str(row["dataset"]) in datasets
        and str(row["model"]) in models
        and (pairs is None or (str(row["dataset"]), str(row["model"])) in pairs)
        and int(row["fold"]) in folds
        and (row["k"] in k_values or row["k"] == "ece")
    ]


def join_kt_results(
    results_dir: Path,
    *,
    expected_datasets: Iterable[str] = DEFAULT_DATASETS,
    expected_models: Iterable[str] = DEFAULT_MODELS,
    expected_folds: Iterable[int] = DEFAULT_FOLDS,
    expected_k_values: Iterable[str | int] = DEFAULT_K_VALUES,
    expected_pairs: Iterable[tuple[str, str]] | None = None,
) -> dict[str, Any]:
    expected_pairs_list = (
        None
        if expected_pairs is None
        else [(str(dataset), str(model)) for dataset, model in expected_pairs]
    )
    rows = _filter_expected_rows(
        load_result_rows(results_dir),
        expected_datasets=expected_datasets,
        expected_models=expected_models,
        expected_folds=expected_folds,
        expected_k_values=expected_k_values,
        expected_pairs=expected_pairs_list,
    )
    full_rows = [row for row in rows if row["k"] == "full"]
    ece_rows = [row for row in rows if row["k"] == "ece"]
    raw_sources = sorted(
        {
            str(row.get("_provenance", {}).get("folds_raw_source"))
            for row in rows
            if row.get("_provenance", {}).get("folds_raw_source")
        }
    )
    return {
        "full_seq_auc": _mean_by(full_rows, "auc"),
        "coldstart_auc": _coldstart_rows(rows),
        "ece": _mean_by(ece_rows, "ece"),
        "reliability": [
            {
                "dataset": row["dataset"],
                "model": row["model"],
                "fold": row["fold"],
                "bins": row.get("reliability_bins", []),
            }
            for row in ece_rows
        ],
        "gaps": _gaps(
            rows,
            expected_datasets=expected_datasets,
            expected_models=expected_models,
            expected_folds=expected_folds,
            expected_k_values=expected_k_values,
            expected_pairs=expected_pairs_list,
        ),
        "_provenance": {
            "source": str(results_dir),
            "result_count": len(rows),
            "folds_raw_sources": raw_sources,
        },
    }


def write_joined_artifacts(
    *,
    results_dir: Path | None = None,
    generated_dir: Path | None = None,
    summary_path: Path | None = None,
    reportable_only: bool = True,
    registry_path: Path | None = None,
    progress: bool = True,
) -> list[Path]:
    logger = ProgressLogger(label="kt-join", enabled=progress)
    root = _repo_root()
    source = results_dir or root / "research/results/kt"
    generated = generated_dir or root / "college/mydeliverables/1st-Review/report/generated"
    logger.log(0, "join.start", f"source={source} generated={generated}")
    reportable_allowlist = load_reportable_allowlist(registry_path)
    if reportable_only:
        logger.log(10, "join.allowlist", f"mode=reportable_allowlist entries={len(reportable_allowlist)}")
        if not reportable_allowlist:
            raise ValueError("model_registry.json has no credible reportable_allowlist entries")
        expected_pairs = {(item["dataset"], item["model"]) for item in reportable_allowlist}
        summary = join_kt_results(
            source,
            expected_datasets=sorted({dataset for dataset, _ in expected_pairs}),
            expected_models=sorted({model for _, model in expected_pairs}),
            expected_pairs=sorted(expected_pairs),
        )
        summary["_provenance"]["mode"] = "reportable_allowlist"
        summary["_provenance"]["reportable_allowlist"] = reportable_allowlist
    else:
        logger.log(10, "join.allowlist", "mode=full_expected_grid")
        summary = join_kt_results(source)
        summary["_provenance"]["mode"] = "full_expected_grid"
    logger.log(
        35,
        "join.summary_ready",
        f"mode={summary['_provenance']['mode']} rows={summary['_provenance']['result_count']} gaps={len(summary['gaps'])}",
    )

    logger.log(45, "join.write_tables", f"generated={generated}")
    outputs = [
        write_kt_auc_table(summary["full_seq_auc"], generated / "kt_auc.tex"),
        write_kt_ece_table(summary["ece"], generated / "kt_ece.tex"),
        *write_kt_plots(summary, generated),
    ]
    logger.log(70, "join.tables_plots_written", f"count={len(outputs)}")

    target_summary = summary_path or root / "research/results/kt_summary.json"
    target_summary.parent.mkdir(parents=True, exist_ok=True)
    target_summary.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    outputs.append(target_summary)
    logger.log(85, "join.summary_written", str(target_summary))

    provenance = generated / "kt_provenance.txt"
    reportable_lines = [
        f"- {item['model']} x {item['dataset']} ({item['status']})"
        for item in reportable_allowlist
    ]
    provenance.write_text(
        f"KT artifacts generated from {source} with {summary['_provenance']['result_count']} JSON rows.\n"
        f"Mode: {summary['_provenance']['mode']}.\n"
        + (
            "Reportable allow-list:\n" + "\n".join(reportable_lines) + "\n"
            if reportable_only
            else "Reportable allow-list: not applied.\n"
        )
        + f"Fold raw sources: {', '.join(summary['_provenance']['folds_raw_sources']) or 'unknown'}.\n",
        encoding="utf-8",
    )
    outputs.append(provenance)
    logger.log(100, "join.complete", f"wrote={len(outputs)}")
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results-dir", type=Path, default=None)
    parser.add_argument("--generated-dir", type=Path, default=None)
    parser.add_argument("--full-grid", action="store_true", help="write all expected cells instead of the credible allow-list")
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    for path in write_joined_artifacts(
        results_dir=args.results_dir,
        generated_dir=args.generated_dir,
        reportable_only=not args.full_grid,
        progress=not args.quiet,
    ):
        print(path)


if __name__ == "__main__":
    main()
