"""Unit tests for the pure metric helpers of the #48 evaluation harness."""

import importlib.util
import pathlib

HARNESS = pathlib.Path(__file__).resolve().parents[1] / "scripts/eval_harness.py"
spec = importlib.util.spec_from_file_location("eval_harness", HARNESS)
eh = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(eh)


def test_retrieval_metrics_perfect_and_miss():
    perfect = eh.retrieval_metrics([1, 1, 2])
    assert perfect["recall1"] == round(2 / 3, 4)
    assert perfect["recall3"] == 1.0
    assert perfect["mrr"] == round((1 + 1 + 0.5) / 3, 4)

    with_miss = eh.retrieval_metrics([1, None, None])
    assert with_miss["recall1"] == round(1 / 3, 4)
    assert with_miss["mrr"] == round(1 / 3, 4)

    assert eh.retrieval_metrics([]) == {
        "n": 0,
        "recall1": None,
        "recall3": None,
        "recall5": None,
        "mrr": None,
    }


def test_ece_is_zero_when_calibrated_and_positive_when_not():
    assert eh.expected_calibration_error([1.0, 1.0, 0.0, 0.0], [True, True, False, False]) == 0.0
    assert eh.expected_calibration_error([0.9, 0.9, 0.1, 0.1], [True, True, False, False]) == 0.1
    miscalibrated = eh.expected_calibration_error([0.9, 0.9], [False, False])
    assert miscalibrated > 0.5


def test_auc_orders_positives_above_negatives():
    assert eh.auc([0.9, 0.8, 0.2, 0.1], [True, True, False, False]) == 1.0
    assert eh.auc([0.1, 0.2, 0.8, 0.9], [True, True, False, False]) == 0.0
    assert eh.auc([0.5, 0.5], [True, True]) is None


def test_calibration_metrics_curve_and_monotonicity():
    # Band 1 is the easiest: a calibrated set scores high on band 1, low on band 5.
    rows = [
        {"band": 1, "score": 0.9, "questionId": "a"},
        {"band": 5, "score": 0.2, "questionId": "b"},
    ]
    metrics = eh.calibration_metrics(rows)
    assert metrics["n"] == 2
    assert metrics["monotonic_decreasing"] is True
    assert metrics["curve"] == {"1": 0.9, "5": 0.2}
    assert metrics["mean_abs_band_error"] is not None

    anti_calibrated = eh.calibration_metrics(
        [
            {"band": 1, "score": 0.2, "questionId": "a"},
            {"band": 5, "score": 0.9, "questionId": "b"},
        ]
    )
    assert anti_calibrated["monotonic_decreasing"] is False

    assert eh.calibration_metrics([])["mean_abs_band_error"] is None


def test_position_entropy_is_maximal_when_uniform():
    assert eh.position_entropy([0, 1, 2, 3]) == 2.0
    assert eh.position_entropy([0, 0, 0, 0]) == 0.0
    assert eh.position_entropy([]) is None


def test_diversity_metrics_flags_identical_stems_as_near_duplicates():
    vector = [1.0, 0.0]
    records = [
        {
            "embeddings": {"stem": vector, "options": [vector, vector, vector, vector]},
            "correctIndex": 0,
        },
        {
            "embeddings": {"stem": vector, "options": [vector, vector, vector, vector]},
            "correctIndex": 1,
        },
    ]
    metrics = eh.diversity_metrics(records)
    assert metrics["near_dup_rate"] == 1.0
    assert metrics["stem_pairs"] == 1
    assert metrics["option_position_entropy"] == 1.0


def test_coding_suitability_and_gold_agreement():
    rows = [
        {"materialId": "code-mat", "formats": ["coding"], "warnings": [], "status": "ready"},
        {"materialId": "code-mat", "formats": ["coding"], "warnings": [], "status": "ready"},
        {
            "materialId": "prose-mat",
            "formats": ["coding"],
            "warnings": ["code_not_derivable"],
            "status": "failed",
        },
        {"materialId": "prose-mat", "formats": ["written"], "warnings": [], "status": "ready"},
        # Pending and non-suitability failures never reach the judge.
        {"materialId": "code-mat", "formats": ["coding"], "warnings": [], "status": "generating"},
        {
            "materialId": "empty-mat",
            "formats": ["coding"],
            "warnings": ["validation_failed"],
            "status": "failed",
        },
    ]
    metrics = eh.coding_suitability(rows)
    assert metrics["coding_attempts"] == 5
    assert metrics["judged_attempts"] == 3
    assert metrics["code_not_derivable"] == 1
    assert metrics["derivable_rate"] == round(2 / 3, 4)
    assert metrics["failed_other"] == 2

    gold = [
        {"label": "code mat", "materialId": "code-mat", "expectedDerivable": True},
        {"label": "prose mat", "materialId": "prose-mat", "expectedDerivable": False},
        {"label": "unseen", "materialId": "other", "expectedDerivable": True},
    ]
    agreement = eh.coding_gold_agreement(metrics["by_material"], gold)
    assert agreement["checked"] == 2
    assert agreement["agreed"] == 2
    assert agreement["disagreements"] == []

    disagreeing = eh.coding_gold_agreement(
        metrics["by_material"],
        [{"label": "code mat", "materialId": "code-mat", "expectedDerivable": False}],
    )
    assert disagreeing["agreed"] == 0
    assert disagreeing["disagreements"]


def test_mastery_candidates_scores_both_candidates():
    metrics = eh.mastery_candidates([[True, True, True, False], [False, True]])
    assert metrics["observations"] == 6
    assert metrics["sequences"] == 2
    assert metrics["bkt-v1"]["ece"] is not None
    assert "running-proportion" in metrics


def test_telemetry_summary_aggregates_outcomes():
    rows = [
        {
            "outcome": "ok",
            "questions_requested": 1,
            "questions_accepted": 1,
            "repair_attempted": False,
        },
        {
            "outcome": "partial",
            "questions_requested": 2,
            "questions_accepted": 1,
            "repair_attempted": True,
        },
    ]
    metrics = eh.telemetry_summary(rows)
    assert metrics["records"] == 2
    assert metrics["questions_requested"] == 3
    assert metrics["questions_accepted"] == 2
    assert metrics["acceptance_rate"] == round(2 / 3, 4)
    assert metrics["repair_rate"] == 0.5


def test_evaluate_gates_fails_closed_on_breach_and_on_unmeasured():
    summary = {
        "objective": {"schema_valid": 0.5, "citation_valid": 0.9, "gold_support": 0.8},
        "retrieval": {"recall3": 0.9, "mrr": 0.8},
        "diversity": {"near_dup_rate": 0.5},
        "difficulty": {"mean_abs_band_error": 0.2},
        "mastery": {"bkt-v1": {"auc": 0.7}},
        "coding": {"derivable_rate": 0.9},
    }
    thresholds = {
        "schemaValid": 0.9,
        "citationValid": 0.85,
        "goldSupport": 0.7,
        "retrievalRecall3": 0.83,
        "retrievalMrr": 0.79,
        "nearDupMax": 0.05,
        "difficultyMeanAbsBandError": 1.0,
        "masteryMinAuc": 0.6,
        "codingDerivableMin": 0.5,
    }
    failures = eh.evaluate_gates(summary, thresholds)
    assert {f["metric"] for f in failures} == {"schemaValid", "nearDupMax"}

    unmeasured = eh.evaluate_gates(
        {**summary, "retrieval": {"recall3": None, "mrr": None}}, thresholds
    )
    assert "retrievalRecall3" in {f["metric"] for f in unmeasured}


def test_unresolved_snippets_flags_only_missing_gold():
    golds = {"objectiveGold": "eval_golds_written.json", "writtenGold": "eval_golds_written.json"}
    chunks = [{"text": "Non-financial performance indicators are useful."}]
    problems = eh.unresolved_snippets(golds, chunks)
    unresolved_labels = {p.rsplit(": ", 1)[1] for p in problems}
    assert "non-financial performance indicators" not in unresolved_labels
    assert "information quality criteria" in unresolved_labels
