// PROTOTYPE — throwaway. Mock written-answer taker for the summary prototype:
// a textarea + submit that hands the text to the host, which simulates the
// grading round-trip. Mirrors the phase names of the real AttemptTaker.

import { useState } from 'react'

export function PrototypeTaker({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="attempt-taker" aria-label="Answer this question">
      <div className="field-group" style={{ marginTop: '0.75rem' }}>
        <label className="field-label" htmlFor="psp-taker-answer">
          Your answer (short answer)
        </label>
        <textarea
          id="psp-taker-answer"
          aria-label="Your answer"
          className="field"
          rows={3}
          value={text}
          disabled={submitted}
          onChange={(event) => setText(event.target.value)}
          style={{ width: '100%', resize: 'vertical' }}
        />
      </div>
      {!submitted ? (
        <div className="material-practice-actions" style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-accent"
            disabled={text.trim().length === 0}
            onClick={() => {
              setSubmitted(true)
              onSubmit(text)
            }}
          >
            Submit answer
          </button>
          <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
            Simulated — nothing is sent or saved.
          </span>
        </div>
      ) : (
        <p className="t-body-sm" role="status" aria-busy="true" style={{ marginTop: '0.75rem' }}>
          Grading your answer…
        </p>
      )}
    </div>
  )
}