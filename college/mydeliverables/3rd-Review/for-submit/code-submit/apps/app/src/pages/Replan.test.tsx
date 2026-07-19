/**
 * Replan page integration tests for the Phase 7 levers UI.
 * Full test coverage lives in src/roadmap/replan/Replan.test.tsx.
 * This file retains a smoke test to confirm the component mounts from the pages path.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Event } from '../events/EventStore'
import type { RoadmapCreatedPayload } from '../sync/types'
import { Replan } from './Replan'

const mockState = vi.hoisted(() => ({
  events: [] as Event[],
  logEvent: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('../events/useEventStore', () => ({
  useEventStore: () => ({
    getAll: vi.fn().mockResolvedValue(mockState.events),
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
  useLiveQuery: () => mockState.events,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockState.navigate,
  }
})

const ROADMAP_CREATED_AT = '2026-07-01T10:00:00.000Z'

function roadmapPayload(): RoadmapCreatedPayload {
  return {
    startDate: '2026-07-01',
    deadline: '2026-08-01',
    weeks: 4,
    purpose: 'Systems exam',
    selectedStudyDays: ['Mon'],
    weekdayHours: 1,
    weekendHours: 0,
    weeklyHours: 1,
    materialIds: ['mat-1'],
    slots: undefined,
  }
}

function event(kind: string, payload: unknown, createdAt: string): Event {
  return { kind, payload: payload as Record<string, unknown>, createdAt }
}

describe('Replan page', () => {
  beforeEach(() => {
    mockState.events = [
      event('MaterialAdded', {
        materialId: 'mat-1', title: 'Systems Textbook', estimatedDuration: 120,
        kind: 'manual', role: 'anchor',
      }, '2026-06-30T09:00:00.000Z'),
      event('RoadmapCreated', roadmapPayload(), ROADMAP_CREATED_AT),
    ]
    mockState.logEvent.mockResolvedValue(1)
    mockState.navigate.mockReset()
  })

  it('renders the levers UI (no SchedulePreview) with Apply/Keep controls', () => {
    render(
      <MemoryRouter initialEntries={['/replan']}>
        <Replan />
      </MemoryRouter>,
    )
    expect(screen.getByText('Adjust your plan')).toBeInTheDocument()
    expect(screen.getByText('Extend the deadline')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep current' })).toBeInTheDocument()
    // Old slot preview text must not appear
    expect(screen.queryByText('0 locked, 1 will be re-planned')).not.toBeInTheDocument()
  })

  it('shows no active roadmap fallback when events are empty', () => {
    mockState.events = []
    render(
      <MemoryRouter initialEntries={['/replan']}>
        <Replan />
      </MemoryRouter>,
    )
    expect(screen.getByText('No active roadmap')).toBeInTheDocument()
  })
})
