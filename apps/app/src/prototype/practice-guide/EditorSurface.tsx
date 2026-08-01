// PROTOTYPE — throwaway. Shared editor surface: prompt card, code/prose editor with an
// optional line gutter + hint lamp, the hybrid-trigger toolbar ("Run tests" / "I'm stuck"),
// and the coding test panel. WHERE the hint renders differs per variant — that is injected,
// not shared. This is a Header-level share (the editor), not a Layout-level one.
//
// The editor tracks the ACTIVE LINE (where the caret is) and reports it upward, so the guide
// can anchor its hint to the line the learner is actually working on — the hint is about
// *this line*, not the whole problem. Variant A renders an inline widget pinned to that line.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { PracticeExample } from './hint-ladders';

interface TestResult {
  name: string;
  input: string;
  passed: boolean;
  detail: string;
}

export interface LineContext {
  line: number; // 1-based
  text: string; // the active line's text (trimmed)
}

interface Props {
  example: PracticeExample;
  value: string;
  onChange: (v: string) => void;
  onActivity: () => void; // poke the idle timer
  onStuck: () => void;
  onRun: () => void;
  running: boolean;
  results: TestResult[] | null;
  lampActive: boolean; // light the gutter hint lamp (A/B ambient cue)
  activeLine: number; // where the caret is (host/variant-owned so headers can show it)
  onActiveLine: (line: number) => void;
  /** Variant A injects an inline widget pinned to the active line. Receives the line context. */
  renderGhost?: (ctx: LineContext) => ReactNode;
}

export function EditorSurface({
  example,
  value,
  onChange,
  onActivity,
  onStuck,
  onRun,
  running,
  results,
  lampActive,
  activeLine,
  onActiveLine,
  renderGhost,
}: Props) {
  const lines = value.split('\n');
  const isCode = example.id === 'coding';
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [metrics, setMetrics] = useState({ lineHeight: 22, padTop: 12 });

  // measure the textarea's real line metrics so the anchored widget lands on the right line
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const cs = getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight);
    const pt = parseFloat(cs.paddingTop);
    setMetrics({
      lineHeight: Number.isFinite(lh) ? lh : 22,
      padTop: Number.isFinite(pt) ? pt : 12,
    });
  }, [example.id]);

  function reportCaret() {
    const ta = taRef.current;
    if (!ta) return;
    const line = value.slice(0, ta.selectionStart).split('\n').length;
    onActiveLine(line);
  }

  const lineText = (lines[activeLine - 1] ?? '').trim();
  // widget sits just BELOW the active line
  const ghostTop = metrics.padTop + activeLine * metrics.lineHeight;

  return (
    <div>
      <div className="pgp-prompt">
        <div className="pgp-prompt-fam">{example.family}</div>
        <div className="pgp-prompt-text">{example.prompt}</div>
      </div>

      <div className="pgp-editor-wrap">
        <div className="pgp-editor-row">
          {example.lineNumbers && (
            <div className="pgp-gutter" aria-hidden>
              {lines.map((_, i) => (
                <div className="pgp-gutter-line" key={i} style={{ position: 'relative' }}>
                  {lampActive && i + 1 === activeLine && (
                    <span className="pgp-lamp" title="A hint is available for this line" />
                  )}
                  {i + 1}
                </div>
              ))}
            </div>
          )}
          <div className="pgp-ta-wrap">
            <textarea
              ref={taRef}
              className={`pgp-textarea${isCode ? '' : ' prose'}`}
              value={value}
              spellCheck={false}
              onChange={(e) => {
                onChange(e.target.value);
                onActivity();
                reportCaret();
              }}
              onKeyUp={reportCaret}
              onClick={reportCaret}
              onSelect={reportCaret}
              onKeyDown={onActivity}
            />
            {renderGhost && (
              <div className="pgp-ghost-anchored" style={{ top: ghostTop }}>
                {renderGhost({ line: activeLine, text: lineText })}
              </div>
            )}
          </div>
        </div>

        <div className="pgp-toolbar">
          {isCode && (
            <button className="btn btn-secondary btn-sm" onClick={onRun} disabled={running}>
              {running ? 'Running…' : '▶ Run tests'}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onStuck}>
            🤔 I&apos;m stuck
          </button>
          <span className="spacer" />
          <span className="pgp-hint-idle">
            or just pause — a hint is offered after a short idle
          </span>
        </div>

        {isCode && results && (
          <div className="pgp-tests">
            {results.map((r) => (
              <div className="pgp-test" key={r.name}>
                <span className={`st ${r.passed ? 'pass' : 'fail'}`}>
                  {r.passed ? '✓' : '✗'}
                </span>
                <span>is_palindrome({r.input})</span>
                <span className="detail">{r.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
