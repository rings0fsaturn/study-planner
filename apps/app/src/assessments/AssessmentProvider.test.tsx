import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { AssessmentProvider, useAssessmentClient } from './AssessmentProvider'
import { FakeAssessmentClient, queuedJob } from './testing/fakeAssessmentClient'
import type { AssessmentClientLike } from './assessmentClient'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

function renderWithClient(client: AssessmentClientLike) {
  return renderHook(() => useAssessmentClient(), {
    wrapper: ({ children }) => <AssessmentProvider client={client}>{children}</AssessmentProvider>,
  })
}

describe('AssessmentProvider', () => {
  it('provides the injected client to consumers', () => {
    const client = new FakeAssessmentClient()
    const { result } = renderWithClient(client)
    expect(result.current).toBe(client)
  })

  it('throws outside the provider', () => {
    expect(() => renderHook(() => useAssessmentClient())).toThrow(
      'useAssessmentClient must be used within AssessmentProvider',
    )
  })

  it('remounting with a different client does not share state', async () => {
    const first = new FakeAssessmentClient()
    first.scriptGenerate(queuedJob({ jobId: 'job-first', resultId: 'assessment-first' }))
    const second = new FakeAssessmentClient()
    second.scriptGenerate(queuedJob({ jobId: 'job-second', resultId: 'assessment-second' }))

    const firstRender = renderWithClient(first)
    const firstJob = await firstRender.result.current.generateAssessment({
      clientId: 'c1',
      materialIds: ['m1'],
      recipe: { formats: ['objective'], questionCount: 1, difficulty: 3 },
      correlationId: 'corr-1',
    })
    expect(firstJob.jobId).toBe('job-first')

    firstRender.unmount()
    const secondRender = renderWithClient(second)
    const secondJob = await secondRender.result.current.generateAssessment({
      clientId: 'c1',
      materialIds: ['m1'],
      recipe: { formats: ['objective'], questionCount: 1, difficulty: 3 },
      correlationId: 'corr-1',
    })
    expect(secondJob.jobId).toBe('job-second')
    expect(first.generateAssessment).toHaveBeenCalledTimes(1)
    expect(second.generateAssessment).toHaveBeenCalledTimes(1)
  })
})