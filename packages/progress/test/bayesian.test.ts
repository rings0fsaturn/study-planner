import { describe, it, expect } from 'vitest'
import {
  updatePosterior,
  computeHierarchicalModel,
  inferTimeOfDay,
} from '../src/bayesian'
import type { SessionEvent, BayesianPosterior } from '../src/types'
import { BAYESIAN_PRIOR_MEAN, BAYESIAN_PRIOR_VARIANCE } from '../src/config'

function makeSession(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    date: '2026-01-15',
    source: 'active',
    plannedMinutes: 60,
    activeMinutes: 60,
    duration: 60,
    materialRole: 'anchor',
    startedAt: '2026-01-15T14:00:00Z',
    sessionId: `session-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  }
}

describe('updatePosterior', () => {
  it('shifts posterior toward observation', () => {
    const prior: BayesianPosterior = {
      mean: 1.0,
      variance: 0.1,
      sessionCount: 0,
    }
    const posterior = updatePosterior(prior, 0.8, 0.1)
    expect(posterior.mean).toBeCloseTo(0.9, 1)
    expect(posterior.mean).toBeGreaterThan(0.8)
    expect(posterior.mean).toBeLessThan(1.0)
    expect(posterior.variance).toBeLessThan(prior.variance)
    expect(posterior.sessionCount).toBe(1)
  })

  it('reduces variance with each observation', () => {
    let p: BayesianPosterior = { mean: 1.0, variance: 0.1, sessionCount: 0 }
    const v1 = p.variance
    p = updatePosterior(p, 1.0, 0.1)
    const v2 = p.variance
    p = updatePosterior(p, 1.0, 0.1)
    expect(v2).toBeLessThan(v1)
    expect(p.variance).toBeLessThan(v2)
  })
})

describe('inferTimeOfDay', () => {
  it('classifies morning correctly', () => {
    expect(inferTimeOfDay('2026-01-15T08:00:00')).toBe('morning')
    expect(inferTimeOfDay('2026-01-15T11:59:00')).toBe('morning')
  })

  it('classifies afternoon correctly', () => {
    expect(inferTimeOfDay('2026-01-15T12:00:00')).toBe('afternoon')
    expect(inferTimeOfDay('2026-01-15T16:59:00')).toBe('afternoon')
  })

  it('classifies evening correctly', () => {
    expect(inferTimeOfDay('2026-01-15T17:00:00')).toBe('evening')
    expect(inferTimeOfDay('2026-01-15T22:00:00')).toBe('evening')
  })

  it('defaults to afternoon when undefined', () => {
    expect(inferTimeOfDay(undefined)).toBe('afternoon')
  })
})

describe('computeHierarchicalModel', () => {
  it('returns prior unchanged for empty input', () => {
    const result = computeHierarchicalModel([], new Set())
    expect(result.globalPosterior.mean).toBe(BAYESIAN_PRIOR_MEAN)
    expect(result.globalPosterior.variance).toBe(BAYESIAN_PRIOR_VARIANCE)
    expect(result.globalPosterior.sessionCount).toBe(0)
    expect(result.globalMultiplier).toBe(BAYESIAN_PRIOR_MEAN)
    expect(result.roleMultipliers).toEqual({})
    expect(result.insights).toEqual([])
  })

  it('converges toward observed pace with 10 sessions at 0.8x', () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({
        activeMinutes: 48,
        plannedMinutes: 60,
        sessionId: `s-${i}`,
      }),
    )
    const result = computeHierarchicalModel(sessions, new Set())
    expect(result.globalPosterior.mean).toBeCloseTo(0.8, 1)
    expect(result.globalPosterior.sessionCount).toBe(10)
  })

  it('produces per-role multipliers that diverge', () => {
    const anchorSessions = Array.from({ length: 5 }, (_, i) =>
      makeSession({
        activeMinutes: 72,
        plannedMinutes: 60,
        materialRole: 'anchor',
        sessionId: `a-${i}`,
      }),
    )
    const practiceSessions = Array.from({ length: 5 }, (_, i) =>
      makeSession({
        activeMinutes: 48,
        plannedMinutes: 60,
        materialRole: 'practice',
        sessionId: `p-${i}`,
      }),
    )
    const sessions = [...anchorSessions, ...practiceSessions]
    const result = computeHierarchicalModel(sessions, new Set())

    expect(result.roleMultipliers.anchor).toBeDefined()
    expect(result.roleMultipliers.practice).toBeDefined()
    expect(result.roleMultipliers.anchor!.multiplier).toBeGreaterThan(
      result.roleMultipliers.practice!.multiplier,
    )
  })

  it('falls back to global when role has fewer than MIN_SESSIONS_PER_BUCKET', () => {
    const sessions = [
      makeSession({
        activeMinutes: 72,
        plannedMinutes: 60,
        materialRole: 'anchor',
        sessionId: 'a-1',
      }),
      makeSession({
        activeMinutes: 72,
        plannedMinutes: 60,
        materialRole: 'anchor',
        sessionId: 'a-2',
      }),
    ]
    const result = computeHierarchicalModel(sessions, new Set())
    expect(result.roleMultipliers.anchor).toBeUndefined()
  })

  it('excludes exceptional sessions', () => {
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession({
        activeMinutes: i < 3 ? 60 : 30,
        plannedMinutes: 60,
        sessionId: `s-${i}`,
      }),
    )
    const exceptionalIds = new Set(['s-3', 's-4'])
    const result = computeHierarchicalModel(sessions, exceptionalIds)
    expect(result.globalPosterior.sessionCount).toBe(3)
    expect(result.globalPosterior.mean).toBeCloseTo(1.0, 1)
  })

  it('excludes manual sessions from calibration', () => {
    const sessions = [
      makeSession({ source: 'manual', duration: 120, sessionId: 's-1' }),
      makeSession({ source: 'manual', duration: 90, sessionId: 's-2' }),
    ]
    const result = computeHierarchicalModel(sessions, new Set())
    expect(result.globalPosterior.sessionCount).toBe(0)
    expect(result.globalMultiplier).toBe(BAYESIAN_PRIOR_MEAN)
  })

  it('excludes sessions without plannedMinutes', () => {
    const sessions = [
      makeSession({
        plannedMinutes: undefined,
        activeMinutes: 60,
        sessionId: 's-1',
      }),
    ]
    const result = computeHierarchicalModel(sessions, new Set())
    expect(result.globalPosterior.sessionCount).toBe(0)
  })
})
