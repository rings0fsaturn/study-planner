import { createContext, useContext, useReducer, useEffect, useRef, useState, useMemo, type ReactNode } from 'react'
import { useEventStore } from '../events/useEventStore'
import type { DayOfWeek, MaterialRole } from '@study-tracker/progress-engine'
import type { MaterialKind } from '../session/types'
export type FetchStatus = 'idle' | 'loading' | 'success' | 'partial' | 'error'

export interface OnboardingMaterial {
  id: string
  title: string
  estimatedDuration: number
  role: MaterialRole
  url?: string
  additionOrder: number
  userOverrodeType: boolean
  kind: MaterialKind
  fetchStatus: FetchStatus
  playlistId?: string
  youtubeVideoId?: string
}

export interface PlaylistVideo {
  youtubeVideoId: string
  title: string
  author: string
  durationMinutes: number
  selected: boolean
}

export interface PlaylistEntry {
  id: string
  title: string
  fetchStatus: 'loading' | 'success' | 'error'
  youtubePlaylistId: string
  videos: PlaylistVideo[]
  confirmed: boolean
  additionOrder: number
  role: MaterialRole
}

export interface OnboardingSlotEdit {
  weekIndex: number
  dayOfWeek: string
  materialId: string | null
  sessionTitle: string | null
  plannedMinutes: number
}

export interface OnboardingState {
  deadline: string | null
  purpose: string
  weeklyHours: number
  weekdayHours: number
  weekendHours: number
  selectedStudyDays: DayOfWeek[]
  materials: OnboardingMaterial[]
  playlists: PlaylistEntry[]
  previewEdits: OnboardingSlotEdit[]
  stepReached: number
  nextAdditionOrder: number
}

const INITIAL_STATE: OnboardingState = {
  deadline: null,
  purpose: '',
  weeklyHours: 0,
  weekdayHours: 0,
  weekendHours: 0,
  selectedStudyDays: [],
  materials: [],
  playlists: [],
  previewEdits: [],
  stepReached: 1,
  nextAdditionOrder: 0,
}

type OnboardingAction =
  | { type: 'SET_DEADLINE'; deadline: string | null; purpose?: string }
  | { type: 'SET_HOURS'; weeklyHours: number; weekdayHours: number; weekendHours: number; selectedStudyDays: DayOfWeek[] }
  | { type: 'ADD_MATERIAL'; material: Omit<OnboardingMaterial, 'additionOrder'> }
  | { type: 'UPDATE_MATERIAL'; id: string; updates: Partial<OnboardingMaterial> }
  | { type: 'REMOVE_MATERIAL'; id: string }
  | { type: 'FETCH_STARTED'; id: string }
  | { type: 'FETCH_SUCCEEDED'; id: string; updates: Partial<OnboardingMaterial> }
  | { type: 'FETCH_FAILED'; id: string }
  | { type: 'ADD_PLAYLIST'; playlist: Omit<PlaylistEntry, 'confirmed' | 'additionOrder' | 'role'> }
  | { type: 'REMOVE_PLAYLIST'; playlistId: string }
  | { type: 'PLAYLIST_FETCH_SUCCEEDED'; playlistId: string; title: string; videos: PlaylistVideo[] }
  | { type: 'PLAYLIST_FETCH_FAILED'; playlistId: string }
  | { type: 'PLAYLIST_CONFIRM'; playlistId: string; selectedVideoIds: string[] }
  | { type: 'PLAYLIST_SET_ROLE'; playlistId: string; role: MaterialRole }
  | { type: 'SET_PREVIEW_EDITS'; edits: OnboardingSlotEdit[] }
  | { type: 'SET_STEP_REACHED'; step: number }
  | { type: 'RESTORE'; state: OnboardingState }
  | { type: 'RESET' }

function recoverStuckLoading(restored: OnboardingState): OnboardingState {
  const playlists = (restored.playlists ?? []).map(p => ({
    ...p,
    fetchStatus: p.fetchStatus === 'loading' ? 'error' as const : p.fetchStatus,
    confirmed: p.confirmed ?? false,
    additionOrder: p.additionOrder ?? 0,
    role: p.role ?? 'foundation' as const,
  }))
  const materials = restored.materials.map(m =>
    m.fetchStatus === 'loading' ? { ...m, fetchStatus: 'error' as const } : m
  )
  const maxOrder = Math.max(
    ...materials.map(m => m.additionOrder),
    ...playlists.map(p => p.additionOrder),
    -1,
  )
  return {
    ...restored,
    materials,
    playlists,
    nextAdditionOrder: restored.nextAdditionOrder ?? maxOrder + 1,
  }
}

export function expandPlaylistsToMaterials(playlists: PlaylistEntry[]): OnboardingMaterial[] {
  return playlists
    .filter(p => p.confirmed)
    .flatMap(p => {
      const selectedVideos = p.videos.filter(v => v.selected)
      return selectedVideos.map((v, i) => ({
        id: `${p.id}_${v.youtubeVideoId}`,
        title: v.title,
        estimatedDuration: v.durationMinutes,
        role: p.role,
        url: `https://youtube.com/watch?v=${v.youtubeVideoId}`,
        additionOrder: p.additionOrder + (i + 1) * 0.001,
        userOverrodeType: false,
        kind: 'youtube' as const,
        fetchStatus: 'success' as const,
        playlistId: p.id,
        youtubeVideoId: v.youtubeVideoId,
      }))
    })
}

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_DEADLINE':
      return { ...state, deadline: action.deadline, purpose: action.purpose ?? state.purpose, stepReached: Math.max(state.stepReached, 1) }
    case 'SET_HOURS':
      return { ...state, weeklyHours: action.weeklyHours, weekdayHours: action.weekdayHours, weekendHours: action.weekendHours, selectedStudyDays: action.selectedStudyDays, stepReached: Math.max(state.stepReached, 2) }
    case 'ADD_MATERIAL':
      return { ...state, materials: [...state.materials, { ...action.material, additionOrder: state.nextAdditionOrder }], nextAdditionOrder: state.nextAdditionOrder + 1, stepReached: Math.max(state.stepReached, 3) }
    case 'UPDATE_MATERIAL':
      return { ...state, materials: state.materials.map(m => m.id === action.id ? { ...m, ...action.updates } : m) }
    case 'REMOVE_MATERIAL':
      return { ...state, materials: state.materials.filter(m => m.id !== action.id) }
    case 'FETCH_STARTED':
      return { ...state, materials: state.materials.map(m => m.id === action.id ? { ...m, fetchStatus: 'loading' } : m) }
    case 'FETCH_SUCCEEDED': {
      const hasTitle = !!(action.updates.title)
      const hasDuration = !!(action.updates.estimatedDuration && action.updates.estimatedDuration > 0)
      const fetchStatus = (hasTitle && hasDuration) ? 'success' as const : 'partial' as const
      return { ...state, materials: state.materials.map(m => m.id === action.id ? { ...m, ...action.updates, fetchStatus } : m) }
    }
    case 'FETCH_FAILED':
      return { ...state, materials: state.materials.map(m => m.id === action.id ? { ...m, fetchStatus: 'error' } : m) }
    case 'ADD_PLAYLIST':
      return {
        ...state,
        playlists: [...state.playlists, { ...action.playlist, confirmed: false, additionOrder: state.nextAdditionOrder, role: 'foundation' as const }],
        nextAdditionOrder: state.nextAdditionOrder + 1,
        stepReached: Math.max(state.stepReached, 3),
      }
    case 'REMOVE_PLAYLIST':
      return { ...state, playlists: state.playlists.filter(p => p.id !== action.playlistId) }
    case 'PLAYLIST_FETCH_SUCCEEDED':
      return { ...state, playlists: state.playlists.map(p => p.id === action.playlistId ? { ...p, title: action.title, fetchStatus: 'success', videos: action.videos } : p) }
    case 'PLAYLIST_FETCH_FAILED':
      return { ...state, playlists: state.playlists.map(p => p.id === action.playlistId ? { ...p, fetchStatus: 'error' } : p) }
    case 'PLAYLIST_CONFIRM': {
      const playlist = state.playlists.find(p => p.id === action.playlistId)
      if (!playlist) return state
      return {
        ...state,
        playlists: state.playlists.map(p =>
          p.id === action.playlistId
            ? {
                ...p,
                confirmed: true,
                videos: p.videos.map(v => ({
                  ...v,
                  selected: action.selectedVideoIds.includes(v.youtubeVideoId),
                })),
              }
            : p
        ),
      }
    }
    case 'PLAYLIST_SET_ROLE':
      return { ...state, playlists: state.playlists.map(p => p.id === action.playlistId ? { ...p, role: action.role } : p) }
    case 'SET_PREVIEW_EDITS':
      return { ...state, previewEdits: action.edits }
    case 'SET_STEP_REACHED':
      return { ...state, stepReached: Math.max(state.stepReached, action.step) }
    case 'RESTORE':
      return recoverStuckLoading({ ...state, ...action.state, playlists: action.state.playlists ?? [] })
    case 'RESET':
      return INITIAL_STATE
    default:
      return state
  }
}

interface OnboardingContextValue {
  state: OnboardingState
  dispatch: React.Dispatch<OnboardingAction>
  ready: boolean
  expandedMaterials: OnboardingMaterial[]
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const eventStore = useEventStore()
  const [state, dispatch] = useReducer(onboardingReducer, INITIAL_STATE)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const table = eventStore.table('onboardingDraft')
    table.get(1).then((row: { state: OnboardingState } | undefined) => {
      if (row?.state) {
        dispatch({ type: 'RESTORE', state: row.state })
      }
      setReady(true)
    }).catch(() => {
      setReady(true)
    })
  }, [eventStore])

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const table = eventStore.table('onboardingDraft')
    table.put({ id: 1, state }).catch(() => {})
  }, [state, eventStore])

  const expandedMaterials = useMemo(
    () => [...state.materials, ...expandPlaylistsToMaterials(state.playlists)],
    [state.materials, state.playlists],
  )

  return (
    <OnboardingContext.Provider value={{ state, dispatch, ready, expandedMaterials }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider')
  return ctx
}