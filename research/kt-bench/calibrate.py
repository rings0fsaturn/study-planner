from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable

from progress_log import ProgressLogger


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def result_path(results_dir: Path, dataset: str, model: str, fold: int) -> Path:
    return results_dir / f"{dataset}__{model}__fold{fold}__ece.json"


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

    bins = []
    ece = 0.0
    for index in range(n_bins):
        lower = index / n_bins
        upper = (index + 1) / n_bins
        selected = [
            (actual, score)
            for actual, score in zip(truth, scores)
            if score >= lower and (score < upper or index == n_bins - 1)
        ]
        if selected:
            count = len(selected)
            accuracy = sum(actual for actual, _ in selected) / count
            confidence = sum(score for _, score in selected) / count
            ece += (count / len(truth)) * abs(accuracy - confidence)
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


def calibrate_dataset(dataset: str, results_dir: Path, models: list[str], *, progress: bool = True) -> list[Path]:
    logger = ProgressLogger(label="kt-calibrate", enabled=progress)
    logger.log(0, "calibrate.start", f"dataset={dataset} models={','.join(models)}")
    outputs = []
    sources = sorted(results_dir.glob(f"{dataset}__*__fold*__kfull.json"))
    selected_sources = []
    for source in sources:
        payload = json.loads(source.read_text(encoding="utf-8"))
        model = str(payload["model"])
        if model in models:
            selected_sources.append((source, payload))
    total = max(1, len(selected_sources))
    logger.log(5, "calibrate.files_ready", f"dataset={dataset} full_seq_files={len(selected_sources)}")
    for index, (source, payload) in enumerate(selected_sources, start=1):
        model = str(payload["model"])
        fold = int(payload["fold"])
        percent_start = 5 + ((index - 1) / total) * 90
        logger.log(percent_start, "calibrate.fold.compute", f"source={source.name} model={model} fold={fold}")
        ece, bins = expected_calibration_error(
            y_true=payload["y_true"],
            y_score=payload["y_score"],
        )
        out_payload = {
            "dataset": dataset,
            "model": model,
            "fold": int(payload["fold"]),
            "k": "ece",
            "ece": ece,
            "reliability_bins": bins,
            "n_predictions": int(payload["n_predictions"]),
            "training_config": payload.get("training_config"),
            "_provenance": payload.get("_provenance", {}),
        }
        out_path = result_path(results_dir, dataset, model, fold)
        out_path.write_text(json.dumps(out_payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        outputs.append(out_path)
        logger.log(5 + (index / total) * 90, "calibrate.fold.wrote", f"{out_path} ece={ece:.6f}")
    logger.log(100, "calibrate.complete", f"dataset={dataset} wrote={len(outputs)}")
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--models", default="dkt,akt,deep_irt,sakt,dkt_clst_config")
    parser.add_argument("--results-dir", type=Path, default=repo_root() / "research/results/kt")
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()
    models = [item.strip() for item in args.models.split(",") if item.strip()]
    for path in calibrate_dataset(args.dataset, args.results_dir, models, progress=not args.quiet):
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
