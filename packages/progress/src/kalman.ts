import { KALMAN_LEVEL_NOISE, KALMAN_SLOPE_NOISE } from './config'

export interface KalmanState {
  x: [number, number]
  P: [[number, number], [number, number]]
}

export interface KalmanPhaseResult {
  finalLevel: number
  finalSlope: number
  levelUncertainty: number
  slopeUncertainty: number
}

export function initKalman(
  initialLevel: number,
  initialVariance: number,
): KalmanState {
  return {
    x: [initialLevel, 0],
    P: [
      [initialVariance, 0],
      [0, 0.05],
    ],
  }
}

export function kalmanPredict(state: KalmanState): KalmanState {
  const [level, slope] = state.x
  const [[p00, p01], [p10, p11]] = state.P

  // F = [[1, 1], [0, 1]]
  const xPred: [number, number] = [level + slope, slope]

  // P_pred = F P F^T + Q
  const pPred: [[number, number], [number, number]] = [
    [
      p00 + p01 + p10 + p11 + KALMAN_LEVEL_NOISE,
      p01 + p11,
    ],
    [
      p10 + p11,
      p11 + KALMAN_SLOPE_NOISE,
    ],
  ]

  return { x: xPred, P: pPred }
}

export function kalmanUpdate(
  state: KalmanState,
  observation: number,
  R: number,
): KalmanState {
  const [predLevel, predSlope] = state.x
  const [[p00, p01], [p10, p11]] = state.P

  // H = [1, 0]
  // Innovation: y = observation - H * x_pred
  const y = observation - predLevel

  // S = H P H^T + R = p00 + R
  const S = p00 + R

  // K = P H^T / S
  const k0 = p00 / S
  const k1 = p10 / S

  // x = x_pred + K * y
  const xNew: [number, number] = [predLevel + k0 * y, predSlope + k1 * y]

  // P = (I - K H) P
  const pNew: [[number, number], [number, number]] = [
    [p00 - k0 * p00, p01 - k0 * p01],
    [p10 - k1 * p00, p11 - k1 * p01],
  ]

  return { x: xNew, P: pNew }
}

export function runKalmanOnPhase(
  paceRatios: number[],
  initialLevel: number,
  initialVariance: number,
  measurementVariance: number,
): KalmanPhaseResult {
  const n = paceRatios.length
  if (n === 0) {
    return {
      finalLevel: initialLevel,
      finalSlope: 0,
      levelUncertainty: Math.sqrt(initialVariance),
      slopeUncertainty: Math.sqrt(0.05),
    }
  }

  let state = initKalman(initialLevel, initialVariance)

  for (const ratio of paceRatios) {
    state = kalmanPredict(state)
    state = kalmanUpdate(state, ratio, measurementVariance)
  }

  return {
    finalLevel: state.x[0],
    finalSlope: state.x[1],
    levelUncertainty: Math.sqrt(Math.max(state.P[0][0], 0)),
    slopeUncertainty: Math.sqrt(Math.max(state.P[1][1], 0)),
  }
}
