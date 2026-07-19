import { useReducer, useEffect, useCallback, useRef } from 'react'

export interface SlotKey {
  weekIndex: number
  dayOfWeek: string
}

function slotKeyEq(a: SlotKey | null, b: SlotKey | null): boolean {
  if (!a || !b) return false
  return a.weekIndex === b.weekIndex && a.dayOfWeek === b.dayOfWeek
}

export type SwapMode =
  | 'idle'
  | 'awaiting-source'
  | 'source-selected'
  | 'both-selected'
  | 'post-swap'
  | 'dragging'

export interface SwapState {
  mode: SwapMode
  source: SlotKey | null
  destination: SlotKey | null
  justSwapped: { source: SlotKey; dest: SlotKey } | null
  rejectedSlot: SlotKey | null
  origin: 'fab' | 'drag' | null
}

const INITIAL_STATE: SwapState = {
  mode: 'idle',
  source: null,
  destination: null,
  justSwapped: null,
  rejectedSlot: null,
  origin: null,
}

type SwapAction =
  | { type: 'ENTER_SWAP_MODE' }
  | { type: 'EXIT_SWAP_MODE' }
  | { type: 'TAP_SLOT'; key: SlotKey; swappable: boolean }
  | { type: 'PROCEED' }
  | { type: 'SWAP_COMPLETE'; source: SlotKey; dest: SlotKey }
  | { type: 'POST_SWAP_DONE' }
  | { type: 'CLEAR_REJECTED' }
  | { type: 'START_DRAG'; key: SlotKey }
  | { type: 'DROP'; target: SlotKey; swappable: boolean }
  | { type: 'CANCEL_DRAG' }

function swapReducer(state: SwapState, action: SwapAction): SwapState {
  switch (action.type) {
    case 'ENTER_SWAP_MODE':
      return { ...INITIAL_STATE, mode: 'awaiting-source', origin: 'fab' }

    case 'EXIT_SWAP_MODE':
      return INITIAL_STATE

    case 'TAP_SLOT': {
      if (state.mode === 'idle') return state

      if (!action.swappable) {
        return { ...state, rejectedSlot: action.key }
      }

      if (state.mode === 'awaiting-source') {
        return { ...state, source: action.key, destination: null, mode: 'source-selected', rejectedSlot: null }
      }

      if (state.mode === 'source-selected') {
        if (slotKeyEq(state.source, action.key)) {
          return { ...state, source: null, mode: 'awaiting-source', rejectedSlot: null }
        }
        return { ...state, destination: action.key, mode: 'both-selected', rejectedSlot: null }
      }

      if (state.mode === 'both-selected') {
        if (slotKeyEq(state.source, action.key)) {
          return { ...state, source: null, destination: null, mode: 'awaiting-source', rejectedSlot: null }
        }
        if (slotKeyEq(state.destination, action.key)) {
          return { ...state, destination: null, mode: 'source-selected', rejectedSlot: null }
        }
        return { ...state, destination: action.key, rejectedSlot: null }
      }

      return state
    }

    case 'PROCEED':
      if (state.mode !== 'both-selected' || !state.source || !state.destination) return state
      return state

    case 'SWAP_COMPLETE':
      return {
        mode: 'post-swap',
        source: null,
        destination: null,
        justSwapped: { source: action.source, dest: action.dest },
        rejectedSlot: null,
        origin: state.origin,
      }

    case 'POST_SWAP_DONE':
      if (state.origin === 'drag') return INITIAL_STATE
      return { ...INITIAL_STATE, mode: 'awaiting-source', origin: 'fab' }

    case 'CLEAR_REJECTED':
      return { ...state, rejectedSlot: null }

    case 'START_DRAG':
      return { ...INITIAL_STATE, mode: 'dragging', source: action.key, origin: 'drag' }

    case 'DROP': {
      if (state.mode !== 'dragging' || !state.source) return INITIAL_STATE
      if (!action.swappable) {
        return { ...state, rejectedSlot: action.target, mode: 'idle', source: null }
      }
      if (slotKeyEq(state.source, action.target)) return INITIAL_STATE
      return state
    }

    case 'CANCEL_DRAG':
      return INITIAL_STATE

    default:
      return state
  }
}

interface UseSwapStateMachineOpts {
  isSlotSwappable: (key: SlotKey) => boolean
  onExecuteSwap: (source: SlotKey, dest: SlotKey) => void
}

export function useSwapStateMachine({ isSlotSwappable, onExecuteSwap }: UseSwapStateMachineOpts) {
  const [state, dispatch] = useReducer(swapReducer, INITIAL_STATE)
  const onExecuteSwapRef = useRef(onExecuteSwap)
  onExecuteSwapRef.current = onExecuteSwap

  useEffect(() => {
    if (state.mode === 'post-swap') {
      const timer = setTimeout(() => dispatch({ type: 'POST_SWAP_DONE' }), 1500)
      return () => clearTimeout(timer)
    }
  }, [state.mode])

  useEffect(() => {
    if (state.rejectedSlot) {
      const timer = setTimeout(() => dispatch({ type: 'CLEAR_REJECTED' }), 300)
      return () => clearTimeout(timer)
    }
  }, [state.rejectedSlot])

  useEffect(() => {
    if (state.mode === 'idle') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'EXIT_SWAP_MODE' })
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [state.mode])

  const enterSwapMode = useCallback(() => {
    dispatch({ type: 'ENTER_SWAP_MODE' })
  }, [])

  const exitSwapMode = useCallback(() => {
    dispatch({ type: 'EXIT_SWAP_MODE' })
  }, [])

  const tapSlot = useCallback((key: SlotKey) => {
    dispatch({ type: 'TAP_SLOT', key, swappable: isSlotSwappable(key) })
  }, [isSlotSwappable])

  const proceed = useCallback(() => {
    if (state.mode === 'both-selected' && state.source && state.destination) {
      const src = state.source
      const dest = state.destination
      onExecuteSwapRef.current(src, dest)
      dispatch({ type: 'SWAP_COMPLETE', source: src, dest })
    }
  }, [state.mode, state.source, state.destination])

  const startDrag = useCallback((key: SlotKey) => {
    if (!isSlotSwappable(key)) return
    dispatch({ type: 'START_DRAG', key })
  }, [isSlotSwappable])

  const drop = useCallback((target: SlotKey) => {
    if (state.mode === 'dragging' && state.source && !slotKeyEq(state.source, target)) {
      const swappable = isSlotSwappable(target)
      dispatch({ type: 'DROP', target, swappable })
      if (swappable) {
        onExecuteSwapRef.current(state.source, target)
        dispatch({ type: 'SWAP_COMPLETE', source: state.source, dest: target })
      }
    } else {
      dispatch({ type: 'CANCEL_DRAG' })
    }
  }, [state.mode, state.source, isSlotSwappable])

  const cancelDrag = useCallback(() => {
    dispatch({ type: 'CANCEL_DRAG' })
  }, [])

  return {
    state,
    enterSwapMode,
    exitSwapMode,
    tapSlot,
    proceed,
    startDrag,
    drop,
    cancelDrag,
  }
}
