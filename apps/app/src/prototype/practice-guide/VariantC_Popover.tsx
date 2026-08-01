// PROTOTYPE — throwaway. VARIANT C: anchored coach popover. A floating, dismissible tutor
// card pops near the work (bottom-right, or notionally anchored to the failed test line) —
// a "tutor leaning over your shoulder" reading. Conversational: one Socratic bubble at a
// time, a "Go deeper" button to escalate, and a locked final gate before any worked answer.

import { useEffect, useState } from 'react';
import { EditorSurface } from './EditorSurface';
import { KindChip, LadderDots } from './TierBits';
import { triggerLabel } from './useHintEngine';
import type { VariantProps } from './variant-props';

export const VARIANT_NAME = 'Anchored coach popover';

export function VariantC(props: VariantProps) {
  const { example, engine } = props;
  const isProse = example.id === 'written';
  const open = engine.status !== 'idle';
  const [activeLine, setActiveLine] = useState(example.defaultActiveLine);
  useEffect(() => setActiveLine(example.defaultActiveLine), [example.id, example.defaultActiveLine]);

  return (
    <div>
      <EditorSurface
        example={props.example}
        value={props.value}
        onChange={props.onChange}
        onActivity={props.onActivity}
        onStuck={props.onStuck}
        onRun={props.onRun}
        running={props.running}
        results={props.results}
        lampActive={open}
        activeLine={activeLine}
        onActiveLine={setActiveLine}
      />

      {open && (
        <div className="pgp-popover" role="dialog" aria-label="Practice coach">
          <div className="pgp-pop-head">
            <span className="pgp-pop-tutor">◆</span>
            <div>
              <div className="pgp-pop-who">
                Practice coach{example.lineNumbers ? ` · line ${activeLine}` : ''}
              </div>
              {engine.status === 'offered' && (
                <div className="pgp-mini">{triggerLabel(engine.trigger)}</div>
              )}
            </div>
            <button className="pgp-pop-x" onClick={engine.dismiss} aria-label="Dismiss">
              ✕
            </button>
          </div>

          {engine.status === 'offered' && (
            <>
              <div className="pgp-pop-bubble">
                Want a hint? I&apos;ll ask a question first, not give the answer.
              </div>
              <div className="pgp-actions">
                <button className="btn btn-primary btn-sm" onClick={engine.accept}>
                  Go on then
                </button>
                <button className="btn btn-ghost btn-sm" onClick={engine.dismiss}>
                  Not yet
                </button>
              </div>
            </>
          )}

          {engine.status === 'active' && engine.tier && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <KindChip kind={engine.tier.kind} />
                <LadderDots example={example} tierIndex={engine.tierIndex} />
              </div>
              <div className="pgp-pop-bubble">{engine.tier.text}</div>

              {engine.atReveal && engine.revealed && engine.tier.revealBody && (
                <>
                  <div className={`pgp-reveal-body${isProse ? ' prose' : ''}`}>
                    {engine.tier.revealBody}
                  </div>
                  <div className="pgp-reveal-note">
                    Revealed at your request — a reference to check against, not to paste.
                  </div>
                </>
              )}

              <div className="pgp-actions">
                {!engine.atReveal && (
                  <button className="btn btn-secondary btn-sm" onClick={engine.next}>
                    Go deeper ↓
                  </button>
                )}
                {engine.atReveal && !engine.revealed && (
                  <button className="btn btn-accent btn-sm" onClick={engine.confirmReveal}>
                    Reveal a worked answer
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={engine.dismiss}>
                  Got it
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
