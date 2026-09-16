from __future__ import annotations

from datetime import UTC, datetime, timedelta

from py_progress.dates import parse_date_only
from py_progress.types import DayCell, SessionEvent, YearStreakCell


def calculate_streak(
    sessions: list[SessionEvent],
    today: str,
) -> dict[str, int]:
    if not sessions:
        return {"current": 0, "longest": 0}

    unique_dates = sorted({s["date"] for s in sessions})
    if not unique_dates:
        return {"current": 0, "longest": 0}

    longest = 1
    current_run = 1

    for i in range(1, len(unique_dates)):
        prev = parse_date_only(unique_dates[i - 1])
        curr = parse_date_only(unique_dates[i])
        diff_days = round((curr - prev).total_seconds() / (24 * 60 * 60))
        if diff_days == 1:
            current_run += 1
        else:
            longest = max(longest, current_run)
            current_run = 1
    longest = max(longest, current_run)

    last_date = unique_dates[-1]
    today_date = parse_date_only(today)
    last_session_date = parse_date_only(last_date)
    days_since_last = round((today_date - last_session_date).total_seconds() / (24 * 60 * 60))

    if days_since_last > 1:
        return {"current": 0, "longest": longest}

    current = 1
    for i in range(len(unique_dates) - 2, -1, -1):
        curr = parse_date_only(unique_dates[i + 1])
        prev = parse_date_only(unique_dates[i])
        diff = round((curr - prev).total_seconds() / (24 * 60 * 60))
        if diff == 1:
            current += 1
        else:
            break

    return {"current": current, "longest": longest}


def build_streak_grid(
    sessions: list[SessionEvent],
    today: str,
    daily_planned_minutes: dict[str, float],
    global_avg_daily_minutes: float,
) -> list[DayCell]:
    today_date = datetime.fromisoformat(f"{today}T12:00:00+00:00")
    day_of_week = today_date.weekday()
    monday_offset = -6 if day_of_week == 6 else -day_of_week
    monday = today_date + timedelta(days=monday_offset)

    grid: list[DayCell] = []

    for i in range(7):
        d = monday + timedelta(days=i)
        date_str = d.astimezone(UTC).strftime("%Y-%m-%d")

        day_sessions = [s for s in sessions if s["date"] == date_str]
        total_minutes = 0.0
        for sess in day_sessions:
            if sess.get("duration", 0) > 0:
                total_minutes += sess["duration"]
            elif sess.get("source") == "manual":
                total_minutes += 1

        planned = daily_planned_minutes.get(date_str, global_avg_daily_minutes)
        ratio = total_minutes / planned if planned > 0 else 0.0

        if total_minutes == 0 and not day_sessions:
            level: int = 0
        elif day_sessions and total_minutes == 0:
            level = 1
        elif ratio < 0.50:
            level = 1
        elif ratio < 1.00:
            level = 2
        else:
            level = 3

        if date_str > today:
            level = 0

        grid.append(
            DayCell(
                date=date_str,
                level=level,  # type: ignore[arg-type]
                minutes=total_minutes,
                isToday=date_str == today,
            )
        )

    return grid


def _year_level(total_minutes: float, has_sessions: bool) -> int:
    if not has_sessions:
        return 0
    if total_minutes == 0:
        return 1
    if total_minutes < 15:
        return 1
    if total_minutes < 45:
        return 2
    if total_minutes < 90:
        return 3
    return 4


def build_year_streak_grid(
    sessions: list[SessionEvent],
    today: str,
) -> list[YearStreakCell]:
    today_date = datetime.fromisoformat(f"{today}T12:00:00+00:00")

    # Window: first of the month 11 months back, aligned to its Monday,
    # through the Sunday of today's week. Up to 53 columns.
    total_months = today_date.year * 12 + (today_date.month - 1) - 11
    start_year, start_month_0 = divmod(total_months, 12)
    start = today_date.replace(year=start_year, month=start_month_0 + 1, day=1)
    start_monday = start - timedelta(days=start.weekday())

    end_sunday = today_date + timedelta(days=6 - today_date.weekday())

    by_date: dict[str, dict[str, float]] = {}
    for sess in sessions:
        date_str = sess["date"]
        duration = sess.get("duration", 0)
        minutes = duration if duration > 0 else (1.0 if sess.get("source") == "manual" else 0.0)
        entry = by_date.setdefault(date_str, {"total": 0.0, "count": 0.0})
        entry["total"] += minutes
        entry["count"] += 1

    cells: list[YearStreakCell] = []
    d = start_monday
    while d <= end_sunday:
        date_str = d.astimezone(UTC).strftime("%Y-%m-%d")
        entry = by_date.get(date_str)
        total = entry["total"] if entry else 0.0
        level = 0 if date_str > today else _year_level(total, entry is not None)
        cells.append(
            YearStreakCell(
                date=date_str,
                level=level,  # type: ignore[arg-type]
                minutes=total,
                isToday=date_str == today,
            )
        )
        d += timedelta(days=1)

    return cells
