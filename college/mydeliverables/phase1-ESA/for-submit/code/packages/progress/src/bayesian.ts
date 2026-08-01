import type {
  SessionEvent,
  BayesianPosterior,
  RoleMultiplier,
  MaterialRole,
  TimeOfDay,
  ContextInsight,
} from './types'
import {
  BAYESIAN_PRIOR_MEAN,
  BAYESIAN_PRIOR_VARIANCE,
  MIN_SESSIONS_PER_BUCKET,
} from './config'
import { calibrationDenominator, isCalibrationSession } from './calibrationDenominator'

export interface HierarchicalResult {
  globalPosterior: BayesianPosterior
  globalMultiplier: number
  roleMultipliers: Partial<Record<MaterialRole, RoleMultiplier>>
  insights: ContextInsight[]
}

export function updatePosterior(
  prior: BayesianPosterior,
  observation: number,
  observationVariance: number,
): BayesianPosterior {
  const posteriorVariance =
    (prior.variance * observationVariance) /
    (prior.variance + observationVariance)
  const posteriorMean =
    (prior.variance * observation + observationVariance * prior.mean) /
    (prior.variance + observationVariance)
  return {
    mean: posteriorMean,
    variance: posteriorVariance,
    sessionCount: prior.sessionCount + 1,
  }
}

export function inferTimeOfDay(startedAt: string | undefined): TimeOfDay {
  if (!startedAt) return 'afternoon'
  const date = new Date(startedAt)
  const hour = date.getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function computeEmpiricalVariance(ratios: number[]): number {
  if (ratios.length < 2) return BAYESIAN_PRIOR_VARIANCE
  const mean = ratios.reduce((s, r) => s + r, 0) / ratios.length
  const sumSq = ratios.reduce((s, r) => s + (r - mean) ** 2, 0)
  return Math.max(sumSq / (ratios.length - 1), 0.001)
}

export function computeHierarchicalModel(
  sessions: SessionEvent[],
  exceptionalIds: Set<string>,
): HierarchicalResult {
  const activeSessions = sessions.filter((s) => isCalibrationSession(s, exceptionalIds))

  if (activeSessions.length === 0) {
    return {
      globalPosterior: {
        mean: BAYESIAN_PRIOR_MEAN,
        variance: BAYESIAN_PRIOR_VARIANCE,
        sessionCount: 0,
      },
      globalMultiplier: BAYESIAN_PRIOR_MEAN,
      roleMultipliers: {},
      insights: [],
    }
  }

  const paceRatios = activeSessions.map(
    (s) => s.activeMinutes! / calibrationDenominator(s)!,
  )
  const observationVariance = computeEmpiricalVariance(paceRatios)

  // Level 0: Global posterior
  let globalPosterior: BayesianPosterior = {
    mean: BAYESIAN_PRIOR_MEAN,
    variance: BAYESIAN_PRIOR_VARIANCE,
    sessionCount: 0,
  }
  for (const ratio of paceRatios) {
    globalPosterior = updatePosterior(
      globalPosterior,
      ratio,
      observationVariance,
    )
  }

  // Level 1: Per-role posteriors (inherit global as prior)
  const roleGroups = new Map<MaterialRole, number[]>()
  for (const session of activeSessions) {
    if (session.materialRole) {
      const group = roleGroups.get(session.materialRole) ?? []
      group.push(session.activeMinutes! / calibrationDenominator(session)!)
      roleGroups.set(session.materialRole, group)
    }
  }

  const roleMultipliers: Partial<Record<MaterialRole, RoleMultiplier>> = {}
  for (const [role, ratios] of roleGroups) {
    if (ratios.length >= MIN_SESSIONS_PER_BUCKET) {
      const roleVariance = computeEmpiricalVariance(ratios)
      let rolePosterior: BayesianPosterior = {
        mean: globalPosterior.mean,
        variance: globalPosterior.variance,
        sessionCount: 0,
      }
      for (const ratio of ratios) {
        rolePosterior = updatePosterior(rolePosterior, ratio, roleVariance)
      }
      roleMultipliers[role] = {
        multiplier: rolePosterior.mean,
        confidence: 1 / Math.sqrt(rolePosterior.variance),
        sessionCount: ratios.length,
      }
    }
  }

  // Level 2: Per-role × time-of-day (insights only)
  const contextGroups = new Map<string, { role: MaterialRole; timeOfDay: TimeOfDay; ratios: number[] }>()
  for (const session of activeSessions) {
    if (session.materialRole) {
      const tod = inferTimeOfDay(session.startedAt)
      const key = `${session.materialRole}:${tod}`
      const group = contextGroups.get(key) ?? {
        role: session.materialRole,
        timeOfDay: tod,
        ratios: [],
      }
      group.ratios.push(session.activeMinutes! / calibrationDenominator(session)!)
      contextGroups.set(key, group)
    }
  }

  const insights: ContextInsight[] = []
  for (const [, group] of contextGroups) {
    if (group.ratios.length >= MIN_SESSIONS_PER_BUCKET) {
      const rolePrior = roleMultipliers[group.role]
      const priorMean = rolePrior ? rolePrior.multiplier : globalPosterior.mean
      const priorVariance = rolePrior
        ? 1 / (rolePrior.confidence ** 2)
        : globalPosterior.variance
      const contextVariance = computeEmpiricalVariance(group.ratios)

      let contextPosterior: BayesianPosterior = {
        mean: priorMean,
        variance: priorVariance,
        sessionCount: 0,
      }
      for (const ratio of group.ratios) {
        contextPosterior = updatePosterior(
          contextPosterior,
          ratio,
          contextVariance,
        )
      }

      const label = `${group.role} in the ${group.timeOfDay}`
      insights.push({
        role: group.role,
        timeOfDay: group.timeOfDay,
        multiplier: contextPosterior.mean,
        sessionCount: group.ratios.length,
        label,
      })
    }
  }

  return {
    globalPosterior,
    globalMultiplier: globalPosterior.mean,
    roleMultipliers,
    insights,
  }
}
