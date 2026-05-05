import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Week } from './Week'
import type { ProgressSnapshot, CalibrationState } from '@study-tracker/progress'

let mockProgress: ProgressSnapshot | null = null
let mockCalibration: CalibrationState | null = null

vi.mock('../progress', () => ({
  useCalibrationState: () => mockCalibration,
  useProgressSnapshot: () => mockProgress,
}))

vi.mock('../events/useEventStore', () => ({
  useEventStore: () => ({
    getAll: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (querier: () => unknown) => {
    if (typeof querier === 'function') return []
    return []
  },
}))

const { mockFindRoadmap } = vi.hoisted(() => ({
  mockFindRoadmap: vi.fn().mockReturnValue(null),
}))

vi.mock('../progress/mapEvents', () => ({
  findRoadmap: mockFindRoadmap,
}))

function makeProgress(overrides: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return {
    streak: { current: 3, longest: 5, grid: [] },
    burnUp: {
      planned: [],
      actual: [],
      gpCurve: [],
      today: '2026-05-03',
      deficit: -60,
      dayNumber: 14,
      totalDays: 56,
    },
    projection: { finishDate: '2026-06-15', confidenceInterval: null },
    totalMinutes: 450,
    totalPlannedMinutes: 600,
    completionPercentage: 75,
    verdict: 'on-track',
    driftPastDeadline: false,
    upNext: null,
    weeklyStats: {
      weekIndex: 1,
      weekStartDate: '2026-04-28',
      sessionsThisWeek: 4,
      minutesThisWeek: 180,
      plannedMinutesThisWeek: 240,
      minutesByDay: { '2026-04-28': 45, '2026-04-30': 60, '2026-05-01': 45, '2026-05-02': 30 },
      materialsTouched: ['mat-1'],
    },
    weekSummaryForNarrative: {
      weekStartDate: '2026-04-28',
      sessionsLogged: 4,
      hoursLogged: 3,
      verdict: 'on-track',
      daysWithActivity: 4,
      materialsTouched: ['mat-1'],
    },
    replanContext: {
      isPlanDrifted: false,
      daysOverDeadline: null,
      pinnedSlotCount: 0,
      editableSlotCount: 20,
    },
    ...overrides,
  }
}

function mockRoadmapWithPastWeeks() {
  mockFindRoadmap.mockReturnValue({
    startDate: '2025-01-06',
    deadline: '2026-12-31',
    weeks: 104,
    weeklyHours: 10,
    slots: [],
  })
}

describe('Week', () => {
  beforeEach(() => {
    mockFindRoadmap.mockReturnValue(null)
  })

  it('shows fallback when no progress data', () => {
    mockProgress = null
    mockCalibration = null

    render(
      <MemoryRouter>
        <Week />
      </MemoryRouter>,
    )

    expect(screen.getByText('Week')).toBeInTheDocument()
    expect(screen.getByText(/Complete onboarding/)).toBeInTheDocument()
  })

  it('renders verdict and weekly stats with progress data', () => {
    mockProgress = makeProgress()

    render(
      <MemoryRouter>
        <Week />
      </MemoryRouter>,
    )

    expect(screen.getByText('On track.')).toBeInTheDocument()
    expect(screen.getByText('Your week')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('3h')).toBeInTheDocument()
  })

  it('shows "Behind plan" verdict when slipping', () => {
    mockProgress = makeProgress({ verdict: 'slipping' })

    render(
      <MemoryRouter>
        <Week />
      </MemoryRouter>,
    )

    expect(screen.getByText('Behind plan.')).toBeInTheDocument()
    expect(screen.getByText('Replan the rest')).toBeInTheDocument()
  })

  it('shows "Ahead" verdict when ahead', () => {
    mockProgress = makeProgress({ verdict: 'ahead' })

    render(
      <MemoryRouter>
        <Week />
      </MemoryRouter>,
    )

    expect(screen.getByText('Ahead.')).toBeInTheDocument()
  })

  it('shows weekly summary text', () => {
    mockProgress = makeProgress()

    render(
      <MemoryRouter>
        <Week />
      </MemoryRouter>,
    )

    expect(screen.getByText(/3h against a 4h target/)).toBeInTheDocument()
    expect(screen.getByText(/Active on 4 days/)).toBeInTheDocument()
  })

  it('renders navigation arrows', () => {
    mockProgress = makeProgress()

    render(
      <MemoryRouter initialEntries={['/week']}>
        <Week />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('Previous week')).toBeInTheDocument()
    expect(screen.getByLabelText('Next week')).toBeInTheDocument()
  })

  it('disables next arrow on current week', () => {
    mockProgress = makeProgress()
    mockRoadmapWithPastWeeks()

    render(
      <MemoryRouter initialEntries={['/week']}>
        <Week />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('Next week')).toBeDisabled()
  })

  it('shows Past tag when viewing a past week', () => {
    mockProgress = makeProgress()
    mockRoadmapWithPastWeeks()

    render(
      <MemoryRouter initialEntries={['/week?w=1']}>
        <Week />
      </MemoryRouter>,
    )

    expect(screen.getByText('Past')).toBeInTheDocument()
  })

  it('hides action buttons for past week even when slipping', () => {
    mockProgress = makeProgress({ verdict: 'slipping' })
    mockRoadmapWithPastWeeks()

    render(
      <MemoryRouter initialEntries={['/week?w=1']}>
        <Week />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Replan the rest')).not.toBeInTheDocument()
  })

  it('does not show Past tag on current week', () => {
    mockProgress = makeProgress()
    mockRoadmapWithPastWeeks()

    render(
      <MemoryRouter initialEntries={['/week']}>
        <Week />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Past')).not.toBeInTheDocument()
  })
})
