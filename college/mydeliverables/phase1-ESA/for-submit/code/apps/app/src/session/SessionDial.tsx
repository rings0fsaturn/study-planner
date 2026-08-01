import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * SessionDial — pre-session "set planned length" instrument (D7/D15a/D17).
 *
 * Faithful port of the locked mock `mocks/proposed/session-presession.html`
 * (Marginalia-skinned: ink knob, moss recommended, terracotta cap). Setting
 * phase only — there is NO running "actual ring" (D17). A visually-hidden
 * range input carries keyboard + assistive-tech control and drives tests.
 */

const CEN = 150;
const R_BAND = 116;
const R_TICK_OUT = 128;
const R_TICK_MIN = 121;
const R_TICK_MAJ = 114;
const R_LABEL = 140;
const R_KNOB = 116;
const SWEEP = 270;
const START = 225;

function polar(r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CEN + r * Math.cos(rad), CEN + r * Math.sin(rad)];
}

function ang(v: number, max: number): number {
  return START + (Math.min(Math.max(v, 0), max) / (max || 1)) * SWEEP;
}

function arcPath(r: number, v0: number, v1: number, max: number): string {
  if (v1 <= v0) return '';
  const a0 = ang(v0, max);
  const a1 = ang(v1, max);
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

function angleToValue(deg: number, max: number): number {
  let f: number;
  if (deg >= START) f = (deg - START) / SWEEP;
  else if (deg <= START - 360 + SWEEP) f = (deg + 360 - START) / SWEEP;
  else f = deg < 180 ? 1 : 0;
  return Math.min(Math.max(f, 0), 1) * max;
}

function fmt(m: number): string {
  const mm = Math.max(0, Math.round(m));
  const h = Math.floor(mm / 60);
  const r = mm % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
}

export interface SessionDialProps {
  /** Today's daily study budget in minutes (hoursPerDay × 60). */
  budgetMinutes: number;
  /** Minutes already logged today — the soft cap is budget − done (D5). */
  doneMinutes: number;
  /** Recommended length (already clamped to the cap by the caller). */
  recommendedMinutes: number;
  /** Current planned length. */
  value: number;
  onChange: (minutes: number) => void;
  min?: number;
  step?: number;
}

export function SessionDial({
  budgetMinutes,
  doneMinutes,
  recommendedMinutes,
  value,
  onChange,
  min = 5,
  step = 5,
}: SessionDialProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const budget = Math.max(step, Math.round(budgetMinutes));
  const max = Math.max(Math.ceil((budget * 1.5) / 30) * 30, min);
  const cap = Math.max(0, budget - Math.max(0, Math.round(doneMinutes)));
  const recommended = Math.min(max, Math.max(0, Math.round(recommendedMinutes)));

  const clampValue = useCallback(
    (raw: number) => Math.min(Math.max(Math.round(raw / step) * step, min), max),
    [max, min, step],
  );

  useEffect(() => {
    if (!dragging) return;
    function move(e: PointerEvent) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 300;
      const y = ((e.clientY - rect.top) / rect.height) * 300;
      let deg = (Math.atan2(y - CEN, x - CEN) * 180) / Math.PI + 90;
      deg = (deg + 360) % 360;
      onChange(clampValue(angleToValue(deg, max)));
    }
    function up() {
      setDragging(false);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [dragging, max, clampValue, onChange]);

  const ticks: React.ReactNode[] = [];
  for (let t = 0; t <= max; t += 15) {
    const major = t % 60 === 0;
    const a = ang(t, max);
    const [xi, yi] = polar(major ? R_TICK_MAJ : R_TICK_MIN, a);
    const [xo, yo] = polar(R_TICK_OUT, a);
    ticks.push(
      <line key={`t${t}`} x1={xi} y1={yi} x2={xo} y2={yo} stroke={major ? '#8B7B6B' : '#C9BCA6'} strokeWidth={major ? 2 : 1} />,
    );
    if (major) {
      const [lx, ly] = polar(R_LABEL, a);
      ticks.push(
        <text key={`l${t}`} x={lx} y={ly + 3} textAnchor="middle" fontSize="10" fill="#8B7B6B" fontFamily="var(--font-mono)">
          {t}
        </text>,
      );
    }
  }

  const capA = ang(cap, max);
  const [capI, capIy] = polar(R_TICK_MAJ - 4, capA);
  const [capO, capOy] = polar(R_TICK_OUT, capA);
  const [capLx, capLy] = polar(R_LABEL + 8, capA);

  const recA = ang(recommended, max);
  const [rx, ry] = polar(R_BAND, recA);
  const [recLx, recLy] = polar(R_LABEL + 8, recA);

  const knobA = ang(value, max);
  const [kx, ky] = polar(R_KNOB, knobA);
  const [spx, spy] = polar(70, knobA);

  const overCap = value > cap;

  return (
    <div className="session-dial-wrap">
      <svg
        ref={svgRef}
        className="session-dial-svg"
        viewBox="0 0 300 300"
        role="img"
        aria-label="Set planned session length"
        style={{ touchAction: 'none' }}
      >
        <path d={arcPath(R_BAND, 0, cap, max)} fill="none" stroke="rgba(74,107,58,0.12)" strokeWidth={20} />
        <path d={arcPath(R_BAND, cap, max, max)} fill="none" stroke="rgba(194,142,90,0.18)" strokeWidth={20} />
        {ticks}
        {cap > 0 && cap < max && (
          <>
            <line x1={capI} y1={capIy} x2={capO} y2={capOy} stroke="#B85C38" strokeWidth={3} strokeDasharray="3 2" />
            <text x={capLx} y={capLy} textAnchor="middle" fontSize="9" fill="#B85C38" fontFamily="var(--font-mono)">cap</text>
          </>
        )}
        {recommended > 0 && (
          <>
            <polygon points={`${rx},${ry} ${rx - 5},${ry - 9} ${rx + 5},${ry - 9}`} fill="#4A6B3A" />
            <text x={recLx} y={recLy} textAnchor="middle" fontSize="9" fill="#4A6B3A" fontFamily="var(--font-mono)">rec</text>
          </>
        )}
        <line x1={spx} y1={spy} x2={kx} y2={ky} stroke="#2A1F18" strokeWidth={3} />
        <circle
          cx={kx}
          cy={ky}
          r={13}
          fill="#FBF7EE"
          stroke="#2A1F18"
          strokeWidth={4}
          style={{ cursor: 'grab' }}
          onPointerDown={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
        />
        <circle cx={kx} cy={ky} r={4} fill="#2A1F18" pointerEvents="none" />
        <text x={CEN} y={CEN - 2} textAnchor="middle" fontSize="40" fontWeight={500} fill="#2A1F18" fontFamily="var(--font-display)">
          {fmt(value)}
        </text>
        <text x={CEN} y={CEN + 22} textAnchor="middle" fontSize="12" fill="#8B7B6B" fontFamily="var(--font-body)">
          planned length
        </text>
      </svg>

      <input
        className="session-dial-range visually-hidden-input"
        aria-label="Planned session length"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(clampValue(Number(event.target.value)))}
      />

      <div className="dial-cap-note">drag the knob to set how long you'll study</div>
      {overCap && <div className="dial-overcap-note">past today's {fmt(cap)} cap — allowed, just flagged</div>}
      <div className="dial-legend">
        <span><span className="sw sw-planned" />planned</span>
        <span><span className="sw sw-rec" />recommended</span>
        <span><span className="sw sw-cap" />daily cap</span>
      </div>
    </div>
  );
}
