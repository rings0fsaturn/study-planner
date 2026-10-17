/**
 * Steady-pilot live driver (Phase 2, D-07/D-10).
 *
 * Thin and live: sign-in + study-half append happen in the browser runbook;
 * this module only drives ingest polling, one-family-per-call generation
 * (rule 42), scripted submits, and grade polling. Grades always come from
 * the server; the driver never invents QuestionGraded (attemptFlow writes it).
 * All deps are injected (no hidden fetches); one request id per logical call
 * is reused across internal polls (rule 17).
 */

import type { AssessmentClientLike } from '../assessments/assessmentClient'
import { DEFAULT_BAND } from '../assessments/masteryBands'
import type { LearnerAnswer, Question } from '../assessments/types'
import {
  CODING_MEMORY_DEFAULT_MB,
  CODING_TIME_LIMIT_DEFAULT_MS,
} from '../assessments/types'
import type { EventStore } from '../events/EventStore'
import { logger } from '../lib/logger'
import type { MaterialClientLike } from '../materials/materialClient'

export interface GradeScript {
  format: 'objective' | 'written' | 'coding'
  /** Intent only: picks the scripted answer template; the server grade is authoritative. */
  correct: boolean
  /** Authored difficulty band 1-5 (server gate); defaults to the mid band. */
  difficulty?: number
}

export interface MaterialDef {
  title: string
  kind: 'youtube' | 'url' | 'file'
  source: string
  /** Required for file kinds: the bytes to upload (the driver never fabricates them). */
  file?: File
}

export interface SynthDriverDeps {
  eventStore: EventStore
  assessments: AssessmentClientLike
  materials: MaterialClientLike
  requestId: () => string
}

export interface SynthDriverOpts {
  readyPollAttempts?: number
  readyPollIntervalMs?: number
  gradePollAttempts?: number
  gradePollIntervalMs?: number
  /**
   * Override for the scripted answer picker (default: the intent templates
   * below). The pilot passes operator-authored answers here for weeks that
   * must grade correct (e.g. steady); the driver never invents grades either
   * way (D-07).
   */
  answerFor?: (script: GradeScript, question: Question) => LearnerAnswer
}

const READY_POLL_ATTEMPTS = 60
const READY_POLL_INTERVAL_MS = 5000
const GRADE_POLL_ATTEMPTS = 60
const GRADE_POLL_INTERVAL_MS = 5000

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Scripted answer per format; intent-only, the server holds the key (D-07).
 * `correct` selects effort, never the grade: objective picks an option index,
 * written picks a full vs minimal text, coding submits the untouched scaffold
 * vs bare pass. The driver cannot derive real solutions, so a mostly-correct
 * week needs operator-authored answers at run time; these templates only keep
 * the submit path honest (never blank, always in-contract).
 */
function answerFor(script: GradeScript, question: Question): LearnerAnswer {
  if (script.format === 'objective') {
    const lastIndex = Math.max(0, question.options.length - 1)
    return { index: script.correct ? 0 : lastIndex }
  }
  if (script.format === 'written') {
    return {
      text: script.correct
        ? 'The mechanism works in three steps. First, the running estimates are initialized. Second, each update moves them toward the observed value. Third, the correction term keeps early steps stable, which is why the first updates differ from later ones.'
        : 'I do not know.',
    }
  }
  if (script.format === 'coding') {
    return {
      language: 'python',
      source: script.correct ? (question.starterCode ?? 'pass') : 'pass',
      config: {
        stdin: '',
        timeLimitMs: CODING_TIME_LIMIT_DEFAULT_MS,
        memoryLimitMb: CODING_MEMORY_DEFAULT_MB,
      },
    }
  }
  throw new Error(`[synthDriver] unsupported format: ${script.format as string}`)
}

export async function ingestSharedSet(
  deps: SynthDriverDeps,
  defs: MaterialDef[],
  opts: SynthDriverOpts = {},
): Promise<string[]> {
  const readyAttempts = opts.readyPollAttempts ?? READY_POLL_ATTEMPTS
  const readyInterval = opts.readyPollIntervalMs ?? READY_POLL_INTERVAL_MS
  const ids: string[] = []
  for (const def of defs) {
    // Validate before creating: a file def without bytes must not strand a
    // pending row on the live account.
    if (def.kind === 'file' && !def.file) {
      throw new Error(
        `[synthDriver] file material '${def.title}' needs a File (upload has no bytes to send)`,
      )
    }
    const requestId = deps.requestId()
    const record = await deps.materials.createMaterial({
      clientId: requestId,
      title: def.title,
      kind: def.kind,
      source: def.source,
    })
    if (def.kind === 'file' && def.file) {
      try {
        await deps.materials.uploadMaterialFile(record.id, def.file)
        await deps.materials.completeUpload(record.id)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'upload failed'
        logger.warn(`[synthDriver] upload failed for '${def.title}' requestId=${requestId}: ${message}`)
        await deps.materials.markUploadFailed(record.id, message)
        throw error
      }
    }
    let material = await deps.materials.getMaterial(record.id)
    for (
      let i = 0;
      i < readyAttempts &&
      material.ingestionState !== 'ready' &&
      material.ingestionState !== 'failed';
      i++
    ) {
      await wait(readyInterval)
      material = await deps.materials.getMaterial(record.id)
    }
    if (material.ingestionState === 'failed') {
      logger.warn(
        `[synthDriver] ingestion failed for '${def.title}' requestId=${requestId}: ${material.ingestionError ?? 'unknown'}`,
      )
      throw new Error(
        `[synthDriver] ingestion failed for '${def.title}': ${material.ingestionError ?? 'unknown'} (honest failure, fix and retry)`,
      )
    }
    if (material.ingestionState !== 'ready') {
      logger.warn(
        `[synthDriver] ingestion not ready for '${def.title}' after ${readyAttempts} polls requestId=${requestId}`,
      )
      throw new Error(
        `[synthDriver] ingestion not ready for '${def.title}' after ${readyAttempts} polls requestId=${requestId}`,
      )
    }
    ids.push(material.id)
  }
  return ids
}

export async function runGradedWeek(
  deps: SynthDriverDeps,
  materialIds: string[],
  script: GradeScript[],
  opts: SynthDriverOpts = {},
): Promise<{ attempted: number; graded: number }> {
  const readyAttempts = opts.readyPollAttempts ?? READY_POLL_ATTEMPTS
  const readyInterval = opts.readyPollIntervalMs ?? READY_POLL_INTERVAL_MS
  const gradeAttempts = opts.gradePollAttempts ?? GRADE_POLL_ATTEMPTS
  const gradeInterval = opts.gradePollIntervalMs ?? GRADE_POLL_INTERVAL_MS
  let attempted = 0
  let graded = 0

  // Sequential by pilot choice (conservative under the migration-032
  // advisory-lock gate; PracticeThis runs a bounded fan-out of 2). A graded
  // week is 5 calls, not a fan-out.
  if (materialIds.length !== 1) {
    throw new Error(
      `[synthDriver] exactly one materialId per generation call (got ${materialIds.length}; server takes one)`,
    )
  }
  for (const entry of script) {
    const correlationId = deps.requestId()
    const pickAnswer = opts.answerFor ?? answerFor
    const job = await deps.assessments.generateAssessment({
      clientId: crypto.randomUUID(),
      materialIds,
      recipe: { formats: [entry.format], questionCount: 1, difficulty: entry.difficulty ?? DEFAULT_BAND },
      correlationId,
    })
    const assessmentId = job.resultId ?? correlationId
    let assessment = await deps.assessments.getAssessment(assessmentId)
    for (let i = 0; i < readyAttempts && assessment.status === 'generating'; i++) {
      await wait(readyInterval)
      assessment = await deps.assessments.getAssessment(assessmentId)
    }
    if (assessment.status === 'failed') {
      const reason = assessment.warnings.map((w) => w.code).join(', ') || 'unknown'
      logger.warn(
        `[synthDriver] generation failed for ${assessmentId} correlationId=${correlationId} reason=${reason}`,
      )
      throw new Error(
        `[synthDriver] generation failed for ${assessmentId} (${reason}; terminal, start a fresh run)`,
      )
    }
    if (assessment.status !== 'ready' && assessment.status !== 'partial') {
      logger.warn(
        `[synthDriver] generation not ready for ${assessmentId} after ${readyAttempts} polls correlationId=${correlationId}`,
      )
      throw new Error(
        `[synthDriver] generation not ready for ${assessmentId} after ${readyAttempts} polls correlationId=${correlationId}`,
      )
    }
    const question = assessment.questions[0]
    if (!question) {
      logger.warn(`[synthDriver] no question on ${assessmentId} correlationId=${correlationId}`)
      throw new Error(`[synthDriver] no question on ${assessmentId}`)
    }
    const clientAttemptId = `ca-${crypto.randomUUID()}`
    const submittedAt = new Date().toISOString()
    await deps.assessments.submitAssessmentAttempt(assessmentId, question.id, {
      clientAttemptId,
      questionId: question.id,
      answer: pickAnswer(entry, question),
      submittedAt,
      correlationId,
    })
    attempted++
    for (let i = 0; i < gradeAttempts; i++) {
      const records = await deps.assessments.listAssessmentAttempts(assessmentId)
      if (records.some((r) => r.clientAttemptId === clientAttemptId && r.grade)) {
        graded++
        break
      }
      await wait(gradeInterval)
    }
  }
  if (graded < attempted) {
    logger.warn(
      `[synthDriver] partial week: ${graded}/${attempted} graded materialIds=${materialIds.join(',')}`,
    )
  }
  return { attempted, graded }
}
