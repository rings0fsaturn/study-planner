import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Dexie from 'dexie'
import { PracticeRun } from './PracticeRun'
import { AssessmentProvider } from '../../assessments/AssessmentProvider'
import { MaterialsProvider } from '../../materials/MaterialsProvider'
import { EventStoreProvider, createEventStore } from '../../events/EventStoreProvider'
import { PRACTICE_RUN_FINISHED, PRACTICE_RUN_STARTED } from '../../events/EventStore'
import {
  FakeAssessmentClient,
  attemptRecord,
} from '../../assessments/testing/fakeAssessmentClient'
import { FakeMaterialClient } from '../../materials/testing/fakeMaterialClient'
import type { MaterialRecord } from '../../materials/types'
import type {
  Assessment,
  AttemptRecord,
  Question,
  QuestionGradedResult,
} from '../../assessments/types'
import type { PracticeRunStartedPayload } from '../../sync/types'

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

const USER = 'practice-user'
const DB_NAME = `StudyTracker_${USER}`

function material(id: string, title: string): MaterialRecord {
  return {
    id,
    ownerId: 'user-a',
    title,
    kind: 'file',
    source: `${id}.pdf`,
    ingestionState: 'ready',
    ingestionProgress: 1,
    ingestionError: null,
    archived: false,
    contentVersion: 'v1',
    replacedAt: null,
    estimatedMinutes: 120,
    uploadCompleteAt: null,
    chunkCount: 0,
    groundingVersion: null,
    extractedTextPath: null,
    createdAt: '2026-09-15T09:00:00Z',
    updatedAt: '2026-09-15T09:00:00Z',
  }
}

function question(id: string, assessmentId: string, materialId: string): Question {
  return {
    id,
    assessmentId,
    materialId,
    format: 'written',
    subtype: 'short_answer',
    prompt: `Prompt for ${id}`,
    options: [],
    skillTags: ['core'],
    authoredDifficulty: 3,
    citations: [],
  }
}

function assessment(
  id: string,
  materialId: string,
  questions: Question[],
  status: Assessment['status'] = 'ready',
): Assessment {
  return {
    id,
    ownerId: 'user-a',
    materialIds: [materialId],
    status,
    questions,
    warnings: [],
    groundingStale: false,
    createdAt: '2026-09-15T10:00:00Z',
  }
}

function grade(questionId: string, score = 1): QuestionGradedResult {
  return {
    attemptId: `att-${questionId}`,
    questionId,
    materialId: 'mat-1',
    score,
    correct: score >= 0.6,
    perSkill: [],
    grader: 'llm_rubric',
    gradedAt: '2026-09-15T10:05:00Z',
    publicFeedback: score >= 0.6 ? 'Good answer.' : 'Not quite.',
  }
}

/** Seed the run pointer (and optionally its terminal event) before render. */
async function seedRun(
  payload: Partial<PracticeRunStartedPayload>,
  finished?: { runId: string; outcome: 'completed' | 'abandoned' },
) {
  const store = createEventStore(USER)
  await store.append(PRACTICE_RUN_STARTED, {
    runId: 'run-1',
    materialIds: ['mat-1'],
    mode: 'written',
    assessmentIds: ['a-1'],
    count: 1,
    ...payload,
  })
  if (finished) await store.append(PRACTICE_RUN_FINISHED, { ...finished })
  store.close()
}

/** Server-side attempt history the read route returns, keyed by assessment. */
let serverRecords: Map<string, AttemptRecord[]>

function renderRun(
  assessments: FakeAssessmentClient,
  materials = new FakeMaterialClient([material('mat-1', 'Operating Systems')]),
  runId = 'run-1',
) {
  return render(
    <MemoryRouter initialEntries={[`/materials/mat-1/practice/${runId}`]}>
      <EventStoreProvider userId={USER}>
        <MaterialsProvider client={materials}>
          <AssessmentProvider client={assessments}>
            <Routes>
              <Route path="/materials/:materialId/practice/:runId" element={<PracticeRun />} />
              <Route path="/materials/:materialId" element={<div data-testid="material-page" />} />
            </Routes>
          </AssessmentProvider>
        </MaterialsProvider>
      </EventStoreProvider>
    </MemoryRouter>,
  )
}

/** Submit mints a server attempt id and grades it immediately (#39/#41 pattern). */
function scriptSubmitting(
  client: FakeAssessmentClient,
  byId: Record<string, Assessment>,
  options: { failSubmits?: number } = {},
) {
  let failures = options.failSubmits ?? 0
  client.getAssessment.mockImplementation(async (id) => {
    const record = byId[id]
    if (!record) throw new Error(`no assessment ${id}`)
    return record
  })
  client.submitAssessmentAttempt.mockImplementation(
    async (assessmentId, questionId, input) => {
      if (failures > 0) {
        failures -= 1
        throw new Error('offline')
      }
      const attemptId = `att-${input.clientAttemptId}`
      const record = attemptRecord({
        attemptId,
        clientAttemptId: input.clientAttemptId,
        questionId,
        assessmentId,
        answer: input.answer ?? {},
        status: 'graded',
        grade: { ...grade(questionId), attemptId },
      })
      const list = serverRecords.get(assessmentId) ?? []
      serverRecords.set(
        assessmentId,
        list.filter((entry) => entry.clientAttemptId !== input.clientAttemptId).concat(record),
      )
      return { attemptId, questionId, status: 'queued' as const, jobId: `job-${attemptId}` }
    },
  )
  client.listAssessmentAttempts.mockImplementation(async (assessmentId) => {
    return serverRecords.get(assessmentId) ?? []
  })
}

/** Seed a graded attempt for one problem (fresh-device / resume path). */
function seedGrade(assessmentId: string, questionId: string, score = 1) {
  const record = attemptRecord({
    attemptId: `att-${questionId}`,
    clientAttemptId: `ca-${questionId}`,
    questionId,
    assessmentId,
    answer: { text: 'an earlier answer' },
    status: 'graded',
    grade: { ...grade(questionId, score), attemptId: `att-${questionId}` },
  })
  serverRecords.set(assessmentId, [...(serverRecords.get(assessmentId) ?? []), record])
}

describe('PracticeRun', () => {
  beforeEach(async () => {
    await Dexie.delete(DB_NAME)
    serverRecords = new Map()
  })

  afterEach(async () => {
    cleanup()
    await Dexie.delete(DB_NAME)
  })

  it('lands on the first unsolved problem and numbers the run', async () => {
    await seedRun({ assessmentIds: ['a-1', 'a-2'], count: 2 })
    const client = new FakeAssessmentClient()
    scriptSubmitting(client, {
      'a-1': assessment('a-1', 'mat-1', [question('q1', 'a-1', 'mat-1')]),
      'a-2': assessment('a-2', 'mat-1', [question('q2', 'a-2', 'mat-1')]),
    })

    renderRun(client)

    expect(await screen.findByText('Prompt for q1')).toBeInTheDocument()
    expect(screen.getByText('0 of 2 done')).toBeInTheDocument()
    // The shared navigator's own aria contract (D-04: primitives, not a copy).
    expect(screen.getByRole('tablist', { name: 'Question navigator' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })

  it('advances to the next problem once a grade lands', async () => {
    await seedRun({ assessmentIds: ['a-1', 'a-2'], count: 2 })
    const client = new FakeAssessmentClient()
    scriptSubmitting(client, {
      'a-1': assessment('a-1', 'mat-1', [question('q1', 'a-1', 'mat-1')]),
      'a-2': assessment('a-2', 'mat-1', [question('q2', 'a-2', 'mat-1')]),
    })

    renderRun(client)
    await screen.findByText('Prompt for q1')
    fireEvent.change(screen.getByLabelText('Your answer'), {
      target: { value: 'Capitals are cheaper than labour.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))

    expect(await screen.findByText('Prompt for q2', undefined, { timeout: 6000 })).toBeInTheDocument()
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
  })

  it('resumes on the first problem without a grade after a remount', async () => {
    await seedRun({ assessmentIds: ['a-1', 'a-2'], count: 2 })
    seedGrade('a-1', 'q1')
    const client = new FakeAssessmentClient()
    scriptSubmitting(client, {
      'a-1': assessment('a-1', 'mat-1', [question('q1', 'a-1', 'mat-1')]),
      'a-2': assessment('a-2', 'mat-1', [question('q2', 'a-2', 'mat-1')]),
    })

    renderRun(client)

    // The graded problem is behind us; the route param alone restored this.
    expect(await screen.findByText('Prompt for q2')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
  })

  it('shows a graded problem’s feedback when the learner navigates back to it', async () => {
    await seedRun({ assessmentIds: ['a-1', 'a-2'], count: 2 })
    seedGrade('a-1', 'q1', 1)
    const client = new FakeAssessmentClient()
    scriptSubmitting(client, {
      'a-1': assessment('a-1', 'mat-1', [question('q1', 'a-1', 'mat-1')]),
      'a-2': assessment('a-2', 'mat-1', [question('q2', 'a-2', 'mat-1')]),
    })

    renderRun(client)
    await screen.findByText('Prompt for q2')
    fireEvent.click(screen.getByRole('tab', { name: /Question 1/ }))

    expect(await screen.findByText('Good answer.')).toBeInTheDocument()
    // Graded → the taking UI is replaced by the review primitive, not a lie.
    expect(screen.queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry question' })).toBeInTheDocument()
  })

  it('shows honest processing copy while a problem is still generating', async () => {
    await seedRun({ assessmentIds: ['a-1'], count: 1 })
    const client = new FakeAssessmentClient()
    scriptSubmitting(client, { 'a-1': assessment('a-1', 'mat-1', [], 'generating') })

    renderRun(client)

    expect(await screen.findByText(/Generating problem 1/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument()
  })

  it('reports a problem the run declared but never generated', async () => {
    await seedRun({ assessmentIds: ['a-1'], count: 3 })
    const client = new FakeAssessmentClient()
    scriptSubmitting(client, {
      'a-1': assessment('a-1', 'mat-1', [question('q1', 'a-1', 'mat-1')]),
    })

    renderRun(client)

    expect(await screen.findByText(/2 problems were not generated/)).toBeInTheDocument()
  })

  it('labels each problem with the material it came from', async () => {
    await seedRun({ materialIds: ['mat-1', 'mat-2'], assessmentIds: ['a-1', 'a-2'], count: 2 })
    const client = new FakeAssessmentClient()
    scriptSubmitting(client, {
      'a-1': assessment('a-1', 'mat-1', [question('q1', 'a-1', 'mat-1')]),
      'a-2': assessment('a-2', 'mat-2', [question('q2', 'a-2', 'mat-2')]),
    })
    const materials = new FakeMaterialClient([
      material('mat-1', 'Operating Systems'),
      material('mat-2', 'Database Internals'),
    ])

    renderRun(client, materials)

    expect(await screen.findByText('from Operating Systems')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Question 2/ }))
    expect(await screen.findByText('from Database Internals')).toBeInTheDocument()
  })

  it('does not show an abandoned run as complete', async () => {
    await seedRun({ assessmentIds: ['a-1'], count: 1 }, { runId: 'run-1', outcome: 'abandoned' })
    const client = new FakeAssessmentClient()
    scriptSubmitting(client, {
      'a-1': assessment('a-1', 'mat-1', [question('q1', 'a-1', 'mat-1')]),
    })

    renderRun(client)

    expect(await screen.findByText(/Run abandoned/)).toBeInTheDocument()
    expect(screen.queryByText(/^Run complete/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finish run' })).not.toBeInTheDocument()
  })

  it('finishes only when every problem has a grade, and records the outcome', async () => {
    await seedRun({ assessmentIds: ['a-1'], count: 1 })
    seedGrade('a-1', 'q1')
    const client = new FakeAssessmentClient()
    scriptSubmitting(client, {
      'a-1': assessment('a-1', 'mat-1', [question('q1', 'a-1', 'mat-1')]),
    })

    renderRun(client)

    // The restored grade has to hydrate before the run can read as finished.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Finish run' })).toBeEnabled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Finish run' }))

    expect(await screen.findByText(/Run complete · 1 of 1 graded/)).toBeInTheDocument()
    const store = createEventStore(USER)
    const finished = (await store.getAll()).filter(
      (event) => event.kind === PRACTICE_RUN_FINISHED,
    )
    store.close()
    expect(finished).toHaveLength(1)
    expect(finished[0].payload).toEqual({ runId: 'run-1', outcome: 'completed' })
  })

  it('does not offer to finish a run that still has ungraded problems', async () => {
    await seedRun({ assessmentIds: ['a-1', 'a-2'], count: 2 })
    const client = new FakeAssessmentClient()
    scriptSubmitting(client, {
      'a-1': assessment('a-1', 'mat-1', [question('q1', 'a-1', 'mat-1')]),
      'a-2': assessment('a-2', 'mat-1', [question('q2', 'a-2', 'mat-1')]),
    })

    renderRun(client)

    await screen.findByText('Prompt for q1')
    expect(screen.getByRole('button', { name: 'Finish run' })).toBeDisabled()
  })

  it('abandons the run with an explicit control and records that outcome', async () => {
    await seedRun({ assessmentIds: ['a-1'], count: 1 })
    const client = new FakeAssessmentClient()
    scriptSubmitting(client, {
      'a-1': assessment('a-1', 'mat-1', [question('q1', 'a-1', 'mat-1')]),
    })

    renderRun(client)
    fireEvent.click(await screen.findByRole('button', { name: 'Abandon run' }))

    expect(await screen.findByText(/Run abandoned/)).toBeInTheDocument()
    const store = createEventStore(USER)
    const finished = (await store.getAll()).filter(
      (event) => event.kind === PRACTICE_RUN_FINISHED,
    )
    store.close()
    expect(finished).toHaveLength(1)
    expect(finished[0].payload).toEqual({ runId: 'run-1', outcome: 'abandoned' })
  })

  it('drains queued attempts on reconnect — the shell owns the drain, not each taker', async () => {
    await seedRun({ assessmentIds: ['a-1'], count: 1 })
    const client = new FakeAssessmentClient()
    scriptSubmitting(
      client,
      { 'a-1': assessment('a-1', 'mat-1', [question('q1', 'a-1', 'mat-1')]) },
      { failSubmits: 1 },
    )

    renderRun(client)
    await screen.findByText('Prompt for q1')
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'Offline answer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))

    expect(await screen.findByText(/Queued offline/)).toBeInTheDocument()
    const firstAttemptId = client.submitAssessmentAttempt.mock.calls[0][2].clientAttemptId

    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(client.submitAssessmentAttempt).toHaveBeenCalledTimes(2)
    })
    // The drain replays the same identity, never a fresh attempt (AC2).
    expect(client.submitAssessmentAttempt.mock.calls[1][2].clientAttemptId).toBe(firstAttemptId)
  })

  it('says so plainly when the runId is not in this device’s log', async () => {
    const client = new FakeAssessmentClient()

    renderRun(client, undefined, 'run-nope')

    expect(await screen.findByText(/could not be found on this device/i)).toBeInTheDocument()
  })
})
