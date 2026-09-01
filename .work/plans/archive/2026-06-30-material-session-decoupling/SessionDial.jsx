import { useEffect, useRef, useState } from 'react'

/**
 * SessionDial — design prototype for the decoupled material/session redesign.
 *
 * Living artifact for the planning session (2026-06-30). NOT wired into the app.
 *
 * Mental model: a real twist-to-set timer dial.
 *   - FIXED 270° scale anchored to the daily budget (gap at the bottom, printed
 *     minute ticks). It does NOT rescale while you drag — so the three values stay
 *     legible against a stable bezel.
 *   - Four roles on four radii / four glyphs so none hides the others:
 *       planned     → big BLUE knob you ROTATE (drag it). Input 1.
 *       actual      → bold INNER ring that fills; teal ≤ plan, amber > plan, red > cap.
 *       cap         → neutral notch on the bezel = hoursPerDay − done today (D5).
 *       recommended → PURPLE triangle on the bezel, driven by Q3.
 *
 * Decisions encoded:
 *   D1 material-first (title above the dial), no dated-slot assignment.
 *   D2 planned = the knob value; feeds calibration's activeMinutes/plannedMinutes.
 *   D3 material-based progress (End=complete vs Interrupt=open).
 *   D4 partial/interrupt auto-logs the real elapsed, leaves the material open.
 *   D5 soft cap = hoursPerDay − minutesDoneToday, any day.
 *   Q3 recommendation is PACE-FIRST: capped at the realistic ceiling (= cap);
 *      climbs toward cap under deadline pressure; if even cap can't hit the
 *      deadline it shows "deadline at risk" + levers instead of a fake number.
 */

const C = {
  ink: 'var(--ink, #2C2C2A)',
  inkSoft: '#5F5E5A',
  inkFaint: '#888780',
  card: '#FFFFFF',
  line: '#D3D1C7',
  bandComfort: '#E1F5EE', // teal-50
  bandStretch: '#FAEEDA', // amber-50
  tick: '#B4B2A9',
  tickMajor: '#5F5E5A',
  teal: '#1D9E75',
  amber: '#BA7517',
  red: '#A32D2D',
  blue: '#185FA5',
  purple: '#7F77DD',
}

const CEN = 150
const R_BAND = 116
const R_TICK_OUT = 128
const R_TICK_MIN = 121
const R_TICK_MAJ = 114
const R_LABEL = 140
const R_ACTUAL = 86
const R_KNOB = 116
const SWEEP = 270
const START = 225 // degrees from top, clockwise (lower-left)

function polar(r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180
  return [CEN + r * Math.cos(rad), CEN + r * Math.sin(rad)]
}
function ang(v, max) {
  return START + (Math.min(Math.max(v, 0), max) / (max || 1)) * SWEEP
}
function arcPath(r, v0, v1, max) {
  if (v1 <= v0) return ''
  const a0 = ang(v0, max)
  const a1 = ang(v1, max)
  const [x0, y0] = polar(r, a0)
  const [x1, y1] = polar(r, a1)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`
}
function angleToValue(deg, max) {
  let f
  if (deg >= START) f = (deg - START) / SWEEP
  else if (deg <= START - 360 + SWEEP) f = (deg + 360 - START) / SWEEP
  else f = deg < 180 ? 1 : 0
  return Math.min(Math.max(f, 0), 1) * max
}
function fmt(m) {
  m = Math.max(0, Math.round(m))
  const h = Math.floor(m / 60)
  const r = m % 60
  return h > 0 ? `${h}h ${r}m` : `${r}m`
}
function clock(m) {
  const t = Math.max(0, Math.round(m * 60))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function actualSegments(actual, planned, cap) {
  const bps = [0, actual]
  if (planned > 0 && planned < actual) bps.push(planned)
  if (cap > 0 && cap < actual) bps.push(cap)
  const u = [...new Set(bps)].sort((a, b) => a - b)
  const segs = []
  for (let i = 0; i < u.length - 1; i++) {
    const a = u[i]
    const b = u[i + 1]
    const mid = (a + b) / 2
    segs.push({ a, b, c: mid > cap ? C.red : mid > planned ? C.amber : C.teal })
  }
  return segs
}

export default function SessionDial() {
  const [hoursPerDay, setHoursPerDay] = useState(2)
  const [doneToday, setDoneToday] = useState(0)
  const [planned, setPlanned] = useState(45)
  const [pressure, setPressure] = useState(0.5) // illustrative deadline pressure 0..1.4
  const [actual, setActual] = useState(0)
  const [phase, setPhase] = useState('setting')
  const [mat, setMat] = useState({ title: 'Linear Algebra — Lecture 4', kind: 'youtube', est: 50, logged: 0, complete: false })
  const [log, setLog] = useState([])
  const [dragging, setDragging] = useState(false)
  const svgRef = useRef(null)
  const tickRef = useRef(null)

  const budget = hoursPerDay * 60
  const max = Math.ceil((budget * 1.5) / 30) * 30
  const cap = Math.max(0, budget - doneToday)
  const comfortBase = Math.round((0.6 * cap) / 5) * 5
  const required = pressure * cap
  const infeasible = required > cap + 0.001
  const recommended = Math.min(cap, Math.max(comfortBase, Math.min(required, cap)))

  useEffect(() => {
    if (phase !== 'running') {
      if (tickRef.current) clearInterval(tickRef.current)
      return
    }
    tickRef.current = setInterval(() => setActual((a) => a + 1), 250)
    return () => tickRef.current && clearInterval(tickRef.current)
  }, [phase])

  useEffect(() => {
    if (!dragging) return
    function move(e) {
      const rect = svgRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 300
      const y = ((e.clientY - rect.top) / rect.height) * 300
      const deg = (Math.atan2(y - CEN, x - CEN) * 180) / Math.PI + 90
      const d = (deg + 360) % 360
      const v = angleToValue(d >= START ? d : d <= 135 ? d : d, max)
      setPlanned(Math.min(Math.max(Math.round(v / 5) * 5, 5), max))
    }
    function up() {
      setDragging(false)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragging, max])

  const overrun = Math.max(0, actual - planned)
  const beyondCap = actual > cap
  const segs = actualSegments(Math.min(actual, max), planned, cap)

  function pushLog(line) {
    setLog((l) => [{ t: new Date().toLocaleTimeString(), line }, ...l].slice(0, 6))
  }
  function start() { setActual(0); setPhase('running'); pushLog(`Started "${mat.title}" · planned ${fmt(planned)} · cap ${fmt(cap)}`) }
  function pause() { setPhase('paused'); pushLog(`Paused at ${fmt(actual)}`) }
  function resume() { setPhase('running') }
  function endComplete() { setPhase('ended'); setDoneToday((d) => d + actual); setMat((m) => ({ ...m, logged: m.logged + actual, complete: true })); pushLog(`Ended · logged ${fmt(actual)} · complete`) }
  function interrupt() { setPhase('ended'); setDoneToday((d) => d + actual); setMat((m) => ({ ...m, logged: m.logged + actual, complete: false })); pushLog(`Auto-logged ${fmt(actual)} (interrupted) · material left open`) }
  function reset() { setActual(0); setPhase('setting') }

  const ticks = []
  for (let t = 0; t <= max; t += 15) {
    const major = t % 60 === 0
    const a = ang(t, max)
    const [xi, yi] = polar(major ? R_TICK_MAJ : R_TICK_MIN, a)
    const [xo, yo] = polar(R_TICK_OUT, a)
    ticks.push(<line key={`t${t}`} x1={xi} y1={yi} x2={xo} y2={yo} stroke={major ? C.tickMajor : C.tick} strokeWidth={major ? 2 : 1} />)
    if (major) {
      const [lx, ly] = polar(R_LABEL, a)
      ticks.push(<text key={`l${t}`} x={lx} y={ly + 3} textAnchor="middle" fontSize="10" fill={C.inkFaint}>{t}</text>)
    }
  }

  const capA = ang(cap, max)
  const [capI, capIy] = polar(R_TICK_MAJ - 4, capA)
  const [capO, capOy] = polar(R_TICK_OUT, capA)
  const [capLx, capLy] = polar(R_LABEL + 8, capA)

  const recA = ang(recommended, max)
  const [rx, ry] = polar(R_BAND, recA)
  const recTri = `${rx},${ry} ${rx - 5},${ry - 9} ${rx + 5},${ry - 9}`
  const [recLx, recLy] = polar(R_LABEL + 8, recA)

  const knobA = ang(planned, max)
  const [kx, ky] = polar(R_KNOB, knobA)
  const [spx, spy] = polar(R_ACTUAL + 10, knobA)

  const headA = ang(Math.min(actual, max), max)
  const [hx, hy] = polar(R_ACTUAL, headA)

  const centerBig = phase === 'running' || phase === 'paused' ? clock(actual) : fmt(planned)
  const centerCap = phase === 'setting' ? 'planned length' : phase === 'ended' ? 'logged' : overrun > 0 ? `+${fmt(overrun)} over plan` : 'elapsed'

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#2C2C2A', maxWidth: 780 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start', background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20 }}>
        <div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 6 }}>{mat.kind === 'youtube' ? '▶ ' : '◆ '}{mat.title}</div>
          <svg ref={svgRef} viewBox="0 0 300 300" width="320" height="320" role="img" aria-label="Session length dial" style={{ touchAction: 'none' }}>
            {/* zone bands */}
            <path d={arcPath(R_BAND, 0, cap, max)} fill="none" stroke={C.bandComfort} strokeWidth="20" />
            <path d={arcPath(R_BAND, cap, max, max)} fill="none" stroke={C.bandStretch} strokeWidth="20" />
            {/* ticks */}
            {ticks}
            {/* actual fill (inner) */}
            <path d={arcPath(R_ACTUAL, 0, max, max)} fill="none" stroke="#EDEBE3" strokeWidth="18" strokeLinecap="round" />
            {segs.map((s, i) => (
              <path key={i} d={arcPath(R_ACTUAL, s.a, s.b, max)} fill="none" stroke={s.c} strokeWidth="18" strokeLinecap="butt" />
            ))}
            {actual > 0 && <circle cx={hx} cy={hy} r="6" fill={beyondCap ? C.red : overrun > 0 ? C.amber : C.teal} stroke="#fff" strokeWidth="2" />}
            {/* cap notch */}
            <line x1={capI} y1={capIy} x2={capO} y2={capOy} stroke={C.tickMajor} strokeWidth="3" strokeDasharray="3 2" />
            <text x={capLx} y={capLy} textAnchor="middle" fontSize="10" fontWeight="500" fill={C.inkSoft}>cap</text>
            {/* recommended triangle */}
            <polygon points={recTri} fill={infeasible ? C.red : C.purple} />
            <text x={recLx} y={recLy} textAnchor="middle" fontSize="10" fontWeight="500" fill={infeasible ? C.red : C.purple}>{infeasible ? 'risk' : 'rec'}</text>
            {/* planned knob + spoke */}
            <line x1={spx} y1={spy} x2={kx} y2={ky} stroke={C.blue} strokeWidth="3" />
            <circle cx={kx} cy={ky} r="13" fill="#fff" stroke={C.blue} strokeWidth="4" style={{ cursor: 'grab' }} onPointerDown={() => setDragging(true)} />
            <circle cx={kx} cy={ky} r="4" fill={C.blue} pointerEvents="none" />
            {/* center */}
            <text x={CEN} y={CEN - 4} textAnchor="middle" fontSize="36" fontWeight="500" fill="#2C2C2A">{centerBig}</text>
            <text x={CEN} y={CEN + 20} textAnchor="middle" fontSize="12" fill={C.inkFaint}>{centerCap}</text>
          </svg>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, color: C.inkSoft, marginTop: 2 }}>
            <Leg c={C.blue} t="planned (drag)" />
            <Leg c={C.teal} t="actual" />
            <Leg c={C.amber} t="over plan" />
            <Leg c={C.red} t="over cap" />
            <Leg c={C.purple} t="recommended" />
          </div>
        </div>

        <div style={{ fontSize: 13 }}>
          <Stat label="daily budget" value={fmt(budget)} sub={`${hoursPerDay}h/day`} />
          <Stat label="soft cap (left today)" value={fmt(cap)} sub={`− ${fmt(doneToday)} done`} />
          <Stat label="recommended" value={infeasible ? 'at risk' : fmt(recommended)} sub={infeasible ? 'extend / drop / accept' : 'pace-first · ≤ cap'} />

          <Field label={`hours/day · ${hoursPerDay}h`}><input type="range" min="0.5" max="6" step="0.5" value={hoursPerDay} onChange={(e) => setHoursPerDay(+e.target.value)} style={{ width: '100%' }} /></Field>
          <Field label={`already studied today · ${fmt(doneToday)}`}><input type="range" min="0" max={budget} step="5" value={Math.min(doneToday, budget)} onChange={(e) => setDoneToday(+e.target.value)} style={{ width: '100%' }} /></Field>
          <Field label={`deadline pressure · ${Math.round(pressure * 100)}%`}><input type="range" min="0" max="1.4" step="0.05" value={pressure} onChange={(e) => setPressure(+e.target.value)} style={{ width: '100%' }} /></Field>
          <Field label={`planned (or drag the knob) · ${fmt(planned)}`}><input type="range" min="5" max={max} step="5" value={planned} onChange={(e) => setPlanned(+e.target.value)} style={{ width: '100%' }} /></Field>

          <div style={{ display: 'flex', gap: 8, margin: '12px 0 4px', flexWrap: 'wrap' }}>
            {phase === 'setting' && <Btn onClick={start} primary>Start session</Btn>}
            {phase === 'running' && <Btn onClick={pause}>Pause</Btn>}
            {phase === 'paused' && <Btn onClick={resume} primary>Resume</Btn>}
            {(phase === 'running' || phase === 'paused') && <Btn onClick={endComplete}>End · complete</Btn>}
            {(phase === 'running' || phase === 'paused') && <Btn onClick={interrupt}>Interrupt / midnight</Btn>}
            {phase === 'ended' && <Btn onClick={reset} primary>New session</Btn>}
          </div>
          {infeasible && <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>deadline at risk — can't be hit at a realistic pace.</div>}
          {beyondCap && phase !== 'setting' && <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>past your daily soft cap — allowed, just flagged.</div>}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>material · {mat.kind} · est {fmt(mat.est)} · logged {fmt(mat.logged)} {mat.complete ? '· ✓ complete' : '· open'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: C.inkFaint }}>
              {log.map((e, i) => (<div key={i}><span style={{ color: C.line }}>{e.t}</span> {e.line}</div>))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Leg({ c, t }) {
  return (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />{t}</span>)
}
function Stat({ label, value, sub }) {
  return (<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0' }}><span style={{ color: '#5F5E5A' }}>{label}</span><span><strong style={{ fontWeight: 500 }}>{value}</strong> <span style={{ color: '#888780', fontSize: 11 }}>{sub}</span></span></div>)
}
function Field({ label, children }) {
  return (<div style={{ margin: '8px 0' }}><div style={{ fontSize: 12, color: '#5F5E5A', marginBottom: 2 }}>{label}</div>{children}</div>)
}
function Btn({ children, onClick, primary }) {
  return (<button onClick={onClick} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${primary ? '#185FA5' : '#D3D1C7'}`, background: primary ? '#185FA5' : '#fff', color: primary ? '#fff' : '#2C2C2A' }}>{children}</button>)
}
