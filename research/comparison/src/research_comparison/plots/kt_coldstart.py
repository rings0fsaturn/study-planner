from __future__ import annotations

import os
from collections import defaultdict
from pathlib import Path
from typing import Any

os.environ.setdefault("SOURCE_DATE_EPOCH", "0")

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt


def write_coldstart_plot(summary: dict[str, Any], out_path: Path) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    grouped: dict[tuple[str, str], list[tuple[int, float]]] = defaultdict(list)
    for row in summary["coldstart_auc"]:
        grouped[(row["dataset"], row["model"])].append((int(row["k"]), float(row["auc"])))

    plt.figure(figsize=(7.2, 4.4))
    for (dataset, model), points in sorted(grouped.items()):
        xs, ys = zip(*sorted(points))
        plt.plot(xs, ys, marker="o", linewidth=1.4, label=f"{dataset} {model}")
    plt.xlabel("First k interactions")
    plt.ylabel("AUC")
    plt.title("KT cold-start AUC")
    plt.ylim(0.45, 1.0)
    plt.grid(True, alpha=0.25)
    plt.legend(fontsize=7, ncols=2)
    plt.tight_layout()
    plt.savefig(out_path, format="pdf", metadata={"CreationDate": None, "ModDate": None})
    plt.close()
    return out_path


def write_reliability_plot(summary: dict[str, Any], out_path: Path) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    grouped: dict[str, dict[float, list[tuple[float, float]]]] = defaultdict(lambda: defaultdict(list))
    for row in summary["reliability"]:
        for bin_row in row["bins"]:
            midpoint = (float(bin_row["lower"]) + float(bin_row["upper"])) / 2.0
            grouped[str(row["model"])][midpoint].append(
                (float(bin_row["confidence"]), float(bin_row["accuracy"]))
            )

    plt.figure(figsize=(5.4, 5.0))
    plt.plot([0, 1], [0, 1], linestyle="--", color="black", linewidth=1)
    for model, bins in sorted(grouped.items()):
        xs = []
        ys = []
        for midpoint, values in sorted(bins.items()):
            if not values:
                continue
            xs.append(sum(conf for conf, _ in values) / len(values))
            ys.append(sum(acc for _, acc in values) / len(values))
        if xs:
            plt.plot(xs, ys, marker="o", linewidth=1.3, label=model)
    plt.xlabel("Mean confidence")
    plt.ylabel("Empirical accuracy")
    plt.title("KT reliability")
    plt.xlim(0, 1)
    plt.ylim(0, 1)
    plt.grid(True, alpha=0.25)
    plt.legend(fontsize=8)
    plt.tight_layout()
    plt.savefig(out_path, format="pdf", metadata={"CreationDate": None, "ModDate": None})
    plt.close()
    return out_path


def write_kt_plots(summary: dict[str, Any], generated_dir: Path) -> list[Path]:
    return [
        write_coldstart_plot(summary, generated_dir / "kt_coldstart.pdf"),
        write_reliability_plot(summary, generated_dir / "kt_reliability.pdf"),
    ]
