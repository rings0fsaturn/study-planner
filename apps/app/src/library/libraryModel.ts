/**
 * Library data layer (Phase 1) - pure derivation.
 *
 * `(events + envelopes + local attempts) ->` row view models for the
 * assessments hub, the practice hub, and the material backlink. No React,
 * no Dexie, no clock, no fetch: the hook owns I/O.
 */

import type { Event } from '../events/EventStore'
import {
  ASSESSMENT_CREATED,
  PRACTICE_RUN_FINISHED,
  PRACTICE_RUN_STARTED,
} from '../events/EventStore'
import type { LocalAttemptRow } from '../assessments/attemptFlow'
import type {
  Assessment,
  AssessmentFormat,
} from '../assessments/types'
import type {
  AssessmentCreatedPayload,
  PracticeRunFinishedPayload,
  PracticeRunStartedPayload,
} from '../sync/types'
import { buildReviewModel } from '../pages/assessments/review/reviewModel'
import {
  buildPracticeRunModel,
  isGraded,
} from '../pages/practice/practiceRunModel'

export interface AssessmentPointer {
  assessmentId: string
  materialIds: string[]
  createdAt: string
}

export interface PracticeRunEntry {
  started: PracticeRunStartedPayload
  finished: PracticeRunFinishedPayload | null
  startedAt: string
}

export type AssessmentRowState = 'unavailable' | 'generating' | 'failed' | 'ready'

export interface AssessmentRow {
  assessmentId: string
  materialIds: string[]
  primaryMaterialId: string
  createdAt: string
  state: AssessmentRowState
  family: AssessmentFormat | null
  score: number | null
  gradedCount: number
  totalCount: number
  readyCount: number
  warningReason: string | null
  assessment: Assessment | null
}

export type PracticeRunRowState =
  | 'completed'
  | 'abandoned'
  | 'failed'
  | 'generating'
  | 'in-progress'
  | 'unavailable'

export interface PracticeRunRow {
  runId: string
  materialIds: string[]
  primaryMaterialId: string
  mode: PracticeRunStartedPayload['mode']
  count: number
  startedAt: string
  finished: PracticeRunFinishedPayload | null
  state: PracticeRunRowState
  gradedCount: number
  readyCount: number
  totalCount: number
  missingCount: number
  failedReason: string | null
}

function payloadOf<T>(event: Event): T {
  return event.payload as unknown as T
}

function compareNewest(aCreatedAt: string, aId: number | undefined, bCreatedAt: string, bId: number | undefined): number {
  if (aCreatedAt !== bCreatedAt) return aCreatedAt < bCreatedAt ? 1 : -1
  return (bId ?? 0) - (aId ?? 0)
}

/**
 * Latest AssessmentCreated wins per assessmentId (createdAt, tie-break id).
 * Newest first. Optional materialId filter on the pointer's materialIds.
 */
export function listAssessmentPointers(
  events: Event[],
  options?: { materialId?: string },
): AssessmentPointer[] {
  const latest = new Map<string, { pointer: AssessmentPointer; eventId: number | undefined }>()
  for (const event of events) {
    if (event.kind !== ASSESSMENT_CREATED) continue
    const payload = payloadOf<AssessmentCreatedPayload>(event)
    if (!payload?.assessmentId) continue
    const candidate: AssessmentPointer = {
      assessmentId: payload.assessmentId,
      materialIds: [...(payload.materialIds ?? [])],
      createdAt: event.createdAt,
    }
    const previous = latest.get(candidate.assessmentId)
    if (!previous || compareNewest(previous.pointer.createdAt, previous.eventId, candidate.createdAt, event.id) > 0) {
      latest.set(candidate.assessmentId, { pointer: candidate, eventId: event.id })
    }
  }
  const pointers = [...latest.values()].map((entry) => entry.pointer)
  const filtered = options?.materialId
    ? pointers.filter((pointer) => pointer.materialIds.includes(options.materialId as string))
    : pointers
  return filtered.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
    return a.assessmentId.localeCompare(b.assessmentId)
  })
}

/**
 * One entry per runId. Finished without started is ignored. Newest startedAt
 * first. Optional materialId filter on the started pointer.
 */
export function listPracticeRunEntries(
  events: Event[],
  options?: { materialId?: string },
): PracticeRunEntry[] {
  const startedByRun = new Map<string, { started: PracticeRunStartedPayload; startedAt: string }>()
  const finishedByRun = new Map<string, { finished: PracticeRunFinishedPayload; finishedAt: string }>()
  for (const event of events) {
    if (event.kind === PRACTICE_RUN_STARTED) {
      const payload = payloadOf<PracticeRunStartedPayload>(event)
      if (!payload?.runId) continue
      const previous = startedByRun.get(payload.runId)
      if (!previous || event.createdAt >= previous.startedAt) {
        startedByRun.set(payload.runId, { started: payload, startedAt: event.createdAt })
      }
    } else if (event.kind === PRACTICE_RUN_FINISHED) {
      const payload = payloadOf<PracticeRunFinishedPayload>(event)
      if (!payload?.runId) continue
      const previous = finishedByRun.get(payload.runId)
      if (!previous || event.createdAt >= previous.finishedAt) {
        finishedByRun.set(payload.runId, { finished: payload, finishedAt: event.createdAt })
      }
    }
  }
  const entries: PracticeRunEntry[] = []
  for (const [runId, { started, startedAt }] of startedByRun) {
    if (options?.materialId && !started.materialIds.includes(options.materialId)) continue
    entries.push({ started, finished: finishedByRun.get(runId)?.finished ?? null, startedAt })
  }
  return entries.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : a.started.runId.localeCompare(b.started.runId)))
}

function familyOf(assessment: Assessment): AssessmentFormat | null {
  const fromRecipe = assessment.recipe?.formats?.[0]
  if (fromRecipe) return fromRecipe
  const fromQuestion = assessment.questions[0]?.format
  return fromQuestion ?? null
}

function warningReasonOf(warnings: Assessment['warnings'] | undefined): string | null {
  const first = warnings?.[0] as Partial<{ code: unknown; message: unknown }> | undefined
  const code = typeof first?.code === 'string' ? first.code : null
  const message = typeof first?.message === 'string' ? first.message : null
  if (!code) return null
  return message ? `${code}: ${message}` : code
}

/** Score is the mean of latest graded attempts via the shipped review model. */
export function buildAssessmentRow(input: {
  pointer: AssessmentPointer
  assessment: Assessment | null
  attempts: LocalAttemptRow[]
}): AssessmentRow {
  const { pointer, assessment, attempts } = input
  const primaryMaterialId = pointer.materialIds[0] ?? ''
  const shared = {
    assessmentId: pointer.assessmentId,
    materialIds: pointer.materialIds,
    primaryMaterialId,
  }
  if (!assessment) {
    return {
      ...shared,
      createdAt: pointer.createdAt,
      state: 'unavailable',
      family: null,
      score: null,
      gradedCount: 0,
      totalCount: 0,
      readyCount: 0,
      warningReason: null,
      assessment: null,
    }
  }
  const createdAt = assessment.createdAt ?? pointer.createdAt
  const family = familyOf(assessment)
  const warningReason = warningReasonOf(assessment.warnings)
  if (assessment.status === 'generating') {
    return {
      ...shared,
      createdAt,
      state: 'generating',
      family,
      score: null,
      gradedCount: 0,
      totalCount: assessment.recipe?.questionCount ?? assessment.questions.length,
      readyCount: assessment.questions.length,
      warningReason,
      assessment,
    }
  }
  if (assessment.status === 'failed') {
    return {
      ...shared,
      createdAt,
      state: 'failed',
      family,
      score: null,
      gradedCount: 0,
      totalCount: assessment.recipe?.questionCount ?? assessment.questions.length,
      readyCount: 0,
      warningReason,
      assessment,
    }
  }
  const review = buildReviewModel(assessment, attempts)
  const scores = review.groups.flatMap((group) => (group.latest?.grade != null ? [group.latest.grade.score] : []))
  const score = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null
  return {
    ...shared,
    createdAt,
    state: 'ready',
    family,
    score,
    gradedCount: review.gradedCount,
    totalCount: assessment.questions.length,
    readyCount: assessment.questions.length,
    warningReason,
    assessment,
  }
}

export function buildPracticeRunRow(input: {
  entry: PracticeRunEntry
  assessments: Array<Assessment | null>
  attemptsByAssessment: Record<string, LocalAttemptRow[]>
}): PracticeRunRow {
  const { entry, assessments, attemptsByAssessment } = input
  const { started, finished, startedAt } = entry
  const primaryMaterialId = started.materialIds[0] ?? ''
  const model = buildPracticeRunModel({ started, finished, assessments, attemptsByAssessment })
  const totalCount = started.count
  const base = {
    runId: started.runId,
    materialIds: started.materialIds,
    primaryMaterialId,
    mode: started.mode,
    count: started.count,
    startedAt,
    finished,
    gradedCount: model.completedCount,
    readyCount: assessments.filter((assessment) => assessment != null).length,
    totalCount,
    missingCount: model.missingCount,
    failedReason: null as string | null,
  }
  if (finished?.outcome === 'completed') return { ...base, state: 'completed' }
  if (finished?.outcome === 'abandoned') return { ...base, state: 'abandoned' }
  const readable = assessments.some((assessment) => assessment != null)
  if (!readable) return { ...base, state: 'unavailable' }
  const ungradedFailed = model.problems.find((problem) => {
    if (isGraded(problem)) return false
    return problem.assessmentStatus === 'failed'
  })
  if (ungradedFailed) {
    const envelope = assessments[ungradedFailed.number - 1]
    return { ...base, state: 'failed', failedReason: envelope ? warningReasonOf(envelope.warnings) : null }
  }
  const ungradedOpen = model.problems.some((problem) => {
    if (isGraded(problem)) return false
    return problem.assessmentStatus === 'generating' || problem.assessmentStatus == null
  })
  if (ungradedOpen) return { ...base, state: 'generating' }
  return { ...base, state: 'in-progress' }
}

/** Generating first, then newest first. */
export function orderAssessmentRows(rows: AssessmentRow[]): AssessmentRow[] {
  return [...rows].sort((a, b) => {
    const aGenerating = a.state === 'generating' ? 0 : 1
    const bGenerating = b.state === 'generating' ? 0 : 1
    if (aGenerating !== bGenerating) return aGenerating - bGenerating
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
    return a.assessmentId.localeCompare(b.assessmentId)
  })
}

/** Resume (in-progress + generating + unavailable) then history, newest first. */
export function splitRunRows(rows: PracticeRunRow[]): { resume: PracticeRunRow[]; history: PracticeRunRow[] } {
  const byNewest = (a: PracticeRunRow, b: PracticeRunRow) =>
    a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : a.runId.localeCompare(b.runId)
  const resume = rows
    .filter((row) => row.state === 'in-progress' || row.state === 'generating' || row.state === 'unavailable')
    .sort(byNewest)
  const history = rows
    .filter((row) => row.state === 'completed' || row.state === 'abandoned' || row.state === 'failed')
    .sort(byNewest)
  return { resume, history }
}
