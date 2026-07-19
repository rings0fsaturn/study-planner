import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Step3Preview } from './steps/Step3Preview'
import { OnboardingProvider } from './OnboardingProvider'
import { useEventStore } from '../events/useEventStore'
import { useEventStoreContext } from '../events/EventStoreProvider'
import { useSync } from '../sync/useSync'
import type { EventStore } from '../events/EventStore'
import Dexie from 'dexie'

vi.mock('../events/useEventStore')
vi.mock('../events/EventStoreProvider')
vi.mock('../sync/useSync')
vi.mock('./CheckpointGate', () => ({
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

const TEST_DB_NAME = 'StudyTrackerTestFlow'

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

function mockBookingResult(overrides: Record<string, unknown> = {}) {
  return {
    bookings: [
      { id: 'planned:0:2026-07-01', date: '2026-07-01', estimatedDuration: 120, status: 'booked' as const },
      { id: 'planned:1:2026-07-03', date: '2026-07-03', estimatedDuration: 120, status: 'booked' as const },
    ],
    capacityCheck: {
      status: 'fits' as const,
      totalMaterialMinutes: 300,
      totalCapacityMinutes: 720,
      suggestedWeeks: undefined,
    },
    warnings: [],
    ...overrides,
  }
}

describe('OnboardingFlow (Integration)', () => {
  let testDb: Dexie
  let logEventMock: ReturnType<typeof vi.fn>

  const baseState = {
    deadline: '2026-07-20',
    purpose: 'System design interview',
    weeklyHours: 10,
    weekdayHours: 2,
    weekendHours: 1,
    selectedStudyDays: ['Mon', 'Wed', 'Fri'] as const,
    materials: [
      { id: 'mat-1', title: 'Designing Data-Intensive Applications', estimatedDuration: 180, role: 'anchor' as const, additionOrder: 0, userOverrodeType: false, kind: 'manual' as const, fetchStatus: 'success' as const },
      { id: 'mat-2', title: 'System Design Interview', estimatedDuration: 120, role: 'practice' as const, additionOrder: 1, userOverrodeType: false, kind: 'manual' as const, fetchStatus: 'success' as const },
    ],
    playlists: [],
    previewEdits: [] as Array<{ weekIndex: number; dayOfWeek: string; materialId: string | null; sessionTitle: string | null; plannedMinutes: number }>,
    stepReached: 3,
    nextAdditionOrder: 2,
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    testDb = await createTestEventStore()
    await testDb.table('onboardingDraft').clear()

    logEventMock = vi.fn().mockResolvedValue(1)

    const mockEventStore = {
      getAll: vi.fn().mockResolvedValue([]),
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

  function renderPreview() {
    return render(
      <MemoryRouter initialEntries={['/onboarding/3/preview']}>
        <Routes>
          <Route path="/onboarding/3/preview" element={
            <OnboardingProvider>
              <Step3Preview />
            </OnboardingProvider>
          } />
          <Route path="/onboarding/4" element={<div>Step 4 reached</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('full pipeline renders booking summary with the material directory', async () => {
    await testDb.table('onboardingDraft').put({ id: 1, state: baseState })

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Projected finish')).toBeInTheDocument()
      expect(screen.getByText('Your backlog fits your time')).toBeInTheDocument()
      expect(screen.getByText('Designing Data-Intensive Applications')).toBeInTheDocument()
      expect(screen.getByText('System Design Interview')).toBeInTheDocument()
      expect(screen.queryByText('Rest day')).not.toBeInTheDocument()
    })
  })

  it('commit fires MaterialAdded × N, RoadmapCreated, SessionBooked × N, then OnboardingCompleted in order', async () => {
    await testDb.table('onboardingDraft').put({ id: 1, state: baseState })

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Designing Data-Intensive Applications')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Looks good/ }))

    await waitFor(() => {
      expect(logEventMock).toHaveBeenCalledTimes(6)
    })

    const calls = logEventMock.mock.calls
    const kinds = calls.map((c: unknown[]) => c[0] as string)
    expect(kinds).toEqual([
      'MaterialAdded',
      'MaterialAdded',
      'RoadmapCreated',
      'SessionBooked',
      'SessionBooked',
      'OnboardingCompleted',
    ])

    const roadmapCreatedAt = calls[2][2] as string
    const roadmapPayload = calls[2][1] as Record<string, unknown>
    expect(roadmapPayload.materialIds).toEqual(['mat-1', 'mat-2'])
    expect(roadmapPayload.slots).toBeUndefined()

    expect(calls[3][1]).toMatchObject({
      roadmapCreatedAt,
      bookingId: 'planned:0:2026-07-01',
    })
  })

  it('over-capacity disables the commit button', async () => {
    await testDb.table('onboardingDraft').put({ id: 1, state: baseState })
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
})
