import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PasteAnimationProps {
  triggerKey: number
  pastedUrl: string
}

const PAPER_SVG = (
  <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="18" height="22" rx="2" stroke="currentColor" strokeWidth="1.5" fill="var(--surface-card)" />
    <line x1="5" y1="7" x2="15" y2="7" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <line x1="5" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <line x1="5" y1="15" x2="11" y2="15" stroke="currentColor" strokeWidth="1" opacity="0.4" />
  </svg>
)

export function PasteAnimation({ triggerKey, pastedUrl }: PasteAnimationProps) {
  const [phase, setPhase] = useState<'idle' | 'sliding' | 'flying' | 'message'>('idle')
  const [displayUrl, setDisplayUrl] = useState('')

  useEffect(() => {
    if (triggerKey === 0) return

    setDisplayUrl(pastedUrl)
    setPhase('sliding')

    const t1 = setTimeout(() => setPhase('flying'), 500)
    const t2 = setTimeout(() => setPhase('message'), 1000)
    const t3 = setTimeout(() => setPhase('idle'), 4000)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [triggerKey, pastedUrl])

  if (phase === 'idle' && triggerKey === 0) return null

  return (
    <div style={{ position: 'relative', pointerEvents: 'none' }}>
      {/* Sliding URL text */}
      <AnimatePresence>
        {phase === 'sliding' && (
          <motion.div
            key={`slide-${triggerKey}`}
            initial={{ x: 0, opacity: 1 }}
            animate={{ x: 200, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeIn' }}
            style={{
              position: 'absolute',
              top: '-38px',
              left: '12px',
              right: '40px',
              overflow: 'hidden',
              fontSize: '14px',
              color: 'var(--text-tertiary)',
              whiteSpace: 'nowrap',
            }}
          >
            {displayUrl}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Paper icon growing then flying */}
      <AnimatePresence>
        {(phase === 'sliding' || phase === 'flying') && (
          <motion.div
            key={`paper-${triggerKey}`}
            initial={{ scale: 0, opacity: 0, x: 0, y: 0, rotate: 0 }}
            animate={
              phase === 'sliding'
                ? { scale: 1, opacity: 1, x: 0, y: 0, rotate: 0 }
                : { scale: 0.4, opacity: 0, x: 40, y: -80, rotate: 360 }
            }
            exit={{ opacity: 0 }}
            transition={
              phase === 'sliding'
                ? { duration: 0.4, ease: 'easeOut' }
                : { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
            }
            style={{
              position: 'absolute',
              top: '-44px',
              right: '8px',
              color: 'var(--terracotta)',
              zIndex: 10,
            }}
          >
            {PAPER_SVG}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper message */}
      <AnimatePresence>
        {phase === 'message' && (
          <motion.div
            key={`msg-${triggerKey}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            style={{
              fontSize: '12px',
              color: 'var(--moss)',
              fontStyle: 'italic',
              marginTop: '4px',
            }}
          >
            Received URL, fetching. You may paste the next URL.
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
