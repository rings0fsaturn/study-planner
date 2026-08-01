from __future__ import annotations

from py_progress.config import MIN_SESSIONS_PER_BUCKET
from py_progress.kalman import run_kalman_on_phase
from py_progress.types import (
    HierarchicalResult,
    Phase,
    RegimeShiftResult,
    SessionEvent,
    TrendAnalysis,
)


def analyze_trend(
    sessions: list[SessionEvent],
    exceptional_ids: set[str],
    bayesian_result: HierarchicalResult,
    cusum_result: RegimeShiftResult,
) -> TrendAnalysis:
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

    if not active_sessions:
        return TrendAnalysis(
            phases=[],
            currentPhase=None,
            projectionSlope=0.0,
            projectionUncertainty=1.0,
        )

    pace_ratios = [s["activeMinutes"] / s["plannedMinutes"] for s in active_sessions]

    mean = sum(pace_ratios) / len(pace_ratios)
    sum_sq = sum((r - mean) ** 2 for r in pace_ratios)
    measurement_variance = (
        max(sum_sq / (len(pace_ratios) - 1), 0.001)
        if len(pace_ratios) > 1
        else 0.01
    )

    breakpoints = cusum_result.breakpoints
    segment_starts = [0] + [
        bp + 1 for bp in breakpoints if bp + 1 < len(active_sessions)
    ]
    segment_ends = [
        bp for bp in breakpoints if bp < len(active_sessions)
    ] + [len(active_sessions) - 1]

    segments: list[tuple[int, int]] = []
    for i, start in enumerate(segment_starts):
        end = segment_ends[i] if i < len(segment_ends) else len(active_sessions) - 1
        if start <= end:
            segments.append((start, end))

    if not segments:
        segments.append((0, len(active_sessions) - 1))

    phases: list[Phase] = []
    for start, end in segments:
        segment_ratios = pace_ratios[start : end + 1]
        segment_sessions = active_sessions[start : end + 1]

        if len(segment_ratios) < MIN_SESSIONS_PER_BUCKET:
            seg_mean = sum(segment_ratios) / len(segment_ratios)
            phases.append(
                Phase(
                    startSessionIndex=start,
                    endSessionIndex=end,
                    startDate=segment_sessions[0]["date"],
                    endDate=segment_sessions[-1]["date"],
                    level=seg_mean,
                    slope=0.0,
                    slopeUncertainty=1.0,
                    sessionCount=len(segment_ratios),
                )
            )
        else:
            kalman_result = run_kalman_on_phase(
                segment_ratios,
                bayesian_result.globalPosterior.mean,
                bayesian_result.globalPosterior.variance,
                measurement_variance,
            )
            phases.append(
                Phase(
                    startSessionIndex=start,
                    endSessionIndex=end,
                    startDate=segment_sessions[0]["date"],
                    endDate=segment_sessions[-1]["date"],
                    level=kalman_result.finalLevel,
                    slope=kalman_result.finalSlope,
                    slopeUncertainty=kalman_result.slopeUncertainty,
                    sessionCount=len(segment_ratios),
                )
            )

    current_phase = phases[-1] if phases else None

    return TrendAnalysis(
        phases=phases,
        currentPhase=current_phase,
        projectionSlope=current_phase.slope if current_phase else 0.0,
        projectionUncertainty=current_phase.slopeUncertainty if current_phase else 1.0,
    )
