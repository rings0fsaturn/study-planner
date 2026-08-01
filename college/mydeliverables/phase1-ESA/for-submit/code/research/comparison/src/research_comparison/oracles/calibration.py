from __future__ import annotations

from typing import Any


def calibration_oracle_estimate(truth: dict[str, Any]) -> float:
    return float(truth["m_global"])


def calibration_oracle_error(truth: dict[str, Any]) -> float:
    return 0.0 if "m_global" in truth else float("nan")
