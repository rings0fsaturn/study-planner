import { describe, it, expect } from 'vitest'
import { runCUSUM, detectRegimeShifts } from '../src/cusum'
import type { SessionEvent, RecalibrationResolution } from '../src/types'

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

describe('runCUSUM', () => {
  it('detects no breakpoints for stable signal', () => {
    const rng = mulberry32(17)
    const stable = Array.from({ length: 30 }, () => 1.0 + (rng() - 0.5) * 0.1)
    const mean = stable.reduce((s, r) => s + r, 0) / stable.length
    const std = Math.sqrt(
      stable.reduce((s, r) => s + (r - mean) ** 2, 0) / (stable.length - 1),
    )
    const result = runCUSUM(stable, mean, std)
    expect(result.breakpoints.length).toBe(0)
  })

  it('detects breakpoint for abrupt shift', () => {
    const before = Array.from({ length: 20 }, () => 1.0)
    const after = Array.from({ length: 20 }, () => 0.7)
    const signal = [...before, ...after]
    const mean = 1.0
    const std = Math.sqrt(
      signal.reduce((s, r) => s + (r - mean) ** 2, 0) / (signal.length - 1),
    )
    const result = runCUSUM(signal, mean, std)
    expect(result.breakpoints.length).toBeGreaterThan(0)
    expect(result.breakpoints[0]).toBeGreaterThanOrEqual(18)
    expect(result.breakpoints[0]).toBeLessThanOrEqual(30)
  })

  it('does not false alarm for high variance stable signal (Chaotic Carlos)', () => {
    const rng = mulberry32(42)
    const chaotic = Array.from({ length: 40 }, () => 1.0 + (rng() - 0.5) * 0.6)
    const mean = chaotic.reduce((s, r) => s + r, 0) / chaotic.length
    const std = Math.sqrt(
      chaotic.reduce((s, r) => s + (r - mean) ** 2, 0) / (chaotic.length - 1),
    )
    const result = runCUSUM(chaotic, mean, std)
    expect(result.breakpoints.length).toBe(0)
  })

  it('returns empty for fewer than 3 observations', () => {
    const result = runCUSUM([1.0, 0.9], 1.0, 0.1)
    expect(result.breakpoints).toEqual([])
    expect(result.upperAccumulator.length).toBe(2)
  })
})

describe('detectRegimeShifts', () => {
  it('returns no prompt for too few sessions', () => {
    const sessions = [makeSession(), makeSession()]
    const result = detectRegimeShifts(sessions, new Set(), 1.0, [])
    expect(result.promptNeeded).toBe(false)
    expect(result.breakpoints).toEqual([])
  })

  it('triggers prompt for regime shift', () => {
    const sessions = [
      ...Array.from({ length: 20 }, (_, i) =>
        makeSession({
          activeMinutes: 60,
          plannedMinutes: 60,
          date: `2026-01-${String(i + 1).padStart(2, '0')}`,
          sessionId: `s-${i}`,
        }),
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        makeSession({
          activeMinutes: 42,
          plannedMinutes: 60,
          date: `2026-01-${String(21 + i).padStart(2, '0')}`,
          sessionId: `s-${20 + i}`,
        }),
      ),
    ]
    const result = detectRegimeShifts(sessions, new Set(), 1.0, [])
    expect(result.breakpoints.length).toBeGreaterThan(0)
    expect(result.promptNeeded).toBe(true)
  })

  it('resets prompt after RecalibrationPromptResolved', () => {
    const sessions = [
      ...Array.from({ length: 20 }, (_, i) =>
        makeSession({
          activeMinutes: 60,
          plannedMinutes: 60,
          date: `2026-01-${String(i + 1).padStart(2, '0')}`,
          sessionId: `s-${i}`,
        }),
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        makeSession({
          activeMinutes: 42,
          plannedMinutes: 60,
          date: `2026-01-${String(21 + i).padStart(2, '0')}`,
          sessionId: `s-${20 + i}`,
        }),
      ),
    ]

    const resolutions: RecalibrationResolution[] = [
      { resolution: 'acknowledged', resolvedAt: '2026-02-28T00:00:00Z' },
    ]

    const result = detectRegimeShifts(sessions, new Set(), 1.0, resolutions)
    expect(result.promptNeeded).toBe(false)
  })

  it('excludes exceptional sessions', () => {
    const sessions = Array.from({ length: 20 }, (_, i) =>
      makeSession({
        activeMinutes: i < 15 ? 60 : 30,
        plannedMinutes: 60,
        sessionId: `s-${i}`,
      }),
    )
    const exceptionalIds = new Set(
      Array.from({ length: 5 }, (_, i) => `s-${15 + i}`),
    )
    const result = detectRegimeShifts(sessions, exceptionalIds, 1.0, [])
    expect(result.breakpoints.length).toBe(0)
    expect(result.promptNeeded).toBe(false)
  })
})

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
