// PROTOTYPE - throwaway. Three roadmap/progress feedback surfaces for wayfinder issue 35.
// Question: how should mastery, uncertainty, stale projections, and advisory recommendations
// appear without silently changing pinned roadmap decisions? Mounted at /roadmap-feedback-prototype.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PrototypeSwitcher } from '../practice-guide/PrototypeSwitcher';
import './roadmap-feedback.css';

type ProjectionState = 'cold' | 'updated' | 'stale' | 'rebuilding';

const VARIANT_NAMES = {
  A: 'Advisory ribbon',
  B: 'Evidence ledger',
  C: 'Progress canvas',
};

const scenarioCopy: Record<ProjectionState, { label: string; detail: string }> = {
  cold: { label: 'Still learning about you', detail: 'There is not enough evidence to make a confident recommendation yet.' },
  updated: { label: 'Feedback refreshed', detail: 'Your recent work suggests you are ready for a little more challenge.' },
  stale: { label: 'Feedback needs a refresh', detail: 'New work is waiting to be included before we make another recommendation.' },
  rebuilding: { label: 'Refreshing feedback', detail: 'We are reviewing your saved work. Your booked sessions stay exactly as they are.' },
};

function StateControls({ state, setState }: { state: ProjectionState; setState: (state: ProjectionState) => void }) {
  return (
    <div className="rf-controls" aria-label="Prototype state controls">
      <button type="button" className="rf-button rf-button-dark" onClick={() => setState('updated')}>Simulate graded attempt</button>
      <button type="button" className="rf-button" onClick={() => setState('stale')}>Make projection stale</button>
      <button type="button" className="rf-button" disabled={state !== 'stale'} onClick={() => { setState('rebuilding'); window.setTimeout(() => setState('updated'), 900); }}>Rebuild from grades</button>
      <span className={`rf-state rf-state-${state}`}>{scenarioCopy[state].label}</span>
    </div>
  );
}

function AdvisoryBox({ state, onReview }: { state: ProjectionState; onReview: () => void }) {
  const recommendation = state === 'cold'
    ? 'Keep practising at the current level while we learn what feels comfortable for you.'
    : state === 'stale'
      ? 'Wait for the feedback refresh before acting on this suggestion.'
      : 'Try a slightly harder challenge next. You have been handling the current level with growing confidence.';
  return (
    <section className="rf-advisory" aria-label="Advisory recommendation">
      <div className="rf-kicker">Advisory recommendation</div>
      <strong>{recommendation}</strong>
      <p>{state === 'stale' ? 'This recommendation is paused until the projection is rebuilt.' : 'This suggestion does not edit your roadmap.'}</p>
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

function ReviewDialog({ onClose }: { onClose: () => void }) {
  const [choice, setChoice] = useState<'keep' | 'replan'>('keep');
  return (
    <div className="rf-dialog-backdrop" role="presentation">
      <section className="rf-dialog" role="dialog" aria-modal="true" aria-labelledby="rf-dialog-title">
        <div className="rf-kicker">Explicit choice</div>
        <h2 id="rf-dialog-title">Use this recommendation?</h2>
        <p>The model can suggest a different difficulty. It cannot rewrite the pinned sessions for you.</p>
        <div className="rf-choice-list">
          <button type="button" className={choice === 'keep' ? 'rf-choice is-selected' : 'rf-choice'} onClick={() => setChoice('keep')}><strong>Keep roadmap</strong><span>Use the suggestion in the next assessment only.</span></button>
          <button type="button" className={choice === 'replan' ? 'rf-choice is-selected' : 'rf-choice'} onClick={() => setChoice('replan')}><strong>Open replan</strong><span>Review a new schedule before anything changes.</span></button>
        </div>
        <div className="rf-dialog-actions"><button type="button" className="rf-button" onClick={onClose}>Cancel</button><button type="button" className="rf-button rf-button-dark" onClick={onClose}>{choice === 'keep' ? 'Keep and continue' : 'Review replan'}</button></div>
      </section>
    </div>
  );
}

function MasteryMeter({ state }: { state: ProjectionState }) {
  const label = state === 'cold' ? 'Early signal' : state === 'stale' ? 'Last known signal' : 'Growing confidence';
  const detail = state === 'cold'
    ? 'We need more attempts before this becomes useful feedback.'
    : state === 'stale'
      ? 'This summary may not include your latest work.'
      : 'Recent attempts show that the current ideas are starting to stick.';
  return <div className="rf-meter"><div className="rf-meter-track"><div className={`rf-meter-fill rf-meter-fill-${state}`} /></div><div className="rf-meter-label"><strong>{label}</strong><span>{detail}</span></div></div>;
}

function VariantA({ state, onReview }: { state: ProjectionState; onReview: () => void }) {
  return <div className="rf-variant rf-variant-a"><div className="rf-ribbon"><span className="rf-ribbon-dot" />{scenarioCopy[state].detail}<button type="button" onClick={onReview}>See why</button></div><div className="rf-a-grid"><main><div className="rf-kicker">Roadmap / This week</div><h2>Systems design sprint</h2><p className="rf-muted">Your plan is on track. Feedback is a suggestion layer, not a new booking.</p><div className="rf-week-line"><span>Mon</span><span className="is-done">Tue</span><span>Wed</span><span className="is-done">Thu</span><span>Fri</span><span>Sat</span></div><div className="rf-section-heading"><h3>What changed</h3><span>Model v0.1 · rebuildable</span></div><MasteryMeter state={state} /><AdvisoryBox state={state} onReview={onReview} /></main><aside><PinnedPlan /><div className="rf-small-note"><strong>Evidence</strong><p>{state === 'cold' ? 'No graded attempts yet.' : '3 question attempts · 2 correct · 1 partial'}</p></div></aside></div></div>;
}

function VariantB({ state, onReview }: { state: ProjectionState; onReview: () => void }) {
  const summary = state === 'cold'
    ? 'You are just getting started with this material. We will wait for more practice before suggesting a change.'
    : state === 'stale'
      ? 'You have done more work since this summary was created. Refresh the feedback before relying on it.'
      : state === 'rebuilding'
        ? 'We are rereading your recent attempts now. Your roadmap is not being changed during this refresh.'
        : 'You are becoming more consistent with the core ideas. A slightly harder challenge should help you test that progress.';

  return (
    <div className="rf-variant rf-variant-b">
      <header className="rf-ledger-head">
        <div>
          <div className="rf-kicker">Progress / Learning story</div>
          <h2>Your learning feedback</h2>
          <p className="rf-muted">A short explanation of what your recent work suggests and what to do next.</p>
        </div>
        <span className="rf-version">LLM summary · {state === 'rebuilding' ? 'replaying saved work' : 'prototype'}</span>
      </header>

      <section className="rf-story-card" aria-label="Learning feedback summary">
        <div className="rf-story-card-head"><span className="rf-story-badge">Learning signal</span><span className="rf-story-source">Based on your recent attempts</span></div>
        <p className="rf-story-summary">{summary}</p>
        <div className="rf-story-columns">
          <div><div className="rf-kicker">What we know</div><strong>{state === 'cold' ? 'Not enough evidence yet' : 'The current ideas are starting to stick'}</strong><p>{state === 'cold' ? 'Keep working at the current level so the next summary has something useful to compare.' : 'You handled the main path more reliably, especially when you had a second chance to explain it.'}</p></div>
          <div><div className="rf-kicker">What we are watching</div><strong>{state === 'cold' ? 'Your first explanations' : 'The edge cases'}</strong><p>{state === 'cold' ? 'We do not want to overreact to one early attempt.' : 'One difficult edge case is still worth revisiting before we call this settled.'}</p></div>
        </div>
      </section>

      <div className="rf-ledger-grid rf-refined-grid">
        <section className="rf-ledger-list">
          <div className="rf-ledger-section-head"><div><div className="rf-kicker">Evidence trail</div><h3>Recent work behind this summary</h3></div><span className="rf-version">Inspectable</span></div>
          <div className="rf-ledger-row"><span className="rf-ledger-date">Today</span><div><strong>Retry semantics</strong><span>You explained the recovery path clearly. This looks ready to stretch.</span></div><span className="rf-evidence-mark rf-positive">Clear</span></div>
          <div className="rf-ledger-row"><span className="rf-ledger-date">Yesterday</span><div><strong>Queue visibility timeout</strong><span>You had the right idea, but one edge case was still uncertain.</span></div><span className="rf-evidence-mark rf-neutral">Mixed</span></div>
          <div className="rf-ledger-row"><span className="rf-ledger-date">Earlier</span><div><strong>Idempotency keys</strong><span>This was difficult on the first try. We will keep it in rotation.</span></div><span className="rf-evidence-mark rf-negative">Revisit</span></div>
        </section>
        <aside className="rf-ledger-aside"><AdvisoryBox state={state} onReview={onReview} /><PinnedPlan /></aside>
      </div>
    </div>
  );
}

function VariantC({ state, onReview }: { state: ProjectionState; onReview: () => void }) {
  return <div className="rf-variant rf-variant-c"><div className="rf-c-top"><div><div className="rf-kicker">Progress / Learning story</div><h2>Build confidence, not just completion</h2><p className="rf-muted">A plain-language summary of how your understanding is changing.</p></div><div className="rf-c-score"><strong>{state === 'cold' ? 'Getting started' : state === 'stale' ? 'Needs refresh' : 'Building well'}</strong><span>current read</span></div></div><div className="rf-chart" aria-label="Learning story preview"><div className="rf-chart-grid"><span>More settled</span><span>Still developing</span><span>New to you</span></div><svg viewBox="0 0 720 210" role="img" aria-label="Learning confidence rises across recent work"><path d="M30 178 C150 168, 170 140, 270 150 S390 108, 470 112 S590 60, 690 72" fill="none" stroke="currentColor" strokeWidth="4" /><circle cx="30" cy="178" r="7" /><circle cx="270" cy="150" r="7" /><circle cx="470" cy="112" r="7" /><circle cx="690" cy="72" r="7" /></svg><div className="rf-chart-labels"><span>First look</span><span>Practice</span><span>Retry</span><span>Latest work</span></div></div><div className="rf-c-bottom"><div className="rf-c-callout"><div className="rf-kicker">Suggested next step</div><strong>{state === 'cold' ? 'Stay with the current challenge' : 'Try a slightly harder challenge'}</strong><p>{scenarioCopy[state].detail}</p><button type="button" className="rf-button rf-button-dark" onClick={onReview}>Review recommendation</button></div><PinnedPlan /></div></div>;
}

export default function RoadmapFeedbackPrototype() {
  const [params] = useSearchParams();
  const variant = (params.get('variant') ?? 'A').toUpperCase();
  const [state, setState] = useState<ProjectionState>('cold');
  const [reviewing, setReviewing] = useState(false);
  const view = variant === 'B' ? <VariantB state={state} onReview={() => setReviewing(true)} /> : variant === 'C' ? <VariantC state={state} onReview={() => setReviewing(true)} /> : <VariantA state={state} onReview={() => setReviewing(true)} />;
  return <div className="rf-page"><header className="rf-header"><div className="rf-eyebrow">Prototype · wayfinder issue 35 · throwaway</div><h1>Roadmap feedback, without surprise edits</h1><p>Compare three ways to show mastery, uncertainty, stale projections, and adaptive advice while keeping pinned roadmap decisions in the learner&apos;s hands.</p><StateControls state={state} setState={setState} /></header>{view}<div className="rf-driving-note"><strong>Drive it:</strong> simulate a grade, make the projection stale, rebuild it, then open the recommendation. The same states appear in every variant. Nothing persists and no roadmap event is written.</div><PrototypeSwitcher names={VARIANT_NAMES} />{reviewing && <ReviewDialog onClose={() => setReviewing(false)} />}</div>;
}
