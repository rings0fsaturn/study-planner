from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from importlib.metadata import version
from pathlib import Path
from typing import Any, Iterable

import torch


@dataclass(frozen=True)
class FoldSpec:
    fold: int
    train_indices: list[int]
    test_indices: list[int]


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def default_results_dir() -> Path:
    return repo_root() / "research" / "results" / "kt"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_folds(path: Path) -> tuple[dict[str, Any], list[FoldSpec]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    folds = [
        FoldSpec(
            fold=int(item["fold"]),
            train_indices=[int(value) for value in item["train_indices"]],
            test_indices=[int(value) for value in item["test_indices"]],
        )
        for item in raw["folds"]
    ]
    return raw, folds


def stable_unit_interval(parts: Iterable[object]) -> float:
    raw = "::".join(str(part) for part in parts).encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    return int(digest[:12], 16) / float(0xFFFFFFFFFFFF)


def kt_provenance(*, seed: int, folds_path: Path, folds_meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "seed": seed,
        "pykt_version": version("pykt-toolkit"),
        "torch_version": torch.__version__,
        "folds_hash": file_sha256(folds_path),
        "folds_raw_source": folds_meta.get("raw_source"),
        "folds_source": folds_meta.get("source"),
        "folds_train_valid_sha256": folds_meta.get("train_valid_sha256"),
    }


def result_filename(dataset: str, model: str, fold: int, k: str | int) -> str:
    if k == "ece":
        return f"{dataset}__{model}__fold{fold}__ece.json"
    return f"{dataset}__{model}__fold{fold}__k{k}.json"


def write_kt_result(
    *,
    result: dict[str, Any],
    results_dir: Path,
    seed: int,
    folds_path: Path,
    folds_meta: dict[str, Any],
) -> Path:
    required = ("dataset", "model", "fold", "k")
    missing = [key for key in required if key not in result]
    if missing:
        raise ValueError(f"missing result keys: {missing}")

    payload = {
        **result,
        "_provenance": kt_provenance(seed=seed, folds_path=folds_path, folds_meta=folds_meta),
    }
    results_dir.mkdir(parents=True, exist_ok=True)
    out_path = results_dir / result_filename(
        str(result["dataset"]),
        str(result["model"]),
        int(result["fold"]),
        result["k"],
    )
    out_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return out_path
