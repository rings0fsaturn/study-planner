// PROTOTYPE — throwaway. Floating variant switcher (per the prototype skill's bottom bar).
// Cycles ?variant= A/B/C, arrow-key aware, hidden in production builds.
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const KEYS = ['A', 'B', 'C'];

export function PrototypeSwitcher({ names }: { names: Record<string, string> }) {
  const [params, setParams] = useSearchParams();
  const current = (params.get('variant') ?? 'A').toUpperCase();
  const idx = Math.max(0, KEYS.indexOf(current));

  function go(delta: number) {
    const next = KEYS[(idx + delta + KEYS.length) % KEYS.length];
    const p = new URLSearchParams(params);
    p.set('variant', next);
    setParams(p, { replace: true });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement)?.isContentEditable
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
        <b>{KEYS[idx]}</b> — {names[KEYS[idx]]}
      </span>
      <button onClick={() => go(1)} aria-label="Next variant">
        ›
      </button>
    </div>
  );
}
