// PROTOTYPE — throwaway. Floating variant switcher (per the prototype skill's bottom bar).
// Cycles ?variant= A/B/C, arrow-key aware, hidden in production builds.
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const KEYS = ['A', 'B', 'C'];

export function PrototypeSwitcher({
  names,
  keys = KEYS,
}: {
  names: Record<string, string>;
  keys?: string[];
}) {
  const [params, setParams] = useSearchParams();
  const current = (params.get('variant') ?? 'A').toUpperCase();
  const idx = Math.max(0, keys.indexOf(current));

  function go(delta: number) {
    const next = keys[(idx + delta + keys.length) % keys.length];
    const p = new URLSearchParams(params);
    p.set('variant', next);
    setParams(p, { replace: true });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el?.isContentEditable ||
        el?.closest('[role="tablist"]')
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!import.meta.env.DEV) return null;

  return (
    <div className="pgp-switcher">
      <button onClick={() => go(-1)} aria-label="Previous variant">
        ‹
      </button>
      <span className="label">
        <b>{keys[idx]}</b> — {names[keys[idx]]}
      </span>
      <button onClick={() => go(1)} aria-label="Next variant">
        ›
      </button>
    </div>
  );
}
