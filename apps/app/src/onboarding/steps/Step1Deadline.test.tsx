import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Step1Deadline } from './Step1Deadline'
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

const TEST_DB_NAME = 'StudyTrackerTestStep1'

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

describe('Step1Deadline', () => {
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

  it('renders date input and chips', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/1']}>
        <OnboardingProvider>
          <Step1Deadline />
        </OnboardingProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByLabelText('Target date')).toBeInTheDocument()
    })
    expect(screen.getByText('In 2 weeks')).toBeInTheDocument()
    expect(screen.getByText('In 1 month')).toBeInTheDocument()
  })

  it('chip click auto-fills date', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/1']}>
        <OnboardingProvider>
          <Step1Deadline />
        </OnboardingProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByLabelText('Target date')).toBeInTheDocument()
    })
    const chip = screen.getByText('In 2 weeks')
    fireEvent.click(chip)
    const dateInput = screen.getByLabelText('Target date') as HTMLInputElement
    expect(dateInput.value).toBeTruthy()
  })

  it('continue button disabled without date', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/1']}>
        <OnboardingProvider>
          <Step1Deadline />
        </OnboardingProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByLabelText('Target date')).toBeInTheDocument()
    })
    const continueBtn = screen.getByText('Continue')
    expect(continueBtn).toBeDisabled()
  })

  it('dispatches SET_DEADLINE and navigates to step 2', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/1']}>
        <OnboardingProvider>
          <Routes>
            <Route path="/onboarding/1" element={<Step1Deadline />} />
            <Route path="/onboarding/2" element={<div data-testid="step2">Step 2</div>} />
          </Routes>
        </OnboardingProvider>
      </MemoryRouter>
    )
    await waitFor(() => {
      expect(screen.getByLabelText('Target date')).toBeInTheDocument()
    })
    const dateInput = screen.getByLabelText('Target date') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-06-15' } })

    const continueBtn = screen.getByText('Continue')
    fireEvent.click(continueBtn)

    await waitFor(() => {
      expect(screen.getByTestId('step2')).toBeInTheDocument()
    })
  })
})
