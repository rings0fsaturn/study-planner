// PROTOTYPE — throwaway. Variant A: the "review rail" — the #40-style
// QuestionNavigator (280px rail on desktop, sticky strip below) with one
// active problem panel. This is the shape the Phase 3 plan assumed (D-04).

import { useState } from 'react'
import { QuestionNavigator } from '../../pages/assessments/review/ReviewSurface'
import { PrototypeTaker } from './PrototypeTaker'
import {
  ProblemBody,
  SummaryHead,
  materialLabel,
  statusTagClass,
  summaryStats,
  type SummaryVariantProps,
} from './practice-summary-shared'

export const VARIANT_NAME = 'Review rail'

export function VariantA({
  model,
  reviewed,
  materialTitles,
  takingQuestionId,
  onSubmit,
  onRetry,
}: SummaryVariantProps) {
  const [active, setActive] = useState(0)
  const stats = summaryStats(reviewed, model.problems.length)
  const problem = reviewed[Math.min(active, reviewed.length - 1)]
  const groups = reviewed.flatMap((entry) => (entry.group ? [entry.group] : []))
  const taking =
    takingQuestionId != null && problem?.group?.question.id === takingQuestionId

  return (
    <div className="ar-variant-shell ar-variant-b">
      {groups.length > 0 ? (
        <QuestionNavigator
          groups={groups}
          activeIndex={Math.min(active, groups.length - 1)}
          onSelect={setActive}
        />
      ) : (
        <div />
      )}
      <div className="ar-content-col">
        <SummaryHead stats={stats} missingCount={model.missingCount} abandoned={model.outcome === 'abandoned'} />
        {problem == null || !problem.group ? (
          <section className="card card-large" role="status">
            <p className="t-body-sm">No graded problems to summarise.</p>
          </section>
        ) : (
          <section className="ar-panel" aria-label={`Problem ${problem.number}`}>
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
              <div className="ar-answer-slot">
                <PrototypeTaker onSubmit={onSubmit} />
              </div>
            ) : (
              <ProblemBody problem={problem} onRetry={onRetry} />
            )}
          </section>
        )}
      </div>
    </div>
  )
}