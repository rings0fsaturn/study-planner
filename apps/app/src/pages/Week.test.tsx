import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Week } from './Week'
import type { ProgressSnapshot, CalibrationState } from '@study-tracker/progress'

vi.mock('@visx/responsive', () => ({
  ParentSize: ({ children }: { children: (size: { width: number; height: number }) => ReactNode }) =>
    children({ width: 760, height: 360 }),
}))

let mockProgress: ProgressSnapshot | null = null
let mockCalibration: CalibrationState | null = null
let mockCalibrationStatus: 'loading' | 'ready' | 'stale' | 'error' = 'ready'
let mockEvents: Array<{ kind: string; payload: Record<string, unknown>; createdAt: string }> = []

vi.mock('../progress', () => ({
  useCalibrationState: () => ({ calibration: mockCalibration, status: mockCalibrationStatus }),
  useProgressSnapshot: () => mockProgress,
}))

vi.mock('../events/useEventStore', () => ({
  useEventStore: () => ({
    getAll: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => mockEvents,
}))

const { mockFindActiveRoadmap, mockMapSessions } = vi.hoisted(() => ({
  mockFindActiveRoadmap: vi.fn().mockReturnValue(null),
  mockMapSessions: vi.fn().mockReturnValue([]),
}))

vi.mock('../progress/mapEvents', () => ({
  findActiveRoadmap: mockFindActiveRoadmap,
  mapSessions: mockMapSessions,
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
    projection: {
      finishDate: '2026-06-15',
      confidenceInterval: null,
      basis: 'analytic',
      provisional: true,
    },
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
  mockFindActiveRoadmap.mockReturnValue({
    startDate: '2025-01-06',
    deadline: '2026-12-31',
    weeks: 104,
    weeklyHours: 10,
    slots: [],
  })
}

function mockShortRoadmapAfterPlanEnd() {
  mockFindActiveRoadmap.mockReturnValue({
    startDate: '2026-05-04',
    deadline: '2026-06-07',
    weeks: 5,
    weeklyHours: 10,
    slots: [],
  })
}

function mockCurrentRoadmap() {
  mockFindActiveRoadmap.mockReturnValue({
    startDate: '2026-04-06',
    deadline: '2026-06-07',
    weeks: 9,
    weeklyHours: 4,
    selectedStudyDays: ['Mon', 'Wed', 'Fri'],
    weekdayHours: 1,
    weekendHours: 0,
    materialTotalMinutes: 600,
    materialRemainingMinutes: 340,
    slots: [],
  })
}

function makeProgressWithChart(): ProgressSnapshot {
  return makeProgress({
    burnUp: {
      planned: [
        { date: '2026-04-06', minutes: 60 },
        { date: '2026-04-08', minutes: 120 },
        { date: '2026-04-10', minutes: 180 },
        { date: '2026-05-03', minutes: 300 },
        { date: '2026-06-07', minutes: 600 },
      ],
      actual: [
        { date: '2026-04-06', minutes: 30 },
        { date: '2026-04-08', minutes: 90 },
        { date: '2026-04-10', minutes: 150 },
        { date: '2026-05-03', minutes: 260 },
      ],
      gpCurve: [
        { date: '2026-05-03', mean: 260, lower: 220, upper: 300 },
        { date: '2026-06-07', mean: 540, lower: 420, upper: 650 },
      ],
      today: '2026-05-03',
      deficit: -40,
      dayNumber: 28,
      totalDays: 63,
    },
  })
}

describe('Week', () => {
  beforeEach(() => {
    mockFindActiveRoadmap.mockReturnValue(null)
    mockCalibration = null
    mockCalibrationStatus = 'ready'
    mockEvents = []
    mockMapSessions.mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
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

  it('labels projected finish as provisional', () => {
    mockProgress = makeProgress()

    render(
      <MemoryRouter>
        <Week />
      </MemoryRouter>,
    )

    expect(screen.getByText('Provisional finish')).toBeInTheDocument()
    expect(screen.getByText('Jun 15')).toBeInTheDocument()
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

  it('renders explicit post-plan past week from the URL instead of falling back to current week', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-26T12:00:00Z'))
    mockProgress = makeProgress()
    mockShortRoadmapAfterPlanEnd()

    render(
      <MemoryRouter initialEntries={['/week?w=6']}>
        <Week />
      </MemoryRouter>,
    )

    expect(screen.getByText((_, element) =>
      element?.className === 'mono-caps' &&
      element.textContent?.startsWith('Week 6 ·') === true,
    )).toBeInTheDocument()
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

  it('opens the current Week Progress Lab with capacity scenario inputs', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-03T12:00:00.000Z'))
    mockProgress = makeProgressWithChart()
    mockCurrentRoadmap()

    render(
      <MemoryRouter initialEntries={['/week']}>
        <Week />
      </MemoryRouter>,
    )

    const opener = screen.getByRole('button', { name: 'Open Progress Lab' })
    expect(opener).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(opener)

    const lab = within(screen.getByRole('dialog', { name: 'Study trajectory and pace scenario' }))
    expect(opener).toHaveAttribute('aria-expanded', 'true')
    expect(lab.getByRole('slider', { name: 'Extra minutes per study day' })).toBeEnabled()
    expect(lab.getByTestId('burn-up-goal-line')).toBeInTheDocument()
    expect(lab.getByTestId('finish-flag-plan')).toHaveTextContent('Plan · Jun 7')
    expect(lab.getByTestId('finish-flag-forecast')).toHaveTextContent('Forecast · Jun 15')
    expect(lab.getByTestId('finish-narrative-plan')).toHaveTextContent('Jun 7, 2026')
    expect(lab.getByTestId('finish-narrative-forecast')).toHaveTextContent('Jun 15, 2026')
    expect(lab.getByTestId('finish-narrative-forecast')).toHaveTextContent('8 days late vs deadline')
    expect(lab.getByText('estimate')).toBeInTheDocument()
    expect(lab.getByRole('link', { name: 'Replan with this pace' })).toHaveAttribute(
      'href',
      '/replan?paceDeltaMinutes=0',
    )
  })

  it('opens historical Week inspection with Week end and no pace controls', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-03T12:00:00.000Z'))
    mockProgress = makeProgressWithChart()
    mockCurrentRoadmap()

    render(
      <MemoryRouter initialEntries={['/week?w=1']}>
        <Week />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open Progress Lab' }))

    const lab = within(screen.getByRole('dialog', { name: 'Study trajectory and pace scenario' }))
    expect(lab.getByText(/Progress Lab · Historical week/)).toBeInTheDocument()
    expect(lab.getByText(/at week end/)).toBeInTheDocument()
    expect(lab.getByTestId('burn-up-goal-line')).toBeInTheDocument()
    expect(lab.getByTestId('finish-flag-plan')).toHaveTextContent('Plan · Jun 7')
    expect(lab.queryByTestId('finish-flag-forecast')).not.toBeInTheDocument()
    expect(lab.getByTestId('finish-narrative-plan')).toHaveTextContent('Jun 7, 2026')
    expect(lab.queryByTestId('finish-narrative-forecast')).not.toBeInTheDocument()
    expect(lab.getByTestId('crosshair-hit-area')).toBeInTheDocument()
    expect(lab.queryByRole('slider', { name: 'Extra minutes per study day' })).not.toBeInTheDocument()
    expect(lab.queryByRole('link', { name: 'Replan with this pace' })).not.toBeInTheDocument()
  })
})
