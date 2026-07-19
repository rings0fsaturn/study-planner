import { useEffect, useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  buildMaterialLedger,
  calibrationDenominator,
  isCalibrationSession,
  projectFinish,
  type SessionEvent,
} from '@study-tracker/progress'
import type { DayOfWeek } from '@study-tracker/roadmap-engine'
import { useEventStore } from '../events/useEventStore'
import { useSync } from '../sync/useSync'
import {
  deriveRoadmapLifecycle,
  type RoadmapLifecycleEntry,
} from '../roadmap/roadmapLifecycle'
import {
  mapSessions,
  mapMaterialsForRoadmap,
  mapMaterialProgressMarks,
} from '../progress/mapEvents'
import type { MaterialKind } from '../session/types'
import { commitReplan } from '../roadmap/replan/commitReplan'
import { materialIcon } from '../roadmap/booking/types'
import '../roadmap/roadmap.css'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(iso: string): string {
  return format(parseISO(iso), 'MMM d')
}

function addWeeks(iso: string, weeks: number): string {
  return format(addDays(parseISO(iso), weeks * 7), 'yyyy-MM-dd')
}

function addDaysISO(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), 'yyyy-MM-dd')
}

function dayOfWeekForISO(iso: string): DayOfWeek {
  const index = parseISO(iso).getDay()
  return (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const)[index]
}

function fmtMin(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes))
  const h = Math.floor(safeMinutes / 60)
  const m = safeMinutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

const DAY_LABELS: { day: DayOfWeek; label: string }[] = [
  { day: 'Mon', label: 'M' },
  { day: 'Tue', label: 'T' },
  { day: 'Wed', label: 'W' },
  { day: 'Thu', label: 'T' },
  { day: 'Fri', label: 'F' },
  { day: 'Sat', label: 'S' },
  { day: 'Sun', label: 'S' },
]

interface MaterialRow {
  materialId: string
  title: string
  role: 'anchor' | 'foundation' | 'practice'
  kind: MaterialKind
  fullRemainingMinutes: number
  hadDurationOverride: boolean
}

// Live re-projection: analytic-only (empty gpCurve, fast, no calibration needed)
function computeFinish(
  consumedActualMin: number,
  remainingActualMin: number,
  sessionCount: number,
  startDate: string,
  today: string,
  horizonEnd: string,
): string | null {
  return projectFinish({
    sessionCount,
    consumedActualMin,
    remainingActualMin,
    startDate,
    today,
    horizonEnd,
    gpCurve: [],
    totalPlanned: consumedActualMin + remainingActualMin,
  }).finishDate
}

function demonstratedThroughputFactor(sessions: SessionEvent[]): number {
  const ratios: number[] = []
  for (const session of sessions) {
    if (!isCalibrationSession(session)) continue
    const denominator = calibrationDenominator(session)
    if (!denominator || session.activeMinutes == null) continue
    ratios.push(session.activeMinutes / denominator)
  }
  if (ratios.length === 0) return 1
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length
}

function computeCapacityAwareFinish(args: {
  remainingEstimatedMin: number
  sessions: SessionEvent[]
  today: string
  hoursPerDay: number
  selectedDays: DayOfWeek[]
}): string | null {
  if (args.remainingEstimatedMin <= 0) return args.today
  if (args.hoursPerDay <= 0 || args.selectedDays.length === 0) return null

  const daySet = new Set(args.selectedDays)
  const requiredActiveMinutes =
    args.remainingEstimatedMin * Math.max(0.1, demonstratedThroughputFactor(args.sessions))
  const dailyCapacity = args.hoursPerDay * 60
  let accumulated = 0

  for (let offset = 0; offset <= 3650; offset += 1) {
    const date = addDaysISO(args.today, offset)
    if (!daySet.has(dayOfWeekForISO(date))) continue
    accumulated += dailyCapacity
    if (accumulated >= requiredActiveMinutes) return date
  }

  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Replan() {
  const eventStore = useEventStore()
  const { logEvent } = useSync()
  const location = useLocation()
  const navigate = useNavigate()
  const [today] = useState(todayISO)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const intent = new URLSearchParams(location.search).get('intent')

  const events = useLiveQuery(() => eventStore.getAll(), [eventStore])
  const loadedEvents = useMemo(() => events ?? [], [events])

  // Derive base data from events (memoised — expensive, only when events change)
  const replanData = useMemo(() => {
    if (!events) return null
    const lifecycle = deriveRoadmapLifecycle(loadedEvents)
    const activeEntry: RoadmapLifecycleEntry | undefined = lifecycle.active[0]
    if (!activeEntry) return null

    const materialPayloads = mapMaterialsForRoadmap(loadedEvents, activeEntry)
    const sessions = mapSessions(loadedEvents)
    const progressMarks = mapMaterialProgressMarks(loadedEvents, activeEntry.roadmapCreatedAt)

    const ledger = buildMaterialLedger(
      materialPayloads.map((m) => ({
        id: m.materialId,
        title: m.title,
        estimatedMinutes: m.estimatedDuration,
      })),
      sessions,
      progressMarks,
    )

    const ledgerMap = new Map(ledger.map((e) => [e.materialId, e]))
    const consumedActualMin = ledger.reduce((s, e) => s + e.activeMinutesLogged, 0)
    const remainingActualMin = ledger.reduce((s, e) => s + e.remainingEstimatedMinutes, 0)
    const activeSessions = sessions.filter((s) => s.source === 'active')

    const materialRows: MaterialRow[] = materialPayloads.map((m) => ({
      materialId: m.materialId,
      title: m.title,
      role: m.role,
      kind: m.kind,
      hadDurationOverride: activeEntry.payload.materialDurationOverrides?.[m.materialId] !== undefined,
      fullRemainingMinutes: Math.max(
        15,
        ledgerMap.get(m.materialId)?.remainingEstimatedMinutes ?? m.estimatedDuration,
      ),
    }))

    return {
      activeEntry,
      materialPayloads,
      materialRows,
      consumedActualMin,
      remainingActualMin,
      sessionCount: activeSessions.length,
      startDate: activeEntry.payload.startDate,
      currentDeadline: activeEntry.payload.deadline,
      currentHoursPerDay: activeEntry.payload.weekdayHours,
      currentStudyDays: activeEntry.payload.selectedStudyDays as DayOfWeek[],
    }
  }, [events, loadedEvents])

  // Lever state — initialise from active entry on first load
  const [extendWeeks, setExtendWeeks] = useState<0 | 1 | 2>(
    intent === 'extend' ? 1 : 0,
  )
  const [hoursPerDay, setHoursPerDay] = useState<number>(
    () => replanData?.currentHoursPerDay ?? 1,
  )
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>(
    () => replanData?.currentStudyDays ?? ['Mon'],
  )
  const [capacityInitializedFor, setCapacityInitializedFor] = useState<string | null>(null)
  // materialId → target remaining minutes; 0 = dropped; absent = use full remaining
  const [materialOverrides, setMaterialOverrides] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!replanData) return
    const roadmapId = replanData.activeEntry.roadmapCreatedAt
    if (capacityInitializedFor === roadmapId) return

    setHoursPerDay(replanData.currentHoursPerDay)
    setSelectedDays(replanData.currentStudyDays.length > 0 ? replanData.currentStudyDays : ['Mon'])
    setMaterialOverrides({})
    setCapacityInitializedFor(roadmapId)
  }, [capacityInitializedFor, replanData])

  const currentDeadline = replanData?.currentDeadline ?? today
  const newDeadline = addWeeks(currentDeadline, extendWeeks)

  // Adjusted remaining minutes given shorten/drop levers
  const adjustedRemaining = useMemo(() => {
    if (!replanData) return 0
    return replanData.materialRows.reduce((sum, m) => {
      const override = materialOverrides[m.materialId]
      if (override === 0) return sum
      return sum + (override !== undefined
        ? Math.min(override, m.fullRemainingMinutes)
        : m.fullRemainingMinutes)
    }, 0)
  }, [replanData, materialOverrides])

  // Context banner: current pace, original remaining + original deadline
  const currentFinish = useMemo(() => {
    if (!replanData) return null
    return computeFinish(
      replanData.consumedActualMin,
      replanData.remainingActualMin,
      replanData.sessionCount,
      replanData.startDate,
      today,
      replanData.currentDeadline,
    )
  }, [replanData, today])

  // Live outcome: adjusted remaining + new deadline
  const newFinish = useMemo(() => {
    if (!replanData) return null
    return computeCapacityAwareFinish({
      remainingEstimatedMin: adjustedRemaining,
      sessions: mapSessions(loadedEvents),
      today,
      hoursPerDay,
      selectedDays,
    })
  }, [replanData, adjustedRemaining, loadedEvents, today, hoursPerDay, selectedDays])

  const currentDelta = currentFinish
    ? Math.round(
        (parseISO(currentFinish).getTime() - parseISO(currentDeadline).getTime()) / 86_400_000,
      )
    : null

  const newDelta = newFinish
    ? Math.round(
        (parseISO(newFinish).getTime() - parseISO(newDeadline).getTime()) / 86_400_000,
      )
    : null

  // Material lever helpers
  function setMaterialRemaining(materialId: string, value: number, full: number) {
    const clamped = Math.max(0, Math.min(full, value))
    setMaterialOverrides((prev) => ({ ...prev, [materialId]: clamped }))
  }

  function toggleDrop(materialId: string, full: number) {
    setMaterialOverrides((prev) => {
      if ((prev[materialId] ?? full) === 0) return { ...prev, [materialId]: full }
      return { ...prev, [materialId]: 0 }
    })
  }

  // Commit
  const handleApply = async () => {
    if (!replanData) return
    setApplying(true)
    setError(null)
    try {
      const nonDropped = replanData.materialRows.filter(
        (m) => (materialOverrides[m.materialId] ?? m.fullRemainingMinutes) > 0,
      )
      const overrides: Record<string, number> = {}
      for (const m of nonDropped) {
        const targetRemaining = materialOverrides[m.materialId] ?? m.fullRemainingMinutes
        if (m.hadDurationOverride || targetRemaining !== m.fullRemainingMinutes) {
          overrides[m.materialId] = targetRemaining
        }
      }

      await commitReplan({
        events: loadedEvents,
        roadmapCreatedAt: replanData.activeEntry.roadmapCreatedAt,
        logEvent,
        today,
        deadline: newDeadline,
        weekdayHours: hoursPerDay,
        weekendHours: hoursPerDay,
        selectedStudyDays: selectedDays,
        materialIds: nonDropped.map((m) => m.materialId),
        materialDurationOverrides: Object.keys(overrides).length > 0 ? overrides : undefined,
        materials: nonDropped.map((m) => ({
          materialId: m.materialId,
          title: m.title,
          role: m.role,
          remainingMinutes: materialOverrides[m.materialId] ?? m.fullRemainingMinutes,
        })),
      })
      navigate('/roadmap')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply replan')
    } finally {
      setApplying(false)
    }
  }

  // --------------------------------------------------------------------------
  // Loading / no active roadmap
  // --------------------------------------------------------------------------

  if (!events) {
    return (
      <main className="replan-page">
        <p className="t-body" role="status">Loading replan...</p>
      </main>
    )
  }

  if (!replanData) {
    return (
      <main className="replan-page">
        <div className="mono-caps">Replan</div>
        <h1 className="t-display-2">No active roadmap</h1>
        <p className="t-body">There is no active roadmap to replan.</p>
        <button className="btn btn-secondary" type="button" onClick={() => navigate('/roadmaps')}>
          Back to roadmaps
        </button>
      </main>
    )
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <main className="replan-page">
      <div className="mono-caps">Replan</div>
      <h1 className="t-display-2" style={{ margin: '2px 0 12px' }}>Adjust your plan</h1>

      {/* Context banner — current pace */}
      {currentFinish && currentDelta !== null && (
        <div className="rp-ctx" role="note">
          At your current pace you'll finish{' '}
          <strong>{fmtDate(currentFinish)}</strong>
          {currentDelta > 0 ? (
            <>
              {' '}— <strong>{currentDelta} day{currentDelta !== 1 ? 's' : ''} past</strong> your{' '}
              {fmtDate(currentDeadline)} deadline.
            </>
          ) : currentDelta < 0 ? (
            <>
              {' '}— <strong>{Math.abs(currentDelta)} day{Math.abs(currentDelta) !== 1 ? 's' : ''} before</strong>{' '}
              your {fmtDate(currentDeadline)} deadline.
            </>
          ) : (
            <> — exactly on your {fmtDate(currentDeadline)} deadline.</>
          )}
        </div>
      )}

      {error && <p className="field-error" role="alert">{error}</p>}

      <div className="rp-split">
        {/* LEFT: levers */}
        <div>
          {/* Lever 1: Extend deadline */}
          <div className="lever">
            <div className="lever-t">Extend the deadline</div>
            <div className="lever-sub">Give yourself more time.</div>
            <div className="lever-body presets" role="group" aria-label="Deadline extension">
              {([0, 1, 2] as const).map((weeks) => (
                <button
                  key={weeks}
                  className={`preset${extendWeeks === weeks ? ' on' : ''}`}
                  type="button"
                  aria-pressed={extendWeeks === weeks}
                  onClick={() => setExtendWeeks(weeks)}
                >
                  {weeks === 0 ? `Keep ${fmtDate(currentDeadline)}` : `+${weeks} week${weeks > 1 ? 's' : ''}`}
                </button>
              ))}
            </div>
          </div>

          {/* Lever 2: Capacity */}
          <div className="lever">
            <div className="lever-t">Study more each week</div>
            <div className="lever-sub">Hours per day and which days.</div>
            <div className="lever-body">
              <div className="row-between" style={{ marginBottom: 12 }}>
                <span className="t-body">Hours per day</span>
                <div className="stepper" role="group" aria-label="Hours per day">
                  <button
                    type="button"
                    aria-label="Decrease hours per day"
                    onClick={() => setHoursPerDay((h) => Math.max(0.5, Math.round((h - 0.5) * 10) / 10))}
                  >−</button>
                  <span className="val" data-testid="hours-per-day-value">{hoursPerDay}h</span>
                  <button
                    type="button"
                    aria-label="Increase hours per day"
                    onClick={() => setHoursPerDay((h) => Math.min(12, Math.round((h + 0.5) * 10) / 10))}
                  >+</button>
                </div>
              </div>
              <div className="daychips" role="group" aria-label="Study days">
                {DAY_LABELS.map(({ day, label }, idx) => (
                  <button
                    key={`${day}-${idx}`}
                    className={`daychip${selectedDays.includes(day) ? ' on' : ''}`}
                    type="button"
                    aria-pressed={selectedDays.includes(day)}
                    aria-label={day}
                    onClick={() =>
                      setSelectedDays((prev) =>
                        prev.includes(day) && prev.length > 1
                          ? prev.filter((d) => d !== day)
                          : prev.includes(day)
                          ? prev
                          : [...prev, day],
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lever 3: Materials */}
          {replanData.materialRows.length > 0 && (
            <div className="lever">
              <div className="lever-t">Drop or shorten materials</div>
              <div className="lever-sub">Set how much of each you'll do — or remove it (×).</div>
              <div className="lever-body">
                {replanData.materialRows.map((m) => {
                  const full = m.fullRemainingMinutes
                  const current = materialOverrides[m.materialId] ?? full
                  const dropped = current === 0
                  const icon = materialIcon({ kind: m.kind, lastPosition: undefined })
                  return (
                    <div key={m.materialId} className={`matline${dropped ? ' dropped' : ''}`}>
                      <span
                        className={`material-icon ${icon.cls}`}
                        aria-hidden="true"
                        style={{ width: 28, height: 28, flexShrink: 0 }}
                      >
                        {icon.label}
                      </span>
                      <div className="body">
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{m.title}</div>
                        <div className="lever-sub">
                          {dropped
                            ? 'dropped'
                            : current < full
                            ? `shortened · was ${fmtMin(full)}`
                            : 'planned'}
                        </div>
                      </div>
                      <div className="mshort" role="group" aria-label={`Adjust ${m.title}`}>
                        <button
                          type="button"
                          aria-label={`Shorten ${m.title}`}
                          onClick={() => setMaterialRemaining(m.materialId, current - 15, full)}
                        >−</button>
                        <span className="mval">{fmtMin(current)}</span>
                        <button
                          type="button"
                          aria-label={`Lengthen ${m.title}`}
                          onClick={() => setMaterialRemaining(m.materialId, current + 15, full)}
                        >+</button>
                      </div>
                      <button
                        className="mdrop"
                        type="button"
                        aria-label={dropped ? `Restore ${m.title}` : `Drop ${m.title}`}
                        title={dropped ? 'Restore' : 'Drop this material'}
                        onClick={() => toggleDrop(m.materialId, full)}
                      >
                        {dropped ? '↩' : '×'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: sticky outcome panel */}
        <aside className="rp-out">
          <div className="mono-caps" style={{ marginBottom: 4 }}>
            <span className="provisional">estimate</span> · new finish
          </div>
          <div className="rp-big" aria-label="Projected finish" aria-live="polite">
            {newFinish ? fmtDate(newFinish) : '—'}
          </div>
          {newFinish && newDelta !== null && (
            <div className={`rp-delta${newDelta > 0 ? ' late' : ' early'}`}>
              {newDelta === 0
                ? 'On target'
                : newDelta > 0
                ? `${newDelta} day${newDelta !== 1 ? 's' : ''} late`
                : `${Math.abs(newDelta)} day${Math.abs(newDelta) !== 1 ? 's' : ''} early`}
            </div>
          )}
          <div className="rp-was">
            <span>deadline</span>
            <span>{fmtDate(newDeadline)}</span>
          </div>
          {currentFinish && (
            <div className="rp-was" style={{ borderTop: 0, paddingTop: 6 }}>
              <span>was</span>
              <span>
                {fmtDate(currentFinish)}
                {currentDelta !== null && currentDelta > 0 ? ` · ${currentDelta} late` : ''}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <button
              className="btn btn-accent btn-block"
              type="button"
              disabled={applying || selectedDays.length === 0}
              onClick={() => void handleApply()}
            >
              {applying ? 'Applying...' : 'Apply changes'}
            </button>
            <button
              className="btn btn-secondary btn-block"
              type="button"
              onClick={() => navigate('/roadmap')}
            >
              Keep current
            </button>
          </div>
          <p className="t-body-sm" style={{ color: 'var(--text-tertiary)', marginTop: 10 }}>
            Keep current = accept the later finish.
          </p>
        </aside>
      </div>
    </main>
  )
}
