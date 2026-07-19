"""Statistical rigour helpers for Pillar-A comparison claims.

Resolved open-code-question evidence locked for PA+.8:

- GP projection is homoscedastic and has no AR(1) term:
  `packages/py-progress/src/py_progress/gp.py:129-138` uses one residual
  variance, one `GP_NOISE_RATIO`, and one diagonal noise term for every point.
  `packages/py-progress/src/py_progress/gp.py:191-197` applies the default
  `gp_regression` result and a flat extrapolation inflation.
- The generator emits lognormal AR(1) noise:
  `research/comparison/src/research_comparison/generator/noise.py:10-33`
  carries `eta = phi * eta_prev + normal(...)`, with `AR1_PHI = 0.30` in
  `research/comparison/src/research_comparison/params.py:8`.
- The calibration incumbent collapses to the global posterior mean:
  `research/comparison/src/research_comparison/baselines/calibration.py:41-51`
  returns `compute_hierarchical_model(...).globalPosterior.mean`.
- The hierarchy computes role/time-of-day structure but no day-of-week helper:
  `packages/py-progress/src/py_progress/bayesian.py:102-178` builds role
  multipliers and role x time-of-day insights; only `infer_time_of_day` exists
  at `packages/py-progress/src/py_progress/bayesian.py:39-51`.
- Generator truth includes role, time-of-day, and weekend effects:
  `research/comparison/src/research_comparison/generator/pace.py:8-18`
  computes `m_global * rho(role) * tau(time_of_day) * weekend_multiplier`.
- Candidate hyperparameters are fixed constants today, not tuned:
  examples include `research/comparison/src/research_comparison/baselines/calibration.py:54-83`
  and `packages/py-progress/src/py_progress/gp.py:129-136`.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import TypeAlias

import numpy as np

DeltaCI: TypeAlias = tuple[float, float, float]
DEFAULT_HELDOUT_TRAIN_ARCHETYPES = frozenset(
    {"steady", "morning_lark", "marathon_runner", "crammer", "steady_improver"}
)


def bootstrap_delta_ci(
    deltas: Sequence[float],
    *,
    n_boot: int = 10000,
    alpha: float = 0.05,
    seed: int = 0,
) -> DeltaCI:
    """Return a percentile bootstrap CI around the paired delta mean."""
    values = np.asarray(list(deltas), dtype=float)
    if values.size == 0:
        nan = float("nan")
        return nan, nan, nan
    if n_boot < 1:
        raise ValueError("n_boot must be positive")
    if not 0.0 < alpha < 1.0:
        raise ValueError("alpha must be in (0, 1)")

    point = float(np.mean(values))
    rng = np.random.default_rng(seed)
    samples = rng.choice(values, size=(n_boot, values.size), replace=True)
    boot_means = np.mean(samples, axis=1)
    lo, hi = np.quantile(boot_means, [alpha / 2.0, 1.0 - alpha / 2.0])
    return float(lo), float(hi), point


def holm_bonferroni(
    pvalues: Sequence[float],
    *,
    alpha: float = 0.05,
) -> list[bool]:
    """Return original-order rejections under Holm-Bonferroni correction."""
    if not 0.0 < alpha < 1.0:
        raise ValueError("alpha must be in (0, 1)")

    ordered = sorted(enumerate(float(p) for p in pvalues), key=lambda item: item[1])
    rejects = [False] * len(ordered)
    total = len(ordered)
    for rank, (index, pvalue) in enumerate(ordered, start=1):
        if not np.isfinite(pvalue) or pvalue < 0.0 or pvalue > 1.0:
            break
        threshold = alpha / (total - rank + 1)
        if pvalue <= threshold:
            rejects[index] = True
        else:
            break
    return rejects


def benjamini_hochberg(
    pvalues: Sequence[float],
    *,
    q: float = 0.05,
) -> list[bool]:
    """Return original-order rejections under Benjamini-Hochberg FDR control."""
    if not 0.0 < q < 1.0:
        raise ValueError("q must be in (0, 1)")

    ordered = sorted(enumerate(float(p) for p in pvalues), key=lambda item: item[1])
    cutoff: float | None = None
    total = len(ordered)
    for rank, (_index, pvalue) in enumerate(ordered, start=1):
        if not np.isfinite(pvalue) or pvalue < 0.0 or pvalue > 1.0:
            continue
        if pvalue <= (rank / total) * q:
            cutoff = pvalue
    if cutoff is None:
        return [False] * total
    return [float(p) <= cutoff if np.isfinite(float(p)) else False for p in pvalues]


def heldout_archetype_split(
    archetypes: Iterable[str],
    *,
    train: Iterable[str] | None = None,
    seed: int = 0,
) -> tuple[set[str], set[str]]:
    """Return the declared train/test archetype partition for tuning protocols."""
    del seed  # The default split is pre-declared, not sampled from performance.
    all_archetypes = set(archetypes)
    if train is None:
        train_set = set(DEFAULT_HELDOUT_TRAIN_ARCHETYPES) & all_archetypes
    else:
        train_set = set(train)
    missing = train_set - all_archetypes
    if missing:
        missing_list = ", ".join(sorted(missing))
        raise ValueError(f"train archetypes not present: {missing_list}")

    test_set = all_archetypes - train_set
    if not train_set:
        raise ValueError("train split must not be empty")
    if not test_set:
        raise ValueError("held-out test split must not be empty")
    return train_set, test_set
