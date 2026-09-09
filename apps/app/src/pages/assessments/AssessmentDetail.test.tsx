import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Dexie from 'dexie'
import { AssessmentDetail } from './AssessmentDetail'
import { AssessmentProvider } from '../../assessments/AssessmentProvider'
import { EventStoreProvider } from '../../events/EventStoreProvider'
import {
  FakeAssessmentClient,
  readyAssessment,
  queuedJob,
  attemptRecord,
} from '../../assessments/testing/fakeAssessmentClient'
import type { Assessment, AttemptRecord } from '../../assessments/types'

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

/** The review integration tests mount a per-user Dexie (real attemptFlow). */
const DB_NAME = 'StudyTracker_detail-user'

function renderDetail(assessments: FakeAssessmentClient, userId?: string) {
  const page = (
    <MemoryRouter initialEntries={['/assessments/assessment-1']}>
      <AssessmentProvider client={assessments}>
        <Routes>
          <Route path="/assessments/:assessmentId" element={<AssessmentDetail />} />
          <Route path="/assessments/:otherId" element={<div data-testid="other-assessment" />} />
          <Route path="/materials" element={<div data-testid="library-page" />} />
        </Routes>
      </AssessmentProvider>
    </MemoryRouter>
  )
  return render(
    userId ? <EventStoreProvider userId={userId}>{page}</EventStoreProvider> : page,
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

  it('renders a ready question with the review surface: panel prompt, answer slot, citations, warnings', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.scriptGetAssessment(
      readyAssessment({
        warnings: [{ code: 'citation_unverified', message: 'quote drifted' }],
      }),
    )
    renderDetail(assessments)

    // Question panel prompt (review shell) + verdict for a never-attempted question.
    expect(await screen.findByText('What is the planning gap?')).toBeInTheDocument()
    expect(screen.getByText('Difficulty 3')).toBeInTheDocument()
    expect(screen.getByText('0 of 1 graded · scores pending')).toBeInTheDocument()
    // Answer slot: taking UI (options + submit) and the grounded citations block.
    expect(screen.getByText('Shortfall')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled()
    expect(screen.getByText(/chunk c1:/)).toBeInTheDocument()
    // Warnings move into the summary band as role=status (D-03 vocabulary).
    expect(screen.getByRole('status', { name: 'Assessment warnings' })).toBeInTheDocument()
    expect(screen.getByText('quote drifted')).toBeInTheDocument()
  })

  it('renders only the visible question surface — never the answer key', async () => {
    const assessments = new FakeAssessmentClient()
    assessments.scriptGetAssessment(readyAssessment())
    const view = renderDetail(assessments)

    await screen.findByText('What is the planning gap?')
    // AC1/AC3 redaction boundary: the hidden key vocabulary never reaches the
    // rendered page (the answer_block/correctIndex live server-side only).
    const html = view.container.innerHTML
    expect(html).not.toMatch(/answerBlock|answer_block|correctIndex|correct_index/i)
    // The key itself is not revealed — no option is pre-marked as correct.
    expect(screen.queryByText(/correct answer|the answer is/i)).not.toBeInTheDocument()
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

describe('AssessmentDetail review surface (P4)', () => {
  const ASSESSMENT = readyAssessment()
  const QUESTION = ASSESSMENT.questions[0]

  let scriptedGrades: Map<string, AttemptRecord['grade']>
  let client: FakeAssessmentClient

  function gradeFor(score: number) {
    return {
      attemptId: 'att-x',
      questionId: QUESTION.id,
      materialId: 'mat-1',
      score,
      correct: score >= 0.6,
      perSkill: [{ skillTag: 'Strategic Planning', score, correct: score >= 0.6 }],
      grader: 'objective' as const,
      gradedAt: '2026-09-03T10:05:00Z',
      publicFeedback: score >= 0.6 ? 'Correct.' : 'Not correct.',
    }
  }

  /** Seed a server attempt record (fresh-device restore read path, D-01). */
  function seedAttempt(clientAttemptId: string, overrides: Partial<AttemptRecord> = {}) {
    scriptedGrades.set(clientAttemptId, overrides.grade ?? null)
    const attempt = attemptRecord({
      clientAttemptId,
      attemptId: `att-${clientAttemptId}`,
      answer: { index: 1 },
      ...overrides,
    })
    scriptedAttempts.set(clientAttemptId, attempt)
  }

  const scriptedAttempts = new Map<string, AttemptRecord>()

  beforeEach(async () => {
    await Dexie.delete(DB_NAME)
    scriptedGrades = new Map()
    scriptedAttempts.clear()
    client = new FakeAssessmentClient()
    client.scriptGetAssessment(ASSESSMENT)
    // Submit: mint a server attemptId and grade it immediately (AttemptTaker
    // pattern) — each submit is a fresh clientAttemptId row.
    client.submitAssessmentAttempt.mockImplementation(
      async (_assessmentId, questionId, input) => {
        const attemptId = `att-${input.clientAttemptId}`
        const grade = scriptedGrades.get('next') ?? gradeFor(1)
        scriptedGrades.delete('next')
        scriptedAttempts.set(input.clientAttemptId, {
          attemptId,
          clientAttemptId: input.clientAttemptId,
          questionId,
          assessmentId: ASSESSMENT.id,
          submittedAt: new Date().toISOString(),
          status: 'graded',
          answer: input.answer ?? { index: 0 },
          grade: { ...grade, attemptId },
        })
        scriptedGrades.set(input.clientAttemptId, grade)
        return { attemptId, questionId, status: 'queued', jobId: `job-${attemptId}` }
      },
    )
    // Read: return every recorded attempt (seed rows + fresh submits).
    client.listAssessmentAttempts.mockImplementation(async () => {
      const records: AttemptRecord[] = [...scriptedAttempts.values()].map((record) => ({
        ...record,
        grade:
          scriptedGrades.get(record.clientAttemptId) != null
            ? {
                ...scriptedGrades.get(record.clientAttemptId)!,
                attemptId: record.attemptId,
              }
            : null,
        status:
          scriptedGrades.get(record.clientAttemptId) != null ? 'graded' : 'queued',
      }))
      return records.filter((record) => record.clientAttemptId !== 'next')
    })
  })

  afterEach(async () => {
    cleanup()
    await Dexie.delete(DB_NAME)
  })

  function renderReview() {
    return renderDetail(client, 'detail-user')
  }

  it('restores graded attempts from the server and renders the review card with your-pick', async () => {
    seedAttempt('ca-seed', {
      submittedAt: '2026-09-03T10:00:00Z',
      status: 'graded',
      answer: { index: 0 },
      grade: { ...gradeFor(1), attemptId: 'att-ca-seed' },
    })
    const view = renderReview()

    expect(await screen.findByText('1 of 1 questions correct · score 1.00')).toBeInTheDocument()
    // Your-pick marking from the echoed answer (D-01) on the restored row.
    expect(screen.getByText('your answer')).toBeInTheDocument()
    expect(screen.getByText('Shortfall')).toBeInTheDocument()
    expect(screen.getByText('Correct.')).toBeInTheDocument()
    // Graded → the taking UI is replaced by the review card.
    expect(screen.queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument()
    // Redaction gate on the wired page.
    const html = view.container.innerHTML
    expect(html).not.toMatch(/answerBlock|answer_block|correctIndex|correct_index|referenceSolution|hiddenTest/i)
  })

  it('per-question retry mints a fresh attempt and keeps history append-only', async () => {
    seedAttempt('ca-seed', {
      submittedAt: '2026-09-03T10:00:00Z',
      status: 'graded',
      answer: { index: 1 },
      grade: { ...gradeFor(0), attemptId: 'att-ca-seed' },
    })
    renderReview()

    const retryButton = await screen.findByRole('button', { name: 'Retry question' })
    fireEvent.click(retryButton)
    // The panel returns to the taking UI (fresh answer required).
    const radios = await screen.findAllByRole('radio')
    expect(radios).toHaveLength(QUESTION.options.length)
    fireEvent.click(radios[0])
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))

    // Fresh attempt lands: history shows both attempts, oldest first.
    await waitFor(() => {
      expect(client.submitAssessmentAttempt).toHaveBeenCalledTimes(1)
    }, { timeout: 6000 })
    const input = client.submitAssessmentAttempt.mock.calls[0][2]
    expect(input.clientAttemptId).not.toBe('ca-seed')
    expect(input.answer).toEqual({ index: 0 })

    await waitFor(
      () => {
        const history = screen.getByLabelText('Attempt history')
        const labels = Array.from(history.querySelectorAll('.ar-attempt-label')).map(
          (el) => el.textContent,
        )
        expect(labels).toEqual(['Attempt #1', 'Attempt #2'])
      },
      { timeout: 6000 },
    )
    // Latest graded → retry affordance is back; nothing was overwritten.
    expect(screen.getByRole('button', { name: 'Retry question' })).toBeInTheDocument()
  })

  it('whole-assessment retry appends a timeline round and collapses the prior', async () => {
    seedAttempt('ca-seed', {
      submittedAt: '2026-09-03T10:00:00Z',
      status: 'graded',
      answer: { index: 1 },
      grade: { ...gradeFor(1), attemptId: 'att-ca-seed' },
    })
    renderReview()

    await screen.findByText('1 of 1 questions correct · score 1.00')
    fireEvent.click(screen.getByRole('button', { name: 'Retry assessment' }))

    // Round 2 appended: prior timeline collapses into the <details> record.
    expect(screen.getByText(/Previous attempt timeline — 1 attempt/)).toBeInTheDocument()
    expect(screen.getByText(/Attempt 2 of 2 · started/)).toBeInTheDocument()
    // Every question returns to taking mode — submit is a fresh observation.
    const radios = await screen.findAllByRole('radio')
    fireEvent.click(radios[0])
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))

    await waitFor(() => {
      expect(client.submitAssessmentAttempt).toHaveBeenCalledTimes(1)
    }, { timeout: 6000 })
    expect(client.submitAssessmentAttempt.mock.calls[0][2].clientAttemptId).not.toBe('ca-seed')

    await waitFor(
      () => {
        const history = screen.getByLabelText('Attempt history')
        const labels = Array.from(history.querySelectorAll('.ar-attempt-label')).map(
          (el) => el.textContent,
        )
        expect(labels).toEqual(['Attempt #1', 'Attempt #2'])
      },
      { timeout: 6000 },
    )
    // The collapsed prior round stays present after the fresh grade lands.
    expect(screen.getByText(/Previous attempt timeline — 1 attempt/)).toBeInTheDocument()
  })

  it('hides the retry control while the latest attempt is queued (no double-queue)', async () => {
    seedAttempt('ca-seed', {
      submittedAt: '2026-09-03T10:00:00Z',
      status: 'graded',
      answer: { index: 1 },
      grade: { ...gradeFor(0), attemptId: 'att-ca-seed' },
    })
    // A second, in-flight attempt (cross-device submit) arrives queued.
    seedAttempt('ca-flight', {
      submittedAt: '2026-09-03T10:06:00Z',
      status: 'queued',
      answer: { index: 2 },
      grade: null,
    })
    renderReview()

    expect(
      await screen.findByText(/New attempt queued — previous attempt kept/),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Grading attempt')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry question' })).not.toBeInTheDocument()
  })
})
