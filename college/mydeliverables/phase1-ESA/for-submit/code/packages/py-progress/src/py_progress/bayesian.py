from __future__ import annotations

from datetime import datetime

from py_progress.config import (
    BAYESIAN_PRIOR_MEAN,
    BAYESIAN_PRIOR_VARIANCE,
    MIN_SESSIONS_PER_BUCKET,
)
from py_progress.types import (
    BayesianPosterior,
    ContextInsight,
    DayOfWeek,
    HierarchicalResult,
    MaterialRole,
    RoleMultiplier,
    SessionEvent,
    TimeOfDay,
)


def update_posterior(
    prior: BayesianPosterior,
    observation: float,
    observation_variance: float,
) -> BayesianPosterior:
    posterior_variance = (prior.variance * observation_variance) / (
        prior.variance + observation_variance
    )
    posterior_mean = (
        prior.variance * observation + observation_variance * prior.mean
    ) / (prior.variance + observation_variance)
    return BayesianPosterior(
        mean=posterior_mean,
        variance=posterior_variance,
        sessionCount=prior.sessionCount + 1,
    )


def infer_time_of_day(started_at: str | None) -> TimeOfDay:
    if not started_at:
        return "afternoon"
    if started_at.endswith("Z"):
        date = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        hour = date.astimezone().hour
    else:
        hour = datetime.fromisoformat(started_at).hour
    if hour < 12:
        return "morning"
    if hour < 17:
        return "afternoon"
    return "evening"


def infer_day_of_week(started_at: str | None) -> DayOfWeek:
    if not started_at:
        return "weekday"
    if started_at.endswith("Z"):
        date = datetime.fromisoformat(started_at.replace("Z", "+00:00")).astimezone()
    else:
        date = datetime.fromisoformat(started_at)
    return "weekend" if date.weekday() >= 5 else "weekday"


def _compute_empirical_variance(ratios: list[float]) -> float:
    if len(ratios) < 2:
        return BAYESIAN_PRIOR_VARIANCE
    mean = sum(ratios) / len(ratios)
    sum_sq = sum((r - mean) ** 2 for r in ratios)
    return max(sum_sq / (len(ratios) - 1), 0.001)


def compute_hierarchical_model(
    sessions: list[SessionEvent],
    exceptional_ids: set[str],
) -> HierarchicalResult:
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
        return HierarchicalResult(
            globalPosterior=BayesianPosterior(
                mean=BAYESIAN_PRIOR_MEAN,
                variance=BAYESIAN_PRIOR_VARIANCE,
                sessionCount=0,
            ),
            globalMultiplier=BAYESIAN_PRIOR_MEAN,
            roleMultipliers={},
            insights=[],
        )

    pace_ratios = [s["activeMinutes"] / s["plannedMinutes"] for s in active_sessions]
    observation_variance = _compute_empirical_variance(pace_ratios)

    global_posterior = BayesianPosterior(
        mean=BAYESIAN_PRIOR_MEAN,
        variance=BAYESIAN_PRIOR_VARIANCE,
        sessionCount=0,
    )
    for ratio in pace_ratios:
        global_posterior = update_posterior(
            global_posterior, ratio, observation_variance
        )

    role_groups: dict[MaterialRole, list[float]] = {}
    for session in active_sessions:
        role = session.get("materialRole")
        if role:
            role_groups.setdefault(role, []).append(
                session["activeMinutes"] / session["plannedMinutes"]
            )

    role_multipliers: dict[str, RoleMultiplier] = {}
    for role, ratios in role_groups.items():
        if len(ratios) >= MIN_SESSIONS_PER_BUCKET:
            role_variance = _compute_empirical_variance(ratios)
            role_posterior = BayesianPosterior(
                mean=global_posterior.mean,
                variance=global_posterior.variance,
                sessionCount=0,
            )
            for ratio in ratios:
                role_posterior = update_posterior(role_posterior, ratio, role_variance)
            role_multipliers[role] = RoleMultiplier(
                multiplier=role_posterior.mean,
                confidence=1 / (role_posterior.variance**0.5),
                sessionCount=len(ratios),
            )

    context_groups: dict[str, dict] = {}
    for session in active_sessions:
        role = session.get("materialRole")
        if role:
            tod = infer_time_of_day(session.get("startedAt"))
            key = f"{role}:{tod}"
            group = context_groups.setdefault(
                key, {"role": role, "timeOfDay": tod, "ratios": []}
            )
            group["ratios"].append(
                session["activeMinutes"] / session["plannedMinutes"]
            )

    insights: list[ContextInsight] = []
    for group in context_groups.values():
        ratios = group["ratios"]
        if len(ratios) >= MIN_SESSIONS_PER_BUCKET:
            role_prior = role_multipliers.get(group["role"])
            prior_mean = role_prior.multiplier if role_prior else global_posterior.mean
            prior_variance = (
                1 / (role_prior.confidence**2)
                if role_prior
                else global_posterior.variance
            )
            context_variance = _compute_empirical_variance(ratios)

            context_posterior = BayesianPosterior(
                mean=prior_mean,
                variance=prior_variance,
                sessionCount=0,
            )
            for ratio in ratios:
                context_posterior = update_posterior(
                    context_posterior, ratio, context_variance
                )

            label = f"{group['role']} in the {group['timeOfDay']}"
            insights.append(
                ContextInsight(
                    role=group["role"],
                    timeOfDay=group["timeOfDay"],
                    multiplier=context_posterior.mean,
                    sessionCount=len(ratios),
                    label=label,
                )
            )

    return HierarchicalResult(
        globalPosterior=global_posterior,
        globalMultiplier=global_posterior.mean,
        roleMultipliers=role_multipliers,
        insights=insights,
    )
