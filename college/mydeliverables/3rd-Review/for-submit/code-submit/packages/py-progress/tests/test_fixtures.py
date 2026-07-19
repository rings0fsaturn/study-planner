from __future__ import annotations

import ctypes
import math
from typing import Any

from py_progress.bayesian import (
    compute_hierarchical_model,
    infer_time_of_day,
    update_posterior,
)
from py_progress.calibration import compute_calibration, get_prompt_detail
from py_progress.cusum import detect_regime_shifts, run_cusum
from py_progress.gp import cholesky_decompose, cholesky_solve, fit_burn_up_gp, gp_regression
from py_progress.kalman import init_kalman, kalman_predict, kalman_update, run_kalman_on_phase
from py_progress.progress import compute_progress
from py_progress.serialize import to_json_value
from py_progress.streak import build_streak_grid, calculate_streak
from py_progress.trend import analyze_trend
from py_progress.types import (
    BayesianPosterior,
    CalibrationState,
    ContextInsight,
    HierarchicalResult,
    RegimeShiftResult,
    RoleMultiplier,
    TrendAnalysis,
)

TOLERANCE = 1e-6


def _s32(x: int) -> int:
    return ctypes.c_int32(x).value


def _u32(x: int) -> int:
    return ctypes.c_uint32(x).value


def _imul(a: int, b: int) -> int:
    return ctypes.c_int32(ctypes.c_int32(a).value * ctypes.c_int32(b).value).value


def _mulberry32(seed: int):
    a = _s32(seed)

    def rng() -> float:
        nonlocal a
        a = _s32(a + 0x6D2B79F5)
        t = _imul(a ^ _u32(a) >> 15, _s32(1) | a)
        t = _s32(_s32(t + _imul(t ^ _u32(t) >> 7, _s32(61) | t)) ^ t)
        return _u32(t ^ _u32(t) >> 14) / 4294967296

    return rng


def _default_bayesian() -> HierarchicalResult:
    return HierarchicalResult(
        globalPosterior=BayesianPosterior(mean=1.0, variance=0.1, sessionCount=10),
        globalMultiplier=1.0,
        roleMultipliers={},
        insights=[],
    )


def _default_cusum(breakpoints: list[int] | None = None) -> RegimeShiftResult:
    return RegimeShiftResult(
        breakpoints=breakpoints or [],
        promptNeeded=False,
        cusumState={"upper": 0.0, "lower": 0.0},
    )


def _parse_calibration(data: dict) -> CalibrationState:
    gp = data["globalPosterior"]
    trend_data = data["trend"]
    phases = [
        type("Phase", (), p)()  # placeholder — unused by compute_progress
        for p in trend_data.get("phases", [])
    ]
    _ = phases
    return CalibrationState(
        globalMultiplier=data["globalMultiplier"],
        globalPosterior=BayesianPosterior(
            mean=gp["mean"],
            variance=gp["variance"],
            sessionCount=gp["sessionCount"],
        ),
        roleMultipliers={
            role: RoleMultiplier(
                multiplier=rm["multiplier"],
                confidence=rm["confidence"],
                sessionCount=rm["sessionCount"],
            )
            for role, rm in data.get("roleMultipliers", {}).items()
        },
        trend=TrendAnalysis(
            phases=[],
            currentPhase=None,
            projectionSlope=trend_data.get("projectionSlope", 0),
            projectionUncertainty=trend_data.get("projectionUncertainty", 1),
        ),
        promptNeeded=data.get("promptNeeded", False),
        insightsByContext=[
            ContextInsight(
                role=i["role"],
                timeOfDay=i["timeOfDay"],
                multiplier=i["multiplier"],
                sessionCount=i["sessionCount"],
                label=i["label"],
            )
            for i in data.get("insightsByContext", [])
        ],
    )


def _dispatch(inp: dict) -> Any:
    fn = inp["fn"]

    if fn == "updatePosterior":
        prior = BayesianPosterior(**inp["prior"])
        return update_posterior(prior, inp["observation"], inp["observationVariance"])

    if fn == "updatePosteriorChain":
        p = BayesianPosterior(**inp["prior"])
        variances = [p.variance]
        for obs in inp["observations"]:
            p = update_posterior(p, obs, inp["observationVariance"])
            variances.append(p.variance)
        return {"posterior": p, "variances": variances}

    if fn == "inferTimeOfDay":
        ts = inp.get("timestamp")
        return infer_time_of_day(ts)

    if fn == "inferTimeOfDayBatch":
        return {"results": [infer_time_of_day(t) for t in inp["timestamps"]]}

    if fn == "computeHierarchicalModel":
        return compute_hierarchical_model(
            inp["sessions"],
            set(inp.get("exceptionalIds", [])),
        )

    if fn == "runCUSUM":
        if "seed" in inp:
            rng = _mulberry32(inp["seed"])
            chaotic = [1.0 + (rng() - 0.5) * 0.6 for _ in range(40)]
            mean = sum(chaotic) / len(chaotic)
            std = (sum((r - mean) ** 2 for r in chaotic) / (len(chaotic) - 1)) ** 0.5
            return run_cusum(chaotic, mean, std)
        signal = inp["signal"]
        if "std" in inp:
            mean = inp["mean"]
            std = inp["std"]
        else:
            computed_mean = sum(signal) / len(signal)
            signal_variance = sum((r - computed_mean) ** 2 for r in signal) / (
                len(signal) - 1
            )
            if signal_variance < 0.01:
                mean = computed_mean
            else:
                mean = inp["mean"]
            std = (
                sum((r - mean) ** 2 for r in signal) / (len(signal) - 1)
            ) ** 0.5
        return run_cusum(signal, mean, std)

    if fn == "detectRegimeShifts":
        return detect_regime_shifts(
            inp["sessions"],
            set(inp.get("exceptionalIds", [])),
            inp["globalMultiplier"],
            inp.get("resolutions", []),
        )

    if fn == "initKalman":
        return init_kalman(inp["level"], inp["variance"])

    if fn == "kalmanPredict":
        state = init_kalman(inp["level"], inp["variance"])
        state.x[1] = inp["slope"]
        return kalman_predict(state)

    if fn == "kalmanUpdate":
        state = init_kalman(inp["level"], inp["variance"])
        predicted = kalman_predict(state)
        return kalman_update(predicted, inp["observation"], inp["observationVariance"])

    if fn == "runKalmanOnPhase":
        return run_kalman_on_phase(
            inp["ratios"],
            inp["initialLevel"],
            inp["initialVariance"],
            inp["observationVariance"],
        )

    if fn == "choleskyDecompose":
        return cholesky_decompose(inp["matrix"])

    if fn == "choleskySolve":
        chol = cholesky_decompose(inp["matrix"])
        return cholesky_solve(chol, inp["b"])

    if fn == "gpRegression":
        return gp_regression(inp["trainX"], inp["trainY"], inp["testX"])

    if fn == "fitBurnUpGP":
        return fit_burn_up_gp(
            inp["actualPoints"],
            inp["startDate"],
            inp["endDate"],
            inp["today"],
        )

    if fn == "analyzeTrend":
        breakpoints = inp.get("breakpoints", [])
        return analyze_trend(
            inp["sessions"],
            set(inp.get("exceptionalIds", [])),
            _default_bayesian(),
            _default_cusum(breakpoints),
        )

    if fn == "calculateStreak":
        return calculate_streak(inp["sessions"], inp["today"])

    if fn == "buildStreakGrid":
        return build_streak_grid(
            inp["sessions"],
            inp["today"],
            inp.get("plannedByDate", {}),
            inp["defaultPlanned"],
        )

    if fn == "computeCalibration":
        return compute_calibration(
            inp["sessions"],
            inp.get("exceptionalTags", []),
            inp.get("resolutions", []),
        )

    if fn == "getPromptDetail":
        return get_prompt_detail(inp["sessions"], inp.get("breakpoints", []))

    if fn == "computeProgress":
        return compute_progress(
            inp["sessions"],
            inp["roadmap"],
            _parse_calibration(inp["calibration"]),
            inp["today"],
        )

    raise ValueError(f"Unknown fixture function: {fn}")


def _assert_close(actual: Any, expected: Any, path: str = "") -> None:
    if actual is None and expected is None:
        return
    if isinstance(expected, bool):
        assert actual == expected, f"{path}: {actual!r} != {expected!r}"
        return
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        if isinstance(expected, int) and isinstance(actual, int) and not isinstance(
            expected, bool
        ):
            assert actual == expected, f"{path}: {actual!r} != {expected!r}"
            return
        if not math.isclose(float(actual), float(expected), rel_tol=TOLERANCE, abs_tol=TOLERANCE):
            raise AssertionError(f"{path}: {actual!r} != {expected!r} (tol={TOLERANCE})")
        return
    if isinstance(expected, str):
        assert actual == expected, f"{path}: {actual!r} != {expected!r}"
        return
    if isinstance(expected, list):
        assert isinstance(actual, list), f"{path}: expected list, got {type(actual)}"
        assert len(actual) == len(expected), f"{path}: length {len(actual)} != {len(expected)}"
        for i, (a, e) in enumerate(zip(actual, expected, strict=True)):
            _assert_close(a, e, f"{path}[{i}]")
        return
    if isinstance(expected, dict):
        assert isinstance(actual, dict), f"{path}: expected dict, got {type(actual)}"
        for key in expected:
            assert key in actual, f"{path}: missing key {key!r}"
            _assert_close(actual[key], expected[key], f"{path}.{key}")
        return
    assert actual == expected, f"{path}: {actual!r} != {expected!r}"


def test_fixture_parity(case_name: str, fixture_input: dict, fixture_expected) -> None:
    actual = to_json_value(_dispatch(fixture_input))
    _assert_close(actual, fixture_expected, case_name)
