/**
 * Practice run summary (#44 Phase 3, D-04/D-11).
 *
 * The completion view for a finished run: the shared `QuestionNavigator` and
 * one active problem panel built from the run model's review groups (each an
 * output of `buildReviewModel`), practice copy, and per-problem retry only —
 * never `ReviewSurface`/`SummaryBand` and never a whole-run retry.
 *
 * Honest states: a problem whose attempt could not be graded is not "still
 * processing" (the review model has no failed display), so the summary says so
 * and offers the same fresh-attempt retry. Only problems with a terminal
 * outcome are listed; the header reports graded / failed / missing counts.
 */

import type { ReactNode } from 'react'
import type { QuestionDisplayStatus } from '../assessments/review/reviewModel'
import type { MasteryProjection } from '../../assessments/types'
import { DEFAULT_BAND, bandGuidanceByMaterial } from '../../assessments/masteryBands'
import {
  AttemptHistoryBlock,
  QuestionNavigator,
  QuestionReviewCard,
  RetryQuestionButton,
} from '../assessments/review/ReviewSurface'
import { problemStatus, type PracticeRunModel, type PracticeRunProblem } from './practiceRunModel'
import './practice.css'

export interface PracticeSummaryProps {
  model: PracticeRunModel
  /** Terminal problems, in run order (graded or ungradable). */
  problems: PracticeRunProblem[]
  activeIndex: number
  onSelect: (index: number) => void
  materialTitles: Record<string, string>
  /** Rebuilt mastery projections for the advisory next-run band (#44 AC3). */
  mastery?: MasteryProjection[] | null
  /** Inline retry: the taking UI for the active problem while one is retrying. */
  panelSlot?: ReactNode
  onRetryQuestion: (questionId: string) => void
  onBackToProblems: () => void
}

function statusTagClass(status: QuestionDisplayStatus): string {
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

interface SummaryStats {
  total: number
  graded: number
  correct: number
  failed: number
  meanScore: number | null
}

function summaryStats(problems: PracticeRunProblem[], total: number): SummaryStats {
  const graded = problems.filter((problem) => problemStatus(problem) === 'graded')
  const failed = problems.filter((problem) => problemStatus(problem) === 'failed')
  const scores = graded.flatMap((problem) =>
    problem.group?.latest?.grade != null ? [problem.group.latest.grade.score] : [],
  )
  return {
    total,
    graded: graded.length,
    correct: graded.filter((problem) => problem.group?.latest?.grade?.correct).length,
    failed: failed.length,
    meanScore:
      scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
  }
}

/**
 * The body of one terminal problem: preserved history when retried, the shared
 * review card for the latest grade, or honest copy for an ungradable attempt —
 * then the per-problem retry (a fresh attempt; earlier ones stay).
 */
function ProblemBody({
  problem,
  onRetryQuestion,
}: {
  problem: PracticeRunProblem
  onRetryQuestion: (questionId: string) => void
}) {
  const group = problem.group
  if (!group) return null

  if (problemStatus(problem) === 'failed') {
    return (
      <div className="practice-failed-note" role="status">
        <p className="t-body-sm">This attempt could not be graded.</p>
        <RetryQuestionButton onRetry={() => onRetryQuestion(group.question.id)} />
      </div>
    )
  }

  const latest = group.latest
  return (
    <>
      {group.attempts.length > 1 ? (
        <AttemptHistoryBlock group={group} />
      ) : (
        latest != null && <QuestionReviewCard question={group.question} attempt={latest} />
      )}
      {latest != null && <RetryQuestionButton onRetry={() => onRetryQuestion(group.question.id)} />}
    </>
  )
}

/**
 * Per-material adaptive guidance for the next run: the same reader the
 * practice config uses, so the summary never invents a second band model.
 * A material with no observations reads as an honest cold start.
 */
function AdaptiveAdvisory({
  materialIds,
  materialTitles,
  mastery,
}: {
  materialIds: string[]
  materialTitles: Record<string, string>
  mastery: MasteryProjection[]
}) {
  const guidance = bandGuidanceByMaterial(mastery)
  const entries = [...new Set(materialIds)].filter(Boolean).map((materialId) => {
    const found = guidance.get(materialId)
    return {
      materialId,
      recommendedBand: found?.recommendedBand ?? DEFAULT_BAND,
      observations: found?.observations ?? 0,
      modelVersion: found?.modelVersion,
    }
  })

  return (
    <section className="practice-summary-adaptive" aria-label="Adaptive difficulty">
      <h3 className="practice-summary-adaptive-title">Adaptive difficulty</h3>
      <ul className="practice-summary-adaptive-list">
        {entries.map((entry) => (
          <li key={entry.materialId} className="t-body-sm">
            <strong>{materialTitles[entry.materialId] ?? 'This material'}</strong>:{' '}
            {entry.observations > 0
              ? `next run band ${entry.recommendedBand}, based on ${entry.observations} graded answer${
                  entry.observations === 1 ? '' : 's'
                } · ${entry.modelVersion}`
              : `no graded observations yet, the next run stays at band ${entry.recommendedBand}`}
          </li>
        ))}
      </ul>
      <p className="t-body-sm practice-summary-adaptive-note">
        Advisory only: rebuilt from your graded answers, and it never changes pinned roadmap
        decisions.
      </p>
    </section>
  )
}

export function PracticeSummary({
  model,
  problems,
  activeIndex,
  onSelect,
  materialTitles,
  mastery,
  panelSlot,
  onRetryQuestion,
  onBackToProblems,
}: PracticeSummaryProps) {
  const stats = summaryStats(problems, model.problems.length)
  const groups = problems.flatMap((problem) => (problem.group ? [problem.group] : []))
  const active = problems.length > 0 ? Math.min(activeIndex, problems.length - 1) : 0
  const problem = problems[active]
  const materialTitle = problem != null ? materialTitles[problem.materialId] : undefined

  return (
    <div className="ar-variant-shell ar-variant-b">
      {groups.length > 0 ? (
        <QuestionNavigator groups={groups} activeIndex={active} onSelect={onSelect} />
      ) : (
        <div />
      )}
      <div className="ar-content-col">
        <section className="practice-summary-head" aria-label="Run summary">
          <div className="practice-summary-title-row">
            <h2>Run summary</h2>
            <span className="tag tag-sm tag-moss">completed</span>
          </div>
          <p className="t-body practice-summary-line">
            {stats.graded} of {stats.total} problems graded
            {stats.correct > 0 && ` · ${stats.correct} correct`}
            {stats.failed > 0 && ` · ${stats.failed} could not be graded`}
            {stats.meanScore != null && ` · mean score ${stats.meanScore.toFixed(2)}`}
            {model.missingCount > 0 &&
              ` · ${model.missingCount} problem${model.missingCount === 1 ? '' : 's'} were not generated`}
          </p>
        </section>

        {mastery != null && (
          <AdaptiveAdvisory
            materialIds={model.materialIds}
            materialTitles={materialTitles}
            mastery={mastery}
          />
        )}

        {problem == null || !problem.group ? (
          <section className="card card-large" role="status">
            <p className="t-body-sm">No graded problems to summarise.</p>
          </section>
        ) : (
          <section className="ar-panel" aria-label={`Problem ${problem.number}`}>
            <div className="ar-panel-meta">
              <span className="tag tag-sm">Problem {problem.number}</span>
              {/* #45: the server's own question format, so a mixed run's
                  problems are distinguishable at a glance. */}
              <span className="tag tag-sm">{problem.group.question.format}</span>
              {materialTitle && (
                <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
                  from {materialTitle}
                </span>
              )}
              <span className={`tag tag-sm ${statusTagClass(problem.group.display)}`}>
                {problem.group.display}
              </span>
            </div>
            <p className="ar-panel-prompt">{problem.group.question.prompt}</p>
            {panelSlot ? (
              <div className="ar-answer-slot">{panelSlot}</div>
            ) : (
              <ProblemBody problem={problem} onRetryQuestion={onRetryQuestion} />
            )}
          </section>
        )}

        <div className="material-practice-actions practice-run-actions">
          <button type="button" className="btn btn-secondary" onClick={onBackToProblems}>
            Back to problems
          </button>
          <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
            Retrying a problem is a fresh attempt — earlier ones stay in its history.
          </span>
        </div>
      </div>
    </div>
  )
}