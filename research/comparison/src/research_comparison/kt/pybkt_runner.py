from __future__ import annotations

import argparse
import json
import re
import time
import warnings
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from importlib.metadata import version
from pathlib import Path
from typing import Any, Iterable

import pandas as pd
from sklearn import metrics

from research_comparison.kt.join import expected_calibration_error
from research_comparison.kt.progress_log import ProgressLogger


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _patch_pybkt_metric_probe() -> None:
    import sklearn.metrics as sk

    for metric_locs in (sk._regression, sk._classification):
        for name in dir(metric_locs):
            if not re.search("_loss$|_score$|_error$", name):
                continue
            func = getattr(metric_locs, name)

            def wrapper(*args: Any, __func: Any = func, **kwargs: Any) -> Any:
                try:
                    return __func(*args, **kwargs)
                except AttributeError as exc:
                    raise TypeError(str(exc)) from exc

            setattr(metric_locs, name, wrapper)


def _patch_pybkt_serial_em() -> None:
    import numpy as np
    from pyBKT.fit import EM_fit

    warnings.filterwarnings(
        "ignore",
        message="invalid value encountered in divide",
        category=RuntimeWarning,
        module=r"pyBKT\.fit\.EM_fit",
    )
    if getattr(EM_fit.run, "_study_tracker_serial_patch", False):
        return

    def run(  # type: ignore[no-untyped-def]
        data: dict[str, Any],
        model: dict[str, Any],
        trans_softcounts: Any,
        emission_softcounts: Any,
        init_softcounts: Any,
        num_outputs: int,
        parallel: bool = True,
        fixed: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        del trans_softcounts, emission_softcounts, init_softcounts, num_outputs, parallel
        fixed = fixed or {}
        alldata = data["data"]
        big_t, num_subparts = len(alldata[0]), len(alldata)
        allresources = data["resources"]
        starts = data["starts"]
        learns = model["learns"]
        forgets = model["forgets"]
        guesses = model["guesses"]
        slips = model["slips"]
        lengths = data["lengths"]

        prior = fixed.get("prior", model["prior"])
        num_sequences = len(starts)
        num_resources = len(learns)
        initial_distn = np.empty((2,), dtype="float")
        initial_distn[0] = 1 - prior
        initial_distn[1] = prior

        if "learns" in fixed:
            learns = learns * (fixed["learns"] < 0) + fixed["learns"] * (fixed["learns"] >= 0)
        if "forgets" in fixed:
            forgets = forgets * (fixed["forgets"] < 0) + fixed["forgets"] * (fixed["forgets"] >= 0)
        as_matrix = np.empty((2, 2 * num_resources))
        EM_fit.interleave(as_matrix[0], 1 - learns, forgets.copy())
        EM_fit.interleave(as_matrix[1], learns.copy(), 1 - forgets)

        if "guesses" in fixed:
            guesses = fixed["guesses"] * (fixed["guesses"] < 0) + fixed["guesses"] * (fixed["guesses"] >= 0)
        if "slips" in fixed:
            slips = fixed["slips"] * (fixed["slips"] < 0) + fixed["slips"] * (fixed["slips"] >= 0)
        bn_matrix = np.empty((2, 2 * num_subparts))
        EM_fit.interleave(bn_matrix[0], 1 - guesses, guesses.copy())
        EM_fit.interleave(bn_matrix[1], slips.copy(), 1 - slips)

        alpha_out = np.zeros((2, big_t))
        payload = {
            "As": as_matrix,
            "Bn": bn_matrix,
            "initial_distn": initial_distn,
            "allresources": allresources,
            "starts": starts,
            "lengths": lengths,
            "num_resources": num_resources,
            "num_subparts": num_subparts,
            "alldata": alldata,
            "normalizeLengths": False,
            "alpha_out": alpha_out,
            "sequence_idx_start": 0,
            "sequence_idx_end": num_sequences,
        }

        trans = np.zeros((2, 2 * num_resources))
        emission = np.zeros((2, 2 * num_subparts))
        init = np.zeros((2, 1))
        total_loglike = 0.0
        for result in [EM_fit.inner(payload)]:
            trans += result[0]
            emission += result[1]
            init += result[2]
            total_loglike += float(result[3])
            for sequence_start, t_steps, alpha in result[4]:
                alpha_out[:, sequence_start : sequence_start + t_steps] += alpha

        return {
            "total_loglike": total_loglike,
            "all_trans_softcounts": np.reshape(trans.flatten(order="F"), (num_resources, 2, 2), order="C"),
            "all_emission_softcounts": np.reshape(emission.flatten(order="F"), (num_subparts, 2, 2), order="C"),
            "all_initial_softcounts": init,
            "alpha_out": alpha_out.flatten(order="F").reshape(alpha_out.shape, order="C"),
        }

    run._study_tracker_serial_patch = True  # type: ignore[attr-defined]
    EM_fit.run = run


def _pybkt_model_class() -> type[Any]:
    _patch_pybkt_metric_probe()
    from pyBKT.models import Model

    _patch_pybkt_serial_em()
    return Model


def _sha256(path: Path) -> str:
    import hashlib

    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _load_folds(path: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return raw, raw["folds"]


def _result_path(results_dir: Path, dataset: str, fold: int, k: str | int) -> Path:
    suffix = "ece" if k == "ece" else f"k{k}"
    return results_dir / f"{dataset}__pybkt__fold{fold}__{suffix}.json"


def _write_result(path: Path, payload: dict[str, Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path


def _progress(logger: ProgressLogger, percent: float, state: str, detail: str = "") -> None:
    logger.log(percent, state, detail)


def _sequence_sidecar_path(folds_path: Path, dataset: str) -> Path:
    return folds_path.with_name(f"{dataset}_sequences.csv")


def _load_sequences(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(
        path,
        dtype={"row_index": "int64", "order": "int64", "skill": "string", "correct": "int8"},
    )
    missing = {"row_index", "order", "skill", "correct"} - set(frame.columns)
    if missing:
        raise ValueError(f"{path} is missing required columns: {sorted(missing)}")
    return frame.rename(
        columns={
            "row_index": "user_id",
            "order": "order_id",
            "skill": "skill_name",
        }
    )[["user_id", "order_id", "skill_name", "correct"]]


def _fold_frame(sequences: pd.DataFrame, row_indices: Iterable[int]) -> pd.DataFrame:
    frame = sequences[sequences["user_id"].isin(set(int(value) for value in row_indices))].copy()
    if frame.empty:
        raise ValueError("fold split produced no sequence rows")
    return frame.sort_values(["user_id", "order_id"], kind="mergesort").reset_index(drop=True)


def _truncate_first_k(frame: pd.DataFrame, k: str | int) -> pd.DataFrame:
    if k == "full":
        return frame
    return frame.groupby("user_id", sort=False, group_keys=False).head(int(k)).reset_index(drop=True)


def _safe_auc(y_true: list[int], y_score: list[float]) -> float:
    if len(set(y_true)) < 2:
        return 0.5
    return float(metrics.roc_auc_score(y_true, y_score))


def _fit_skill_model(train: pd.DataFrame, *, seed: int) -> Any:
    Model = _pybkt_model_class()
    model = Model(seed=seed, num_fits=1, parallel=False)
    model.fit(data=train, skills=".*", defaults=None, forgets=False)
    return model


def _fit_skill_with_heartbeat(
    train: pd.DataFrame,
    *,
    seed: int,
    dataset: str,
    fold_id: int,
    skill: str,
    logger: ProgressLogger,
    percent: float,
    heartbeat_seconds: float,
) -> Any:
    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_fit_skill_model, train, seed=seed)
        while True:
            try:
                return future.result(timeout=heartbeat_seconds)
            except TimeoutError:
                elapsed = int(time.monotonic() - started)
                _progress(
                    logger,
                    percent,
                    "pybkt.skill.fit",
                    f"dataset={dataset} fold={fold_id} skill={skill} still_running={elapsed}s",
                )


def _should_log_skill(index: int, total: int) -> bool:
    return index <= 5 or index == total or index % max(1, total // 20) == 0


def _fit_models_with_progress(
    train: pd.DataFrame,
    *,
    dataset: str,
    fold_id: int,
    seed: int,
    logger: ProgressLogger,
    percent_start: float,
    percent_end: float,
    heartbeat_seconds: float = 15.0,
) -> dict[str, Any]:
    skill_count = int(train["skill_name"].nunique())
    learner_count = int(train["user_id"].nunique())
    row_count = len(train)
    _progress(
        logger,
        percent_start,
        "pybkt.fold.fit_start",
        f"dataset={dataset} fold={fold_id} rows={row_count} learners={learner_count} skills={skill_count}",
    )
    started = time.monotonic()
    models: dict[str, Any] = {}
    grouped = list(train.groupby("skill_name", sort=True))
    for index, (skill, skill_train) in enumerate(grouped, start=1):
        skill_name = str(skill)
        if _should_log_skill(index, skill_count):
            elapsed = int(time.monotonic() - started)
            percent = percent_start + (index / max(1, skill_count)) * (percent_end - percent_start)
            _progress(
                logger,
                percent,
                "pybkt.skill.fit",
                f"dataset={dataset} fold={fold_id} skill_index={index}/{skill_count} skill={skill_name} rows={len(skill_train)} elapsed={elapsed}s",
            )
        models[skill_name] = _fit_skill_with_heartbeat(
            skill_train.reset_index(drop=True),
            seed=seed + index,
            dataset=dataset,
            fold_id=fold_id,
            skill=skill_name,
            logger=logger,
            percent=percent_start + (index / max(1, skill_count)) * (percent_end - percent_start),
            heartbeat_seconds=heartbeat_seconds,
        )
    elapsed = int(time.monotonic() - started)
    _progress(logger, percent_end, "pybkt.fold.fit_complete", f"dataset={dataset} fold={fold_id} elapsed={elapsed}s")
    return models


def _predict(models: dict[str, Any], test: pd.DataFrame) -> tuple[list[int], list[float]]:
    y_true: list[int] = []
    y_score: list[float] = []
    for skill, skill_test in test.groupby("skill_name", sort=False):
        model = models.get(str(skill))
        if model is None:
            y_true.extend(int(value) for value in skill_test["correct"].tolist())
            y_score.extend([0.5] * len(skill_test))
            continue
        predictions = model.predict(data=skill_test.reset_index(drop=True))
        y_true.extend(int(value) for value in predictions["correct"].tolist())
        y_score.extend(float(value) for value in predictions["correct_predictions"].tolist())
    return y_true, y_score


def run_pybkt(
    *,
    dataset: str,
    folds_path: Path,
    results_dir: Path,
    seed: int = 20260613,
    k_values: Iterable[int] = (3, 5, 10, 20),
    progress: bool = False,
) -> list[Path]:
    logger = ProgressLogger(label="kt-pybkt", enabled=progress)
    logger.log(0, "pybkt.start", f"dataset={dataset} folds={folds_path}")
    model_class = _pybkt_model_class().__name__
    folds_meta, folds = _load_folds(folds_path)
    sequence_path = _sequence_sidecar_path(folds_path, dataset)
    logger.log(3, "pybkt.load_sequences", f"dataset={dataset} sequences={sequence_path}")
    sequences = _load_sequences(sequence_path)
    logger.log(
        5,
        "pybkt.sequences_ready",
        f"dataset={dataset} rows={len(sequences)} learners={sequences['user_id'].nunique()} skills={sequences['skill_name'].nunique()}",
    )
    provenance = {
        "seed": seed,
        "pybkt_version": version("pyBKT"),
        "pybkt_model_class": model_class,
        "folds_hash": _sha256(folds_path),
        "sequences_hash": _sha256(sequence_path),
        "folds_raw_source": folds_meta.get("raw_source"),
    }
    training_config = {
        "runner": "pyBKT",
        "pybkt_model_class": model_class,
        "num_fits": 1,
        "parallel": False,
        "defaults": None,
        "forgets": False,
        "seed": seed,
    }
    outputs: list[Path] = []
    total_folds = max(1, len(folds))
    for fold_index, fold in enumerate(folds):
        fold_id = int(fold["fold"])
        fold_start = 5 + (fold_index / total_folds) * 90
        fold_end = 5 + ((fold_index + 1) / total_folds) * 90
        fit_end = fold_start + (fold_end - fold_start) * 0.75
        logger.log(fold_start, "pybkt.fold.prepare", f"dataset={dataset} fold={fold_id}")
        train = _fold_frame(sequences, fold["train_indices"])
        test = _fold_frame(sequences, fold["test_indices"])
        model = _fit_models_with_progress(
            train,
            dataset=dataset,
            fold_id=fold_id,
            seed=seed + fold_id,
            logger=logger,
            percent_start=fold_start + (fold_end - fold_start) * 0.05,
            percent_end=fit_end,
        )
        prediction_keys = ["full", *k_values]
        for key_index, k in enumerate(prediction_keys):
            percent = fit_end + (key_index / max(1, len(prediction_keys) + 1)) * (fold_end - fit_end)
            logger.log(percent, "pybkt.fold.predict", f"dataset={dataset} fold={fold_id} k={k}")
            y_true, y_score = _predict(model, _truncate_first_k(test, k))
            auc = _safe_auc(y_true, y_score)
            labels = [1 if score >= 0.5 else 0 for score in y_score]
            payload = {
                "dataset": dataset,
                "model": "pybkt",
                "fold": fold_id,
                "k": k,
                "auc": auc,
                "accuracy": float(metrics.accuracy_score(y_true, labels)),
                "n_predictions": len(y_true),
                "y_true": y_true,
                "y_score": [round(score, 6) for score in y_score],
                "training_config": training_config,
                "_provenance": provenance,
            }
            out_path = _write_result(_result_path(results_dir, dataset, fold_id, k), payload)
            outputs.append(out_path)
            logger.log(percent, "pybkt.fold.wrote", f"{out_path} auc={auc:.6f} n_predictions={len(y_true)}")

        logger.log(fold_end - 1, "pybkt.fold.ece", f"dataset={dataset} fold={fold_id}")
        y_true, y_score = _predict(model, test)
        ece, bins = expected_calibration_error(y_true=y_true, y_score=y_score)
        out_path = _write_result(
            _result_path(results_dir, dataset, fold_id, "ece"),
            {
                "dataset": dataset,
                "model": "pybkt",
                "fold": fold_id,
                "k": "ece",
                "ece": ece,
                "reliability_bins": bins,
                "n_predictions": len(y_true),
                "training_config": training_config,
                "_provenance": provenance,
            },
        )
        outputs.append(out_path)
        logger.log(fold_end, "pybkt.fold.complete", f"{out_path} ece={ece:.6f}")
    logger.log(100, "pybkt.complete", f"dataset={dataset} wrote={len(outputs)}")
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--folds", type=Path, default=None)
    parser.add_argument("--results-dir", type=Path, default=None)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args()

    root = _repo_root()
    folds = args.folds or root / "research/kt-bench/folds" / f"{args.dataset}_folds.json"
    results = args.results_dir or root / "research/results/kt"
    for path in run_pybkt(dataset=args.dataset, folds_path=folds, results_dir=results, progress=not args.quiet):
        print(path)


if __name__ == "__main__":
    main()
