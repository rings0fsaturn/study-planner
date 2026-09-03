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
import { FakeAssessmentClient, readyAssessment } from '../../assessments/testing/fakeAssessmentClient'
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
