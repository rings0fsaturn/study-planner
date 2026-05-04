import { describe, it, expect } from 'vitest'
import { calculateStreak, buildStreakGrid } from '../src/streak'
import type { SessionEvent } from '../src/types'

function makeSession(overrides: Partial<SessionEvent> = {}): SessionEvent {
  return {
    date: '2026-01-15',
    source: 'active',
    plannedMinutes: 60,
    activeMinutes: 60,
    duration: 60,
    sessionId: `session-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  }
}

describe('calculateStreak', () => {
  it('returns 0 for no sessions', () => {
    const { current, longest } = calculateStreak([], '2026-01-15')
    expect(current).toBe(0)
    expect(longest).toBe(0)
  })

  it('counts 5 consecutive days', () => {
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession({ date: `2026-01-${String(11 + i).padStart(2, '0')}` }),
    )
    const { current, longest } = calculateStreak(sessions, '2026-01-15')
    expect(current).toBe(5)
    expect(longest).toBe(5)
  })

  it('resets streak at gap', () => {
    const sessions = [
      makeSession({ date: '2026-01-10' }),
      makeSession({ date: '2026-01-11' }),
      // gap on 12
      makeSession({ date: '2026-01-13' }),
      makeSession({ date: '2026-01-14' }),
      makeSession({ date: '2026-01-15' }),
    ]
    const { current, longest } = calculateStreak(sessions, '2026-01-15')
    expect(current).toBe(3)
    expect(longest).toBe(3)
  })

  it('deduplicates same-day sessions', () => {
    const sessions = [
      makeSession({ date: '2026-01-14' }),
      makeSession({ date: '2026-01-14' }),
      makeSession({ date: '2026-01-15' }),
    ]
    const { current, longest } = calculateStreak(sessions, '2026-01-15')
    expect(current).toBe(2)
    expect(longest).toBe(2)
  })

  it('returns current=0 when last session was 2+ days ago', () => {
    const sessions = [
      makeSession({ date: '2026-01-10' }),
      makeSession({ date: '2026-01-11' }),
      makeSession({ date: '2026-01-12' }),
    ]
    const { current, longest } = calculateStreak(sessions, '2026-01-15')
    expect(current).toBe(0)
    expect(longest).toBe(3)
  })
})

describe('buildStreakGrid', () => {
  // 2026-01-15 is a Thursday. Week: Mon 12 – Sun 18
  const today = '2026-01-15'

  it('marks no-session days as level 0', () => {
    const grid = buildStreakGrid([], today, {}, 60)
    expect(grid.length).toBe(7)
    expect(grid.every((d) => d.level === 0)).toBe(true)
    const todayCell = grid.find((d) => d.isToday)
    expect(todayCell?.date).toBe('2026-01-15')
  })

  it('marks 100%+ of planned as level 3', () => {
    const sessions = [makeSession({ date: '2026-01-15', duration: 60 })]
    const grid = buildStreakGrid(sessions, today, { '2026-01-15': 60 }, 60)
    const todayCell = grid.find((d) => d.date === '2026-01-15')
    expect(todayCell?.level).toBe(3)
    expect(todayCell?.minutes).toBe(60)
  })

  it('marks 60% of planned as level 2', () => {
    const sessions = [makeSession({ date: '2026-01-15', duration: 36 })]
    const grid = buildStreakGrid(sessions, today, { '2026-01-15': 60 }, 60)
    const todayCell = grid.find((d) => d.date === '2026-01-15')
    expect(todayCell?.level).toBe(2)
  })

  it('marks 30% of planned as level 1', () => {
    const sessions = [makeSession({ date: '2026-01-15', duration: 18 })]
    const grid = buildStreakGrid(sessions, today, { '2026-01-15': 60 }, 60)
    const todayCell = grid.find((d) => d.date === '2026-01-15')
    expect(todayCell?.level).toBe(1)
  })

  it('uses global average for rest days', () => {
    const sessions = [makeSession({ date: '2026-01-18', duration: 60 })]
    const grid = buildStreakGrid(sessions, today, {}, 60)
    const sundayCell = grid.find((d) => d.date === '2026-01-18')
    expect(sundayCell?.level).toBe(3)
  })

  it('manual log without duration counts as level 1', () => {
    const sessions = [
      makeSession({ date: '2026-01-15', source: 'manual', duration: 0 }),
    ]
    const grid = buildStreakGrid(sessions, today, { '2026-01-15': 60 }, 60)
    const todayCell = grid.find((d) => d.date === '2026-01-15')
    expect(todayCell?.level).toBe(1)
    expect(todayCell?.minutes).toBe(1)
  })
})
