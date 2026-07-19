import { describe, expect, it, beforeEach, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import type { Event } from '../events/EventStore'
import type { RoadmapCreatedPayload } from '../sync/types'
import { Roadmaps } from './Roadmaps'

const mockState = vi.hoisted(() => ({
  events: [] as Event[],
  draft: null as { title: string; stepReached: number; stepLabel: string } | null,
  deleteDraft: vi.fn(),
  logEvent: vi.fn(),
}))

vi.mock('../events/useEventStore', () => ({
  useEventStore: () => ({
    getAll: vi.fn().mockResolvedValue(mockState.events),
    table: vi.fn(() => ({
      delete: mockState.deleteDraft,
    })),
  }),
}))

vi.mock('../sync/useSync', () => ({
  useSync: () => ({
    logEvent: mockState.logEvent,
    syncState: { status: 'idle', lastSyncedAt: null, pendingCount: 0, lastError: null, initialRestorePending: false },
    forceSyncNow: vi.fn(),
  }),
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (querier: () => unknown) => (
    String(querier).includes('deriveRoadmapDraft')
      ? mockState.draft
      : mockState.events
  ),
}))

vi.mock('../roadmap/RoadmapCalendar', () => ({
  RoadmapCalendar: ({
    roadmapCreatedAt,
    readOnly,
  }: {
    roadmapCreatedAt?: string | null
    readOnly?: boolean
  }) => (
    <div data-testid="mock-roadmap-calendar" data-readonly={readOnly ? 'true' : 'false'}>
      {roadmapCreatedAt}
    </div>
  ),
}))

function roadmapPayload(overrides: Partial<RoadmapCreatedPayload> = {}): RoadmapCreatedPayload {
  return {
    startDate: '2026-06-01',
    deadline: '2099-06-30',
    weeks: 4,
    purpose: 'Distributed systems',
    selectedStudyDays: ['Mon', 'Wed'],
    weekdayHours: 1,
    weekendHours: 0,
    weeklyHours: 2,
    slots: [
      {
        date: '2026-06-03',
        dayOfWeek: 'Wed',
        weekIndex: 0,
        plannedMinutes: 60,
        capacityMinutes: 60,
        candidateMaterialIds: ['mat-1'],
        role: 'anchor',
        sessionTitle: 'Read chapter 1',
      },
      {
        date: '2026-06-10',
        dayOfWeek: 'Wed',
        weekIndex: 1,
        plannedMinutes: 60,
        capacityMinutes: 60,
        candidateMaterialIds: ['mat-2'],
        role: 'foundation',
        sessionTitle: 'Read chapter 2',
      },
    ],
    ...overrides,
  }
}

function event(kind: string, payload: unknown, createdAt: string): Event {
  return { kind, payload: payload as Record<string, unknown>, createdAt }
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}

function renderRoadmaps() {
  return render(
    <MemoryRouter>
      <LocationProbe />
      <Roadmaps />
    </MemoryRouter>,
  )
}

describe('Roadmaps dashboard', () => {
  beforeEach(() => {
    mockState.events = []
    mockState.draft = null
    mockState.deleteDraft.mockReset()
    mockState.deleteDraft.mockResolvedValue(undefined)
    mockState.logEvent.mockReset()
    mockState.logEvent.mockResolvedValue(1)
  })

  it('renders the active hero with progress and actions', () => {
    mockState.events = [
      event('OnboardingCompleted', {}, '2026-05-01T00:00:00.000Z'),
      event('RoadmapCreated', roadmapPayload(), '2026-06-01T00:00:00.000Z'),
      event(
        'SessionLogged',
        { sessionId: 's1', date: '2026-06-03', materialId: 'mat-1', duration: 60 },
        '2026-06-03T12:00:00.000Z',
      ),
    ]

    renderRoadmaps()

    expect(screen.getByTestId('roadmaps-active-hero')).toBeInTheDocument()
    expect(screen.getByText('Distributed systems')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open plan' })).toHaveAttribute('href', '/roadmap')
    expect(screen.getByRole('button', { name: 'Close plan' })).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getAllByText('50%')).not.toHaveLength(0)
  })

  it('does not count date-window gap sessions as active roadmap progress', () => {
    mockState.events = [
      event('OnboardingCompleted', {}, '2026-05-01T00:00:00.000Z'),
      event('RoadmapCreated', roadmapPayload(), '2026-06-01T00:00:00.000Z'),
      event(
        'SessionLogged',
        { sessionId: 'gap', date: '2026-06-03', materialId: 'other-material', duration: 30 },
        '2026-06-03T12:00:00.000Z',
      ),
    ]

    renderRoadmaps()

    const stats = screen.getByLabelText('Active roadmap stats')
    expect(stats).toHaveTextContent('0 sessions')
    expect(stats).toHaveTextContent('0m logged')
    expect(stats).toHaveTextContent('0% complete')
  })

  it('disables Start plan while an active roadmap exists', () => {
    mockState.events = [
      event('OnboardingCompleted', {}, '2026-05-01T00:00:00.000Z'),
      event('RoadmapCreated', roadmapPayload(), '2026-06-01T00:00:00.000Z'),
    ]
    mockState.draft = { title: 'Algorithms', stepReached: 3, stepLabel: 'Materials' }

    renderRoadmaps()

    expect(screen.getByTestId('roadmaps-draft-card')).toBeInTheDocument()
    expect(screen.getByText('Start unlocks when the current plan is closed.')).toBeInTheDocument()
    expect(screen.getByTestId('roadmaps-start-plan')).toBeDisabled()
  })

  it('enables Start plan when no roadmap is active', () => {
    mockState.events = [
      event('OnboardingCompleted', {}, '2026-05-01T00:00:00.000Z'),
    ]
    mockState.draft = { title: 'Algorithms', stepReached: 3, stepLabel: 'Materials' }

    renderRoadmaps()

    expect(screen.getByTestId('roadmaps-start-plan')).toBeEnabled()
  })

  it('shows draft content only when a derived draft is present', () => {
    mockState.events = [
      event('OnboardingCompleted', {}, '2026-05-01T00:00:00.000Z'),
    ]
    mockState.draft = null

    const { rerender } = renderRoadmaps()
    expect(screen.queryByTestId('roadmaps-draft-card')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Plan your next roadmap' })).toHaveAttribute('href', '/onboarding?new=1')

    mockState.draft = { title: 'Algorithms', stepReached: 2, stepLabel: 'Hours' }
    rerender(
      <MemoryRouter>
        <Roadmaps />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('roadmaps-draft-card')).toBeInTheDocument()
    expect(screen.getByText('Paused at step 2 · Hours')).toBeInTheDocument()
  })

  it('shows the start prompt after closing an active roadmap with a draft waiting', async () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    mockState.events = [
      event('OnboardingCompleted', {}, '2026-05-01T00:00:00.000Z'),
      event('RoadmapCreated', roadmapPayload(), createdAt),
    ]
    mockState.draft = { title: 'Algorithms', stepReached: 3, stepLabel: 'Materials' }

    renderRoadmaps()

    fireEvent.click(screen.getByRole('button', { name: 'Close plan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))

    await waitFor(() => {
      expect(screen.getByTestId('roadmaps-close-prompt')).toBeInTheDocument()
    })
    expect(screen.getByText('Ready to start Algorithms?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start now' })).toHaveAttribute('href', '/onboarding/3?new=1')
    expect(mockState.logEvent).toHaveBeenCalledWith('RoadmapMarkedComplete', {
      roadmapCreatedAt: createdAt,
      resolvedAt: expect.any(String),
    })
  })

  it('navigates to route detail from history rows without inline calendar state', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const encodedCreatedAt = encodeURIComponent(createdAt)
    mockState.events = [
      event('RoadmapCreated', roadmapPayload({ purpose: 'Completed plan' }), createdAt),
      event(
        'RoadmapMarkedComplete',
        { roadmapCreatedAt: createdAt, resolvedAt: '2026-06-30T00:00:00.000Z' },
        '2026-06-30T00:00:00.000Z',
      ),
    ]

    renderRoadmaps()
    expect(screen.queryByTestId('roadmaps-readonly-detail')).not.toBeInTheDocument()

    const historyLink = screen.getByRole('link', { name: /Completed plan/ })
    expect(historyLink).toHaveAttribute('href', `/roadmap?roadmap=${encodedCreatedAt}`)
    fireEvent.click(historyLink)

    expect(screen.getByTestId('location')).toHaveTextContent(`/roadmap?roadmap=${encodedCreatedAt}`)
    expect(screen.queryByTestId('roadmaps-readonly-detail')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-roadmap-calendar')).not.toBeInTheDocument()
  })

  it('shows an ended status and banner for an active roadmap past its deadline', () => {
    mockState.events = [
      event('RoadmapCreated', roadmapPayload({ deadline: '2026-06-01' }), '2026-05-01T00:00:00.000Z'),
    ]

    renderRoadmaps()

    expect(screen.getByText('• Ended — needs review')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Roadmap ended' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Extend deadline' })).toHaveAttribute('href', '/replan?intent=extend')
  })
})
