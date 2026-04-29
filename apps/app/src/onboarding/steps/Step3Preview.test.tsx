import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
vi.mock('@study-tracker/progress-engine', async () => {
  const actual = await vi.importActual('@study-tracker/progress-engine')
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
      deadline: '2026-06-01',
      purpose: 'Test exam',
      weeklyHours: 10,
      weekdayHours: 6,
      weekendHours: 4,
      selectedStudyDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      materials: [
        { id: 'mat-1', title: 'Designing Data-Intensive Applications', estimatedDuration: 120, role: 'anchor', additionOrder: 0, userOverrodeType: false },
      ],
      previewEdits: [],
      stepReached: 3,
      ...overrides,
    },
  })
}

function mockBalancedRoadmap() {
  return {
    weeks: [
      {
        weekIndex: 0,
        startDate: '2026-05-04',
        slots: [
          { weekIndex: 0, dayOfWeek: 'Mon' as const, date: '2026-05-04', candidateMaterialIds: ['mat-1'], role: 'anchor' as const, sessionTitle: 'Designing Data-Intensive Applications', plannedMinutes: 120 },
          { weekIndex: 0, dayOfWeek: 'Tue' as const, date: '2026-05-05', candidateMaterialIds: [] as string[], role: null, sessionTitle: null, plannedMinutes: 0 },
        ],
      },
    ],
    capacityCheck: {
      status: 'balanced' as const,
      totalMaterialMinutes: 120,
      totalCapacityMinutes: 240,
      suggestedWeeks: null,
    },
    warnings: [],
  }
}

function mockTieRoadmap() {
  return {
    weeks: [
      {
        weekIndex: 0,
        startDate: '2026-05-04',
        slots: [
          { weekIndex: 0, dayOfWeek: 'Mon' as const, date: '2026-05-04', candidateMaterialIds: ['mat-1', 'mat-2'], role: null, sessionTitle: null, plannedMinutes: 60 },
        ],
      },
    ],
    capacityCheck: {
      status: 'balanced' as const,
      totalMaterialMinutes: 60,
      totalCapacityMinutes: 120,
      suggestedWeeks: null,
    },
    warnings: [{ kind: 'unresolved-tie-count', detail: { count: 1 } }],
  }
}

describe('Step3Preview', () => {
  let testDb: Dexie
  let logEventMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    testDb = await createTestEventStore()
    await testDb.table('onboardingDraft').clear()

    logEventMock = vi.fn().mockResolvedValue(undefined)

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
    mockUseSync.mockReturnValue({ logEvent: logEventMock })
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

  it('renders schedule with session title and duration', async () => {
    await seedOnboardingState(testDb)
    const { generateRoadmap } = await import('@study-tracker/progress-engine')
    vi.mocked(generateRoadmap).mockReturnValue(mockBalancedRoadmap())

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Designing Data-Intensive Applications')).toBeInTheDocument()
      expect(screen.getByText('2h 0m')).toBeInTheDocument()
    })
  })

  it('displays rest day rows for slots with no candidate materials', async () => {
    await seedOnboardingState(testDb)
    const { generateRoadmap } = await import('@study-tracker/progress-engine')
    vi.mocked(generateRoadmap).mockReturnValue(mockBalancedRoadmap())

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Rest day')).toBeInTheDocument()
    })
  })

  it('shows tie resolver chip picker for multi-candidate slots', async () => {
    await seedOnboardingState(testDb, {
      materials: [
        { id: 'mat-1', title: 'DDIA', estimatedDuration: 60, role: 'anchor', additionOrder: 0, userOverrodeType: false },
        { id: 'mat-2', title: 'Clean Code', estimatedDuration: 60, role: 'foundation', additionOrder: 1, userOverrodeType: false },
      ],
    })
    const { generateRoadmap } = await import('@study-tracker/progress-engine')
    vi.mocked(generateRoadmap).mockReturnValue(mockTieRoadmap())

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Pick one')).toBeInTheDocument()
      expect(screen.getByText('Review DDIA')).toBeInTheDocument()
      expect(screen.getByText('Review Clean Code')).toBeInTheDocument()
    })
  })

  it('pencil icon is present next to session titles for inline rename', async () => {
    await seedOnboardingState(testDb)
    const { generateRoadmap } = await import('@study-tracker/progress-engine')
    vi.mocked(generateRoadmap).mockReturnValue(mockBalancedRoadmap())

    renderPreview()

    await waitFor(() => {
      const titleSpan = screen.getByText('Designing Data-Intensive Applications')
      const pencilIcon = titleSpan.querySelector('svg')
      expect(pencilIcon).not.toBeNull()
      expect(pencilIcon?.classList.contains('icon')).toBe(true)
    })
  })

  it('commit button is disabled when unresolved ties exist', async () => {
    await seedOnboardingState(testDb, {
      materials: [
        { id: 'mat-1', title: 'DDIA', estimatedDuration: 60, role: 'anchor', additionOrder: 0, userOverrodeType: false },
        { id: 'mat-2', title: 'Clean Code', estimatedDuration: 60, role: 'foundation', additionOrder: 1, userOverrodeType: false },
      ],
    })
    const { generateRoadmap } = await import('@study-tracker/progress-engine')
    vi.mocked(generateRoadmap).mockReturnValue(mockTieRoadmap())

    renderPreview()

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Looks good/ })
      expect(button).toBeDisabled()
    })
  })

  it('commit button is enabled when no unresolved ties', async () => {
    await seedOnboardingState(testDb)
    const { generateRoadmap } = await import('@study-tracker/progress-engine')
    vi.mocked(generateRoadmap).mockReturnValue(mockBalancedRoadmap())

    renderPreview()

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /Looks good/ })
      expect(button).toBeEnabled()
    })
  })
})