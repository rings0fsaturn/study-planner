import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Event } from '../../events/EventStore'
import type { RoadmapCreatedPayload } from '../../sync/types'
import { Replan } from '../../pages/Replan'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockState = vi.hoisted(() => ({
  events: [] as Event[] | undefined,
  logEvent: vi.fn(),
  navigate: vi.fn(),
  commitReplan: vi.fn(),
}))

vi.mock('../../events/useEventStore', () => ({
  useEventStore: () => ({
    getAll: vi.fn().mockResolvedValue(mockState.events),
  }),
}))

vi.mock('../../sync/useSync', () => ({
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

// Mock commitReplan so we can inspect the arguments passed from the UI
vi.mock('./commitReplan', () => ({
  commitReplan: (opts: unknown) => mockState.commitReplan(opts),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function event(kind: string, payload: unknown, createdAt: string): Event {
  return { kind, payload: payload as Record<string, unknown>, createdAt }
}

const ROADMAP_CREATED_AT = '2026-07-01T10:00:00.000Z'
const DEADLINE = '2026-08-01'

function roadmapPayload(overrides: Partial<RoadmapCreatedPayload> = {}): RoadmapCreatedPayload {
  return {
    startDate: '2026-07-01',
    deadline: DEADLINE,
    weeks: 4,
    purpose: 'Systems',
    selectedStudyDays: ['Mon', 'Wed'],
    weekdayHours: 1,
    weekendHours: 0,
    weeklyHours: 2,
    materialIds: ['mat-1', 'mat-2'],
    slots: undefined,
    ...overrides,
  }
}

function baseEvents(): Event[] {
  return [
    event('MaterialAdded', {
      materialId: 'mat-1', title: 'Algo Book', estimatedDuration: 120,
      kind: 'manual', role: 'anchor',
    }, '2026-06-30T09:00:00.000Z'),
    event('MaterialAdded', {
      materialId: 'mat-2', title: 'Practice Set', estimatedDuration: 60,
      kind: 'manual', role: 'practice',
    }, '2026-06-30T09:01:00.000Z'),
    event('RoadmapCreated', roadmapPayload(), ROADMAP_CREATED_AT),
  ]
}

function renderReplanTree(search = '') {
  return (
    <MemoryRouter initialEntries={[`/replan${search}`]}>
      <Replan />
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Replan', () => {
  beforeEach(() => {
    mockState.events = baseEvents()
    mockState.logEvent.mockResolvedValue(1)
    mockState.navigate.mockReset()
    mockState.commitReplan.mockReset()
    mockState.commitReplan.mockResolvedValue(undefined)
  })

  function renderReplan(search = '') {
    return render(renderReplanTree(search))
  }

  it('renders the levers layout — no SchedulePreview', () => {
    renderReplan()
    expect(screen.getByText('Adjust your plan')).toBeInTheDocument()
    expect(screen.getByText('Extend the deadline')).toBeInTheDocument()
    expect(screen.getByText('Study more each week')).toBeInTheDocument()
    expect(screen.getByText('Drop or shorten materials')).toBeInTheDocument()
    expect(screen.queryByTestId('schedule-preview')).not.toBeInTheDocument()
  })

  it('shows the live outcome panel', () => {
    renderReplan()
    expect(screen.getByText('estimate')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep current' })).toBeInTheDocument()
  })

  it('intent=extend pre-selects +1 week preset', () => {
    renderReplan('?intent=extend')
    const plusOneWeek = screen.getByRole('button', { name: '+1 week' })
    expect(plusOneWeek).toHaveAttribute('aria-pressed', 'true')
  })

  it('hydrates capacity levers when roadmap data loads after the first render', async () => {
    mockState.events = undefined
    const view = renderReplan()
    expect(screen.getByRole('status')).toHaveTextContent('Loading replan')

    mockState.events = baseEvents().map((evt) =>
      evt.kind === 'RoadmapCreated'
        ? event(
            'RoadmapCreated',
            roadmapPayload({
              selectedStudyDays: ['Tue', 'Thu'],
              weekdayHours: 2,
              weekendHours: 2,
              weeklyHours: 4,
            }),
            ROADMAP_CREATED_AT,
          )
        : evt,
    )
    view.rerender(renderReplanTree())

    await waitFor(() =>
      expect(screen.getByTestId('hours-per-day-value')).toHaveTextContent('2h'),
    )
    expect(screen.getByRole('button', { name: 'Tue' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Thu' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('capacity lever changes the live projected finish', async () => {
    renderReplan()
    await screen.findByText('Algo Book')

    const finish = screen.getByLabelText('Projected finish')
    const before = finish.textContent

    fireEvent.click(screen.getByRole('button', { name: 'Increase hours per day' }))

    await waitFor(() => expect(finish.textContent).not.toBe(before))
  })

  it('Keep current navigates without committing', () => {
    renderReplan()
    fireEvent.click(screen.getByRole('button', { name: 'Keep current' }))
    expect(mockState.navigate).toHaveBeenCalledWith('/roadmap')
    expect(mockState.commitReplan).not.toHaveBeenCalled()
  })

  it('Apply changes calls commitReplan and navigates to roadmap', async () => {
    renderReplan()
    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }))
    await waitFor(() => expect(mockState.navigate).toHaveBeenCalledWith('/roadmap'))
    expect(mockState.commitReplan).toHaveBeenCalledWith(expect.objectContaining({
      roadmapCreatedAt: ROADMAP_CREATED_AT,
    }))
  })

  it('dropping a material removes it from commitReplan materialIds', async () => {
    renderReplan()

    await screen.findByText('Practice Set')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Drop Practice Set' }))
    })

    expect(screen.getByRole('button', { name: 'Restore Practice Set' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }))
    await waitFor(() => expect(mockState.commitReplan).toHaveBeenCalled())

    const opts = mockState.commitReplan.mock.calls[0][0]
    expect((opts.materialIds as string[]).includes('mat-2')).toBe(false)
    expect((opts.materialIds as string[]).includes('mat-1')).toBe(true)
  })

  it('shortening a material writes materialDurationOverrides to commitReplan', async () => {
    renderReplan()

    await screen.findByText('Algo Book')

    // Shorten mat-1 (120m) by 3 × 15m = 75m remaining
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shorten Algo Book' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shorten Algo Book' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Shorten Algo Book' }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }))
    await waitFor(() => expect(mockState.commitReplan).toHaveBeenCalled())

    const opts = mockState.commitReplan.mock.calls[0][0]
    expect(opts.materialDurationOverrides).toBeDefined()
    expect((opts.materialDurationOverrides as Record<string, number>)['mat-1']).toBe(75)
  })

  it('preserves existing materialDurationOverrides when applying without touching materials', async () => {
    mockState.events = [
      ...baseEvents(),
      event(
        'RoadmapReplanned',
        {
          ...roadmapPayload(),
          roadmapCreatedAt: ROADMAP_CREATED_AT,
          materialDurationOverrides: { 'mat-1': 75 },
          slots: undefined,
        },
        '2026-07-02T10:00:00.000Z',
      ),
    ]

    renderReplan()
    await screen.findByText('Algo Book')

    fireEvent.click(screen.getByRole('button', { name: 'Apply changes' }))
    await waitFor(() => expect(mockState.commitReplan).toHaveBeenCalled())

    const opts = mockState.commitReplan.mock.calls[0][0]
    expect((opts.materialDurationOverrides as Record<string, number>)['mat-1']).toBe(75)
  })
})
