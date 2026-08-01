from __future__ import annotations

from datetime import UTC, datetime, timedelta

from py_progress.dates import parse_date_only
from py_progress.gp import fit_burn_up_gp
from py_progress.streak import build_streak_grid, calculate_streak
from py_progress.types import (
    BurnUpData,
    CalibrationState,
    CumulativePoint,
    ProgressSnapshot,
    ReplanContext,
    RoadmapInput,
    RoadmapSlot,
    SessionEvent,
    Verdict,
    WeeklyStats,
    WeekSummaryForNarrative,
)


def _to_date_str(d: datetime) -> str:
    return d.astimezone(UTC).strftime("%Y-%m-%d")


def _get_iso_week_start(date_str: str) -> str:
    d = datetime.fromisoformat(f"{date_str}T12:00:00+00:00")
    day = d.weekday()
    diff = -6 if day == 6 else -day
    d = d + timedelta(days=diff)
    return _to_date_str(d)


def _build_planned_cumulative(slots: list[RoadmapSlot]) -> list[CumulativePoint]:
    daily_planned: dict[str, float] = {}
    for slot in slots:
        daily_planned[slot["date"]] = (
            daily_planned.get(slot["date"], 0) + slot["plannedMinutes"]
        )

    cumulative = 0.0
    result: list[CumulativePoint] = []
    for date in sorted(daily_planned.keys()):
        cumulative += daily_planned[date]
        result.append({"date": date, "minutes": cumulative})
    return result


def _build_actual_cumulative(sessions: list[SessionEvent]) -> list[CumulativePoint]:
    daily_actual: dict[str, float] = {}
    for session in sessions:
        daily_actual[session["date"]] = (
            daily_actual.get(session["date"], 0) + session.get("duration", 0)
        )

    cumulative = 0.0
    result: list[CumulativePoint] = []
    for date in sorted(daily_actual.keys()):
        cumulative += daily_actual[date]
        result.append({"date": date, "minutes": cumulative})
    return result


def _find_projected_finish(
    gp_curve: list[dict],
    total_planned: float,
) -> dict:
    if not gp_curve or total_planned <= 0:
        return {"finishDate": None, "confidenceInterval": None}

    finish_date = None
    ci_lower = None
    ci_upper = None

    for point in gp_curve:
        if ci_upper is None and point["upper"] >= total_planned:
            ci_upper = point["date"]
        if finish_date is None and point["mean"] >= total_planned:
            finish_date = point["date"]
        if ci_lower is None and point["lower"] >= total_planned:
            ci_lower = point["date"]

    confidence_interval = [ci_upper, ci_lower] if ci_upper and ci_lower else None

    return {"finishDate": finish_date, "confidenceInterval": confidence_interval}


def _compute_verdict(
    gp_curve: list[dict],
    planned_cumulative: list[CumulativePoint],
    today: str,
) -> Verdict:
    today_gp = next((p for p in gp_curve if p["date"] == today), None)
    today_planned = next((p for p in planned_cumulative if p["date"] <= today), None)

    if not today_gp or not today_planned:
        return "on-track"

    planned_at_today = max(
        (p["minutes"] for p in planned_cumulative if p["date"] <= today),
        default=0,
    )

    if today_gp["lower"] >= planned_at_today:
        return "ahead"
    if today_gp["mean"] >= planned_at_today:
        return "on-track"
    return "slipping"


def _find_up_next(
    slots: list[RoadmapSlot],
    sessions: list[SessionEvent],
    today: str,
) -> RoadmapSlot | None:
    session_dates = {s["date"] for s in sessions}
    for slot in slots:
        if slot["date"] >= today and slot["date"] not in session_dates:
            return slot
    return None


def _compute_weekly_stats(
    sessions: list[SessionEvent],
    slots: list[RoadmapSlot],
    today: str,
    roadmap_start_date: str,
) -> WeeklyStats:
    week_start = _get_iso_week_start(today)
    week_end = parse_date_only(week_start) + timedelta(days=6)
    week_end_str = _to_date_str(week_end)

    week_sessions = [s for s in sessions if week_start <= s["date"] <= week_end_str]
    week_slots = [s for s in slots if week_start <= s["date"] <= week_end_str]

    minutes_by_day: dict[str, float] = {}
    materials_touched: set[str] = set()

    for s in week_sessions:
        minutes_by_day[s["date"]] = minutes_by_day.get(s["date"], 0) + s.get(
            "duration", 0
        )
        if s.get("sessionId"):
            materials_touched.add(s["sessionId"])

    plan_start_week = _get_iso_week_start(roadmap_start_date)
    week_index = int(
        (parse_date_only(week_start) - parse_date_only(plan_start_week)).total_seconds()
        / (7 * 24 * 60 * 60)
    )

    return WeeklyStats(
        weekIndex=week_index,
        weekStartDate=week_start,
        sessionsThisWeek=len(week_sessions),
        minutesThisWeek=sum(s.get("duration", 0) for s in week_sessions),
        plannedMinutesThisWeek=sum(s["plannedMinutes"] for s in week_slots),
        minutesByDay=minutes_by_day,
        materialsTouched=sorted(materials_touched),
    )


def compute_progress(
    sessions: list[SessionEvent],
    roadmap: RoadmapInput,
    _calibration: CalibrationState,
    today: str,
) -> ProgressSnapshot:
    total_planned_minutes = sum(s["plannedMinutes"] for s in roadmap["slots"])
    total_minutes = sum(s.get("duration", 0) for s in sessions)
    completion_percentage = (
        min((total_minutes / total_planned_minutes) * 100, 100)
        if total_planned_minutes > 0
        else 0.0
    )

    streak_result = calculate_streak(sessions, today)

    daily_planned_minutes: dict[str, float] = {}
    for slot in roadmap["slots"]:
        daily_planned_minutes[slot["date"]] = (
            daily_planned_minutes.get(slot["date"], 0) + slot["plannedMinutes"]
        )
    planned_values = list(daily_planned_minutes.values())
    global_avg_daily = (
        sum(planned_values) / len(planned_values) if planned_values else 60.0
    )

    streak_grid = build_streak_grid(
        sessions, today, daily_planned_minutes, global_avg_daily
    )

    planned_cumulative = _build_planned_cumulative(roadmap["slots"])
    actual_cumulative = _build_actual_cumulative(sessions)

    gp_curve_objs = fit_burn_up_gp(
        actual_cumulative,
        roadmap["startDate"],
        roadmap["deadline"],
        today,
    )
    gp_curve = [
        {"date": p.date, "mean": p.mean, "lower": p.lower, "upper": p.upper}
        for p in gp_curve_objs
    ]

    last_actual = actual_cumulative[-1]["minutes"] if actual_cumulative else 0.0
    last_planned = (
        max(
            (p["minutes"] for p in planned_cumulative if p["date"] <= today),
            default=0,
        )
        if planned_cumulative
        else 0.0
    )

    start_date = parse_date_only(roadmap["startDate"])
    end_date = parse_date_only(roadmap["deadline"])
    today_date = parse_date_only(today)
    total_days = max(
        1,
        round((end_date - start_date).total_seconds() / (24 * 60 * 60)),
    )
    day_number = max(
        0,
        round((today_date - start_date).total_seconds() / (24 * 60 * 60)),
    )

    burn_up = BurnUpData(
        planned=planned_cumulative,
        actual=actual_cumulative,
        gpCurve=gp_curve_objs,
        today=today,
        deficit=last_actual - last_planned,
        dayNumber=day_number,
        totalDays=total_days,
    )

    projection = _find_projected_finish(gp_curve, total_planned_minutes)
    verdict = _compute_verdict(gp_curve, planned_cumulative, today)

    finish_date = projection["finishDate"]
    drift_past_deadline = finish_date > roadmap["deadline"] if finish_date else False

    up_next = _find_up_next(roadmap["slots"], sessions, today)
    weekly_stats = _compute_weekly_stats(
        sessions, roadmap["slots"], today, roadmap["startDate"]
    )

    week_summary = WeekSummaryForNarrative(
        weekStartDate=weekly_stats.weekStartDate,
        sessionsLogged=weekly_stats.sessionsThisWeek,
        hoursLogged=round((weekly_stats.minutesThisWeek / 60) * 10) / 10,
        verdict=verdict,
        daysWithActivity=len(weekly_stats.minutesByDay),
        materialsTouched=weekly_stats.materialsTouched,
    )

    replan_context = ReplanContext(
        isPlanDrifted=drift_past_deadline,
        daysOverDeadline=(
            max(
                0,
                round(
                    (
                        parse_date_only(finish_date) - parse_date_only(roadmap["deadline"])
                    ).total_seconds()
                    / (24 * 60 * 60)
                ),
            )
            if finish_date
            else None
        ),
        pinnedSlotCount=0,
        editableSlotCount=len([s for s in roadmap["slots"] if s["date"] >= today]),
    )

    return ProgressSnapshot(
        streak={
            "current": streak_result["current"],
            "longest": streak_result["longest"],
            "grid": streak_grid,
        },
        burnUp=burn_up,
        projection=projection,
        totalMinutes=total_minutes,
        totalPlannedMinutes=total_planned_minutes,
        completionPercentage=completion_percentage,
        verdict=verdict,
        driftPastDeadline=drift_past_deadline,
        upNext=up_next,
        weeklyStats=weekly_stats,
        weekSummaryForNarrative=week_summary,
        replanContext=replan_context,
    )
