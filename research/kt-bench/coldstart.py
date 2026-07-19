from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
import torch
from pykt.datasets.data_loader import KTDataset
from torch.utils.data import DataLoader

from train import (
    MODEL_CONFIGS,
    checkpoint_dir,
    collect_predictions,
    load_best_checkpoint,
    load_data_config,
    model_config,
    parse_csv,
    patch_pykt_cpu_tensors,
    prepare_run_config,
    public_to_pykt_model,
    set_seed,
    summarize_predictions,
)
from pykt.models.init_model import init_model
from progress_log import ProgressLogger
from write_results import default_results_dir, load_folds, write_kt_result


def default_folds_path(dataset: str) -> Path:
    return Path("folds") / f"{dataset}_folds.json"


def _split(raw: object) -> list[str]:
    return [item.strip() for item in str(raw).split(",")]


def _truncate_values(raw: object, k: int, width: int, fill: str = "-1") -> str:
    values = [item for item in _split(raw) if item and item != "-1"]
    kept = values[:k]
    return ",".join([*kept, *([fill] * max(0, width - len(kept)))])


def truncated_fold_file(source: Path, target: Path, fold: int, k: int) -> Path:
    frame = pd.read_csv(source)
    frame = frame[frame["fold"] == fold].copy()
    if frame.empty:
        raise ValueError(f"{source} has no rows for fold {fold}")
    width = len(_split(frame.iloc[0]["responses"]))
    frame["fold"] = -1
    for column in ("questions", "concepts", "responses", "timestamps", "usetimes"):
        if column in frame.columns:
            frame[column] = frame[column].apply(lambda value: _truncate_values(value, k, width))
    frame["selectmasks"] = ",".join(["1"] * min(k, width) + ["-1"] * max(0, width - k))
    target.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(target, index=False)
    return target


def run_coldstart(
    *,
    dataset: str,
    models: list[str],
    k_values: list[int],
    folds_path: Path,
    results_dir: Path,
    seed: int,
    data_config_path: Path,
    smoke: int,
    epochs: int,
    batch_size: int,
    learning_rate: float,
    run_root: Path,
    checkpoints_dir: Path,
    progress: bool = True,
) -> list[Path]:
    logger = ProgressLogger(label="kt-coldstart", enabled=progress)
    logger.log(
        0,
        "coldstart.start",
        f"dataset={dataset} models={','.join(models)} k={','.join(str(value) for value in k_values)}",
    )
    folds_meta, folds = load_folds(folds_path)
    dataset_key = str(folds_meta["pykt_dataset"])
    logger.log(2, "coldstart.prepare_config", f"dataset={dataset} pykt_dataset={dataset_key}")
    run_config = prepare_run_config(
        dataset=dataset,
        dataset_key=dataset_key,
        data_config=load_data_config(data_config_path),
        smoke=smoke,
        run_root=run_root,
    )
    current_config = run_config[dataset_key]
    source = Path(current_config["dpath"]) / current_config["train_valid_file"]
    patch_pykt_cpu_tensors()
    logger.log(5, "coldstart.config_ready", f"dataset={dataset} folds={len(folds)} source={source}")

    outputs: list[Path] = []
    total_units = max(1, len(models) * len(folds) * len(k_values))
    completed = 0
    for public_model in models:
        pykt_model = public_to_pykt_model(public_model)
        for fold in folds:
            fold_detail = f"dataset={dataset} model={public_model} fold={fold.fold}"
            logger.log(5 + (completed / total_units) * 90, "coldstart.fold.load_checkpoint", fold_detail)
            set_seed(seed + fold.fold)
            model = init_model(pykt_model, model_config(public_model), current_config, "qid")
            if model is None:
                raise RuntimeError(f"pyKT failed to initialize model {public_model}")
            ckpt_dir = checkpoint_dir(checkpoints_dir, dataset, public_model, fold.fold, smoke)
            load_best_checkpoint(model, ckpt_dir)
            for k in k_values:
                percent_start = 5 + (completed / total_units) * 90
                truncated = run_root / dataset / f"smoke{smoke or 'full'}" / f"fold{fold.fold}_k{k}.csv"
                logger.log(percent_start, "coldstart.k.prepare", f"{fold_detail} k={k}")
                truncated_fold_file(source, truncated, fold.fold, k)
                loader = DataLoader(
                    KTDataset(str(truncated), current_config["input_type"], {-1}),
                    batch_size=batch_size,
                    shuffle=False,
                )
                y_true, y_score = collect_predictions(model=model, loader=loader, pykt_model=pykt_model)
                auc, accuracy = summarize_predictions(y_true, y_score)
                percent_end = 5 + ((completed + 1) / total_units) * 90
                logger.log(
                    percent_end,
                    "coldstart.k.evaluated",
                    f"{fold_detail} k={k} auc={auc:.6f} accuracy={accuracy:.6f} n_predictions={len(y_true)}",
                )
                result = {
                    "dataset": dataset,
                    "model": public_model,
                    "fold": fold.fold,
                    "k": k,
                    "auc": auc,
                    "accuracy": accuracy,
                    "n_predictions": len(y_true),
                    "y_true": y_true,
                    "y_score": [round(score, 6) for score in y_score],
                    "training_config": {
                        "runner": "pyKT",
                        "pykt_model": pykt_model,
                        "model_config": model_config(public_model),
                        "epochs": epochs,
                        "batch_size": batch_size,
                        "learning_rate": learning_rate,
                        "smoke_sequences_per_fold": smoke,
                        "checkpoint_dir": str(ckpt_dir),
                        "coldstart_k": k,
                    },
                }
                out_path = write_kt_result(
                    result=result,
                    results_dir=results_dir,
                    seed=seed,
                    folds_path=folds_path,
                    folds_meta=folds_meta,
                )
                outputs.append(out_path)
                logger.log(percent_end, "coldstart.k.wrote", str(out_path))
                completed += 1
    logger.log(100, "coldstart.complete", f"dataset={dataset} wrote={len(outputs)}")
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--models", default=",".join(MODEL_CONFIGS))
    parser.add_argument("--k", default="3,5,10,20")
    parser.add_argument("--folds", type=Path)
    parser.add_argument("--results-dir", type=Path, default=default_results_dir())
    parser.add_argument("--seed", type=int, default=20260613)
    parser.add_argument("--data-config", type=Path, default=Path(".work/data_config.json"))
    parser.add_argument("--smoke", type=int, default=0)
    parser.add_argument("--epochs", type=int, default=0, help="0 selects 1 epoch for smoke, 5 for full")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--run-root", type=Path, default=Path(".work/kt-runs"))
    parser.add_argument("--checkpoints-dir", type=Path, default=Path(".work/kt-checkpoints"))
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()

    epochs = args.epochs or (1 if args.smoke else 5)
    folds_path = args.folds or default_folds_path(args.dataset)
    out_paths = run_coldstart(
        dataset=args.dataset,
        models=parse_csv(args.models),
        k_values=[int(value) for value in parse_csv(args.k)],
        folds_path=folds_path,
        results_dir=args.results_dir,
        seed=args.seed,
        data_config_path=args.data_config,
        smoke=args.smoke,
        epochs=epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        run_root=args.run_root,
        checkpoints_dir=args.checkpoints_dir,
        progress=not args.quiet,
    )
    for path in out_paths:
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
