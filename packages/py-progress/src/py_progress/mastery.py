"""Concept-level BKT mastery engine (stateless projection).

The engine is a pure forward-filter over per-skill binary observations.
It holds no state: every call rebuilds the projection from the full
observation sequence, so the same durable grades always produce the same
projection (rebuildable). Parameters are fixed defaults chosen by the #43
bake-off; ``MODEL_VERSION`` identifies them so a later bake-off can ship a
new parameter set without breaking stored projections.

Field names are camelCase to mirror the TypeScript twin
(``packages/progress/src/mastery.ts``), matching the repo's parity
convention in ``py_progress.types``.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

MODEL_VERSION = "bkt-v1"

BAKEOFF_SOURCE = (
    ".work/active/issue-43-mastery-adaptive-difficulty/research/bkt_bakeoff.py: "
    "two-regime synthetic ground truth, mean ECE 0.057 / mean AUC 0.785 (2026-09-20)"
)


@dataclass(frozen=True)
class BktParams:
    """The four standard BKT parameters plus the mastery prior.

    p_init   - P(mastery) before any observation (the cold start).
    p_learn  - P(not-mastered -> mastered) after each observation.
    p_slip   - P(incorrect | mastered).
    p_guess  - P(correct | not mastered).
    """

    p_init: float = 0.15
    p_learn: float = 0.1
    p_slip: float = 0.05
    p_guess: float = 0.2


DEFAULT_PARAMS = BktParams()


@dataclass(frozen=True)
class MasteryObservation:
    """One graded attempt's per-skill signal.

    ``correct`` is the binary outcome at the tau ~0.6 threshold; the
    continuous ``score`` rides along for context but does not drive BKT.
    """

    skillTag: str
    correct: bool
    score: float = 1.0


@dataclass(frozen=True)
class MasteryProjection:
    materialId: str
    skillTag: str
    mastery: float
    uncertainty: float
    confidence: float
    n: int
    modelVersion: str
    recentTrend: float | None = None


@dataclass(frozen=True)
class DifficultyRecommendation:
    materialId: str
    skillTag: str
    currentBand: int
    recommendedBand: int
    targetExpectedCorrectness: float
    modelVersion: str


def bkt_forward(
    observations: list[MasteryObservation],
    params: BktParams = DEFAULT_PARAMS,
) -> tuple[list[float], list[float]]:
    """Run the forward filter over one skill's observation sequence.

    Returns ``(mastery_after, p_correct_before)`` parallel lists:
    ``p_correct_before[i]`` is the predicted probability of correctness for
    observation ``i`` computed from the belief before it, and
    ``mastery_after[i]`` is P(mastery) after processing observation ``i``.
    """

    mastery: list[float] = []
    p_correct: list[float] = []
    belief = params.p_init
    for obs in observations:
        p_correct.append((1.0 - params.p_slip) * belief + params.p_guess * (1.0 - belief))
        if obs.correct:
            numerator = (1.0 - params.p_slip) * belief
            denominator = numerator + params.p_guess * (1.0 - belief)
        else:
            numerator = params.p_slip * belief
            denominator = numerator + (1.0 - params.p_guess) * (1.0 - belief)
        belief = numerator / denominator if denominator > 0 else belief
        belief += (1.0 - belief) * params.p_learn
        mastery.append(float(np.clip(belief, 0.0, 1.0)))
    return mastery, p_correct


def _entropy(p: float) -> float:
    if p <= 0.0 or p >= 1.0:
        return 0.0
    return float(-(p * np.log(p) + (1.0 - p) * np.log1p(-p)) / np.log(2.0))


def project_mastery(
    materialId: str,
    observations: list[MasteryObservation],
    params: BktParams = DEFAULT_PARAMS,
    modelVersion: str = MODEL_VERSION,
) -> MasteryProjection:
    """Stateless mastery projection for one (material, skill) sequence."""

    if not observations:
        mastery = params.p_init
        n = 0
        recent_trend = None
    else:
        mastery_after, _ = bkt_forward(observations, params)
        mastery = mastery_after[-1]
        n = len(observations)
        recent_trend = (
            mastery_after[-1] - mastery_after[-2] if n >= 2 else mastery_after[-1] - params.p_init
        )
    uncertainty = _entropy(mastery)
    return MasteryProjection(
        materialId=materialId,
        skillTag=observations[0].skillTag if observations else "",
        mastery=mastery,
        uncertainty=uncertainty,
        confidence=1.0 - uncertainty,
        n=n,
        modelVersion=modelVersion,
        recentTrend=recent_trend,
    )


def recommend_band(
    projection: MasteryProjection,
    currentBand: int,
    *,
    targetExpectedCorrectness: float = 0.7,
    upperBand: int = 5,
    lowerBand: int = 1,
) -> DifficultyRecommendation:
    """One-band recommendation targeting ~0.7 expected correctness.

    The band moves by at most one per call and is clamped to [lower, upper].
    A mastery at least ``target + margin`` above the target moves one band
    harder; at least ``target - margin`` below moves one band easier; close
    to the target keeps the band. The cold start (no observations) never
    moves the band.
    """

    margin = 0.05
    band = int(currentBand)
    if projection.n == 0:
        return DifficultyRecommendation(
            materialId=projection.materialId,
            skillTag=projection.skillTag,
            currentBand=int(currentBand),
            recommendedBand=band,
            targetExpectedCorrectness=targetExpectedCorrectness,
            modelVersion=projection.modelVersion,
        )
    if projection.mastery >= targetExpectedCorrectness + margin:
        band += 1
    elif projection.mastery <= targetExpectedCorrectness - margin:
        band -= 1
    band = int(np.clip(band, lowerBand, upperBand))
    return DifficultyRecommendation(
        materialId=projection.materialId,
        skillTag=projection.skillTag,
        currentBand=int(currentBand),
        recommendedBand=band,
        targetExpectedCorrectness=targetExpectedCorrectness,
        modelVersion=projection.modelVersion,
    )