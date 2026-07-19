from __future__ import annotations

from typing import Any

from py_progress.bayesian import compute_hierarchical_model, infer_time_of_day
from py_progress.config import BAYESIAN_PRIOR_MEAN
from py_progress.cusum import detect_regime_shifts
from py_progress.enriched import production_calibrator
from py_progress.trend import analyze_trend
from py_progress.types import (
    BayesianPosterior,
    CalibrationState,
    ExceptionalTag,
    PromptDetail,
    PromptSession,
    RecalibrationResolution,
    SessionEvent,
)


def compute_calibration(
    sessions: list[SessionEvent],
    exceptional_tags: list[ExceptionalTag],
    resolutions: list[RecalibrationResolution],
    next_context: dict[str, Any] | None = None,
) -> CalibrationState:
    exceptional_ids: set[str] = set()
    for tag in exceptional_tags:
        if tag["exceptional"]:
            exceptional_ids.add(tag["sessionId"])
        else:
            exceptional_ids.discard(tag["sessionId"])

    bayesian_result = compute_hierarchical_model(sessions, exceptional_ids)

    cusum_result = detect_regime_shifts(
        sessions,
        exceptional_ids,
        bayesian_result.globalPosterior.mean,
        resolutions,
    )

    trend = analyze_trend(sessions, exceptional_ids, bayesian_result, cusum_result)
    visible = [s for s in sessions if s.get("sessionId") not in exceptional_ids]
    calibrator = production_calibrator()
    enriched_pace = calibrator.fit_global(visible)
    interval = calibrator.fit_interval(visible)
    posterior_variance = (
        ((interval[1] - interval[0]) / (2 * 1.96)) ** 2
        if interval
        else bayesian_result.globalPosterior.variance
    )
    forecast = calibrator.predict_next(visible, next_context) if next_context else None

    return CalibrationState(
        globalMultiplier=enriched_pace,
        globalPosterior=BayesianPosterior(
            mean=enriched_pace,
            variance=posterior_variance,
            sessionCount=bayesian_result.globalPosterior.sessionCount,
        ),
        roleMultipliers=bayesian_result.roleMultipliers,
        trend=trend,
        promptNeeded=cusum_result.promptNeeded,
        insightsByContext=bayesian_result.insights,
        nextSessionForecast=forecast,
    )


def get_prompt_detail(
    sessions: list[SessionEvent],
    cusum_breakpoints: list[int],
) -> PromptDetail:
    active_sessions = [
        s
        for s in sessions
        if s.get("source") == "active"
        and s.get("plannedMinutes") is not None
        and s["plannedMinutes"] > 0
        and s.get("activeMinutes") is not None
        and s["activeMinutes"] > 0
    ]

    if not active_sessions or not cusum_breakpoints:
        return PromptDetail(
            sessions=[],
            currentPace=BAYESIAN_PRIOR_MEAN,
            previousPace=BAYESIAN_PRIOR_MEAN,
        )

    last_breakpoint = cusum_breakpoints[-1]
    window_start = last_breakpoint + 1
    window_sessions = active_sessions[
        max(0, window_start - 5) : min(len(active_sessions), window_start + 10)
    ]

    before_breakpoint = active_sessions[
        max(0, last_breakpoint - 5) : last_breakpoint + 1
    ]
    after_breakpoint = active_sessions[last_breakpoint + 1 :]

    previous_pace = (
        sum(s["activeMinutes"] / s["plannedMinutes"] for s in before_breakpoint)
        / len(before_breakpoint)
        if before_breakpoint
        else BAYESIAN_PRIOR_MEAN
    )

    current_pace = (
        sum(s["activeMinutes"] / s["plannedMinutes"] for s in after_breakpoint)
        / len(after_breakpoint)
        if after_breakpoint
        else previous_pace
    )

    return PromptDetail(
        sessions=[
            PromptSession(
                sessionId=s.get("sessionId", ""),
                date=s["date"],
                timeOfDay=infer_time_of_day(s.get("startedAt")),
                sessionTitle="",
                plannedMinutes=s["plannedMinutes"],
                activeMinutes=s["activeMinutes"],
            )
            for s in window_sessions
        ],
        currentPace=current_pace,
        previousPace=previous_pace,
    )
