/**
 * Roadmap feedback contract (#47).
 *
 * A learner-facing, advisory view over the shared mastery projection and
 * adaptive recommendation. The section never computes BKT or a band model: it
 * consumes `@study-tracker/progress` and the `masteryBands` reader (rule 41).
 *
 * The copy seam (`FeedbackCopyProvider`) is the #50 integration point: #47
 * ships a deterministic static provider, and an LLM provider later implements
 * the same input/output shape without any UI change.
 */

import type { DifficultyRecommendation, MasteryProjection } from '../../assessments/types'

/** The four learner-visible projection states plus the transient rebuild. */
export type FeedbackState = 'cold' | 'updated' | 'stale' | 'rebuilding'

/** Plain-language strength read of one projection; never a raw decimal. */
export type FeedbackRead = 'clear' | 'mixed' | 'revisit'

/** One inspectable row of the evidence trail. */
export interface FeedbackEvidence {
  materialId: string
  skillTag: string
  observations: number
  read: FeedbackRead
  /** Recent mastery movement, carried for the copy provider. */
  trend?: number
}

/**
 * Everything a copy provider may read to write the learner-facing story.
 * Deliberately the whole input context so #50 can decide the LLM prompt
 * without changing this seam.
 */
export interface FeedbackCopyInput {
  state: FeedbackState
  /** Titles of the roadmap's attached materials (grounding context). */
  materialTitles: string[]
  /** Per-(material, skill) projections for the roadmap's materials. */
  projections: MasteryProjection[]
  /** The one-band recommendation; null before any observation (cold start). */
  recommendation: DifficultyRecommendation | null
  evidence: FeedbackEvidence[]
}

/** The learner-facing copy, in the locked #35 hierarchy order. */
export interface FeedbackCopy {
  summary: string
  knowTitle: string
  knowBody: string
  watchTitle: string
  watchBody: string
  advisory: string
  advisoryNote: string
  /** Provenance: `static` now; an LLM modelVersion once #50 lands. */
  source: string
}

/**
 * Copy provider seam. Async-capable so the #50 LLM provider drops in without
 * a UI change; the static provider resolves synchronously.
 */
export type FeedbackCopyProvider = (
  input: FeedbackCopyInput,
) => FeedbackCopy | Promise<FeedbackCopy>
