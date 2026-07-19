from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import numpy as np

from py_progress.bayesian import infer_day_of_week, infer_time_of_day
from py_progress.config import BAYESIAN_PRIOR_MEAN, BAYESIAN_PRIOR_VARIANCE


@dataclass(frozen=True)
class EnrichedShrinkageFit:
    coefficients: tuple[float, ...]
    residual_variance: float
    session_count: int


ENRICHED_FEATURE_NAMES = (
    "intercept",
    "anchor",
    "practice",
    "morning",
    "evening",
    "weekend",
    "same_day_extra",
    "planned_progress",
    "deadline_urgency",
    "recency",
)


def _context_timestamp(next_context: dict[str, Any]) -> str | None:
    raw = (
        next_context.get("startedAt")
        or next_context.get("started_at")
        or next_context.get("date")
    )
    return str(raw) if raw is not None else None


def _context_role(next_context: dict[str, Any]) -> str:
    return str(
        next_context.get("materialRole")
        or next_context.get("material_role")
        or next_context.get("role")
        or "foundation"
    )


def _context_time_of_day(next_context: dict[str, Any]) -> str:
    explicit = next_context.get("timeOfDay") or next_context.get("time_of_day")
    if explicit is not None:
        return str(explicit)
    return infer_time_of_day(_context_timestamp(next_context))


def _context_day_of_week(next_context: dict[str, Any]) -> str:
    explicit = next_context.get("dayOfWeek") or next_context.get("day_of_week")
    if explicit is not None:
        return str(explicit)
    return infer_day_of_week(_context_timestamp(next_context))


def _context_date(next_context: dict[str, Any]) -> str | None:
    timestamp = _context_timestamp(next_context)
    return timestamp[:10] if timestamp else None


def _planned_horizon(next_context: dict[str, Any]) -> dict[str, Any]:
    raw = next_context.get("planned_horizon") or next_context.get("plannedHorizon") or {}
    return dict(raw) if isinstance(raw, dict) else {}


def _session_index(next_context: dict[str, Any], fallback: int) -> int:
    raw = next_context.get("session_index") or next_context.get("sessionIndex")
    if raw is None:
        return fallback
    return max(0, int(raw))


def _same_day_count(history: list[dict], next_context: dict[str, Any]) -> int:
    target_date = _context_date(next_context)
    if target_date is None:
        return 1
    previous = sum(1 for session in history if _context_date(session) == target_date)
    return previous + 1


def _days_since_epoch(day: str | None) -> int | None:
    if day is None:
        return None
    from datetime import date

    return date.fromisoformat(day).toordinal()


def _deadline_urgency(history: list[dict], next_context: dict[str, Any]) -> float:
    horizon = _planned_horizon(next_context)
    deadline = _days_since_epoch(
        str(horizon.get("deadline")) if horizon.get("deadline") else None
    )
    current = _days_since_epoch(_context_date(next_context))
    first = _days_since_epoch(_context_date(history[0])) if history else current
    if deadline is None or current is None or first is None:
        return 0.0
    total_span = max(1, deadline - first)
    days_remaining = max(0, deadline - current)
    return float(max(0.0, min(1.0, 1.0 - days_remaining / total_span)))


def _planned_progress(next_context: dict[str, Any], fallback_index: int) -> float:
    horizon = _planned_horizon(next_context)
    planned_total = int(horizon.get("planned_total_sessions") or 0)
    if planned_total <= 1:
        return 0.0
    index = _session_index(next_context, fallback_index)
    return float(max(0.0, min(1.0, index / (planned_total - 1))))


def _enriched_feature_row(
    history: list[dict],
    next_context: dict[str, Any],
    *,
    fallback_index: int,
) -> np.ndarray:
    role = _context_role(next_context)
    time_of_day = _context_time_of_day(next_context)
    day_of_week = _context_day_of_week(next_context)
    planned_progress = _planned_progress(next_context, fallback_index)
    planned_total = int(_planned_horizon(next_context).get("planned_total_sessions") or 0)
    recency_denominator = max(1, planned_total - 1, fallback_index)
    return np.asarray(
        [
            1.0,
            1.0 if role == "anchor" else 0.0,
            1.0 if role == "practice" else 0.0,
            1.0 if time_of_day == "morning" else 0.0,
            1.0 if time_of_day == "evening" else 0.0,
            1.0 if day_of_week == "weekend" else 0.0,
            float(max(0, _same_day_count(history, next_context) - 1)),
            planned_progress,
            _deadline_urgency(history, next_context),
            float(max(0.0, min(1.0, fallback_index / recency_denominator))),
        ],
        dtype=float,
    )


def _active_sessions(sessions: list[dict]) -> list[dict]:
    return [
        session
        for session in sessions
        if session.get("source") == "active"
        and session.get("plannedMinutes") is not None
        and session.get("activeMinutes") is not None
        and float(session["plannedMinutes"]) > 0
        and float(session["activeMinutes"]) > 0
    ]


def _safe_log(value: float) -> float:
    return math.log(max(value, 1e-9))


def _posterior_interval(
    center: float,
    residual_variance: float,
    n: int,
) -> tuple[float, float] | None:
    if n < 1:
        return None
    se = math.sqrt(max(residual_variance, 0.001) / max(1, n))
    log_center = _safe_log(center)
    return (
        float(math.exp(log_center - 1.96 * se)),
        float(math.exp(log_center + 1.96 * se)),
    )


@dataclass(frozen=True)
class EnrichedShrinkageCalibrator:
    name: str = "enriched_shrink"
    ridge: float = 2.0
    shrink: float = 6.0
    population_prior: tuple[float, ...] = ()

    def _prior(self) -> np.ndarray:
        if self.population_prior:
            values = np.asarray(self.population_prior, dtype=float)
            if values.shape == (len(ENRICHED_FEATURE_NAMES),):
                return values
        prior = np.zeros(len(ENRICHED_FEATURE_NAMES), dtype=float)
        prior[0] = _safe_log(BAYESIAN_PRIOR_MEAN)
        return prior

    def fit_coefficients(self, sessions: list[dict]) -> EnrichedShrinkageFit:
        active = _active_sessions(sessions)
        if not active:
            return EnrichedShrinkageFit(
                coefficients=tuple(float(value) for value in self._prior()),
                residual_variance=BAYESIAN_PRIOR_VARIANCE,
                session_count=0,
            )

        rows: list[np.ndarray] = []
        targets: list[float] = []
        for index, session in enumerate(active):
            rows.append(
                _enriched_feature_row(
                    active[:index],
                    session,
                    fallback_index=_session_index(session, index),
                )
            )
            targets.append(
                _safe_log(float(session["activeMinutes"]) / float(session["plannedMinutes"]))
            )

        x = np.vstack(rows)
        y = np.asarray(targets, dtype=float)
        prior = self._prior()
        ridge_penalty = np.diag([0.0, *([self.ridge] * (len(ENRICHED_FEATURE_NAMES) - 1))])
        shrink_penalty = float(self.shrink) * np.eye(len(ENRICHED_FEATURE_NAMES))
        beta = np.linalg.solve(
            x.T @ x + ridge_penalty + shrink_penalty,
            x.T @ y + float(self.shrink) * prior,
        )
        residuals = y - x @ beta
        residual_variance = (
            float(np.var(residuals, ddof=1))
            if len(residuals) > 1
            else BAYESIAN_PRIOR_VARIANCE
        )
        return EnrichedShrinkageFit(
            coefficients=tuple(float(value) for value in beta),
            residual_variance=max(residual_variance, 0.001),
            session_count=len(active),
        )

    def fit_global(self, sessions: list[dict]) -> float:
        fit = self.fit_coefficients(sessions)
        return float(math.exp(fit.coefficients[0]))

    def predict_next(self, sessions: list[dict], next_context: dict[str, Any]) -> float:
        active = _active_sessions(sessions)
        fit = self.fit_coefficients(active)
        row = _enriched_feature_row(
            active,
            next_context,
            fallback_index=_session_index(next_context, len(active)),
        )
        return float(math.exp(float(row @ np.asarray(fit.coefficients, dtype=float))))

    def fit_interval(self, sessions: list[dict]) -> tuple[float, float] | None:
        fit = self.fit_coefficients(sessions)
        return _posterior_interval(
            math.exp(fit.coefficients[0]),
            fit.residual_variance,
            fit.session_count,
        )


@dataclass(frozen=True)
class DualPriorWeightedCalibrator:
    name: str = "enriched_dual_prior"
    ridge: float = 2.0
    shrink: float = 6.0
    reality_prior: tuple[float, ...] = ()
    frozen_prior: tuple[float, ...] = ()
    static_weights: tuple[float, float] = (0.6, 0.4)

    def _members(self) -> tuple[EnrichedShrinkageCalibrator, EnrichedShrinkageCalibrator]:
        return (
            EnrichedShrinkageCalibrator(
                ridge=self.ridge,
                shrink=self.shrink,
                population_prior=self.reality_prior,
            ),
            EnrichedShrinkageCalibrator(
                ridge=self.ridge,
                shrink=self.shrink,
                population_prior=self.frozen_prior,
            ),
        )

    def _weights(self, sessions: list[dict]) -> np.ndarray:
        active = _active_sessions(sessions)
        base = np.asarray(self.static_weights, dtype=float)
        base = base / base.sum()
        if len(active) < 2:
            return base
        members = self._members()
        loo = np.zeros(2, dtype=float)
        for k, member in enumerate(members):
            sse = 0.0
            for i in range(len(active)):
                rest = active[:i] + active[i + 1 :]
                pred = member.predict_next(rest, active[i])
                actual = float(active[i]["activeMinutes"]) / float(active[i]["plannedMinutes"])
                sse += (_safe_log(pred) - _safe_log(actual)) ** 2
            loo[k] = sse / len(active)
        s2 = max(float(np.mean(loo)), 1e-6)
        log_w = np.log(base) - 0.5 * loo / s2
        log_w -= float(np.max(log_w))
        w = np.exp(log_w)
        return w / float(np.sum(w))

    def predict_next(self, sessions: list[dict], next_context: dict[str, Any]) -> float:
        w = self._weights(sessions)
        members = self._members()
        preds = np.asarray([m.predict_next(sessions, next_context) for m in members], dtype=float)
        return float(preds @ w)

    def fit_global(self, sessions: list[dict]) -> float:
        if not _active_sessions(sessions):
            return BAYESIAN_PRIOR_MEAN
        w = self._weights(sessions)
        members = self._members()
        vals = np.asarray([m.fit_global(sessions) for m in members], dtype=float)
        return float(vals @ w)

    def fit_interval(self, sessions: list[dict]) -> tuple[float, float] | None:
        w = self._weights(sessions)
        members = self._members()
        intervals = [m.fit_interval(sessions) for m in members]
        if any(iv is None for iv in intervals):
            return None
        lowers = np.asarray([iv[0] for iv in intervals], dtype=float)
        uppers = np.asarray([iv[1] for iv in intervals], dtype=float)
        return (float(lowers @ w), float(uppers @ w))


# Frozen TRAIN population priors. Provenance:
# research/doc/verification-runs/2026-06-19-a6-final/evidence.json
# fit_on_train_archetypes_only / train_archetypes_seed_lt_20_per_learner_average
# (research_comparison.runners.calibration::_fit_enriched_population_prior).
REALITY_POPULATION_PRIOR: tuple[float, ...] = (
    -0.13021535898759107,
    0.043230211127485256,
    -0.02837212784940994,
    0.07152433448169158,
    0.02358168766937886,
    -0.004818945751361863,
    0.02052383048408439,
    -0.0002366920001415282,
    -0.008956479540894973,
    -0.00023669200014153152,
)
FROZEN_POPULATION_PRIOR: tuple[float, ...] = (
    -0.04571875055479146,
    0.0395639307409536,
    -0.046612134272635615,
    0.08594397155792466,
    0.030435408056741498,
    0.005943879686877318,
    0.020360140308798062,
    0.004186068513064278,
    0.005297293814845727,
    0.004186068513064275,
)

# Phase 0 GO: research/doc/verification-runs/2026-06-20-enriched-dualprior/SUMMARY.md.
PRODUCTION_PRIOR_STRATEGY = "dual_prior"


def production_calibrator() -> DualPriorWeightedCalibrator | EnrichedShrinkageCalibrator:
    """Return the production calibrator used for pace and next-session forecast."""
    if PRODUCTION_PRIOR_STRATEGY == "dual_prior":
        return DualPriorWeightedCalibrator(
            reality_prior=REALITY_POPULATION_PRIOR,
            frozen_prior=FROZEN_POPULATION_PRIOR,
        )
    return EnrichedShrinkageCalibrator(population_prior=REALITY_POPULATION_PRIOR)


__all__ = [
    "DualPriorWeightedCalibrator",
    "ENRICHED_FEATURE_NAMES",
    "EnrichedShrinkageCalibrator",
    "EnrichedShrinkageFit",
    "FROZEN_POPULATION_PRIOR",
    "PRODUCTION_PRIOR_STRATEGY",
    "REALITY_POPULATION_PRIOR",
    "production_calibrator",
]
