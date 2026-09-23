// PROTOTYPE - throwaway. Three roadmap/progress feedback surfaces for wayfinder issue 35.
// Question: how should mastery, uncertainty, stale projections, and advisory recommendations
// appear without silently changing pinned roadmap decisions? Mounted at /roadmap-feedback-prototype.
//
// AC4: the approved mastery/adaptive vocabulary is consumed, never redefined. Projections and the
// one-band recommendation come from `@study-tracker/progress`, the same engine the app uses
// (`apps/app/src/assessments/masteryBands.ts`), so `modelVersion`, `uncertainty`, `n`,
// `recommendedBand`, and `targetExpectedCorrectness` are the real contract values.
// HITL constraint (#35): plain language leads; model numbers are inspectable metadata only.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { projectMastery, recommendBand, type MasteryObservation } from '@study-tracker/progress';
import { DEFAULT_BAND } from '../../assessments/masteryBands';
import type { DifficultyRecommendation, MasteryProjection } from '../../assessments/types';
import { PrototypeSwitcher } from '../practice-guide/PrototypeSwitcher';
import './roadmap-feedback.css';

type ProjectionState = 'cold' | 'updated' | 'stale' | 'rebuilding';
type BoundaryChoice = 'keep' | 'replan';

interface RecordedChoice {
  /** The variant the reviewer recommends for implementation (#47). */
  variant?: string;
  /** The advisory/pinned boundary interaction the reviewer picked. */
  boundary?: BoundaryChoice;
}

interface StateCopy {
  /** State pill under the controls. */
  label: string
  /** Ribbon / callout detail line. */
  detail: string
  /** Variant B learner-facing summary. */
  summary: string
  knowTitle: string
  knowBody: string
  watchTitle: string
  watchBody: string
  meterLabel: string
  meterDetail: string
  /** Advisory recommendation body. */
  advisory: string
  advisoryNote: string
  /** Variant C headline read. */
  scoreLabel: string
  /** Variant C suggested next step. */
  nextStep: string
}

const CHOICE_KEY = 'prototype:roadmap-feedback:choice';

const VARIANT_NAMES = {
  A: 'Advisory ribbon',
  B: 'Evidence ledger',
  C: 'Progress canvas',
};

// Every state's copy in one place, so the states stay consistent across the three variants
// instead of drifting through per-component condition chains.
const STATE_COPY: Record<ProjectionState, StateCopy> = {
  cold: {
    label: 'Still learning about you',
    detail: 'There is not enough evidence to make a confident recommendation yet.',
    summary: 'You are just getting started with this material. We will wait for more practice before suggesting a change.',
    knowTitle: 'Not enough evidence yet',
    knowBody: 'Keep working at the current level so the next summary has something useful to compare.',
    watchTitle: 'Your first explanations',
    watchBody: 'We do not want to overreact to one early attempt.',
    meterLabel: 'Early signal',
    meterDetail: 'We need more attempts before this becomes useful feedback.',
    advisory: 'Keep practising at the current level while we learn what feels comfortable for you.',
    advisoryNote: 'This suggestion does not edit your roadmap.',
    scoreLabel: 'Getting started',
    nextStep: 'Stay with the current challenge',
  },
  updated: {
    label: 'Feedback refreshed',
    detail: 'Your recent work suggests you are ready for a little more challenge.',
    summary: 'You are becoming more consistent with the core ideas. A slightly harder challenge should help you test that progress.',
    knowTitle: 'The current ideas are starting to stick',
    knowBody: 'You handled the main path more reliably, especially when you had a second chance to explain it.',
    watchTitle: 'The edge cases',
    watchBody: 'One difficult edge case is still worth revisiting before we call this settled.',
    meterLabel: 'Growing confidence',
    meterDetail: 'Recent attempts show that the current ideas are starting to stick.',
    advisory: 'Try a slightly harder challenge next. You have been handling the current level with growing confidence.',
    advisoryNote: 'This suggestion does not edit your roadmap.',
    scoreLabel: 'Building well',
    nextStep: 'Try a slightly harder challenge',
  },
  stale: {
    label: 'Feedback needs a refresh',
    detail: 'New work is waiting to be included before we make another recommendation.',
    summary: 'You have done more work since this summary was created. Refresh the feedback before relying on it.',
    knowTitle: 'The current ideas are starting to stick',
    knowBody: 'You handled the main path more reliably, especially when you had a second chance to explain it.',
    watchTitle: 'The edge cases',
    watchBody: 'One difficult edge case is still worth revisiting before we call this settled.',
    meterLabel: 'Last known signal',
    meterDetail: 'This summary may not include your latest work.',
    advisory: 'Wait for the feedback refresh before acting on this suggestion.',
    advisoryNote: 'This recommendation is paused until the projection is rebuilt.',
    scoreLabel: 'Needs refresh',
    nextStep: 'Try a slightly harder challenge',
  },
  rebuilding: {
    label: 'Refreshing feedback',
    detail: 'We are reviewing your saved work. Your booked sessions stay exactly as they are.',
    summary: 'We are rereading your recent attempts now. Your roadmap is not being changed during this refresh.',
    knowTitle: 'The current ideas are starting to stick',
    knowBody: 'You handled the main path more reliably, especially when you had a second chance to explain it.',
    watchTitle: 'The edge cases',
    watchBody: 'One difficult edge case is still worth revisiting before we call this settled.',
    meterLabel: 'Growing confidence',
    meterDetail: 'Recent attempts show that the current ideas are starting to stick.',
    advisory: 'Try a slightly harder challenge next. You have been handling the current level with growing confidence.',
    advisoryNote: 'This suggestion does not edit your roadmap.',
    scoreLabel: 'Building well',
    nextStep: 'Try a slightly harder challenge',
  },
};

// Simulated graded work. The engine turns these into the projection; the prototype never
// computes mastery itself. `stale`/`rebuilding` read a prefix, so a rebuild genuinely
// recomputes from more observations rather than faking a number.
const GRADED_OBSERVATIONS: MasteryObservation[] = [
  { skillTag: 'retry-semantics', correct: true },
  { skillTag: 'retry-semantics', correct: true },
  { skillTag: 'queue-visibility', correct: true },
  { skillTag: 'queue-visibility', correct: false },
  { skillTag: 'idempotency-keys', correct: true },
];

function observationsFor(state: ProjectionState): MasteryObservation[] {
  if (state === 'cold') return [];
  if (state === 'updated') return GRADED_OBSERVATIONS;
  return GRADED_OBSERVATIONS.slice(0, GRADED_OBSERVATIONS.length - 1);
}

/** Narrow untrusted storage/URL data to a valid choice; the only place the shape is trusted. */
function normalizeChoice(value: unknown): RecordedChoice | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const boundary = candidate.boundary === 'keep' || candidate.boundary === 'replan' ? candidate.boundary : undefined;
  const variant = typeof candidate.variant === 'string' ? candidate.variant : undefined;
  if (!variant && !boundary) return null;
  return { ...(variant ? { variant } : {}), ...(boundary ? { boundary } : {}) };
}

function readChoiceFromParams(params: URLSearchParams): RecordedChoice | null {
  return normalizeChoice({ variant: params.get('pick'), boundary: params.get('choice') });
}

function readStoredChoice(): RecordedChoice | null {
  try {
    const raw = window.localStorage.getItem(CHOICE_KEY);
    return raw ? normalizeChoice(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function persistChoice(choice: RecordedChoice) {
  try {
    window.localStorage.setItem(CHOICE_KEY, JSON.stringify(choice));
  } catch {
    // Private mode or a full quota: the URL param still carries the choice for this session.
  }
}

function StateControls({ state, setState, onRebuild }: { state: ProjectionState; setState: (state: ProjectionState) => void; onRebuild: () => void }) {
  return (
    <div className="rf-controls" aria-label="Prototype state controls">
      <button type="button" className="rf-button rf-button-dark" onClick={() => setState('updated')}>Simulate graded attempt</button>
      <button type="button" className="rf-button" onClick={() => setState('stale')}>Make projection stale</button>
      <button type="button" className="rf-button" disabled={state !== 'stale'} onClick={onRebuild}>Rebuild from grades</button>
      <span className={`rf-state rf-state-${state}`} role="status" aria-live="polite">{STATE_COPY[state].label}</span>
    </div>
  );
}

function AdvisoryBox({ state, onReview }: { state: ProjectionState; onReview: () => void }) {
  const copy = STATE_COPY[state];
  return (
    <section className="rf-advisory" aria-label="Advisory recommendation">
      <div className="rf-kicker">Advisory recommendation</div>
      <strong>{copy.advisory}</strong>
      <p>{copy.advisoryNote}</p>
      <button type="button" className="rf-link-button" onClick={onReview}>Review before applying</button>
    </section>
  );
}

function PinnedPlan() {
  return (
    <section className="rf-pinned" aria-label="Pinned roadmap decisions">
      <div className="rf-kicker">Pinned roadmap</div>
      <strong>Systems design sprint</strong>
      <p>Tue, Thu, Sat · 45 min · 4 sessions booked</p>
      <span className="rf-pin-mark">Decisions stay fixed until you choose to replan.</span>
    </section>
  );
}

function ModelContext({ projection, recommendation, stale }: { projection: MasteryProjection; recommendation: DifficultyRecommendation; stale: boolean }) {
  return (
    <details className="rf-model-context" data-testid="rf-model-context">
      <summary>Model context</summary>
      <dl>
        <div><dt>Model</dt><dd>{projection.modelVersion}</dd></div>
        <div><dt>Graded observations</dt><dd>{projection.n}</dd></div>
        <div><dt>Uncertainty</dt><dd>{projection.uncertainty.toFixed(2)}</dd></div>
        <div><dt>Difficulty band</dt><dd>{recommendation.currentBand} to {recommendation.recommendedBand}</dd></div>
        <div><dt>Target correctness</dt><dd>{recommendation.targetExpectedCorrectness.toFixed(2)}</dd></div>
        {stale && <div><dt>Projection</dt><dd>Needs rebuild</dd></div>}
      </dl>
      <p>Model context only. The plain-language summary above is what the learner reads.</p>
    </details>
  );
}

function ReviewDialog({ initialChoice, onConfirm, onClose }: { initialChoice: BoundaryChoice; onConfirm: (choice: BoundaryChoice) => void; onClose: () => void }) {
  const [choice, setChoice] = useState<BoundaryChoice>(initialChoice);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    node?.querySelector<HTMLButtonElement>('button')?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const focusables = Array.from(
        node.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="rf-dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="rf-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rf-dialog-title"
        aria-describedby="rf-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rf-kicker">Explicit choice</div>
        <h2 id="rf-dialog-title">Use this recommendation?</h2>
        <p id="rf-dialog-desc">The model can suggest a different difficulty. It cannot rewrite the pinned sessions for you.</p>
        <div className="rf-choice-list" role="radiogroup" aria-label="Recommendation boundary">
          <button type="button" role="radio" aria-checked={choice === 'keep'} className={choice === 'keep' ? 'rf-choice is-selected' : 'rf-choice'} onClick={() => setChoice('keep')}><strong>Keep roadmap</strong><span>Use the suggestion in the next assessment only.</span></button>
          <button type="button" role="radio" aria-checked={choice === 'replan'} className={choice === 'replan' ? 'rf-choice is-selected' : 'rf-choice'} onClick={() => setChoice('replan')}><strong>Open replan</strong><span>Review a new schedule before anything changes.</span></button>
        </div>
        <div className="rf-dialog-actions"><button type="button" className="rf-button" onClick={onClose}>Cancel</button><button type="button" className="rf-button rf-button-dark" onClick={() => { onConfirm(choice); onClose(); }}>{choice === 'keep' ? 'Keep and continue' : 'Review replan'}</button></div>
      </section>
    </div>
  );
}

function MasteryMeter({ state }: { state: ProjectionState }) {
  const copy = STATE_COPY[state];
  return <div className="rf-meter"><div className="rf-meter-track"><div className={`rf-meter-fill rf-meter-fill-${state}`} /></div><div className="rf-meter-label"><strong>{copy.meterLabel}</strong><span>{copy.meterDetail}</span></div></div>;
}

function VariantA({ state, modelVersion, onReview }: { state: ProjectionState; modelVersion: string; onReview: () => void }) {
  return <div className="rf-variant rf-variant-a"><div className="rf-ribbon"><span className="rf-ribbon-dot" />{STATE_COPY[state].detail}<button type="button" onClick={onReview}>See why</button></div><div className="rf-a-grid"><main><div className="rf-kicker">Roadmap / This week</div><h2>Systems design sprint</h2><p className="rf-muted">Your plan is on track. Feedback is a suggestion layer, not a new booking.</p><div className="rf-week-line"><span>Mon</span><span className="is-done">Tue</span><span>Wed</span><span className="is-done">Thu</span><span>Fri</span><span>Sat</span></div><div className="rf-section-heading"><h3>What changed</h3><span>{modelVersion} · rebuildable</span></div><MasteryMeter state={state} /><AdvisoryBox state={state} onReview={onReview} /></main><aside><PinnedPlan /><div className="rf-small-note"><strong>Evidence</strong><p>{state === 'cold' ? 'No graded attempts yet.' : '3 question attempts · 2 correct · 1 partial'}</p></div></aside></div></div>;
}

function VariantB({ state, projection, recommendation, onReview }: { state: ProjectionState; projection: MasteryProjection; recommendation: DifficultyRecommendation; onReview: () => void }) {
  const copy = STATE_COPY[state];
  return (
    <div className="rf-variant rf-variant-b">
      <header className="rf-ledger-head">
        <div>
          <div className="rf-kicker">Progress / Learning story</div>
          <h2>Your learning feedback</h2>
          <p className="rf-muted">A short explanation of what your recent work suggests and what to do next.</p>
        </div>
        <span className="rf-version">Simulated summary · {projection.modelVersion}</span>
      </header>

      <section className="rf-story-card" aria-label="Learning feedback summary">
        <div className="rf-story-card-head"><span className="rf-story-badge">Learning signal</span><span className="rf-story-source">Based on your recent attempts</span></div>
        <p className="rf-story-summary">{copy.summary}</p>
        <div className="rf-story-columns">
          <div><div className="rf-kicker">What we know</div><strong>{copy.knowTitle}</strong><p>{copy.knowBody}</p></div>
          <div><div className="rf-kicker">What we are watching</div><strong>{copy.watchTitle}</strong><p>{copy.watchBody}</p></div>
        </div>
      </section>

      <div className="rf-ledger-grid rf-refined-grid">
        <section className="rf-ledger-list">
          <div className="rf-ledger-section-head"><div><div className="rf-kicker">Evidence trail</div><h3>Recent work behind this summary</h3></div><span className="rf-version">Inspectable</span></div>
          <div className="rf-ledger-row"><span className="rf-ledger-date">Today</span><div><strong>Retry semantics</strong><span>You explained the recovery path clearly. This looks ready to stretch.</span></div><span className="rf-evidence-mark rf-positive">Clear</span></div>
          <div className="rf-ledger-row"><span className="rf-ledger-date">Yesterday</span><div><strong>Queue visibility timeout</strong><span>You had the right idea, but one edge case was still uncertain.</span></div><span className="rf-evidence-mark rf-neutral">Mixed</span></div>
          <div className="rf-ledger-row"><span className="rf-ledger-date">Earlier</span><div><strong>Idempotency keys</strong><span>This was difficult on the first try. We will keep it in rotation.</span></div><span className="rf-evidence-mark rf-negative">Revisit</span></div>
        </section>
        <aside className="rf-ledger-aside">
          <AdvisoryBox state={state} onReview={onReview} />
          <PinnedPlan />
          <ModelContext projection={projection} recommendation={recommendation} stale={state === 'stale'} />
        </aside>
      </div>
    </div>
  );
}

function VariantC({ state, onReview }: { state: ProjectionState; onReview: () => void }) {
  const copy = STATE_COPY[state];
  return <div className="rf-variant rf-variant-c"><div className="rf-c-top"><div><div className="rf-kicker">Progress / Learning story</div><h2>Build confidence, not just completion</h2><p className="rf-muted">A plain-language summary of how your understanding is changing.</p></div><div className="rf-c-score"><strong>{copy.scoreLabel}</strong><span>current read</span></div></div><div className="rf-chart" aria-label="Learning story preview"><div className="rf-chart-grid"><span>More settled</span><span>Still developing</span><span>New to you</span></div><svg viewBox="0 0 720 210" role="img" aria-label="Learning confidence rises across recent work"><path d="M30 178 C150 168, 170 140, 270 150 S390 108, 470 112 S590 60, 690 72" fill="none" stroke="currentColor" strokeWidth="4" /><circle cx="30" cy="178" r="7" /><circle cx="270" cy="150" r="7" /><circle cx="470" cy="112" r="7" /><circle cx="690" cy="72" r="7" /></svg><div className="rf-chart-labels"><span>First look</span><span>Practice</span><span>Retry</span><span>Latest work</span></div></div><div className="rf-c-bottom"><div className="rf-c-callout"><div className="rf-kicker">Suggested next step</div><strong>{copy.nextStep}</strong><p>{copy.detail}</p><button type="button" className="rf-button rf-button-dark" onClick={onReview}>Review recommendation</button></div><PinnedPlan /></div></div>;
}

export default function RoadmapFeedbackPrototype() {
  const [params, setParams] = useSearchParams();
  const variant = (params.get('variant') ?? 'A').toUpperCase();
  const [state, setState] = useState<ProjectionState>('cold');
  const [reviewing, setReviewing] = useState(false);
  const [recorded, setRecorded] = useState<RecordedChoice | null>(() => readChoiceFromParams(params) ?? readStoredChoice());
  const rebuildTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (rebuildTimer.current !== null) window.clearTimeout(rebuildTimer.current);
  }, []);

  const projection = projectMastery('roadmap-feedback-demo', observationsFor(state));
  const recommendation = recommendBand(projection, DEFAULT_BAND);

  const commitChoice = useCallback((next: RecordedChoice) => {
    setRecorded(next);
    persistChoice(next);
    const p = new URLSearchParams(params);
    if (next.variant) p.set('pick', next.variant); else p.delete('pick');
    if (next.boundary) p.set('choice', next.boundary); else p.delete('choice');
    setParams(p, { replace: true });
  }, [params, setParams]);

  const closeReview = useCallback(() => setReviewing(false), []);

  function rebuild() {
    setState('rebuilding');
    if (rebuildTimer.current !== null) window.clearTimeout(rebuildTimer.current);
    rebuildTimer.current = window.setTimeout(() => setState('updated'), 900);
  }

  let view: ReactNode
  if (variant === 'B') {
    view = <VariantB state={state} projection={projection} recommendation={recommendation} onReview={() => setReviewing(true)} />;
  } else if (variant === 'C') {
    view = <VariantC state={state} onReview={() => setReviewing(true)} />;
  } else {
    view = <VariantA state={state} modelVersion={projection.modelVersion} onReview={() => setReviewing(true)} />;
  }

  return (
    <div className="rf-page">
      <header className="rf-header">
        <div className="rf-eyebrow">Prototype · wayfinder issue 35 · throwaway</div>
        <h1>Roadmap feedback, without surprise edits</h1>
        <p>Compare three ways to show mastery, uncertainty, stale projections, and adaptive advice while keeping pinned roadmap decisions in the learner&apos;s hands.</p>
        <StateControls state={state} setState={setState} onRebuild={rebuild} />
        <div className="rf-record">
          <button type="button" className="rf-button rf-button-dark" onClick={() => commitChoice({ ...recorded, variant })}>
            Record Variant {variant} for implementation
          </button>
          {recorded ? (
            <span className="rf-recorded" role="status" data-testid="rf-recorded-choice">
              Recorded: {recorded.variant ? `Variant ${recorded.variant}` : 'variant not yet picked'}
              {recorded.boundary ? ` · ${recorded.boundary === 'keep' ? 'Keep roadmap' : 'Open replan'}` : ''}
            </span>
          ) : (
            <span className="rf-recorded rf-recorded-empty">No choice recorded yet.</span>
          )}
        </div>
      </header>
      {view}
      <div className="rf-driving-note"><strong>Drive it:</strong> simulate a grade, make the projection stale, rebuild it, then open the recommendation. The same states appear in every variant. The recorded choice stays in this browser only; no roadmap event is written.</div>
      <PrototypeSwitcher names={VARIANT_NAMES} />
      {reviewing && <ReviewDialog initialChoice={recorded?.boundary ?? 'keep'} onConfirm={(choice) => commitChoice({ ...recorded, boundary: choice })} onClose={closeReview} />}
    </div>
  );
}
