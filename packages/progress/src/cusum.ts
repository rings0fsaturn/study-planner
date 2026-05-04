import type { SessionEvent, RecalibrationResolution } from './types'
import { CUSUM_SLACK_FACTOR, CUSUM_THRESHOLD_FACTOR } from './config'

export interface CUSUMResult {
  breakpoints: number[]
  upperAccumulator: number[]
  lowerAccumulator: number[]
}

export interface RegimeShiftResult {
  breakpoints: number[]
  promptNeeded: boolean
  cusumState: { upper: number; lower: number }
}

export function runCUSUM(
  paceRatios: number[],
  referenceMean: number,
  std: number,
): CUSUMResult {
  const n = paceRatios.length
  if (n < 3) {
    return {
      breakpoints: [],
      upperAccumulator: new Array(n).fill(0),
      lowerAccumulator: new Array(n).fill(0),
    }
  }

  const effectiveStd = std < 1e-6 ? 0.05 : std
  const k = CUSUM_SLACK_FACTOR * effectiveStd
  const h = CUSUM_THRESHOLD_FACTOR * effectiveStd

  const upperAccumulator: number[] = new Array(n)
  const lowerAccumulator: number[] = new Array(n)
  const breakpoints: number[] = []

  let currentRef = referenceMean

  for (let i = 0; i < n; i++) {
    const z = paceRatios[i] - currentRef
    const prevUpper = i > 0 ? upperAccumulator[i - 1] : 0
    const prevLower = i > 0 ? lowerAccumulator[i - 1] : 0

    upperAccumulator[i] = Math.max(0, prevUpper + z - k)
    lowerAccumulator[i] = Math.min(0, prevLower + z + k)

    if (upperAccumulator[i] > h || lowerAccumulator[i] < -h) {
      breakpoints.push(i)
      upperAccumulator[i] = 0
      lowerAccumulator[i] = 0
      const start = Math.max(0, i - 4)
      const recent = paceRatios.slice(start, i + 1)
      currentRef = recent.reduce((s, r) => s + r, 0) / recent.length
    }
  }

  return { breakpoints, upperAccumulator, lowerAccumulator }
}

export function detectRegimeShifts(
  sessions: SessionEvent[],
  exceptionalIds: Set<string>,
  posteriorMean: number,
  resolutions: RecalibrationResolution[],
): RegimeShiftResult {
  const activeSessions = sessions.filter(
    (s) =>
      s.source === 'active' &&
      s.plannedMinutes != null &&
      s.plannedMinutes > 0 &&
      s.activeMinutes != null &&
      s.activeMinutes > 0 &&
      (!s.sessionId || !exceptionalIds.has(s.sessionId)),
  )

  if (activeSessions.length < 3) {
    return {
      breakpoints: [],
      promptNeeded: false,
      cusumState: { upper: 0, lower: 0 },
    }
  }

  const paceRatios = activeSessions.map(
    (s) => s.activeMinutes! / s.plannedMinutes!,
  )

  const mean = paceRatios.reduce((s, r) => s + r, 0) / paceRatios.length
  const sumSq = paceRatios.reduce((s, r) => s + (r - mean) ** 2, 0)
  const std = Math.sqrt(sumSq / (paceRatios.length - 1))

  let referenceMean = posteriorMean

  // Handle recalibration resolutions
  const lastResolution = resolutions.length > 0
    ? resolutions[resolutions.length - 1]
    : null

  if (lastResolution) {
    if (lastResolution.resolution === 'acknowledged') {
      const resolvedTime = new Date(lastResolution.resolvedAt).getTime()
      const sessionsAfter = activeSessions.filter(
        (s) => new Date(s.date).getTime() > resolvedTime,
      )
      if (sessionsAfter.length > 0) {
        const afterRatios = sessionsAfter.map(
          (s) => s.activeMinutes! / s.plannedMinutes!,
        )
        referenceMean =
          afterRatios.reduce((s, r) => s + r, 0) / afterRatios.length
      }
    }
  }

  const result = runCUSUM(paceRatios, referenceMean, std)

  // Determine if prompt is needed:
  // prompt is needed if CUSUM is currently in alarm state (not just historical breakpoints)
  // and no unresolved resolution exists after the last breakpoint
  const lastBreakpoint = result.breakpoints.length > 0
    ? result.breakpoints[result.breakpoints.length - 1]
    : null

  let promptNeeded = false
  if (lastBreakpoint !== null) {
    if (!lastResolution) {
      promptNeeded = true
    } else {
      const resolvedTime = new Date(lastResolution.resolvedAt).getTime()
      const breakpointSession = activeSessions[lastBreakpoint]
      if (breakpointSession) {
        const breakpointTime = new Date(breakpointSession.date).getTime()
        promptNeeded = breakpointTime > resolvedTime
      }
    }
  }

  const n = paceRatios.length
  return {
    breakpoints: result.breakpoints,
    promptNeeded,
    cusumState: {
      upper: n > 0 ? result.upperAccumulator[n - 1] : 0,
      lower: n > 0 ? result.lowerAccumulator[n - 1] : 0,
    },
  }
}
