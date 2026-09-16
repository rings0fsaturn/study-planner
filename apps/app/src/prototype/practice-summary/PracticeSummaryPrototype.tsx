// PROTOTYPE — throwaway. Practice run summary UX for #44 Phase 3.
// Answers: "What should the practice run summary look like, and where does a
// per-problem retry happen?" — THREE structurally different surfaces,
// switchable via ?variant=A|B|C (bottom bar / arrow keys); four run states
// via ?state=completed5|completed12|thin2|abandoned; the retry placement via
// ?retry=jump|inline. Everything is fixture-driven and in memory — no events,
// no storage, no service calls. Route is dev-only (/practice-summary-prototype).
//
// The retried problem is re-derived through the REAL practiceRunModel, so the
// summary previews the exact data shape the production Phase 3 will consume.

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PrototypeSwitcher } from '../practice-guide/PrototypeSwitcher'
import type { LocalAttemptRow } from '../../assessments/attemptFlow'
import { MATERIAL_TITLES, PROTOTYPE_STATES, buildPrototypeModel } from './practice-summary-fixtures'
import { terminalState, type SummaryVariantProps } from './practice-summary-shared'
import { PrototypeTaker } from './PrototypeTaker'
import { VariantA, VARIANT_NAME as A_NAME } from './VariantA_ReviewRail'
import { VariantB, VARIANT_NAME as B_NAME } from './VariantB_StackedReport'
import { VariantC, VARIANT_NAME as C_NAME } from './VariantC_ScoreboardAccordion'
import '../../materials/materials.css'
import './practice-summary-prototype.css'

const VARIANT_NAMES: Record<string, string> = { A: A_NAME, B: B_NAME, C: C_NAME }

function Stage({
  stateKey,
  retryMode,
  variant,
}: {
  stateKey: string
  retryMode: 'jump' | 'inline'
  variant: string
}) {
  const state = PROTOTYPE_STATES[stateKey]
  const [rows, setRows] = useState<Record<string, LocalAttemptRow[]>>(state.rowsByAssessment)
  const [view, setView] = useState<'summary' | 'run'>('summary')
  const [takingQuestionId, setTakingQuestionId] = useState<string | null>(null)

  const model = useMemo(
    () =>
      buildPrototypeModel({
        ...state,
        rowsByAssessment: rows,
      }),
    [state, rows],
  )

  const reviewed = useMemo(
    () => model.problems.filter((problem) => terminalState(problem) !== 'none'),
    [model],
  )

  const variantProps: SummaryVariantProps = {
    model,
    reviewed,
    materialTitles: MATERIAL_TITLES,
    takingQuestionId: retryMode === 'inline' ? takingQuestionId : null,
    onSubmit: handleSubmit,
    onRetry: handleRetry,
  }

  const takingProblem =
    takingQuestionId != null
      ? model.problems.find((problem) => problem.group?.question.id === takingQuestionId) ?? null
      : null

  function handleRetry(questionId: string) {
    setTakingQuestionId(questionId)
    if (retryMode === 'jump') setView('run')
  }

  function handleBack() {
    setView('summary')
    setTakingQuestionId(null)
  }

  function handleSubmit(text: string) {
    // Simulated grading round-trip: the fresh attempt lands ~1.1 s later and
    // the model re-derives, so the summary shows the new grade + history.
    const questionId = takingQuestionId
    window.setTimeout(() => {
      if (!questionId) return
      const assessment = state.assessments.find((record) =>
        record.questions.some((question) => question.id === questionId),
      )
      if (!assessment) return
      const attemptId = `att-psp-${Date.now()}`
      const fresh: LocalAttemptRow = {
        clientAttemptId: `ca-psp-${Date.now()}`,
        attemptId,
        questionId,
        assessmentId: assessment.id,
        answer: { text },
        status: 'graded',
        submittedAt: new Date().toISOString(),
        grade: {
          attemptId,
          questionId,
          materialId: assessment.materialIds[0],
          score: 1,
          correct: true,
          perSkill: [{ skillTag: 'core', score: 1, correct: true }],
          grader: 'llm_rubric',
          gradedAt: new Date().toISOString(),
          publicFeedback: 'Good — that retry landed.',
        },
      }
      setRows((previous) => ({
        ...previous,
        [assessment.id]: [...(previous[assessment.id] ?? []), fresh],
      }))
      setView('summary')
      setTakingQuestionId(null)
    }, 1100)
  }

  const statusLine =
    model.outcome === 'completed'
      ? 'Run complete — every problem has a grade.'
      : model.outcome === 'abandoned'
        ? 'Run abandoned. Grades already earned stay in your history.'
        : 'Summary preview.'

  return (
    <div className="materials-page psp-page">
      <button type="button" className="btn btn-ghost btn-sm" disabled>
        ← Back to material
      </button>
      <h1 style={{ margin: '0.5rem 0 0.25rem', font: '2rem var(--font-display)', lineHeight: 1.1 }}>
        Practice run
      </h1>
      <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        {statusLine}
      </p>
      <p className="psp-state-line t-mono-sm" role="status">
        {model.runId} · outcome {model.outcome ?? 'in-progress'} · {reviewed.length} of{' '}
        {model.problems.length} problems in the summary · retry {retryMode} · variant {variant}
      </p>

      {view === 'run' && takingProblem?.group ? (
        <div className="ar-variant-shell ar-variant-b">
          <div />
          <div className="ar-content-col">
            <section className="ar-panel" aria-label={`Problem ${takingProblem.number}`}>
              <div className="ar-panel-meta">
                <span className="tag tag-sm">Problem {takingProblem.number}</span>
                {MATERIAL_TITLES[takingProblem.materialId] && (
                  <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
                    from {MATERIAL_TITLES[takingProblem.materialId]}
                  </span>
                )}
              </div>
              <p className="ar-panel-prompt">{takingProblem.group.question.prompt}</p>
              <div className="ar-answer-slot">
                <PrototypeTaker onSubmit={handleSubmit} />
              </div>
            </section>
            <div className="material-practice-actions practice-run-actions">
              <button type="button" className="btn btn-secondary" onClick={handleBack}>
                ← Back to summary
              </button>
              <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
                This is the run screen the retry would land on (jump mode).
              </span>
            </div>
          </div>
        </div>
      ) : variant === 'B' ? (
        <VariantB {...variantProps} />
      ) : variant === 'C' ? (
        <VariantC {...variantProps} />
      ) : (
        <VariantA {...variantProps} />
      )}
    </div>
  )
}

export default function PracticeSummaryPrototype() {
  const [params, setParams] = useSearchParams()
  const variant = (params.get('variant') ?? 'A').toUpperCase()
  const stateKey = params.get('state') ?? 'completed5'
  const retryMode: 'jump' | 'inline' = params.get('retry') === 'inline' ? 'inline' : 'jump'
  const [copied, setCopied] = useState(false)

  function setParam(param: string, value: string) {
    const next = new URLSearchParams(params)
    next.set(param, value)
    setParams(next, { replace: true })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const state = PROTOTYPE_STATES[stateKey] ?? PROTOTYPE_STATES.completed5

  return (
    <div className="psp">
      <header className="psp-head">
        <div className="psp-eyebrow">Prototype · #44 Phase 3 · throwaway</div>
        <h1 className="psp-title">Practice run summary</h1>
        <p className="psp-sub">
          The completion view for a written practice run. Three structurally different surfaces —
          flip them with the bottom bar or ← →. Decide where a per-problem retry should happen
          (jump to the run screen, or inline), and whether abandoned runs deserve a summary too.
        </p>
      </header>

      <div className="psp-toolbar" role="toolbar" aria-label="Prototype controls">
        <div className="psp-tool-group">
          <span className="psp-tool-label">Run state</span>
          {Object.values(PROTOTYPE_STATES).map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={`psp-tool-btn${stateKey === entry.key ? ' is-active' : ''}`}
              onClick={() => setParam('state', entry.key)}
            >
              {entry.title}
            </button>
          ))}
        </div>
        <div className="psp-tool-group">
          <span className="psp-tool-label">Retry placement</span>
          <button
            type="button"
            className={`psp-tool-btn${retryMode === 'jump' ? ' is-active' : ''}`}
            onClick={() => setParam('retry', 'jump')}
          >
            jump to run screen
          </button>
          <button
            type="button"
            className={`psp-tool-btn${retryMode === 'inline' ? ' is-active' : ''}`}
            onClick={() => setParam('retry', 'inline')}
          >
            inline in summary
          </button>
        </div>
        <div className="psp-tool-group">
          <button type="button" className="psp-tool-btn" onClick={() => void copyLink()}>
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      </div>
      <p className="psp-blurb t-body-sm">{state.blurb}</p>

      <Stage key={`${stateKey}:${retryMode}`} stateKey={stateKey} retryMode={retryMode} variant={variant} />

      <div className="psp-note">
        <strong>How to drive it:</strong> flip <code>A / B / C</code> with the bottom bar (or ← →
        keys). On <em>Completed · 5</em>: problem 2 was <strong>retried</strong> (history preserved),
        problem 5 <strong>could not be graded</strong> (honest state + retry). Press a problem&rsquo;s{' '}
        <em>Retry question</em> in both retry modes to feel the difference. The <em>12-problem</em>{' '}
        state checks density; <em>abandoned</em> shows 2 of 4 graded with in-flight and
        never-answered problems simply not listed — the current plan lands on the summary only for
        completed runs, so say if abandoned should get one too. Check the surfaces at 375px and
        desktop. Nothing persists; submitting simulates a grade and keeps the attempt history.
      </div>

      <PrototypeSwitcher names={VARIANT_NAMES} />
    </div>
  )
}