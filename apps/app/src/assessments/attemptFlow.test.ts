// #39 Phase 4: attempt flow tests — the AC2/AC4 heart.
// Covers: submit flow (local row + QuestionAttempted event + submit + patch),
// grade flow (poll + QuestionGraded event + local update), offline queue
// drain on reconnect, retry = fresh attempt identity, and cache read/write.

import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { EventStore, QUESTION_ATTEMPTED, QUESTION_GRADED } from '../events/EventStore'
import type { Event } from '../events/EventStore'
import {
  createAttemptFlow,
  type AssessmentAttemptsDexie,
  type LocalAttemptRow,
} from './attemptFlow'
import { AssessmentClient } from './assessmentClient'
import type { AssessmentFetchLike } from './assessmentClient'
import type { AttemptRecord, Assessment, Question } from './types'

class FetchDouble implements AssessmentFetchLike {
  constructor(
    private readonly responder: (path: string, init?: RequestInit) => unknown,
    public readonly calls: Array<{ path: string; init?: RequestInit }> = [],
  ) {}
  async fetchJson(path: string, init?: RequestInit): Promise<unknown> {
    this.calls.push({ path, init })
    return this.responder(path, init)
  }
}

const ASSESSMENT: Assessment = {
  id: 'ass-1',
  ownerId: 'user-1',
  materialIds: ['mat-1'],
  status: 'ready',
  questions: [
    {
      id: 'q-1',
      assessmentId: 'ass-1',
      materialId: 'mat-1',
      format: 'objective',
      prompt: 'Which?',
      options: ['A', 'B', 'C'],
      skillTags: ['Caching'],
      authoredDifficulty: 2,
      citations: [],
    },
  ],
  warnings: [],
  groundingStale: false,
  createdAt: '2026-09-03T09:00:00Z',
}

const GRADE = {
  attemptId: 'att-server-1',
  questionId: 'q-1',
  materialId: 'mat-1',
  score: 0,
  correct: false,
  perSkill: [{ skillTag: 'Caching', score: 0, correct: false }],
  grader: 'objective' as const,
  gradedAt: '2026-09-03T10:05:00Z',
  publicFeedback: 'Not correct.',
}

const WRITTEN_QUESTION: Question = {
  id: 'q-written-1',
  assessmentId: 'ass-1',
  materialId: 'mat-1',
  format: 'written',
  subtype: 'long_form',
  prompt: 'Explain how bias correction changes the first update steps.',
  options: [],
  skillTags: ['Optimization'],
  authoredDifficulty: 4,
  citations: [],
}

const WRITTEN_ASSESSMENT: Assessment = { ...ASSESSMENT, questions: [WRITTEN_QUESTION] }

const WRITTEN_TEXT =
  'Adam keeps a running average of the gradient and of the squared gradient, so early estimates are pulled toward zero.'

const WRITTEN_GRADE = {
  attemptId: 'att-written-1',
  questionId: 'q-written-1',
  materialId: 'mat-1',
  score: 0.75,
  correct: true,
  perSkill: [{ skillTag: 'Optimization', score: 0.75, correct: true }],
  explanation: 'You named both running estimates.',
  grader: 'llm_rubric' as const,
  gradedAt: '2026-09-10T10:05:00Z',
  rubricBreakdown: [
    { criterion: 'Names both moment estimates', weight: 0.4, score: 1, met: true, feedback: 'Both averages identified.' },
    { criterion: 'Explains the early-step effect', weight: 0.6, score: 0.5833, met: false, feedback: 'Mechanism not explained.' },
  ],
}

function harness(
  responder: (path: string, init?: RequestInit) => unknown,
  dbName = 'StudyTrackerAttemptFlowTest',
) {
  const db = new Dexie(dbName) as AssessmentAttemptsDexie
  db.version(1).stores({
    events: '++id, kind, createdAt',
    assessmentAttempts: 'clientAttemptId, attemptId, questionId, assessmentId, status, submittedAt',
    assessmentContentCache: 'assessmentId',
  })
  const store = new EventStore(db)
  const fetchDouble = new FetchDouble(responder)
  // The flow's transport seam is AssessmentClientLike.transport — the real
  // client plus an AssessmentFetchLike responder double (no hidden fetches).
  const client = new AssessmentClient(fetchDouble)
  const flow = createAttemptFlow({
    db,
    eventStore: store,
    transport: client.transport,
    now: () => '2026-09-03T10:00:00Z',
    uuid: (() => {
      let n = 0
      return (prefix: string) => `${prefix}-${++n}`
    })() as <T extends string>(prefix: T) => `${T}-${number}`,
  })
  return { db, store, flow, fetchDouble }
}

async function loggedKinds(store: EventStore): Promise<string[]> {
  const events: Event[] = await store.getAll()
  return events.map((event) => event.kind)
}

describe('submitObjectiveAttempt', () => {
  let db: AssessmentAttemptsDexie
  let store: EventStore
  let flow: ReturnType<typeof createAttemptFlow>
  let fetchDouble: FetchDouble

  beforeEach(() => {
    const harnessResult = harness((path) => {
      if (path.endsWith('/attempts')) {
        return { attemptId: 'att-server-1', questionId: 'q-1', status: 'queued', jobId: 'job-1' }
      }
      throw new Error('unexpected path: ' + path)
    })
    db = harnessResult.db
    store = harnessResult.store
    flow = harnessResult.flow
    fetchDouble = harnessResult.fetchDouble
  })

  it('records the local row, appends the answer-free event, submits, and patches ids', async () => {
    const result = await flow.submitObjectiveAttempt(ASSESSMENT, ASSESSMENT.questions[0], {
      index: 2,
    })

    expect(result.local.clientAttemptId).toMatch(/^ca-/)
    expect(result.local.attemptId).toBe('att-server-1')
    expect(result.created?.jobId).toBe('job-1')

    const rows: LocalAttemptRow[] = await db.table('assessmentAttempts').toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].answer).toEqual({ index: 2 })
    expect(rows[0].status).toBe('submitted')

    const kinds = await loggedKinds(store)
    expect(kinds).toContain(QUESTION_ATTEMPTED)
    const events = await store.getAll()
    const attempted = events.find((event) => event.kind === QUESTION_ATTEMPTED)
    expect(attempted?.payload).not.toHaveProperty('answer')
    expect(attempted?.payload.attemptId).toBe('att-server-1')

    expect(fetchDouble.calls).toHaveLength(1)
    expect(fetchDouble.calls[0].path).toBe('/v1/assessments/ass-1/questions/q-1/attempts')
    await db.delete()
  })

  it('keeps the row queued locally when the submit request fails offline', async () => {
    const failing = harness(() => {
      throw new TypeError('network down')
    })
    db = failing.db
    store = failing.store
    flow = failing.flow

    const result = await flow.submitObjectiveAttempt(ASSESSMENT, ASSESSMENT.questions[0], {
      index: 1,
    })
    expect(result.online).toBe(false)
    const rows: LocalAttemptRow[] = await db.table('assessmentAttempts').toArray()
    expect(rows[0].status).toBe('queued')
    expect(rows[0].submitError).toBeTruthy()
    await db.delete()
  })
})

describe('drainQueuedAttempts (offline → reconnect, AC4)', () => {
  it('resubmits queued rows with the same clientAttemptId and grades them', async () => {
    const submittedClients: string[] = []
    const { db, store, flow } = harness((path, init) => {
      if (path.endsWith('/attempts') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        submittedClients.push(body.clientAttemptId)
        return { attemptId: 'att-server-9', questionId: body.questionId, status: 'queued', jobId: 'job-9' }
      }
      if (path.includes('/attempts') && init?.method === undefined) {
        return [
          {
            attemptId: 'att-server-9',
            clientAttemptId: 'ca-1',
            questionId: 'q-1',
            assessmentId: 'ass-1',
            submittedAt: '2026-09-03T10:00:00Z',
            status: 'graded',
            grade: GRADE,
          },
        ] satisfies AttemptRecord[]
      }
      throw new Error('unexpected call: ' + path)
    })

    // Simulate an earlier offline submit: local row exists, event logged, no server ids.
    await db.table('assessmentAttempts').add({
      clientAttemptId: 'ca-1',
      attemptId: null,
      questionId: 'q-1',
      assessmentId: 'ass-1',
      answer: { index: 0 },
      status: 'queued',
      submittedAt: '2026-09-03T10:00:00Z',
    })
    await store.append(QUESTION_ATTEMPTED, {
      attemptId: '',
      clientAttemptId: 'ca-1',
      questionId: 'q-1',
      submittedAt: '2026-09-03T10:00:00Z',
      answerKind: 'objective',
    })

    const report = await flow.drainQueuedAttempts(ASSESSMENT)
    expect(report.submitted).toBe(1)
    expect(report.graded).toBe(1)
    expect(submittedClients).toEqual(['ca-1']) // same identity retried, not a new attempt

    const rows: LocalAttemptRow[] = await db.table('assessmentAttempts').toArray()
    expect(rows[0].status).toBe('graded')
    expect(rows[0].attemptId).toBe('att-server-9')
    expect(rows[0].grade?.publicFeedback).toBe('Not correct.')
    const kinds = await loggedKinds(store)
    expect(kinds).toContain(QUESTION_GRADED)
    await db.delete()
  })

  it('leaves rows queued when still offline', async () => {
    const { db, flow } = harness(() => {
      throw new TypeError('still offline')
    })
    await db.table('assessmentAttempts').add({
      clientAttemptId: 'ca-2',
      attemptId: null,
      questionId: 'q-1',
      assessmentId: 'ass-1',
      answer: { index: 1 },
      status: 'queued',
      submittedAt: '2026-09-03T10:00:00Z',
    })
    const report = await flow.drainQueuedAttempts(ASSESSMENT)
    expect(report.submitted).toBe(0)
    const rows: LocalAttemptRow[] = await db.table('assessmentAttempts').toArray()
    expect(rows[0].status).toBe('queued')
    await db.delete()
  })
})

describe('retry identity (AC2)', () => {
  it('a retry mints a fresh clientAttemptId row and keeps the prior attempt', async () => {
    const { db, flow } = harness((path) => {
      if (path.endsWith('/attempts')) {
        return { attemptId: 'att-server-2', questionId: 'q-1', status: 'queued', jobId: 'job-2' }
      }
      throw new Error('unexpected path')
    })

    await flow.submitObjectiveAttempt(ASSESSMENT, ASSESSMENT.questions[0], { index: 0 })
    await flow.submitObjectiveAttempt(ASSESSMENT, ASSESSMENT.questions[0], { index: 2 })

    const rows: LocalAttemptRow[] = await db.table('assessmentAttempts').toArray()
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map((row) => row.clientAttemptId)).size).toBe(2)
    expect(rows[0].answer).toEqual({ index: 0 })
    expect(rows[1].answer).toEqual({ index: 2 })
    await db.delete()
  })
})

describe('refreshAttempts (server as durable attempt record)', () => {
  it('merges server records into the local table without touching local answers', async () => {
    const { db, flow } = harness(() => [
      {
        attemptId: 'att-server-5',
        clientAttemptId: 'ca-remote',
        questionId: 'q-1',
        assessmentId: 'ass-1',
        submittedAt: '2026-09-03T10:00:00Z',
        status: 'graded',
        // #40 D-01: the read route echoes the learner's own answer.
        answer: { index: 2 },
        grade: GRADE,
      },
    ])
    await db.table('assessmentAttempts').add({
      clientAttemptId: 'ca-local',
      attemptId: null,
      questionId: 'q-1',
      assessmentId: 'ass-1',
      answer: { index: 1 },
      status: 'queued',
      submittedAt: '2026-09-03T10:01:00Z',
    })

    await flow.refreshAttempts(ASSESSMENT)
    const rows: LocalAttemptRow[] = await db.table('assessmentAttempts').toArray()
    expect(rows).toHaveLength(2)
    const remote = rows.find((row) => row.clientAttemptId === 'ca-remote')
    expect(remote?.grade?.score).toBe(0)
    expect(remote?.answer).toEqual({ index: 2 }) // echoed answer restores the pick
    const local = rows.find((row) => row.clientAttemptId === 'ca-local')
    expect(local?.answer).toEqual({ index: 1 }) // local answer untouched
    await db.delete()
  })

  it('leaves restored rows answer-free when the server record carries none', async () => {
    const { db, flow } = harness(() => [
      {
        attemptId: 'att-server-6',
        clientAttemptId: 'ca-legacy',
        questionId: 'q-1',
        assessmentId: 'ass-1',
        submittedAt: '2026-09-03T10:00:00Z',
        status: 'graded',
        grade: GRADE,
      },
    ])

    await flow.refreshAttempts(ASSESSMENT)
    const rows: LocalAttemptRow[] = await db.table('assessmentAttempts').toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].answer).toBeUndefined() // pre-echo row: honest fallback, no pick
    await db.delete()
  })
})

describe('assessmentContentCache (AC1)', () => {
  it('caches the envelope verbatim and reads it back', async () => {
    const { db, flow } = harness(() => ASSESSMENT)
    await flow.cacheAssessment(ASSESSMENT)
    const cached = await flow.cachedAssessment('ass-1')
    expect(cached?.id).toBe('ass-1')
    expect(cached?.questions).toHaveLength(1)
    const raw = await db.table('assessmentContentCache').get('ass-1')
    expect(JSON.stringify(raw)).not.toContain('answerBlock')
    expect(JSON.stringify(raw)).not.toContain('correctIndex')
    await db.delete()
  })
})

describe('submitWrittenAttempt (D-02)', () => {
  it('sends { text } and keeps the learner text on the local row', async () => {
    await Dexie.delete('AttemptFlowWrittenSubmitTest')
    const bodies: Array<Record<string, unknown>> = []
    const { db, store, flow, fetchDouble } = harness((path, init) => {
      if (path.endsWith('/attempts') && init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return {
          attemptId: 'att-written-server-1',
          questionId: 'q-written-1',
          status: 'queued',
          jobId: 'job-written-1',
        }
      }
      throw new Error('unexpected path: ' + path)
    }, 'AttemptFlowWrittenSubmitTest')

    const result = await flow.submitWrittenAttempt(WRITTEN_ASSESSMENT, WRITTEN_QUESTION, WRITTEN_TEXT)

    expect(result.online).toBe(true)
    expect(bodies).toHaveLength(1)
    expect(bodies[0].answer).toEqual({ text: WRITTEN_TEXT })
    expect(result.local.answer).toEqual({ text: WRITTEN_TEXT })

    const rows: LocalAttemptRow[] = await db.table('assessmentAttempts').toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].answer).toEqual({ text: WRITTEN_TEXT })
    expect(rows[0].status).toBe('submitted')

    // The durable event stays answer-free: only the row and the server carry text.
    const attempted = (await store.getAll()).find((event) => event.kind === QUESTION_ATTEMPTED)
    expect(attempted?.payload).not.toHaveProperty('answer')
    expect(attempted?.payload.answerKind).toBe('written')
    expect(fetchDouble.calls[0].path).toBe('/v1/assessments/ass-1/questions/q-written-1/attempts')
    await db.delete()
  })

  it('refuses blank text client-side without touching Dexie or the wire', async () => {
    await Dexie.delete('AttemptFlowWrittenBlankTest')
    const { db, flow, fetchDouble } = harness(() => {
      throw new Error('transport must not be called for a blank written answer')
    }, 'AttemptFlowWrittenBlankTest')

    await expect(flow.submitWrittenAttempt(WRITTEN_ASSESSMENT, WRITTEN_QUESTION, '   ')).rejects.toThrow(
      /write an answer/i,
    )

    const rows: LocalAttemptRow[] = await db.table('assessmentAttempts').toArray()
    expect(rows).toHaveLength(0)
    expect(fetchDouble.calls).toHaveLength(0)
    await db.delete()
  })

  it('refuses text over the contract budget client-side', async () => {
    await Dexie.delete('AttemptFlowWrittenOversizedTest')
    const { db, flow, fetchDouble } = harness(() => {
      throw new Error('transport must not be called for an oversized written answer')
    }, 'AttemptFlowWrittenOversizedTest')

    await expect(
      flow.submitWrittenAttempt(WRITTEN_ASSESSMENT, WRITTEN_QUESTION, 'x'.repeat(20001)),
    ).rejects.toThrow(/limited to 20000/i)

    expect(await db.table('assessmentAttempts').toArray()).toHaveLength(0)
    expect(fetchDouble.calls).toHaveLength(0)
    await db.delete()
  })
})

describe('refreshAttempts written echo (D-02)', () => {
  it('adopts the server-echoed written answer on a fresh device', async () => {
    await Dexie.delete('AttemptFlowWrittenEchoTest')
    const { db, flow } = harness(() => [
      {
        attemptId: 'att-written-1',
        clientAttemptId: 'ca-written-remote',
        questionId: 'q-written-1',
        assessmentId: 'ass-1',
        submittedAt: '2026-09-10T10:00:00Z',
        status: 'graded',
        answer: { text: WRITTEN_TEXT },
        grade: WRITTEN_GRADE,
      },
    ] satisfies AttemptRecord[], 'AttemptFlowWrittenEchoTest')

    await flow.refreshAttempts(WRITTEN_ASSESSMENT)

    const rows: LocalAttemptRow[] = await db.table('assessmentAttempts').toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].answer).toEqual({ text: WRITTEN_TEXT }) // restore keeps the learner's own text
    expect(rows[0].grade?.rubricBreakdown).toHaveLength(2)
    expect(JSON.stringify(rows[0].grade)).not.toMatch(/referenceAnswer|rubricVersion|maxPoints/i)
    await db.delete()
  })
})
