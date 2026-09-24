/**
 * LLM-backed copy provider for the roadmap feedback section (#68).
 *
 * Same seam as the static provider (`FeedbackCopyInput` -> `FeedbackCopy`,
 * no UI change). The model is called only for the `updated` state; every
 * other state and every failure renders the static copy, logs with the
 * typed error's request id, and never blocks the section (D-05).
 */

import type { AssessmentClientLike } from '../../assessments/assessmentClient'
import { logger } from '../../lib/logger'
import { staticFeedbackCopy } from './feedbackCopy'
import type { FeedbackCopy, FeedbackCopyInput, FeedbackCopyProvider } from './types'

const COPY_FIELDS = [
  'summary',
  'knowTitle',
  'knowBody',
  'watchTitle',
  'watchBody',
  'advisory',
  'advisoryNote',
  'source',
] as const

function isFeedbackCopy(value: unknown): value is FeedbackCopy {
  return (
    typeof value === 'object' &&
    value !== null &&
    COPY_FIELDS.every(
      (field) => typeof (value as Record<string, unknown>)[field] === 'string',
    )
  )
}

export function makeLlmFeedbackProvider(
  client: AssessmentClientLike,
  materialIds: string[],
): FeedbackCopyProvider {
  return async (input: FeedbackCopyInput): Promise<FeedbackCopy> => {
    if (input.state !== 'updated') return staticFeedbackCopy(input)
    try {
      const copy = await client.getFeedbackCopy(input, materialIds)
      return isFeedbackCopy(copy) ? copy : staticFeedbackCopy(input)
    } catch (error) {
      // Advisory: a failed copy keeps the static words and never blocks.
      logger.warn('[roadmap-feedback] llm copy failed, using static', error)
      return staticFeedbackCopy(input)
    }
  }
}
