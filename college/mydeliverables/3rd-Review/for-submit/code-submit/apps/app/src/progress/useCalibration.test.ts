import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalibrationState } from '@study-tracker/progress'
import { useCalibrationState } from './useCalibration'

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(),
  table: vi.fn(),
  postCalibration: vi.fn(),
  CalibrationAuthError: class CalibrationAuthError extends Error {},
}))

vi.mock('../events/useEventStore', () => ({
  useEventStore: () => ({
    getAll: mocks.getAll,
    table: mocks.table,
  }),
}))

vi.mock('../lib/intelligenceClient', () => ({
  CalibrationAuthError: mocks.CalibrationAuthError,
  postCalibration: mocks.postCalibration,
}))

const calibrationState: CalibrationState = {
  globalMultiplier: 1.05,
  globalPosterior: {
    mean: 1.05,
    variance: 0.01,
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
  nextSessionForecast: 1.08,
}

const roadmapEvent = {
  id: 1,
  kind: 'RoadmapCreated',
  createdAt: '2026-01-01T00:00:00Z',
  payload: {
    startDate: '2099-01-01',
    deadline: '2099-02-01',
    weeks: 4,
    selectedStudyDays: ['Mon', 'Wed'],
    weekdayHours: 4,
    weekendHours: 0,
    weeklyHours: 4,
    slots: [
      {
        weekIndex: 0,
        dayOfWeek: 'Mon',
        date: '2099-01-01',
        capacityMinutes: 120,
        role: 'anchor',
        candidateMaterialIds: ['m-1'],
        plannedMinutes: 60,
        sessionTitle: 'Foundations',
      },
      {
        weekIndex: 0,
        dayOfWeek: 'Wed',
        date: '2099-01-03',
        capacityMinutes: 120,
        role: 'practice',
        candidateMaterialIds: ['m-2'],
        plannedMinutes: 45,
        sessionTitle: 'Practice',
      },
    ],
  },
}

const sessionEvent = {
  id: 2,
  kind: 'SessionLogged',
  createdAt: '2026-01-02T00:00:00Z',
  payload: {
    date: '2026-01-02',
    source: 'active',
    plannedMinutes: 60,
    activeMinutes: 45,
    duration: 45,
    role: 'anchor',
    startedAt: '2026-01-02T18:00:00Z',
    sessionId: 's-1',
  },
}

describe('useCalibrationState', () => {
  let cacheRows: Map<string, unknown>

  beforeEach(() => {
    cacheRows = new Map()
    mocks.getAll.mockReset()
    mocks.table.mockReset()
    mocks.postCalibration.mockReset()
    mocks.table.mockImplementation((name: string) => {
      if (name !== 'calibrationCache') throw new Error(`unexpected table ${name}`)
      return {
        put: vi.fn(async (row: { key: string }) => {
          cacheRows.set(row.key, row)
        }),
        get: vi.fn(async (key: string) => cacheRows.get(key)),
      }
    })
  })

  it('posts mapped events with planned horizon, returns ready state, and writes cache', async () => {
    mocks.getAll.mockResolvedValue([roadmapEvent, sessionEvent])
    mocks.postCalibration.mockResolvedValue(calibrationState)

    const { result } = renderHook(() => useCalibrationState())

    await waitFor(() => expect(mocks.postCalibration).toHaveBeenCalledTimes(1))
    const body = mocks.postCalibration.mock.calls[0][0]

    expect(body.sessions).toHaveLength(1)
    expect(body.sessions[0].sessionId).toBe('s-1')
    expect(body.nextContext).toMatchObject({
      date: '2099-01-01',
      startedAt: '2099-01-01',
      materialRole: 'anchor',
      session_index: 0,
      planned_horizon: {
        deadline: '2099-02-01',
        planned_total_sessions: 2,
      },
    })
    await waitFor(() =>
      expect(result.current).toEqual({
        calibration: calibrationState,
        status: 'ready',
      }),
    )
    expect(cacheRows.get('last')).toMatchObject({
      key: 'last',
      state: calibrationState,
    })
  })

  it('keeps sessions global but clears next context after roadmap abandonment', async () => {
    mocks.getAll.mockResolvedValue([
      roadmapEvent,
      {
        id: 3,
        kind: 'RoadmapMarkedAbandoned',
        createdAt: '2026-01-15T00:00:00Z',
        payload: {
          roadmapCreatedAt: roadmapEvent.createdAt,
          resolvedAt: '2026-01-15T00:00:00Z',
        },
      },
      sessionEvent,
    ])
    mocks.postCalibration.mockResolvedValue(calibrationState)

    renderHook(() => useCalibrationState())

    await waitFor(() => expect(mocks.postCalibration).toHaveBeenCalledTimes(1))
    const body = mocks.postCalibration.mock.calls[0][0]

    expect(body.sessions).toHaveLength(1)
    expect(body.sessions[0].sessionId).toBe('s-1')
    expect(body.nextContext).toBeNull()
  })

  it('returns stale cached calibration when the service rejects after a prior success', async () => {
    cacheRows.set('last', {
      key: 'last',
      state: calibrationState,
      updatedAt: Date.now(),
    })
    mocks.getAll.mockResolvedValue([sessionEvent])
    mocks.postCalibration.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useCalibrationState())

    await waitFor(() => expect(mocks.postCalibration).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(result.current).toEqual({
        calibration: calibrationState,
        status: 'stale',
      }),
    )
  })

  it('returns an error state when the service rejects with no cache', async () => {
    mocks.getAll.mockResolvedValue([sessionEvent])
    mocks.postCalibration.mockRejectedValue(new Error('offline'))

    const { result } = renderHook(() => useCalibrationState())

    await waitFor(() => expect(mocks.postCalibration).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(result.current).toEqual({
        calibration: null,
        status: 'error',
      }),
    )
  })

  it('returns an auth error state when the service rejects the token with no cache', async () => {
    mocks.getAll.mockResolvedValue([sessionEvent])
    mocks.postCalibration.mockRejectedValue(new mocks.CalibrationAuthError('unauthorized'))

    const { result } = renderHook(() => useCalibrationState())

    await waitFor(() => expect(mocks.postCalibration).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(result.current).toEqual({
        calibration: null,
        status: 'auth-error',
      }),
    )
  })
})
