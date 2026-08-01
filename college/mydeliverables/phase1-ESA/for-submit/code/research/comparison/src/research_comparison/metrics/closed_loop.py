from __future__ import annotations

import statistics
from datetime import date
from typing import Any


def adherence_score(sessions: list[dict[str, Any]]) -> float:
    ratios = [
        float(session["activeMinutes"]) / float(session["plannedMinutes"])
        for session in sessions
        if session.get("source") == "active"
        and session.get("plannedMinutes") not in {None, 0}
        and session.get("activeMinutes") is not None
    ]
    if not ratios:
        return 0.0
    mean_abs_deviation = statistics.fmean(abs(ratio - 1.0) for ratio in ratios)
    return float(1.0 / (1.0 + mean_abs_deviation))


def finish_date_drift_days(finish_date: str, deadline: str) -> float:
    return float((date.fromisoformat(finish_date) - date.fromisoformat(deadline)).days)


def compare_closed_vs_open(
    open_result: dict[str, Any],
    closed_result: dict[str, Any],
) -> dict[str, dict[str, float]]:
    return {
        "open": {
            "adherence": float(open_result["adherence"]),
            "finish_date_drift_days": float(open_result["finish_date_drift_days"]),
        },
        "closed": {
            "adherence": float(closed_result["adherence"]),
            "finish_date_drift_days": float(closed_result["finish_date_drift_days"]),
        },
    }
