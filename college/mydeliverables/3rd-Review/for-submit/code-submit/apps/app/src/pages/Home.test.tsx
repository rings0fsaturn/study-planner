import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { CalibrationState, ProgressSnapshot, PromptDetail } from '@study-tracker/progress'
import { Home } from './Home'

const mockProgressState = vi.hoisted(() => ({
  calibration: null as CalibrationState | null,
  progress: null as ProgressSnapshot | null,
  promptDetail: null as PromptDetail | null,
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    signOut: vi.fn(),
  }),
}))

vi.mock('../events/useEventStore', () => ({
  useEventStore: () => ({
    getAll: vi.fn().mockResolvedValue([]),
    table: () => ({ get: vi.fn().mockResolvedValue(undefined) }),
  }),
}))

const mockLogEvent = vi.fn().mockResolvedValue(1)

vi.mock('../sync/useSync', () => ({
  useSync: () => ({
    logEvent: mockLogEvent,
  }),
}))

vi.mock('../components/SyncIndicator', () => ({
  SyncIndicator: () => <div data-testid="sync-indicator" />,
}))

vi.mock('../progress', () => ({
  useCalibrationState: () => ({ calibration: mockProgressState.calibration, status: 'ready' }),
  useProgressSnapshot: () => mockProgressState.progress,
  usePromptDetail: () => mockProgressState.promptDetail,
}))

let mockEvents: Array<{ id?: number; kind: string; payload: Record<string, unknown>; createdAt: string }> = []
let mockActiveSession: unknown = undefined

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (querier: () => unknown, deps?: unknown[]) => {
    if (Array.isArray(deps) && deps.length === 0) return mockActiveSession
    if (typeof querier === 'function' && Array.isArray(deps)) return new Set()
    return mockEvents
  },
}))

function makeProgressSnapshot(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    streak: { current: 2, longest: 3, grid: [] },
    burnUp: {
      planned: [],
      actual: [],
      gpCurve: [],
      today: '2026-07-01',
      deficit: 0,
      dayNumber: 1,
      totalDays: 30,
    },
    projection: {
      finishDate: '2026-07-20',
      confidenceInterval: null,
      basis: 'analytic',
      provisional: true,
    },
    totalMinutes: 90,
    totalPlannedMinutes: 180,
    completionPercentage: 50,
    verdict: 'on-track',
    driftPastDeadline: false,
    upNext: null,
    weeklyStats: {
      weekIndex: 0,
      weekStartDate: '2026-07-01',
      sessionsThisWeek: 1,
      minutesThisWeek: 90,
      plannedMinutesThisWeek: 180,
      minutesByDay: {},
      materialsTouched: [],
    },
    weekSummaryForNarrative: {
      weekStartDate: '2026-07-01',
      sessionsLogged: 1,
      hoursLogged: 1.5,
      verdict: 'on-track',
      daysWithActivity: 1,
      materialsTouched: [],
    },
    replanContext: {
      isPlanDrifted: false,
      daysOverDeadline: null,
      pinnedSlotCount: 0,
      editableSlotCount: 0,
    },
    ...overrides,
  }
}

describe('Home', () => {
  beforeEach(() => {
    mockEvents = []
    mockActiveSession = undefined
    mockProgressState.calibration = null
    mockProgressState.progress = null
    mockProgressState.promptDetail = null
    mockLogEvent.mockClear()
  })

  it('shows greeting and total time when no roadmap events exist', () => {
    mockEvents = []

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Home />
      </MemoryRouter>
    )

    expect(screen.getByText(/Good/)).toBeInTheDocument()
    expect(screen.getByText('Total time logged')).toBeInTheDocument()
    expect(screen.queryByText(/Up next/)).not.toBeInTheDocument()
  })

  it("shows a booking card with suggested material when today's booking exists", () => {
    const today = new Date().toISOString().split('T')[0]
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const roadmapCreatedAt = new Date().toISOString()

    mockEvents = [
      {
        id: 1,
        kind: 'MaterialAdded',
        payload: {
          materialId: 'mat-1',
          title: 'DDIA Chapter 1',
          estimatedDuration: 120,
          kind: 'manual',
          role: 'anchor',
        },
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        kind: 'RoadmapCreated',
        payload: {
          startDate: today,
          deadline: futureDate,
          weeks: 4,
          selectedStudyDays: ['Mon', 'Wed', 'Fri'],
          weekdayHours: 2,
          weekendHours: 0,
          weeklyHours: 6,
          materialIds: ['mat-1'],
        },
        createdAt: roadmapCreatedAt,
      },
      {
        id: 3,
        kind: 'SessionBooked',
        payload: {
          roadmapCreatedAt,
          bookingId: 'planned:0:test',
          date: today,
          estimatedDuration: 60,
        },
        createdAt: new Date().toISOString(),
      },
    ]

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Home />
      </MemoryRouter>
    )

    expect(screen.getAllByText(/Study session/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Suggested material/)).toBeInTheDocument()
    expect(screen.getByText('DDIA Chapter 1')).toBeInTheDocument()
  })

  it('labels projected finish as provisional', () => {
    const roadmapCreatedAt = '2026-07-01T00:00:00.000Z'
    mockProgressState.progress = makeProgressSnapshot()
    mockEvents = [
      {
        id: 1,
        kind: 'RoadmapCreated',
        payload: {
          startDate: '2026-07-01',
          deadline: '2026-07-31',
          weeks: 4,
          selectedStudyDays: ['Mon', 'Wed', 'Fri'],
          weekdayHours: 1,
          weekendHours: 0,
          weeklyHours: 3,
          materialIds: [],
        },
        createdAt: roadmapCreatedAt,
      },
    ]

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByText('Projected finish · provisional')).toBeInTheDocument()
    expect(screen.getByText('Jul 20')).toBeInTheDocument()
  })

  it('does not show the old up-next card after the roadmap is abandoned', () => {
    const today = new Date().toISOString().split('T')[0]
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const roadmapCreatedAt = new Date().toISOString()

    mockEvents = [
      {
        id: 1,
        kind: 'RoadmapCreated',
        payload: {
          startDate: today,
          deadline: futureDate,
          weeks: 4,
          selectedStudyDays: ['Mon', 'Wed', 'Fri'],
          weekdayHours: 2,
          weekendHours: 0,
          weeklyHours: 6,
          slots: [
            {
              weekIndex: 0,
              dayOfWeek: 'Mon',
              date: today,
              capacityMinutes: 120,
              role: 'anchor',
              candidateMaterialIds: ['mat-1'],
              plannedMinutes: 60,
              sessionTitle: 'Retired session',
            },
          ],
        },
        createdAt: roadmapCreatedAt,
      },
      {
        id: 2,
        kind: 'RoadmapMarkedAbandoned',
        payload: {
          roadmapCreatedAt,
          resolvedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      },
    ]

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Home />
      </MemoryRouter>
    )

    expect(screen.queryByText(/Up next/)).not.toBeInTheDocument()
    expect(screen.queryByText('Retired session')).not.toBeInTheDocument()
  })

  it('shows recent activity with session events', () => {
    mockEvents = [
      {
        id: 1,
        kind: 'SessionLogged',
        payload: {
          duration: 45,
          date: '2026-05-01',
          description: 'Chapter 3 review',
          source: 'manual',
          sessionId: 'sess-1',
        },
        createdAt: new Date().toISOString(),
      },
    ]

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Home />
      </MemoryRouter>
    )

    expect(screen.getByText('Chapter 3 review')).toBeInTheDocument()
    expect(screen.getAllByText('45 min').length).toBeGreaterThanOrEqual(1)
  })

  it('flag icon toggles exceptional status', async () => {
    mockEvents = [
      {
        id: 1,
        kind: 'SessionLogged',
        payload: {
          duration: 45,
          date: '2026-05-01',
          description: 'Chapter 3 review',
          source: 'manual',
          sessionId: 'sess-abc',
        },
        createdAt: new Date().toISOString(),
      },
    ]

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Home />
      </MemoryRouter>,
    )

    const flagButton = screen.getByTitle('Mark as unusual')
    fireEvent.click(flagButton)

    expect(mockLogEvent).toHaveBeenCalledWith('SessionTaggedExceptional', {
      sessionId: 'sess-abc',
      exceptional: true,
    })
  })

  it('routes recalibration replan action to the replan screen', async () => {
    mockProgressState.calibration = {
      promptNeeded: true,
      trend: { phases: [] },
    } as unknown as CalibrationState

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/replan" element={<div>Replan reached</div>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adjust my roadmap' }))

    await waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledWith('RecalibrationPromptResolved', {
        resolution: 'replan',
        resolvedAt: expect.any(String),
      })
    })
    expect(await screen.findByText('Replan reached')).toBeInTheDocument()
  })
})
