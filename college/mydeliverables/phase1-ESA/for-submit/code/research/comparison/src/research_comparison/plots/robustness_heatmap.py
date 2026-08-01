from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

os.environ.setdefault("SOURCE_DATE_EPOCH", "0")

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from research_comparison.progress_log import ProgressLogger


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def latest_sweep_results(root: Path | None = None) -> Path:
    results_root = root or _repo_root() / "research/results/sweep"
    path = results_root / "sweep_results.json"
    if not path.exists():
        raise FileNotFoundError("No sweep results found; run make sweep first")
    return path


def write_robustness_heatmap(results_path: Path, out_path: Path) -> Path:
    payload = json.loads(results_path.read_text(encoding="utf-8"))
    tracks = sorted(payload["stability"])
    params = sorted(payload["grid"])
    matrix = []
    for track in tracks:
        track_rows = [row for row in payload["rows"] if row["track"] == track]
        row_values = []
        for param in params:
            values = sorted({entry["params"][param] for entry in track_rows})
            held_values = 0
            for value in values:
                subset = [entry for entry in track_rows if entry["params"][param] == value]
                if all(entry["ranking_status"] == "held" for entry in subset):
                    held_values += 1
            row_values.append(held_values / max(1, len(values)))
        matrix.append(row_values)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    plt.figure(figsize=(7.0, 3.8))
    image = plt.imshow(matrix, vmin=0.0, vmax=1.0, cmap="YlGn")
    plt.colorbar(image, label="Ranking held fraction")
    plt.xticks(
        range(len(params)),
        [param.replace("_", " ") for param in params],
        rotation=30,
        ha="right",
    )
    plt.yticks(range(len(tracks)), tracks)
    plt.title("Sensitivity sweep ranking stability")
    plt.tight_layout()
    plt.savefig(
        out_path,
        format="pdf",
        metadata={"CreationDate": None, "ModDate": None},
    )
    plt.close()
    return out_path


def write_robustness_artifacts(
    results_path: Path | None = None,
    progress: ProgressLogger | None = None,
) -> list[Path]:
    root = _repo_root()
    source = results_path or latest_sweep_results()
    if progress:
        progress.log(0, "figs.robustness.start", f"source={source}")
    generated_dir = root / "college/mydeliverables/1st-Review/report/generated"
    pdf = write_robustness_heatmap(source, generated_dir / "robustness_heatmap.pdf")
    if progress:
        progress.log(65, "figs.robustness.plot_written", str(pdf))
    payload = json.loads(source.read_text(encoding="utf-8"))
    provenance = generated_dir / "robustness_heatmap_provenance.txt"
    provenance.write_text(
        "Robustness heatmap generated from sweep grid with params hash "
        f"{payload['_provenance']['params_version_hash']}.\n"
        f"Flip cells: {len(payload.get('flip_cells', []))}; "
        "per-archetype worst cases recorded in sweep_results.json.\n",
        encoding="utf-8",
    )
    if progress:
        progress.log(100, "figs.robustness.complete", "wrote=2")
    return [pdf, provenance]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results-path", default=None)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    logger = ProgressLogger(label="research-figs-robustness", enabled=not args.quiet)
    source = Path(args.results_path) if args.results_path else None
    for path in write_robustness_artifacts(source, progress=logger):
        print(path)


if __name__ == "__main__":
    main()
