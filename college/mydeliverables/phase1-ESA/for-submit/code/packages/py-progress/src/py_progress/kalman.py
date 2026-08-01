from __future__ import annotations

from py_progress.config import KALMAN_LEVEL_NOISE, KALMAN_SLOPE_NOISE
from py_progress.types import KalmanPhaseResult, KalmanState


def init_kalman(initial_level: float, initial_variance: float) -> KalmanState:
    return KalmanState(
        x=[initial_level, 0.0],
        P=[[initial_variance, 0.0], [0.0, 0.05]],
    )


def kalman_predict(state: KalmanState) -> KalmanState:
    level, slope = state.x
    p00, p01 = state.P[0]
    p10, p11 = state.P[1]

    x_pred = [level + slope, slope]
    p_pred = [
        [p00 + p01 + p10 + p11 + KALMAN_LEVEL_NOISE, p01 + p11],
        [p10 + p11, p11 + KALMAN_SLOPE_NOISE],
    ]

    return KalmanState(x=x_pred, P=p_pred)


def kalman_update(state: KalmanState, observation: float, r: float) -> KalmanState:
    pred_level, pred_slope = state.x
    p00, p01 = state.P[0]
    p10, p11 = state.P[1]

    y = observation - pred_level
    s = p00 + r
    k0 = p00 / s
    k1 = p10 / s

    x_new = [pred_level + k0 * y, pred_slope + k1 * y]
    p_new = [
        [p00 - k0 * p00, p01 - k0 * p01],
        [p10 - k1 * p00, p11 - k1 * p01],
    ]

    return KalmanState(x=x_new, P=p_new)


def run_kalman_on_phase(
    pace_ratios: list[float],
    initial_level: float,
    initial_variance: float,
    measurement_variance: float,
) -> KalmanPhaseResult:
    n = len(pace_ratios)
    if n == 0:
        return KalmanPhaseResult(
            finalLevel=initial_level,
            finalSlope=0.0,
            levelUncertainty=initial_variance**0.5,
            slopeUncertainty=0.05**0.5,
        )

    state = init_kalman(initial_level, initial_variance)
    for ratio in pace_ratios:
        state = kalman_predict(state)
        state = kalman_update(state, ratio, measurement_variance)

    return KalmanPhaseResult(
        finalLevel=state.x[0],
        finalSlope=state.x[1],
        levelUncertainty=max(state.P[0][0], 0) ** 0.5,
        slopeUncertainty=max(state.P[1][1], 0) ** 0.5,
    )
