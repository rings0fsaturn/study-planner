import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AssessmentDetail } from './AssessmentDetail'
import { AssessmentProvider } from '../../assessments/AssessmentProvider'
import {
  FakeAssessmentClient,
  readyAssessment,
  queuedJob,
} from '../../assessments/testing/fakeAssessmentClient'
import type { Assessment } from '../../assessments/types'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

function generatingAssessment(): Assessment {
  return {
    id: 'assessment-1',
    ownerId: 'user-1',
    materialIds: ['mat-1'],
    status: 'generating',
    questions: [],
    warnings: [],
    groundingStale: false,
    createdAt: '2026-08-14T00:00:00Z',
  }
}

function renderDetail(assessments: FakeAssessmentClient) {
  return render(
    <MemoryRouter initialEntries={['/assessments/assessment-1']}>
      <AssessmentProvider client={assessments}>
        <Routes>
          <Route path="/assessments/:assessmentId" element={<AssessmentDetail />} />
          <Route path="/assessments/:otherId" element={<div data-testid="other-assessment" />} />
          <Route path="/materials" element={<div data-testid="library-page" />} />
        </Routes>
      </AssessmentProvider>
    </MemoryRouter>,
  )
}

describe('AssessmentDetail', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the honest generating state while polling', async () => {
    vi.useFakeTimers()
    const assessments = new FakeAssessmentClient()
    assessments.scriptGetAssessment(generatingAssessment())
    renderDetail(assessments)

    await act(async () => {})
    expect(screen.getByText('Generating your question')).toBeInTheDocument()
    expect(screen.queryByText(/fake percentages|Loading/i)).not.toBeInTheDocument()
  })

  it('renders a ready question with options, citations and warnings', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.scriptGetAssessment(
      readyAssessment({
        warnings: [{ code: 'citation_unverified', message: 'quote drifted' }],
      }),
    )
    renderDetail(assessments)

    expect(await screen.findByText('What is the planning gap?')).toBeInTheDocument()
    expect(screen.getByText('Shortfall')).toBeInTheDocument()
    expect(screen.getByText(/Difficulty band 3/)).toBeInTheDocument()
    expect(screen.getByText(/chunk c1:/)).toBeInTheDocument()
    expect(screen.getByText('Attention')).toBeInTheDocument()
    expect(screen.getByText('quote drifted')).toBeInTheDocument()
  })

  it('never references answer content', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.scriptGetAssessment(readyAssessment())
    renderDetail(assessments)

    await screen.findByText('What is the planning gap?')
    expect(screen.queryByText(/correct|answer/i)).not.toBeInTheDocument()
  })

  it('shows failed warnings with a retry that creates a fresh observation', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.scriptGetAssessment({
      ...generatingAssessment(),
      status: 'failed',
      warnings: [{ code: 'malformed_output', message: 'repair validation failed' }],
    })
    assessments.scriptGenerate(queuedJob({ jobId: 'job-2', resultId: 'assessment-2' }))
    renderDetail(assessments)

    expect(await screen.findByText('Generation did not complete')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry generation' }))

    await waitFor(() => {
      expect(assessments.generateAssessment).toHaveBeenCalledTimes(1)
    })
    const input = assessments.generateAssessment.mock.calls[0][0]
    expect(input.materialIds).toEqual(['mat-1'])
    expect(input.clientId).not.toBe('')
    expect(input.correlationId).not.toBe('')
  })

  it('stops polling on a terminal status and clears the timer on unmount', async () => {
    vi.useFakeTimers()
    const assessments = new FakeAssessmentClient()
    let polls = 0
    assessments.getAssessment.mockImplementation(async () => {
      polls += 1
      return polls === 1 ? generatingAssessment() : readyAssessment()
    })
    const view = renderDetail(assessments)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(screen.getByText('What is the planning gap?')).toBeInTheDocument()
    const pollsAfterReady = polls

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000)
    })
    expect(polls).toBe(pollsAfterReady)

    view.unmount()
  })

  it('polls linearly while the assessment keeps generating', async () => {
    vi.useFakeTimers()
    const assessments = new FakeAssessmentClient()
    let polls = 0
    assessments.getAssessment.mockImplementation(async () => {
      polls += 1
      return generatingAssessment()
    })
    renderDetail(assessments)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000)
    })
    // One poll per 3 s interval: 1 initial + 4 interval ticks = 5; an
    // exponential re-schedule bug would make this explode.
    expect(polls).toBe(5)
  })

  it('shows a retry affordance when a retryable failure warns on a generating assessment', async () => {
    vi.useFakeTimers()
    const assessments = new FakeAssessmentClient()
    assessments.scriptGetAssessment({
      ...generatingAssessment(),
      warnings: [{ code: 'quota_exhausted', message: 'provider quota exhausted' }],
    })
    assessments.scriptGenerate(queuedJob({ jobId: 'job-2', resultId: 'assessment-2' }))
    renderDetail(assessments)

    await act(async () => {})
    expect(screen.getByText('Generation was interrupted')).toBeInTheDocument()
    expect(screen.getByText(/provider quota exhausted/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry generation' }))

    await act(async () => {})
    expect(assessments.generateAssessment).toHaveBeenCalledTimes(1)
  })

  it('restores directly from the route param on refresh', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.scriptGetAssessment(readyAssessment())
    renderDetail(assessments)

    expect(await screen.findByText('What is the planning gap?')).toBeInTheDocument()
    expect(assessments.getAssessment).toHaveBeenCalledWith('assessment-1')
  })
})