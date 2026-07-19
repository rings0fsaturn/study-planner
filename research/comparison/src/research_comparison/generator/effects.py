from __future__ import annotations

from typing import Any

from research_comparison.params import FATIGUE_PER_EXTRA_SESSION


def phi_fatigue(same_day_count: int) -> float:
    return 1.0 + FATIGUE_PER_EXTRA_SESSION * max(0, same_day_count - 1)


def delta_deadline(
    session_index: int,
    total_sessions: int,
    archetype_config: dict[str, Any],
) -> float:
    ramp_target = archetype_config.get("deadline_ramp")
    if not ramp_target or total_sessions <= 1:
        return 1.0
    progress = session_index / (total_sessions - 1)
    ramp_start = float(archetype_config.get("deadline_ramp_start", 0.80))
    if progress < ramp_start:
        return 1.0
    ramp_width = max(1e-9, 1.0 - ramp_start)
    ramp_progress = (progress - ramp_start) / ramp_width
    return float(1.0 + (ramp_target - 1.0) * ramp_progress**2)


def trend_multiplier(
    session_index: int,
    total_sessions: int,
    archetype_config: dict[str, Any],
) -> float:
    trend_total = archetype_config.get("trend_total")
    if trend_total is None or total_sessions <= 1:
        return 1.0
    progress = session_index / (total_sessions - 1)
    return float(1.0 + float(trend_total) * progress)
