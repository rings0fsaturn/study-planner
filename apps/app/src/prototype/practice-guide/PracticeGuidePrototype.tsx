// PROTOTYPE — throwaway. Host route for the #17 inline-hint live guide prototype.
// Answers: "What does the inline-hint live guide look and feel like?" by rendering THREE
// structurally-different surfaces for the SAME locked concept (tiered-Socratic hints, hybrid
// on-demand triggers, inline-hint UX), switchable via ?variant=. Mounted at /practice-prototype
// (mirrors the existing /chart-test dev-route precedent). Delete with the ticket.
//
// Locked decisions this obeys (map #9): tiered-Socratic (never hands the answer) ·
// hybrid on-demand triggers (I'm stuck + idle timer + failed-test that OFFER) ·
// inline-hint surface (ghost text is a hint/question, never finished code/prose).

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EXAMPLES, CODING_EXAMPLE, WRITTEN_EXAMPLE } from './hint-ladders';
import { useHintEngine } from './useHintEngine';
import { VariantA, VARIANT_NAME as A_NAME } from './VariantA_GhostText';
import { VariantB, VARIANT_NAME as B_NAME } from './VariantB_MarginRail';
import { VariantC, VARIANT_NAME as C_NAME } from './VariantC_Popover';
import { PrototypeSwitcher } from './PrototypeSwitcher';
import type { TestResult } from './variant-props';
import './prototype.css';

const VARIANT_NAMES: Record<string, string> = { A: A_NAME, B: B_NAME, C: C_NAME };

export default function PracticeGuidePrototype() {
  const [params] = useSearchParams();
  const variant = (params.get('variant') ?? 'A').toUpperCase();

  const [exampleId, setExampleId] = useState<'coding' | 'written'>('coding');
  const example = exampleId === 'coding' ? CODING_EXAMPLE : WRITTEN_EXAMPLE;

  const [values, setValues] = useState<Record<string, string>>({
    coding: CODING_EXAMPLE.starter,
    written: WRITTEN_EXAMPLE.starter,
  });
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);

  const engine = useHintEngine(example);

  const onChange = useCallback(
    (v: string) => setValues((prev) => ({ ...prev, [exampleId]: v })),
    [exampleId],
  );

  const onRun = useCallback(() => {
    if (!example.testRun) return;
    setRunning(true);
    setResults(null);
    // fake the run; then surface failures and OFFER a hint (never force)
    window.setTimeout(() => {
      const cases = example.testRun!.cases;
      setResults(cases);
      setRunning(false);
      if (cases.some((c) => !c.passed)) engine.offer('failedRun');
    }, 1100);
  }, [example, engine]);

  function switchExample(id: 'coding' | 'written') {
    setExampleId(id);
    setResults(null);
    setRunning(false);
  }

  const variantProps = useMemo(
    () => ({
      example,
      value: values[exampleId],
      onChange,
      onActivity: engine.poke,
      onStuck: () => engine.offer('stuck'),
      onRun,
      running,
      results,
      engine,
    }),
    [example, values, exampleId, onChange, engine, onRun, running, results],
  );

  return (
    <div className="pgp">
      <header className="pgp-head">
        <div className="pgp-eyebrow">Prototype · wayfinder #17 · throwaway</div>
        <h1 className="pgp-title">Inline-hint live guide</h1>
        <p className="pgp-sub">
          A tiered-Socratic coach that walks you toward the answer and never hands it over.
          It offers help on demand — when you ask (<em>I&apos;m stuck</em>), when you stall
          (idle timer), or when a test fails — and escalates nudge → hint → targeted →
          gated reveal. Flip variants (bottom bar / ← →) to compare where the hint lives.
        </p>

        <div className="pgp-tabs" role="tablist" aria-label="Practice example">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              role="tab"
              className="pgp-tab"
              data-active={exampleId === ex.id}
              aria-selected={exampleId === ex.id}
              onClick={() => switchExample(ex.id)}
            >
              {ex.label} example
            </button>
          ))}
        </div>
      </header>

      {variant === 'B' ? (
        <VariantB {...variantProps} />
      ) : variant === 'C' ? (
        <VariantC {...variantProps} />
      ) : (
        <VariantA {...variantProps} />
      )}

      <div className="pgp-note">
        <strong>How to drive it:</strong> type in the editor and stop for ~12s (idle offer);
        on the coding example press <code>▶ Run tests</code> to fail two cases (failed-test
        offer); or press <code>🤔 I&apos;m stuck</code> any time. Accept the offer, then
        <code>Go deeper</code> to climb the ladder. The final <em>reveal</em> tier is gated —
        the guide will not show a worked answer until you explicitly confirm, and even then
        frames it as a reference, not the answer. Switch the <em>Coding</em> / <em>Written</em>
        tabs to see both families; flip variants A/B/C for the three surfaces.
      </div>

      <PrototypeSwitcher names={VARIANT_NAMES} />
    </div>
  );
}
