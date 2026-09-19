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
import {
  AssessmentServiceError,
  CODING_MEMORY_DEFAULT_MB,
  CODING_MEMORY_MAX_MB,
  CODING_MEMORY_MIN_MB,
  CODING_SOURCE_MAX_LENGTH,
  CODING_STDIN_MAX_LENGTH,
  CODING_TIME_LIMIT_DEFAULT_MS,
  CODING_TIME_LIMIT_MAX_MS,
  CODING_TIME_LIMIT_MIN_MS,
  WRITTEN_ANSWER_MAX_LENGTH,
} from './types'
import type {
  Assessment,
  AttemptCreated,
  AttemptRecord,
  AttemptSubmitInput,
  CodingAnswer,
  LearnerAnswer,
  ObjectiveAnswer,
  Question,
  QuestionGradedResult,
} from './types'

/** One local attempt row — the client-side home for the answer. */
export interface LocalAttemptRow {
  clientAttemptId: string
  /** Server-minted id, patched in after a successful submit; null while queued. */
  attemptId: string | null
  questionId: string
  assessmentId: string
  /** Local answer, or the server-echoed answer on restored rows (#40 D-01). */
  answer?: LearnerAnswer
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

/**
 * Client mirror of the server written-answer gate (P2 deviation e): blank or
 * whitespace-only text and text over the contract budget never leave the
 * browser. Returns the honest reason, or null when the text is submittable.
 */
export function writtenAnswerProblem(text: string): string | null {
  if (text.trim().length === 0) return 'Write an answer before submitting.'
  if (text.length > WRITTEN_ANSWER_MAX_LENGTH) {
    return `Written answers are limited to ${WRITTEN_ANSWER_MAX_LENGTH} characters.`
  }
  return null
}

/**
 * Client mirror of the server coding-answer gate (#42, the
 * `writtenAnswerProblem` precedent): empty source and over-budget
 * caps never leave the browser. Returns the honest reason, or null when
 * the source is submittable. `stdin` is client-advisory only - the server
 * never feeds it into the authored tests.
 */
export function codingAnswerProblem(source: string): string | null {
  if (source.trim().length === 0) return 'Write code before submitting.'
  if (source.length > CODING_SOURCE_MAX_LENGTH) {
    return `Code submissions are limited to ${CODING_SOURCE_MAX_LENGTH} characters.`
  }
  return null
}

/** Defaults a coding submission opens with (the sandbox ceilings, #42 D-05). */
export function defaultCodingConfig(): CodingAnswer['config'] {
  return {
    stdin: '',
    timeLimitMs: CODING_TIME_LIMIT_DEFAULT_MS,
    memoryLimitMb: CODING_MEMORY_DEFAULT_MB,
  }
}

/**
 * The one shape Python's `float()` accepts that the server's numeric
 * comparison can use: sign, digits, optional exponent. The generated
 * `acceptedValue` is numeric-only (P3), so anything else fails closed
 * server-side - this gate keeps that failure out of the queue.
 */
const NUMERIC_PREDICTION = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/

/**
 * Client mirror of the output_prediction gate (#42 D-01): the fourth coding
 * subtype is a numeric value match, not a sandbox run, and a blank or
 * non-numeric prediction never leaves the browser.
 */
export function predictionAnswerProblem(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return 'Predict the output before submitting.'
  if (!NUMERIC_PREDICTION.test(trimmed)) {
    return 'Enter the numeric output the snippet prints.'
  }
  return null
}

/**
 * Guard the learner-tunable config against the contract caps before submit
 * (defensive - the taker's number inputs already clamp this range).
 */
export function codingConfigProblem(config: CodingAnswer['config']): string | null {
  if (typeof config.stdin !== 'string' || config.stdin.length > CODING_STDIN_MAX_LENGTH) {
    return `Standard input is limited to ${CODING_STDIN_MAX_LENGTH} characters.`
  }
  if (
    !Number.isInteger(config.timeLimitMs) ||
    config.timeLimitMs < CODING_TIME_LIMIT_MIN_MS ||
    config.timeLimitMs > CODING_TIME_LIMIT_MAX_MS
  ) {
    return `Time limit must be ${CODING_TIME_LIMIT_MIN_MS}-${CODING_TIME_LIMIT_MAX_MS} ms.`
  }
  if (
    !Number.isInteger(config.memoryLimitMb) ||
    config.memoryLimitMb < CODING_MEMORY_MIN_MB ||
    config.memoryLimitMb > CODING_MEMORY_MAX_MB
  ) {
    return `Memory limit must be ${CODING_MEMORY_MIN_MB}-${CODING_MEMORY_MAX_MB} MB.`
  }
  return null
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
   * Take one question: local row → QuestionAttempted (no answer) → server
   * submit (idempotent on clientAttemptId) → patch server ids.
   */
  async function recordAndSubmit(
    assessment: Assessment,
    question: Question,
    answer: LearnerAnswer,
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
   * `grader` names the arm the failed-closed fallback grade belongs to.
   */
  async function pollGrade(
    clientAttemptId: string,
    assessmentId: string,
    grader: QuestionGradedResult['grader'] = 'objective',
  ): Promise<LocalAttemptRow> {
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
              grader,
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
    const row = (await attempts().get(record.clientAttemptId)) as
      | LocalAttemptRow
      | undefined
    // The row can be gone if the database closed mid-poll (user switch,
    // teardown): keep the contract by falling back to the known identity.
    return row ?? { ...EMPTY_ROW, clientAttemptId: record.clientAttemptId }
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
   * local table (fresh device restore, late grades) without touching
   * existing local answers. New rows adopt the server-echoed answer (#40
   * D-01) so "your pick" marking survives a fresh-device restore.
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
          // Fresh-device restore: adopt the server-echoed learner answer (#40 D-01).
          ...(record.answer != null ? { answer: record.answer } : {}),
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

  /** Objective taking (#39): the answer is one of the indexed objective shapes. */
  async function submitObjectiveAttempt(
    assessment: Assessment,
    question: Question,
    answer: ObjectiveAnswer,
    elapsedSeconds?: number,
  ): Promise<SubmitResult> {
    return recordAndSubmit(assessment, question, answer, elapsedSeconds)
  }

  /**
   * Written taking (#41 D-02): the answer is `{ text }` and the client gate
   * rejects blank/oversized text before a row or a request exists. The throw is
   * defensive - the taker disables submit on the same predicate.
   */
  async function submitWrittenAttempt(
    assessment: Assessment,
    question: Question,
    text: string,
    elapsedSeconds?: number,
  ): Promise<SubmitResult> {
    const problem = writtenAnswerProblem(text)
    if (problem) throw new Error(problem)
    return recordAndSubmit(assessment, question, { text }, elapsedSeconds)
  }

  /**
   * Coding taking (#42): the answer is `{ language, source, config }` and
   * the client gate rejects empty/oversized source (or out-of-contract
   * config) before a row or a request exists. The throw is defensive - the
   * taker disables submit on the same predicate.
   */
  async function submitCodingAttempt(
    assessment: Assessment,
    question: Question,
    source: string,
    config: CodingAnswer['config'] = defaultCodingConfig(),
    elapsedSeconds?: number,
  ): Promise<SubmitResult> {
    const problem = codingAnswerProblem(source) ?? codingConfigProblem(config)
    if (problem) throw new Error(problem)
    const answer: CodingAnswer = { language: 'python', source, config }
    return recordAndSubmit(assessment, question, answer, elapsedSeconds)
  }

  /**
   * Output-prediction taking (#42 D-01): the answer is the objective
   * `{ value }` shape, because the server grades it deterministically with
   * `grade_objective`'s numeric key and never touches the sandbox. The client
   * gate rejects a blank or non-numeric prediction before a row or a request
   * exists. The throw is defensive - the taker disables submit on the same
   * predicate.
   */
  async function submitPredictionAttempt(
    assessment: Assessment,
    question: Question,
    value: string,
    elapsedSeconds?: number,
  ): Promise<SubmitResult> {
    const problem = predictionAnswerProblem(value)
    if (problem) throw new Error(problem)
    return recordAndSubmit(assessment, question, { value: value.trim() }, elapsedSeconds)
  }

  return {
    submitObjectiveAttempt,
    submitWrittenAttempt,
    submitCodingAttempt,
    submitPredictionAttempt,
    pollGrade,
    drainQueuedAttempts,
    refreshAttempts,
    cacheAssessment,
    cachedAssessment,
    listLocalAttempts,
  }
}

export type AttemptFlow = ReturnType<typeof createAttemptFlow>
