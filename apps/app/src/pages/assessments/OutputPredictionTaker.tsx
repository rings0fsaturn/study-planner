/**
 * Output-prediction taker (#42 D-01): the fourth coding subtype is a numeric
 * value match, not a sandbox run. The authored snippet is read-only, the
 * learner types the value it prints, and the server grades it
 * deterministically through the objective arm. Nothing here executes code:
 * no CodeMirror, no Pyodide, so this branch stays out of the lazy chunk.
 */

import { useState } from 'react'
import type { Question } from '../../assessments/types'
import {
  predictionAnswerProblem,
  type AttemptFlow,
  type LocalAttemptRow,
} from '../../assessments/attemptFlow'
import './codingTaker.css'

interface OutputPredictionTakerProps {
  assessment: { id: string }
  question: Question
  flow: AttemptFlow
  phase: 'answering' | 'submitting' | 'grading'
  onSubmitting: () => void
  onSubmitted: (result: {
    online: boolean
    local: LocalAttemptRow
    submitError: string | null
  }) => void
  onAttemptRecorded?: () => void
}

export function OutputPredictionTaker({
  assessment,
  question,
  flow,
  phase,
  onSubmitting,
  onSubmitted,
  onAttemptRecorded,
}: OutputPredictionTakerProps) {
  const [value, setValue] = useState('')
  const problem = predictionAnswerProblem(value)
  const editing = phase === 'answering'

  async function submit() {
    onSubmitting()
    const result = await flow.submitPredictionAttempt(
      assessment as Parameters<AttemptFlow['submitPredictionAttempt']>[0],
      question,
      value,
      undefined,
    )
    if (!result.online) {
      onSubmitted({
        online: false,
        local: result.local,
        submitError: result.local.submitError ?? 'You appear to be offline.',
      })
      return
    }
    onSubmitted({ online: true, local: result.local, submitError: null })
    onAttemptRecorded?.()
  }

  return (
    <div className="field-group coding-field-group" style={{ marginTop: '0.75rem' }}>
      {question.starterCode && (
        <>
          <span className="field-label">Snippet</span>
          <pre className="coding-snippet" aria-label="Code snippet">
            {question.starterCode}
          </pre>
        </>
      )}
      <label className="field-label" htmlFor={`${question.id}-prediction`}>
        Predicted output
      </label>
      <input
        id={`${question.id}-prediction`}
        className="field coding-prediction-input"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        disabled={!editing}
        onChange={(event) => setValue(event.target.value)}
      />
      <p className="field-hint">The snippet prints exactly one numeric value. Graded on the server.</p>

      {editing && (
        <div className="material-practice-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-accent"
            disabled={problem != null}
            onClick={() => void submit()}
          >
            Submit answer
          </button>
          {problem && value.length > 0 && (
            <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
              {problem}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
