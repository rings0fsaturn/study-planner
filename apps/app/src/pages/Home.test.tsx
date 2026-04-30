import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  }),
}))

vi.mock('../components/SyncIndicator', () => ({
  SyncIndicator: () => <div data-testid="sync-indicator" />,
}))

let mockEvents: Array<{ id?: number; kind: string; payload: Record<string, unknown>; createdAt: string }> = []

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => mockEvents,
}))

describe('Home', () => {
  beforeEach(() => {
    mockEvents = []
  })

  it('shows only total time when no roadmap events exist', () => {
    mockEvents = []

    render(
      <MemoryRouter initialEntries={['/home']}>
        <Home />
      </MemoryRouter>
    )

    expect(screen.getByText('Total time logged')).toBeInTheDocument()
    expect(screen.queryByText(/Up next/)).not.toBeInTheDocument()
    expect(screen.queryByText('Projected finish')).not.toBeInTheDocument()
  })

  it('shows projected finish and Up next card when RoadmapCreated event exists', () => {
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
    expect(screen.getByText('Projected finish')).toBeInTheDocument()
  })
})
