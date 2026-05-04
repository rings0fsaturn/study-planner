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
  const actual = await vi.importActual('@study-tracker/roadmap-engine')
  return {
    ...actual,
    generateRoadmap: vi.fn(),
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

function mockBalancedRoadmap() {
  return {
    weeks: [
      {
        weekIndex: 0,
        startDate: '2026-05-04',
        slots: [
          { weekIndex: 0, dayOfWeek: 'Mon' as const, date: '2026-05-04', candidateMaterialIds: ['mat-1'], role: 'anchor' as const, sessionTitle: 'Designing Data-Intensive Applications', plannedMinutes: 120, capacityMinutes: 120 },
          { weekIndex: 0, dayOfWeek: 'Tue' as const, date: '2026-05-05', candidateMaterialIds: [] as string[], role: null, sessionTitle: null, plannedMinutes: 0, capacityMinutes: 120 },
          { weekIndex: 0, dayOfWeek: 'Wed' as const, date: '2026-05-06', candidateMaterialIds: ['mat-2'], role: 'practice' as const, sessionTitle: 'System Design Interview', plannedMinutes: 60, capacityMinutes: 120 },
        ],
      },
    ],
    capacityCheck: {
      status: 'fits' as const,
      totalMaterialMinutes: 300,
      totalCapacityMinutes: 360,
      suggestedWeeks: undefined,
    },
    warnings: [],
  }
}

describe('OnboardingFlow (Integration)', () => {
  let testDb: Dexie
  let logEventMock: ReturnType<typeof vi.fn>

  const baseState = {
    deadline: '2026-06-15',
    purpose: 'System design interview',
    weeklyHours: 10,
    weekdayHours: 6,
    weekendHours: 4,
    selectedStudyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const,
    materials: [
      { id: 'mat-1', title: 'Designing Data-Intensive Applications', estimatedDuration: 180, role: 'anchor' as const, additionOrder: 0, userOverrodeType: false },
      { id: 'mat-2', title: 'System Design Interview', estimatedDuration: 120, role: 'practice' as const, additionOrder: 1, userOverrodeType: false },
    ],
    previewEdits: [] as Array<{ weekIndex: number; dayOfWeek: string; materialId: string | null; sessionTitle: string | null; plannedMinutes: number }>,
    stepReached: 3,
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
    mockUseSync.mockReturnValue({ logEvent: logEventMock, syncState: { status: 'idle', lastSyncedAt: null, pendingCount: 0, lastError: null }, forceSyncNow: vi.fn() } as never)

    const { generateRoadmap } = await import('@study-tracker/roadmap-engine')
    vi.mocked(generateRoadmap).mockReturnValue(mockBalancedRoadmap())
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
        </Routes>
      </MemoryRouter>,
    )
  }

  it('full pipeline: seed state → engine generates roadmap → schedule renders with title, role badge, and rest days', async () => {
    await testDb.table('onboardingDraft').put({ id: 1, state: baseState })

    renderPreview()

    await waitFor(() => {
      const heading = screen.getByRole('heading', { level: 1 })
      expect(heading).toHaveTextContent(/Here's a plan/)
      expect(screen.getByText('Designing Data-Intensive Applications')).toBeInTheDocument()
      expect(screen.getByText('Main reading')).toBeInTheDocument()
      expect(screen.getByText('Rest day')).toBeInTheDocument()
    })
  })

  it('commit fires MaterialAdded × N then RoadmapCreated then OnboardingCompleted in order', async () => {
    await testDb.table('onboardingDraft').put({ id: 1, state: baseState })

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Designing Data-Intensive Applications')).toBeInTheDocument()
    })
    let commitButton: HTMLElement | undefined
    const buttons = screen.getAllByRole('button')
    commitButton = buttons.find(b => b.textContent?.includes('Looks good'))
    expect(commitButton).toBeDefined()

    fireEvent.click(commitButton!)

    await waitFor(() => {
      expect(logEventMock).toHaveBeenCalledTimes(4)
    })

    const kinds = logEventMock.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(kinds.filter(k => k === 'MaterialAdded')).toHaveLength(2)
    expect(kinds.filter(k => k === 'RoadmapCreated')).toHaveLength(1)
    expect(kinds.filter(k => k === 'OnboardingCompleted')).toHaveLength(1)

    const matAddedEnd = kinds.lastIndexOf('MaterialAdded')
    const roadmapCreated = kinds.indexOf('RoadmapCreated')
    const onboardingDone = kinds.indexOf('OnboardingCompleted')
    expect(matAddedEnd).toBeLessThan(roadmapCreated)
    expect(roadmapCreated).toBeLessThan(onboardingDone)
  })

  it('over-capacity: materials exceed capacity → button disabled and modal warns', async () => {
    const overCapacityState = {
      ...baseState,
      weeklyHours: 1,
      weekdayHours: 1,
      weekendHours: 0,
      selectedStudyDays: ['Mon'] as const,
      materials: [
        { id: 'mat-1', title: 'DDIA', estimatedDuration: 600, role: 'anchor' as const, additionOrder: 0, userOverrodeType: false },
      ],
    }
    await testDb.table('onboardingDraft').put({ id: 1, state: overCapacityState })

    const overCapacityRoadmap = {
      weeks: [
        { weekIndex: 0, startDate: '2026-05-04', slots: [{ weekIndex: 0, dayOfWeek: 'Mon' as const, date: '2026-05-04', candidateMaterialIds: ['mat-1'], role: 'anchor' as const, sessionTitle: 'DDIA', plannedMinutes: 600, capacityMinutes: 60 }] },
      ],
      capacityCheck: { status: 'over-capacity' as const, totalMaterialMinutes: 600, totalCapacityMinutes: 60 },
      warnings: [],
    }
    const { generateRoadmap } = await import('@study-tracker/roadmap-engine')
    vi.mocked(generateRoadmap).mockReturnValue(overCapacityRoadmap)

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText(/Plan doesn't fit/)).toBeInTheDocument()
    })

    const buttons = screen.getAllByRole('button')
    const commitButton = buttons.find(b => b.textContent?.includes('Looks good'))
    expect(commitButton).toBeDefined()
    expect(commitButton!.hasAttribute('disabled')).toBe(true)
  })

  it('tie resolution: multi-candidate slot shows Pick one, user resolves → commit enabled', async () => {
    await testDb.table('onboardingDraft').put({
      id: 1, state: {
        ...baseState, materials: [
          { id: 'mat-1', title: 'DDIA', estimatedDuration: 60, role: 'anchor' as const, additionOrder: 0, userOverrodeType: false },
          { id: 'mat-2', title: 'Clean Code', estimatedDuration: 60, role: 'foundation' as const, additionOrder: 1, userOverrodeType: false },
        ],
      },
    })

    const tieRoadmap = {
      weeks: [
        { weekIndex: 0, startDate: '2026-05-04', slots: [{ weekIndex: 0, dayOfWeek: 'Mon' as const, date: '2026-05-04', candidateMaterialIds: ['mat-1', 'mat-2'], role: null, sessionTitle: null, plannedMinutes: 60, capacityMinutes: 120 }] },
      ],
      capacityCheck: { status: 'fits' as const, totalMaterialMinutes: 60, totalCapacityMinutes: 120 },
      warnings: [{ kind: 'unresolved-tie-count' as const, detail: { count: 1 } }],
    }
    const { generateRoadmap } = await import('@study-tracker/roadmap-engine')
    vi.mocked(generateRoadmap).mockReturnValue(tieRoadmap)

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Pick one')).toBeInTheDocument()
    })

    const reviewDdia = screen.getByText('Review DDIA')
    fireEvent.click(reviewDdia)

    await waitFor(() => {
      expect(screen.getByText('Main reading')).toBeInTheDocument()
    })
  })
})