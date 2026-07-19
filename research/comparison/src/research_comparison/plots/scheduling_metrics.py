from __future__ import annotations

import argparse
import json
from pathlib import Path

from research_comparison.progress_log import ProgressLogger
from research_comparison.writers.tables import write_scheduling_metrics_table


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def latest_scheduling_results(root: Path | None = None) -> Path:
    results_root = root or _repo_root() / "research/results/scheduling"
    path = results_root / "scheduling_results.json"
    if not path.exists():
        raise FileNotFoundError("No scheduling results found; run make compare-scheduling first")
    return path


def write_scheduling_artifacts(
    results_path: Path | None = None,
    progress: ProgressLogger | None = None,
) -> list[Path]:
    root = _repo_root()
    source = results_path or latest_scheduling_results()
    if progress:
        progress.log(0, "figs.scheduling.start", f"source={source}")
    payload = json.loads(source.read_text(encoding="utf-8"))
    if progress:
        progress.log(35, "figs.scheduling.loaded", f"rows={len(payload['rows'])}")
    generated_dir = root / "college/mydeliverables/1st-Review/report/generated"
    table = write_scheduling_metrics_table(
        payload["winner_by_material_mix"],
        generated_dir / "scheduling_metrics.tex",
        paired=payload.get("paired_vs_incumbent"),
        correction=payload.get("mc_correction"),
    )
    if progress:
        progress.log(75, "figs.scheduling.table_written", str(table))
    provenance = generated_dir / "scheduling_metrics_provenance.txt"
    provenance.write_text(
        "Scheduling metrics generated from "
        f"{payload['dataset_id']} with params hash "
        f"{payload['_provenance']['params_version_hash']}.\n",
        encoding="utf-8",
    )
    if progress:
        progress.log(100, "figs.scheduling.complete", "wrote=2")
    return [table, provenance]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results-path", default=None)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    logger = ProgressLogger(label="research-figs-scheduling", enabled=not args.quiet)
    source = Path(args.results_path) if args.results_path else None
    for path in write_scheduling_artifacts(source, progress=logger):
        print(path)


if __name__ == "__main__":
    main()
