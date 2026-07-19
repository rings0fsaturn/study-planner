from __future__ import annotations

from typing import Any

import numpy as np

from research_comparison.generator.capacity import PlannedSlot
from research_comparison.params import MANUAL_FRACTION


def attempt_probability(
    archetype: str,
    archetype_config: dict[str, Any],
    slot: PlannedSlot,
    emitted_count: int,
    target_sessions: int,
) -> float:
    if archetype == "weekend_warrior":
        return (
            float(archetype_config["attempt_prob_weekend"])
            if slot.day_of_week in {"saturday", "sunday"}
            else float(archetype_config["attempt_prob_weekday"])
        )
    if archetype == "fading_flame":
        progress = emitted_count / max(1, target_sessions - 1)
        return float(0.90 + (0.45 - 0.90) * progress)
    if archetype == "deadline_sprinter":
        progress = emitted_count / max(1, target_sessions - 1)
        if progress < 0.80:
            return 0.45
        ramp_progress = (progress - 0.80) / 0.20
        return float(0.45 + (0.95 - 0.45) * ramp_progress)
    return float(archetype_config.get("attempt_prob", 0.88))


def choose_source(rng: np.random.Generator, manual_fraction: float = MANUAL_FRACTION) -> str:
    return "manual" if float(rng.random()) < manual_fraction else "active"
