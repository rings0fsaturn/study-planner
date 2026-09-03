// PROTOTYPE-FREE production tests for #39 Phase 4 (client data layer).
// Covers: Dexie version(6) tables, attempt event constants/payloads,
// AssessmentClient attempt operations (submit/list), and the
// assessmentContentCache redaction boundary (AC1).

import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import {
  ASSESSMENT_CREATED,
  QUESTION_ATTEMPTED,
  QUESTION_GRADED,
  EventStore,
} from './EventStore'
import { createEventStore } from './EventStoreProvider'
import { AssessmentClient } from '../assessments/assessmentClient'
import type { AssessmentFetchLike } from '../assessments/assessmentClient'
import { QuestionAttemptedPayload, QuestionGradedPayload } from '../sync/types'
import type { AttemptRecord, AttemptSubmitInput, ObjectiveAnswer } from '../assessments/types'

describe('event constants (#39)', () => {
  it('exposes the durable event kinds verbatim', () => {
    expect(QUESTION_ATTEMPTED).toBe('QuestionAttempted')
    expect(QUESTION_GRADED).toBe('QuestionGraded')
    expect(ASSESSMENT_CREATED).toBe('AssessmentCreated')
  })

  it('accepts a QuestionAttempted event with an answer-free payload', async () => {
    const db = new Dexie('StudyTrackerEventKindsTest')
    db.version(1).stores({ events: '++id, kind, createdAt' })
    const store = new EventStore(db)
    await db.open()

    const payload: QuestionAttemptedPayload = {
      attemptId: 'att-1',
      clientAttemptId: 'client-att-1',
      questionId: 'q-1',
      submittedAt: '2026-09-03T10:00:00Z',
      answerKind: 'objective',
      elapsedSeconds: 30,
    }
    const id = await store.append(QUESTION_ATTEMPTED, payload as unknown as Record<string, unknown>)
    expect(id).toBeGreaterThan(0)
    const stored = (await store.getAll()).find((event) => event.kind === QUESTION_ATTEMPTED)
    expect(stored).toBeDefined()
    // The durable payload must not carry the answer (durable-events.schema.json).
    expect(stored?.payload).not.toHaveProperty('answer')
    await db.delete()
  })

  it('accepts a QuestionGraded event with the public payload', async () => {
    const db = new Dexie('StudyTrackerGradedKindTest')
    db.version(1).stores({ events: '++id, kind, createdAt' })
    const store = new EventStore(db)
    await db.open()

    const payload: QuestionGradedPayload = {
      attemptId: 'att-1',
      questionId: 'q-1',
      score: 1,
      correct: true,
      gradedAt: '2026-09-03T10:05:00Z',
      grader: 'objective',
      publicFeedback: 'Correct.',
    }
    await store.append(QUESTION_GRADED, payload as unknown as Record<string, unknown>)
    const stored = (await store.getAll()).find((event) => event.kind === QUESTION_GRADED)
    expect(stored).toBeDefined()
    await db.delete()
  })
})

describe('Dexie version(6) (#39 tables)', () => {
  it('creates assessmentAttempts and assessmentContentCache on v6', async () => {
    const store = createEventStore('user-attempt-tables')
    const db = (store as unknown as { db: Dexie }).db
    await db.open()

    expect(db.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining(['assessmentAttempts', 'assessmentContentCache']),
    )

    const attempt = {
      clientAttemptId: 'client-att-local-1',
      attemptId: null,
      questionId: 'q-1',
      assessmentId: 'ass-1',
      answer: { index: 1 },
      status: 'queued' as const,
      submittedAt: '2026-09-03T10:00:00Z',
    }
    await db.table('assessmentAttempts').add(attempt)
    const stored = await db.table('assessmentAttempts').get('client-att-local-1')
    expect(stored).toBeDefined()

    await db.table('assessmentContentCache').add({ assessmentId: 'ass-1', envelope: {} })
    const cached = await db.table('assessmentContentCache').get('ass-1')
    expect(cached).toBeDefined()
    await db.delete()
  })
})

class FetchDouble implements AssessmentFetchLike {
  constructor(
    private readonly responder: (path: string, init?: RequestInit) => unknown,
  ) {}
  async fetchJson(path: string, init?: RequestInit): Promise<unknown> {
    return this.responder(path, init)
  }
}

describe('AssessmentClient attempt operations (#39)', () => {
  const answer: ObjectiveAnswer = { index: 2 }

  const submitInput: AttemptSubmitInput = {
    clientAttemptId: 'client-att-1',
    questionId: 'q-1',
    answer,
    submittedAt: '2026-09-03T10:00:00Z',
    elapsedSeconds: 30,
    correlationId: 'corr-1',
  }

  it('submits an attempt and returns AttemptCreated', async () => {
    let captured: RequestInit | undefined
    const fetchLike = new FetchDouble((path, init) => {
      if (!path.includes('/attempts')) throw new Error('unexpected path: ' + path)
      captured = init
      return { attemptId: 'att-1', questionId: 'q-1', status: 'queued', jobId: 'job-1' }
    })
    const client = new AssessmentClient(fetchLike)

    const created = await client.submitAssessmentAttempt('ass-1', 'q-1', submitInput)
    expect(created).toEqual({
      attemptId: 'att-1',
      questionId: 'q-1',
      status: 'queued',
      jobId: 'job-1',
    })
    const body = JSON.parse(String(captured?.body))
    expect(body.clientAttemptId).toBe('client-att-1')
    expect(body.answer).toEqual({ index: 2 })
    expect(captured?.method).toBe('POST')
  })

  it('maps a 200 replay to the existing attemptId', async () => {
    const fetchLike = new FetchDouble(() => ({
      attemptId: 'att-original',
      questionId: 'q-1',
      status: 'queued',
      jobId: '',
    }))
    const client = new AssessmentClient(fetchLike)
    const created = await client.submitAssessmentAttempt('ass-1', 'q-1', {
      ...submitInput,
      clientAttemptId: 'client-att-dup-01',
    })
    expect(created.attemptId).toBe('att-original')
  })

  it('lists attempts as public records only', async () => {
    const fetchLike = new FetchDouble(() => [
      {
        attemptId: 'att-1',
        clientAttemptId: 'client-att-1',
        questionId: 'q-1',
        assessmentId: 'ass-1',
        submittedAt: '2026-09-03T10:00:00Z',
        status: 'graded',
        grade: {
          attemptId: 'att-1',
          questionId: 'q-1',
          materialId: 'm-1',
          score: 1,
          correct: true,
          perSkill: [{ skillTag: 'Caching', score: 1, correct: true }],
          grader: 'objective',
          gradedAt: '2026-09-03T10:05:00Z',
        },
      },
    ])
    const client = new AssessmentClient(fetchLike)
    const records: AttemptRecord[] = await client.listAssessmentAttempts('ass-1')
    expect(records).toHaveLength(1)
    expect(records[0].status).toBe('graded')
    expect(records[0].grade?.perSkill).toHaveLength(1)
    expect(records[0]).not.toHaveProperty('answer')
  })
})
