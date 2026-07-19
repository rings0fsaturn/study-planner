from __future__ import annotations

import json
import math

from py_progress import infer_day_of_week
from research_comparison.baselines.calibration import (
    ArchetypeRouterHardCalibrator,
    ArchetypeSoftCalibrator,
    CovariateBayesCalibrator,
    DualPriorWeightedCalibrator,
    EBPartialPoolCalibrator,
    EnrichedShrinkageCalibrator,
    EWMACalibrator,
    IncumbentCalibration,
    KalmanPaceCalibrator,
    PooledBayesianCalibrator,
    SMACalibrator,
    behavioral_fingerprint,
    calibration_candidates,
)
from research_comparison.generator.generate import (
    DEFAULT_ARCHETYPE_MIX,
    generate_dataset,
    generate_learner,
)
from research_comparison.metrics.aggregate import winner_per_band
from research_comparison.metrics.paired import paired_difference
from research_comparison.metrics.prequential import context_prediction_absolute_errors
from research_comparison.plots.convergence import write_convergence_artifacts
from research_comparison.runners.calibration import prequential_calibration, run_calibration_track


def _flat_sessions(ratio: float = 1.08, n: int = 18):
    return [
        {
            "date": f"2026-01-{index + 1:02d}",
            "source": "active",
            "plannedMinutes": 50.0,
            "activeMinutes": 50.0 * ratio,
            "duration": 50.0 * ratio,
            "materialRole": "foundation",
            "startedAt": f"2026-01-{index + 1:02d}T08:00:00Z",
            "sessionId": f"flat-{index}",
        }
        for index in range(n)
    ]


def _session(
    index: int,
    *,
    ratio: float,
    role: str,
    started_at: str,
    planned: float = 50.0,
) -> dict:
    return {
        "date": started_at[:10],
        "source": "active",
        "plannedMinutes": planned,
        "activeMinutes": planned * ratio,
        "duration": planned * ratio,
        "materialRole": role,
        "startedAt": started_at,
        "sessionId": f"structured-{index}",
    }


def _enriched_session(
    index: int,
    *,
    ratio: float,
    started_at: str,
    planned_total: int = 30,
    role: str = "foundation",
) -> dict:
    session = _session(index, ratio=ratio, role=role, started_at=started_at)
    session["planned_horizon"] = {
        "deadline": "2026-02-15",
        "planned_total_sessions": planned_total,
    }
    session["session_index"] = index
    return session


def _enriched_fixture_sessions() -> list[dict]:
    sessions: list[dict] = []
    for index in range(30):
        day = 5 + index // 2
        hour = 8 if index % 2 == 0 else 19
        same_day_extra = 1 if index % 2 == 1 else 0
        progress = index / 29
        ratio = 0.92 + 0.08 * same_day_extra + 0.28 * progress
        sessions.append(
            _enriched_session(
                index,
                ratio=ratio,
                started_at=f"2026-01-{day:02d}T{hour:02d}:00:00Z",
                role="anchor" if index % 3 == 0 else "foundation",
            )
        )
    return sessions


def _structured_covariate_sessions() -> list[dict]:
    role_effect = {"anchor": 1.12, "foundation": 1.0, "practice": 0.90}
    time_effect = {"morning": 0.88, "afternoon": 1.0, "evening": 1.14}
    day_effect = {"weekday": 1.0, "weekend": 1.08}
    started_at_by_time_day = {
        ("morning", "weekday"): "2026-01-05T08:00:00",
        ("afternoon", "weekday"): "2026-01-06T14:00:00",
        ("evening", "weekday"): "2026-01-07T20:00:00",
        ("morning", "weekend"): "2026-01-10T08:00:00",
        ("afternoon", "weekend"): "2026-01-11T14:00:00",
        ("evening", "weekend"): "2026-01-11T20:00:00",
    }
    sessions: list[dict] = []
    index = 0
    for _repeat in range(4):
        for role, role_multiplier in role_effect.items():
            for (time_of_day, day_kind), started_at in started_at_by_time_day.items():
                ratio = role_multiplier * time_effect[time_of_day] * day_effect[day_kind]
                sessions.append(
                    _session(index, ratio=ratio, role=role, started_at=started_at)
                )
                index += 1
    return sessions


def _small_band_structured_learners() -> list[tuple[list[dict], float]]:
    base_patterns = [
        (
            0.96,
            [
                ("anchor", "2026-01-05T08:00:00", 1.12 * 0.88),
                ("anchor", "2026-01-06T20:00:00", 1.12 * 1.14),
                ("foundation", "2026-01-07T14:00:00", 1.0),
                ("practice", "2026-01-10T20:00:00", 0.90 * 1.14 * 1.08),
            ],
        ),
        (
            1.02,
            [
                ("anchor", "2026-01-11T08:00:00", 1.12 * 0.88 * 1.08),
                ("foundation", "2026-01-12T14:00:00", 1.0),
                ("foundation", "2026-01-13T20:00:00", 1.14),
                ("practice", "2026-01-14T08:00:00", 0.90 * 0.88),
            ],
        ),
        (
            1.08,
            [
                ("anchor", "2026-01-17T20:00:00", 1.12 * 1.14 * 1.08),
                ("foundation", "2026-01-18T08:00:00", 0.88 * 1.08),
                ("practice", "2026-01-19T14:00:00", 0.90),
                ("practice", "2026-01-20T20:00:00", 0.90 * 1.14),
            ],
        ),
    ]
    learners: list[tuple[list[dict], float]] = []
    session_index = 0
    for m_global, pattern in base_patterns:
        sessions: list[dict] = []
        for role, started_at, multiplier in pattern:
            sessions.append(
                _session(
                    session_index,
                    ratio=m_global * multiplier,
                    role=role,
                    started_at=started_at,
                )
            )
            session_index += 1
        learners.append((sessions, m_global))
    return learners


def test_prequential_runner_returns_finite_estimates_for_all_candidates():
    sessions, _truth = generate_learner("steady", "medium", 44)
    active = [session for session in sessions if session["source"] == "active"]
    candidates = [
        IncumbentCalibration(),
        SMACalibrator(window=5),
        EWMACalibrator(alpha=0.35),
        PooledBayesianCalibrator(),
    ]

    for candidate in candidates:
        estimates = prequential_calibration(active, candidate, [3, 5, 8])
        assert len(estimates) == 3
        assert all(math.isfinite(estimate) for _t, estimate in estimates)


def test_baselines_return_float_and_pooled_converges_on_flat_pace():
    sessions = _flat_sessions(ratio=1.08, n=24)

    assert isinstance(SMACalibrator(window=5).fit_global(sessions), float)
    assert isinstance(EWMACalibrator(alpha=0.30).fit_global(sessions), float)
    pooled = PooledBayesianCalibrator().fit_global(sessions)
    assert abs(pooled - 1.08) < 0.04


def test_a4_kalman_calibration_candidate_runs_on_fixture():
    sessions = _flat_sessions(ratio=1.06, n=18)
    candidate = KalmanPaceCalibrator()

    assert "kalman" in {candidate.name for candidate in calibration_candidates()}
    assert isinstance(candidate.fit_global(sessions), float)
    assert isinstance(
        candidate.predict_next(sessions, {"startedAt": "2026-01-20T08:00:00Z"}),
        float,
    )
    interval = candidate.fit_interval(sessions)
    assert interval is not None
    assert interval[0] < candidate.fit_global(sessions) < interval[1]


def test_infer_day_of_week_is_deterministic_for_known_timestamps():
    assert infer_day_of_week("2026-01-05T08:00:00Z") == "weekday"
    assert infer_day_of_week("2026-01-10T20:00:00Z") == "weekend"
    assert infer_day_of_week(None) == "weekday"


def test_covariate_bayes_recovers_planted_bucket_multipliers():
    fit = CovariateBayesCalibrator().fit_effects(_structured_covariate_sessions())

    assert abs(fit.role_multipliers["anchor"] - 1.12) < 0.05
    assert abs(fit.role_multipliers["practice"] - 0.90) < 0.05
    assert abs(fit.time_multipliers["morning"] - 0.88) < 0.05
    assert abs(fit.time_multipliers["evening"] - 1.14) < 0.05
    assert abs(fit.day_multipliers["weekend"] - 1.08) < 0.05


def test_covariate_bayes_uses_neutral_prior_for_unsupported_context_effects():
    sessions = [
        _session(
            0,
            ratio=1.12 * 0.88 * 1.08,
            role="anchor",
            started_at="2026-01-10T08:00:00",
        )
    ]

    fit = CovariateBayesCalibrator().fit_effects(sessions)

    assert abs(fit.role_multipliers["anchor"] - 1.0) < 0.001
    assert abs(fit.time_multipliers["morning"] - 1.0) < 0.001
    assert abs(fit.day_multipliers["weekend"] - 1.0) < 0.001


def test_covariate_predict_next_applies_upcoming_context_multipliers():
    sessions = _structured_covariate_sessions()
    prediction = CovariateBayesCalibrator().predict_next(
        sessions,
        {
            "materialRole": "anchor",
            "startedAt": "2026-01-11T20:00:00",
        },
    )

    expected = 1.12 * 1.14 * 1.08

    assert abs(prediction - expected) < 0.07


def test_enriched_shrink_returns_float_and_finite():
    sessions = _enriched_fixture_sessions()
    candidate = EnrichedShrinkageCalibrator()

    assert "enriched_shrink" in {candidate.name for candidate in calibration_candidates()}
    assert math.isfinite(candidate.fit_global(sessions))
    assert math.isfinite(
        candidate.predict_next(
            sessions[:12],
            _enriched_session(
                12,
                ratio=1.0,
                started_at="2026-01-11T08:00:00Z",
            ),
        )
    )
    interval = candidate.fit_interval(sessions)
    assert interval is not None
    assert interval[0] < candidate.fit_global(sessions) < interval[1]


def test_dual_prior_candidate_registers_and_uses_cold_start_fallback_weights():
    candidate = DualPriorWeightedCalibrator()

    assert "enriched_dual_prior" in {candidate.name for candidate in calibration_candidates()}

    weights = candidate._weights(
        [
            _enriched_session(
                0,
                ratio=1.0,
                started_at="2026-01-05T08:00:00Z",
            )
        ]
    )

    assert abs(float(weights[0]) - 0.6) < 1e-9
    assert abs(float(weights[1]) - 0.4) < 1e-9


def test_enriched_shrink_recovers_planted_fatigue_and_deadline_effects():
    sessions = _enriched_fixture_sessions()
    candidate = EnrichedShrinkageCalibrator(ridge=0.1, shrink=0.1)

    early = candidate.predict_next(
        sessions[:10],
        _enriched_session(
            10,
            ratio=1.0,
            started_at="2026-01-10T08:00:00Z",
        ),
    )
    late = candidate.predict_next(
        sessions[:26],
        _enriched_session(
            26,
            ratio=1.0,
            started_at="2026-01-18T08:00:00Z",
        ),
    )
    first_same_day = candidate.predict_next(
        sessions[:14],
        _enriched_session(
            14,
            ratio=1.0,
            started_at="2026-01-12T08:00:00Z",
        ),
    )
    second_same_day = candidate.predict_next(
        sessions[:15],
        _enriched_session(
            15,
            ratio=1.0,
            started_at="2026-01-12T19:00:00Z",
        ),
    )

    assert late > early
    assert second_same_day > first_same_day


def test_enriched_shrink_predict_next_uses_only_observable_context():
    sessions = _enriched_fixture_sessions()
    candidate = EnrichedShrinkageCalibrator()
    observable_context = _enriched_session(
        20,
        ratio=1.0,
        started_at="2026-01-15T19:00:00Z",
    )
    polluted_context = {
        **observable_context,
        "r_star": 9.9,
        "archetype": "deadline_sprinter",
        "regime_schedule": [{"onset_index": 1}],
    }

    assert candidate.predict_next(sessions[:20], observable_context) == candidate.predict_next(
        sessions[:20],
        polluted_context,
    )


def test_enriched_shrink_no_leakage_under_truth_shuffle():
    sessions = _enriched_fixture_sessions()
    polluted_sessions = [
        {
            **session,
            "r_star": 9.9 - index,
            "sidecar_archetype": "night_owl",
            "regime_schedule": [{"onset_index": index}],
        }
        for index, session in enumerate(sessions)
    ]
    candidate = EnrichedShrinkageCalibrator()
    next_context = _enriched_session(
        25,
        ratio=1.0,
        started_at="2026-01-17T19:00:00Z",
    )

    assert candidate.predict_next(sessions[:25], next_context) == candidate.predict_next(
        polluted_sessions[:25],
        {**next_context, "r_star": -100.0, "sidecar_archetype": "steady"},
    )


def test_fingerprint_is_label_free():
    sessions = _enriched_fixture_sessions()
    polluted = [
        {
            **session,
            "archetype": "deadline_sprinter",
            "r_star": 99.0,
            "regime_schedule": [{"onset_index": index}],
        }
        for index, session in enumerate(sessions)
    ]

    assert behavioral_fingerprint(sessions) == behavioral_fingerprint(polluted)


def test_router_routes_sprinter_toward_crammer_prior():
    sessions = [
        _enriched_session(
            index,
            ratio=0.95 + 0.35 * (index / 29) ** 2,
            started_at=f"2026-01-{5 + index // 2:02d}T19:00:00Z",
            planned_total=30,
        )
        for index in range(30)
    ]
    crammer_fingerprint = behavioral_fingerprint(sessions)
    steady_fingerprint = behavioral_fingerprint(_flat_sessions(ratio=1.0, n=30))
    router = ArchetypeRouterHardCalibrator(
        prototype_fingerprints={
            "crammer": crammer_fingerprint,
            "steady": steady_fingerprint,
        },
        type_priors={
            "crammer": tuple([0.2, *([0.0] * 9)]),
            "steady": tuple([0.0, *([0.0] * 9)]),
        },
    )

    assert router.route_label(sessions) == "crammer"


def test_soft_calibrator_falls_back_to_population_when_ambiguous():
    population = tuple([0.05, *([0.0] * 9)])
    soft = ArchetypeSoftCalibrator(
        population_prior=population,
        prototype_fingerprints={
            "crammer": tuple([0.0] * 5),
            "steady": tuple([0.0] * 5),
        },
        type_priors={
            "crammer": tuple([0.5, *([0.0] * 9)]),
            "steady": tuple([-0.5, *([0.0] * 9)]),
        },
    )

    assert soft.prior_for_history(_enriched_fixture_sessions()) == population


def test_context_prediction_rewards_planted_context_structure():
    sessions = _structured_covariate_sessions()
    targets = [
        float(session["activeMinutes"]) / float(session["plannedMinutes"])
        for session in sessions
    ]
    t_grid = list(range(18, len(sessions) - 1))

    pooled_mae = sum(
        context_prediction_absolute_errors(
            sessions,
            PooledBayesianCalibrator(),
            targets,
            t_grid,
        )
    ) / len(t_grid)
    covariate_mae = sum(
        context_prediction_absolute_errors(
            sessions,
            CovariateBayesCalibrator(),
            targets,
            t_grid,
        )
    ) / len(t_grid)
    eb_mae = sum(
        context_prediction_absolute_errors(
            sessions,
            EBPartialPoolCalibrator(),
            targets,
            t_grid,
        )
    ) / len(t_grid)

    assert covariate_mae < pooled_mae
    assert eb_mae < pooled_mae


def test_eb_partial_pool_beats_pooled_on_structured_small_band_fixture():
    learners = _small_band_structured_learners()
    pooled = PooledBayesianCalibrator()
    eb = EBPartialPoolCalibrator()

    pooled_mae = sum(
        abs(pooled.fit_global(sessions) - m_global) for sessions, m_global in learners
    ) / len(learners)
    eb_mae = sum(
        abs(eb.fit_global(sessions) - m_global) for sessions, m_global in learners
    ) / len(learners)

    assert eb_mae < pooled_mae


def test_paired_difference_recovers_delta_p_value_and_effect_sign():
    result = paired_difference([0.30, 0.25, 0.20, 0.18], [0.35, 0.31, 0.29, 0.23])

    assert result["delta"] < 0
    assert 0 <= result["p_value"] <= 1
    assert result["effect_size"] < 0


def test_winner_per_band_chooses_lower_error_candidate():
    rows = [
        {"band": "small", "archetype": "steady", "candidate": "a", "recovery_mae": 0.20},
        {"band": "small", "archetype": "steady", "candidate": "b", "recovery_mae": 0.10},
        {"band": "medium", "archetype": "steady", "candidate": "a", "recovery_mae": 0.05},
        {"band": "medium", "archetype": "steady", "candidate": "b", "recovery_mae": 0.08},
    ]

    winners = winner_per_band(rows)

    assert winners["small"]["winner"] == "b"
    assert winners["medium"]["winner"] == "a"


def test_tracer_bullet_dataset_compare_figs_produces_artifacts_in_temp_workspace(tmp_path):
    workspace = tmp_path / "research-comparison-tracer"
    datasets_root = workspace / "datasets"
    results_root = workspace / "results"
    generated = workspace / "generated"

    dataset_id = generate_dataset(
        archetype_mix={"steady": 1},
        bands=["small"],
        seeds=[0],
        out_dir=str(datasets_root),
    )
    dataset_dir = datasets_root / dataset_id
    result_path = run_calibration_track(
        dataset_dir=str(dataset_dir),
        out_dir=str(results_root / "calibration"),
    )
    write_convergence_artifacts(result_path, generated_dir=generated)

    pdf = generated / "calibration_convergence.pdf"
    table = generated / "calibration_winners.tex"
    result_files = sorted((results_root / "calibration").glob("*.json"))
    payload = json.loads(result_files[0].read_text())

    assert pdf.exists() and pdf.stat().st_size > 0
    assert table.exists() and table.stat().st_size > 0
    assert result_files
    assert "_provenance" in payload
    assert "enriched_dual_prior" in {row["candidate"] for row in payload["rows"]}
    assert "dual_prior_audit" in payload["population_prior"]


def test_a3_calibration_result_carries_ci_correction_and_heldout_split(tmp_path):
    dataset_id = generate_dataset(
        archetype_mix=DEFAULT_ARCHETYPE_MIX,
        bands=["small"],
        seeds=[0],
        out_dir=str(tmp_path / "datasets"),
    )
    result_path = run_calibration_track(
        dataset_dir=str(tmp_path / "datasets" / dataset_id),
        out_dir=str(tmp_path / "results" / "calibration"),
    )

    payload = json.loads(result_path.read_text())
    split = payload["_provenance"]["archetype_split"]
    paired = payload["paired_vs_incumbent"]["small"]
    first_result = next(iter(paired.values()))

    assert set(split["train"]).isdisjoint(split["held_out"])
    assert payload["scored_split"] == "held_out"
    assert {"delta_ci_low", "delta_ci_high"} <= set(first_result)
    assert payload["mc_correction"]["recovery_mae"]["comparisons"]
    assert (
        payload["mc_correction_reference_baselines"]["enriched_shrink"]["context_pred_mae"][
            "comparisons"
        ]
    )
