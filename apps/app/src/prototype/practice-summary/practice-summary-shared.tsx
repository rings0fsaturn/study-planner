// PROTOTYPE — throwaway. Shared bits for the practice-summary variants:
// terminal-state detection (the review model maps a failed attempt to
// 'processing', so the summary must special-case it), the stats line, the
// per-problem body (review card / history / honest failure copy + retry),
// and the run-summary head. Everything here is presentational.

import type { ReactNode } from 'react'
import type { PracticeRunProblem, PracticeRunModel } from '../../pages/practice/practiceRunModel'
import type { QuestionDisplayStatus } from '../../pages/assessments/review/reviewModel'
import {
  AttemptHistoryBlock,
  QuestionReviewCard,
  RetryQuestionButton,
} from '../../pages/assessments/review/ReviewSurface'

export type TerminalState = 'graded' | 'failed' | 'none'

/** The review model reports a failed attempt as 'processing'; the summary must not. */
export function terminalState(problem: PracticeRunProblem): TerminalState {
  const latest = problem.group?.latest
  if (latest?.grade) return 'graded'
  if (latest?.status === 'failed') return 'failed'
  return 'none'
}

export interface SummaryStats {
  total: number
  graded: number
  correct: number
  failed: number
  meanScore: number | null
}

export function summaryStats(reviewed: PracticeRunProblem[], total: number): SummaryStats {
  const graded = reviewed.filter((problem) => terminalState(problem) === 'graded')
  const failed = reviewed.filter((problem) => terminalState(problem) === 'failed')
  const scores = graded.flatMap((problem) =>
    problem.group?.latest?.grade != null ? [problem.group.latest.grade.score] : [],
  )
  return {
    total,
    graded: graded.length,
    correct: graded.filter((problem) => problem.group?.latest?.grade?.correct).length,
    failed: failed.length,
    meanScore: scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
  }
}

export function statusTagClass(status: QuestionDisplayStatus): string {
  switch (status) {
    case 'correct':
      return 'tag-moss'
    case 'partial':
      return 'tag-terracotta'
    case 'incorrect':
      return 'tag-rust'
    default:
      return ''
  }
}

export interface SummaryVariantProps {
  model: PracticeRunModel
  /** Problems that reached a terminal outcome (grade or failed attempt). */
  reviewed: PracticeRunProblem[]
  materialTitles: Record<string, string>
  /** Inline retry mode: the problem whose panel is showing the mock taker. */
  takingQuestionId: string | null
  onSubmit: (text: string) => void
  onRetry: (questionId: string) => void
}

/**
 * The body of one reviewed problem: preserved history when retried, the shared
 * review card for the latest grade, or honest failure copy for an ungradable
 * attempt — then the per-problem retry (never a whole-run retry, D-04).
 */
export function ProblemBody({
  problem,
  onRetry,
}: {
  problem: PracticeRunProblem
  onRetry: (questionId: string) => void
}): ReactNode {
  const group = problem.group
  if (!group) return null
  const latest = group.latest

  if (terminalState(problem) === 'failed') {
    return (
      <div className="ar-failed-note" role="status">
        <p className="t-body-sm">This attempt could not be graded.</p>
        <RetryQuestionButton onRetry={() => onRetry(group.question.id)} />
      </div>
    )
  }

  return (
    <>
      {group.attempts.length > 1 ? (
        <AttemptHistoryBlock group={group} />
      ) : (
        latest != null && <QuestionReviewCard question={group.question} attempt={latest} />
      )}
      {latest != null && <RetryQuestionButton onRetry={() => onRetry(group.question.id)} />}
    </>
  )
}

export function SummaryHead({
  stats,
  missingCount,
  abandoned,
}: {
  stats: SummaryStats
  missingCount: number
  abandoned: boolean
}): ReactNode {
  return (
    <section className="psp-summary-head" aria-label="Run summary">
      <div className="psp-summary-title-row">
        <h2>Run summary</h2>
        <span className={`tag tag-sm ${abandoned ? 'tag-rust' : 'tag-moss'}`}>
          {abandoned ? 'abandoned' : 'completed'}
        </span>
      </div>
      <p className="t-body psp-summary-line">
        {stats.graded} of {stats.total} problems graded
        {stats.correct > 0 && ` · ${stats.correct} correct`}
        {stats.failed > 0 && ` · ${stats.failed} could not be graded`}
        {stats.meanScore != null && ` · mean score ${stats.meanScore.toFixed(2)}`}
        {missingCount > 0 &&
          ` · ${missingCount} problem${missingCount === 1 ? '' : 's'} were not generated`}
      </p>
    </section>
  )
}

export function materialLabel(
  problem: PracticeRunProblem,
  materialTitles: Record<string, string>,
): string | null {
  return materialTitles[problem.materialId] ?? null
}