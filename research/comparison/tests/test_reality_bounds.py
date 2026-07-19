from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from research_comparison.generator.generate import generate_dataset


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "research/comparison/scripts/verify_reality_bounds.py"


def _broad_bounds_fixture() -> dict:
    return {
        "bounds_version": "test-broad-reality-bounds",
        "proxy_mapping": "test fixture",
        "bounds": {
            "ar1_phi": {"low": -1.0, "high": 1.0},
            "shift_frequency_per_100_days": {"low": 0.0, "high": 100.0},
            "gap_days": {"p50": 10.0, "p75": 30.0, "p90": 60.0, "p95": 90.0},
            "dropout_probability": {"low": 0.0, "high": 1.0},
        },
    }


def _load_verify_module():
    assert SCRIPT_PATH.exists(), f"missing script at {SCRIPT_PATH}"
    spec = importlib.util.spec_from_file_location("verify_reality_bounds", SCRIPT_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_new_archetypes_within_oulad_bounds(tmp_path: Path) -> None:
    module = _load_verify_module()
    bounds = _broad_bounds_fixture()
    dataset_id = generate_dataset(
        archetype_mix={"night_owl": 1, "crammer": 1, "steady_improver": 1},
        bands=["small"],
        seeds=[0, 1],
        out_dir=str(tmp_path / "datasets"),
        generator_regime="reality_matched",
        moment_bounds=bounds,
    )

    result = module.verify_reality_bounds(
        tmp_path / "datasets" / dataset_id,
        bounds,
        output_dir=tmp_path / "verification",
        quiet=True,
    )
    payload = json.loads(result.read_text(encoding="utf-8"))

    assert payload["status"] == "pass"
    assert payload["dataset_id"] == dataset_id
    assert {"night_owl", "crammer", "steady_improver"} <= set(payload["by_archetype"])
    assert payload["checks"]["dropout_probability"]["within_bounds"] is True
