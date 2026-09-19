import { Suspense, lazy, useEffect, useState } from 'react'
import {
  QUESTION_ATTEMPTED,
  QUESTION_GRADED,
} from '../../events/EventStore'
import { useAssessmentClient } from '../../assessments/AssessmentProvider'
import {
  createAttemptFlow,
  writtenAnswerProblem,
  type AttemptFlow,
  type LocalAttemptRow,
} from '../../assessments/attemptFlow'
import { WRITTEN_ANSWER_MAX_LENGTH, OUTPUT_PREDICTION_SUBTYPE } from '../../assessments/types'
import type { Assessment, ObjectiveAnswer, Question } from '../../assessments/types'
import { useEventStoreContext } from '../../events/EventStoreProvider'
import { OutputPredictionTaker } from './OutputPredictionTaker'

/**
 * The coding branch (editor + advisory run) stays out of the main bundle
 * (#42 D-06): CodeMirror + Pyodide load only when a coding question renders.
 */
const CodingTaker = lazy(() =>
  import('./CodingTaker').then((module) => ({ default: module.CodingTaker })),
)

/**
 * Attempt taking for one question — objective (#39 D-06) or written (#41
 * D-04: textarea sized by the authored subtype, same verified phases).
 *
 * Lean honest states only — the #34 split-pane review surface is #40's scope.
 * The answer lives in the local unsynced row and the server attempts table;
 * the durable QuestionAttempted event stays answer-free by contract.
 */

interface AttemptTakerProps {
  assessment: Assessment
  question: Question
  onAttemptRecorded?: () => void
}

type TakingPhase = 'answering' | 'submitting' | 'queued-offline' | 'grading' | 'graded' | 'failed'

export function AttemptTaker({ assessment, question, onAttemptRecorded }: AttemptTakerProps) {
  const { eventStore } = useEventStoreContext()
  const [phase, setPhase] = useState<TakingPhase>('answering')
  const [answer, setAnswer] = useState<ObjectiveAnswer>({})
  const [text, setText] = useState('')
  const [attempts, setAttempts] = useState<LocalAttemptRow[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isWritten = question.format === 'written'
  const isCoding = question.format === 'coding'
  // The fourth coding subtype never runs the sandbox (D-01): it renders the
  // read-only snippet + value input instead of the editor branch.
  const isOutputPrediction = isCoding && question.subtype === OUTPUT_PREDICTION_SUBTYPE
  const writtenProblem = isWritten ? writtenAnswerProblem(text) : null

  // Local flow bound to this render's event store (per-user Dexie).
  const [flow, setFlow] = useState<AttemptFlow | null>(null)
  const serviceClient = useAssessmentClient()
  useEffect(() => {
    if (!eventStore) {
      setFlow(null)
      return
    }
    const db = (eventStore as unknown as { db: import('dexie').Dexie }).db
    // The transport is the injected assessment client's AttemptTransport view
    // (AssessmentClientLike.transport); no hidden fetches here.
    setFlow(
      createAttemptFlow({
        db,
        eventStore,
        transport: serviceClient.transport,
      }),
    )
    void refreshAttempts(db, assessment.id, setAttempts)
  }, [eventStore, assessment.id, serviceClient])

  async function refreshAttempts(db: import('dexie').Dexie, assessmentId: string, apply: (rows: LocalAttemptRow[]) => void) {
    const rows = (await db
      .table('assessmentAttempts')
      .where('assessmentId')
      .equals(assessmentId)
      .toArray()) as LocalAttemptRow[]
    apply(rows)
  }

  async function submit() {
    if (!flow) return
    setPhase('submitting')
    setSubmitError(null)
    const result = isWritten
      ? await flow.submitWrittenAttempt(assessment, question, text, undefined)
      : await flow.submitObjectiveAttempt(assessment, question, answer, undefined)
    await afterSubmit(result)
  }

  /**
   * Shared post-submit path: the coding branch calls this back with its own
   * submit result. Coding grades run a sandbox per hidden test, so the poll
   * window honours seconds, not milliseconds.
   */
  async function afterSubmit(result: { local: LocalAttemptRow; online: boolean }) {
    setAttempts(await flow!.listLocalAttempts(assessment.id))
    if (!result.online) {
      setPhase('queued-offline')
      setSubmitError(result.local.submitError ?? 'You appear to be offline.')
      return
    }
    setPhase('grading')
    // The grade normally lands within a second (deterministic queue arm);
    // the coding arm runs a sandbox per test, so it takes seconds.
    const graded = await flow!.pollGrade(
      result.local.clientAttemptId,
      assessment.id,
      isWritten ? 'llm_rubric' : isCoding && !isOutputPrediction ? 'judge0' : 'objective',
    )
    setAttempts(await flow!.listLocalAttempts(assessment.id))
    setPhase(graded.status === 'graded' ? 'graded' : graded.status === 'failed' ? 'failed' : 'grading')
    onAttemptRecorded?.()
  }

  async function retry() {
    setPhase('answering')
    setAnswer({})
    setText('')
  }

  function optionSelected(index: number): boolean {
    return answer.index === index
  }

  function selectOption(index: number) {
    setAnswer({ index })
  }

  const latest = attempts.length > 0 ? attempts[attempts.length - 1] : null

  // Coding renders through the lazy editor branch (#42 D-06); the
  // output-prediction subtype renders its own small value input (D-01). The
  // shared post-submit states below stay identical so the retry/history
  // contract holds for all three families; only the grading copy names the
  // sandbox.
  if (isCoding && flow) {
    return (
      <div className="attempt-taker" aria-label="Answer this question">
        {isOutputPrediction ? (
          <OutputPredictionTaker
            assessment={assessment}
            question={question}
            flow={flow}
            phase={phase === 'submitting' || phase === 'grading' ? phase : 'answering'}
            onSubmitting={() => setPhase('submitting')}
            onSubmitted={(result) => void afterSubmit(result)}
            onAttemptRecorded={onAttemptRecorded}
          />
        ) : (
          <Suspense
            fallback={
              <p className="t-body-sm" role="status" style={{ marginTop: '0.75rem', color: 'var(--text-tertiary)' }}>
                Loading the code editor…
              </p>
            }
          >
            <CodingTaker
              assessment={assessment}
              question={question}
              flow={flow}
              phase={phase === 'submitting' || phase === 'grading' ? phase : 'answering'}
              onSubmitting={() => setPhase('submitting')}
              onSubmitted={(result) => void afterSubmit(result)}
              onAttemptRecorded={onAttemptRecorded}
            />
          </Suspense>
        )}
        {phase === 'grading' && (
          <p className="t-body-sm" role="status" aria-busy="true" style={{ marginTop: '0.75rem', color: 'var(--text-tertiary)' }}>
            {isOutputPrediction
              ? 'Grading…'
              : 'Grading in the sandbox - this takes a few seconds…'}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="attempt-taker" aria-label="Answer this question">
      {/* Answer controls: written textarea (#41 D-04) or the objective shapes (D-06). */}
      {isWritten ? (
        <div className="field-group" style={{ marginTop: '0.75rem' }}>
          <label className="field-label" htmlFor={`${question.id}-written-answer`}>
            Your answer{question.subtype === 'long_form' ? ' (long form)' : question.subtype === 'short_answer' ? ' (short answer)' : ''}
          </label>
          <textarea
            id={`${question.id}-written-answer`}
            aria-label="Your answer"
            className="field"
            rows={question.subtype === 'long_form' ? 8 : 3}
            value={text}
            disabled={phase !== 'answering'}
            onChange={(event) => setText(event.target.value)}
            style={{ width: '100%', resize: 'vertical' }}
          />
          <p className="field-hint">
            {WRITTEN_ANSWER_MAX_LENGTH - text.length} characters left · graded against the
            question&rsquo;s criteria, with the same source evidence you can open below.
          </p>
        </div>
      ) : question.options.length > 0 ? (
        <div role="radiogroup" aria-label="Answer options" style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
          {question.options.map((option, index) => (
            <label
              key={`${question.id}-opt-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.6rem',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                cursor: phase === 'answering' ? 'pointer' : 'default',
                background: optionSelected(index) ? 'var(--surface-recessed)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name={`${question.id}-answer`}
                checked={optionSelected(index)}
                disabled={phase !== 'answering'}
                onChange={() => selectOption(index)}
              />
              <span>{option}</span>
              {optionSelected(index) && <span className="tag tag-sm">your answer</span>}
            </label>
          ))}
        </div>
      ) : (
        <input
          type="text"
          aria-label="Your answer"
          value={answer.value ?? ''}
          disabled={phase !== 'answering'}
          onChange={(event) => setAnswer({ value: event.target.value })}
          style={{ marginTop: '0.75rem', width: '100%' }}
        />
      )}

      {phase === 'answering' && (
        <div className="material-practice-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-accent"
            disabled={isWritten ? writtenProblem != null : answer.index === undefined && !answer.value}
            onClick={() => void submit()}
          >
            Submit answer
          </button>
          {isWritten && writtenProblem && text.length > 0 && (
            <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
              {writtenProblem}
            </span>
          )}
        </div>
      )}

      {phase === 'submitting' && (
        <p className="t-body-sm" role="status" style={{ marginTop: '0.75rem', color: 'var(--text-tertiary)' }}>
          Submitting your answer…
        </p>
      )}

      {phase === 'queued-offline' && (
        <div role="status" style={{ marginTop: '0.75rem' }}>
          <p className="t-body-sm" style={{ color: 'var(--terracotta-d)' }}>
            Queued offline — your answer will grade automatically when you reconnect.
          </p>
          {submitError && (
            <p className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
              {submitError}
            </p>
          )}
        </div>
      )}

      {phase === 'grading' && (
        <p className="t-body-sm" role="status" aria-busy="true" style={{ marginTop: '0.75rem', color: 'var(--text-tertiary)' }}>
          Grading…
        </p>
      )}

      {phase === 'graded' && latest?.grade && (
        <div role="status" style={{ marginTop: '1rem' }}>
          <p className="t-body" style={{ fontWeight: 600 }}>
            Score {latest.grade.score.toFixed(2)} · {latest.grade.correct ? 'correct' : 'not correct'}
          </p>
          {latest.grade.perSkill && latest.grade.perSkill.length > 0 && (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
              {latest.grade.perSkill.map((observation) => (
                <li key={observation.skillTag} className="t-body-sm">
                  {observation.skillTag}: {observation.correct ? 'correct' : 'not yet'}
                </li>
              ))}
            </ul>
          )}
          {(latest.grade.publicFeedback ?? latest.grade.explanation) && (
            <p className="t-body-sm" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
              {latest.grade.publicFeedback ?? latest.grade.explanation}
            </p>
          )}
          {isWritten && (latest.grade.rubricBreakdown?.length ?? 0) > 0 && (
            <p className="t-body-sm" style={{ marginTop: '0.5rem', color: 'var(--text-tertiary)' }}>
              The full criterion breakdown is in the review panel for this question.
            </p>
          )}
        </div>
      )}

      {phase === 'failed' && (
        <p className="t-body-sm" role="status" style={{ marginTop: '0.75rem', color: 'var(--rust, var(--terracotta-d))' }}>
          This attempt could not be graded.
        </p>
      )}

      {(phase === 'graded' || phase === 'failed' || phase === 'queued-offline') && (
        <div className="material-practice-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void retry()}>
            Retry question
          </button>
          <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
            A retry is a fresh attempt — previous attempts stay in your history.
          </span>
        </div>
      )}

      {attempts.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3 className="t-display-3" style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            Attempt history ({attempts.length})
          </h3>
          <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
            {attempts.map((attempt, index) => (
              <li key={attempt.clientAttemptId} className="t-body-sm" style={{ color: 'var(--text-secondary)' }}>
                Attempt #{index + 1} · {attempt.status}
                {attempt.grade ? ` · score ${attempt.grade.score.toFixed(2)}` : ''}
                {attempt.submitError ? ' · queued for reconnect' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Re-exported for tests asserting the event contract through the UI.
export { QUESTION_ATTEMPTED, QUESTION_GRADED }
