from __future__ import annotations

import math
import statistics
from datetime import date, timedelta
from typing import Any

from py_progress import fit_burn_up_gp, run_kalman_on_phase

COLD_START_N = 5


def _parse(day: str) -> date:
    return date.fromisoformat(day)


def _date_to_index(day: str, start_date: str) -> int:
    return (_parse(day) - _parse(start_date)).days


def _index_to_date(index: float, start_date: str) -> str:
    start = _parse(start_date)
    if not math.isfinite(index):
        return (date.max if index > 0 else date.min).isoformat()
    days = round(index)
    min_offset = (date.min - start).days
    max_offset = (date.max - start).days
    bounded_days = min(max(days, min_offset), max_offset)
    return (start + timedelta(days=bounded_days)).isoformat()


def conformal_abs_residual_quantile(residuals: list[float], alpha: float = 0.05) -> float:
    if not residuals:
        return 0.0
    if not 0.0 < alpha < 1.0:
        raise ValueError("alpha must be in (0, 1)")
    ordered = sorted(abs(float(residual)) for residual in residuals)
    rank = math.ceil((len(ordered) + 1) * (1.0 - alpha))
    return ordered[min(max(rank, 1), len(ordered)) - 1]


def _duration_minutes(session: dict[str, Any]) -> float:
    if session.get("source") == "active" and session.get("activeMinutes") is not None:
        return float(session["activeMinutes"])
    return float(session.get("duration") or 0.0)


def cumulative_points(sessions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cumulative = 0.0
    points: list[dict[str, Any]] = []
    for session in sessions:
        cumulative += _duration_minutes(session)
        points.append({"date": session["date"], "minutes": cumulative})
    return points


def _linear_fit(xs: list[float], ys: list[float]) -> tuple[float, float, list[float]]:
    if len(xs) < 2:
        return 0.0, ys[0] if ys else 0.0, []
    x_mean = statistics.fmean(xs)
    y_mean = statistics.fmean(ys)
    denominator = sum((x - x_mean) ** 2 for x in xs)
    slope = (
        sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys, strict=True)) / denominator
        if denominator > 0
        else 0.0
    )
    intercept = y_mean - slope * x_mean
    residuals = [y - (slope * x + intercept) for x, y in zip(xs, ys, strict=True)]
    return float(slope), float(intercept), residuals


def _finish_from_rate(
    total_minutes: float,
    start_date: str,
    slope: float,
    intercept: float,
    residuals: list[float],
    min_width_days: float,
) -> dict[str, Any]:
    safe_slope = max(slope, 1e-6)
    predicted_index = max(0.0, (total_minutes - intercept) / safe_slope)
    residual_std = statistics.stdev(residuals) if len(residuals) > 1 else safe_slope
    width_days = max(min_width_days, 1.96 * residual_std / safe_slope)
    return {
        "predicted_finish_date": _index_to_date(predicted_index, start_date),
        "interval_low": _index_to_date(max(0.0, predicted_index - width_days), start_date),
        "interval_high": _index_to_date(predicted_index + width_days, start_date),
        "sharpness_days": max(1.0, round(width_days * 2.0, 3)),
    }


def _finish_index_from_rate(
    total_minutes: float,
    slope: float,
    intercept: float,
    minimum_index: float = 0.0,
) -> float:
    safe_slope = max(slope, 1e-6)
    return max(minimum_index, (total_minutes - intercept) / safe_slope)


def _daily_actual_totals(sessions: list[dict[str, Any]]) -> list[float]:
    if not sessions:
        return []
    start = _parse(str(sessions[0]["date"]))
    end = _parse(str(sessions[-1]["date"]))
    totals: dict[str, float] = {}
    for session in sessions:
        totals[str(session["date"])] = totals.get(str(session["date"]), 0.0) + _duration_minutes(
            session
        )
    return [
        totals.get((start + timedelta(days=offset)).isoformat(), 0.0)
        for offset in range((end - start).days + 1)
    ]


def forecast_analytic_required_rate(
    sessions: list[dict[str, Any]],
    total_minutes: float,
    start_date: str | None = None,
    horizon_end_date: str | None = None,
) -> dict[str, Any]:
    del horizon_end_date
    points = cumulative_points(sessions)
    if not points:
        today = date.today().isoformat()
        return {
            "candidate": "analytic_required_rate",
            "predicted_finish_date": today,
            "interval_low": today,
            "interval_high": today,
            "sharpness_days": 0.0,
        }

    start = start_date or str(points[0]["date"])
    first = str(points[0]["date"])
    last = str(points[-1]["date"])
    first_index = _date_to_index(first, start)
    last_index = _date_to_index(last, start)
    elapsed_days = max(1.0, float(last_index - first_index + 1))
    consumed_actual = float(points[-1]["minutes"])
    effective_daily = max(consumed_actual / elapsed_days, 1e-6)
    remaining_actual = max(0.0, float(total_minutes) - consumed_actual)
    days_left = remaining_actual / effective_daily
    predicted_index = max(float(last_index), float(last_index) + days_left)

    daily_totals = _daily_actual_totals(sessions)
    recent = daily_totals[-min(14, len(daily_totals)) :]
    rate_std = statistics.stdev(recent) if len(recent) > 1 else effective_daily
    width_days = max(
        1.0,
        1.96
        * max(rate_std, 1e-6)
        / effective_daily
        * math.sqrt(max(days_left, 1.0) / elapsed_days),
    )
    low_index = max(float(last_index), predicted_index - width_days)
    high_index = predicted_index + width_days
    return {
        "candidate": "analytic_required_rate",
        "predicted_finish_date": _index_to_date(predicted_index, start),
        "interval_low": _index_to_date(low_index, start),
        "interval_high": _index_to_date(high_index, start),
        "sharpness_days": max(1.0, round(high_index - low_index, 3)),
    }


def forecast_gp_plus_analytic_finish(
    sessions: list[dict[str, Any]],
    total_minutes: float,
    start_date: str | None = None,
    horizon_end_date: str | None = None,
) -> dict[str, Any]:
    analytic = forecast_analytic_required_rate(
        sessions,
        total_minutes,
        start_date=start_date,
        horizon_end_date=horizon_end_date,
    )
    if len(sessions) < COLD_START_N:
        return {**analytic, "candidate": "gp_plus_analytic"}

    gp = forecast_gp_finish(
        sessions,
        total_minutes,
        start_date=start_date,
        horizon_end_date=horizon_end_date,
    )
    if horizon_end_date and _parse(str(gp["predicted_finish_date"])) >= _parse(horizon_end_date):
        return {**analytic, "candidate": "gp_plus_analytic"}
    return {**gp, "candidate": "gp_plus_analytic"}


def _estimate_lag1_autocorrelation(values: list[float]) -> float:
    if len(values) < 3:
        return 0.0
    left = values[:-1]
    right = values[1:]
    left_mean = statistics.fmean(left)
    right_mean = statistics.fmean(right)
    numerator = sum(
        (x - left_mean) * (y - right_mean) for x, y in zip(left, right, strict=True)
    )
    denominator = sum((x - left_mean) ** 2 for x in left)
    if denominator <= 0.0:
        return 0.0
    return max(-0.90, min(0.90, numerator / denominator))


def forecast_linear_finish(
    sessions: list[dict[str, Any]],
    total_minutes: float,
) -> dict[str, Any]:
    points = cumulative_points(sessions)
    if not points:
        today = date.today().isoformat()
        return {
            "candidate": "linear",
            "predicted_finish_date": today,
            "interval_low": today,
            "interval_high": today,
            "sharpness_days": 0.0,
        }
    start_date = points[0]["date"]
    xs = [_date_to_index(point["date"], start_date) for point in points]
    ys = [float(point["minutes"]) for point in points]
    slope, intercept, residuals = _linear_fit(xs, ys)
    return {
        "candidate": "linear",
        **_finish_from_rate(total_minutes, start_date, slope, intercept, residuals, 1.0),
    }


def _first_crossing(curve: list[dict[str, Any]], key: str, total_minutes: float) -> str:
    for point in curve:
        if float(point[key]) >= total_minutes:
            return str(point["date"])
    return str(curve[-1]["date"])


def forecast_gp_finish(
    sessions: list[dict[str, Any]],
    total_minutes: float,
    start_date: str | None = None,
    horizon_end_date: str | None = None,
) -> dict[str, Any]:
    points = cumulative_points(sessions)
    if not points:
        today = date.today().isoformat()
        return {
            "candidate": "gp_ard",
            "predicted_finish_date": today,
            "interval_low": today,
            "interval_high": today,
            "sharpness_days": 0.0,
        }
    start = start_date or points[0]["date"]
    today = points[-1]["date"]
    end = horizon_end_date or (_parse(today) + timedelta(days=90)).isoformat()
    curve = [point.__dict__ for point in fit_burn_up_gp(points, start, end, today)]
    predicted = _first_crossing(curve, "mean", total_minutes)
    low = _first_crossing(curve, "upper", total_minutes)
    high = _first_crossing(curve, "lower", total_minutes)
    return {
        "candidate": "gp_ard",
        "predicted_finish_date": predicted,
        "interval_low": min(low, high),
        "interval_high": max(low, high),
        "sharpness_days": max(1.0, (_parse(max(low, high)) - _parse(min(low, high))).days),
    }


def _rolling_finish_residuals(
    points: list[dict[str, Any]],
    *,
    alpha: float,
) -> tuple[float, float, float]:
    if len(points) < 4:
        return 1.0, 1.0, 0.0

    start_date = str(points[0]["date"])
    xs = [_date_to_index(str(point["date"]), start_date) for point in points]
    ys = [float(point["minutes"]) for point in points]
    calibration_size = min(10, max(2, math.ceil(len(points) * 0.25)))
    first_calibration = max(2, len(points) - calibration_size)

    residual_days: list[float] = []
    residual_minutes: list[float] = []
    for index in range(first_calibration, len(points)):
        train_x = xs[:index]
        train_y = ys[:index]
        slope, intercept, _residuals = _linear_fit(train_x, train_y)
        predicted_index = _finish_index_from_rate(
            ys[index],
            slope,
            intercept,
            minimum_index=train_x[-1],
        )
        residual_days.append(abs(predicted_index - xs[index]))
        residual_minutes.append(abs(ys[index] - (slope * xs[index] + intercept)))

    q_days = conformal_abs_residual_quantile(residual_days, alpha=alpha)
    q_minutes = conformal_abs_residual_quantile(residual_minutes, alpha=alpha)
    phi = _estimate_lag1_autocorrelation(residual_minutes)
    recent_slope = max(
        (ys[-1] - ys[first_calibration - 1])
        / max(xs[-1] - xs[first_calibration - 1], 1),
        1e-6,
    )
    return q_days, q_minutes / recent_slope, phi


def forecast_conformal_finish(
    sessions: list[dict[str, Any]],
    total_minutes: float,
    start_date: str | None = None,
    horizon_end_date: str | None = None,
    alpha: float = 0.05,
    finish_residual_width_days: float | None = None,
) -> dict[str, Any]:
    points = cumulative_points(sessions)
    if not points:
        today = date.today().isoformat()
        return {
            "candidate": "conformal",
            "predicted_finish_date": today,
            "interval_low": today,
            "interval_high": today,
            "sharpness_days": 0.0,
        }

    base = forecast_gp_finish(
        sessions,
        total_minutes,
        start_date=start_date,
        horizon_end_date=horizon_end_date,
    )
    start = start_date or points[0]["date"]
    today_index = _date_to_index(points[-1]["date"], start)
    predicted_index = _date_to_index(str(base["predicted_finish_date"]), start)
    if finish_residual_width_days is None:
        q_days, q_minutes_days, residual_phi = _rolling_finish_residuals(points, alpha=alpha)
        horizon_scale = math.sqrt(
            max(1.0, predicted_index - today_index) / max(1.0, len(points) * 0.25)
        )
        half_width_days = max(1.0, q_days, q_minutes_days) * max(1.0, horizon_scale)
        ar1_variance_inflation = 1.0 / max(1.0 - residual_phi**2, 0.20)
        half_width_days *= math.sqrt(ar1_variance_inflation)
    else:
        half_width_days = max(1.0, float(finish_residual_width_days))

    low_index = max(0.0, predicted_index - half_width_days)
    high_index = predicted_index + half_width_days
    low = _index_to_date(low_index, start)
    high = _index_to_date(high_index, start)
    return {
        "candidate": "conformal",
        "predicted_finish_date": str(base["predicted_finish_date"]),
        "interval_low": min(low, high),
        "interval_high": max(low, high),
        "sharpness_days": max(1.0, round((high_index - low_index), 3)),
    }


def forecast_gp_hetero_t_finish(
    sessions: list[dict[str, Any]],
    total_minutes: float,
    start_date: str | None = None,
    horizon_end_date: str | None = None,
) -> dict[str, Any]:
    points = cumulative_points(sessions)
    if not points:
        today = date.today().isoformat()
        return {
            "candidate": "gp_hetero_t",
            "predicted_finish_date": today,
            "interval_low": today,
            "interval_high": today,
            "sharpness_days": 0.0,
        }
    start = start_date or points[0]["date"]
    today = points[-1]["date"]
    end = horizon_end_date or (_parse(today) + timedelta(days=90)).isoformat()
    curve = [
        point.__dict__
        for point in fit_burn_up_gp(points, start, end, today, likelihood="student_t", ar1=True)
    ]
    predicted = _first_crossing(curve, "mean", total_minutes)
    low = _first_crossing(curve, "upper", total_minutes)
    high = _first_crossing(curve, "lower", total_minutes)
    return {
        "candidate": "gp_hetero_t",
        "predicted_finish_date": predicted,
        "interval_low": min(low, high),
        "interval_high": max(low, high),
        "sharpness_days": max(1.0, (_parse(max(low, high)) - _parse(min(low, high))).days),
    }


def forecast_kalman_finish(
    sessions: list[dict[str, Any]],
    total_minutes: float,
) -> dict[str, Any]:
    points = cumulative_points(sessions)
    if not points:
        today = date.today().isoformat()
        return {
            "candidate": "kalman",
            "predicted_finish_date": today,
            "interval_low": today,
            "interval_high": today,
            "sharpness_days": 0.0,
        }
    start_date = points[0]["date"]
    xs = [_date_to_index(point["date"], start_date) for point in points]
    ys = [float(point["minutes"]) for point in points]
    increments = [ys[0], *[right - left for left, right in zip(ys, ys[1:])]]
    initial = statistics.fmean(increments[: min(3, len(increments))])
    result = run_kalman_on_phase(increments, initial, 0.20, 0.05)
    raw_slope = result.finalLevel + result.finalSlope
    observed_slope = max(ys[-1] / max(xs[-1] + 1.0, 1.0), 1e-6)
    slope = raw_slope if raw_slope > 1e-6 else observed_slope
    intercept = ys[-1] - slope * xs[-1]
    uncertainty_minutes = max(result.levelUncertainty * 20.0, 10.0)
    width_days = max(1.0, 1.96 * uncertainty_minutes / slope)
    predicted_index = max(xs[-1], (total_minutes - intercept) / slope)
    return {
        "candidate": "kalman",
        "predicted_finish_date": _index_to_date(predicted_index, start_date),
        "interval_low": _index_to_date(max(xs[-1], predicted_index - width_days), start_date),
        "interval_high": _index_to_date(predicted_index + width_days, start_date),
        "sharpness_days": max(1.0, round(width_days * 2.0, 3)),
    }
