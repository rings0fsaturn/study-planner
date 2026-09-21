/**
 * Practice run state (#44 Phase 2, D-02/D-10) — pure derivation.
 *
 * `(pointer event + loaded assessment envelopes + local attempt rows) ->` the
 * run's ordered problems, their review groups, the resume point and the
 * terminal state. No React, no Dexie, no clock: the run screen owns the I/O.
 *
 * `questionIds` are never stored on the pointer (D-02): the questions exist
 * only inside the loaded assessments, so this module is where they enter.
 */

import type { Event } from '../../events/EventStore'
import type { LocalAttemptRow } from '../../assessments/attemptFlow'
import type { Assessment, AssessmentFormat, AssessmentStatus } from '../../assessments/types'
import { PRACTICE_RUN_FINISHED, PRACTICE_RUN_STARTED } from '../../events/EventStore'
import type { PracticeRunFinishedPayload, PracticeRunStartedPayload } from '../../sync/types'
import {
  buildReviewModel,
  type QuestionReviewGroup,
} from '../assessments/review/reviewModel'

export interface PracticeRunPointer {
  started: PracticeRunStartedPayload
  finished: PracticeRunFinishedPayload | null
}

export interface PracticeRunProblem {
  /** 1-based position in the run. */
  number: number
  assessmentId: string
  /** Null while the assessment is still loading or generating. */
  group: QuestionReviewGroup | null
  /** Null when the assessment could not be read at all. */
  assessmentStatus: AssessmentStatus | null
  /** The source material for this problem (D-10 attribution). */
  materialId: string
  /**
   * The family this problem's generation call used (#45). Read from the
   * pointer's per-problem record so a problem that has not loaded yet is
   * labelled honestly; a legacy pointer without `families` falls back to
   * `mode`. The loaded question's own `format` is the server's answer and
   * wins wherever a group exists.
   */
  family: AssessmentFormat
}

export interface PracticeRunModel {
  runId: string
  materialIds: string[]
  count: number
  problems: PracticeRunProblem[]
  /** Problems the run declared but never generated (partial start). */
  missingCount: number
  /** Index of the first problem without a grade — where resume lands. */
  resumeIndex: number
  completedCount: number
  isFinished: boolean
  outcome: 'completed' | 'abandoned' | null
}

/**
 * Merge freshly loaded assessment envelopes without churning object identity
 * when nothing changed. The practice screen polls `getAssessment` while a
 * problem generates; a new envelope object every poll re-triggers hydration
 * (and its `GET /attempts`), so an unchanged poll must keep the previous
 * reference. Content equality is scoped to the fields the screen reads:
 * status, warnings, and questions.
 */
export function mergeEnvelopes(
  previous: Record<string, Assessment>,
  loaded: Record<string, Assessment>,
): Record<string, Assessment> {
  let next: Record<string, Assessment> | null = null
  for (const [id, record] of Object.entries(loaded)) {
    const before = previous[id]
    if (before === record || (before != null && sameEnvelope(before, record))) continue
    next = next ?? { ...previous }
    next[id] = record
  }
  return next ?? previous
}

function sameEnvelope(a: Assessment, b: Assessment): boolean {
  return (
    a.status === b.status &&
    JSON.stringify(a.warnings) === JSON.stringify(b.warnings) &&
    JSON.stringify(a.questions) === JSON.stringify(b.questions)
  )
}

/**
 * Summary status of one problem (#44 Phase 3). The review model reports a
 * failed attempt as `processing` (it has no grade yet), so the summary must
 * classify terminal states itself: a grade, an ungradable attempt, or open.
 */
export type PracticeProblemStatus = 'graded' | 'failed' | 'open'

export function problemStatus(problem: PracticeRunProblem): PracticeProblemStatus {
  const latest = problem.group?.latest
  if (latest?.grade) return 'graded'
  if (latest?.status === 'failed') return 'failed'
  return 'open'
}

/** Problems the summary lists: those that reached a terminal outcome. */
export function isSummaryEligible(problem: PracticeRunProblem): boolean {
  return problemStatus(problem) !== 'open'
}

function payloadOf<T>(event: Event): T {
  return event.payload as unknown as T
}

/**
 * Resolve a run's pointer from the log. Two linear scans over the event list:
 * a runId is minted per run, so the latest match wins.
 */
export function findPracticeRun(events: Event[], runId: string): PracticeRunPointer | null {
  let started: PracticeRunStartedPayload | null = null
  let finished: PracticeRunFinishedPayload | null = null
  for (const event of events) {
    if (event.kind === PRACTICE_RUN_STARTED) {
      const payload = payloadOf<PracticeRunStartedPayload>(event)
      if (payload.runId === runId) started = payload
    } else if (event.kind === PRACTICE_RUN_FINISHED) {
      const payload = payloadOf<PracticeRunFinishedPayload>(event)
      if (payload.runId === runId) finished = payload
    }
  }
  return started ? { started, finished } : null
}

/**
 * D-10 attribution: problem `i` was generated from `materialIds[i % M]`, so
 * the formula is the run's own record of which source grounded which problem.
 * Once the question itself is loaded, its `materialId` is the server's own
 * answer and takes precedence — the formula is for problems that have not
 * been read yet, not a replacement for what the server said.
 */
function attributeMaterial(
  index: number,
  materialIds: string[],
  questions: Assessment['questions'] | undefined,
): string {
  const grounded = questions?.[0]?.materialId
  if (grounded) return grounded
  if (materialIds.length === 0) return ''
  return materialIds[index % materialIds.length]
}

/**
 * A problem counts as done once its latest attempt carries a grade. Queued
 * and in-flight attempts are not done — a retry moves the problem back.
 */
function isGraded(problem: PracticeRunProblem): boolean {
  const display = problem.group?.display
  return display === 'correct' || display === 'partial' || display === 'incorrect'
}

/**
 * The family planned for one problem (#45). The pointer's `families` array is
 * aligned with `assessmentIds`; a pointer written before #45 has none, so the
 * run's own `mode` answers instead of assuming a family.
 */
function plannedFamily(
  mode: PracticeRunStartedPayload['mode'],
  families: AssessmentFormat[] | undefined,
  index: number,
): AssessmentFormat {
  return families?.[index] ?? (mode === 'coding' ? 'coding' : 'written')
}

/**
 * Derive the run's state. `assessments` is positionally aligned with
 * `started.assessmentIds`; a null entry means the envelope has not loaded.
 */
export function buildPracticeRunModel(input: {
  started: PracticeRunStartedPayload
  finished: PracticeRunFinishedPayload | null
  assessments: Array<Assessment | null>
  attemptsByAssessment: Record<string, LocalAttemptRow[]>
}): PracticeRunModel {
  const { started, finished, assessments, attemptsByAssessment } = input

  const problems: PracticeRunProblem[] = started.assessmentIds.map((assessmentId, index) => {
    const assessment = assessments[index] ?? null
    const rows = attemptsByAssessment[assessmentId] ?? []
    const group =
      assessment != null && assessment.questions.length > 0
        ? (buildReviewModel(assessment, rows).groups[0] ?? null)
        : null
    return {
      number: index + 1,
      assessmentId,
      group,
      assessmentStatus: assessment?.status ?? null,
      materialId: attributeMaterial(index, started.materialIds, assessment?.questions),
      family: plannedFamily(started.mode, started.families, index),
    }
  })

  const completedCount = problems.filter((problem) => isGraded(problem)).length
  const firstOpen = problems.findIndex((problem) => !isGraded(problem))

  return {
    runId: started.runId,
    materialIds: started.materialIds,
    count: started.count,
    problems,
    missingCount: Math.max(0, started.count - problems.length),
    // A fully graded run stays on its last problem rather than wrapping to 0.
    resumeIndex: firstOpen === -1 ? Math.max(0, problems.length - 1) : firstOpen,
    completedCount,
    isFinished: finished != null,
    outcome: finished?.outcome ?? null,
  }
}
