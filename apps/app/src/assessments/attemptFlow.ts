/**
 * Attempt flow for assessment taking (#39, PLAN D-05).
 *
 * The single place that coordinates: local attempt row (Dexie v6), the
 * answer-free QuestionAttempted event, the server submit call, grade
 * polling, the QuestionGraded event, offline queueing, and reconnect drain.
 * The answer exists in exactly two places: the server attempts table and the
 * local unsynced assessmentAttempts row — never in the event log (AC2).
 */

import type Dexie from 'dexie'
import { QUESTION_ATTEMPTED, QUESTION_GRADED } from '../events/EventStore'
import type { EventStore } from '../events/EventStore'
import type { QuestionAttemptedPayload, QuestionGradedPayload } from '../sync/types'
import { AssessmentServiceError } from './types'
import type {
  Assessment,
  AttemptCreated,
  AttemptRecord,
  AttemptSubmitInput,
  ObjectiveAnswer,
  Question,
  QuestionGradedResult,
} from './types'

/** One local attempt row — the only client-side home for the answer. */
export interface LocalAttemptRow {
  clientAttemptId: string
  /** Server-minted id, patched in after a successful submit; null while queued. */
  attemptId: string | null
  questionId: string
  assessmentId: string
  /** Present only on locally-created rows; server-merged rows carry none. */
  answer?: ObjectiveAnswer
  status: 'queued' | 'submitted' | 'graded' | 'failed'
  submittedAt: string
  elapsedSeconds?: number
  jobId?: string
  grade?: QuestionGradedResult | null
  submitError?: string
}

/** Dexie shape used here; structural subset of the real database. */
export type AssessmentAttemptsDexie = Dexie

export interface AttemptFlowDeps {
  db: Dexie
  eventStore: EventStore
  /** Submit/read transport; AssessmentClient satisfies this structurally. */
  transport: AttemptTransport
  now?: () => string
  uuid?: (prefix: string) => string
}

/** Narrow transport the flow needs (rule 22: DI over hidden fetches). */
export interface AttemptTransport {
  submitAttempt(
    assessmentId: string,
    questionId: string,
    input: Omit<AttemptSubmitInput, 'questionId'>,
  ): Promise<AttemptCreated>
  listAttempts(assessmentId: string): Promise<AttemptRecord[]>
}

export interface SubmitResult {
  local: LocalAttemptRow
  created: AttemptCreated | null
  /** False when the submit call failed (row stays queued for the drain). */
  online: boolean
}

export interface DrainReport {
  attempted: number
  submitted: number
  graded: number
}

const GRADE_POLL_ATTEMPTS = 20
const GRADE_POLL_INTERVAL_MS = 1000

function defaultUuid(prefix: string): string {
  const random = crypto.randomUUID().slice(0, 8)
  return `${prefix}-${random}`
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createAttemptFlow(deps: AttemptFlowDeps) {
  const {
    db,
    eventStore,
    transport,
    now = () => new Date().toISOString(),
    uuid = defaultUuid,
  } = deps

  const attempts = () => db.table('assessmentAttempts')
  const cache = () => db.table('assessmentContentCache')

  async function submitAssessmentAttempt(
    assessmentId: string,
    questionId: string,
    input: Omit<AttemptSubmitInput, 'questionId'>,
  ): Promise<AttemptCreated> {
    return transport.submitAttempt(assessmentId, questionId, input)
  }

  async function listAssessmentAttempts(assessmentId: string): Promise<AttemptRecord[]> {
    return transport.listAttempts(assessmentId)
  }

  /**
   * Take one objective question: local row → QuestionAttempted (no answer) →
   * server submit (idempotent on clientAttemptId) → patch server ids.
   */
  async function submitObjectiveAttempt(
    assessment: Assessment,
    question: Question,
    answer: ObjectiveAnswer,
    elapsedSeconds?: number,
  ): Promise<SubmitResult> {
    const clientAttemptId = uuid('ca')
    const submittedAt = now()
    const row: LocalAttemptRow = {
      clientAttemptId,
      attemptId: null,
      questionId: question.id,
      assessmentId: assessment.id,
      answer,
      status: 'queued',
      submittedAt,
      elapsedSeconds,
    }
    await attempts().add(row)

    // Answer-free durable event (durable-events questionAttemptedPayload).
    const attemptedPayload: QuestionAttemptedPayload = {
      attemptId: '', // server-minted; patched by the grade flow / refresh
      clientAttemptId,
      questionId: question.id,
      submittedAt,
      answerKind: question.format,
      ...(elapsedSeconds != null ? { elapsedSeconds } : {}),
    }
    await eventStore.append(QUESTION_ATTEMPTED, attemptedPayload as unknown as Record<string, unknown>)

    const input: Omit<AttemptSubmitInput, 'questionId'> = {
      clientAttemptId,
      answer,
      submittedAt,
      correlationId: uuid('corr'),
      ...(elapsedSeconds != null ? { elapsedSeconds } : {}),
    }
    try {
      const created = await submitAssessmentAttempt(assessment.id, question.id, input)
      await attempts().update(clientAttemptId, {
        attemptId: created.attemptId,
        jobId: created.jobId,
        status: 'submitted',
        submitError: undefined,
      })
      // Keep the durable event pointer honest now that the server id exists.
      await patchAttemptedEvent(clientAttemptId, created.attemptId)
      const local = (await attempts().get(clientAttemptId)) as LocalAttemptRow
      return { local, created, online: true }
    } catch (err) {
      const message = err instanceof AssessmentServiceError ? err.message : String(err)
      await attempts().update(clientAttemptId, { submitError: message })
      // Row stays 'queued': drainQueuedAttempts resubmits it on reconnect.
      const local = (await attempts().get(clientAttemptId)) as LocalAttemptRow
      return { local, created: null, online: false }
    }
  }

  async function patchAttemptedEvent(clientAttemptId: string, attemptId: string) {
    const events = (await eventStore.getAll()).filter(
      (event) =>
        event.kind === QUESTION_ATTEMPTED &&
        (event.payload as unknown as QuestionAttemptedPayload).clientAttemptId === clientAttemptId,
    )
    const event = events[events.length - 1]
    if (!event?.id) return
    await eventStore
      .table('events')
      .update(event.id, {
        payload: { ...(event.payload as unknown as QuestionAttemptedPayload), attemptId },
      })
  }

  /**
   * Poll the attempts read route until this attempt's grade lands, then
   * record it locally (row + QuestionGraded event). Best-effort: a timeout
   * leaves the row 'submitted' and refreshAttempts picks the grade up later.
   */
  async function pollGrade(clientAttemptId: string, assessmentId: string): Promise<LocalAttemptRow> {
    for (let attempt = 0; attempt < GRADE_POLL_ATTEMPTS; attempt++) {
      try {
        const records = await listAssessmentAttempts(assessmentId)
        const match = records.find((record) => record.clientAttemptId === clientAttemptId)
        if (match?.grade) {
          const graded = await recordGrade(match, null)
          return graded
        }
        if (match && match.status === 'failed' && !match.grade) {
          const failed = await recordGrade(
            match,
            {
              attemptId: match.attemptId,
              questionId: match.questionId,
              materialId: '',
              score: 0,
              correct: false,
              perSkill: [],
              grader: 'objective',
              gradedAt: now(),
              publicFeedback: 'Attempt ungradable.',
            } satisfies QuestionGradedResult,
          )
          return failed
        }
      } catch {
        // transient read failure — keep polling until the budget is spent
      }
      await wait(GRADE_POLL_INTERVAL_MS)
    }
    const row = (await attempts().get(clientAttemptId)) as LocalAttemptRow | undefined
    return row ?? { ...EMPTY_ROW, clientAttemptId }
  }

  const EMPTY_ROW: LocalAttemptRow = {
    clientAttemptId: '',
    attemptId: null,
    questionId: '',
    assessmentId: '',
    answer: {},
    status: 'submitted',
    submittedAt: '',
  }

  /** Record a grade: update the local row + append QuestionGraded once. */
  async function recordGrade(
    record: AttemptRecord,
    _unused: QuestionGradedResult | null,
  ): Promise<LocalAttemptRow> {
    const grade = record.grade
    await attempts().update(record.clientAttemptId, {
      attemptId: record.attemptId,
      status: record.status,
      grade,
    })
    if (grade) {
      const existing = (await eventStore.getAll()).some(
        (event) =>
          event.kind === QUESTION_GRADED &&
          (event.payload as unknown as QuestionGradedPayload).attemptId === grade.attemptId,
      )
      if (!existing) {
        const payload: QuestionGradedPayload = {
          attemptId: grade.attemptId,
          questionId: grade.questionId,
          score: grade.score,
          correct: grade.correct,
          gradedAt: grade.gradedAt,
          grader: grade.grader,
          ...(grade.publicFeedback != null ? { publicFeedback: grade.publicFeedback } : {}),
        }
        await eventStore.append(QUESTION_GRADED, payload as unknown as Record<string, unknown>)
      }
    }
    const row = (await attempts().get(record.clientAttemptId)) as LocalAttemptRow
    return row
  }

  /**
   * Reconnect drain (AC4): resubmit every locally-queued attempt. The server
   * dedupes on clientAttemptId, so replaying after a mid-flight crash is
   * safe — the identity, not a new attempt, is what gets retried.
   */
  async function drainQueuedAttempts(assessment: Assessment): Promise<DrainReport> {
    const report: DrainReport = { attempted: 0, submitted: 0, graded: 0 }
    const queued = (await attempts()
      .where('assessmentId')
      .equals(assessment.id)
      .toArray()) as LocalAttemptRow[]
    for (const row of queued.filter((candidate) => candidate.status === 'queued')) {
      report.attempted++
      const question = assessment.questions.find((candidate) => candidate.id === row.questionId)
      if (!question) continue
      try {
        const created = await submitAssessmentAttempt(assessment.id, row.questionId, {
          clientAttemptId: row.clientAttemptId,
          answer: row.answer ?? {},
          submittedAt: row.submittedAt,
          correlationId: uuid('corr'),
          ...(row.elapsedSeconds != null ? { elapsedSeconds: row.elapsedSeconds } : {}),
        })
        await attempts().update(row.clientAttemptId, {
          attemptId: created.attemptId,
          jobId: created.jobId,
          status: 'submitted',
          submitError: undefined,
        })
        await patchAttemptedEvent(row.clientAttemptId, created.attemptId)
        report.submitted++
        const finalRow = (await attempts().get(row.clientAttemptId)) as LocalAttemptRow
        const records = await listAssessmentAttempts(assessment.id)
        const match = records.find(
          (record) => record.clientAttemptId === row.clientAttemptId,
        )
        if (match?.grade) {
          await recordGrade(match, null)
          report.graded++
        } else if (finalRow.jobId) {
          // Grade not ready yet; the poller/refresh will pick it up later.
        }
      } catch {
        // Still offline: leave this row queued for the next drain.
      }
    }
    return report
  }

  /**
   * Server records are the durable attempt history: merge them into the
   * local table (fresh device restore, late grades) without touching local
   * answers. Server rows carry no answer field.
   */
  async function refreshAttempts(assessment: Assessment): Promise<number> {
    let records: AttemptRecord[]
    try {
      records = await listAssessmentAttempts(assessment.id)
    } catch {
      return 0
    }
    let merged = 0
    for (const record of records) {
      const existing = (await attempts().get(record.clientAttemptId)) as
        | LocalAttemptRow
        | undefined
      if (existing) {
        if (
          existing.status !== record.status ||
          existing.attemptId !== record.attemptId ||
          existing.grade?.gradedAt !== (record.grade?.gradedAt ?? null)
        ) {
          await attempts().update(record.clientAttemptId, {
            attemptId: record.attemptId,
            status: record.status,
            grade: record.grade,
          })
        }
      } else {
        const row: LocalAttemptRow = {
          clientAttemptId: record.clientAttemptId,
          attemptId: record.attemptId,
          questionId: record.questionId,
          assessmentId: record.assessmentId,
          // no answer: server records carry none (the answer is write-only)
          status: record.status,
          submittedAt: record.submittedAt,
          ...(record.elapsedSeconds != null ? { elapsedSeconds: record.elapsedSeconds } : {}),
          grade: record.grade,
        }
        await attempts().add(row)
        merged++
      }
    }
    return merged
  }

  /** AC1: cache the redacted envelope + visible payload verbatim. */
  async function cacheAssessment(assessment: Assessment): Promise<void> {
    await cache().put({ assessmentId: assessment.id, envelope: assessment, cachedAt: now() })
  }

  async function cachedAssessment(assessmentId: string): Promise<Assessment | null> {
    const row = (await cache().get(assessmentId)) as
      | { assessmentId: string; envelope: Assessment }
      | undefined
    return row?.envelope ?? null
  }

  async function listLocalAttempts(assessmentId: string): Promise<LocalAttemptRow[]> {
    return (await attempts()
      .where('assessmentId')
      .equals(assessmentId)
      .toArray()) as LocalAttemptRow[]
  }

  return {
    submitObjectiveAttempt,
    pollGrade,
    drainQueuedAttempts,
    refreshAttempts,
    cacheAssessment,
    cachedAssessment,
    listLocalAttempts,
  }
}

export type AttemptFlow = ReturnType<typeof createAttemptFlow>
