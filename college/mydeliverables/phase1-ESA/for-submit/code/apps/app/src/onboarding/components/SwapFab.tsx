import { AnimatePresence, motion } from 'framer-motion'
import type { SwapState } from './useSwapStateMachine'

interface SwapFabProps {
  swapState: SwapState
  onEnterSwapMode: () => void
  onExitSwapMode: () => void
  onProceed: () => void
}

function SwapIcon() {
  return (
    <svg className="swap-fab-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5h12M10 2l3 3-3 3" />
      <path d="M14 11H2M6 8l-3 3 3 3" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="swap-fab-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="swap-fab-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 8 7 12 13 4" />
    </svg>
  )
}

export function SwapFab({ swapState, onEnterSwapMode, onExitSwapMode, onProceed }: SwapFabProps) {
  const { mode } = swapState

  if (mode === 'post-swap' || mode === 'dragging') return null

  const isIdle = mode === 'idle'
  const isProceed = mode === 'both-selected'

  const dataState = isIdle ? 'idle' : isProceed ? 'proceed' : 'cancel'

  const handleClick = () => {
    if (isIdle) return onEnterSwapMode()
    if (isProceed) return onProceed()
    return onExitSwapMode()
  }

  const label = isIdle ? 'Swap' : isProceed ? 'Proceed' : 'Cancel'
  const ariaLabel = isIdle ? 'Enter swap mode' : isProceed ? 'Proceed with swap' : 'Cancel swap'

  return (
    <button
      className="swap-fab"
      data-state={dataState}
      onClick={handleClick}
      aria-label={ariaLabel}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {isIdle ? <SwapIcon /> : isProceed ? <CheckIcon /> : <CloseIcon />}
          {label}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
