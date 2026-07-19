from __future__ import annotations

import math

import numpy as np

from research_comparison.params import AR1_PHI, CLIP_HIGH, CLIP_LOW


def apply_lognormal_ar1(
    r_star: list[float],
    sigma_log: float,
    rng: np.random.Generator,
    phi: float = AR1_PHI,
) -> tuple[list[float], float]:
    if not r_star:
        return [], 0.0

    eta_prev = 0.0
    ratios: list[float] = []
    clipped = 0
    innovation_scale = math.sqrt(max(0.0, 1.0 - phi**2)) * sigma_log
    mean_correction = -0.5 * sigma_log**2

    for latent in r_star:
        eta = phi * eta_prev + float(rng.normal(0.0, innovation_scale))
        eta_prev = eta
        emitted = latent * math.exp(eta + mean_correction)
        clipped_emitted = min(CLIP_HIGH, max(CLIP_LOW, emitted))
        clipped += int(clipped_emitted != emitted)
        ratios.append(round(float(clipped_emitted), 6))

    return ratios, clipped / len(r_star)
