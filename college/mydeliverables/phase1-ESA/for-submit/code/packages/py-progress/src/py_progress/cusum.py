from __future__ import annotations

from datetime import datetime

from py_progress.config import CUSUM_SLACK_FACTOR, CUSUM_THRESHOLD_FACTOR
from py_progress.dates import date_to_ms
from py_progress.types import (
    CUSUMResult,
    RecalibrationResolution,
    RegimeShiftResult,
    SessionEvent,
)


def run_cusum(
    pace_ratios: list[float],
    reference_mean: float,
    std: float,
) -> CUSUMResult:
    n = len(pace_ratios)
    if n < 3:
        return CUSUMResult(
            breakpoints=[],
            upperAccumulator=[0.0] * n,
            lowerAccumulator=[0.0] * n,
        )

    effective_std = 0.05 if std < 1e-6 else std
    k = CUSUM_SLACK_FACTOR * effective_std
    h = CUSUM_THRESHOLD_FACTOR * effective_std

    upper_accumulator: list[float] = [0.0] * n
    lower_accumulator: list[float] = [0.0] * n
    breakpoints: list[int] = []
    current_ref = reference_mean

    for i in range(n):
        z = pace_ratios[i] - current_ref
        prev_upper = upper_accumulator[i - 1] if i > 0 else 0.0
        prev_lower = lower_accumulator[i - 1] if i > 0 else 0.0

        upper_accumulator[i] = max(0.0, prev_upper + z - k)
        lower_accumulator[i] = min(0.0, prev_lower + z + k)

        if upper_accumulator[i] > h or lower_accumulator[i] < -h:
            breakpoints.append(i)
            upper_accumulator[i] = 0.0
            lower_accumulator[i] = 0.0
            start = max(0, i - 4)
            recent = pace_ratios[start : i + 1]
            current_ref = sum(recent) / len(recent)

    return CUSUMResult(
        breakpoints=breakpoints,
        upperAccumulator=upper_accumulator,
        lowerAccumulator=lower_accumulator,
    )


def detect_regime_shifts(
    sessions: list[SessionEvent],
    exceptional_ids: set[str],
    posterior_mean: float,
    resolutions: list[RecalibrationResolution],
) -> RegimeShiftResult:
    active_sessions = [
        s
        for s in sessions
        if s.get("source") == "active"
        and s.get("plannedMinutes") is not None
        and s["plannedMinutes"] > 0
        and s.get("activeMinutes") is not None
        and s["activeMinutes"] > 0
        and (not s.get("sessionId") or s["sessionId"] not in exceptional_ids)
    ]

    if len(active_sessions) < 3:
        return RegimeShiftResult(
            breakpoints=[],
            promptNeeded=False,
            cusumState={"upper": 0.0, "lower": 0.0},
        )

    pace_ratios = [s["activeMinutes"] / s["plannedMinutes"] for s in active_sessions]

    mean = sum(pace_ratios) / len(pace_ratios)
    sum_sq = sum((r - mean) ** 2 for r in pace_ratios)
    std = (sum_sq / (len(pace_ratios) - 1)) ** 0.5

    reference_mean = posterior_mean

    last_resolution = resolutions[-1] if resolutions else None

    if last_resolution and last_resolution["resolution"] == "acknowledged":
        resolved_time = datetime.fromisoformat(
            last_resolution["resolvedAt"].replace("Z", "+00:00")
        ).timestamp() * 1000
        sessions_after = [
            s for s in active_sessions if date_to_ms(s["date"]) > resolved_time
        ]
        if sessions_after:
            after_ratios = [
                s["activeMinutes"] / s["plannedMinutes"] for s in sessions_after
            ]
            reference_mean = sum(after_ratios) / len(after_ratios)

    result = run_cusum(pace_ratios, reference_mean, std)

    last_breakpoint = result.breakpoints[-1] if result.breakpoints else None

    prompt_needed = False
    if last_breakpoint is not None:
        if not last_resolution:
            prompt_needed = True
        else:
            resolved_time = datetime.fromisoformat(
                last_resolution["resolvedAt"].replace("Z", "+00:00")
            ).timestamp() * 1000
            breakpoint_session = active_sessions[last_breakpoint]
            breakpoint_time = date_to_ms(breakpoint_session["date"])
            prompt_needed = breakpoint_time > resolved_time

    n = len(pace_ratios)
    return RegimeShiftResult(
        breakpoints=result.breakpoints,
        promptNeeded=prompt_needed,
        cusumState={
            "upper": result.upperAccumulator[n - 1] if n > 0 else 0.0,
            "lower": result.lowerAccumulator[n - 1] if n > 0 else 0.0,
        },
    )
