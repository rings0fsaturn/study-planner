from __future__ import annotations

import pytest

from research_comparison.metrics.rigour import (
    benjamini_hochberg,
    bootstrap_delta_ci,
    heldout_archetype_split,
    holm_bonferroni,
)


def test_bootstrap_delta_ci_brackets_known_mean() -> None:
    lo, hi, point = bootstrap_delta_ci([1.0, 2.0, 3.0, 4.0], n_boot=500, seed=7)

    assert point == pytest.approx(2.5)
    assert lo < point < hi
    assert lo <= 2.5 <= hi


def test_multiple_comparison_masks_match_hand_computed_vector() -> None:
    pvalues = [0.001, 0.02, 0.03, 0.20]

    assert holm_bonferroni(pvalues) == [True, False, False, False]
    assert benjamini_hochberg(pvalues) == [True, True, True, False]


def test_heldout_archetype_split_is_deterministic_and_disjoint() -> None:
    archetypes = [
        "deadline_sprinter",
        "fading_flame",
        "marathon_runner",
        "morning_lark",
        "steady",
        "weekend_warrior",
    ]

    train, test = heldout_archetype_split(archetypes)

    assert train == {"steady", "marathon_runner", "morning_lark"}
    assert test == {"deadline_sprinter", "fading_flame", "weekend_warrior"}
    assert train.isdisjoint(test)
    assert train | test == set(archetypes)
