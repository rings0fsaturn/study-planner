from __future__ import annotations

import importlib
import math
import sys
from pathlib import Path

from py_progress.config import BAYESIAN_PRIOR_MEAN
from py_progress.enriched import (
    REALITY_POPULATION_PRIOR,
    DualPriorWeightedCalibrator,
    EnrichedShrinkageCalibrator,
    production_calibrator,
)


def _session(
    index: int,
    *,
    ratio: float,
    started_at: str,
    planned_total: int = 30,
    role: str = "foundation",
) -> dict:
    planned = 50.0
    return {
        "date": started_at[:10],
        "source": "active",
        "plannedMinutes": planned,
        "activeMinutes": planned * ratio,
        "duration": planned * ratio,
        "materialRole": role,
        "startedAt": started_at,
        "sessionId": f"enriched-{index}",
        "planned_horizon": {
            "deadline": "2026-02-15",
            "planned_total_sessions": planned_total,
        },
        "session_index": index,
    }


def _fixture_sessions() -> list[dict]:
    sessions: list[dict] = []
    for index in range(18):
        day = 5 + index // 2
        hour = 8 if index % 2 == 0 else 19
        same_day_extra = 1 if index % 2 == 1 else 0
        progress = index / 17
        ratio = 0.92 + 0.08 * same_day_extra + 0.20 * progress
        sessions.append(
            _session(
                index,
                ratio=ratio,
                started_at=f"2026-01-{day:02d}T{hour:02d}:00:00Z",
                role="anchor" if index % 3 == 0 else "foundation",
            )
        )
    return sessions


def _research_enriched_class():
    repo_root = Path(__file__).resolve().parents[3]
    research_src = repo_root / "research/comparison/src"
    if str(research_src) not in sys.path:
        sys.path.insert(0, str(research_src))
    module = importlib.import_module("research_comparison.baselines.calibration")
    return module.EnrichedShrinkageCalibrator


def test_production_calibrator_empty_history_uses_neutral_global_prior():
    assert math.isclose(
        production_calibrator().fit_global([]),
        BAYESIAN_PRIOR_MEAN,
        rel_tol=1e-9,
    )


def test_production_calibrator_predict_next_is_finite_positive_and_deterministic():
    sessions = _fixture_sessions()
    next_context = _session(
        18,
        ratio=1.0,
        started_at="2026-01-14T19:00:00Z",
    )
    calibrator = production_calibrator()

    first = calibrator.predict_next(sessions, next_context)
    second = calibrator.predict_next(sessions, next_context)

    assert math.isfinite(first)
    assert first > 0
    assert first == second


def test_enriched_calibrator_matches_research_class_on_fixed_fixture():
    sessions = _fixture_sessions()
    next_context = _session(
        18,
        ratio=1.0,
        started_at="2026-01-14T19:00:00Z",
    )
    research_class = _research_enriched_class()

    production_value = EnrichedShrinkageCalibrator(
        population_prior=REALITY_POPULATION_PRIOR
    ).predict_next(sessions, next_context)
    research_value = research_class(population_prior=REALITY_POPULATION_PRIOR).predict_next(
        sessions,
        next_context,
    )

    assert abs(production_value - research_value) < 1e-9


def test_dual_prior_cold_start_weights_are_reality_favoured_static_weights():
    calibrator = production_calibrator()

    assert isinstance(calibrator, DualPriorWeightedCalibrator)
    weights = calibrator._weights(
        [
            _session(
                0,
                ratio=1.0,
                started_at="2026-01-05T08:00:00Z",
            )
        ]
    )

    assert abs(float(weights[0]) - 0.6) < 1e-9
    assert abs(float(weights[1]) - 0.4) < 1e-9
