/**
 * Static copy provider for the roadmap feedback section (#47).
 *
 * Deterministic plain-language templates derived from the real projection and
 * recommendation values. This is the seam #50 replaces with an LLM provider:
 * same input, same output shape, no UI change.
 *
 * HITL constraint (#35): plain language leads. Raw mastery decimals and
 * expected-correctness percentages must never appear here; model numbers live
 * only behind the collapsed "Model context" disclosure in the section.
 */

import type {
  FeedbackCopy,
  FeedbackCopyInput,
  FeedbackCopyProvider,
  FeedbackEvidence,
} from './types'

function strongest(evidence: FeedbackEvidence[]): FeedbackEvidence | undefined {
  return evidence.find((row) => row.read === 'clear') ?? evidence[0]
}

function weakest(evidence: FeedbackEvidence[]): FeedbackEvidence | undefined {
  return evidence.find((row) => row.read === 'revisit') ?? evidence[evidence.length - 1]
}

function attempts(count: number): string {
  return `${count} graded attempt${count === 1 ? '' : 's'}`
}

function knowWatch(evidence: FeedbackEvidence[]): Pick<
  FeedbackCopy,
  'knowTitle' | 'knowBody' | 'watchTitle' | 'watchBody'
> {
  const top = strongest(evidence)
  const weak = weakest(evidence)
  return {
    knowTitle: top ? `${top.skillTag} is looking steady` : 'The current ideas are starting to stick',
    knowBody: top
      ? `You handled ${top.skillTag} reliably across ${attempts(top.observations)}.`
      : 'Keep working at the current level so the next summary has something useful to compare.',
    watchTitle: weak ? `${weak.skillTag} needs another look` : 'The edge cases',
    watchBody: weak
      ? 'This is the weakest signal right now. Another attempt would make the picture clearer.'
      : 'One difficult edge case is still worth revisiting before we call this settled.',
  }
}

function advisoryFor(recommendation: FeedbackCopyInput['recommendation']): string {
  if (!recommendation) {
    return 'Keep practising at the current level while we learn what feels comfortable for you.'
  }
  if (recommendation.recommendedBand > recommendation.currentBand) {
    return 'Try a slightly harder challenge next. You have been handling the current level with growing confidence.'
  }
  if (recommendation.recommendedBand < recommendation.currentBand) {
    return 'Take a gentler step next while the recent ideas settle.'
  }
  return 'Keep practising at the current level while we gather more evidence.'
}

export function staticFeedbackCopy(input: FeedbackCopyInput): FeedbackCopy {
  const { state, recommendation, evidence } = input
  const know = knowWatch(evidence)
  const advisory = advisoryFor(recommendation)

  if (state === 'cold') {
    return {
      summary:
        'You are just getting started with this material. We will wait for more practice before suggesting a change.',
      knowTitle: 'Not enough evidence yet',
      knowBody:
        'Keep working at the current level so the next summary has something useful to compare.',
      watchTitle: 'Your first explanations',
      watchBody: 'We do not want to overreact to one early attempt.',
      advisory:
        'Keep practising at the current level while we learn what feels comfortable for you.',
      advisoryNote: 'This suggestion does not edit your roadmap.',
      source: 'static',
    }
  }

  if (state === 'stale') {
    return {
      summary:
        'You have done more work since this summary was created. Refresh the feedback before relying on it.',
      ...know,
      advisory: 'Wait for the feedback refresh before acting on this suggestion.',
      advisoryNote: 'This recommendation is paused until the projection is rebuilt.',
      source: 'static',
    }
  }

  if (state === 'rebuilding') {
    return {
      summary:
        'We are rereading your recent attempts now. Your roadmap is not being changed during this refresh.',
      ...know,
      advisory,
      advisoryNote: 'This suggestion does not edit your roadmap.',
      source: 'static',
    }
  }

  const movingUp =
    recommendation != null && recommendation.recommendedBand > recommendation.currentBand
  const movingDown =
    recommendation != null && recommendation.recommendedBand < recommendation.currentBand
  const summary = movingUp
    ? 'You are becoming more consistent with the core ideas. A slightly harder challenge should help you test that progress.'
    : movingDown
      ? 'Some recent work was harder than the last summary. A gentler step should help the ideas settle.'
      : 'Your recent work is steady. Keep practising at the current level before we stretch it.'

  return {
    summary,
    ...know,
    advisory,
    advisoryNote: 'This suggestion does not edit your roadmap.',
    source: 'static',
  }
}

/** The default provider; #50 swaps this for the LLM-backed one. */
export const staticFeedbackProvider: FeedbackCopyProvider = staticFeedbackCopy
