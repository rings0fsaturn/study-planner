// PROTOTYPE — throwaway. VARIANT A: inline ghost text (the literal Copilot/Cursor reading).
// The hint materializes as a dimmed widget pinned to the ACTIVE LINE inside the editor —
// where a Copilot completion would appear — except the ghost is a Socratic question, never
// finished code. It leads with the line it is reading ("Looking at line N: `code`") so the
// learner sees the guide understands *this line's context*, then poses the tiered hint.
// Gutter lamp sits on the active line; Tab escalates, Esc dismisses.

import { useEffect, useState } from 'react';
import { EditorSurface, type LineContext } from './EditorSurface';
import { KindChip, LadderDots } from './TierBits';
import { triggerLabel } from './useHintEngine';
import type { VariantProps } from './variant-props';

export const VARIANT_NAME = 'Inline ghost text';

export function VariantA(props: VariantProps) {
  const { example, engine } = props;
  const isProse = example.id === 'written';
  const [activeLine, setActiveLine] = useState(example.defaultActiveLine);

  // re-anchor to the example's likely-stuck line when the example changes
  useEffect(() => {
    setActiveLine(example.defaultActiveLine);
  }, [example.id, example.defaultActiveLine]);

  // keyboard escalation, Copilot-style: Tab = next tier, Esc = dismiss.
  // Do NOT hijack keys while the editor textarea is focused (rule from the skill).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      const inEditor =
        el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement;
      if (inEditor) return;
      if (engine.status !== 'active') return;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (engine.atReveal) engine.confirmReveal();
        else engine.next();
      } else if (e.key === 'Escape') {
        engine.dismiss();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  // the line-context header — shows the guide is reading THIS line
  function LineHeader({ ctx }: { ctx: LineContext }) {
    if (!example.lineNumbers || !ctx.text) return null;
    return (
      <div className="pgp-ghost-line">
        <span>
          Looking at <span className="lineno">line {ctx.line}</span>
        </span>
        <code title={ctx.text}>{ctx.text}</code>
      </div>
    );
  }

  const renderGhost = (ctx: LineContext) => {
    if (engine.status === 'offered') {
      return (
        <>
          <div className="pgp-ghost-meta">
            <span className="pgp-kind" data-kind="nudge">Guide</span>
            <span className="pgp-mini">{triggerLabel(engine.trigger)} — want a hint?</span>
            <span className="pgp-ghost-keys">
              <span className="pgp-kbd">Tab</span> accept · <span className="pgp-kbd">Esc</span> dismiss
            </span>
          </div>
          <LineHeader ctx={ctx} />
          <div className="pgp-actions">
            <button className="btn btn-primary btn-sm" onClick={engine.accept}>
              Show a hint
            </button>
            <button className="btn btn-ghost btn-sm" onClick={engine.dismiss}>
              Not now
            </button>
          </div>
        </>
      );
    }

    if (engine.status === 'active' && engine.tier) {
      return (
        <>
          <div className="pgp-ghost-meta">
            <KindChip kind={engine.tier.kind} />
            <LadderDots example={example} tierIndex={engine.tierIndex} />
            <span className="pgp-ghost-keys">
              {!engine.atReveal ? (
                <>
                  <span className="pgp-kbd">Tab</span> go deeper · <span className="pgp-kbd">Esc</span> close
                </>
              ) : (
                <>gated · <span className="pgp-kbd">Esc</span> close</>
              )}
            </span>
          </div>

          <LineHeader ctx={ctx} />

          {/* the ghost text — a question/nudge about this line, never the answer */}
          <div className={`pgp-ghost-text${isProse ? ' prose' : ''}`}>
            {engine.tier.ghost}
          </div>

          {engine.atReveal && engine.revealed && engine.tier.revealBody && (
            <>
              <div className={`pgp-reveal-body${isProse ? ' prose' : ''}`}>
                {engine.tier.revealBody}
              </div>
              <div className="pgp-reveal-note">
                Shown only because you explicitly asked. One worked version to check against —
                not the single right answer.
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
              Dismiss
            </button>
          </div>
        </>
      );
    }

    return null;
  };

  const showGhost = engine.status === 'offered' || engine.status === 'active';

  return (
    <EditorSurface
      example={props.example}
      value={props.value}
      onChange={props.onChange}
      onActivity={props.onActivity}
      onStuck={props.onStuck}
      onRun={props.onRun}
      running={props.running}
      results={props.results}
      lampActive={showGhost}
      activeLine={activeLine}
      onActiveLine={setActiveLine}
      renderGhost={showGhost ? renderGhost : undefined}
    />
  );
}
