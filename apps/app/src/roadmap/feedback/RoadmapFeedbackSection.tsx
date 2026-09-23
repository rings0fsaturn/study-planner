/**
 * Roadmap feedback section (#47) - Variant B "Evidence ledger" from #35.
 *
 * Advisory only: it never writes a booking or an event. Keep roadmap is an
 * acknowledgement (the one-band guidance already feeds the next Adaptive run);
 * Open replan navigates to the existing replan flow.
 *
 * The learner-facing copy comes from a `FeedbackCopyProvider`; #47 ships the
 * static provider and #50 swaps in the LLM one behind the same seam.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useEventStore } from '../../events/useEventStore'
import { useAssessmentClient } from '../../assessments/AssessmentProvider'
import { useRoadmapFeedback } from './useRoadmapFeedback'
import { staticFeedbackProvider } from './feedbackCopy'
import type {
  FeedbackCopy,
  FeedbackCopyProvider,
  FeedbackRead,
  FeedbackState,
} from './types'
import './feedback.css'

type BoundaryChoice = 'keep' | 'replan'

const STATE_LABEL: Record<FeedbackState, string> = {
  cold: 'Still learning about you',
  updated: 'Feedback refreshed',
  stale: 'Feedback needs a refresh',
  rebuilding: 'Refreshing feedback',
}

const MARK_LABEL: Record<FeedbackRead, string> = {
  clear: 'Clear',
  mixed: 'Mixed',
  revisit: 'Revisit',
}

/** Keep the trail scannable; the full projection stays behind the material link. */
const MAX_EVIDENCE_ROWS = 5

interface RoadmapFeedbackSectionProps {
  materialIds: string[]
  materialTitlesById: Map<string, string>
  pinnedTitle: string
  pinnedDetail: string
  copyProvider?: FeedbackCopyProvider
}

function AdvisoryBox({ copy, onReview }: { copy: FeedbackCopy; onReview: () => void }) {
  return (
    <section className="rfb-advisory" aria-label="Advisory recommendation">
      <div className="rfb-kicker">Advisory recommendation</div>
      <strong>{copy.advisory}</strong>
      <p>{copy.advisoryNote}</p>
      <button type="button" className="rfb-link-button" onClick={onReview}>
        Review before applying
      </button>
    </section>
  )
}

function PinnedPlan({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="rfb-pinned" aria-label="Pinned roadmap decisions">
      <div className="rfb-kicker">Pinned roadmap</div>
      <strong>{title}</strong>
      <p>{detail}</p>
      <span className="rfb-pin-mark">Decisions stay fixed until you choose to replan.</span>
    </section>
  )
}

function ModelContext({
  modelVersion,
  observations,
  uncertainty,
  currentBand,
  recommendedBand,
  target,
  stale,
}: {
  modelVersion: string
  observations: number
  uncertainty: number
  currentBand: number
  recommendedBand: number
  target: number
  stale: boolean
}) {
  return (
    <details className="rfb-model-context" data-testid="rfb-model-context">
      <summary>Model context</summary>
      <dl>
        <div><dt>Model</dt><dd>{modelVersion}</dd></div>
        <div><dt>Graded observations</dt><dd>{observations}</dd></div>
        <div><dt>Uncertainty</dt><dd>{uncertainty.toFixed(2)}</dd></div>
        <div><dt>Difficulty band</dt><dd>{currentBand} to {recommendedBand}</dd></div>
        <div><dt>Target correctness</dt><dd>{target.toFixed(2)}</dd></div>
        {stale && <div><dt>Projection</dt><dd>Needs rebuild</dd></div>}
      </dl>
      <p>Model context only. The plain-language summary above is what the learner reads.</p>
    </details>
  )
}

function ReviewDialog({
  onConfirm,
  onClose,
}: {
  onConfirm: (choice: BoundaryChoice) => void
  onClose: () => void
}) {
  const [choice, setChoice] = useState<BoundaryChoice>('keep')
  const dialogRef = useRef<HTMLElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null
    const node = dialogRef.current
    node?.querySelector<HTMLButtonElement>('button')?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled'))
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      restoreRef.current?.focus()
    }
  }, [onClose])

  return (
    <div className="rfb-dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="rfb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rfb-dialog-title"
        aria-describedby="rfb-dialog-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rfb-kicker">Explicit choice</div>
        <h2 id="rfb-dialog-title">Use this recommendation?</h2>
        <p id="rfb-dialog-desc">
          The model can suggest a different difficulty. It cannot rewrite the pinned sessions for you.
        </p>
        <div className="rfb-choice-list" role="radiogroup" aria-label="Recommendation boundary">
          <button
            type="button"
            role="radio"
            aria-checked={choice === 'keep'}
            className={choice === 'keep' ? 'rfb-choice is-selected' : 'rfb-choice'}
            onClick={() => setChoice('keep')}
          >
            <strong>Keep roadmap</strong>
            <span>Use the suggestion in the next assessment only.</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={choice === 'replan'}
            className={choice === 'replan' ? 'rfb-choice is-selected' : 'rfb-choice'}
            onClick={() => setChoice('replan')}
          >
            <strong>Open replan</strong>
            <span>Review a new schedule before anything changes.</span>
          </button>
        </div>
        <div className="rfb-dialog-actions">
          <button type="button" className="rfb-button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="rfb-button rfb-button-dark"
            onClick={() => onConfirm(choice)}
          >
            {choice === 'keep' ? 'Keep and continue' : 'Review replan'}
          </button>
        </div>
      </section>
    </div>
  )
}

export function RoadmapFeedbackSection({
  materialIds,
  materialTitlesById,
  pinnedTitle,
  pinnedDetail,
  copyProvider = staticFeedbackProvider,
}: RoadmapFeedbackSectionProps) {
  const eventStore = useEventStore()
  const client = useAssessmentClient()
  const navigate = useNavigate()
  const feedback = useRoadmapFeedback(eventStore, client, materialIds)
  const [copy, setCopy] = useState<FeedbackCopy | null>(null)
  const [reviewing, setReviewing] = useState(false)

  const { state, projections, recommendation, evidence, headline, rebuild } = feedback

  useEffect(() => {
    let cancelled = false
    const result = copyProvider({
      state,
      materialTitles: [...materialTitlesById.values()],
      projections,
      recommendation,
      evidence,
    })
    // Sync providers resolve on the spot; an async provider (#50) lands later.
    if (typeof (result as Promise<FeedbackCopy>).then === 'function') {
      void (result as Promise<FeedbackCopy>).then((next) => {
        if (!cancelled) setCopy(next)
      })
    } else {
      setCopy(result as FeedbackCopy)
    }
    return () => {
      cancelled = true
    }
  }, [copyProvider, state, projections, recommendation, evidence, materialTitlesById])

  if (!copy) return null

  const totalObservations = projections.reduce((sum, projection) => sum + projection.n, 0)

  return (
    <section className="rfb-section" aria-label="Learning feedback" data-testid="roadmap-feedback">
      <header className="rfb-head">
        <div>
          <div className="rfb-kicker">Progress / Learning story</div>
          <h2 className="rfb-title">Your learning feedback</h2>
          <p className="rfb-muted">
            A short explanation of what your recent work suggests and what to do next.
          </p>
        </div>
        <div className="rfb-state-row">
          <span className={`rfb-state rfb-state-${state}`} role="status" aria-live="polite">
            {STATE_LABEL[state]}
          </span>
          {state === 'stale' && (
            <button type="button" className="rfb-button" onClick={rebuild}>
              Rebuild from grades
            </button>
          )}
        </div>
      </header>

      <section className="rfb-story-card" aria-label="Learning feedback summary">
        <div className="rfb-story-card-head">
          <span className="rfb-story-badge">Learning signal</span>
          <span className="rfb-story-source">Based on your graded work</span>
        </div>
        <p className="rfb-story-summary">{copy.summary}</p>
        <div className="rfb-story-columns">
          <div>
            <div className="rfb-kicker">What we know</div>
            <strong>{copy.knowTitle}</strong>
            <p>{copy.knowBody}</p>
          </div>
          <div>
            <div className="rfb-kicker">What we are watching</div>
            <strong>{copy.watchTitle}</strong>
            <p>{copy.watchBody}</p>
          </div>
        </div>
      </section>

      <div className="rfb-grid">
        <section className="rfb-evidence" aria-label="Evidence trail">
          <div className="rfb-evidence-head">
            <div>
              <div className="rfb-kicker">Evidence trail</div>
              <h3>Work behind this summary</h3>
            </div>
            <span className="rfb-version">Inspectable</span>
          </div>
          {evidence.length === 0 ? (
            <p className="rfb-muted">No graded work yet. Take an assessment or practice run to start the trail.</p>
          ) : (
            <>
              {evidence.slice(0, MAX_EVIDENCE_ROWS).map((row) => (
                <Link
                  className="rfb-evidence-row"
                  key={`${row.materialId}:${row.skillTag}`}
                  to={`/materials/${row.materialId}`}
                >
                  <span className="rfb-evidence-skill">{row.skillTag}</span>
                  <span className="rfb-evidence-material">
                    {materialTitlesById.get(row.materialId) ?? 'Material'}
                  </span>
                  <span className="rfb-evidence-meta">
                    {row.observations} graded attempt{row.observations === 1 ? '' : 's'}
                  </span>
                  <span className={`rfb-mark rfb-mark-${row.read}`}>{MARK_LABEL[row.read]}</span>
                </Link>
              ))}
              {evidence.length > MAX_EVIDENCE_ROWS && (
                <p className="rfb-evidence-more">
                  Showing the {MAX_EVIDENCE_ROWS} most-practised skills of {evidence.length}.
                </p>
              )}
            </>
          )}
        </section>

        <aside className="rfb-aside">
          <AdvisoryBox copy={copy} onReview={() => setReviewing(true)} />
          <PinnedPlan title={pinnedTitle} detail={pinnedDetail} />
          {headline && recommendation && (
            <ModelContext
              modelVersion={headline.modelVersion}
              observations={totalObservations}
              uncertainty={headline.uncertainty}
              currentBand={recommendation.currentBand}
              recommendedBand={recommendation.recommendedBand}
              target={recommendation.targetExpectedCorrectness}
              stale={state === 'stale'}
            />
          )}
        </aside>
      </div>

      {reviewing && (
        <ReviewDialog
          onConfirm={(choice) => {
            setReviewing(false)
            if (choice === 'replan') navigate('/replan')
          }}
          onClose={() => setReviewing(false)}
        />
      )}
    </section>
  )
}
