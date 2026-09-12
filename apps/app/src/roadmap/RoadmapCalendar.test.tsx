import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Event } from '../events/EventStore'
import type { RoadmapCreatedPayload } from '../sync/types'
import { MaterialsProvider } from '../materials/MaterialsProvider'
import { FakeMaterialClient } from '../materials/testing/fakeMaterialClient'
import type { MaterialRecord } from '../materials/types'
import { RoadmapCalendar } from './RoadmapCalendar'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

const mockState = vi.hoisted(() => ({
  events: [] as Event[],
  logEvent: vi.fn(),
}))

const mockViewport = vi.hoisted(() => ({ isCompact: false }))

const scrollIntoViewMock = vi.fn()

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

vi.mock('../progress', () => ({
  useCalibrationState: () => ({ calibration: null, status: 'ready' }),
  useProgressSnapshot: () => null,
}))

vi.mock('../lib/useMatchMedia', () => ({
  useMatchMedia: () => mockViewport.isCompact,
}))

function roadmapPayload(overrides: Partial<RoadmapCreatedPayload> = {}): RoadmapCreatedPayload {
  return {
    startDate: '2099-06-01',
    deadline: '2099-06-30',
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

function event(kind: string, payload: unknown, createdAt: string): Event {
  return { kind, payload: payload as Record<string, unknown>, createdAt }
}

function baseEvents(): Event[] {
  const roadmapCreatedAt = '2026-05-01T09:00:00.000Z'
  return [
    event(
      'MaterialAdded',
      {
        materialId: 'mat-1',
        title: 'Distributed Systems',
        estimatedDuration: 120,
        kind: 'article',
        role: 'anchor',
      },
      '2026-05-01T08:00:00.000Z',
    ),
    event(
      'MaterialAdded',
      {
        materialId: 'mat-2',
        title: 'Operating Systems',
        estimatedDuration: 90,
        kind: 'manual',
        role: 'foundation',
      },
      '2026-05-01T08:05:00.000Z',
    ),
    event('RoadmapCreated', roadmapPayload(), roadmapCreatedAt),
    event(
      'SessionBooked',
      {
        roadmapCreatedAt,
        bookingId: 'booking-1',
        date: '2099-06-03',
        estimatedDuration: 60,
        materialId: 'mat-1',
      },
      '2026-05-01T09:01:00.000Z',
    ),
    event(
      'SessionBooked',
      {
        roadmapCreatedAt,
        bookingId: 'booking-blank',
        date: '2099-06-10',
        estimatedDuration: 45,
      },
      '2026-05-01T09:02:00.000Z',
    ),
  ]
}

function materialRecord(overrides: Partial<MaterialRecord>): MaterialRecord {
  return {
    id: 'mat-lib',
    ownerId: 'user-a',
    title: 'Raft paper',
    kind: 'url',
    source: 'https://example.test/raft',
    ingestionState: 'ready',
    ingestionProgress: 1,
    ingestionError: null,
    archived: false,
    contentVersion: 'v1',
    replacedAt: null,
    estimatedMinutes: null,
    uploadCompleteAt: null,
    chunkCount: 0,
    groundingVersion: null,
    extractedTextPath: null,
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-05-01T08:00:00.000Z',
    ...overrides,
  }
}

function renderCalendar(
  readOnly = false,
  client = new FakeMaterialClient([]),
) {
  return render(
    <MemoryRouter>
      <MaterialsProvider client={client}>
        <RoadmapCalendar readOnly={readOnly} />
      </MaterialsProvider>
    </MemoryRouter>,
  )
}

function renderHistoricalCalendar() {
  return render(
    <MemoryRouter>
      <MaterialsProvider client={new FakeMaterialClient([])}>
        <RoadmapCalendar roadmapCreatedAt="2026-05-01T09:00:00.000Z" readOnly />
      </MaterialsProvider>
    </MemoryRouter>,
  )
}

function openBookingEditor(name = /Booked: Distributed Systems, 1h/) {
  fireEvent.click(screen.getByRole('button', { name }))
}

describe('RoadmapCalendar booking interactions', () => {
  beforeEach(() => {
    scrollIntoViewMock.mockReset()
    Element.prototype.scrollIntoView = scrollIntoViewMock
    mockState.events = baseEvents()
    mockState.logEvent.mockReset()
    mockState.logEvent.mockResolvedValue(1)
    mockViewport.isCompact = false
  })

  it('renders booking statuses instead of slot statuses', () => {
    renderCalendar()

    expect(screen.getByRole('button', { name: /Booked: Distributed Systems, 1h/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Booked: Session · pick at start, 45m/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Projected finish')).toHaveTextContent('estimate')
  })

  it('edits a future booking by emitting BookingEdited', async () => {
    renderCalendar()
    openBookingEditor()

    fireEvent.click(screen.getByRole('button', { name: 'Change material' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Edit booking' })).getByRole('button', {
        name: /Operating Systems/,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Use this material' }))
    fireEvent.click(screen.getByLabelText('Increase booking duration'))
    fireEvent.change(screen.getByLabelText('Booking date'), {
      target: { value: '2099-06-04' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => {
      expect(mockState.logEvent).toHaveBeenCalledWith('BookingEdited', {
        roadmapCreatedAt: '2026-05-01T09:00:00.000Z',
        bookingId: 'booking-1',
        date: '2099-06-04',
        estimatedDuration: 75,
        materialId: 'mat-2',
      })
    })
  })

  it('removes a future booking by emitting BookingCleared', async () => {
    renderCalendar()
    openBookingEditor()

    fireEvent.click(screen.getByRole('button', { name: 'Remove booking' }))

    await waitFor(() => {
      expect(mockState.logEvent).toHaveBeenCalledWith('BookingCleared', {
        roadmapCreatedAt: '2026-05-01T09:00:00.000Z',
        bookingId: 'booking-1',
      })
    })
  })

  it('adds a session on an empty day by emitting SessionBooked', async () => {
    renderCalendar()

    fireEvent.click(screen.getAllByRole('button', { name: '+ add session' })[0])
    fireEvent.click(screen.getByRole('button', { name: /Attach/ }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Add session' })).getByRole('button', {
        name: /Operating Systems/,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Use this material' }))
    fireEvent.click(screen.getByLabelText('Decrease new session duration'))
    fireEvent.click(screen.getByRole('button', { name: 'Add session' }))

    await waitFor(() => {
      expect(mockState.logEvent).toHaveBeenCalledWith('SessionBooked', expect.objectContaining({
        roadmapCreatedAt: '2026-05-01T09:00:00.000Z',
        date: expect.stringMatching(/^2099-06-/),
        estimatedDuration: 45,
        materialId: 'mat-2',
      }))
    })
  })

  it('adds a session from a compact empty day sheet', async () => {
    mockViewport.isCompact = true
    const { container } = renderCalendar()

    const emptyDay = container.querySelector('[data-date="2099-06-01"]')
    expect(emptyDay).not.toBeNull()
    fireEvent.click(within(emptyDay as HTMLElement).getByRole('button', { name: 'Open 2099-06-01 day options' }))

    expect(screen.getByRole('dialog', { name: 'Roadmap day sheet' })).toBeInTheDocument()
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    })
    expect(screen.getByText('No sessions booked for this day.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Add session' }))

    expect(screen.queryByRole('dialog', { name: 'Roadmap day sheet' })).not.toBeInTheDocument()
    const addDialog = screen.getByRole('dialog', { name: 'Add session' })
    expect(within(addDialog).getByText('Mon, Jun 1')).toBeInTheDocument()

    fireEvent.click(within(addDialog).getByRole('button', { name: 'Add session' }))

    await waitFor(() => {
      expect(mockState.logEvent).toHaveBeenCalledWith('SessionBooked', expect.objectContaining({
        roadmapCreatedAt: '2026-05-01T09:00:00.000Z',
        date: '2099-06-01',
        estimatedDuration: 60,
      }))
    })
  })

  it('hides compact day-sheet add action in read-only mode', () => {
    mockViewport.isCompact = true
    const { container } = renderHistoricalCalendar()

    const emptyDay = container.querySelector('[data-date="2099-06-01"]')
    expect(emptyDay).not.toBeNull()
    fireEvent.click(within(emptyDay as HTMLElement).getByRole('button', { name: 'Open 2099-06-01 day options' }))

    expect(screen.getByRole('dialog', { name: 'Roadmap day sheet' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Add session' })).not.toBeInTheDocument()
  })

  it('marks in-month study days and legend without tinting outside-month fillers', () => {
    const { container } = renderCalendar()

    expect(screen.getByText('Study day')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Mon' })).toHaveClass('roadmap-weekday-studyday')
    expect(screen.getByRole('columnheader', { name: 'Tue' })).not.toHaveClass('roadmap-weekday-studyday')

    expect(container.querySelector('[data-date="2099-06-01"]')).toHaveClass('roadmap-day-studyday')
    expect(container.querySelector('[data-date="2099-06-02"]')).not.toHaveClass('roadmap-day-studyday')
    expect(container.querySelector('[data-date="2099-07-01"]')).not.toHaveClass('roadmap-day-studyday')
  })

  it('marks material progress without emitting SessionLogged', async () => {
    renderCalendar()

    const directory = screen.getByLabelText('Materials directory')
    fireEvent.click(within(directory).getAllByRole('button', { name: 'Mark progress' })[0])
    fireEvent.change(screen.getByLabelText('Material progress percent'), {
      target: { value: '50' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save progress' }))

    await waitFor(() => {
      expect(mockState.logEvent).toHaveBeenCalledWith('MaterialProgressMarked', expect.objectContaining({
        roadmapCreatedAt: '2026-05-01T09:00:00.000Z',
        materialId: 'mat-1',
        materialPosition: { kind: 'percent', value: 50 },
        source: 'directory',
      }))
    })
    expect(mockState.logEvent).not.toHaveBeenCalledWith('SessionLogged', expect.anything())
  })

  it('keeps booking controls out of read-only history mode', () => {
    renderHistoricalCalendar()

    openBookingEditor()

    expect(screen.queryByRole('dialog', { name: 'Edit booking' })).not.toBeInTheDocument()
    expect(screen.getByText('View booking')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Mark progress' })[0]).toBeDisabled()
    expect(screen.getByRole('link', { name: /Roadmaps/ })).toHaveAttribute('href', '/roadmaps')
  })

  it('attaches a library material from the materials directory "+"', async () => {
    const client = new FakeMaterialClient([
      materialRecord({ id: 'mat-1', title: 'Distributed Systems', kind: 'manual' }),
      materialRecord({ id: 'mat-lib', title: 'Raft paper', kind: 'url' }),
    ])
    renderCalendar(false, client)

    fireEvent.click(screen.getByRole('button', { name: 'Add material to this roadmap' }))

    const dialog = await screen.findByRole('dialog', { name: /Choose materials for planning/i })
    expect(within(dialog).getByText('Raft paper')).toBeInTheDocument()
    expect(within(dialog).queryByText('Distributed Systems')).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Raft paper/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(mockState.logEvent).toHaveBeenCalledWith('MaterialAttached', {
        roadmapCreatedAt: '2026-05-01T09:00:00.000Z',
        materialId: 'mat-lib',
        title: 'Raft paper',
        kind: 'article',
        role: 'foundation',
        estimatedDuration: 60,
      })
    })
    expect(mockState.logEvent).toHaveBeenCalledTimes(1)
  })

  it('lists an attached material in the directory and counts it in the header', () => {
    mockState.events = [
      ...baseEvents(),
      event(
        'MaterialAttached',
        {
          roadmapCreatedAt: '2026-05-01T09:00:00.000Z',
          materialId: 'mat-3',
          title: 'OSTEP',
          estimatedDuration: 90,
          kind: 'file',
          role: 'foundation',
        },
        '2026-05-01T09:03:00.000Z',
      ),
    ]

    renderCalendar()

    expect(screen.getByText(/Active roadmap · 3 materials · 4 weeks/)).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Materials directory')).getByText('OSTEP'),
    ).toBeInTheDocument()
  })

  it('disables the add-material control in read-only history mode', () => {
    renderHistoricalCalendar()

    expect(screen.getByRole('button', { name: 'Add material to this roadmap' })).toBeDisabled()
  })

  it('logs the minutes and role chosen in the attach picker', async () => {
    const client = new FakeMaterialClient([
      materialRecord({ id: 'mat-lib', title: 'Raft paper', kind: 'url', estimatedMinutes: 30 }),
    ])
    renderCalendar(false, client)

    fireEvent.click(screen.getByRole('button', { name: 'Add material to this roadmap' }))
    const dialog = await screen.findByRole('dialog', { name: /Choose materials for planning/i })

    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Raft paper/ }))
    expect(within(dialog).getByLabelText('Minutes for Raft paper')).toHaveValue(30)
    fireEvent.change(within(dialog).getByLabelText('Minutes for Raft paper'), {
      target: { value: '90' },
    })
    fireEvent.change(within(dialog).getByLabelText('Role for Raft paper'), {
      target: { value: 'practice' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }))

    await waitFor(() => {
      expect(mockState.logEvent).toHaveBeenCalledWith('MaterialAttached', expect.objectContaining({
        roadmapCreatedAt: '2026-05-01T09:00:00.000Z',
        materialId: 'mat-lib',
        title: 'Raft paper',
        kind: 'article',
        role: 'practice',
        estimatedDuration: 90,
      }))
    })
  })

  it('detaches a material from its icon, naming what stays behind', async () => {
    const roadmapCreatedAt = '2026-05-01T09:00:00.000Z'
    mockState.events = [
      ...baseEvents(),
      event(
        'MaterialAttached',
        {
          roadmapCreatedAt,
          materialId: 'mat-3',
          title: 'OSTEP',
          estimatedDuration: 90,
          kind: 'file',
          role: 'foundation',
        },
        '2026-05-01T09:03:00.000Z',
      ),
    ]

    renderCalendar()

    const directory = screen.getByLabelText('Materials directory')
    const detach = within(directory).getByRole('button', {
      name: 'Detach OSTEP from this roadmap',
    })
    expect(detach).toHaveAttribute('title', 'Detach material from roadmap?')

    fireEvent.click(detach)

    await waitFor(() => {
      expect(mockState.logEvent).toHaveBeenCalledWith('MaterialDetached', {
        roadmapCreatedAt,
        materialId: 'mat-3',
      })
    })
  })

  it('warns that upcoming sessions keep their label', () => {
    const roadmapCreatedAt = '2026-05-01T09:00:00.000Z'
    mockState.events = [
      ...baseEvents(),
      event(
        'MaterialAttached',
        {
          roadmapCreatedAt,
          materialId: 'mat-3',
          title: 'OSTEP',
          estimatedDuration: 90,
          kind: 'file',
          role: 'foundation',
        },
        '2026-05-01T09:03:00.000Z',
      ),
      event(
        'SessionBooked',
        {
          roadmapCreatedAt,
          bookingId: 'booking-3',
          date: '2099-06-17',
          estimatedDuration: 60,
          materialId: 'mat-3',
        },
        '2026-05-01T09:04:00.000Z',
      ),
    ]

    renderCalendar()

    expect(
      within(screen.getByLabelText('Materials directory')).getByRole('button', {
        name: 'Detach OSTEP from this roadmap',
      }),
    ).toHaveAttribute(
      'title',
      'Detach material from roadmap? 1 upcoming session keeps its label and logged time.',
    )
  })

  it('keeps the detach control out of read-only history mode', () => {
    renderHistoricalCalendar()

    expect(
      within(screen.getByLabelText('Materials directory')).queryByRole('button', {
        name: /^Detach/,
      }),
    ).not.toBeInTheDocument()
  })

  it('reaches the roadmap attach picker from the add-session sheet when the roadmap has no materials', async () => {
    mockState.events = [
      event('RoadmapCreated', roadmapPayload({ materialIds: [] }), '2026-05-01T09:00:00.000Z'),
    ]
    const client = new FakeMaterialClient([materialRecord({ id: 'mat-lib', title: 'Raft paper' })])
    renderCalendar(false, client)

    fireEvent.click(screen.getAllByRole('button', { name: '+ add session' })[0])
    fireEvent.click(screen.getByRole('button', { name: /Attach/ }))

    const picker = screen.getByRole('dialog', { name: 'Choose material' })
    expect(within(picker).getByText('No material · pick at start')).toBeInTheDocument()

    fireEvent.click(
      within(picker).getByRole('button', { name: 'Add a material to this roadmap' }),
    )

    expect(screen.queryByRole('dialog', { name: 'Add session' })).not.toBeInTheDocument()
    const attachPicker = await screen.findByRole('dialog', {
      name: /Choose materials for planning/i,
    })
    expect(within(attachPicker).getByText('Raft paper')).toBeInTheDocument()
  })

  it('opens the attach picker from a booking that has no material', async () => {
    mockState.events = [
      event(
        'RoadmapCreated',
        roadmapPayload({ materialIds: [] }),
        '2026-05-01T09:00:00.000Z',
      ),
      event(
        'SessionBooked',
        {
          roadmapCreatedAt: '2026-05-01T09:00:00.000Z',
          bookingId: 'booking-blank',
          date: '2099-06-10',
          estimatedDuration: 45,
        },
        '2026-05-01T09:01:00.000Z',
      ),
    ]
    const client = new FakeMaterialClient([materialRecord({ id: 'mat-lib', title: 'Raft paper' })])
    renderCalendar(false, client)

    fireEvent.click(screen.getByRole('button', { name: /Session · pick at start/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Change material' }))
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Choose material' })).getByRole('button', {
        name: 'Add a material to this roadmap',
      }),
    )

    expect(screen.queryByRole('dialog', { name: 'Edit booking' })).not.toBeInTheDocument()
    expect(
      await screen.findByRole('dialog', { name: /Choose materials for planning/i }),
    ).toBeInTheDocument()
  })
})
