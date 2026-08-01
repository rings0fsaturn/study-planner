from __future__ import annotations

import math

import numpy as np

from research_comparison.generator.types import Shift
from research_comparison.params import BANDS, DRIFT_TOTAL_DEFAULT, DRIFT_WINDOW_FRAC, STEP_MAG_RANGE


def _shift_count(archetype: str, band: str, rng: np.random.Generator) -> int:
    low, high = BANDS[band]["shifts"]
    if archetype == "fading_flame":
        return max(1, low)
    if archetype != "marathon_runner":
        return 0
    return int(rng.integers(low, high + 1))


def _sample_onsets(count: int, n_sessions: int, rng: np.random.Generator) -> list[int]:
    if count <= 0:
        return []
    low = max(4, math.ceil(n_sessions * 0.20))
    high = min(n_sessions - 4, math.floor(n_sessions * 0.80))
    if high < low:
        low = high = max(1, n_sessions // 2)
    candidates = np.arange(low, high + 1)
    replace = len(candidates) < count
    return sorted(int(v) for v in rng.choice(candidates, size=count, replace=replace))


def _shift_types(archetype: str, count: int, rng: np.random.Generator) -> list[str]:
    if count <= 0:
        return []
    if archetype == "fading_flame":
        return ["drift", *["step" for _ in range(count - 1)]]
    if archetype == "marathon_runner":
        return ["step" for _ in range(count)]
    if count == 1:
        return [str(rng.choice(["step", "drift"]))]
    remaining = [str(rng.choice(["step", "drift"])) for _ in range(count - 2)]
    return ["step", "drift", *remaining]


def build_regime_series(
    archetype: str,
    band: str,
    n_sessions: int,
    rng: np.random.Generator,
    step_magnitude: float | None = None,
    drift_total: float | None = None,
) -> tuple[list[float], list[Shift]]:
    multipliers = np.ones(n_sessions, dtype=float)
    count = _shift_count(archetype, band, rng)
    onsets = _sample_onsets(count, n_sessions, rng)
    types = _shift_types(archetype, count, rng)
    shifts: list[Shift] = []

    for onset, shift_type in zip(onsets, types, strict=False):
        pre_mean = float(multipliers[max(0, onset - 1)])
        if shift_type == "step":
            magnitude = float(step_magnitude if step_magnitude is not None else rng.uniform(*STEP_MAG_RANGE))
            if archetype in {"fading_flame", "marathon_runner"}:
                sign = -1 if len(shifts) % 2 == 0 else 1
            else:
                sign = int(rng.choice([-1, 1]))
            factor = 1.0 + sign * magnitude
            multipliers[onset:] *= factor
            shifts.append(
                Shift(
                    onset_index=onset,
                    type="step",
                    pre_mean=round(pre_mean, 6),
                    post_mean=round(pre_mean * factor, 6),
                    drift_window=None,
                )
            )
            continue

        configured_drift = DRIFT_TOTAL_DEFAULT if drift_total is None else float(drift_total)
        total = -configured_drift if archetype == "fading_flame" else float(
            rng.choice([-1, 1]) * configured_drift
        )
        min_frac, max_frac = DRIFT_WINDOW_FRAC
        window = max(1, int(n_sessions * float(rng.uniform(min_frac, max_frac))))
        end = min(n_sessions, onset + window)
        ramp = np.linspace(0.0, total, end - onset, endpoint=True)
        multipliers[onset:end] *= 1.0 + ramp
        multipliers[end:] *= 1.0 + total
        shifts.append(
            Shift(
                onset_index=onset,
                type="drift",
                pre_mean=round(pre_mean, 6),
                post_mean=round(pre_mean * (1.0 + total), 6),
                drift_window=(onset, end),
            )
        )

    return [round(float(v), 6) for v in multipliers], shifts
