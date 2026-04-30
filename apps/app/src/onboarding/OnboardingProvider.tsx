import { createContext, useContext, useReducer, useEffect, useRef, useState, type ReactNode } from 'react'
import { useEventStore } from '../events/useEventStore'
import type { DayOfWeek, MaterialRole } from '@study-tracker/progress-engine'

export interface OnboardingMaterial {
  id: string
  title: string
  estimatedDuration: number
  role: MaterialRole
  url?: string
  additionOrder: number
  userOverrodeType: boolean
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
  previewEdits: OnboardingSlotEdit[]
  stepReached: number
}

const INITIAL_STATE: OnboardingState = {
  deadline: null,
  purpose: '',
  weeklyHours: 0,
  weekdayHours: 0,
  weekendHours: 0,
  selectedStudyDays: [],
  materials: [],
  previewEdits: [],
  stepReached: 1,
}

type OnboardingAction =
  | { type: 'SET_DEADLINE'; deadline: string | null; purpose?: string }
  | { type: 'SET_HOURS'; weeklyHours: number; weekdayHours: number; weekendHours: number; selectedStudyDays: DayOfWeek[] }
  | { type: 'ADD_MATERIAL'; material: OnboardingMaterial }
  | { type: 'UPDATE_MATERIAL'; id: string; updates: Partial<OnboardingMaterial> }
  | { type: 'REMOVE_MATERIAL'; id: string }
  | { type: 'SET_PREVIEW_EDITS'; edits: OnboardingSlotEdit[] }
  | { type: 'SET_STEP_REACHED'; step: number }
  | { type: 'RESTORE'; state: OnboardingState }
  | { type: 'RESET' }

function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'SET_DEADLINE':
      return { ...state, deadline: action.deadline, purpose: action.purpose ?? state.purpose, stepReached: Math.max(state.stepReached, 1) }
    case 'SET_HOURS':
      return { ...state, weeklyHours: action.weeklyHours, weekdayHours: action.weekdayHours, weekendHours: action.weekendHours, selectedStudyDays: action.selectedStudyDays, stepReached: Math.max(state.stepReached, 2) }
    case 'ADD_MATERIAL':
      return { ...state, materials: [...state.materials, action.material], stepReached: Math.max(state.stepReached, 3) }
    case 'UPDATE_MATERIAL':
      return { ...state, materials: state.materials.map(m => m.id === action.id ? { ...m, ...action.updates } : m) }
    case 'REMOVE_MATERIAL':
      return { ...state, materials: state.materials.filter(m => m.id !== action.id) }
    case 'SET_PREVIEW_EDITS':
      return { ...state, previewEdits: action.edits }
    case 'SET_STEP_REACHED':
      return { ...state, stepReached: Math.max(state.stepReached, action.step) }
    case 'RESTORE':
      return { ...state, ...action.state }
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

  return (
    <OnboardingContext.Provider value={{ state, dispatch, ready }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext)
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider')
  return ctx
}