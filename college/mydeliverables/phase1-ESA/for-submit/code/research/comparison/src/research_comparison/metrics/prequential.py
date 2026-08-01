from __future__ import annotations

from typing import Any

from research_comparison.baselines.calibration import CalibrationCandidate


def prequential_absolute_errors(
    sessions: list[dict],
    candidate: CalibrationCandidate,
    targets: list[float],
    t_grid: list[int],
) -> list[float]:
    errors: list[float] = []
    for t in t_grid:
        if t >= len(sessions):
            continue
        estimate = candidate.fit_global(sessions[:t])
        errors.append(abs(estimate - targets[t]))
    return errors


def context_prediction_absolute_errors(
    sessions: list[dict],
    candidate: CalibrationCandidate,
    targets: list[float],
    t_grid: list[int],
    next_contexts: list[dict[str, Any]] | None = None,
) -> list[float]:
    contexts = sessions if next_contexts is None else next_contexts
    errors: list[float] = []
    for t in t_grid:
        if t >= len(sessions) or t >= len(targets) or t >= len(contexts):
            continue
        estimate = candidate.predict_next(sessions[:t], contexts[t])
        errors.append(abs(estimate - targets[t]))
    return errors
