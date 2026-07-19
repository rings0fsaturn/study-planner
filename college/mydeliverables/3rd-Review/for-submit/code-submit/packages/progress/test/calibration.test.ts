import { describe, it, expect } from 'vitest'
import { computeCalibration, getPromptDetail } from '../src/calibration'
import { calibrationDenominator } from '../src/calibrationDenominator'
import type {
  SessionEvent,
  ExceptionalTag,
  RecalibrationResolution,
} from '../src/types'
import { BAYESIAN_PRIOR_MEAN } from '../src/config'

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

describe('computeCalibration', () => {
  it('returns default state for empty input', () => {
    const result = computeCalibration([], [], [])
    expect(result.globalMultiplier).toBe(BAYESIAN_PRIOR_MEAN)
    expect(result.globalPosterior.sessionCount).toBe(0)
    expect(result.promptNeeded).toBe(false)
    expect(result.trend.phases).toEqual([])
    expect(result.roleMultipliers).toEqual({})
  })

  it('produces valid calibration for 30 active sessions', () => {
    const sessions = Array.from({ length: 30 }, (_, i) =>
      makeSession({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        sessionId: `s-${i}`,
        activeMinutes: 55 + Math.round(Math.sin(i) * 5),
      }),
    )
    const result = computeCalibration(sessions, [], [])
    expect(result.globalPosterior.sessionCount).toBe(30)
    expect(result.globalMultiplier).toBeGreaterThan(0.5)
    expect(result.globalMultiplier).toBeLessThan(1.5)
    expect(result.trend.phases.length).toBeGreaterThan(0)
    expect(result.promptNeeded).toBe(false)
  })

  it('triggers promptNeeded for regime shift', () => {
    const sessions = [
      ...Array.from({ length: 20 }, (_, i) =>
        makeSession({
          activeMinutes: 60,
          date: `2026-01-${String(i + 1).padStart(2, '0')}`,
          sessionId: `s-${i}`,
        }),
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        makeSession({
          activeMinutes: 42,
          date: `2026-02-${String(i + 1).padStart(2, '0')}`,
          sessionId: `s-${20 + i}`,
        }),
      ),
    ]
    const result = computeCalibration(sessions, [], [])
    expect(result.promptNeeded).toBe(true)
  })

  it('excludes exceptional sessions', () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        sessionId: `s-${i}`,
        activeMinutes: i < 7 ? 60 : 20,
      }),
    )
    const tags: ExceptionalTag[] = [
      { sessionId: 's-7', exceptional: true },
      { sessionId: 's-8', exceptional: true },
      { sessionId: 's-9', exceptional: true },
    ]
    const result = computeCalibration(sessions, tags, [])
    expect(result.globalPosterior.sessionCount).toBe(7)
  })

  it('uses materialConsumedMinutes instead of plannedMinutes for partial throughput', () => {
    const partial = makeSession({
      plannedMinutes: 60,
      plannedSessionMinutes: 60,
      activeMinutes: 30,
      materialConsumedMinutes: 20,
      resolution: 'interrupted',
    })

    expect(calibrationDenominator(partial)).toBe(20)
    const result = computeCalibration([partial], [], [])
    expect(result.globalPosterior.sessionCount).toBe(1)
    expect(result.globalMultiplier).toBeGreaterThan(1)
  })

  it('resets prompt after RecalibrationPromptResolved', () => {
    const sessions = [
      ...Array.from({ length: 20 }, (_, i) =>
        makeSession({
          activeMinutes: 60,
          date: `2026-01-${String(i + 1).padStart(2, '0')}`,
          sessionId: `s-${i}`,
        }),
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        makeSession({
          activeMinutes: 42,
          date: `2026-02-${String(i + 1).padStart(2, '0')}`,
          sessionId: `s-${20 + i}`,
        }),
      ),
    ]
    const resolutions: RecalibrationResolution[] = [
      { resolution: 'acknowledged', resolvedAt: '2026-03-01T00:00:00Z' },
    ]
    const result = computeCalibration(sessions, [], resolutions)
    expect(result.promptNeeded).toBe(false)
  })
})

describe('getPromptDetail', () => {
  it('returns empty for no sessions', () => {
    const result = getPromptDetail([], [])
    expect(result.sessions).toEqual([])
    expect(result.currentPace).toBe(BAYESIAN_PRIOR_MEAN)
  })

  it('returns sessions around the breakpoint', () => {
    const sessions = Array.from({ length: 30 }, (_, i) =>
      makeSession({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        sessionId: `s-${i}`,
        activeMinutes: i < 20 ? 60 : 42,
      }),
    )
    const result = getPromptDetail(sessions, [19])
    expect(result.sessions.length).toBeGreaterThan(0)
    expect(result.currentPace).toBeLessThan(result.previousPace)
  })
})
