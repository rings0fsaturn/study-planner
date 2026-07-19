from __future__ import annotations

import statistics
from collections import defaultdict
from typing import Any


def _summary(values: list[float]) -> dict[str, float | int]:
    if not values:
        return {"mean": float("nan"), "std": float("nan"), "n": 0}
    return {
        "mean": float(statistics.fmean(values)),
        "std": float(statistics.stdev(values)) if len(values) > 1 else 0.0,
        "n": len(values),
    }


def cell_summary(
    rows: list[dict[str, Any]],
    metric: str = "recovery_mae",
) -> dict[str, Any]:
    grouped: dict[tuple[str, str, str], list[float]] = defaultdict(list)
    for row in rows:
        grouped[(row["band"], row["archetype"], row["candidate"])].append(row[metric])
    return {
        f"{band}:{archetype}:{candidate}": _summary(values)
        for (band, archetype, candidate), values in sorted(grouped.items())
    }


def winner_per_band(
    rows: list[dict[str, Any]],
    metric: str = "recovery_mae",
) -> dict[str, dict[str, Any]]:
    grouped: dict[tuple[str, str], list[float]] = defaultdict(list)
    for row in rows:
        grouped[(row["band"], row["candidate"])].append(row[metric])

    by_band: dict[str, dict[str, Any]] = defaultdict(dict)
    for (band, candidate), values in grouped.items():
        by_band[band][candidate] = _summary(values)

    winners: dict[str, dict[str, Any]] = {}
    for band, candidates in by_band.items():
        winner = min(candidates, key=lambda candidate: candidates[candidate]["mean"])
        winners[band] = {
            "winner": winner,
            "mean_error": candidates[winner]["mean"],
            "candidates": dict(sorted(candidates.items())),
        }
    return dict(sorted(winners.items()))
