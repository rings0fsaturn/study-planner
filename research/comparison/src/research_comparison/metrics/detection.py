from __future__ import annotations

import math
import statistics
from collections.abc import Callable
from typing import Any

SHIFT_TYPES = ("step", "drift")


def _finite_mean(values: list[float]) -> float:
    return float(statistics.fmean(values)) if values else math.inf


def _normalise_shifts(shifts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for shift in shifts:
        shift_type = str(shift["type"])
        if shift_type not in SHIFT_TYPES:
            continue
        out.append({**shift, "onset_index": int(shift["onset_index"]), "type": shift_type})
    return sorted(out, key=lambda row: row["onset_index"])


def score_detections(
    detected_breakpoints: list[int],
    shifts: list[dict[str, Any]],
    n_observations: int,
) -> dict[str, Any]:
    """Match detections to planted shifts and report latency split by shift type."""
    ordered_detections = sorted({int(point) for point in detected_breakpoints if point >= 0})
    remaining = ordered_detections[:]
    normalised_shifts = _normalise_shifts(shifts)
    matched: list[dict[str, Any]] = []

    for shift in normalised_shifts:
        match = next((point for point in remaining if point >= shift["onset_index"]), None)
        if match is None:
            continue
        remaining.remove(match)
        matched.append(
            {
                "shift_type": shift["type"],
                "onset_index": shift["onset_index"],
                "detected_index": match,
                "latency": match - shift["onset_index"],
            }
        )

    by_type: dict[str, dict[str, Any]] = {}
    for shift_type in SHIFT_TYPES:
        type_shifts = [shift for shift in normalised_shifts if shift["type"] == shift_type]
        type_matches = [row for row in matched if row["shift_type"] == shift_type]
        latencies = [float(row["latency"]) for row in type_matches]
        by_type[shift_type] = {
            "n_shifts": len(type_shifts),
            "n_detected": len(type_matches),
            "missed": len(type_shifts) - len(type_matches),
            "mean_latency": _finite_mean(latencies),
            "latencies": latencies,
        }

    false_alarms = len(remaining)
    total_shifts = len(normalised_shifts)
    total_detected = len(matched)
    return {
        "by_type": by_type,
        "matches": matched,
        "false_alarms": false_alarms,
        "false_alarm_rate": false_alarms / max(1, n_observations),
        "true_detection_rate": total_detected / total_shifts if total_shifts else math.nan,
    }


def roc_points(
    pace_ratios: list[float],
    shifts: list[dict[str, Any]],
    detector: Callable[[list[float], float], list[int]],
    thresholds: list[float],
) -> list[dict[str, float]]:
    points: list[dict[str, float]] = []
    for threshold in thresholds:
        score = score_detections(
            detector(pace_ratios, float(threshold)),
            shifts,
            n_observations=len(pace_ratios),
        )
        points.append(
            {
                "threshold": float(threshold),
                "true_detection_rate": float(score["true_detection_rate"]),
                "false_alarm_rate": float(score["false_alarm_rate"]),
            }
        )
    return points


def winner_by_shift_type(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    winners: dict[str, dict[str, Any]] = {}
    deployable_rows = [
        row
        for row in rows
        if row.get("candidate_kind") != "upper_bound"
        and not str(row.get("candidate", "")).startswith("oracle")
    ]
    for shift_type in SHIFT_TYPES:
        candidates = sorted(
            {row["candidate"] for row in deployable_rows if row["shift_type"] == shift_type}
        )
        candidate_scores: dict[str, dict[str, float]] = {}
        for candidate in candidates:
            selected = [
                row
                for row in deployable_rows
                if row["candidate"] == candidate and row["shift_type"] == shift_type
            ]
            if not selected:
                continue
            latencies = [
                float(row["mean_latency"])
                for row in selected
                if math.isfinite(float(row["mean_latency"]))
            ]
            missed = sum(float(row["missed"]) for row in selected)
            false_alarm = statistics.fmean(float(row["false_alarm_rate"]) for row in selected)
            mean_latency = _finite_mean(latencies)
            score = mean_latency + missed * 100.0 + false_alarm * 25.0
            candidate_scores[candidate] = {
                "score": float(score),
                "mean_latency": float(mean_latency),
                "missed": float(missed),
                "false_alarm_rate": float(false_alarm),
            }
        if candidate_scores:
            winner = min(candidate_scores, key=lambda key: candidate_scores[key]["score"])
            winners[shift_type] = {
                "winner": winner,
                "mean_latency": candidate_scores[winner]["mean_latency"],
                "candidates": candidate_scores,
            }
    return winners
