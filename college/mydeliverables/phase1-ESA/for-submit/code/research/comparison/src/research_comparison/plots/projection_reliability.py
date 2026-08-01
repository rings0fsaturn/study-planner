from __future__ import annotations

import argparse
import json
import os
import statistics
from pathlib import Path

os.environ.setdefault("SOURCE_DATE_EPOCH", "0")

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from research_comparison.progress_log import ProgressLogger
from research_comparison.writers.tables import write_projection_winners_table


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def latest_projection_results(root: Path | None = None) -> Path:
    results_root = root or _repo_root() / "research/results/projection"
    path = results_root / "projection_results.json"
    if not path.exists():
        raise FileNotFoundError("No projection results found; run make compare-projection first")
    return path


def write_projection_reliability_plot(results_path: Path, out_path: Path) -> Path:
    payload = json.loads(results_path.read_text(encoding="utf-8"))
    candidates = sorted({row["candidate"] for row in payload["rows"]})
    coverage = [
        statistics.fmean(
            float(row["coverage"]) for row in payload["rows"] if row["candidate"] == candidate
        )
        for candidate in candidates
    ]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.figure(figsize=(7.0, 4.2))
    plt.plot([0, len(candidates) + 1], [0.95, 0.95], linestyle="--", color="black", linewidth=1)
    plt.bar(
        [candidate.replace("_", " ") for candidate in candidates],
        coverage,
        color=["#526a5c", "#a45f3d", "#4e6e8e"][: len(candidates)],
    )
    plt.ylim(0, 1.05)
    plt.ylabel("Empirical 95% interval coverage")
    plt.title("Target-date projection reliability")
    plt.grid(True, axis="y", alpha=0.25)
    plt.tight_layout()
    plt.savefig(
        out_path,
        format="pdf",
        metadata={"CreationDate": None, "ModDate": None},
    )
    plt.close()
    return out_path


def write_projection_artifacts(
    results_path: Path | None = None,
    progress: ProgressLogger | None = None,
) -> list[Path]:
    root = _repo_root()
    source = results_path or latest_projection_results()
    if progress:
        progress.log(0, "figs.projection.start", f"source={source}")
    payload = json.loads(source.read_text(encoding="utf-8"))
    if progress:
        progress.log(
            30,
            "figs.projection.loaded",
            f"rows={len(payload['rows'])} forecasts={len(payload['forecasts'])}",
        )
    generated_dir = root / "college/mydeliverables/1st-Review/report/generated"
    pdf = write_projection_reliability_plot(
        source,
        generated_dir / "projection_reliability.pdf",
    )
    if progress:
        progress.log(65, "figs.projection.plot_written", str(pdf))
    table = write_projection_winners_table(
        payload["winner_by_band"],
        generated_dir / "projection_winners.tex",
        paired=payload.get("paired_vs_incumbent"),
        correction=payload.get("mc_correction"),
    )
    if progress:
        progress.log(80, "figs.projection.table_written", str(table))
    provenance = generated_dir / "projection_reliability_provenance.txt"
    provenance.write_text(
        "Projection reliability generated from "
        f"{payload['dataset_id']} with params hash "
        f"{payload['_provenance']['params_version_hash']}.\n",
        encoding="utf-8",
    )
    if progress:
        progress.log(100, "figs.projection.complete", "wrote=3")
    return [pdf, table, provenance]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results-path", default=None)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    logger = ProgressLogger(label="research-figs-projection", enabled=not args.quiet)
    source = Path(args.results_path) if args.results_path else None
    for path in write_projection_artifacts(source, progress=logger):
        print(path)


if __name__ == "__main__":
    main()
