from __future__ import annotations

import math
from datetime import UTC, timedelta

from py_progress.config import (
    GP_EXTRAPOLATION_CI_INFLATION,
    GP_EXTRAPOLATION_DAYS,
    GP_LENGTH_SCALE,
    GP_NOISE_RATIO,
)
from py_progress.dates import parse_date_only
from py_progress.types import CumulativePoint, GPPoint


def rbf_kernel(
    x1: float,
    x2: float,
    length_scale: float,
    signal_variance: float,
) -> float:
    diff = x1 - x2
    return signal_variance * math.exp(-0.5 * (diff / length_scale) ** 2)


def _compute_kernel_matrix(
    xs: list[float],
    length_scale: float,
    signal_variance: float,
    noise_variance: float | list[float],
) -> list[list[float]]:
    n = len(xs)
    k: list[list[float]] = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            k[i][j] = rbf_kernel(xs[i], xs[j], length_scale, signal_variance)
            if i == j:
                if isinstance(noise_variance, list):
                    k[i][j] += noise_variance[i]
                else:
                    k[i][j] += noise_variance
    return k


def _cross_kernel_matrix(
    xs1: list[float],
    xs2: list[float],
    length_scale: float,
    signal_variance: float,
) -> list[list[float]]:
    n = len(xs1)
    m = len(xs2)
    k: list[list[float]] = [[0.0] * m for _ in range(n)]
    for i in range(n):
        for j in range(m):
            k[i][j] = rbf_kernel(xs1[i], xs2[j], length_scale, signal_variance)
    return k


def cholesky_decompose(a: list[list[float]]) -> list[list[float]]:
    n = len(a)
    chol: list[list[float]] = [[0.0] * n for _ in range(n)]
    jitter = 1e-8

    for i in range(n):
        for j in range(i + 1):
            total = sum(chol[i][k] * chol[j][k] for k in range(j))
            if i == j:
                val = a[i][i] + jitter - total
                chol[i][j] = max(val, 1e-12) ** 0.5
            else:
                chol[i][j] = (a[i][j] - total) / chol[j][j]
    return chol


def _forward_solve(chol: list[list[float]], b: list[float]) -> list[float]:
    n = len(b)
    y = [0.0] * n
    for i in range(n):
        total = sum(chol[i][j] * y[j] for j in range(i))
        y[i] = (b[i] - total) / chol[i][i]
    return y


def _back_solve(chol: list[list[float]], y: list[float]) -> list[float]:
    n = len(y)
    x = [0.0] * n
    for i in range(n - 1, -1, -1):
        total = sum(chol[j][i] * x[j] for j in range(i + 1, n))
        x[i] = (y[i] - total) / chol[i][i]
    return x


def cholesky_solve(chol: list[list[float]], b: list[float]) -> list[float]:
    y = _forward_solve(chol, b)
    return _back_solve(chol, y)


def _linear_fit(xs: list[float], ys: list[float]) -> tuple[float, float]:
    n = len(xs)
    if n < 2:
        return 0.0, ys[0] if ys else 0.0
    x_mean = sum(xs) / n
    y_mean = sum(ys) / n
    num = sum((xs[i] - x_mean) * (ys[i] - y_mean) for i in range(n))
    den = sum((xs[i] - x_mean) ** 2 for i in range(n))
    slope = num / den if den > 0 else 0.0
    intercept = y_mean - slope * x_mean
    return slope, intercept


def _estimate_ar1_phi(residuals: list[float]) -> float:
    if len(residuals) < 3:
        return 0.0
    left = residuals[:-1]
    right = residuals[1:]
    left_mean = sum(left) / len(left)
    right_mean = sum(right) / len(right)
    numerator = sum((x - left_mean) * (y - right_mean) for x, y in zip(left, right))
    denominator = sum((x - left_mean) ** 2 for x in left)
    if denominator <= 0:
        return 0.0
    return max(-0.90, min(0.90, numerator / denominator))


def _heteroscedastic_noise(
    residuals: list[float],
    base_noise_variance: float,
) -> list[float]:
    if not residuals:
        return []
    mean_abs = max(sum(abs(r) for r in residuals) / len(residuals), 1e-6)
    return [
        max(base_noise_variance * 0.25, base_noise_variance * (0.5 + abs(r) / mean_abs))
        for r in residuals
    ]


def gp_regression(
    train_x: list[float],
    train_y: list[float],
    test_x: list[float],
    *,
    likelihood: str = "gaussian",
    ar1: bool = False,
) -> dict[str, list[float]]:
    if likelihood not in {"gaussian", "student_t"}:
        raise ValueError("likelihood must be 'gaussian' or 'student_t'")

    n = len(train_x)
    if n == 0:
        return {
            "mean": [0.0] * len(test_x),
            "variance": [10000.0] * len(test_x),
        }
    if n == 1:
        return {
            "mean": [train_y[0]] * len(test_x),
            "variance": [10000.0] * len(test_x),
        }

    slope, intercept = _linear_fit(train_x, train_y)
    residuals = [train_y[i] - (slope * train_x[i] + intercept) for i in range(n)]

    residual_variance = max(
        sum(r**2 for r in residuals) / len(residuals),
        10.0,
    )
    signal_variance = residual_variance
    noise_variance = GP_NOISE_RATIO * signal_variance

    if likelihood == "gaussian" and not ar1:
        train_noise: float | list[float] = noise_variance
    else:
        train_noise = _heteroscedastic_noise(residuals, noise_variance)

    k = _compute_kernel_matrix(train_x, GP_LENGTH_SCALE, signal_variance, train_noise)
    ks = _cross_kernel_matrix(train_x, test_x, GP_LENGTH_SCALE, signal_variance)
    kss = _compute_kernel_matrix(test_x, GP_LENGTH_SCALE, signal_variance, 0.0)

    chol = cholesky_decompose(k)
    alpha = cholesky_solve(chol, residuals)

    m = len(test_x)
    mu_resid = [0.0] * m
    for j in range(m):
        for i in range(n):
            mu_resid[j] += ks[i][j] * alpha[i]

    variance = [0.0] * m
    for j in range(m):
        ks_col = [ks[i][j] for i in range(n)]
        v = _forward_solve(chol, ks_col)
        v_squared_sum = sum(vi**2 for vi in v)
        variance[j] = max(kss[j][j] - v_squared_sum, 0.0)

    if likelihood == "student_t" or ar1:
        inflation = 1.0
        if likelihood == "student_t":
            df = max(3.0, float(n - 1))
            inflation *= df / max(df - 2.0, 1.0)
        if ar1:
            phi = abs(_estimate_ar1_phi(residuals))
            inflation *= 1.0 / max(1.0 - phi**2, 0.20)
        variance = [v * inflation + noise_variance * (inflation - 1.0) for v in variance]

    mean = [mu_resid[j] + slope * test_x[j] + intercept for j in range(m)]

    return {"mean": mean, "variance": variance}


def _date_to_day_index(date: str, start_date: str) -> int:
    d = parse_date_only(date)
    s = parse_date_only(start_date)
    return round((d - s).total_seconds() / (24 * 60 * 60))


def _day_index_to_date(day_index: int, start_date: str) -> str:
    s = parse_date_only(start_date)
    d = s + timedelta(days=day_index)
    return d.astimezone(UTC).strftime("%Y-%m-%d")


def fit_burn_up_gp(
    actual_points: list[CumulativePoint],
    start_date: str,
    end_date: str,
    today: str,
    *,
    likelihood: str = "gaussian",
    ar1: bool = False,
) -> list[GPPoint]:
    if not actual_points:
        return []

    train_x = [_date_to_day_index(p["date"], start_date) for p in actual_points]
    train_y = [p["minutes"] for p in actual_points]

    today_index = _date_to_day_index(today, start_date)
    end_index = _date_to_day_index(end_date, start_date)
    extra_end = max(end_index, today_index) + GP_EXTRAPOLATION_DAYS

    test_x_values = list(range(extra_end + 1))

    result = gp_regression(train_x, train_y, test_x_values, likelihood=likelihood, ar1=ar1)

    gp_points: list[GPPoint] = []
    for i, x in enumerate(test_x_values):
        std = result["variance"][i] ** 0.5
        is_extrapolation = x > today_index
        inflated_std = std * GP_EXTRAPOLATION_CI_INFLATION if is_extrapolation else std
        mean_val = result["mean"][i]
        gp_points.append(
            GPPoint(
                date=_day_index_to_date(x, start_date),
                mean=max(mean_val, 0.0),
                lower=max(mean_val - 1.96 * inflated_std, 0.0),
                upper=mean_val + 1.96 * inflated_std,
            )
        )

    return gp_points
