from __future__ import annotations

import math


def recovery_mae(estimates: list[float], true_value: float) -> float:
    if not estimates:
        return math.nan
    return float(sum(abs(estimate - true_value) for estimate in estimates) / len(estimates))


def recovery_rmse(estimates: list[float], true_value: float) -> float:
    if not estimates:
        return math.nan
    return float(
        math.sqrt(sum((estimate - true_value) ** 2 for estimate in estimates) / len(estimates))
    )
