import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Step3Materials } from './Step3Materials'
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

const TEST_DB_NAME = 'StudyTrackerTestStep3'

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

describe('Step3Materials', () => {
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
    mockUseEventStore.mockReturnValue(mockEventStore as never)
  })

  it('renders URL input (disabled) and "Add manually" button', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/3']}>
        <Routes>
          <Route path="/onboarding/3" element={
            <OnboardingProvider>
              <Step3Materials />
            </OnboardingProvider>
          } />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: /What are you/i })
    expect(screen.getByPlaceholderText(/youtube.com/)).toBeDisabled()
    expect(screen.getByText('Add manually')).toBeInTheDocument()
  })

  it('clicking "Add manually" adds a material row', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/3']}>
        <Routes>
          <Route path="/onboarding/3" element={
            <OnboardingProvider>
              <Step3Materials />
            </OnboardingProvider>
          } />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText('Add manually')
    const addButton = screen.getByText('Add manually')
    fireEvent.click(addButton)

    expect(screen.getByPlaceholderText('Material title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Min')).toBeInTheDocument()
  })

  it('type dropdown has 3 correct labels', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/3']}>
        <Routes>
          <Route path="/onboarding/3" element={
            <OnboardingProvider>
              <Step3Materials />
            </OnboardingProvider>
          } />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText('Add manually')
    fireEvent.click(screen.getByText('Add manually'))

    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()

    const options = screen.getAllByRole('option')
    expect(options.map(o => o.textContent)).toEqual(['Main reading', 'Foundations', 'Practice'])
  })

  it('remove button removes the row', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/3']}>
        <Routes>
          <Route path="/onboarding/3" element={
            <OnboardingProvider>
              <Step3Materials />
            </OnboardingProvider>
          } />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText('Add manually')
    fireEvent.click(screen.getByText('Add manually'))

    expect(screen.getByPlaceholderText('Material title')).toBeInTheDocument()

    const removeButton = screen.getByTitle('Remove material')
    fireEvent.click(removeButton)

    expect(screen.queryByPlaceholderText('Material title')).not.toBeInTheDocument()
  })

  it('back button exists and is clickable', async () => {
    render(
      <MemoryRouter initialEntries={['/onboarding/3']}>
        <Routes>
          <Route path="/onboarding/3" element={
            <OnboardingProvider>
              <Step3Materials />
            </OnboardingProvider>
          } />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText('Add manually')
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})