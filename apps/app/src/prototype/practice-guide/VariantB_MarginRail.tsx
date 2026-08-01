// PROTOTYPE — throwaway. VARIANT B: margin coach rail. The editor stays clean; hints dock
// in a persistent right-hand rail (Google-Docs-suggestion / Cursor-side-panel reading of the
// "inline" decision). The escalation ladder is a VERTICAL STEPPER — every tier you've seen
// stays visible above the current one, so the Socratic trail is legible at a glance.

import { useEffect, useState } from 'react';
import { EditorSurface } from './EditorSurface';
import { KindChip } from './TierBits';
import { triggerLabel } from './useHintEngine';
import type { VariantProps } from './variant-props';

export const VARIANT_NAME = 'Margin coach rail';

export function VariantB(props: VariantProps) {
  const { example, engine } = props;
  const isProse = example.id === 'written';
  const [activeLine, setActiveLine] = useState(example.defaultActiveLine);
  useEffect(() => setActiveLine(example.defaultActiveLine), [example.id, example.defaultActiveLine]);

  return (
    <div className="pgp-split">
      <EditorSurface
        example={props.example}
        value={props.value}
        onChange={props.onChange}
        onActivity={props.onActivity}
        onStuck={props.onStuck}
        onRun={props.onRun}
        running={props.running}
        results={props.results}
        lampActive={engine.status === 'offered' || engine.status === 'active'}
        activeLine={activeLine}
        onActiveLine={setActiveLine}
      />

      <aside className="pgp-rail">
        <div className="pgp-rail-head">
          <span className="pgp-kind" data-kind="nudge">Guide</span>
          <span className="pgp-rail-title">Coach</span>
          {example.lineNumbers && (engine.status !== 'idle') && (
            <span className="pgp-mini" style={{ marginLeft: 'auto' }}>re: line {activeLine}</span>
          )}
        </div>

        {engine.status === 'idle' && (
          <p className="pgp-rail-empty">
            I&apos;m watching quietly. Ask any time, or I&apos;ll offer a nudge if you stall
            or a test fails. I&apos;ll walk you toward it — I won&apos;t hand it over.
          </p>
        )}

        {engine.status === 'offered' && (
          <div>
            <p className="pgp-mini">{triggerLabel(engine.trigger)}.</p>
            <p className="pgp-step-text">Want a hint? I&apos;ll start gentle.</p>
            <div className="pgp-actions">
              <button className="btn btn-primary btn-sm" onClick={engine.accept}>
                Yes, nudge me
              </button>
              <button className="btn btn-ghost btn-sm" onClick={engine.dismiss}>
                Not now
              </button>
            </div>
          </div>
        )}

        {engine.status === 'active' && (
          <div>
            {/* the ladder as a stepper: seen tiers stay visible */}
            <div className="pgp-stepper">
              {example.ladder.map((t, i) => {
                if (i > engine.tierIndex) return null;
                const isCurrent = i === engine.tierIndex;
                const isRevealTier = t.kind === 'reveal';
                return (
                  <div
                    className="pgp-step"
                    key={t.tier}
                    data-state={isCurrent ? 'current' : 'shown'}
                  >
                    <div className="pgp-step-marker">{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 4 }}>
                        <KindChip kind={t.kind} />
                      </div>
                      <div className="pgp-step-text">{t.text}</div>
                      {isRevealTier && isCurrent && engine.revealed && t.revealBody && (
                        <>
                          <div className={`pgp-reveal-body${isProse ? ' prose' : ''}`}>
                            {t.revealBody}
                          </div>
                          <div className="pgp-reveal-note">
                            One worked example — check against it, don&apos;t copy it.
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pgp-actions">
              {!engine.atReveal && (
                <button className="btn btn-secondary btn-sm" onClick={engine.next}>
                  I&apos;m still stuck ↓
                </button>
              )}
              {engine.atReveal && !engine.revealed && (
                <button className="btn btn-accent btn-sm" onClick={engine.confirmReveal}>
                  Reveal a worked answer
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={engine.dismiss}>
                Close
              </button>
            </div>
            <p className="pgp-mini" style={{ marginTop: 8 }}>
              Tier {engine.tierIndex + 1} of {example.ladder.length}
              {engine.atReveal ? ' · final tier is gated' : ''}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
