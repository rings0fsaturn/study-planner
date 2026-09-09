/**
 * Review view-model for the assessment review surface (#40, PLAN D-02/D-05).
 *
 * Pure derivation: (Assessment + per-question local attempt rows) -> the
 * five-state review model. No fetches, no storage, no events. The `retried`
 * flag is emergent: more than one attempt on any question renders history +
 * timeline without any new server state.
 */

import type { LocalAttemptRow } from '../../../assessments/attemptFlow'
import type {
  Assessment,
  AssessmentFormat,
  ObjectiveAnswer,
  Question,
  QuestionGradedResult,
} from '../../../assessments/types'

export type ReviewState = 'ready' | 'partial' | 'processing' | 'failed'

export type QuestionDisplayStatus = 'correct' | 'partial' | 'incorrect' | 'processing' | 'pending'

/** Score at or above this reads as "partial" when the grade is not correct. */
export const PARTIAL_SCORE_THRESHOLD = 0.6

export interface QuestionReviewGroup {
  question: Question
  attempts: LocalAttemptRow[]
  latest: LocalAttemptRow | null
  display: QuestionDisplayStatus
}

export interface FamilyStat {
  format: AssessmentFormat
  total: number
  correct: number
}

export interface ReviewTimelineEntry {
  attemptNumber: number
  startedAt: string
  completedAt?: string
  score?: number
  correctCount?: number
  totalCount?: number
  status: 'processing' | 'partial' | 'graded' | 'failed'
}

export interface ReviewViewModel {
  state: ReviewState
  /** Emergent retried rendering: any question holds more than one attempt. */
  retried: boolean
  groups: QuestionReviewGroup[]
  gradedCount: number
  totalCount: number
  families: FamilyStat[]
  verdict: string
}

export function displayStatusOf(
  latest: LocalAttemptRow | null,
): QuestionDisplayStatus {
  if (!latest) return 'pending'
  const grade = latest.grade ?? null
  if (!grade) return 'processing'
  if (grade.correct) return 'correct'
  if (grade.score >= PARTIAL_SCORE_THRESHOLD) return 'partial'
  return 'incorrect'
}

function groupFor(question: Question, rows: LocalAttemptRow[]): QuestionReviewGroup {
  const attempts = rows
    .filter((row) => row.questionId === question.id)
    .slice()
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  const latest = attempts.length > 0 ? attempts[attempts.length - 1] : null
  return { question, attempts, latest, display: displayStatusOf(latest) }
}

function familyBreakdown(groups: QuestionReviewGroup[]): FamilyStat[] {
  const buckets: Record<AssessmentFormat, QuestionReviewGroup[]> = {
    objective: [],
    written: [],
    coding: [],
  }
  for (const group of groups) buckets[group.question.format].push(group)
  return (['objective', 'written', 'coding'] as const)
    .map((format) => ({
      format,
      total: buckets[format].length,
      correct: buckets[format].filter((group) => group.display === 'correct').length,
    }))
    .filter((stat) => stat.total > 0)
}

function latestScores(groups: QuestionReviewGroup[]): number[] {
  return groups.flatMap((group) =>
    group.latest?.grade != null ? [group.latest.grade.score] : [],
  )
}

function buildVerdict(
  groups: QuestionReviewGroup[],
  total: number,
  graded: number,
): string {
  if (total === 0) return 'Grading blocked · no questions scored'
  const scores = latestScores(groups)
  const mean =
    scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : null
  const hasInFlight = groups.some(
    (group) => group.display === 'processing' || group.display === 'pending',
  )
  if (hasInFlight) {
    return `${graded} of ${total} graded${mean != null ? ` · score so far ${mean.toFixed(2)}` : ' · scores pending'}`
  }
  const correct = groups.filter((group) => group.display === 'correct').length
  return `${correct} of ${total} questions correct${mean != null ? ` · score ${mean.toFixed(2)}` : ''}`
}

/**
 * Build the review view-model from the assessment envelope plus local
 * attempt rows (server-merged rows included — refreshAttempts adopts the
 * echoed answer, so restored rows mark "your pick" too).
 */
export function buildReviewModel(
  assessment: Assessment,
  rows: LocalAttemptRow[],
): ReviewViewModel {
  const groups = assessment.questions.map((question) => groupFor(question, rows))
  const totalCount = groups.length
  const gradedCount = groups.filter((group) =>
    ['correct', 'partial', 'incorrect'].includes(group.display),
  ).length
  const state: ReviewState =
    assessment.status === 'failed'
      ? 'failed'
      : gradedCount === totalCount
        ? 'ready'
        : gradedCount > 0
          ? 'partial'
          : 'processing'
  return {
    state,
    retried: groups.some((group) => group.attempts.length > 1),
    groups,
    gradedCount,
    totalCount,
    families: familyBreakdown(groups),
    verdict: buildVerdict(groups, totalCount, gradedCount),
  }
}

/**
 * Seed one timeline entry from existing rows (P4 appends a new entry per
 * whole-assessment retry and collapses priors into <details>).
 */
export function deriveTimelineSeed(groups: QuestionReviewGroup[]): ReviewTimelineEntry[] {
  const rows = groups.flatMap((group) => group.attempts)
  if (rows.length === 0) return []
  const startedAt = rows
    .map((row) => row.submittedAt)
    .sort((a, b) => a.localeCompare(b))[0]
  const grades = rows.flatMap((row) => (row.grade ? [row.grade] : []))
  const scores = latestScores(groups)
  const gradedLatest = groups.filter((group) => group.latest?.grade != null).length
  return [
    {
      attemptNumber: 1,
      startedAt,
      ...(grades.length > 0
        ? {
            completedAt: grades
              .map((grade) => grade.gradedAt)
              .sort((a, b) => a.localeCompare(b))
              .slice(-1)[0],
          }
        : {}),
      ...(scores.length > 0
        ? { score: scores.reduce((sum, score) => sum + score, 0) / scores.length }
        : {}),
      correctCount: groups.filter((group) => group.display === 'correct').length,
      totalCount: groups.filter((group) => group.latest != null).length,
      status:
        gradedLatest === groups.length
          ? 'graded'
          : gradedLatest > 0
            ? 'partial'
            : 'processing',
    },
  ]
}

/** The shared grade feedback line: public copy first, explanation fallback. */
export function feedbackText(grade: QuestionGradedResult | null | undefined): string | null {
  if (!grade) return null
  return grade.publicFeedback ?? grade.explanation ?? null
}

/**
 * Human-readable learner answer for non-option objective subtypes
 * (cloze/numeric true_false). Option questions mark the pick inline, so
 * this returns null for the index/indices shapes.
 */
export function describeAnswer(answer: ObjectiveAnswer | undefined): string | null {
  if (!answer) return null
  if (answer.value != null) return answer.value
  if (answer.flag != null) return answer.flag ? 'True' : 'False'
  return null
}

/** Option indexes marked as the learner's pick (mcq / multi_select). */
export function pickedOptionIndexes(answer: ObjectiveAnswer | undefined): number[] {
  if (!answer) return []
  if (answer.index != null) return [answer.index]
  if (answer.indices != null) return [...answer.indices]
  return []
}
