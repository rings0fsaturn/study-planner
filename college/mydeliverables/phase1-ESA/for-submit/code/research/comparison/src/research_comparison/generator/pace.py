from __future__ import annotations

from typing import Any

from research_comparison.params import ROLE_RHO, TAU_GENERIC


def latent_base(
    m_global: float,
    role: str,
    time_of_day: str,
    day_of_week: str,
    params: dict[str, Any],
) -> float:
    role_rho = params.get("role_rho", ROLE_RHO)
    tau = params.get("tau", TAU_GENERIC)
    weekday = day_of_week.lower()
    weekend_multiplier = params.get("nu_weekend", 1.0) if weekday in {"saturday", "sunday"} else 1.0
    return float(m_global * role_rho[role] * tau.get(time_of_day, 1.0) * weekend_multiplier)
