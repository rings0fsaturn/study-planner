from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Protocol

import numpy as np

from py_progress import (
    BAYESIAN_PRIOR_MEAN,
    BAYESIAN_PRIOR_VARIANCE,
    compute_hierarchical_model,
    infer_day_of_week,
    infer_time_of_day,
)
from py_progress.kalman import run_kalman_on_phase


class CalibrationCandidate(Protocol):
    name: str

    def fit_global(self, sessions: list[dict]) -> float: ...

    def predict_next(
        self,
        sessions: list[dict],
        next_context: dict[str, Any],
    ) -> float: ...

    def fit_interval(self, sessions: list[dict]) -> tuple[float, float] | None: ...


def active_ratios(sessions: list[dict]) -> list[float]:
    ratios: list[float] = []
    for session in sessions:
        planned = session.get("plannedMinutes")
        active = session.get("activeMinutes")
        if (
            session.get("source") == "active"
            and planned is not None
            and active is not None
            and planned > 0
            and active > 0
        ):
            ratios.append(float(active) / float(planned))
    return ratios


def empirical_variance(values: list[float]) -> float:
    if len(values) < 2:
        return BAYESIAN_PRIOR_VARIANCE
    mean = sum(values) / len(values)
    return max(sum((value - mean) ** 2 for value in values) / (len(values) - 1), 0.001)


@dataclass(frozen=True)
class CalibrationObservation:
    ratio: float
    role: str
    time_of_day: str
    day_of_week: str


@dataclass(frozen=True)
class CovariateEffectFit:
    global_multiplier: float
    role_multipliers: dict[str, float]
    time_multipliers: dict[str, float]
    day_multipliers: dict[str, float]
    residual_variance: float
    session_count: int


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

FINGERPRINT_NAMES = (
    "evening_minus_morning",
    "weekend_minus_weekday",
    "late_minus_early",
    "final_stretch_bump",
    "volatility",
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
    deadline = _days_since_epoch(str(horizon.get("deadline")) if horizon.get("deadline") else None)
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


def _mean_or(values: list[float], fallback: float) -> float:
    return float(sum(values) / len(values)) if values else fallback


def behavioral_fingerprint(sessions: list[dict]) -> tuple[float, ...]:
    active = _active_sessions(sessions)
    ratios = [float(session["activeMinutes"]) / float(session["plannedMinutes"]) for session in active]
    fallback = _mean_or(ratios, BAYESIAN_PRIOR_MEAN)
    by_time = {"morning": [], "evening": []}
    by_day = {"weekday": [], "weekend": []}
    for session, ratio in zip(active, ratios, strict=True):
        time_of_day = _context_time_of_day(session)
        if time_of_day in by_time:
            by_time[time_of_day].append(ratio)
        day = _context_day_of_week(session)
        by_day["weekend" if day == "weekend" else "weekday"].append(ratio)

    midpoint = max(1, len(ratios) // 2)
    early = ratios[:midpoint]
    late = ratios[midpoint:]
    stretch_start = max(0, int(len(ratios) * 0.80))
    final_stretch = ratios[stretch_start:] if ratios else []
    volatility = float(np.std(np.asarray(ratios, dtype=float))) if len(ratios) > 1 else 0.0
    return (
        _mean_or(by_time["evening"], fallback) - _mean_or(by_time["morning"], fallback),
        _mean_or(by_day["weekend"], fallback) - _mean_or(by_day["weekday"], fallback),
        _mean_or(late, fallback) - _mean_or(early, fallback),
        _mean_or(final_stretch, fallback) - fallback,
        volatility,
    )


def _standardized_fingerprint(
    sessions: list[dict],
    center: tuple[float, ...],
    scale: tuple[float, ...],
) -> np.ndarray:
    raw = np.asarray(behavioral_fingerprint(sessions), dtype=float)
    if len(center) != len(FINGERPRINT_NAMES) or len(scale) != len(FINGERPRINT_NAMES):
        return raw
    denominator = np.asarray([value if abs(value) > 1e-9 else 1.0 for value in scale])
    return (raw - np.asarray(center, dtype=float)) / denominator


def _default_enriched_prior() -> tuple[float, ...]:
    return tuple(float(value) for value in EnrichedShrinkageCalibrator()._prior())


def _predict_from_effects(
    fit: CovariateEffectFit,
    next_context: dict[str, Any],
) -> float:
    role = _context_role(next_context)
    time_of_day = _context_time_of_day(next_context)
    day_of_week = _context_day_of_week(next_context)
    return float(
        fit.global_multiplier
        * fit.role_multipliers.get(role, 1.0)
        * fit.time_multipliers.get(time_of_day, 1.0)
        * fit.day_multipliers.get(day_of_week, 1.0)
    )


def _active_observations(sessions: list[dict]) -> list[CalibrationObservation]:
    observations: list[CalibrationObservation] = []
    for session in sessions:
        planned = session.get("plannedMinutes")
        active = session.get("activeMinutes")
        if (
            session.get("source") == "active"
            and planned is not None
            and active is not None
            and planned > 0
            and active > 0
        ):
            started_at = session.get("startedAt") or session.get("date")
            observations.append(
                CalibrationObservation(
                    ratio=float(active) / float(planned),
                    role=str(session.get("materialRole") or "foundation"),
                    time_of_day=infer_time_of_day(started_at),
                    day_of_week=infer_day_of_week(started_at),
                )
            )
    return observations


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


def _sample_variance(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    return float(sum((value - mean) ** 2 for value in values) / (len(values) - 1))


def _eb_effects(
    values_by_group: dict[str, list[float]],
    global_mean: float,
    fallback_variance: float,
) -> dict[str, float]:
    if not values_by_group:
        return {}
    group_means = {
        group: sum(values) / len(values)
        for group, values in values_by_group.items()
    }
    tau_sq = _sample_variance(list(group_means.values()))
    effects: dict[str, float] = {}
    for group, values in values_by_group.items():
        n = len(values)
        sigma_sq = _sample_variance(values) if n > 1 else fallback_variance
        denominator = tau_sq + sigma_sq / max(1, n)
        weight = tau_sq / denominator if denominator > 0 else 0.0
        effects[group] = float(weight * (group_means[group] - global_mean))
    return effects


@dataclass(frozen=True)
class IncumbentCalibration:
    name: str = "hierarchical_bayes"

    def fit_global(self, sessions: list[dict]) -> float:
        return float(compute_hierarchical_model(sessions, set()).globalPosterior.mean)

    def predict_next(self, sessions: list[dict], next_context: dict[str, Any]) -> float:
        del next_context
        return self.fit_global(sessions)

    def fit_interval(self, sessions: list[dict]) -> tuple[float, float] | None:
        posterior = compute_hierarchical_model(sessions, set()).globalPosterior
        radius = 1.96 * math.sqrt(posterior.variance)
        return (float(posterior.mean - radius), float(posterior.mean + radius))


@dataclass(frozen=True)
class SMACalibrator:
    window: int = 8
    name: str = "sma"

    def fit_global(self, sessions: list[dict]) -> float:
        ratios = active_ratios(sessions)
        if not ratios:
            return BAYESIAN_PRIOR_MEAN
        return float(sum(ratios[-self.window :]) / len(ratios[-self.window :]))

    def predict_next(self, sessions: list[dict], next_context: dict[str, Any]) -> float:
        del next_context
        return self.fit_global(sessions)

    def fit_interval(self, sessions: list[dict]) -> tuple[float, float] | None:
        ratios = active_ratios(sessions)
        if not ratios:
            return None
        mean = self.fit_global(sessions)
        radius = 1.96 * math.sqrt(empirical_variance(ratios[-self.window :]))
        return (mean - radius, mean + radius)


@dataclass(frozen=True)
class EWMACalibrator:
    alpha: float = 0.35
    name: str = "ewma"

    def fit_global(self, sessions: list[dict]) -> float:
        estimate = BAYESIAN_PRIOR_MEAN
        for ratio in active_ratios(sessions):
            estimate = self.alpha * ratio + (1.0 - self.alpha) * estimate
        return float(estimate)

    def predict_next(self, sessions: list[dict], next_context: dict[str, Any]) -> float:
        del next_context
        return self.fit_global(sessions)

    def fit_interval(self, sessions: list[dict]) -> tuple[float, float] | None:
        ratios = active_ratios(sessions)
        if not ratios:
            return None
        mean = self.fit_global(sessions)
        radius = 1.96 * math.sqrt(empirical_variance(ratios))
        return (mean - radius, mean + radius)


@dataclass(frozen=True)
class PooledBayesianCalibrator:
    name: str = "pooled_bayes"

    def fit_global(self, sessions: list[dict]) -> float:
        ratios = active_ratios(sessions)
        if not ratios:
            return BAYESIAN_PRIOR_MEAN
        variance = empirical_variance(ratios)
        precision = 1.0 / BAYESIAN_PRIOR_VARIANCE + len(ratios) / variance
        weighted = BAYESIAN_PRIOR_MEAN / BAYESIAN_PRIOR_VARIANCE + sum(ratios) / variance
        return float(weighted / precision)

    def predict_next(self, sessions: list[dict], next_context: dict[str, Any]) -> float:
        del next_context
        return self.fit_global(sessions)

    def fit_interval(self, sessions: list[dict]) -> tuple[float, float] | None:
        ratios = active_ratios(sessions)
        if not ratios:
            return None
        variance = empirical_variance(ratios)
        posterior_variance = 1.0 / (1.0 / BAYESIAN_PRIOR_VARIANCE + len(ratios) / variance)
        mean = self.fit_global(sessions)
        radius = 1.96 * math.sqrt(posterior_variance)
        return (mean - radius, mean + radius)


@dataclass(frozen=True)
class KalmanPaceCalibrator:
    name: str = "kalman"

    def _fit(self, sessions: list[dict]):
        ratios = active_ratios(sessions)
        if not ratios:
            return run_kalman_on_phase(
                [],
                initial_level=BAYESIAN_PRIOR_MEAN,
                initial_variance=BAYESIAN_PRIOR_VARIANCE,
                measurement_variance=BAYESIAN_PRIOR_VARIANCE,
            )
        return run_kalman_on_phase(
            ratios,
            initial_level=BAYESIAN_PRIOR_MEAN,
            initial_variance=BAYESIAN_PRIOR_VARIANCE,
            measurement_variance=empirical_variance(ratios),
        )

    def fit_global(self, sessions: list[dict]) -> float:
        return float(self._fit(sessions).finalLevel)

    def predict_next(self, sessions: list[dict], next_context: dict[str, Any]) -> float:
        del next_context
        return self.fit_global(sessions)

    def fit_interval(self, sessions: list[dict]) -> tuple[float, float] | None:
        ratios = active_ratios(sessions)
        if not ratios:
            return None
        result = self._fit(sessions)
        radius = 1.96 * max(float(result.levelUncertainty), 0.001)
        return (float(result.finalLevel - radius), float(result.finalLevel + radius))


@dataclass(frozen=True)
class CovariateBayesCalibrator:
    ridge: float = 1.0
    name: str = "covariate_bayes"

    def fit_effects(self, sessions: list[dict]) -> CovariateEffectFit:
        observations = _active_observations(sessions)
        if not observations:
            return CovariateEffectFit(
                global_multiplier=BAYESIAN_PRIOR_MEAN,
                role_multipliers={},
                time_multipliers={},
                day_multipliers={},
                residual_variance=BAYESIAN_PRIOR_VARIANCE,
                session_count=0,
            )

        rows: list[list[float]] = []
        targets: list[float] = []
        for observation in observations:
            rows.append(
                [
                    1.0,
                    1.0 if observation.role == "anchor" else 0.0,
                    1.0 if observation.role == "practice" else 0.0,
                    1.0 if observation.time_of_day == "morning" else 0.0,
                    1.0 if observation.time_of_day == "evening" else 0.0,
                    1.0 if observation.day_of_week == "weekend" else 0.0,
                ]
            )
            targets.append(_safe_log(observation.ratio))

        x = np.asarray(rows, dtype=float)
        y = np.asarray(targets, dtype=float)
        penalty = np.diag(
            [0.0, self.ridge, self.ridge, self.ridge, self.ridge, self.ridge]
        )
        beta = np.linalg.solve(x.T @ x + penalty, x.T @ y)
        residuals = y - x @ beta
        residual_variance = (
            float(np.var(residuals, ddof=1))
            if len(residuals) > 1
            else BAYESIAN_PRIOR_VARIANCE
        )
        return CovariateEffectFit(
            global_multiplier=float(math.exp(beta[0])),
            role_multipliers={
                "foundation": 1.0,
                "anchor": float(math.exp(beta[1])),
                "practice": float(math.exp(beta[2])),
            },
            time_multipliers={
                "afternoon": 1.0,
                "morning": float(math.exp(beta[3])),
                "evening": float(math.exp(beta[4])),
            },
            day_multipliers={
                "weekday": 1.0,
                "weekend": float(math.exp(beta[5])),
            },
            residual_variance=max(residual_variance, 0.001),
            session_count=len(observations),
        )

    def fit_global(self, sessions: list[dict]) -> float:
        return self.fit_effects(sessions).global_multiplier

    def predict_next(self, sessions: list[dict], next_context: dict[str, Any]) -> float:
        return _predict_from_effects(self.fit_effects(sessions), next_context)

    def fit_interval(self, sessions: list[dict]) -> tuple[float, float] | None:
        fit = self.fit_effects(sessions)
        return _posterior_interval(
            fit.global_multiplier,
            fit.residual_variance,
            fit.session_count,
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


@dataclass(frozen=True)
class ArchetypeRouterHardCalibrator:
    name: str = "archetype_router_hard"
    ridge: float = 2.0
    shrink: float = 6.0
    population_prior: tuple[float, ...] = ()
    type_priors: dict[str, tuple[float, ...]] = field(default_factory=dict)
    prototype_fingerprints: dict[str, tuple[float, ...]] = field(default_factory=dict)
    fingerprint_center: tuple[float, ...] = ()
    fingerprint_scale: tuple[float, ...] = ()

    def route_label(self, sessions: list[dict]) -> str | None:
        if not self.prototype_fingerprints:
            return None
        fingerprint = _standardized_fingerprint(
            sessions,
            self.fingerprint_center,
            self.fingerprint_scale,
        )
        return min(
            self.prototype_fingerprints,
            key=lambda label: float(
                np.linalg.norm(
                    fingerprint - np.asarray(self.prototype_fingerprints[label], dtype=float)
                )
            ),
        )

    def prior_for_history(self, sessions: list[dict]) -> tuple[float, ...]:
        label = self.route_label(sessions)
        if label is not None and label in self.type_priors:
            return self.type_priors[label]
        return self.population_prior or _default_enriched_prior()

    def _delegate(self, sessions: list[dict]) -> EnrichedShrinkageCalibrator:
        return EnrichedShrinkageCalibrator(
            ridge=self.ridge,
            shrink=self.shrink,
            population_prior=self.prior_for_history(sessions),
        )

    def fit_global(self, sessions: list[dict]) -> float:
        return self._delegate(sessions).fit_global(sessions)

    def predict_next(self, sessions: list[dict], next_context: dict[str, Any]) -> float:
        return self._delegate(sessions).predict_next(sessions, next_context)

    def fit_interval(self, sessions: list[dict]) -> tuple[float, float] | None:
        return self._delegate(sessions).fit_interval(sessions)


@dataclass(frozen=True)
class ArchetypeSoftCalibrator:
    name: str = "archetype_soft"
    ridge: float = 2.0
    shrink: float = 6.0
    temperature: float = 1.0
    ambiguity_threshold: float = 0.55
    population_prior: tuple[float, ...] = ()
    type_priors: dict[str, tuple[float, ...]] = field(default_factory=dict)
    prototype_fingerprints: dict[str, tuple[float, ...]] = field(default_factory=dict)
    fingerprint_center: tuple[float, ...] = ()
    fingerprint_scale: tuple[float, ...] = ()

    def prior_for_history(self, sessions: list[dict]) -> tuple[float, ...]:
        if not self.prototype_fingerprints or not self.type_priors:
            return self.population_prior or _default_enriched_prior()
        fingerprint = _standardized_fingerprint(
            sessions,
            self.fingerprint_center,
            self.fingerprint_scale,
        )
        labels = [label for label in sorted(self.prototype_fingerprints) if label in self.type_priors]
        if not labels:
            return self.population_prior or _default_enriched_prior()
        distances = np.asarray(
            [
                float(
                    np.linalg.norm(
                        fingerprint - np.asarray(self.prototype_fingerprints[label], dtype=float)
                    )
                )
                for label in labels
            ],
            dtype=float,
        )
        scaled = -(distances - float(np.min(distances))) / max(1e-6, self.temperature)
        weights = np.exp(scaled)
        weights = weights / float(np.sum(weights))
        if float(np.max(weights)) < self.ambiguity_threshold:
            return self.population_prior or _default_enriched_prior()
        priors = np.asarray([self.type_priors[label] for label in labels], dtype=float)
        return tuple(float(value) for value in weights @ priors)

    def _delegate(self, sessions: list[dict]) -> EnrichedShrinkageCalibrator:
        return EnrichedShrinkageCalibrator(
            ridge=self.ridge,
            shrink=self.shrink,
            population_prior=self.prior_for_history(sessions),
        )

    def fit_global(self, sessions: list[dict]) -> float:
        return self._delegate(sessions).fit_global(sessions)

    def predict_next(self, sessions: list[dict], next_context: dict[str, Any]) -> float:
        return self._delegate(sessions).predict_next(sessions, next_context)

    def fit_interval(self, sessions: list[dict]) -> tuple[float, float] | None:
        return self._delegate(sessions).fit_interval(sessions)


@dataclass(frozen=True)
class EBPartialPoolCalibrator:
    name: str = "eb_partial_pool"

    def fit_effects(self, sessions: list[dict]) -> CovariateEffectFit:
        observations = _active_observations(sessions)
        if not observations:
            return CovariateEffectFit(
                global_multiplier=BAYESIAN_PRIOR_MEAN,
                role_multipliers={},
                time_multipliers={},
                day_multipliers={},
                residual_variance=BAYESIAN_PRIOR_VARIANCE,
                session_count=0,
            )

        log_ratios = [_safe_log(observation.ratio) for observation in observations]
        global_log = sum(log_ratios) / len(log_ratios)
        fallback_variance = max(_sample_variance(log_ratios), 0.001)

        role_values: dict[str, list[float]] = {}
        for observation, log_ratio in zip(observations, log_ratios, strict=True):
            role_values.setdefault(observation.role, []).append(log_ratio)
        role_effects = _eb_effects(role_values, global_log, fallback_variance)

        role_adjusted = [
            log_ratio - role_effects.get(observation.role, 0.0)
            for observation, log_ratio in zip(observations, log_ratios, strict=True)
        ]
        role_adjusted_mean = sum(role_adjusted) / len(role_adjusted)
        time_values: dict[str, list[float]] = {}
        for observation, adjusted in zip(observations, role_adjusted, strict=True):
            time_values.setdefault(observation.time_of_day, []).append(adjusted)
        time_effects = _eb_effects(time_values, role_adjusted_mean, fallback_variance)

        time_adjusted = [
            adjusted - time_effects.get(observation.time_of_day, 0.0)
            for observation, adjusted in zip(observations, role_adjusted, strict=True)
        ]
        time_adjusted_mean = sum(time_adjusted) / len(time_adjusted)
        day_values: dict[str, list[float]] = {}
        for observation, adjusted in zip(observations, time_adjusted, strict=True):
            day_values.setdefault(observation.day_of_week, []).append(adjusted)
        day_effects = _eb_effects(day_values, time_adjusted_mean, fallback_variance)

        decontextualized = [
            log_ratio
            - role_effects.get(observation.role, 0.0)
            - time_effects.get(observation.time_of_day, 0.0)
            - day_effects.get(observation.day_of_week, 0.0)
            for observation, log_ratio in zip(observations, log_ratios, strict=True)
        ]
        global_estimate = sum(decontextualized) / len(decontextualized)
        residuals = [
            log_ratio
            - global_estimate
            - role_effects.get(observation.role, 0.0)
            - time_effects.get(observation.time_of_day, 0.0)
            - day_effects.get(observation.day_of_week, 0.0)
            for observation, log_ratio in zip(observations, log_ratios, strict=True)
        ]
        residual_variance = max(_sample_variance(residuals), 0.001)
        return CovariateEffectFit(
            global_multiplier=float(math.exp(global_estimate)),
            role_multipliers={
                role: float(math.exp(effect)) for role, effect in role_effects.items()
            },
            time_multipliers={
                time: float(math.exp(effect)) for time, effect in time_effects.items()
            },
            day_multipliers={
                day: float(math.exp(effect)) for day, effect in day_effects.items()
            },
            residual_variance=residual_variance,
            session_count=len(observations),
        )

    def fit_global(self, sessions: list[dict]) -> float:
        return self.fit_effects(sessions).global_multiplier

    def predict_next(self, sessions: list[dict], next_context: dict[str, Any]) -> float:
        return _predict_from_effects(self.fit_effects(sessions), next_context)

    def fit_interval(self, sessions: list[dict]) -> tuple[float, float] | None:
        fit = self.fit_effects(sessions)
        return _posterior_interval(
            fit.global_multiplier,
            fit.residual_variance,
            fit.session_count,
        )


def calibration_candidates() -> list[CalibrationCandidate]:
    return [
        IncumbentCalibration(),
        KalmanPaceCalibrator(),
        CovariateBayesCalibrator(),
        EnrichedShrinkageCalibrator(),
        DualPriorWeightedCalibrator(),
        ArchetypeRouterHardCalibrator(),
        ArchetypeSoftCalibrator(),
        EBPartialPoolCalibrator(),
        SMACalibrator(),
        EWMACalibrator(),
        PooledBayesianCalibrator(),
    ]
