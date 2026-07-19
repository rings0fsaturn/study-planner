from __future__ import annotations

import importlib.util
import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "research/comparison/scripts/capture_evidence.py"


def _load_capture_module():
    assert SCRIPT_PATH.exists(), f"missing script at {SCRIPT_PATH}"
    spec = importlib.util.spec_from_file_location("capture_evidence", SCRIPT_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_capture_writes_evidence_and_summary(tmp_path: Path) -> None:
    module = _load_capture_module()
    result_path = tmp_path / "calibration_results.json"
    result_path.write_text(
        json.dumps(
            {
                "_provenance": {
                    "params_version_hash": "hash123",
                    "seed_count": 2,
                    "n_learners": 4,
                    "archetype_split": {
                        "train": ["steady"],
                        "held_out": ["deadline_sprinter"],
                    },
                },
                "dataset_id": "synthetic-hash123-seed0-n4",
                "scored_split": "held_out",
                "rows": [
                    {
                        "band": "small",
                        "candidate": "hierarchical_bayes",
                        "split": "held_out",
                        "recovery_mae": 0.20,
                        "context_pred_mae": 0.30,
                    },
                    {
                        "band": "small",
                        "candidate": "ewma",
                        "split": "held_out",
                        "recovery_mae": 0.18,
                        "context_pred_mae": 0.25,
                    },
                ],
                "mc_correction": {
                    "context_pred_mae": {
                        "comparisons": [
                            {
                                "candidate": "ewma",
                                "survives_holm_win": True,
                                "holm_significant": True,
                                "delta_ci_low": -0.07,
                                "delta_ci_high": -0.01,
                            }
                        ]
                    },
                    "recovery_mae": {"comparisons": []},
                },
                "mc_correction_reference_baselines": {
                    "enriched_shrink": {
                        "context_pred_mae": {
                            "comparisons": [
                                {
                                    "candidate": "archetype_soft",
                                    "survives_holm_win": False,
                                    "holm_significant": False,
                                }
                            ]
                        },
                        "recovery_mae": {"comparisons": []},
                    }
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    outputs = module.capture_evidence(
        [("fixture", result_path)],
        output_dir=tmp_path / "review",
        quiet=True,
    )

    evidence = json.loads(outputs.evidence_path.read_text(encoding="utf-8"))
    summary = outputs.summary_path.read_text(encoding="utf-8")

    assert outputs.evidence_path.exists()
    assert outputs.summary_path.exists()
    assert evidence["calibration"]["runs"]["fixture"]["dataset_id"] == "synthetic-hash123-seed0-n4"
    assert evidence["calibration"]["runs"]["fixture"]["seed_count"] == 2
    assert evidence["calibration"]["runs"]["fixture"]["delta_ci_present"] is True
    assert (
        evidence["calibration"]["runs"]["fixture"]["mc_survivors"]["context_pred_mae"][
            "holm_surviving_wins"
        ]["ewma"]
        == 1
    )
    assert (
        evidence["calibration"]["runs"]["fixture"]["reference_baseline_mc_survivors"][
            "enriched_shrink"
        ]["context_pred_mae"]["holm_surviving_wins"]
        == {}
    )
    assert "hierarchical_bayes" in summary
    assert "context_pred_mae" in summary
    assert "Reference-Baseline Survivors" in summary
    assert "baseline `enriched_shrink`" in summary
