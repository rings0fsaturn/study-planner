from __future__ import annotations

import argparse
import json
import math
import os
import statistics
from collections import defaultdict
from pathlib import Path

os.environ.setdefault("SOURCE_DATE_EPOCH", "0")

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from research_comparison.progress_log import ProgressLogger
from research_comparison.writers.tables import write_detection_winners_table


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def latest_detection_results(root: Path | None = None) -> Path:
    results_root = root or _repo_root() / "research/results/detection"
    path = results_root / "detection_results.json"
    if not path.exists():
        raise FileNotFoundError("No detection results found; run make compare-detection first")
    return path


def _mean(values: list[float]) -> float:
    return float(statistics.fmean(values)) if values else math.nan


def write_detection_latency_plot(results_path: Path, out_path: Path) -> Path:
    payload = json.loads(results_path.read_text(encoding="utf-8"))
    grouped: dict[tuple[str, str], dict[str, list[float]]] = defaultdict(
        lambda: {"latency": [], "false_alarm": []}
    )
    for row in payload["rows"]:
        latency = float(row["mean_latency"])
        if not math.isfinite(latency):
            continue
        key = (row["candidate"], row["shift_type"])
        grouped[key]["latency"].append(latency)
        grouped[key]["false_alarm"].append(float(row["false_alarm_rate"]))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.figure(figsize=(7.0, 4.2))
    markers = {"step": "o", "drift": "s"}
    for (candidate, shift_type), values in sorted(grouped.items()):
        plt.scatter(
            _mean(values["false_alarm"]),
            _mean(values["latency"]),
            marker=markers.get(shift_type, "o"),
            label=f"{candidate.replace('_', ' ')} · {shift_type}",
        )
    plt.xlabel("False-alarm rate")
    plt.ylabel("Detection latency (sessions)")
    plt.title("Change detection latency by shift type")
    plt.grid(True, alpha=0.25)
    plt.legend(frameon=False, fontsize=7)
    plt.tight_layout()
    plt.savefig(
        out_path,
        format="pdf",
        metadata={"CreationDate": None, "ModDate": None},
    )
    plt.close()
    return out_path


def write_detection_artifacts(
    results_path: Path | None = None,
    progress: ProgressLogger | None = None,
) -> list[Path]:
    root = _repo_root()
    source = results_path or latest_detection_results()
    if progress:
        progress.log(0, "figs.detection.start", f"source={source}")
    payload = json.loads(source.read_text(encoding="utf-8"))
    if progress:
        progress.log(
            30,
            "figs.detection.loaded",
            f"rows={len(payload['rows'])} roc={len(payload['roc'])}",
        )
    generated_dir = root / "college/mydeliverables/1st-Review/report/generated"
    pdf = write_detection_latency_plot(source, generated_dir / "detection_latency.pdf")
    if progress:
        progress.log(65, "figs.detection.plot_written", str(pdf))
    table = write_detection_winners_table(
        payload["winner_by_shift_type"],
        generated_dir / "detection_winners.tex",
        paired=payload.get("paired_vs_incumbent"),
        correction=payload.get("mc_correction"),
    )
    if progress:
        progress.log(80, "figs.detection.table_written", str(table))
    provenance = generated_dir / "detection_latency_provenance.txt"
    provenance.write_text(
        "Detection latency generated from "
        f"{payload['dataset_id']} with params hash "
        f"{payload['_provenance']['params_version_hash']}.\n",
        encoding="utf-8",
    )
    if progress:
        progress.log(100, "figs.detection.complete", "wrote=3")
    return [pdf, table, provenance]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results-path", default=None)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    logger = ProgressLogger(label="research-figs-detection", enabled=not args.quiet)
    source = Path(args.results_path) if args.results_path else None
    for path in write_detection_artifacts(source, progress=logger):
        print(path)


if __name__ == "__main__":
    main()
