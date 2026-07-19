import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalibrationState, ProgressSnapshot } from '@study-tracker/progress'
import { useProgressSnapshot } from './useProgress'

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  computeProgress: vi.fn(),
}))

let liveQueryCallback: (() => Promise<ProgressSnapshot | null>) | null = null

vi.mock('../events/useEventStore', () => ({
  useEventStore: () => ({
    getAll: mocks.getAll,
  }),
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (callback: () => Promise<ProgressSnapshot | null>) => {
    liveQueryCallback = callback
    return undefined
  },
}))

vi.mock('@study-tracker/progress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@study-tracker/progress')>()
  return {
    ...actual,
    computeProgress: mocks.computeProgress,
  }
})

const calibration: CalibrationState = {
  globalMultiplier: 1,
  globalPosterior: {
    mean: 1,
    variance: 0.1,
    sessionCount: 1,
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

const progressSnapshot = {
  totalMinutes: 60,
  totalPlannedMinutes: 120,
  completionPercentage: 50,
  projection: {
    finishDate: null,
    confidenceInterval: null,
    basis: 'analytic',
    provisional: true,
  },
  streak: {
    current: 1,
    longest: 1,
    grid: [],
  },
  weeklyStats: {
    weekIndex: 0,
    weekStartDate: '2026-06-01',
    sessionsThisWeek: 1,
    minutesThisWeek: 60,
    plannedMinutesThisWeek: 120,
    minutesByDay: {},
    materialsTouched: [],
  },
  burnUp: {
    planned: [],
    actual: [],
    gpCurve: [],
    today: '2026-06-03',
    deficit: 0,
    dayNumber: 1,
    totalDays: 30,
  },
  verdict: 'on-track',
  driftPastDeadline: false,
  upNext: null,
  weekSummaryForNarrative: {
    weekStartDate: '2026-06-01',
    sessionsLogged: 1,
    hoursLogged: 1,
    verdict: 'on-track',
    daysWithActivity: 1,
    materialsTouched: [],
  },
  replanContext: {
    isPlanDrifted: false,
    daysOverDeadline: null,
    pinnedSlotCount: 0,
    editableSlotCount: 1,
  },
} satisfies ProgressSnapshot

describe('useProgressSnapshot', () => {
  beforeEach(() => {
    liveQueryCallback = null
    mocks.getAll.mockReset()
    mocks.computeProgress.mockReset()
    mocks.computeProgress.mockReturnValue(progressSnapshot)
  })

  it('returns null and skips progress computation after a roadmap is abandoned', async () => {
    const roadmapCreatedAt = '2026-06-01T00:00:00.000Z'
    mocks.getAll.mockResolvedValue([
      {
        id: 1,
        kind: 'RoadmapCreated',
        createdAt: roadmapCreatedAt,
        payload: {
          startDate: '2026-06-01',
          deadline: '2026-07-01',
          weeks: 4,
          selectedStudyDays: ['Mon'],
          weekdayHours: 1,
          weekendHours: 0,
          weeklyHours: 1,
          slots: [
            {
              date: '2026-06-03',
              dayOfWeek: 'Wed',
              weekIndex: 0,
              plannedMinutes: 60,
              capacityMinutes: 60,
              candidateMaterialIds: ['mat-1'],
              role: 'anchor',
              sessionTitle: 'Old session',
            },
          ],
        },
      },
      {
        id: 2,
        kind: 'RoadmapMarkedAbandoned',
        createdAt: '2026-06-20T00:00:00.000Z',
        payload: {
          roadmapCreatedAt,
          resolvedAt: '2026-06-20T00:00:00.000Z',
        },
      },
    ])

    renderHook(() => useProgressSnapshot(calibration, '2026-06-03'))

    await expect(liveQueryCallback?.()).resolves.toBeNull()
    expect(mocks.computeProgress).not.toHaveBeenCalled()
  })

  it('computes progress for a later active roadmap after abandoning an older one', async () => {
    const firstCreatedAt = '2026-06-01T00:00:00.000Z'
    mocks.getAll.mockResolvedValue([
      {
        id: 1,
        kind: 'RoadmapCreated',
        createdAt: firstCreatedAt,
        payload: {
          startDate: '2026-06-01',
          deadline: '2026-07-01',
          weeks: 4,
          selectedStudyDays: ['Mon'],
          weekdayHours: 1,
          weekendHours: 0,
          weeklyHours: 1,
          slots: [],
        },
      },
      {
        id: 2,
        kind: 'RoadmapMarkedAbandoned',
        createdAt: '2026-06-20T00:00:00.000Z',
        payload: {
          roadmapCreatedAt: firstCreatedAt,
          resolvedAt: '2026-06-20T00:00:00.000Z',
        },
      },
      {
        id: 3,
        kind: 'RoadmapCreated',
        createdAt: '2026-07-01T00:00:00.000Z',
        payload: {
          startDate: '2026-07-01',
          deadline: '2026-08-01',
          weeks: 4,
          selectedStudyDays: ['Fri'],
          weekdayHours: 1,
          weekendHours: 0,
          weeklyHours: 1,
          slots: [
            {
              date: '2026-07-03',
              dayOfWeek: 'Fri',
              weekIndex: 0,
              plannedMinutes: 90,
              capacityMinutes: 90,
              candidateMaterialIds: ['mat-2'],
              role: 'practice',
              sessionTitle: 'New session',
            },
          ],
        },
      },
    ])

    renderHook(() => useProgressSnapshot(calibration, '2026-07-03'))

    await expect(liveQueryCallback?.()).resolves.toBe(progressSnapshot)
    expect(mocks.computeProgress).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        startDate: '2026-07-01',
        deadline: '2026-08-01',
        slots: [
          expect.objectContaining({
            sessionTitle: 'New session',
            plannedMinutes: 90,
          }),
        ],
      }),
      calibration,
      '2026-07-03',
    )
  })
})
