from __future__ import annotations

import statistics
from datetime import date
from typing import Any


def _parse(day: str) -> date:
    return date.fromisoformat(day)


def _abs_days(left: str, right: str) -> float:
    return float(abs((_parse(left) - _parse(right)).days))


def _width_days(low: str, high: str) -> float:
    return float(max(0, (_parse(high) - _parse(low)).days))


def projection_metrics(
    forecasts: list[dict[str, Any]],
    true_finish_date: str,
) -> dict[str, float]:
    usable = [
        forecast
        for forecast in forecasts
        if forecast.get("predicted_finish_date")
        and forecast.get("interval_low")
        and forecast.get("interval_high")
    ]
    if not usable:
        return {"coverage": 0.0, "mean_sharpness_days": 0.0, "mean_abs_error_days": 0.0}

    true_date = _parse(true_finish_date)
    covered = sum(
        1
        for forecast in usable
        if _parse(str(forecast["interval_low"])) <= true_date <= _parse(str(forecast["interval_high"]))
    )
    sharpness = [
        _width_days(str(forecast["interval_low"]), str(forecast["interval_high"]))
        for forecast in usable
    ]
    errors = [
        _abs_days(str(forecast["predicted_finish_date"]), true_finish_date)
        for forecast in usable
    ]
    return {
        "coverage": covered / len(usable),
        "mean_sharpness_days": float(statistics.fmean(sharpness)),
        "mean_abs_error_days": float(statistics.fmean(errors)),
    }


def winner_by_band(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    winners: dict[str, dict[str, Any]] = {}
    for band in sorted({row["band"] for row in rows}):
        candidates = sorted({row["candidate"] for row in rows if row["band"] == band})
        scores: dict[str, dict[str, float]] = {}
        for candidate in candidates:
            selected = [
                row for row in rows if row["band"] == band and row["candidate"] == candidate
            ]
            if not selected:
                continue
            error = statistics.fmean(float(row["mean_abs_error_days"]) for row in selected)
            coverage = statistics.fmean(float(row["coverage"]) for row in selected)
            sharpness = statistics.fmean(float(row["mean_sharpness_days"]) for row in selected)
            score = error + abs(0.95 - coverage) * 10.0 + sharpness * 0.01
            scores[candidate] = {
                "score": float(score),
                "mean_abs_error_days": float(error),
                "coverage": float(coverage),
                "mean_sharpness_days": float(sharpness),
            }
        if scores:
            winner = min(scores, key=lambda candidate: scores[candidate]["score"])
            winners[band] = {"winner": winner, "candidates": scores, **scores[winner]}
    return winners
