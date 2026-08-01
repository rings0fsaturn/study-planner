from __future__ import annotations

import math
import statistics
from collections.abc import Iterable


def _mean(values: list[float]) -> float:
    return float(statistics.fmean(values)) if values else math.nan


def _std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.05
    value = float(statistics.stdev(values))
    return value if value > 1e-6 else 0.05


def _lag1_autocorrelation(values: list[float]) -> float:
    if len(values) < 3:
        return 0.0
    mean = _mean(values)
    numerator = sum((left - mean) * (right - mean) for left, right in zip(values, values[1:]))
    denominator = sum((value - mean) ** 2 for value in values)
    return 0.0 if denominator <= 1e-12 else float(numerator / denominator)


def _median(values: Iterable[float]) -> float:
    selected = list(values)
    return float(statistics.median(selected)) if selected else 0.0


def _mad(values: Iterable[float], center: float) -> float:
    deviations = [abs(value - center) for value in values]
    if not deviations:
        return 0.05
    return max(float(statistics.median(deviations)) * 1.4826, 0.05)


def robust_running_z_scores(pace_ratios: list[float], window: int = 10) -> list[float]:
    if not pace_ratios:
        return []
    baseline = pace_ratios[: min(window, len(pace_ratios))]
    fallback_center = _median(baseline)
    fallback_scale = _mad(baseline, fallback_center)
    z_scores: list[float] = []
    for index, ratio in enumerate(pace_ratios):
        history = pace_ratios[max(0, index - window) : index]
        if len(history) >= 3:
            center = _median(history)
            scale = _mad(history, center)
        else:
            center = fallback_center
            scale = fallback_scale
        z_scores.append(float((ratio - center) / scale))
    return z_scores


def _cusum_from_z(z_scores: list[float], k: float, h: float, min_gap: int) -> list[int]:
    upper = 0.0
    lower = 0.0
    breakpoints: list[int] = []
    last_breakpoint = -min_gap
    for index, z_value in enumerate(z_scores):
        upper = max(0.0, upper + z_value - k)
        lower = min(0.0, lower + z_value + k)
        if index - last_breakpoint < min_gap:
            continue
        if upper > h or lower < -h:
            breakpoints.append(index)
            last_breakpoint = index
            upper = 0.0
            lower = 0.0
    return breakpoints


def detect_cusum_robust(
    pace_ratios: list[float],
    *,
    step_k: float = 0.35,
    step_h: float = 3.0,
    drift_k: float = 0.15,
    drift_h: float = 4.5,
    min_gap: int = 4,
) -> list[int]:
    """CUSUM over robust running-scale z-scores, plus a drift-sensitive arm."""
    if len(pace_ratios) < 3:
        return []
    z_scores = robust_running_z_scores(pace_ratios)
    breakpoints = [
        *_cusum_from_z(z_scores, k=step_k, h=step_h, min_gap=min_gap),
        *_cusum_from_z(z_scores, k=drift_k, h=drift_h, min_gap=max(min_gap, 6)),
        *detect_page_hinkley(
            pace_ratios,
            delta=max(0.0025, drift_k * 0.01),
            threshold=max(0.03, drift_h * 0.015),
            min_gap=max(min_gap, 6),
        ),
    ]
    return sorted(set(breakpoints))


def detect_page_hinkley(
    pace_ratios: list[float],
    delta: float = 0.005,
    threshold: float = 0.06,
    alpha: float = 0.995,
    min_gap: int = 6,
) -> list[int]:
    if len(pace_ratios) < 4:
        return []
    mean = float(pace_ratios[0])
    cumulative = 0.0
    min_cumulative = 0.0
    max_cumulative = 0.0
    breakpoints: list[int] = []
    last_breakpoint = -min_gap
    for index, value in enumerate(pace_ratios[1:], start=1):
        mean = alpha * mean + (1.0 - alpha) * float(value)
        cumulative += float(value) - mean - delta
        min_cumulative = min(min_cumulative, cumulative)
        max_cumulative = max(max_cumulative, cumulative)
        if index - last_breakpoint < min_gap:
            continue
        if cumulative - min_cumulative > threshold or max_cumulative - cumulative > threshold:
            breakpoints.append(index)
            last_breakpoint = index
            cumulative = 0.0
            min_cumulative = 0.0
            max_cumulative = 0.0
            recent = pace_ratios[max(0, index - 5) : index + 1]
            mean = _mean(recent)
    return breakpoints


def detect_adwin(
    pace_ratios: list[float],
    delta: float = 0.01,
    min_window: int = 8,
    min_gap: int = 5,
) -> list[int]:
    if len(pace_ratios) < min_window * 2:
        return []
    window: list[float] = []
    breakpoints: list[int] = []
    last_breakpoint = -min_gap
    for index, value in enumerate(pace_ratios):
        window.append(float(value))
        if len(window) < min_window * 2 or index - last_breakpoint < min_gap:
            continue
        best_cut: int | None = None
        best_margin = 0.0
        for cut in range(min_window, len(window) - min_window + 1):
            left = window[:cut]
            right = window[cut:]
            diff = abs(_mean(left) - _mean(right))
            epsilon = math.sqrt(
                0.5
                * math.log(4.0 / max(delta, 1e-9))
                * (1.0 / len(left) + 1.0 / len(right))
            )
            margin = diff - epsilon
            if margin > best_margin:
                best_margin = margin
                best_cut = cut
        if best_cut is not None and best_margin > 0.0:
            breakpoints.append(index - len(window) + best_cut)
            last_breakpoint = index
            window = window[best_cut:]
    return sorted(set(breakpoints))


def detect_bocpd(
    pace_ratios: list[float],
    hazard: float = 0.04,
    threshold: float = 2.75,
    min_gap: int = 5,
) -> list[int]:
    if len(pace_ratios) < 5:
        return []
    run: list[float] = []
    breakpoints: list[int] = []
    last_breakpoint = -min_gap
    for index, value in enumerate(pace_ratios):
        if len(run) >= 4:
            mean = _mean(run)
            sigma = _std(run)
            surprise = abs(float(value) - mean) / sigma
            posterior_change = min(1.0, hazard * math.exp(min(6.0, surprise)))
            if (
                index - last_breakpoint >= min_gap
                and surprise >= threshold
                and posterior_change > 0.5
            ):
                breakpoints.append(index)
                last_breakpoint = index
                run = [float(value)]
                continue
        run.append(float(value))
        if len(run) > 24:
            run = run[-24:]
    return breakpoints


def detect_ruptures_upper_bound(
    pace_ratios: list[float],
    model: str = "l2",
    min_gap: int = 4,
) -> list[int]:
    if len(pace_ratios) < min_gap * 3:
        return []
    try:
        import numpy as np
        import ruptures as rpt
    except ImportError:
        return []

    signal = np.asarray(pace_ratios, dtype=float)
    penalty = max(1.0, math.log(len(pace_ratios)) * statistics.pvariance(pace_ratios) * 3.0)
    try:
        pelt_points = rpt.Pelt(model=model, min_size=min_gap).fit(signal).predict(pen=penalty)
    except Exception:
        pelt_points = []
    try:
        n_bkps = max(1, min(4, len(pace_ratios) // max(min_gap * 3, 1)))
        binseg_points = rpt.Binseg(model=model, min_size=min_gap).fit(signal).predict(n_bkps=n_bkps)
    except Exception:
        binseg_points = []
    points = [point - 1 for point in [*pelt_points, *binseg_points] if 0 < point < len(pace_ratios)]
    return sorted(set(points))


def detect_ewma(
    pace_ratios: list[float],
    reference_mean: float | None = None,
    std: float | None = None,
    alpha: float = 0.30,
    threshold: float = 2.5,
    min_gap: int = 4,
) -> list[int]:
    """EWMA control chart over pace ratios; returns breakpoint indices."""
    if len(pace_ratios) < 3:
        return []
    baseline_window = pace_ratios[: min(8, len(pace_ratios))]
    reference = _mean(baseline_window) if reference_mean is None else float(reference_mean)
    sigma = _std(baseline_window) if std is None else max(float(std), 0.05)
    sigma_ewma = sigma * math.sqrt(alpha / (2.0 - alpha))

    statistic = reference
    breakpoints: list[int] = []
    last_breakpoint = -min_gap
    for index, ratio in enumerate(pace_ratios):
        statistic = alpha * float(ratio) + (1.0 - alpha) * statistic
        if index - last_breakpoint < min_gap:
            continue
        if abs(statistic - reference) > threshold * sigma_ewma:
            breakpoints.append(index)
            last_breakpoint = index
            recent = pace_ratios[max(0, index - 5) : index + 1]
            reference = _mean(recent)
            statistic = reference
    return breakpoints


def detect_csd(
    pace_ratios: list[float],
    window: int = 8,
    threshold: float = 0.08,
    min_gap: int | None = None,
) -> list[int]:
    """Critical-slowing-down proxy using rising local mean/variance/autocorrelation."""
    if len(pace_ratios) < window * 2:
        return []
    gap = min_gap or window
    breakpoints: list[int] = []
    last_breakpoint = -gap
    for end in range(window * 2, len(pace_ratios) + 1):
        index = end - 1
        if index - last_breakpoint < gap:
            continue
        previous = pace_ratios[end - (window * 2) : end - window]
        current = pace_ratios[end - window : end]
        mean_delta = abs(_mean(current) - _mean(previous))
        previous_var = statistics.pvariance(previous)
        current_var = statistics.pvariance(current)
        variance_ratio = current_var / max(previous_var, 1e-6)
        autocorr_delta = _lag1_autocorrelation(current) - _lag1_autocorrelation(previous)
        if mean_delta >= threshold or variance_ratio >= 1.75 or autocorr_delta >= 0.25:
            breakpoints.append(index)
            last_breakpoint = index
    return breakpoints
