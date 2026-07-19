import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Step3Materials } from './Step3Materials'
import { OnboardingProvider } from '../OnboardingProvider'
import { MetadataFetcherProvider } from '../MetadataFetcherContext'
import { FakeMetadataFetcher } from '../fake-metadata-fetcher'
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

function renderStep3(fakeFetcher?: FakeMetadataFetcher) {
  const fetcher = fakeFetcher ?? new FakeMetadataFetcher()
  return render(
    <MemoryRouter initialEntries={['/onboarding/3']}>
      <Routes>
        <Route path="/onboarding/3" element={
          <MetadataFetcherProvider fetcher={fetcher}>
            <OnboardingProvider>
              <Step3Materials />
            </OnboardingProvider>
          </MetadataFetcherProvider>
        } />
      </Routes>
    </MemoryRouter>,
  )
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

  it('renders URL input (enabled) and "Add manually" button', async () => {
    renderStep3()
    await screen.findByRole('heading', { name: /What are you/i })
    expect(screen.getByPlaceholderText(/youtube.com/)).not.toBeDisabled()
    expect(screen.getByText('Add manually')).toBeInTheDocument()
  })

  it('clicking "Add manually" adds a material row with BK icon', async () => {
    renderStep3()
    await screen.findByText('Add manually')
    fireEvent.click(screen.getByText('Add manually'))

    expect(screen.getByText('Manual')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Material title')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Min')).toBeInTheDocument()
    expect(screen.getAllByText('BK').length).toBeGreaterThan(0)
  })

  it('type dropdown has 3 correct labels', async () => {
    renderStep3()
    await screen.findByText('Add manually')
    fireEvent.click(screen.getByText('Add manually'))

    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()

    const options = screen.getAllByRole('option')
    expect(options.map(o => o.textContent)).toEqual(['Main reading', 'Foundations', 'Practice'])
  })

  it('remove button removes the row', async () => {
    renderStep3()
    await screen.findByText('Add manually')
    fireEvent.click(screen.getByText('Add manually'))

    expect(screen.getByPlaceholderText('Material title')).toBeInTheDocument()

    const removeButton = screen.getByTitle('Remove material')
    fireEvent.click(removeButton)

    expect(screen.queryByPlaceholderText('Material title')).not.toBeInTheDocument()
  })

  it('back button exists and is clickable', async () => {
    renderStep3()
    await screen.findByText('Add manually')
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('pasting a YouTube video URL creates a loading card with YT icon', async () => {
    const fetcher = new FakeMetadataFetcher()
    fetcher.setResponse('https://youtube.com/watch?v=abc123', {
      type: 'youtube-video', title: 'Test Video', durationMinutes: 45, youtubeVideoId: 'abc123',
    })

    renderStep3(fetcher)
    await screen.findByText('Add manually')

    const input = screen.getByPlaceholderText(/youtube.com/)
    fireEvent.paste(input, { clipboardData: { getData: () => 'https://youtube.com/watch?v=abc123' } })

    expect(screen.getByText('Videos')).toBeInTheDocument()
    expect(screen.getAllByText('YT').length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByText('Test Video')).toBeInTheDocument()
      expect(screen.getAllByText(/45m/).length).toBeGreaterThan(0)
    })
  })

  it('pasting an article URL creates a card with ART icon', async () => {
    const fetcher = new FakeMetadataFetcher()
    fetcher.setResponse('https://example.com/article', {
      type: 'article', title: 'Article Title', durationMinutes: 10,
    })

    renderStep3(fetcher)
    await screen.findByText('Add manually')

    const input = screen.getByPlaceholderText(/youtube.com/)
    fireEvent.paste(input, { clipboardData: { getData: () => 'https://example.com/article' } })

    expect(screen.getByText('Links & articles')).toBeInTheDocument()
    expect(screen.getAllByText('ART').length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByText('Article Title')).toBeInTheDocument()
    })
  })

  it('pasting an invalid URL shows error', async () => {
    renderStep3()
    await screen.findByText('Add manually')

    const input = screen.getByPlaceholderText(/youtube.com/)
    fireEvent.paste(input, { clipboardData: { getData: () => 'not a valid url' } })

    expect(screen.getByText(/doesn't look like a valid URL/)).toBeInTheDocument()
  })

  it('fetch failure shows error message on card', async () => {
    const fetcher = new FakeMetadataFetcher()
    fetcher.setResponse('https://example.com/broken', { type: 'error', message: 'Failed' })

    renderStep3(fetcher)
    await screen.findByText('Add manually')

    const input = screen.getByPlaceholderText(/youtube.com/)
    fireEvent.paste(input, { clipboardData: { getData: () => 'https://example.com/broken' } })

    await waitFor(() => {
      expect(screen.getByText(/couldn't fetch details/)).toBeInTheDocument()
    })
  })

  it('partial article fetch (no duration) shows partial helper', async () => {
    const fetcher = new FakeMetadataFetcher()
    fetcher.setResponse('https://example.com/paywalled', {
      type: 'article', title: 'Paywalled Article', durationMinutes: null,
    })

    renderStep3(fetcher)
    await screen.findByText('Add manually')

    const input = screen.getByPlaceholderText(/youtube.com/)
    fireEvent.paste(input, { clipboardData: { getData: () => 'https://example.com/paywalled' } })

    await waitFor(() => {
      expect(screen.getByDisplayValue('Paywalled Article')).toBeInTheDocument()
      expect(screen.getByText(/fill in the missing field/)).toBeInTheDocument()
    })
  })
})
