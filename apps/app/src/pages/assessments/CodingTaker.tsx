/**
 * Coding taker (#42): the editor + advisory run + submit branch for coding
 * questions. `AttemptTaker` renders this (lazily) when the question's
 * format is coding; objective and written paths are untouched.
 *
 * The contract split: the advisory run answers "does this look right on the
 * visible tests" in the browser; the server grade is the only grade. The
 * taker's own source never enters the logger - stdout stays in component
 * state, failures log one warning line.
 */

import { useEffect, useRef, useState } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { python } from '@codemirror/lang-python'
import './codingTaker.css'
import {
  CODING_SOURCE_MAX_LENGTH,
  type Question,
  type VisibleTestCase,
} from '../../assessments/types'
import {
  codingAnswerProblem,
  defaultCodingConfig,
  type AttemptFlow,
  type LocalAttemptRow,
} from '../../assessments/attemptFlow'
import { logger } from '../../lib/logger'
import {
  runAdvisoryTests,
  type AdvisoryPhase,
  type AdvisoryResult,
} from './advisoryRunner'

interface CodingTakerProps {
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

export function CodingTaker({
  assessment,
  question,
  flow,
  phase,
  onSubmitting,
  onSubmitted,
  onAttemptRecorded,
}: CodingTakerProps) {
  const tests: VisibleTestCase[] = question.visibleTests ?? []
  const [source, setSource] = useState(question.starterCode ?? '')
  const [advisoryPhase, setAdvisoryPhase] = useState<AdvisoryPhase>('idle')
  const [advisoryError, setAdvisoryError] = useState<string | null>(null)
  const [advisoryResults, setAdvisoryResults] = useState<AdvisoryResult[] | null>(null)
  const problem = codingAnswerProblem(source)
  const editing = phase === 'answering'
  const editorHostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editableRef = useRef(new Compartment())
  const sourceRef = useRef(source)
  sourceRef.current = source

  // CodeMirror mounts once; the editor is the source state. Read-only once
  // submitted.
  useEffect(() => {
    const host = editorHostRef.current
    if (!host) return
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: sourceRef.current,
        extensions: [
          // The D-06 ceiling, composed explicitly instead of `basicSetup`:
          // highlight + line numbers + sane indent. No autocompletion, no
          // lint, no fold/search keymaps, and Tab stays focus navigation.
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          python(),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) setSource(update.state.doc.toString())
          }),
          editableRef.current.of(EditorView.editable.of(editing)),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Mount once: `editing` flips through a Compartment, not a remount, so
    // the learner's caret and undo history survive submit.
  }, [])
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: editableRef.current.reconfigure(EditorView.editable.of(editing)),
    })
    const current = viewRef.current?.state.doc.toString() ?? ''
    if (editing && current !== sourceRef.current) {
      viewRef.current?.dispatch({
        changes: { from: 0, to: current.length, insert: sourceRef.current },
      })
    }
  }, [editing])

  async function runAdvisory() {
    setAdvisoryPhase('loading')
    setAdvisoryError(null)
    try {
      // The loader resolves to 'loading' only while the wasm downloads; a
      // warm second run passes through too fast to matter.
      setAdvisoryPhase('running')
      const results = await runAdvisoryTests(source, tests)
      setAdvisoryResults(results)
      setAdvisoryPhase('done')
    } catch (err) {
      logger.warn('[assessments] advisory run failed', err)
      setAdvisoryError('The in-browser check could not run. Your code is unchanged - submit for the server grade.')
      setAdvisoryPhase('idle')
    }
  }

  async function submit() {
    onSubmitting()
    const result = await flow.submitCodingAttempt(
      assessment as Parameters<AttemptFlow['submitCodingAttempt']>[0],
      question,
      source,
      defaultCodingConfig(),
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
      <span className="field-label">Your code (Python)</span>
      <div
        id={`${question.id}-code-editor`}
        ref={editorHostRef}
        role="textbox"
        aria-label="Your code"
        aria-multiline="true"
        className="field coding-editor"
      />
      <p className="field-hint">
        {CODING_SOURCE_MAX_LENGTH - source.length} characters left · graded against hidden
        tests on the server.
      </p>

      {tests.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!editing || advisoryPhase === 'loading' || advisoryPhase === 'running'}
            onClick={() => void runAdvisory()}
          >
            {advisoryPhase === 'loading' || advisoryPhase === 'running'
              ? 'Running…'
              : 'Run visible tests'}
          </button>
          <p className="t-body-sm" style={{ color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
            Advisory - the server grade is authoritative.
          </p>
          {advisoryError && (
            <p className="t-body-sm" role="status" style={{ color: 'var(--text-tertiary)' }}>
              {advisoryError}
            </p>
          )}
          {advisoryResults && (
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
              {advisoryResults.map((result) => (
                <li
                  key={result.name}
                  className="t-body-sm"
                  style={{ color: result.passed ? 'var(--text-secondary)' : 'var(--terracotta-d)' }}
                >
                  {result.name}: {result.error ?? (result.passed ? 'passed' : 'did not pass')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
          {problem && source.length > 0 && (
            <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
              {problem}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
