import type {
  SessionEvent,
  ExceptionalTag,
  RecalibrationResolution,
  CalibrationState,
  PromptDetail,
} from './types'
import { computeHierarchicalModel, inferTimeOfDay } from './bayesian'
import { detectRegimeShifts } from './cusum'
import { analyzeTrend } from './trend'
import { BAYESIAN_PRIOR_MEAN } from './config'
import { calibrationDenominator, isCalibrationSession } from './calibrationDenominator'

export function computeCalibration(
  sessions: SessionEvent[],
  exceptionalTags: ExceptionalTag[],
  resolutions: RecalibrationResolution[],
): CalibrationState {
  const exceptionalIds = new Set<string>()
  for (const tag of exceptionalTags) {
    if (tag.exceptional) {
      exceptionalIds.add(tag.sessionId)
    } else {
      exceptionalIds.delete(tag.sessionId)
    }
  }

  const bayesianResult = computeHierarchicalModel(sessions, exceptionalIds)

  const cusumResult = detectRegimeShifts(
    sessions,
    exceptionalIds,
    bayesianResult.globalPosterior.mean,
    resolutions,
  )

  const trend = analyzeTrend(
    sessions,
    exceptionalIds,
    bayesianResult,
    cusumResult,
  )

  return {
    globalMultiplier: bayesianResult.globalMultiplier,
    globalPosterior: bayesianResult.globalPosterior,
    roleMultipliers: bayesianResult.roleMultipliers,
    trend,
    promptNeeded: cusumResult.promptNeeded,
    insightsByContext: bayesianResult.insights,
  }
}

export function getPromptDetail(
  sessions: SessionEvent[],
  cusumBreakpoints: number[],
): PromptDetail {
  const activeSessions = sessions.filter((s) => isCalibrationSession(s))

  if (activeSessions.length === 0 || cusumBreakpoints.length === 0) {
    return {
      sessions: [],
      currentPace: BAYESIAN_PRIOR_MEAN,
      previousPace: BAYESIAN_PRIOR_MEAN,
    }
  }

  const lastBreakpoint = cusumBreakpoints[cusumBreakpoints.length - 1]
  const windowStart = lastBreakpoint + 1
  const windowSessions = activeSessions.slice(
    Math.max(0, windowStart - 5),
    Math.min(activeSessions.length, windowStart + 10),
  )

  const beforeBreakpoint = activeSessions.slice(
    Math.max(0, lastBreakpoint - 5),
    lastBreakpoint + 1,
  )
  const afterBreakpoint = activeSessions.slice(lastBreakpoint + 1)

  const previousPace =
    beforeBreakpoint.length > 0
      ? beforeBreakpoint.reduce(
          (s, sess) => s + sess.activeMinutes! / calibrationDenominator(sess)!,
          0,
        ) / beforeBreakpoint.length
      : BAYESIAN_PRIOR_MEAN

  const currentPace =
    afterBreakpoint.length > 0
      ? afterBreakpoint.reduce(
          (s, sess) => s + sess.activeMinutes! / calibrationDenominator(sess)!,
          0,
        ) / afterBreakpoint.length
      : previousPace

  return {
    sessions: windowSessions.map((s) => ({
      sessionId: s.sessionId ?? '',
      date: s.date,
      timeOfDay: inferTimeOfDay(s.startedAt),
      sessionTitle: '',
      plannedMinutes: calibrationDenominator(s)!,
      activeMinutes: s.activeMinutes!,
    })),
    currentPace,
    previousPace,
  }
}
