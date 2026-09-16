// PROTOTYPE — throwaway. Variant B: the "stacked report" — every reviewed
// problem as a full card in one scrolling column, problems needing attention
// first (ungradable, then incorrect, partial, correct), no navigator. The
// summary is a report you read top to bottom, not a surface you navigate.

import { useMemo } from 'react'
import { PrototypeTaker } from './PrototypeTaker'
import {
  ProblemBody,
  SummaryHead,
  materialLabel,
  statusTagClass,
  summaryStats,
  terminalState,
  type SummaryVariantProps,
} from './practice-summary-shared'

export const VARIANT_NAME = 'Stacked report'

const ATTENTION_ORDER: Record<string, number> = {
  failed: 0,
  incorrect: 1,
  partial: 2,
  correct: 3,
}

export function VariantB({
  model,
  reviewed,
  materialTitles,
  takingQuestionId,
  onSubmit,
  onRetry,
}: SummaryVariantProps) {
  const stats = summaryStats(reviewed, model.problems.length)

  const ordered = useMemo(
    () =>
      [...reviewed].sort((a, b) => {
        const aKey = terminalState(a) === 'failed' ? 'failed' : (a.group?.display ?? 'pending')
        const bKey = terminalState(b) === 'failed' ? 'failed' : (b.group?.display ?? 'pending')
        const byAttention = ATTENTION_ORDER[aKey] - ATTENTION_ORDER[bKey]
        return byAttention !== 0 ? byAttention : a.number - b.number
      }),
    [reviewed],
  )

  return (
    <div className="psp-stack">
      <SummaryHead stats={stats} missingCount={model.missingCount} abandoned={model.outcome === 'abandoned'} />
      <ol className="psp-stack-list">
        {ordered.map((problem) => {
          if (!problem.group) return null
          const taking = takingQuestionId === problem.group.question.id
          return (
            <li key={problem.assessmentId} className="psp-stack-item">
              <div className="ar-panel-meta">
                <span className="tag tag-sm">Problem {problem.number}</span>
                {materialLabel(problem, materialTitles) && (
                  <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
                    from {materialLabel(problem, materialTitles)}
                  </span>
                )}
                <span className={`tag tag-sm ${statusTagClass(problem.group.display)}`}>
                  {problem.group.display}
                </span>
              </div>
              <p className="ar-panel-prompt">{problem.group.question.prompt}</p>
              {taking ? (
                <PrototypeTaker onSubmit={onSubmit} />
              ) : (
                <ProblemBody problem={problem} onRetry={onRetry} />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}