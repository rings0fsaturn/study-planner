import { describe, it, expect } from 'vitest'
import { analyzeTrend } from '../src/trend'
import type { SessionEvent } from '../src/types'
import type { HierarchicalResult } from '../src/bayesian'
import type { RegimeShiftResult } from '../src/cusum'

function makeSession(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    date: '2026-01-15',
    source: 'active',
    plannedMinutes: 60,
    activeMinutes: 60,
    duration: 60,
    materialRole: 'anchor',
    sessionId: `session-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  }
}

function defaultBayesian(): HierarchicalResult {
  return {
    globalPosterior: { mean: 1.0, variance: 0.1, sessionCount: 10 },
    globalMultiplier: 1.0,
    roleMultipliers: {},
    insights: [],
  }
}

function defaultCusum(breakpoints: number[] = []): RegimeShiftResult {
  return {
    breakpoints,
    promptNeeded: false,
    cusumState: { upper: 0, lower: 0 },
  }
}

describe('analyzeTrend', () => {
  it('returns empty phases for no sessions', () => {
    const result = analyzeTrend([], new Set(), defaultBayesian(), defaultCusum())
    expect(result.phases).toEqual([])
    expect(result.currentPhase).toBeNull()
  })

  it('produces single phase when no breakpoints', () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        sessionId: `s-${i}`,
      }),
    )
    const result = analyzeTrend(
      sessions,
      new Set(),
      defaultBayesian(),
      defaultCusum(),
    )
    expect(result.phases.length).toBe(1)
    expect(result.phases[0].startSessionIndex).toBe(0)
    expect(result.phases[0].endSessionIndex).toBe(9)
    expect(result.phases[0].sessionCount).toBe(10)
    expect(result.currentPhase).toBe(result.phases[0])
  })

  it('produces two phases for one breakpoint', () => {
    const sessions = Array.from({ length: 20 }, (_, i) =>
      makeSession({
        activeMinutes: i < 10 ? 60 : 45,
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        sessionId: `s-${i}`,
      }),
    )
    const result = analyzeTrend(
      sessions,
      new Set(),
      defaultBayesian(),
      defaultCusum([9]),
    )
    expect(result.phases.length).toBe(2)
    expect(result.phases[0].endSessionIndex).toBe(9)
    expect(result.phases[1].startSessionIndex).toBe(10)
  })

  it('falls back to Bayesian for short segment after breakpoint', () => {
    const sessions = Array.from({ length: 12 }, (_, i) =>
      makeSession({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        sessionId: `s-${i}`,
      }),
    )
    const result = analyzeTrend(
      sessions,
      new Set(),
      defaultBayesian(),
      defaultCusum([10]),
    )
    expect(result.phases.length).toBe(2)
    const lastPhase = result.phases[1]
    expect(lastPhase.sessionCount).toBeLessThan(3)
    expect(lastPhase.slope).toBe(0)
    expect(lastPhase.slopeUncertainty).toBe(1)
  })

  it('excludes exceptional sessions from analysis', () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        sessionId: `s-${i}`,
        activeMinutes: i < 8 ? 60 : 10,
      }),
    )
    const exceptionalIds = new Set(['s-8', 's-9'])
    const result = analyzeTrend(
      sessions,
      exceptionalIds,
      defaultBayesian(),
      defaultCusum(),
    )
    expect(result.phases[0].sessionCount).toBe(8)
  })
})
