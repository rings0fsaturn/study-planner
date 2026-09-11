// #39 Phase 5: AttemptTaker UI tests — answer → submit → honest states.
// Mounts through AssessmentProvider + EventStoreProvider with a scripted
// FakeAssessmentClient (the real attemptFlow + fake-indexeddb), so the UI
// contract (radio selection, honest phases, attempt history, fresh-attempt
// retry) is exercised end to end without the network.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import Dexie from 'dexie'
import { EventStoreProvider } from '../../events/EventStoreProvider'
import { AssessmentProvider } from '../../assessments/AssessmentProvider'
import { AttemptTaker } from './AttemptTaker'
import { FakeAssessmentClient, readyAssessment, writtenGrade, writtenQuestion } from '../../assessments/testing/fakeAssessmentClient'
import type { AttemptRecord } from '../../assessments/types'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}))

const ASSESSMENT = readyAssessment()
const QUESTION = ASSESSMENT.questions[0]
const DB_NAME = 'StudyTracker_taker-user'

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

describe('AttemptTaker', () => {
  beforeEach(async () => {
    await Dexie.delete(DB_NAME)
    scriptedGrades = new Map()
    client = new FakeAssessmentClient()
    // Submit: mint a server attemptId; record the clientAttemptId.
    client.submitAssessmentAttempt.mockImplementation(
      async (_assessmentId, questionId, input) => {
        const attemptId = `att-${input.clientAttemptId}`
        scriptedGrades.set(input.clientAttemptId, scriptedGrades.get('next') ?? gradeFor(1))
        scriptedGrades.delete('next')
        return { attemptId, questionId, status: 'queued', jobId: `job-${attemptId}` }
      },
    )
    // Read: return graded records for every submitted clientAttemptId.
    client.listAssessmentAttempts.mockImplementation(async () => {
      const records: AttemptRecord[] = []
      let index = 0
      for (const [clientAttemptId, grade] of scriptedGrades) {
        if (clientAttemptId === 'next') continue
        index++
        records.push({
          attemptId: `att-${clientAttemptId}`,
          clientAttemptId,
          questionId: QUESTION.id,
          assessmentId: ASSESSMENT.id,
          submittedAt: '2026-09-03T10:00:00Z',
          status: grade ? 'graded' : 'queued',
          grade: grade ? { ...grade, attemptId: `att-${clientAttemptId}` } : null,
        })
        void index
      }
      return records
    })
  })

  afterEach(async () => {
    cleanup()
    await Dexie.delete(DB_NAME)
  })

  function mount() {
    return render(
      <EventStoreProvider userId="taker-user">
        <AssessmentProvider client={client}>
          <AttemptTaker assessment={ASSESSMENT} question={QUESTION} />
        </AssessmentProvider>
      </EventStoreProvider>,
    )
  }

  it('renders radio options and disables submit until an answer is picked', async () => {
    mount()
    const radios = await screen.findAllByRole('radio')
    expect(radios).toHaveLength(QUESTION.options.length)
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled()
    fireEvent.click(radios[2])
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeEnabled()
  })

  it('walks answering → grading → graded with score and per-skill line', async () => {
    mount()
    const radios = await screen.findAllByRole('radio')
    fireEvent.click(radios[2])
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))
    })
    await waitFor(
      () => expect(screen.getByText(/Score 1\.00/)).toBeInTheDocument(),
      { timeout: 6000 },
    )
    expect(screen.getByText(/Strategic Planning: correct/)).toBeInTheDocument()
    expect(screen.getByText('Correct.')).toBeInTheDocument()
    expect(screen.getByText(/Attempt history \(1\)/)).toBeInTheDocument()
    // Retry affordance with the fresh-attempt contract copy.
    expect(screen.getByRole('button', { name: 'Retry question' })).toBeInTheDocument()
    expect(screen.getByText(/A retry is a fresh attempt/)).toBeInTheDocument()
  })

  it('an incorrect answer shows the honest not-correct result', async () => {
    scriptedGrades.set('next', gradeFor(0))
    mount()
    const radios = await screen.findAllByRole('radio')
    fireEvent.click(radios[0])
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))
    })
    await waitFor(
      () => expect(screen.getByText(/Score 0\.00/)).toBeInTheDocument(),
      { timeout: 6000 },
    )
    expect(screen.getByText('Not correct.')).toBeInTheDocument()
  })
})

// ---- #41 written branch ----------------------------------------------------

const WRITTEN_TEXT =
  'Adam keeps running averages of the gradient and of the squared gradient, so early estimates are pulled toward zero.'

describe('AttemptTaker written (#41)', () => {
  let writtenClient: FakeAssessmentClient
  let submitted: string[]

  beforeEach(async () => {
    await Dexie.delete(DB_NAME)
    submitted = []
    writtenClient = new FakeAssessmentClient()
    writtenClient.submitAssessmentAttempt.mockImplementation(
      async (_assessmentId, questionId, input) => {
        submitted.push(input.clientAttemptId)
        return {
          attemptId: `att-${input.clientAttemptId}`,
          questionId,
          status: 'queued',
          jobId: 'job-written-1',
        }
      },
    )
    writtenClient.listAssessmentAttempts.mockImplementation(async (): Promise<AttemptRecord[]> =>
      submitted.map((clientAttemptId) => ({
        attemptId: `att-${clientAttemptId}`,
        clientAttemptId,
        questionId: 'q-written-1',
        assessmentId: ASSESSMENT.id,
        submittedAt: '2026-09-10T10:00:00Z',
        status: 'graded',
        answer: { text: WRITTEN_TEXT },
        grade: writtenGrade({ attemptId: `att-${clientAttemptId}` }),
      })),
    )
  })

  afterEach(async () => {
    cleanup()
    await Dexie.delete(DB_NAME)
  })

  function mountWritten(subtype: 'short_answer' | 'long_form') {
    const question = writtenQuestion({ assessmentId: ASSESSMENT.id, subtype })
    const assessment = readyAssessment({ questions: [question] })
    return render(
      <EventStoreProvider userId="taker-user">
        <AssessmentProvider client={writtenClient}>
          <AttemptTaker assessment={assessment} question={question} />
        </AssessmentProvider>
      </EventStoreProvider>,
    )
  }

  it('sizes the textarea from the authored subtype and gates submit on real text', async () => {
    mountWritten('long_form')
    const textarea = await screen.findByLabelText('Your answer')
    expect(textarea.tagName).toBe('TEXTAREA')
    expect(textarea).toHaveAttribute('rows', '8')
    const submitButton = screen.getByRole('button', { name: 'Submit answer' })
    expect(submitButton).toBeDisabled()

    fireEvent.change(textarea, { target: { value: '   ' } })
    expect(submitButton).toBeDisabled()

    fireEvent.change(textarea, { target: { value: WRITTEN_TEXT } })
    expect(submitButton).toBeEnabled()
  })

  it('keeps the short-answer subtype compact', async () => {
    mountWritten('short_answer')
    expect(await screen.findByLabelText('Your answer')).toHaveAttribute('rows', '3')
  })

  it('submits { text } and walks answering → grading → graded with the rubric narrative', async () => {
    mountWritten('long_form')
    const textarea = await screen.findByLabelText('Your answer')
    fireEvent.change(textarea, { target: { value: WRITTEN_TEXT } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))
    })

    await waitFor(
      () => expect(screen.getByText(/Score 0\.75 · correct/)).toBeInTheDocument(),
      { timeout: 6000 },
    )
    // The written answer shape rides the wire; no objective keys are invented.
    expect(writtenClient.submitAssessmentAttempt.mock.calls[0][2].answer).toEqual({ text: WRITTEN_TEXT })
    // A written grade carries no publicFeedback, so the rubric explanation surfaces.
    expect(
      screen.getByText('You named both running estimates; the early-step mechanism is implied.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Optimization: correct/)).toBeInTheDocument()
    expect(screen.getByText(/Attempt history \(1\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry question' })).toBeInTheDocument()
  })

  it('posts nothing while the answer is blank or whitespace only', async () => {
    mountWritten('short_answer')
    const textarea = await screen.findByLabelText('Your answer')
    fireEvent.change(textarea, { target: { value: '  ' } })
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled()
    expect(writtenClient.submitAssessmentAttempt).not.toHaveBeenCalled()
  })
})
