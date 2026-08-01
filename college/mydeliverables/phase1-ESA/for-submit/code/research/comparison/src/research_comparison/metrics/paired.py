from __future__ import annotations

import math

import numpy as np
from scipy import stats


def paired_difference(left: list[float], right: list[float]) -> dict[str, float]:
    if len(left) != len(right):
        raise ValueError("paired arrays must have the same length")
    if not left:
        return {"delta": math.nan, "p_value": math.nan, "effect_size": math.nan}

    diff = np.asarray(left, dtype=float) - np.asarray(right, dtype=float)
    delta = float(np.mean(diff))
    if len(diff) < 2 or float(np.std(diff, ddof=1)) == 0.0:
        p_value = 1.0
        effect = 0.0 if delta == 0 else math.copysign(math.inf, delta)
    else:
        p_value = float(stats.ttest_rel(left, right).pvalue)
        effect = float(delta / np.std(diff, ddof=1))
    return {"delta": delta, "p_value": p_value, "effect_size": effect}
