// PROTOTYPE — throwaway. Variant C: "scoreboard + rows" — a compact score
// band up top (mean score, correct count, per-material chips), then a dense
// list of expandable rows. One row open at a time; the retry opens the mock
// taker inside the open row. Needs-attention problems are pinned first.

import { useMemo, useState } from 'react'
import { PrototypeTaker } from './PrototypeTaker'
import {
  ProblemBody,
  materialLabel,
  statusTagClass,
  summaryStats,
  terminalState,
  type SummaryVariantProps,
} from './practice-summary-shared'

export const VARIANT_NAME = 'Scoreboard + rows'

const ATTENTION_ORDER: Record<string, number> = {
  failed: 0,
  incorrect: 1,
  partial: 2,
  correct: 3,
}

export function VariantC({
  model,
  reviewed,
  materialTitles,
  takingQuestionId,
  onSubmit,
  onRetry,
}: SummaryVariantProps) {
  const stats = summaryStats(reviewed, model.problems.length)
  const [openId, setOpenId] = useState<string | null>(null)

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

  const materialCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const problem of reviewed) {
      counts[problem.materialId] = (counts[problem.materialId] ?? 0) + 1
    }
    return counts
  }, [reviewed])

  return (
    <div className="psp-board">
      <header className="psp-board-head">
        <div className="psp-board-score">
          <span className="psp-board-score-value t-display-2">
            {stats.meanScore != null ? stats.meanScore.toFixed(2) : '—'}
          </span>
          <span className="t-body-sm psp-board-score-label">mean score</span>
        </div>
        <div className="psp-board-meta">
          <span className="t-body">
            {stats.correct} of {stats.graded} correct
          </span>
          <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
            {stats.graded} of {stats.total} problems graded
            {stats.failed > 0 && ` · ${stats.failed} could not be graded`}
          </span>
        </div>
        <div className="psp-board-materials" aria-label="Problems by material">
          {Object.entries(materialCounts).map(([materialId, count]) => (
            <span key={materialId} className="tag tag-sm">
              {materialTitles[materialId] ?? materialId} · {count}
            </span>
          ))}
        </div>
      </header>

      <ul className="psp-rows">
        {ordered.map((problem) => {
          if (!problem.group) return null
          const open = openId === problem.assessmentId
          const taking = takingQuestionId === problem.group.question.id
          return (
            <li key={problem.assessmentId} className={`psp-row is-${problem.group.display}`}>
              <button
                type="button"
                className="psp-row-head"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : problem.assessmentId)}
              >
                <span className="psp-row-num">Problem {problem.number}</span>
                <span className="psp-row-prompt">{problem.group.question.prompt}</span>
                <span className={`tag tag-sm ${statusTagClass(problem.group.display)}`}>
                  {problem.group.display}
                  {problem.group.latest?.grade != null &&
                    ` · ${problem.group.latest.grade.score.toFixed(2)}`}
                </span>
              </button>
              {open && (
                <div className="psp-row-body">
                  <div className="ar-panel-meta">
                    {materialLabel(problem, materialTitles) && (
                      <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
                        from {materialLabel(problem, materialTitles)}
                      </span>
                    )}
                  </div>
                  {taking ? (
                    <PrototypeTaker onSubmit={onSubmit} />
                  ) : (
                    <ProblemBody problem={problem} onRetry={onRetry} />
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}