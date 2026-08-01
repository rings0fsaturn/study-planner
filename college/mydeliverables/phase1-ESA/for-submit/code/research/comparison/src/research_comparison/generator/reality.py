from __future__ import annotations

import hashlib
import json
import math
from datetime import date, timedelta
from typing import Any

import numpy as np

from research_comparison.generator.adherence import attempt_probability, choose_source
from research_comparison.generator.capacity import PlannedSlot, build_capacity_plan
from research_comparison.generator.materials import Material
from research_comparison.generator.noise import apply_lognormal_ar1
from research_comparison.generator.types import Shift
from research_comparison.params import (
    AR1_PHI,
    CLIP_HIGH,
    CLIP_LOW,
    MANUAL_FRACTION,
    PARAMS_VERSION_HASH,
)

REALITY_REGIME = "reality_matched"

DEFAULT_MOMENT_BOUNDS: dict[str, Any] = {
    "bounds_version": "fallback-reality-v1",
    "proxy_mapping": "fallback bounds used only when no OULAD moment file is supplied",
    "bounds": {
        "ar1_phi": {"low": 0.20, "high": 0.55},
        "shift_frequency_per_100_days": {"low": 1.0, "high": 5.0},
        "gap_days": {"p50": 2.0, "p75": 4.0, "p90": 10.0, "p95": 21.0},
        "dropout_probability": {"low": 0.15, "high": 0.35},
    },
}


def normalise_moment_bounds(moment_bounds: dict[str, Any] | None) -> dict[str, Any]:
    return moment_bounds or DEFAULT_MOMENT_BOUNDS


def reality_params_hash(moment_bounds: dict[str, Any] | None) -> str:
    selected = normalise_moment_bounds(moment_bounds)
    payload = {
        "regime": REALITY_REGIME,
        "base_params_version_hash": PARAMS_VERSION_HASH,
        "bounds_version": selected.get("bounds_version"),
        "bounds": selected.get("bounds", selected),
    }
    encoded = json.dumps(payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:12]


def _range(
    moment_bounds: dict[str, Any],
    name: str,
    fallback: tuple[float, float],
) -> tuple[float, float]:
    values = moment_bounds.get("bounds", {}).get(name, {})
    low = float(values.get("low", fallback[0]))
    high = float(values.get("high", fallback[1]))
    return (low, max(low, high))


def _sample_range(
    moment_bounds: dict[str, Any],
    name: str,
    fallback: tuple[float, float],
    rng: np.random.Generator,
) -> float:
    low, high = _range(moment_bounds, name, fallback)
    return float(rng.uniform(low, high))


def _gap_quantile(moment_bounds: dict[str, Any], name: str, fallback: float) -> float:
    return float(moment_bounds.get("bounds", {}).get("gap_days", {}).get(name, fallback))


def _clip_probability(value: float) -> float:
    return min(0.98, max(0.02, value))


def sample_continuous_config(
    base_config: dict[str, Any],
    moment_bounds: dict[str, Any],
    rng: np.random.Generator,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Sample learner traits around the named archetype component."""
    config = dict(base_config)
    m_scale = float(rng.lognormal(mean=0.0, sigma=0.07))
    sigma_scale = float(rng.uniform(1.05, 1.45))
    attempt_scale = float(rng.uniform(0.78, 1.08))
    config["m_global"] = float(config["m_global"]) * m_scale
    config["sigma_log"] = min(0.42, max(0.10, float(config["sigma_log"]) * sigma_scale))
    if "attempt_prob" in config:
        config["attempt_prob"] = _clip_probability(float(config["attempt_prob"]) * attempt_scale)
    config["nu_weekend"] = min(
        1.35,
        max(0.85, float(config.get("nu_weekend", 1.0)) * float(rng.lognormal(0.0, 0.06))),
    )
    tau = dict(config.get("tau", {}))
    for key in list(tau):
        tau[key] = min(1.35, max(0.75, float(tau[key]) * float(rng.lognormal(0.0, 0.05))))
    config["tau"] = tau
    config["ar1_phi"] = _sample_range(moment_bounds, "ar1_phi", (0.20, 0.55), rng)
    traits = {
        "m_global_scale": round(m_scale, 6),
        "sigma_scale": round(sigma_scale, 6),
        "attempt_scale": round(attempt_scale, 6),
        "ar1_phi": round(float(config["ar1_phi"]), 6),
        "tau": {key: round(float(value), 6) for key, value in tau.items()},
        "nu_weekend": round(float(config["nu_weekend"]), 6),
    }
    return config, traits


def collect_reality_slots(
    archetype: str,
    config: dict[str, Any],
    materials: list[Material],
    target_sessions: int,
    rng: np.random.Generator,
    moment_bounds: dict[str, Any],
    manual_fraction: float = MANUAL_FRACTION,
) -> tuple[list[tuple[PlannedSlot, str]], dict[str, Any]]:
    gap_low = _gap_quantile(moment_bounds, "p75", 4.0)
    gap_high = _gap_quantile(moment_bounds, "p95", 21.0)
    hiatus_days = int(max(7, min(35, round(float(rng.uniform(gap_low, gap_high))))))
    hiatus_after = max(3, int(target_sessions * float(rng.uniform(0.25, 0.60))))
    slots_needed = max(target_sessions * 7, target_sessions + hiatus_days + 30)
    emitted: list[tuple[PlannedSlot, str]] = []
    hiatus_start: date | None = None
    hiatus_end: date | None = None

    while len(emitted) < target_sessions:
        emitted = []
        hiatus_start = None
        hiatus_end = None
        slots = build_capacity_plan(materials, slots_needed, rng, start_date=date(2026, 1, 5))
        for slot in slots:
            if hiatus_start is None and len(emitted) >= hiatus_after:
                hiatus_start = slot.date
                hiatus_end = slot.date + timedelta(days=hiatus_days)
            in_hiatus = (
                hiatus_start is not None
                and hiatus_end is not None
                and hiatus_start <= slot.date < hiatus_end
            )
            if in_hiatus:
                continue
            prob = attempt_probability(archetype, config, slot, len(emitted), target_sessions)
            if slot.day_of_week in {"saturday", "sunday"}:
                prob *= float(rng.uniform(1.15, 1.45))
            else:
                prob *= float(rng.uniform(0.65, 0.95))
            if hiatus_end is not None and 0 <= (slot.date - hiatus_end).days <= 7:
                prob *= 1.25
            if float(rng.random()) <= _clip_probability(prob):
                emitted.append((slot, choose_source(rng, manual_fraction=manual_fraction)))
                if len(emitted) >= target_sessions:
                    break
        slots_needed *= 2

    planned_emitted = emitted[:target_sessions]
    planned_deadline = planned_emitted[-1][0].date if planned_emitted else None
    dropout_probability = _sample_range(
        moment_bounds,
        "dropout_probability",
        (0.15, 0.35),
        rng,
    )
    dropped_out = bool(target_sessions >= 6 and float(rng.random()) < dropout_probability)
    if dropped_out:
        observed_sessions = max(3, int(round(target_sessions * float(rng.uniform(0.55, 0.88)))))
        emitted = planned_emitted[: min(observed_sessions, max(1, target_sessions - 1))]
    else:
        emitted = planned_emitted

    metadata = {
        "hiatus_start": hiatus_start.isoformat() if hiatus_start else None,
        "hiatus_end": hiatus_end.isoformat() if hiatus_end else None,
        "hiatus_days": hiatus_days,
        "weekend_clustering": "weekend attempt probability boosted, weekday probability damped",
        "planned_deadline": planned_deadline.isoformat() if planned_deadline else None,
        "planned_total_sessions": target_sessions,
        "observed_sessions": len(emitted),
        "dropout_probability": round(float(dropout_probability), 6),
        "dropped_out": dropped_out,
    }
    return emitted, metadata


def build_reality_regime_series(
    n_sessions: int,
    rng: np.random.Generator,
    moment_bounds: dict[str, Any],
) -> tuple[list[float], list[Shift], list[dict[str, Any]]]:
    multipliers = np.ones(n_sessions, dtype=float)
    if n_sessions == 0:
        return [], [], []

    estimated_days = max(float(n_sessions) * 1.4, float(n_sessions))
    shift_frequency = _sample_range(
        moment_bounds,
        "shift_frequency_per_100_days",
        (1.0, 5.0),
        rng,
    )
    count = int(round(shift_frequency / 100.0 * estimated_days))
    count = max(2 if n_sessions >= 12 else 1, min(max(1, n_sessions // 6), max(2, count)))
    low = max(3, int(n_sessions * 0.15))
    high = max(low, min(n_sessions - 3, int(n_sessions * 0.82)))
    candidates = np.arange(low, high + 1)
    replace = len(candidates) < count
    onsets = sorted(int(value) for value in rng.choice(candidates, size=count, replace=replace))

    shifts: list[Shift] = []
    annotations: list[dict[str, Any]] = []
    for index, onset in enumerate(onsets):
        pre_mean = float(multipliers[max(0, onset - 1)])
        if index == 0:
            magnitude = float(rng.uniform(0.14, 0.28))
            factor = 1.0 - magnitude
            multipliers[onset:] *= factor
            label = "relapse"
            shift_type = "step"
            drift_window = None
        elif index == 1:
            magnitude = float(rng.uniform(0.10, 0.24))
            factor = 1.0 + magnitude
            multipliers[onset:] *= factor
            label = "recovery"
            shift_type = "step"
            drift_window = None
        elif index % 2 == 0:
            magnitude = float(rng.uniform(0.08, 0.20))
            direction = float(rng.choice([-1.0, 1.0]))
            factor = 1.0 + direction * magnitude
            multipliers[onset:] *= factor
            label = "multi_shift_step"
            shift_type = "step"
            drift_window = None
        else:
            total = float(rng.choice([-1.0, 1.0]) * rng.uniform(0.08, 0.18))
            end = min(n_sessions, onset + max(2, int(n_sessions * float(rng.uniform(0.10, 0.22)))))
            ramp = np.linspace(0.0, total, end - onset, endpoint=True)
            multipliers[onset:end] *= 1.0 + ramp
            multipliers[end:] *= 1.0 + total
            factor = 1.0 + total
            label = "multi_shift_drift"
            shift_type = "drift"
            drift_window = (onset, end)
        shifts.append(
            Shift(
                onset_index=onset,
                type=shift_type,  # type: ignore[arg-type]
                pre_mean=round(pre_mean, 6),
                post_mean=round(pre_mean * factor, 6),
                drift_window=drift_window,
            )
        )
        annotations.append({"label": label, "onset_index": onset})

    exam_start = max(0, int(n_sessions * float(rng.uniform(0.76, 0.88))))
    exam_peak = float(rng.uniform(1.08, 1.24))
    exam_ramp = np.linspace(1.0, exam_peak, n_sessions - exam_start, endpoint=True)
    multipliers[exam_start:] *= exam_ramp
    annotations.append(
        {
            "label": "exam_crunch_seasonality",
            "onset_index": exam_start,
            "peak_multiplier": round(exam_peak, 6),
        }
    )
    return [round(float(value), 6) for value in multipliers], shifts, annotations


def draw_reality_logged_ratios(
    r_star: list[float],
    emitted_slots: list[tuple[PlannedSlot, str]],
    sigma_log: float,
    rng: np.random.Generator,
    ar1_phi: float,
) -> tuple[list[float], list[float], float, list[float]]:
    if not r_star:
        return [], [], 0.0, []

    true_ratios: list[float] = []
    logged_ratios: list[float] = []
    factors: list[float] = []
    clipped = 0
    active_count = 0
    eta_prev = 0.0
    innovation_base = math.sqrt(max(0.0, 1.0 - ar1_phi**2))
    for latent, (slot, source) in zip(r_star, emitted_slots, strict=True):
        session_scale = math.sqrt(max(15.0, float(slot.planned_minutes)) / 45.0)
        effective_sigma = float(sigma_log) * (0.70 + 0.45 * session_scale)
        heavy_tail = float(rng.standard_t(df=3) / math.sqrt(3.0))
        eta = ar1_phi * eta_prev + innovation_base * effective_sigma * heavy_tail
        eta_prev = eta
        true_ratio = float(latent) * math.exp(eta - 0.5 * effective_sigma**2)
        if source == "active":
            active_count += 1
            bias = -0.035 if slot.planned_minutes >= 60 else 0.0
            misreport_factor = float(math.exp(rng.normal(bias, 0.08 + 0.04 * session_scale)))
        else:
            misreport_factor = 1.0
        logged = true_ratio * misreport_factor
        logged_clipped = min(CLIP_HIGH, max(CLIP_LOW, logged))
        if source == "active":
            clipped += int(logged_clipped != logged)
        true_ratios.append(round(float(true_ratio), 6))
        logged_ratios.append(round(float(logged_clipped), 6))
        factors.append(round(float(misreport_factor), 6))

    if active_count == 0:
        fallback_ratios = apply_lognormal_ar1(r_star, sigma_log, rng, phi=AR1_PHI)[0]
        return fallback_ratios, fallback_ratios, 0.0, [1.0 for _ in fallback_ratios]
    return logged_ratios, true_ratios, clipped / active_count, factors
