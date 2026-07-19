import { AnimatePresence, motion } from 'framer-motion'
import type { SwapState } from './useSwapStateMachine'

const GUIDANCE_TEXT: Record<string, string> = {
  'awaiting-source': 'Tap a session to start',
  'source-selected': 'Now tap the destination',
  'both-selected': 'Tap Proceed to swap, or tap a slot to change selection',
}

export function SwapGuidanceBanner({ swapState }: { swapState: SwapState }) {
  const text = GUIDANCE_TEXT[swapState.mode]

  return (
    <AnimatePresence>
      {text && (
        <motion.div
          className="swap-guidance"
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
