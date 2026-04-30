import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Step2Hours } from './Step2Hours'
import { OnboardingProvider } from '../OnboardingProvider'
import { useEventStore } from '../../events/useEventStore'
import { useEventStoreContext } from '../../events/EventStoreProvider'
import type { EventStore } from '../../events/EventStore'
import Dexie from 'dexie'

vi.mock('../../events/useEventStore')
vi.mock('../../events/EventStoreProvider')
vi.mock('../CheckpointGate', () => ({
  CheckpointGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockUseEventStore = vi.mocked(useEventStore)
const mockUseEventStoreContext = vi.mocked(useEventStoreContext)

const TEST_DB_NAME = 'StudyTrackerTestStep2'

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

describe('Step2Hours', () => {
  let testDb: Dexie

  beforeEach(async () => {
    vi.clearAllMocks()
    testDb = await createTestEventStore()
    await testDb.table('onboardingDraft').clear()

    const mockEventStore = {
      getAll: vi.fn().mockResolvedValue([]),
      append: vi.fn(),
      table: (name: string) => testDb.table(name),
    } as unknown as EventStore

    mockUseEventStoreContext.mockReturnValue({
      eventStore: mockEventStore,
      ready: true,
    })
    mockUseEventStore.mockReturnValue(mockEventStore)
  })

  it('renders hours display and inputs', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/2']}>
        <OnboardingProvider>
          <Step2Hours />
        </OnboardingProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/h \/ wk/)).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Weekday hours')).toBeInTheDocument()
    expect(screen.getByLabelText('Weekend hours')).toBeInTheDocument()
  })

  it('chip click sets hours and auto-splits', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/2']}>
        <OnboardingProvider>
          <Step2Hours />
        </OnboardingProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/h \/ wk/)).toBeInTheDocument()
    })
    const chip = screen.getByText('6h')
    fireEvent.click(chip)
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('continue disabled when hours mismatch', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/2']}>
        <OnboardingProvider>
          <Step2Hours />
        </OnboardingProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/h \/ wk/)).toBeInTheDocument()
    })
    const weekdayInput = screen.getByLabelText('Weekday hours') as HTMLInputElement
    const weekendInput = screen.getByLabelText('Weekend hours') as HTMLInputElement
    fireEvent.change(weekdayInput, { target: { value: '5' } })
    fireEvent.change(weekendInput, { target: { value: '2' } })

    const continueBtn = screen.getByText('Continue')
    expect(continueBtn).toBeDisabled()
  })

  it('continue disabled without study days', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/2']}>
        <OnboardingProvider>
          <Step2Hours />
        </OnboardingProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/h \/ wk/)).toBeInTheDocument()
    })
    const chip = screen.getByText('4h')
    fireEvent.click(chip)

    const weekdayInput = screen.getByLabelText('Weekday hours') as HTMLInputElement
    const weekendInput = screen.getByLabelText('Weekend hours') as HTMLInputElement
    fireEvent.change(weekdayInput, { target: { value: '2' } })
    fireEvent.change(weekendInput, { target: { value: '2' } })

    const continueBtn = screen.getByText('Continue')
    expect(continueBtn).toBeDisabled()
  })

  it('dispatches SET_HOURS and navigates to step 3', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/2']}>
        <OnboardingProvider>
          <Routes>
            <Route path="/onboarding/2" element={<Step2Hours />} />
            <Route path="/onboarding/3" element={<div data-testid="step3">Step 3</div>} />
          </Routes>
        </OnboardingProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByText(/h \/ wk/)).toBeInTheDocument()
    })
    const chip = screen.getByText('4h')
    fireEvent.click(chip)

    const monChip = screen.getByText('Mon')
    fireEvent.click(monChip)

    const continueBtn = screen.getByText('Continue')
    fireEvent.click(continueBtn)

    await waitFor(() => {
      expect(screen.getByTestId('step3')).toBeInTheDocument()
    })
  })
})
