import type { SessionEvent, Phase, TrendAnalysis } from './types'
import type { HierarchicalResult } from './bayesian'
import type { RegimeShiftResult } from './cusum'
import { runKalmanOnPhase } from './kalman'
import { MIN_SESSIONS_PER_BUCKET } from './config'

export function analyzeTrend(
  sessions: SessionEvent[],
  exceptionalIds: Set<string>,
  bayesianResult: HierarchicalResult,
  cusumResult: RegimeShiftResult,
): TrendAnalysis {
  const activeSessions = sessions.filter(
    (s) =>
      s.source === 'active' &&
      s.plannedMinutes != null &&
      s.plannedMinutes > 0 &&
      s.activeMinutes != null &&
      s.activeMinutes > 0 &&
      (!s.sessionId || !exceptionalIds.has(s.sessionId)),
  )

  if (activeSessions.length === 0) {
    return {
      phases: [],
      currentPhase: null,
      projectionSlope: 0,
      projectionUncertainty: 1,
    }
  }

  const paceRatios = activeSessions.map(
    (s) => s.activeMinutes! / s.plannedMinutes!,
  )

  const mean = paceRatios.reduce((s, r) => s + r, 0) / paceRatios.length
  const sumSq = paceRatios.reduce((s, r) => s + (r - mean) ** 2, 0)
  const measurementVariance =
    paceRatios.length > 1
      ? Math.max(sumSq / (paceRatios.length - 1), 0.001)
      : 0.01

  const breakpoints = cusumResult.breakpoints
  const segmentStarts = [0, ...breakpoints.map((bp) => bp + 1).filter((s) => s < activeSessions.length)]
  const segmentEnds = [...breakpoints.filter((bp) => bp < activeSessions.length), activeSessions.length - 1]

  const segments: Array<[number, number]> = []
  for (let i = 0; i < segmentStarts.length; i++) {
    const start = segmentStarts[i]
    const end = i < segmentEnds.length ? segmentEnds[i] : activeSessions.length - 1
    if (start <= end) {
      segments.push([start, end])
    }
  }

  if (segments.length === 0) {
    segments.push([0, activeSessions.length - 1])
  }

  const phases: Phase[] = segments.map(([start, end]) => {
    const segmentRatios = paceRatios.slice(start, end + 1)
    const segmentSessions = activeSessions.slice(start, end + 1)

    if (segmentRatios.length < MIN_SESSIONS_PER_BUCKET) {
      const segMean =
        segmentRatios.reduce((s, r) => s + r, 0) / segmentRatios.length
      return {
        startSessionIndex: start,
        endSessionIndex: end,
        startDate: segmentSessions[0].date,
        endDate: segmentSessions[segmentSessions.length - 1].date,
        level: segMean,
        slope: 0,
        slopeUncertainty: 1,
        sessionCount: segmentRatios.length,
      }
    }

    const kalmanResult = runKalmanOnPhase(
      segmentRatios,
      bayesianResult.globalPosterior.mean,
      bayesianResult.globalPosterior.variance,
      measurementVariance,
    )

    return {
      startSessionIndex: start,
      endSessionIndex: end,
      startDate: segmentSessions[0].date,
      endDate: segmentSessions[segmentSessions.length - 1].date,
      level: kalmanResult.finalLevel,
      slope: kalmanResult.finalSlope,
      slopeUncertainty: kalmanResult.slopeUncertainty,
      sessionCount: segmentRatios.length,
    }
  })

  const currentPhase = phases.length > 0 ? phases[phases.length - 1] : null

  return {
    phases,
    currentPhase,
    projectionSlope: currentPhase?.slope ?? 0,
    projectionUncertainty: currentPhase?.slopeUncertainty ?? 1,
  }
}
