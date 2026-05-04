import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Home } from './Home'

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
  useCalibrationState: () => null,
  useProgressSnapshot: () => null,
  usePromptDetail: () => null,
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

describe('Home', () => {
  beforeEach(() => {
    mockEvents = []
    mockActiveSession = undefined
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

  it('shows Up next card when RoadmapCreated event exists', () => {
    const today = new Date().toISOString().split('T')[0]
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

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
              sessionTitle: 'DDIA Chapter 1',
            },
            {
              weekIndex: 0,
              dayOfWeek: 'Wed',
              date: futureDate,
              capacityMinutes: 120,
              role: 'practice',
              candidateMaterialIds: ['mat-2'],
              plannedMinutes: 45,
              sessionTitle: 'LeetCode session 1',
            },
          ],
        },
        createdAt: new Date().toISOString(),
      },
    ]

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Home />
      </MemoryRouter>
    )

    expect(screen.getByText(/Up next/)).toBeInTheDocument()
    expect(screen.getByText('DDIA Chapter 1')).toBeInTheDocument()
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
})
