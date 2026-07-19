from __future__ import annotations

import argparse
import json
import os
import random
import shutil
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd
import torch
from pykt.datasets.data_loader import KTDataset
from pykt.datasets.init_dataset import init_dataset4train
from pykt.models.init_model import init_model
from pykt.models.train_model import train_model
from sklearn import metrics
from torch.nn.functional import one_hot
from torch.utils.data import DataLoader

from progress_log import ProgressLogger, run_with_heartbeat
from write_results import FoldSpec, default_results_dir, file_sha256, load_folds, result_filename, write_kt_result

os.environ.setdefault("WANDB_MODE", "offline")

MODEL_CONFIGS: dict[str, dict[str, Any]] = {
    "dkt": {"emb_size": 32, "dropout": 0.1},
    "akt": {
        "n_blocks": 1,
        "d_model": 32,
        "d_ff": 64,
        "dropout": 0.1,
        "kq_same": 1,
        "final_fc_dim": 64,
        "num_attn_heads": 4,
        "separate_qa": False,
        "l2": 1e-5,
    },
    "deep_irt": {"dim_s": 32, "size_m": 32, "dropout": 0.1},
    "sakt": {"seq_len": 200, "emb_size": 32, "num_attn_heads": 4, "dropout": 0.1, "num_en": 1},
    "dkt_clst_config": {"emb_size": 32, "dropout": 0.15},
}
PYKT_MODEL = {"dkt_clst_config": "dkt"}
SEQUENCE_COLUMNS = ("questions", "concepts", "responses", "timestamps", "usetimes", "selectmasks")


def parse_csv(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def patch_pykt_cpu_tensors() -> None:
    import pykt.datasets.data_loader as data_loader
    import pykt.datasets.dkt_forget_dataloader as dkt_forget_dataloader
    import pykt.datasets.que_data_loader as que_data_loader

    for module in (data_loader, dkt_forget_dataloader, que_data_loader):
        module.LongTensor = torch.LongTensor
        module.FloatTensor = torch.FloatTensor


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def load_data_config(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def public_to_pykt_model(model: str) -> str:
    if model not in MODEL_CONFIGS:
        choices = ", ".join(sorted(MODEL_CONFIGS))
        raise SystemExit(f"Unknown model {model!r}; expected one of: {choices}")
    return PYKT_MODEL.get(model, model)


def _copy_required_sequence_files(source_dir: Path, target_dir: Path) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    for name in ("train_valid_sequences.csv", "test_sequences.csv"):
        source = source_dir / name
        if not source.exists():
            raise FileNotFoundError(f"missing pyKT sequence file: {source}")
        shutil.copyfile(source, target_dir / name)


def _cap_rows_per_fold(frame: pd.DataFrame, smoke: int) -> pd.DataFrame:
    if smoke <= 0:
        return frame
    capped = []
    for _, group in frame.groupby("fold", sort=True):
        capped.append(group.head(smoke))
    return pd.concat(capped, ignore_index=True)


def _ensure_question_column(path: Path) -> None:
    frame = pd.read_csv(path)
    if "questions" not in frame.columns:
        insert_at = 2 if "uid" in frame.columns else 1
        frame.insert(insert_at, "questions", frame["concepts"])
        frame.to_csv(path, index=False)


def _prepare_sequence_file(path: Path, smoke: int, needs_questions: bool) -> None:
    frame = pd.read_csv(path)
    frame = _cap_rows_per_fold(frame, smoke)
    frame.to_csv(path, index=False)
    if needs_questions:
        _ensure_question_column(path)


def prepare_run_config(
    *,
    dataset: str,
    dataset_key: str,
    data_config: dict[str, Any],
    smoke: int,
    run_root: Path,
) -> dict[str, Any]:
    source_config = dict(data_config[dataset_key])
    source_dir = Path(source_config["dpath"])
    run_dir = run_root / dataset / f"smoke{smoke or 'full'}"
    if run_dir.exists():
        for cache in run_dir.glob("*.pkl"):
            cache.unlink()
    _copy_required_sequence_files(source_dir, run_dir)

    needs_questions = "questions" not in pd.read_csv(run_dir / "train_valid_sequences.csv", nrows=0).columns
    _prepare_sequence_file(run_dir / "train_valid_sequences.csv", smoke, needs_questions)
    _prepare_sequence_file(run_dir / "test_sequences.csv", smoke, needs_questions)

    source_config["dpath"] = str(run_dir)
    source_config["train_valid_file"] = "train_valid_sequences.csv"
    source_config["test_file"] = "test_sequences.csv"
    if needs_questions:
        source_config["input_type"] = ["questions", "concepts"]
        source_config["num_q"] = int(source_config["num_c"])
    return {dataset_key: source_config}


def model_config(model: str) -> dict[str, Any]:
    return dict(MODEL_CONFIGS[model])


def _device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _move_batch(dcur: dict[str, torch.Tensor]) -> dict[str, torch.Tensor]:
    device = _device()
    return {key: value.to(device) if hasattr(value, "to") else value for key, value in dcur.items()}


def predict_tensor(model: torch.nn.Module, dcur: dict[str, torch.Tensor], pykt_model: str) -> torch.Tensor:
    q = dcur["qseqs"]
    c = dcur["cseqs"]
    r = dcur["rseqs"]
    qshft = dcur["shft_qseqs"]
    cshft = dcur["shft_cseqs"]
    rshft = dcur["shft_rseqs"]
    cq = torch.cat((q[:, 0:1], qshft), dim=1)
    cc = torch.cat((c[:, 0:1], cshft), dim=1)
    cr = torch.cat((r[:, 0:1], rshft), dim=1)

    if pykt_model == "dkt":
        pred = model(c.long(), r.long())
        return (pred * one_hot(cshft.long(), model.num_c)).sum(-1)
    if pykt_model == "deep_irt":
        return model(cc.long(), cr.long())[:, 1:]
    if pykt_model == "sakt":
        return model(c.long(), r.long(), cshft.long())
    if pykt_model == "akt":
        pred, _ = model(cc.long(), cr.long(), cq.long())
        return pred[:, 1:]
    raise ValueError(f"prediction harvest is not implemented for pyKT model {pykt_model!r}")


def collect_predictions(
    *,
    model: torch.nn.Module,
    loader: DataLoader,
    pykt_model: str,
    last_only: bool = True,
) -> tuple[list[int], list[float]]:
    y_true: list[int] = []
    y_score: list[float] = []
    model.eval()
    with torch.no_grad():
        for data in loader:
            dcur = _move_batch(data)
            pred = predict_tensor(model, dcur, pykt_model)
            truth = dcur["shft_rseqs"]
            mask = dcur["smasks"].bool()
            if last_only:
                for row in range(pred.shape[0]):
                    selected = torch.nonzero(mask[row], as_tuple=False).flatten()
                    if selected.numel() == 0:
                        continue
                    pos = int(selected[-1].item())
                    y_true.append(int(truth[row, pos].detach().cpu().item()))
                    y_score.append(float(pred[row, pos].detach().cpu().item()))
            else:
                y_true.extend(torch.masked_select(truth, mask).detach().cpu().int().tolist())
                y_score.extend(torch.masked_select(pred, mask).detach().cpu().float().tolist())
    return y_true, y_score


def summarize_predictions(y_true: list[int], y_score: list[float]) -> tuple[float, float]:
    if not y_true:
        raise ValueError("model produced no predictions")
    auc = 0.5
    if len(set(y_true)) > 1:
        auc = float(metrics.roc_auc_score(y_true, y_score))
    labels = [1 if score >= 0.5 else 0 for score in y_score]
    return auc, float(metrics.accuracy_score(y_true, labels))


def checkpoint_dir(root: Path, dataset: str, model: str, fold: int, smoke: int) -> Path:
    path = root / dataset / model / f"fold{fold}" / f"smoke{smoke or 'full'}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_best_checkpoint(model: torch.nn.Module, ckpt_dir: Path) -> None:
    ckpt = ckpt_dir / f"{model.emb_type}_model.ckpt"
    if ckpt.exists():
        model.load_state_dict(torch.load(ckpt, map_location=_device()))


def _existing_full_result_is_complete(
    *,
    path: Path,
    dataset: str,
    public_model: str,
    pykt_model: str,
    fold: FoldSpec,
    seed: int,
    folds_path: Path,
    epochs: int,
    batch_size: int,
    learning_rate: float,
    smoke: int,
    expected_predictions: int,
) -> tuple[bool, str]:
    if not path.exists():
        return False, "missing result"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return False, f"invalid json: {exc}"

    provenance = payload.get("_provenance", {})
    training_config = payload.get("training_config", {})
    tolerance = max(1, int(round(expected_predictions * 0.05)))

    checks = {
        "dataset": payload.get("dataset") == dataset,
        "model": payload.get("model") == public_model,
        "fold": int(payload.get("fold", -1)) == fold.fold,
        "k": payload.get("k") == "full",
        "seed": provenance.get("seed") == seed,
        "folds_hash": provenance.get("folds_hash") == file_sha256(folds_path),
        "runner": training_config.get("runner") == "pyKT",
        "pykt_model": training_config.get("pykt_model") == pykt_model,
        "model_config": training_config.get("model_config") == model_config(public_model),
        "epochs": int(training_config.get("epochs", 0)) >= epochs,
        "batch_size": int(training_config.get("batch_size", 0)) == batch_size,
        "learning_rate": float(training_config.get("learning_rate", -1)) == float(learning_rate),
        "smoke": int(training_config.get("smoke_sequences_per_fold", -1)) == smoke,
        "n_predictions": abs(int(payload.get("n_predictions", -1)) - expected_predictions) <= tolerance,
    }
    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        return False, "failed checks: " + ",".join(failed)
    return True, f"auc={float(payload.get('auc', 0.0)):.6f} n_predictions={payload.get('n_predictions')}"


def _sequence_prediction_counts(data_config: dict[str, Any], dataset_key: str) -> dict[int, int]:
    current_config = data_config[dataset_key]
    sequence_path = Path(current_config["dpath"]) / current_config["train_valid_file"]
    frame = pd.read_csv(sequence_path, usecols=["fold"])
    return {int(fold): int(count) for fold, count in frame.groupby("fold").size().items()}


def train_one(
    *,
    dataset: str,
    dataset_key: str,
    public_model: str,
    fold: FoldSpec,
    data_config: dict[str, Any],
    seed: int,
    epochs: int,
    batch_size: int,
    learning_rate: float,
    smoke: int,
    checkpoints_dir: Path,
    logger: ProgressLogger,
    percent_start: float,
    percent_end: float,
    heartbeat_seconds: float,
) -> dict[str, Any]:
    detail = f"dataset={dataset} model={public_model} fold={fold.fold}"
    logger.log(percent_start, "train.fold.setup", detail)
    set_seed(seed + fold.fold)
    patch_pykt_cpu_tensors()
    pykt_model = public_to_pykt_model(public_model)
    train_loader, valid_loader, _, _ = init_dataset4train(
        dataset_key,
        pykt_model,
        data_config,
        fold.fold,
        batch_size,
    )
    current_config = data_config[dataset_key]
    model = init_model(pykt_model, model_config(public_model), current_config, "qid")
    if model is None:
        raise RuntimeError(f"pyKT failed to initialize model {public_model}")
    opt = torch.optim.Adam(model.parameters(), lr=learning_rate)
    ckpt_dir = checkpoint_dir(checkpoints_dir, dataset, public_model, fold.fold, smoke)
    logger.log(
        percent_start + (percent_end - percent_start) * 0.25,
        "train.fold.training",
        f"{detail} epochs={epochs} batch_size={batch_size} smoke={smoke}",
    )
    run_with_heartbeat(
        lambda: train_model(
            model,
            train_loader,
            valid_loader,
            epochs,
            opt,
            str(ckpt_dir),
            save_model=True,
        ),
        logger=logger,
        percent=percent_start + (percent_end - percent_start) * 0.5,
        state="train.fold.training",
        detail=detail,
        heartbeat_seconds=heartbeat_seconds,
    )
    logger.log(percent_start + (percent_end - percent_start) * 0.75, "train.fold.evaluate", detail)
    load_best_checkpoint(model, ckpt_dir)
    y_true, y_score = collect_predictions(model=model, loader=valid_loader, pykt_model=pykt_model)
    auc, accuracy = summarize_predictions(y_true, y_score)
    logger.log(
        percent_end,
        "train.fold.evaluated",
        f"{detail} auc={auc:.6f} accuracy={accuracy:.6f} n_predictions={len(y_true)}",
    )
    return {
        "dataset": dataset,
        "model": public_model,
        "fold": fold.fold,
        "k": "full",
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
        },
    }


def run(
    *,
    dataset: str,
    models: Iterable[str],
    folds_path: Path,
    results_dir: Path,
    seed: int,
    data_config_path: Path,
    epochs: int,
    batch_size: int,
    learning_rate: float,
    smoke: int,
    run_root: Path,
    checkpoints_dir: Path,
    progress: bool = True,
    heartbeat_seconds: float = 30.0,
    skip_complete: bool = False,
) -> list[Path]:
    logger = ProgressLogger(label="kt-train", enabled=progress)
    model_list = list(models)
    logger.log(
        0,
        "train.start",
        f"dataset={dataset} models={','.join(model_list)} epochs={epochs} smoke={smoke}",
    )
    folds_meta, folds = load_folds(folds_path)
    dataset_key = str(folds_meta["pykt_dataset"])
    logger.log(2, "train.prepare_config", f"dataset={dataset} pykt_dataset={dataset_key}")
    run_config = prepare_run_config(
        dataset=dataset,
        dataset_key=dataset_key,
        data_config=load_data_config(data_config_path),
        smoke=smoke,
        run_root=run_root,
    )
    logger.log(5, "train.config_ready", f"dataset={dataset} folds={len(folds)}")
    expected_predictions_by_fold = _sequence_prediction_counts(run_config, dataset_key)

    out_paths: list[Path] = []
    total_units = max(1, len(model_list) * len(folds))
    completed = 0
    for public_model in model_list:
        pykt_model = public_to_pykt_model(public_model)
        for fold in folds:
            percent_start = 5 + (completed / total_units) * 90
            percent_end = 5 + ((completed + 1) / total_units) * 90
            existing_path = results_dir / result_filename(dataset, public_model, fold.fold, "full")
            if skip_complete:
                complete, reason = _existing_full_result_is_complete(
                    path=existing_path,
                    dataset=dataset,
                    public_model=public_model,
                    pykt_model=pykt_model,
                    fold=fold,
                    seed=seed,
                    folds_path=folds_path,
                    epochs=epochs,
                    batch_size=batch_size,
                    learning_rate=learning_rate,
                    smoke=smoke,
                    expected_predictions=expected_predictions_by_fold[fold.fold],
                )
                if complete:
                    logger.log(
                        percent_end,
                        "train.fold.skip_complete",
                        f"dataset={dataset} model={public_model} fold={fold.fold} {reason}",
                    )
                    completed += 1
                    continue
                logger.log(
                    percent_start,
                    "train.fold.resume_needed",
                    f"dataset={dataset} model={public_model} fold={fold.fold} {reason}",
                )
            result = train_one(
                dataset=dataset,
                dataset_key=dataset_key,
                public_model=public_model,
                fold=fold,
                data_config=run_config,
                seed=seed,
                epochs=epochs,
                batch_size=batch_size,
                learning_rate=learning_rate,
                smoke=smoke,
                checkpoints_dir=checkpoints_dir,
                logger=logger,
                percent_start=percent_start,
                percent_end=percent_end,
                heartbeat_seconds=heartbeat_seconds,
            )
            out_path = write_kt_result(
                result=result,
                results_dir=results_dir,
                seed=seed,
                folds_path=folds_path,
                folds_meta=folds_meta,
            )
            out_paths.append(out_path)
            logger.log(percent_end, "train.fold.wrote", str(out_path))
            completed += 1
    logger.log(100, "train.complete", f"dataset={dataset} wrote={len(out_paths)}")
    return out_paths


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--models", default="dkt,akt,deep_irt,sakt,dkt_clst_config")
    parser.add_argument("--folds", type=Path, required=True)
    parser.add_argument("--results-dir", type=Path, default=default_results_dir())
    parser.add_argument("--seed", type=int, default=20260613)
    parser.add_argument("--data-config", type=Path, default=Path(".work/data_config.json"))
    parser.add_argument("--epochs", type=int, default=0, help="0 selects 1 epoch for smoke, 5 for full")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--smoke", type=int, default=0, help="cap sequences per fold; 0 means full")
    parser.add_argument("--run-root", type=Path, default=Path(".work/kt-runs"))
    parser.add_argument("--checkpoints-dir", type=Path, default=Path(".work/kt-checkpoints"))
    parser.add_argument("--progress-interval", type=float, default=30.0, help="seconds between training heartbeats")
    parser.add_argument("--skip-complete", action="store_true", help="skip matching full-depth kfull result rows")
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()

    epochs = args.epochs or (1 if args.smoke else 5)
    out_paths = run(
        dataset=args.dataset,
        models=parse_csv(args.models),
        folds_path=args.folds,
        results_dir=args.results_dir,
        seed=args.seed,
        data_config_path=args.data_config,
        epochs=epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        smoke=args.smoke,
        run_root=args.run_root,
        checkpoints_dir=args.checkpoints_dir,
        progress=not args.quiet,
        heartbeat_seconds=args.progress_interval,
        skip_complete=args.skip_complete,
    )
    for path in out_paths:
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
