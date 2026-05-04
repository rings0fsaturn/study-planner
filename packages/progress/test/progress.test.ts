import { describe, it, expect } from 'vitest'
import { computeProgress } from '../src/progress'
import type {
  SessionEvent,
  RoadmapInput,
  CalibrationState,
  RoadmapSlot,
} from '../src/types'
import { BAYESIAN_PRIOR_MEAN, BAYESIAN_PRIOR_VARIANCE } from '../src/config'

function defaultCalibration(): CalibrationState {
  return {
    globalMultiplier: 1.0,
    globalPosterior: {
      mean: BAYESIAN_PRIOR_MEAN,
      variance: BAYESIAN_PRIOR_VARIANCE,
      sessionCount: 0,
    },
    roleMultipliers: {},
    trend: {
      phases: [],
      currentPhase: null,
      projectionSlope: 0,
      projectionUncertainty: 1,
    },
    promptNeeded: false,
    insightsByContext: [],
  }
}

function makeSlot(date: string, plannedMinutes: number): RoadmapSlot {
  return {
    date,
    dayOfWeek: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
    weekIndex: 0,
    plannedMinutes,
    candidateMaterialIds: ['mat-1'],
    role: 'anchor',
  }
}

function makeRoadmap(slots: RoadmapSlot[]): RoadmapInput {
  const sortedDates = slots.map((s) => s.date).sort()
  return {
    startDate: sortedDates[0] ?? '2026-01-01',
    deadline: sortedDates[sortedDates.length - 1] ?? '2026-01-31',
    weeks: 4,
    weeklyHours: 6,
    slots,
  }
}

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

describe('computeProgress', () => {
  it('produces full snapshot for sessions and roadmap', () => {
    const slots = Array.from({ length: 20 }, (_, i) =>
      makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
    )
    const roadmap = makeRoadmap(slots)
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        sessionId: `s-${i}`,
      }),
    )

    const result = computeProgress(
      sessions,
      roadmap,
      defaultCalibration(),
      '2026-01-10',
    )

    expect(result.totalMinutes).toBe(600)
    expect(result.totalPlannedMinutes).toBe(1200)
    expect(result.completionPercentage).toBe(50)
    expect(result.streak.current).toBeGreaterThan(0)
    expect(result.streak.grid.length).toBe(7)
    expect(result.burnUp.planned.length).toBeGreaterThan(0)
    expect(result.burnUp.actual.length).toBeGreaterThan(0)
    expect(result.weeklyStats.weekStartDate).toBeDefined()
    expect(result.weekSummaryForNarrative.sessionsLogged).toBeGreaterThanOrEqual(0)
    expect(['ahead', 'on-track', 'slipping']).toContain(result.verdict)
  })

  it('returns zero totals for empty roadmap', () => {
    const roadmap: RoadmapInput = {
      startDate: '2026-01-01',
      deadline: '2026-01-31',
      weeks: 4,
      weeklyHours: 6,
      slots: [],
    }
    const result = computeProgress([], roadmap, defaultCalibration(), '2026-01-15')
    expect(result.totalMinutes).toBe(0)
    expect(result.totalPlannedMinutes).toBe(0)
    expect(result.completionPercentage).toBe(0)
    expect(result.projection.finishDate).toBeNull()
    expect(result.upNext).toBeNull()
  })

  it('caps completionPercentage at 100', () => {
    const slots = [makeSlot('2026-01-01', 60)]
    const roadmap = makeRoadmap(slots)
    const sessions = [
      makeSession({ date: '2026-01-01', duration: 120, sessionId: 's-1' }),
    ]
    const result = computeProgress(
      sessions,
      roadmap,
      defaultCalibration(),
      '2026-01-01',
    )
    expect(result.completionPercentage).toBe(100)
  })

  it('finds upNext slot after today', () => {
    const slots = [
      makeSlot('2026-01-10', 60),
      makeSlot('2026-01-15', 60),
      makeSlot('2026-01-20', 60),
    ]
    const roadmap = makeRoadmap(slots)
    const sessions = [
      makeSession({ date: '2026-01-10', sessionId: 's-1' }),
    ]
    const result = computeProgress(
      sessions,
      roadmap,
      defaultCalibration(),
      '2026-01-12',
    )
    expect(result.upNext?.date).toBe('2026-01-15')
  })

  it('computes burn-up deficit correctly', () => {
    const slots = Array.from({ length: 10 }, (_, i) =>
      makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
    )
    const roadmap = makeRoadmap(slots)
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        duration: 60,
        sessionId: `s-${i}`,
      }),
    )

    const result = computeProgress(
      sessions,
      roadmap,
      defaultCalibration(),
      '2026-01-10',
    )
    expect(result.burnUp.deficit).toBeLessThan(0)
  })

  it('includes GP curve in burn-up', () => {
    const slots = Array.from({ length: 14 }, (_, i) =>
      makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
    )
    const roadmap = makeRoadmap(slots)
    const sessions = Array.from({ length: 7 }, (_, i) =>
      makeSession({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        duration: 55,
        sessionId: `s-${i}`,
      }),
    )

    const result = computeProgress(
      sessions,
      roadmap,
      defaultCalibration(),
      '2026-01-07',
    )
    expect(result.burnUp.gpCurve.length).toBeGreaterThan(0)
  })

  it('marks driftPastDeadline when projected finish is after deadline', () => {
    const slots = Array.from({ length: 30 }, (_, i) =>
      makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
    )
    const roadmap = makeRoadmap(slots)
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        duration: 30,
        sessionId: `s-${i}`,
      }),
    )

    const result = computeProgress(
      sessions,
      roadmap,
      defaultCalibration(),
      '2026-01-15',
    )
    // With 5 sessions at half pace for 30 slots, projection should drift
    if (result.projection.finishDate) {
      expect(result.driftPastDeadline).toBe(
        result.projection.finishDate > roadmap.deadline,
      )
    }
  })

  it('computes weekly stats for current week', () => {
    // 2026-01-15 is Thursday. Week: Mon 12 – Sun 18
    const slots = Array.from({ length: 20 }, (_, i) =>
      makeSlot(`2026-01-${String(i + 1).padStart(2, '0')}`, 60),
    )
    const roadmap = makeRoadmap(slots)
    const sessions = [
      makeSession({ date: '2026-01-13', duration: 60, sessionId: 's-1' }),
      makeSession({ date: '2026-01-14', duration: 45, sessionId: 's-2' }),
      makeSession({ date: '2026-01-15', duration: 55, sessionId: 's-3' }),
    ]

    const result = computeProgress(
      sessions,
      roadmap,
      defaultCalibration(),
      '2026-01-15',
    )
    expect(result.weeklyStats.sessionsThisWeek).toBe(3)
    expect(result.weeklyStats.minutesThisWeek).toBe(160)
    expect(result.weeklyStats.weekStartDate).toBe('2026-01-12')
  })
})
