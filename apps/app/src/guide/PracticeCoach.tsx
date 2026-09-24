/**
 * The anchored coach popover (#46, Variant C, production port).
 *
 * A warm paper card that floats over the practice panel: it offers help
 * without forcing it, streams the Socratic hint for the current tier, and
 * gates the final worked step behind an explicit inline confirm (never a
 * modal). Reveal content is LLM prose grounded in the material - the authored
 * reference solution never leaves the server.
 */

import { TIER_LABEL } from './types'
import type { PracticeGuide, GuideTrigger } from './usePracticeGuide'
import './practiceCoach.css'

const TRIGGER_LABEL: Record<GuideTrigger, string> = {
  idle: "You've paused for a bit",
  failedRun: 'A test just failed',
  stuck: 'You asked for a hand',
}

function Dots() {
  return (
    <span className="processing-dots processing-dots-inline" aria-hidden="true">
      <span className="processing-dot" />
      <span className="processing-dot" />
      <span className="processing-dot" />
    </span>
  )
}

interface PracticeCoachProps {
  guide: PracticeGuide
  activeLine?: number
}

export function PracticeCoach({ guide, activeLine }: PracticeCoachProps) {
  if (guide.status === 'idle') return null

  const offered = guide.status === 'offered'
  const showText = !offered && guide.text.length > 0
  const awaitingFirstToken = !offered && guide.streaming && !showText

  return (
    // A non-modal, non-focus-stealing popover (offer-never-force): a labelled
    // region, not a dialog that would imply focus movement.
    <section className="coach" role="region" aria-label="Practice coach">
      <div className="coach-head">
        <h2 className="coach-title">Practice coach</h2>
        {activeLine ? <span className="coach-line">Line {activeLine}</span> : null}
        <button
          type="button"
          className="btn btn-ghost btn-sm coach-close"
          onClick={guide.dismiss}
          aria-label="Dismiss practice coach"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {offered ? (
        <>
          {guide.trigger && <p className="coach-trigger">{TRIGGER_LABEL[guide.trigger]}</p>}
          <p className="coach-body">
            Want a hint? I&rsquo;ll ask you a question first - never the answer.
          </p>
          <div className="coach-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={guide.accept}>
              Yes, help me
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={guide.dismiss}>
              Not now
            </button>
          </div>
        </>
      ) : (
        <>
          {guide.tier && (
            <div className="coach-tier-row">
              <span
                className={`tag tag-sm coach-tier${guide.atReveal ? ' tag-rust' : ''}`}
              >
                {TIER_LABEL[guide.tier]}
              </span>
              <span className="coach-ladder" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className="coach-dot"
                    data-on={index <= guide.tierIndex}
                    data-current={index === guide.tierIndex}
                  />
                ))}
              </span>
            </div>
          )}

          <div className="coach-body" aria-busy={guide.streaming}>
            {awaitingFirstToken ? <Dots /> : null}
            {showText ? <span>{guide.text}</span> : null}
            {!showText && !awaitingFirstToken && guide.streaming ? <Dots /> : null}
          </div>

          {guide.citations.length > 0 && (
            <details className="coach-citations">
              <summary>
                {guide.citations.length} source{guide.citations.length === 1 ? '' : 's'}
              </summary>
              <ul>
                {guide.citations.map((citation, index) => (
                  <li key={`${citation.chunkId}-${index}`}>
                    <span className="coach-quote">&ldquo;{citation.quote}&rdquo;</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {guide.atReveal && guide.revealed && showText ? (
            <div className="coach-reveal">
              <p className="coach-reveal-note">
                A reference to check against, not to paste.
              </p>
            </div>
          ) : null}

          {guide.error && (
            <p className="coach-error" role="status">
              {guide.error}
            </p>
          )}

          <div className="coach-actions">
            {!guide.atReveal && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={guide.next}
                disabled={guide.streaming}
              >
                Go deeper
              </button>
            )}

            {guide.atReveal && !guide.revealed && guide.revealAvailable && (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={guide.confirmReveal}
                  disabled={guide.streaming}
                >
                  Reveal a worked step
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={guide.dismiss}>
                  Not yet
                </button>
              </>
            )}

            {guide.atReveal && !guide.revealed && !guide.revealAvailable && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={guide.dismiss}>
                Got it
              </button>
            )}

            {(!guide.atReveal || guide.revealed) && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={guide.dismiss}>
                Got it
              </button>
            )}
          </div>

          {guide.atReveal && !guide.revealed && !guide.revealAvailable && (
            <p className="coach-gate-note">
              Submit an attempt first - then you can reveal a worked step.
            </p>
          )}
        </>
      )}
    </section>
  )
}
