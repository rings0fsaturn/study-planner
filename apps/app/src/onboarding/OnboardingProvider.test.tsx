import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { OnboardingProvider, useOnboarding, type OnboardingState } from './OnboardingProvider'
import { useEventStore } from '../events/useEventStore'
import { useEventStoreContext } from '../events/EventStoreProvider'
import type { EventStore } from '../events/EventStore'
import Dexie from 'dexie'

vi.mock('../events/useEventStore')
vi.mock('../events/EventStoreProvider')

const mockUseEventStore = vi.mocked(useEventStore)
const mockUseEventStoreContext = vi.mocked(useEventStoreContext)

const TEST_DB_NAME = 'StudyTrackerTestOnboarding'

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

function TestComponent() {
  const { state, dispatch, ready } = useOnboarding()
  return (
    <div>
      <span data-testid="ready">{ready ? 'ready' : 'loading'}</span>
      <span data-testid="deadline">{state.deadline ?? 'none'}</span>
      <span data-testid="purpose">{state.purpose}</span>
      <span data-testid="stepReached">{state.stepReached}</span>
      <button data-testid="setDeadline" onClick={() => dispatch({ type: 'SET_DEADLINE', deadline: '2025-06-01', purpose: 'Test exam' })}>
        Set Deadline
      </button>
      <button data-testid="setHours" onClick={() => dispatch({ type: 'SET_HOURS', weeklyHours: 10, weekdayHours: 6, weekendHours: 4, selectedStudyDays: ['monday', 'wednesday', 'friday'] })}>
        Set Hours
      </button>
      <button data-testid="reset" onClick={() => dispatch({ type: 'RESET' })}>
        Reset
      </button>
    </div>
  )
}

describe('OnboardingProvider', () => {
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

  it('renders children and provides initial state', async () => {
    render(
      <OnboardingProvider>
        <TestComponent />
      </OnboardingProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('ready')
    })

    expect(screen.getByTestId('deadline')).toHaveTextContent('none')
    expect(screen.getByTestId('purpose')).toHaveTextContent('')
    expect(screen.getByTestId('stepReached')).toHaveTextContent('1')
  })

  it('dispatches SET_DEADLINE and updates state', async () => {
    render(
      <OnboardingProvider>
        <TestComponent />
      </OnboardingProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('ready')
    })

    fireEvent.click(screen.getByTestId('setDeadline'))

    expect(screen.getByTestId('deadline')).toHaveTextContent('2025-06-01')
    expect(screen.getByTestId('purpose')).toHaveTextContent('Test exam')
    expect(screen.getByTestId('stepReached')).toHaveTextContent('1')
  })

  it('dispatches SET_HOURS and updates state', async () => {
    render(
      <OnboardingProvider>
        <TestComponent />
      </OnboardingProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('ready')
    })

    fireEvent.click(screen.getByTestId('setHours'))

    expect(screen.getByTestId('stepReached')).toHaveTextContent('2')
  })

  it('RESET action clears state', async () => {
    render(
      <OnboardingProvider>
        <TestComponent />
      </OnboardingProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('ready')
    })

    fireEvent.click(screen.getByTestId('setDeadline'))
    expect(screen.getByTestId('deadline')).toHaveTextContent('2025-06-01')

    fireEvent.click(screen.getByTestId('reset'))
    expect(screen.getByTestId('deadline')).toHaveTextContent('none')
    expect(screen.getByTestId('purpose')).toHaveTextContent('')
  })

  it('persists draft state to Dexie', async () => {
    render(
      <OnboardingProvider>
        <TestComponent />
      </OnboardingProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('ready')
    })

    fireEvent.click(screen.getByTestId('setDeadline'))

    const savedDraft = await testDb.table('onboardingDraft').get(1) as { state: OnboardingState } | undefined
    expect(savedDraft?.state.deadline).toBe('2025-06-01')
    expect(savedDraft?.state.purpose).toBe('Test exam')
  })

  it('restores draft from Dexie on mount', async () => {
    await testDb.table('onboardingDraft').put({
      id: 1,
      state: {
        deadline: '2025-07-01',
        purpose: 'Restored exam',
        weeklyHours: 8,
        weekdayHours: 5,
        weekendHours: 3,
        selectedStudyDays: ['saturday', 'sunday'],
        materials: [],
        previewEdits: [],
        stepReached: 2,
      },
    })

    render(
      <OnboardingProvider>
        <TestComponent />
      </OnboardingProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('ready')
    })

    expect(screen.getByTestId('deadline')).toHaveTextContent('2025-07-01')
    expect(screen.getByTestId('purpose')).toHaveTextContent('Restored exam')
  })
})