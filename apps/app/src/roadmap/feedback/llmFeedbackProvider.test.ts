import { describe, expect, it } from 'vitest'
import { AssessmentServiceError } from '../../assessments/types'
import {
  FakeAssessmentClient,
  feedbackCopy,
} from '../../assessments/testing/fakeAssessmentClient'
import { staticFeedbackCopy } from './feedbackCopy'
import { makeLlmFeedbackProvider } from './llmFeedbackProvider'
import type { FeedbackCopyInput } from './types'

function input(overrides: Partial<FeedbackCopyInput> = {}): FeedbackCopyInput {
  return {
    state: 'updated',
    materialTitles: ['Operating Systems'],
    projections: [],
    recommendation: null,
    evidence: [],
    ...overrides,
  }
}

describe('makeLlmFeedbackProvider', () => {
  it('returns the LLM copy for the updated state', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetFeedbackCopy(feedbackCopy({ summary: 'LLM words.' }))
    const provider = makeLlmFeedbackProvider(client, ['mat-1'])

    const copy = await provider(input())

    expect(copy.summary).toBe('LLM words.')
    expect(copy.source).toBe('meta/muse-spark-1.3-contributor')
    expect(client.getFeedbackCopy).toHaveBeenCalledTimes(1)
  })

  it('never calls the model for cold, stale, or rebuilding', async () => {
    const client = new FakeAssessmentClient()
    const provider = makeLlmFeedbackProvider(client, ['mat-1'])

    for (const state of ['cold', 'stale', 'rebuilding'] as const) {
      const copy = await provider(input({ state }))
      expect(copy).toEqual(staticFeedbackCopy(input({ state })))
    }
    expect(client.getFeedbackCopy).not.toHaveBeenCalled()
  })

  it('falls back to static when the call fails', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetFeedbackCopy(
      new AssessmentServiceError('timeout', 'timed out', true, undefined, 'req-1'),
    )
    const provider = makeLlmFeedbackProvider(client, ['mat-1'])

    const copy = await provider(input())

    expect(copy).toEqual(staticFeedbackCopy(input()))
    expect(copy.source).toBe('static')
  })

  it('falls back to static when the payload is malformed', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetFeedbackCopy({ summary: 'only this' } as unknown as ReturnType<
      typeof feedbackCopy
    >)
    const provider = makeLlmFeedbackProvider(client, ['mat-1'])

    await expect(provider(input())).resolves.toEqual(staticFeedbackCopy(input()))
  })

  it('falls back to static on a raw error too', async () => {
    const client = new FakeAssessmentClient()
    client.scriptGetFeedbackCopy(new Error('raw boom'))
    const provider = makeLlmFeedbackProvider(client, ['mat-1'])

    await expect(provider(input())).resolves.toEqual(staticFeedbackCopy(input()))
  })
})
