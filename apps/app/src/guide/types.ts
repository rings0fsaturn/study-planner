/**
 * Socratic guide contracts (#46).
 *
 * Wire shapes mirror the approved Phase 2 contract pack: the `HintFrame` SSE
 * frames and the gated-reveal acknowledgement. The wire tier enum is
 * `nudge | concept | strategy | worked_step`; the UI labels them
 * Nudge / Hint / Targeted / Reveal (gated) (D-02).
 */

export type GuideTier = 'nudge' | 'concept' | 'strategy' | 'worked_step'

/** UI ladder order; the last tier is the gated reveal. */
export const GUIDE_TIERS: readonly GuideTier[] = ['nudge', 'concept', 'strategy', 'worked_step']

export const TIER_LABEL: Record<GuideTier, string> = {
  nudge: 'Nudge',
  concept: 'Hint',
  strategy: 'Targeted',
  worked_step: 'Reveal (gated)',
}

export type GuideFrameKind = 'start' | 'delta' | 'citation' | 'done' | 'error'

export interface GuideCitation {
  chunkId: string
  materialId: string
  quote: string
}

export interface GuideFrame {
  frame: GuideFrameKind
  sequence: number
  correlationId: string
  text?: string
  citations?: GuideCitation[]
  error?: {
    code: string
    retryable: boolean
    requestId: string
    correlationId: string
    retryAfterSeconds?: number
  }
}

export interface GuideRequest {
  questionId: string
  learnerWork: string
  tier: GuideTier
  correlationId: string
  activeLine?: number
  materialIds?: string[]
}

export interface RevealRequest {
  questionId: string
  attemptId: string
  confirmation: true
  correlationId: string
}

export interface RevealResponse {
  questionId: string
  attemptId: string
  gateSatisfied: true
  explanation: string
  revealedAt?: string
}

export type GuideServiceErrorCode =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'quota_exhausted'
  | 'rate_limited'
  | 'service'
  | 'unknown'

export class GuideServiceError extends Error {
  constructor(
    readonly code: GuideServiceErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly retryAfterSeconds?: number,
    /** Echo of the X-Request-ID sent with the call, for log joins. */
    readonly requestId?: string,
  ) {
    super(message)
    this.name = 'GuideServiceError'
  }
}
