from __future__ import annotations

import argparse
import json
import os
from collections import defaultdict
from pathlib import Path

os.environ.setdefault("SOURCE_DATE_EPOCH", "0")

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from research_comparison.manifest import build_manifest, stamp
from research_comparison.progress_log import ProgressLogger
from research_comparison.writers.tables import write_calibration_winners_table


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def write_stub() -> Path:
    manifest = build_manifest(seed=0, archetype_mix={"stub": 1}, n_learners=1)
    output = stamp({"status": "stub", "stage": "figs"}, manifest)
    out_path = _repo_root() / "research/results/figs_stub.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, sort_keys=True), encoding="utf-8")
    return out_path


def latest_calibration_results(root: Path | None = None) -> Path:
    results_root = root or _repo_root() / "research/results/calibration"
    path = results_root / "calibration_results.json"
    if not path.exists():
        raise FileNotFoundError("No calibration results found; run make compare first")
    return path


def write_convergence_plot(results_path: Path, out_path: Path) -> Path:
    payload = json.loads(results_path.read_text(encoding="utf-8"))
    grouped: dict[tuple[str, int], list[float]] = defaultdict(list)
    for row in payload["convergence"]:
        grouped[(row["candidate"], int(row["t"]))].append(float(row["recovery_error"]))

    by_candidate: dict[str, list[tuple[int, float]]] = defaultdict(list)
    for (candidate, t), values in grouped.items():
        by_candidate[candidate].append((t, sum(values) / len(values)))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.figure(figsize=(7.0, 4.2))
    for candidate, points in sorted(by_candidate.items()):
        ordered = sorted(points)
        plt.plot(
            [point[0] for point in ordered],
            [point[1] for point in ordered],
            marker="o",
            linewidth=1.4,
            label=candidate.replace("_", " "),
        )
    plt.xlabel("Sessions observed")
    plt.ylabel("Recovery error (MAE)")
    plt.title("Calibration convergence by candidate")
    plt.grid(True, alpha=0.25)
    plt.legend(frameon=False, fontsize=8)
    plt.tight_layout()
    plt.savefig(
        out_path,
        format="pdf",
        metadata={"CreationDate": None, "ModDate": None},
    )
    plt.close()
    return out_path


def write_convergence_artifacts(
    results_path: Path | None = None,
    generated_dir: Path | None = None,
    progress: ProgressLogger | None = None,
) -> list[Path]:
    root = _repo_root()
    source = results_path or latest_calibration_results()
    if progress:
        progress.log(0, "figs.calibration.start", f"source={source}")
    payload = json.loads(source.read_text(encoding="utf-8"))
    if progress:
        progress.log(
            30,
            "figs.calibration.loaded",
            f"convergence_rows={len(payload['convergence'])}",
        )
    target_generated_dir = (
        generated_dir or root / "college/mydeliverables/1st-Review/report/generated"
    )
    pdf = write_convergence_plot(
        source,
        target_generated_dir / "calibration_convergence.pdf",
    )
    if progress:
        progress.log(65, "figs.calibration.plot_written", str(pdf))
    table = write_calibration_winners_table(
        payload["winner_per_band"],
        target_generated_dir / "calibration_winners.tex",
        paired=payload.get("paired_vs_incumbent"),
        correction=payload.get("mc_correction", {}).get("recovery_mae"),
    )
    if progress:
        progress.log(80, "figs.calibration.table_written", str(table))
    provenance = target_generated_dir / "calibration_convergence_provenance.txt"
    provenance.write_text(
        "Calibration convergence generated from "
        f"{payload['dataset_id']} with params hash "
        f"{payload['_provenance']['params_version_hash']}.\n",
        encoding="utf-8",
    )
    if progress:
        progress.log(100, "figs.calibration.complete", "wrote=3")
    return [pdf, table, provenance]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stub", action="store_true")
    parser.add_argument("--results-path", default=None)
    parser.add_argument("--generated-dir", default=None)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    logger = ProgressLogger(label="research-figs-calibration", enabled=not args.quiet)
    if args.stub:
        logger.log(0, "figs.calibration.stub_start")
        path = write_stub()
        logger.log(100, "figs.calibration.stub_complete", str(path))
        print(path)
        return
    source = Path(args.results_path) if args.results_path else None
    generated_dir = Path(args.generated_dir) if args.generated_dir else None
    for path in write_convergence_artifacts(source, generated_dir=generated_dir, progress=logger):
        print(path)


if __name__ == "__main__":
    main()
