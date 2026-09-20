from __future__ import annotations

import math

from py_progress.mastery import (
    DEFAULT_PARAMS,
    MODEL_VERSION,
    MasteryObservation,
    bkt_forward,
    project_mastery,
    recommend_band,
)


def _obs(corrects: list[bool], tag: str = "s") -> list[MasteryObservation]:
    return [MasteryObservation(skillTag=tag, correct=c) for c in corrects]


def test_cold_start_is_neutral_and_uncertain() -> None:
    proj = project_mastery("mat-1", [])
    assert proj.mastery == DEFAULT_PARAMS.p_init
    assert proj.n == 0
    assert proj.modelVersion == MODEL_VERSION
    assert proj.uncertainty > 0.5  # no evidence -> uncertain
    assert proj.confidence == 1.0 - proj.uncertainty


def test_single_correct_does_not_claim_mastery() -> None:
    proj = project_mastery("mat-1", _obs([True]))
    assert proj.mastery < 0.6
    assert proj.n == 1
    assert proj.uncertainty > 0.8  # still very uncertain after one observation


def test_sustained_correct_saturates() -> None:
    proj = project_mastery("mat-1", _obs([True] * 8))
    assert proj.mastery > 0.95
    assert proj.uncertainty < 0.05


def test_incorrect_collapses_belief() -> None:
    up = project_mastery("mat-1", _obs([True, True, True]))
    down = project_mastery("mat-1", _obs([True, True, True, False]))
    # With slip 0.05 an incorrect after sustained corrects is strong evidence:
    # belief drops well below where the incorrect sequence started.
    assert down.mastery < 0.7
    assert up.mastery - down.mastery > 0.2


def test_projection_is_rebuildable_and_stateless() -> None:
    seq = _obs([True, True, False, True, True])
    first = project_mastery("mat-1", seq)
    rebuilt = project_mastery("mat-1", seq)
    assert first == rebuilt
    assert first.n == 5


def test_bkt_forward_predictions_precede_updates() -> None:
    mastery, p_correct = bkt_forward(_obs([True, False, True]))
    assert len(mastery) == len(p_correct) == 3
    # First prediction is the cold-start probability of a correct answer.
    p_correct_at_cold_start = (
        (1 - DEFAULT_PARAMS.p_slip) * DEFAULT_PARAMS.p_init
        + DEFAULT_PARAMS.p_guess * (1 - DEFAULT_PARAMS.p_init)
    )
    assert math.isclose(p_correct[0], p_correct_at_cold_start)
    # The prediction before step 2 reflects the raised belief after the first
    # correct, so it is higher than the cold-start prediction.
    assert p_correct[1] > p_correct[0]
    # A correct raises mastery; the following incorrect collapses it below the
    # cold start (slip 0.05 makes a post-correct mistake damning); the last
    # correct recovers it.
    assert mastery[0] > DEFAULT_PARAMS.p_init
    assert mastery[1] < mastery[0]
    assert mastery[2] > mastery[1]


def test_bounds_hold_everywhere() -> None:
    for seq in ([], [True], [False], [True] * 12, [False] * 6, [True, False] * 5):
        proj = project_mastery("mat-1", _obs(seq))
        assert 0.0 <= proj.mastery <= 1.0
        assert 0.0 <= proj.uncertainty <= 1.0
        assert 0.0 <= proj.confidence <= 1.0
        assert proj.n == len(seq)


def test_recommendation_moves_one_band_up() -> None:
    proj = project_mastery("mat-1", _obs([True] * 6))
    rec = recommend_band(proj, 3)
    assert rec.recommendedBand == 4
    assert rec.currentBand == 3
    assert abs(rec.recommendedBand - rec.currentBand) == 1
    assert rec.targetExpectedCorrectness == 0.7
    assert rec.modelVersion == MODEL_VERSION


def test_recommendation_moves_one_band_down() -> None:
    proj = project_mastery("mat-1", _obs([False] * 3))
    rec = recommend_band(proj, 3)
    assert rec.recommendedBand == 2


def test_recommendation_keeps_band_near_target() -> None:
    proj = project_mastery("mat-1", _obs([True, True, True, False]))
    assert 0.65 <= proj.mastery <= 0.75
    rec = recommend_band(proj, 3)
    assert rec.recommendedBand == 3


def test_recommendation_cold_start_keeps_band() -> None:
    proj = project_mastery("mat-1", [])
    assert recommend_band(proj, 3).recommendedBand == 3


def test_recommendation_clamps_at_edges() -> None:
    proj = project_mastery("mat-1", _obs([True] * 8))
    assert recommend_band(proj, 5).recommendedBand == 5
    low = project_mastery("mat-1", _obs([False] * 4))
    assert recommend_band(low, 1).recommendedBand == 1