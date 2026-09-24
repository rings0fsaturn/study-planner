/**
 * The practice coach's trigger + streaming state machine (#46, D-10).
 *
 * Hybrid on-demand triggers (explicit ask, idle, failed test) OFFER help and
 * never force it. The ladder escalates `nudge -> concept -> strategy`, stopping
 * at the gated `worked_step`; the reveal gate is a separate call before that
 * tier streams. Stream frames are applied in order with sequence dedup and a
 * `start` reset, and a dropped stream is retried once before `done`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { logger } from '../lib/logger'
import { useGuideClient } from './GuideProvider'
import {
  GUIDE_TIERS,
  GuideServiceError,
  type GuideCitation,
  type GuideFrame,
  type GuideTier,
} from './types'

export type GuideStatus = 'idle' | 'offered' | 'active'
export type GuideTrigger = 'idle' | 'failedRun' | 'stuck'

const IDLE_MS = 45000
const MAX_STREAM_ATTEMPTS = 2

export interface PracticeGuide {
  status: GuideStatus
  trigger: GuideTrigger | null
  tier: GuideTier | null
  tierIndex: number
  atReveal: boolean
  revealed: boolean
  text: string
  citations: GuideCitation[]
  streaming: boolean
  error: string | null
  /** True once the learner has a submitted attempt the reveal gate can bind to. */
  revealAvailable: boolean
  ask: () => void
  accept: () => void
  next: () => void
  dismiss: () => void
  poke: () => void
  confirmReveal: () => void
  notifyFailedTest: () => void
}

export interface UsePracticeGuideOptions {
  questionId: string
  work: string
  activeLine?: number
  materialIds?: string[]
  attemptId?: string | null
  /** Arm the idle offer only while the problem is still answerable. */
  enabled: boolean
}

export function usePracticeGuide({
  questionId,
  work,
  activeLine,
  materialIds,
  attemptId,
  enabled,
}: UsePracticeGuideOptions): PracticeGuide {
  const client = useGuideClient()
  const [status, setStatus] = useState<GuideStatus>('idle')
  const [trigger, setTrigger] = useState<GuideTrigger | null>(null)
  const [tierIndex, setTierIndex] = useState(-1)
  const [revealed, setRevealed] = useState(false)
  const [text, setText] = useState('')
  const [citations, setCitations] = useState<GuideCitation[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastSequence = useRef(-1)
  const sawDone = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const offeredOnce = useRef(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Event handlers read the committed status without putting a side effect
  // inside a state updater (StrictMode double-invokes those).
  const statusRef = useRef<GuideStatus>('idle')
  statusRef.current = status

  const questionRef = useRef(questionId)
  questionRef.current = questionId
  const workRef = useRef(work)
  workRef.current = work
  const activeLineRef = useRef(activeLine)
  activeLineRef.current = activeLine
  const materialIdsRef = useRef(materialIds)
  materialIdsRef.current = materialIds
  const attemptIdRef = useRef(attemptId)
  attemptIdRef.current = attemptId

  const clearIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = null
  }, [])

  useEffect(() => {
    return () => {
      clearIdle()
      abortRef.current?.abort()
    }
  }, [clearIdle])

  // A new question is a new conversation: drop any hint, tier, reveal, or
  // offer from the problem the learner just left, and cancel its idle timer.
  useEffect(() => {
    clearIdle()
    abortRef.current?.abort()
    abortRef.current = null
    offeredOnce.current = false
    setStatus('idle')
    setTrigger(null)
    setTierIndex(-1)
    setRevealed(false)
    setText('')
    setCitations([])
    setStreaming(false)
    setError(null)
  }, [questionId, clearIdle])

  const offer = useCallback((kind: GuideTrigger) => {
    if (statusRef.current !== 'idle') return
    setTrigger(kind)
    setStatus('offered')
  }, [])

  const streamTier = useCallback(
    async (tier: GuideTier) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setStreaming(true)
      setError(null)
      setText('')
      setCitations([])
      lastSequence.current = -1
      sawDone.current = false

      const request = {
        questionId: questionRef.current,
        learnerWork: workRef.current,
        tier,
        correlationId: crypto.randomUUID(),
        ...(activeLineRef.current ? { activeLine: activeLineRef.current } : {}),
        ...(materialIdsRef.current && materialIdsRef.current.length
          ? { materialIds: materialIdsRef.current }
          : {}),
      }

      const onFrame = (frame: GuideFrame) => {
        if (frame.frame === 'start') {
          // A fresh/reconnected stream resets the buffer so a retry never
          // duplicates earlier text.
          lastSequence.current = -1
          setText(frame.text ?? '')
          setCitations([])
        } else {
          if (frame.sequence <= lastSequence.current) return
          if (frame.frame === 'delta') setText((prev) => prev + (frame.text ?? ''))
          else if (frame.frame === 'citation') setCitations(frame.citations ?? [])
          else if (frame.frame === 'done') sawDone.current = true
          else if (frame.frame === 'error') {
            sawDone.current = true
            setError(
              frame.error?.code
                ? `The guide could not answer (${frame.error.code}).`
                : 'The guide could not answer.',
            )
          }
        }
        lastSequence.current = frame.sequence
      }

      let failed = false
      for (let attempt = 0; attempt < MAX_STREAM_ATTEMPTS; attempt++) {
        try {
          await client.streamHint(request, {
            onFrame,
            signal: controller.signal,
            // One id per logical call, reused across the retry (rule 17).
            requestId: request.correlationId,
          })
          break
        } catch (err) {
          if (controller.signal.aborted) return
          if (sawDone.current || attempt === MAX_STREAM_ATTEMPTS - 1) {
            const normalized = err instanceof GuideServiceError ? err : null
            logger.warn('[guide] hint stream failed', normalized?.code ?? err)
            setError('The guide could not reach the service. Try again in a moment.')
            failed = true
            break
          }
        }
      }
      // A stream that closes cleanly without a `done` frame was truncated
      // (proxy drop, worker recycle); never render a partial hint as final.
      if (!sawDone.current && !failed && !controller.signal.aborted) {
        logger.warn('[guide] stream ended without done')
        setError('The guide stream ended early. Try again in a moment.')
      }
      setStreaming(false)
    },
    [client],
  )

  const armIdle = useCallback(() => {
    clearIdle()
    if (!enabled || status !== 'idle' || offeredOnce.current) return
    idleTimer.current = setTimeout(() => {
      offeredOnce.current = true
      offer('idle')
    }, IDLE_MS)
  }, [clearIdle, enabled, status, offer])

  useEffect(() => {
    armIdle()
    return clearIdle
  }, [armIdle, clearIdle])

  const poke = useCallback(() => {
    setStatus((current) => (current === 'offered' && trigger === 'idle' ? 'idle' : current))
    armIdle()
  }, [armIdle, trigger])

  const ask = useCallback(() => {
    clearIdle()
    offer('stuck')
  }, [clearIdle, offer])

  const accept = useCallback(() => {
    clearIdle()
    setStatus('active')
    setTierIndex(0)
    setRevealed(false)
    void streamTier('nudge')
  }, [clearIdle, streamTier])

  const next = useCallback(() => {
    const nextIndex = Math.min(tierIndex + 1, GUIDE_TIERS.length - 1)
    setTierIndex(nextIndex)
    // The reveal tier streams only after the gate call succeeds; the stream
    // is started here, never inside a state updater (StrictMode double-invokes
    // updaters and would bill the provider twice).
    const nextTier = GUIDE_TIERS[nextIndex]
    if (nextTier !== 'worked_step') void streamTier(nextTier)
  }, [tierIndex, streamTier])

  const confirmReveal = useCallback(async () => {
    const attempt = attemptIdRef.current
    if (!attempt) return
    const question = questionRef.current
    setStreaming(true)
    setError(null)
    try {
      await client.reveal({
        questionId: question,
        attemptId: attempt,
        confirmation: true,
        correlationId: crypto.randomUUID(),
      })
    } catch (err) {
      const normalized = err instanceof GuideServiceError ? err : null
      logger.warn('[guide] reveal gate failed', normalized?.code ?? err)
      if (questionRef.current !== question) return
      setError('The reveal gate could not be satisfied. Submit an attempt first, then try again.')
      setStreaming(false)
      return
    }
    // The learner may have switched problems while the gate was in flight;
    // never stream a worked step for a question the gate did not cover.
    if (questionRef.current !== question) return
    setRevealed(true)
    void streamTier('worked_step')
  }, [client, streamTier])

  const dismiss = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('idle')
    setTrigger(null)
    setTierIndex(-1)
    setRevealed(false)
    setText('')
    setCitations([])
    setStreaming(false)
    setError(null)
    offeredOnce.current = true
  }, [])

  const notifyFailedTest = useCallback(() => {
    offer('failedRun')
  }, [offer])

  const tier = tierIndex >= 0 ? GUIDE_TIERS[tierIndex] : null
  const atReveal = tier === 'worked_step'

  return {
    status,
    trigger,
    tier,
    tierIndex,
    atReveal,
    revealed,
    text,
    citations,
    streaming,
    error,
    revealAvailable: Boolean(attemptId),
    ask,
    accept,
    next,
    dismiss,
    poke,
    confirmReveal,
    notifyFailedTest,
  }
}
