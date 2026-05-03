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
      <button data-testid="setHours" onClick={() => dispatch({ type: 'SET_HOURS', weeklyHours: 10, weekdayHours: 6, weekendHours: 4, selectedStudyDays: ['Mon', 'Wed', 'Fri'] })}>
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
        playlists: [],
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

function ReducerTestComponent() {
  const { state, dispatch, ready, expandedMaterials } = useOnboarding()
  return (
    <div>
      <span data-testid="ready">{ready ? 'ready' : 'loading'}</span>
      <span data-testid="materials">{JSON.stringify(state.materials)}</span>
      <span data-testid="playlists">{JSON.stringify(state.playlists)}</span>
      <span data-testid="materialCount">{state.materials.length}</span>
      <span data-testid="playlistCount">{state.playlists.length}</span>
      <span data-testid="expandedMaterials">{JSON.stringify(expandedMaterials)}</span>
      <button data-testid="addMaterial" onClick={() => dispatch({
        type: 'ADD_MATERIAL',
        material: { id: 'mat-1', title: '', estimatedDuration: 0, role: 'foundation', userOverrodeType: false, kind: 'youtube', fetchStatus: 'idle' },
      })}>Add</button>
      <button data-testid="fetchStarted" onClick={() => dispatch({ type: 'FETCH_STARTED', id: 'mat-1' })}>FetchStart</button>
      <button data-testid="fetchSucceeded" onClick={() => dispatch({
        type: 'FETCH_SUCCEEDED', id: 'mat-1', updates: { title: 'Video Title', estimatedDuration: 90 },
      })}>FetchOK</button>
      <button data-testid="fetchPartial" onClick={() => dispatch({
        type: 'FETCH_SUCCEEDED', id: 'mat-1', updates: { title: 'Article Title' },
      })}>FetchPartial</button>
      <button data-testid="fetchFailed" onClick={() => dispatch({ type: 'FETCH_FAILED', id: 'mat-1' })}>FetchFail</button>
      <button data-testid="addPlaylist" onClick={() => dispatch({
        type: 'ADD_PLAYLIST',
        playlist: { id: 'pl-1', title: '', fetchStatus: 'loading', youtubePlaylistId: 'PLxyz', videos: [] },
      })}>AddPlaylist</button>
      <button data-testid="playlistFetchOk" onClick={() => dispatch({
        type: 'PLAYLIST_FETCH_SUCCEEDED', playlistId: 'pl-1', title: 'My Playlist',
        videos: [
          { youtubeVideoId: 'v1', title: 'Video 1', author: 'Author', durationMinutes: 30, selected: true },
          { youtubeVideoId: 'v2', title: 'Video 2', author: 'Author', durationMinutes: 45, selected: true },
          { youtubeVideoId: 'v3', title: 'Video 3', author: 'Author', durationMinutes: 20, selected: true },
        ],
      })}>PlaylistFetchOK</button>
      <button data-testid="playlistFetchFail" onClick={() => dispatch({ type: 'PLAYLIST_FETCH_FAILED', playlistId: 'pl-1' })}>PlaylistFetchFail</button>
      <button data-testid="playlistConfirm" onClick={() => dispatch({
        type: 'PLAYLIST_CONFIRM', playlistId: 'pl-1', selectedVideoIds: ['v1', 'v3'],
      })}>PlaylistConfirm</button>
      <button data-testid="removePlaylist" onClick={() => dispatch({ type: 'REMOVE_PLAYLIST', playlistId: 'pl-1' })}>RemovePlaylist</button>
      <button data-testid="playlistSetRole" onClick={() => dispatch({ type: 'PLAYLIST_SET_ROLE', playlistId: 'pl-1', role: 'anchor' })}>SetRoleAnchor</button>
    </div>
  )
}

describe('OnboardingProvider — fetch and playlist actions', () => {
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

    mockUseEventStoreContext.mockReturnValue({ eventStore: mockEventStore, ready: true })
    mockUseEventStore.mockReturnValue(mockEventStore)
  })

  async function renderAndWait() {
    render(<OnboardingProvider><ReducerTestComponent /></OnboardingProvider>)
    await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('ready'))
  }

  it('FETCH_STARTED sets fetchStatus to loading', async () => {
    await renderAndWait()
    fireEvent.click(screen.getByTestId('addMaterial'))
    fireEvent.click(screen.getByTestId('fetchStarted'))

    const materials = JSON.parse(screen.getByTestId('materials').textContent!)
    expect(materials[0].fetchStatus).toBe('loading')
  })

  it('FETCH_SUCCEEDED with full data sets fetchStatus to success', async () => {
    await renderAndWait()
    fireEvent.click(screen.getByTestId('addMaterial'))
    fireEvent.click(screen.getByTestId('fetchSucceeded'))

    const materials = JSON.parse(screen.getByTestId('materials').textContent!)
    expect(materials[0].fetchStatus).toBe('success')
    expect(materials[0].title).toBe('Video Title')
    expect(materials[0].estimatedDuration).toBe(90)
  })

  it('FETCH_SUCCEEDED with partial data sets fetchStatus to partial', async () => {
    await renderAndWait()
    fireEvent.click(screen.getByTestId('addMaterial'))
    fireEvent.click(screen.getByTestId('fetchPartial'))

    const materials = JSON.parse(screen.getByTestId('materials').textContent!)
    expect(materials[0].fetchStatus).toBe('partial')
    expect(materials[0].title).toBe('Article Title')
  })

  it('FETCH_FAILED sets fetchStatus to error', async () => {
    await renderAndWait()
    fireEvent.click(screen.getByTestId('addMaterial'))
    fireEvent.click(screen.getByTestId('fetchFailed'))

    const materials = JSON.parse(screen.getByTestId('materials').textContent!)
    expect(materials[0].fetchStatus).toBe('error')
  })

  it('ADD_PLAYLIST adds to playlists array', async () => {
    await renderAndWait()
    fireEvent.click(screen.getByTestId('addPlaylist'))

    expect(screen.getByTestId('playlistCount')).toHaveTextContent('1')
    const playlists = JSON.parse(screen.getByTestId('playlists').textContent!)
    expect(playlists[0].fetchStatus).toBe('loading')
    expect(playlists[0].youtubePlaylistId).toBe('PLxyz')
  })

  it('PLAYLIST_FETCH_SUCCEEDED populates videos and sets success', async () => {
    await renderAndWait()
    fireEvent.click(screen.getByTestId('addPlaylist'))
    fireEvent.click(screen.getByTestId('playlistFetchOk'))

    const playlists = JSON.parse(screen.getByTestId('playlists').textContent!)
    expect(playlists[0].fetchStatus).toBe('success')
    expect(playlists[0].title).toBe('My Playlist')
    expect(playlists[0].videos).toHaveLength(3)
  })

  it('PLAYLIST_FETCH_FAILED sets error status', async () => {
    await renderAndWait()
    fireEvent.click(screen.getByTestId('addPlaylist'))
    fireEvent.click(screen.getByTestId('playlistFetchFail'))

    const playlists = JSON.parse(screen.getByTestId('playlists').textContent!)
    expect(playlists[0].fetchStatus).toBe('error')
  })

  it('PLAYLIST_CONFIRM marks playlist as confirmed and updates video selection', async () => {
    await renderAndWait()
    fireEvent.click(screen.getByTestId('addPlaylist'))
    fireEvent.click(screen.getByTestId('playlistFetchOk'))
    fireEvent.click(screen.getByTestId('playlistConfirm'))

    expect(screen.getByTestId('playlistCount')).toHaveTextContent('1')
    expect(screen.getByTestId('materialCount')).toHaveTextContent('0')

    const playlists = JSON.parse(screen.getByTestId('playlists').textContent!)
    expect(playlists[0].confirmed).toBe(true)
    expect(playlists[0].videos.filter((v: { selected: boolean }) => v.selected).map((v: { youtubeVideoId: string }) => v.youtubeVideoId)).toEqual(['v1', 'v3'])

    const expanded = JSON.parse(screen.getByTestId('expandedMaterials').textContent!)
    expect(expanded).toHaveLength(2)
    expect(expanded[0].title).toBe('Video 1')
    expect(expanded[0].kind).toBe('youtube')
    expect(expanded[0].fetchStatus).toBe('success')
    expect(expanded[0].playlistId).toBe('pl-1')
    expect(expanded[0].youtubeVideoId).toBe('v1')
    expect(expanded[1].title).toBe('Video 3')
    expect(expanded[1].youtubeVideoId).toBe('v3')
  })

  it('PLAYLIST_SET_ROLE updates role on the target playlist only', async () => {
    await renderAndWait()
    fireEvent.click(screen.getByTestId('addPlaylist'))
    fireEvent.click(screen.getByTestId('playlistFetchOk'))
    fireEvent.click(screen.getByTestId('playlistConfirm'))

    const beforePlaylists = JSON.parse(screen.getByTestId('playlists').textContent!)
    expect(beforePlaylists[0].role).toBe('foundation')

    fireEvent.click(screen.getByTestId('playlistSetRole'))

    const afterPlaylists = JSON.parse(screen.getByTestId('playlists').textContent!)
    expect(afterPlaylists[0].role).toBe('anchor')
    expect(afterPlaylists[0].confirmed).toBe(true)

    const expanded = JSON.parse(screen.getByTestId('expandedMaterials').textContent!)
    expect(expanded[0].role).toBe('anchor')
    expect(expanded[1].role).toBe('anchor')
  })

  it('REMOVE_PLAYLIST removes playlist from array', async () => {
    await renderAndWait()
    fireEvent.click(screen.getByTestId('addPlaylist'))
    expect(screen.getByTestId('playlistCount')).toHaveTextContent('1')
    fireEvent.click(screen.getByTestId('removePlaylist'))
    expect(screen.getByTestId('playlistCount')).toHaveTextContent('0')
  })

  it('RESTORE resets stuck loading materials to error', async () => {
    await testDb.table('onboardingDraft').put({
      id: 1,
      state: {
        deadline: null,
        purpose: '',
        weeklyHours: 0,
        weekdayHours: 0,
        weekendHours: 0,
        selectedStudyDays: [],
        materials: [
          { id: 'stuck-1', title: '', estimatedDuration: 0, role: 'foundation', additionOrder: 0, userOverrodeType: false, kind: 'youtube', fetchStatus: 'loading' },
        ],
        playlists: [
          { id: 'pl-stuck', title: '', fetchStatus: 'loading', youtubePlaylistId: 'PLabc', videos: [] },
        ],
        previewEdits: [],
        stepReached: 3,
      },
    })

    await renderAndWait()

    const materials = JSON.parse(screen.getByTestId('materials').textContent!)
    expect(materials[0].fetchStatus).toBe('error')
    const playlists = JSON.parse(screen.getByTestId('playlists').textContent!)
    expect(playlists[0].fetchStatus).toBe('error')
  })
})