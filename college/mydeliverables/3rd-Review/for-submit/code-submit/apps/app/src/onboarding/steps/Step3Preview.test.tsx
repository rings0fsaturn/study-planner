import { describe, it, expect, beforeEach, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Step3Preview } from './Step3Preview'
import { OnboardingProvider } from '../OnboardingProvider'
import { useEventStore } from '../../events/useEventStore'
import { useEventStoreContext } from '../../events/EventStoreProvider'
import { useSync } from '../../sync/useSync'
import type { EventStore } from '../../events/EventStore'
import Dexie from 'dexie'

vi.mock('../../events/useEventStore')
vi.mock('../../events/EventStoreProvider')
vi.mock('../../sync/useSync')
vi.mock('../CheckpointGate', () => ({
  CheckpointGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@study-tracker/roadmap-engine', async () => {
  const actual = await vi.importActual<typeof import('@study-tracker/roadmap-engine')>('@study-tracker/roadmap-engine')
  return {
    ...actual,
    generateBookings: vi.fn(actual.generateBookings),
  }
})

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

const mockUseEventStore = vi.mocked(useEventStore)
const mockUseEventStoreContext = vi.mocked(useEventStoreContext)
const mockUseSync = vi.mocked(useSync)

const TEST_DB_NAME = 'StudyTrackerTestStep3Preview'

async function createTestEventStore() {
  const db = new Dexie(TEST_DB_NAME)
  db.version(1).stores({
    events: '++id, kind, createdAt',
    sync_queue: '++id, kind, createdAt, retries',
    sync_meta: 'key',
    onboardingDraft: 'id',
  })
  await db.open()
  return db
}

function seedOnboardingState(db: Dexie, overrides: Record<string, unknown> = {}) {
  return db.table('onboardingDraft').put({
    id: 1,
    state: {
      deadline: '2026-07-20',
      purpose: 'Test exam',
      weeklyHours: 10,
      weekdayHours: 2,
      weekendHours: 1,
      selectedStudyDays: ['Mon', 'Wed', 'Fri'],
      materials: [
        { id: 'mat-1', title: 'Designing Data-Intensive Applications', estimatedDuration: 120, role: 'anchor', additionOrder: 0, userOverrodeType: false, kind: 'manual', fetchStatus: 'success' },
      ],
      playlists: [],
      previewEdits: [],
      stepReached: 3,
      nextAdditionOrder: 1,
      ...overrides,
    },
  })
}

function mockBookingResult(overrides: Record<string, unknown> = {}) {
  return {
    bookings: [
      { id: 'planned:0:2026-07-01', date: '2026-07-01', estimatedDuration: 120, status: 'booked' as const },
      { id: 'planned:1:2026-07-03', date: '2026-07-03', estimatedDuration: 120, status: 'booked' as const },
    ],
    capacityCheck: {
      status: 'fits' as const,
      totalMaterialMinutes: 120,
      totalCapacityMinutes: 480,
      suggestedWeeks: undefined,
    },
    warnings: [],
    ...overrides,
  }
}

describe('Step3Preview', () => {
  let testDb: Dexie
  let logEventMock: ReturnType<typeof vi.fn>
  let getAllMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    testDb = await createTestEventStore()
    await Promise.all([
      testDb.table('events').clear(),
      testDb.table('sync_queue').clear(),
      testDb.table('sync_meta').clear(),
      testDb.table('onboardingDraft').clear(),
    ])

    logEventMock = vi.fn().mockResolvedValue(1)
    getAllMock = vi.fn().mockResolvedValue([])

    const mockEventStore = {
      getAll: getAllMock,
      append: vi.fn(),
      table: (name: string) => testDb.table(name),
    } as unknown as EventStore

    mockUseEventStoreContext.mockReturnValue({
      eventStore: mockEventStore,
      ready: true,
    })
    mockUseEventStore.mockReturnValue(mockEventStore as never)
    mockUseSync.mockReturnValue({ logEvent: logEventMock, syncState: { status: 'idle', lastSyncedAt: null, pendingCount: 0, lastError: null, initialRestorePending: false }, forceSyncNow: vi.fn() } as never)

    const { generateBookings } = await import('@study-tracker/roadmap-engine')
    vi.mocked(generateBookings).mockReturnValue(mockBookingResult())
  })

  afterEach(() => {
    testDb.close()
  })

  function renderPreview(initialEntry = '/onboarding/3/preview') {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/onboarding/3/preview" element={
            <OnboardingProvider>
              <Step3Preview />
            </OnboardingProvider>
          } />
          <Route path="/onboarding/4" element={<div data-testid="onboarding-step-4">Step 4</div>} />
          <Route path="/roadmaps" element={<div data-testid="roadmaps-route">Roadmaps</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('renders a capacity summary and material directory instead of a slot schedule', async () => {
    await seedOnboardingState(testDb)

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Projected finish')).toBeInTheDocument()
      expect(screen.getByText('Your backlog fits your time')).toBeInTheDocument()
      expect(screen.getByText('Designing Data-Intensive Applications')).toBeInTheDocument()
      expect(screen.queryByText('Rest day')).not.toBeInTheDocument()
      expect(screen.queryByText('Pick one')).not.toBeInTheDocument()
    })
  })

  it('expands the multi-month calendar from the projected finish card', async () => {
    await seedOnboardingState(testDb)

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Calendar')).toBeInTheDocument()
    })

    const finishToggle = screen.getByText('Projected finish').closest('[role="button"]')
    expect(finishToggle).not.toBeNull()
    expect(finishToggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(finishToggle!)

    expect(finishToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByText('Session').length).toBeGreaterThan(0)
  })

  it('uses booked preview styling and study-day indicators in the calendar', async () => {
    await seedOnboardingState(testDb)

    const { container } = renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Calendar')).toBeInTheDocument()
    })

    const finishToggle = screen.getByText('Projected finish').closest('[role="button"]')
    expect(finishToggle).not.toBeNull()
    fireEvent.click(finishToggle!)

    const bookedChip = container.querySelector('[aria-label^="Booked study session"]')
    expect(bookedChip).not.toBeNull()
    expect(bookedChip).toHaveClass('roadmap-chip-booked')
    expect(bookedChip).not.toHaveClass('roadmap-chip-done')
    expect(bookedChip?.getAttribute('title')).toContain('Booked study session')
    expect(container.querySelector('.onboarding-mini-calendar .roadmap-day-studyday')).not.toBeNull()
    expect(screen.getByText('study day')).toBeInTheDocument()
    expect(screen.getByText('booked session')).toBeInTheDocument()
  })

  it('committing emits materials, no-slot roadmap, generated bookings, then onboarding completion in order', async () => {
    await seedOnboardingState(testDb)

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Designing Data-Intensive Applications')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Looks good/ }))

    await waitFor(() => {
      expect(logEventMock).toHaveBeenCalledTimes(5)
    })

    const calls = logEventMock.mock.calls
    const kinds = calls.map((call: unknown[]) => call[0] as string)
    expect(kinds).toEqual([
      'MaterialAdded',
      'RoadmapCreated',
      'SessionBooked',
      'SessionBooked',
      'OnboardingCompleted',
    ])

    const roadmapPayload = calls[1][1] as Record<string, unknown>
    const roadmapCreatedAt = calls[1][2] as string
    expect(roadmapPayload.materialIds).toEqual(['mat-1'])
    expect(roadmapPayload.slots).toBeUndefined()
    expect(typeof roadmapCreatedAt).toBe('string')

    const firstBookingPayload = calls[2][1] as Record<string, unknown>
    expect(firstBookingPayload).toMatchObject({
      roadmapCreatedAt,
      bookingId: 'planned:0:2026-07-01',
      date: '2026-07-01',
      estimatedDuration: 120,
    })
  })

  it('disables commit when the booked capacity does not fit', async () => {
    await seedOnboardingState(testDb)
    const { generateBookings } = await import('@study-tracker/roadmap-engine')
    vi.mocked(generateBookings).mockReturnValue(mockBookingResult({
      bookings: [],
      capacityCheck: {
        status: 'over-capacity' as const,
        totalMaterialMinutes: 600,
        totalCapacityMinutes: 120,
      },
    }))

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Needs more time')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Looks good/ })).toBeDisabled()
  })

  it('finishing a new roadmap while one is active saves a draft without creating another roadmap', async () => {
    await seedOnboardingState(testDb)
    getAllMock.mockResolvedValue([
      { kind: 'OnboardingCompleted', payload: {}, createdAt: '2026-05-01T00:00:00.000Z' },
      {
        kind: 'RoadmapCreated',
        payload: {
          startDate: '2026-05-01',
          deadline: '2026-06-01',
          weeks: 4,
          selectedStudyDays: ['Mon'],
          weekdayHours: 1,
          weekendHours: 0,
          weeklyHours: 1,
          materialIds: ['mat-1'],
        },
        createdAt: '2026-05-01T00:00:00.000Z',
      },
      {
        kind: 'SessionBooked',
        payload: {
          roadmapCreatedAt: '2026-05-01T00:00:00.000Z',
          bookingId: 'planned:0:2026-05-04',
          date: '2026-05-04',
          estimatedDuration: 60,
        },
        createdAt: '2026-05-01T00:00:01.000Z',
      },
    ])

    renderPreview('/onboarding/3/preview?new=1')

    await waitFor(() => {
      expect(screen.getByText('Designing Data-Intensive Applications')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Looks good/ }))

    await waitFor(() => {
      expect(screen.getByTestId('roadmaps-route')).toBeInTheDocument()
    })

    const kinds = logEventMock.mock.calls.map((call: unknown[]) => call[0] as string)
    expect(kinds).toHaveLength(0)
    await expect(testDb.table('onboardingDraft').get(1)).resolves.toBeDefined()
  })

  it('finishing a new roadmap with no active plan creates it without duplicating onboarding completion', async () => {
    await seedOnboardingState(testDb)
    getAllMock.mockResolvedValue([
      { kind: 'OnboardingCompleted', payload: {}, createdAt: '2026-05-01T00:00:00.000Z' },
    ])

    renderPreview('/onboarding/3/preview?new=1')

    await waitFor(() => {
      expect(screen.getByText('Designing Data-Intensive Applications')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Looks good/ }))

    await waitFor(() => {
      expect(screen.getByTestId('roadmaps-route')).toBeInTheDocument()
    })

    const kinds = logEventMock.mock.calls.map((call: unknown[]) => call[0] as string)
    expect(kinds.filter((kind) => kind === 'MaterialAdded')).toHaveLength(1)
    expect(kinds.filter((kind) => kind === 'RoadmapCreated')).toHaveLength(1)
    expect(kinds.filter((kind) => kind === 'SessionBooked')).toHaveLength(2)
    expect(kinds).not.toContain('OnboardingCompleted')
    await expect(testDb.table('onboardingDraft').get(1)).resolves.toBeUndefined()
  })
})
