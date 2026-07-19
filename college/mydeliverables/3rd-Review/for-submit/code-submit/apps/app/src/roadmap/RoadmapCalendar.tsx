import { type TouchEvent, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { buildDailyActivity, buildMaterialLedger, deriveBookingStatuses, type MaterialLedgerEntry } from '@study-tracker/progress'
import type { RoadmapInput } from '@study-tracker/progress'
import { dailyCapacityForDate, softCapMinutes } from '../session/sessionPlanning'
import { useEventStore } from '../events/useEventStore'
import { useCalibrationState, useProgressSnapshot } from '../progress'
import {
  deriveBookingsForRoadmap,
  mapMaterialProgressMarks,
  mapMaterialsForRoadmap,
  mapSessions,
} from '../progress/mapEvents'
import type {
  MaterialAddedPayload,
  RoadmapCreatedPayload,
} from '../sync/types'
import { useSync } from '../sync/useSync'
import { ServiceStatusBanner } from '../components/ServiceStatusBanner'
import { useMatchMedia } from '../lib/useMatchMedia'
import {
  bindCells,
  buildMonthGrid,
  calendarMonthBounds,
  clampMonth,
  isStudyDay,
  monthKeyForDate,
  monthKeyToDate,
  shiftMonth,
  type BoundCalendarDay,
  type CalendarBubble,
  type CalendarMaterial,
} from './calendarModel'
import { CalendarCell } from './CalendarCell'
import { DaySheet } from './DaySheet'
import { MonthNav } from './MonthNav'
import { deriveRoadmapLifecycle } from './roadmapLifecycle'
import { DayDetailModal, SessionDetailModal } from './SessionDetailModal'
import { RoadmapEndedBanner } from './RoadmapEndedBanner'
import { summarizeRoadmapProgress } from './roadmapProgress'
import { resolveRoadmap as resolveRoadmapEvent, type RoadmapResolutionKind } from './resolveRoadmap'
import { deriveRoadmapEndedState } from './useRoadmapEndedState'
import { LEGEND_ITEMS } from './statusStyles'
import {
  AddSessionSheet,
  BookingEditorSheet,
  MaterialProgressSheet,
  type BookingEditDraft,
  type BookingMaterialOption,
} from './booking'
import type { MaterialKind } from '../session/types'
import './roadmap.css'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDateRange(startDate: string, deadline: string): string {
  return `${format(parseISO(startDate), 'MMM d')} to ${format(parseISO(deadline), 'MMM d, yyyy')}`
}

function formatMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  if (rest === 0) return `${hours}h`
  return `${hours}h ${rest}m`
}

function collectMaterialsById(materials: MaterialAddedPayload[]): Map<string, CalendarMaterial> {
  const byId = new Map<string, CalendarMaterial>()
  for (const material of materials) {
    byId.set(material.materialId, {
      title: material.title,
      url: material.url,
    })
  }
  return byId
}

function roadmapInputFromPayload(payload: RoadmapCreatedPayload): RoadmapInput {
  const slots = payload.slots ?? []
  return {
    startDate: payload.startDate,
    deadline: payload.deadline,
    weeks: payload.weeks,
    weeklyHours: payload.weeklyHours,
    selectedStudyDays: payload.selectedStudyDays,
    weekdayHours: payload.weekdayHours,
    weekendHours: payload.weekendHours,
    slots: slots.map((slot) => ({
      date: slot.date,
      dayOfWeek: slot.dayOfWeek,
      weekIndex: slot.weekIndex,
      plannedMinutes: slot.plannedMinutes,
      candidateMaterialIds: slot.candidateMaterialIds,
      role: slot.role,
      sessionTitle: slot.sessionTitle ?? null,
    })),
  }
}

function isEditableBubble(
  bubble: CalendarBubble | null,
  today: string,
  readOnly: boolean,
): bubble is CalendarBubble & { bookingId: string } {
  return !readOnly && bubble?.bookingId !== undefined && bubble.status === 'booked' && bubble.date >= today
}

interface RoadmapCalendarProps {
  roadmapCreatedAt?: string | null
  readOnly?: boolean
}

export function RoadmapCalendar({
  roadmapCreatedAt = null,
  readOnly = false,
}: RoadmapCalendarProps = {}) {
  const eventStore = useEventStore()
  const navigate = useNavigate()
  const { logEvent } = useSync()
  const events = useLiveQuery(() => eventStore.getAll(), [eventStore])
  const [viewMonth, setViewMonth] = useState<string | null>(null)
  const [slideDirection, setSlideDirection] = useState<'prev' | 'next' | 'today'>('today')
  const [selectedBubble, setSelectedBubble] = useState<CalendarBubble | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<CalendarBubble | null>(null)
  const [selectedDay, setSelectedDay] = useState<BoundCalendarDay | null>(null)
  const [selectedSheetDay, setSelectedSheetDay] = useState<BoundCalendarDay | null>(null)
  const [addSessionDate, setAddSessionDate] = useState<string | null>(null)
  const [directoryCollapsed, setDirectoryCollapsed] = useState(false)
  const [progressMaterial, setProgressMaterial] = useState<MaterialLedgerEntry | null>(null)
  const touchStartX = useRef<number | null>(null)
  const isMobileCalendar = useMatchMedia('(max-width: 560px)')
  const { calibration, status } = useCalibrationState()
  const progress = useProgressSnapshot(calibration)
  const today = todayISO()
  const loadedEvents = events ?? []

  const lifecycle = useMemo(
    () => deriveRoadmapLifecycle(loadedEvents),
    [loadedEvents],
  )
  const roadmapEnded = useMemo(
    () => deriveRoadmapEndedState(loadedEvents, today),
    [loadedEvents, today],
  )
  const selectedRoadmap = useMemo(() => {
    if (roadmapCreatedAt) {
      return lifecycle.all.find((entry) => entry.roadmapCreatedAt === roadmapCreatedAt) ?? null
    }
    return lifecycle.active[0] ?? null
  }, [lifecycle, roadmapCreatedAt])
  const roadmapPayload = selectedRoadmap?.payload ?? null
  const selectedRoadmapEnded = !readOnly &&
    roadmapEnded.ended &&
    roadmapEnded.entry?.roadmapCreatedAt === selectedRoadmap?.roadmapCreatedAt
  const roadmap = useMemo(
    () => roadmapPayload ? roadmapInputFromPayload(roadmapPayload) : null,
    [roadmapPayload],
  )
  const sessions = useMemo(
    () => mapSessions(loadedEvents),
    [loadedEvents],
  )
  const materialPayloads = useMemo(
    () => selectedRoadmap ? mapMaterialsForRoadmap(loadedEvents, selectedRoadmap) : [],
    [loadedEvents, selectedRoadmap],
  )
  const materialsById = useMemo(
    () => collectMaterialsById(materialPayloads),
    [materialPayloads],
  )
  const materialKindById = useMemo(() => {
    const byId = new Map<string, MaterialKind>()
    for (const material of materialPayloads) byId.set(material.materialId, material.kind)
    return byId
  }, [materialPayloads])
  const materialProgressMarks = useMemo(
    () => selectedRoadmap
      ? mapMaterialProgressMarks(loadedEvents, selectedRoadmap.roadmapCreatedAt)
      : [],
    [loadedEvents, selectedRoadmap],
  )
  const materialLedger = useMemo(
    () => buildMaterialLedger(
      materialPayloads.map((material) => ({
        id: material.materialId,
        title: material.title,
        estimatedMinutes: material.estimatedDuration,
      })),
      sessions,
      materialProgressMarks,
    ),
    [materialPayloads, materialProgressMarks, sessions],
  )
  const materialOptions: BookingMaterialOption[] = useMemo(
    () => materialLedger.map((entry) => ({
      materialId: entry.materialId,
      title: entry.title,
      kind: materialKindById.get(entry.materialId) ?? 'manual',
      started: entry.started,
      done: entry.done,
      remainingEstimatedMinutes: entry.remainingEstimatedMinutes,
      estimatedMinutes: entry.estimatedMinutes,
      lastPosition: entry.lastPosition,
    })),
    [materialLedger, materialKindById],
  )
  const bookings = useMemo(
    () => selectedRoadmap
      ? deriveBookingsForRoadmap(loadedEvents, selectedRoadmap, today)
      : [],
    [loadedEvents, selectedRoadmap, today],
  )
  const todayCapMinutes = useMemo(() => {
    if (!selectedRoadmap) return 0
    const capacity = dailyCapacityForDate(selectedRoadmap, today)
    const doneToday = buildDailyActivity(sessions).find((day) => day.date === today)?.minutes ?? 0
    return softCapMinutes(capacity, doneToday)
  }, [selectedRoadmap, sessions, today])
  const monthBounds = useMemo(
    () => roadmap ? calendarMonthBounds(roadmap.startDate, roadmap.deadline) : null,
    [roadmap],
  )
  const activeViewMonth = useMemo(() => {
    if (!monthBounds) return monthKeyForDate(today)
    return clampMonth(monthKeyToDate(viewMonth ?? monthKeyForDate(today)), monthBounds)
  }, [monthBounds, today, viewMonth])

  const calendar = useMemo(() => {
    if (!roadmap) return null
    const derived = deriveBookingStatuses(bookings, sessions, today)
    const grid = buildMonthGrid(monthKeyToDate(activeViewMonth))
    return bindCells(grid, derived.bookings, derived.unplanned, materialsById)
  }, [activeViewMonth, bookings, materialsById, roadmap, sessions, today])

  const progressSummary = selectedRoadmap
    ? summarizeRoadmapProgress(selectedRoadmap, loadedEvents)
    : null
  const percent = progressSummary?.percentComplete ?? 0
  const projectedFinish = progress?.projection.finishDate ?? null
  const projectionBasis = progress?.projection.basis ?? 'analytic'
  const confidenceInterval = progress?.projection.confidenceInterval ?? null
  const daysEarlyOrLate = projectedFinish && roadmapPayload?.deadline
    ? differenceInCalendarDays(parseISO(roadmapPayload.deadline), parseISO(projectedFinish))
    : null
  const materialPercent = materialLedger.length > 0
    ? Math.round(
      (materialLedger.reduce((total, material) => total + material.estimatedConsumedMinutes, 0) /
        Math.max(1, materialLedger.reduce((total, material) => total + material.estimatedMinutes, 0))) * 100,
    )
    : percent

  if (!events) {
    return (
      <div className="roadmap-page">
        <p className="t-body" role="status" style={{ color: 'var(--text-secondary)' }}>
          Loading roadmap...
        </p>
      </div>
    )
  }

  if (!roadmap || !calendar || !monthBounds) {
    return (
      <div className="roadmap-page roadmap-empty" data-testid="roadmap-empty">
        <div className="roadmap-empty-inner">
          <div className="mono-caps">Active roadmap</div>
          <h1 className="roadmap-empty-title">No active roadmap</h1>
          <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>
            Start from onboarding to build a plan, or come back here after your next roadmap is created.
          </p>
          <Link className="btn btn-accent" to="/onboarding">
            Start a roadmap
          </Link>
        </div>
      </div>
    )
  }

  const purpose = roadmapPayload?.purpose
  const title = purpose ? purpose : 'Active roadmap'
  const dateRange = formatDateRange(roadmap.startDate, roadmap.deadline)
  const studyDays = roadmap.selectedStudyDays ?? []
  const handleMonthChange = (
    nextMonth: string,
    direction: 'prev' | 'next' | 'today',
  ) => {
    setSlideDirection(direction)
    setViewMonth(nextMonth)
  }
  const handleDayBubbleSelect = (bubble: CalendarBubble) => {
    setSelectedDay(null)
    setSelectedSheetDay(null)
    if (isEditableBubble(bubble, today, readOnly)) {
      setSelectedBooking(bubble)
      return
    }
    setSelectedBubble(bubble)
  }
  const handleCalendarBubbleSelect = (bubble: CalendarBubble) => {
    if (isEditableBubble(bubble, today, readOnly)) {
      setSelectedBooking(bubble)
      return
    }
    setSelectedBubble(bubble)
  }
  const handleOverflowSelect = (day: BoundCalendarDay) => {
    if (isMobileCalendar) {
      setSelectedDay(null)
      setSelectedSheetDay(day)
      return
    }
    setSelectedDay(day)
  }
  const handleMobileDaySelect = (day: BoundCalendarDay) => {
    if (!isMobileCalendar) return
    setSelectedDay(null)
    setSelectedSheetDay(day)
  }
  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (!isMobileCalendar) return
    touchStartX.current = event.changedTouches[0]?.clientX ?? null
  }
  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (!isMobileCalendar || !monthBounds || touchStartX.current === null) return

    const endX = event.changedTouches[0]?.clientX
    if (endX === undefined) return

    const deltaX = endX - touchStartX.current
    touchStartX.current = null

    if (Math.abs(deltaX) < 48) return

    const direction = deltaX < 0 ? 'next' : 'prev'
    const nextMonth = shiftMonth(activeViewMonth, direction === 'next' ? 1 : -1, monthBounds)
    if (nextMonth !== activeViewMonth) {
      handleMonthChange(nextMonth, direction)
      setSelectedSheetDay(null)
    }
  }
  const resolveRoadmap = async (kind: RoadmapResolutionKind) => {
    if (!selectedRoadmap || readOnly) return

    const resolved = await resolveRoadmapEvent({
      kind,
      roadmapCreatedAt: selectedRoadmap.roadmapCreatedAt,
      logEvent,
    })
    if (!resolved) return

    navigate('/roadmaps')
  }
  const handleSaveBooking = async (bubble: CalendarBubble, draft: BookingEditDraft) => {
    if (!selectedRoadmap || !isEditableBubble(bubble, today, readOnly)) return

    await logEvent('BookingEdited', {
      roadmapCreatedAt: selectedRoadmap.roadmapCreatedAt,
      bookingId: bubble.bookingId,
      date: draft.date,
      estimatedDuration: draft.estimatedDuration,
      materialId: draft.materialId,
    })
    setSelectedBooking(null)
  }
  const handleRemoveBooking = async (bubble: CalendarBubble) => {
    if (!selectedRoadmap || !isEditableBubble(bubble, today, readOnly)) return

    await logEvent('BookingCleared', {
      roadmapCreatedAt: selectedRoadmap.roadmapCreatedAt,
      bookingId: bubble.bookingId,
    })
    setSelectedBooking(null)
  }
  const handleCreateBooking = async (draft: { date: string; estimatedDuration: number; materialId?: string }) => {
    if (!selectedRoadmap || readOnly) return

    await logEvent('SessionBooked', {
      roadmapCreatedAt: selectedRoadmap.roadmapCreatedAt,
      bookingId: crypto.randomUUID(),
      date: draft.date,
      estimatedDuration: draft.estimatedDuration,
      ...(draft.materialId ? { materialId: draft.materialId } : {}),
    })
    setAddSessionDate(null)
  }
  const handleMarkMaterialProgress = async (material: MaterialLedgerEntry, percentDone: number) => {
    if (!selectedRoadmap || readOnly) return

    await logEvent('MaterialProgressMarked', {
      roadmapCreatedAt: selectedRoadmap.roadmapCreatedAt,
      materialId: material.materialId,
      markedAt: new Date().toISOString(),
      materialPosition: { kind: 'percent', value: percentDone },
      source: 'directory',
    })
    setProgressMaterial(null)
  }

  return (
    <div className="roadmap-page">
      <ServiceStatusBanner status={status} />

      {selectedRoadmapEnded && selectedRoadmap && (
        <RoadmapEndedBanner
          entry={selectedRoadmap}
          onMarkComplete={() => void resolveRoadmap('RoadmapMarkedComplete')}
          onAbandon={() => void resolveRoadmap('RoadmapMarkedAbandoned')}
        />
      )}

      {(!readOnly || roadmapCreatedAt != null) && (
        <Link className="roadmap-back-link" to="/roadmaps">
          &larr; Roadmaps
        </Link>
      )}

      <header className="roadmap-header">
        <div>
          <div className="mono-caps">
            {readOnly ? 'Roadmap history' : 'Active roadmap'} · {materialsById.size} materials · {roadmap.weeks} weeks
          </div>
          <h1 className="roadmap-title">{title}</h1>
          <p className="roadmap-subtitle">{dateRange}</p>
        </div>

        <section className="roadmap-eta-card" aria-label="Projected finish">
          <div className="roadmap-eta-copy">
            <div className="mono-caps">
              <span className="roadmap-provisional">provisional estimate</span> · finish
            </div>
            <div className="roadmap-eta-finish">
              {projectedFinish
                ? (confidenceInterval
                  ? `${format(parseISO(confidenceInterval[0]), 'MMM d')}-${format(parseISO(confidenceInterval[1]), 'MMM d')}`
                  : format(parseISO(projectedFinish), 'MMM d'))
                : 'After first log'}
            </div>
            <div className="mono-caps roadmap-eta-meta">
              {projectedFinish && daysEarlyOrLate !== null
                ? daysEarlyOrLate > 0
                  ? `${daysEarlyOrLate} days early`
                  : daysEarlyOrLate === 0
                    ? 'On target'
                    : `${Math.abs(daysEarlyOrLate)} days late`
                : `${Math.round(materialPercent)}% done`}
              {' '}· {projectionBasis}
            </div>
          </div>
          <svg className="roadmap-eta-spark" viewBox="0 0 160 44" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,42 40,34 80,24 120,14 160,4" fill="none" stroke="var(--border-default)" strokeWidth="1.5" strokeDasharray="3 3" />
            <polyline
              points={`0,42 40,${Math.max(8, 42 - materialPercent * 0.18)} 80,${Math.max(6, 42 - materialPercent * 0.32)}`}
              fill="none"
              stroke="var(--moss)"
              strokeWidth="2.5"
            />
          </svg>
        </section>
      </header>

      <div className="roadmap-toolbar">
        <MonthNav
          viewMonth={activeViewMonth}
          bounds={monthBounds}
          todayMonth={monthKeyForDate(today)}
          onChange={handleMonthChange}
        />
        <div className="roadmap-legend" aria-label="Roadmap status legend">
          <span className="roadmap-legend-item">
            <span className="roadmap-legend-swatch roadmap-studyday-swatch" aria-hidden="true" />
            Study day
          </span>
          {LEGEND_ITEMS.map((item) => (
            <span key={item.status} className="roadmap-legend-item">
              <span
                className={`roadmap-legend-swatch ${item.chipClass}`}
                data-status={item.status}
                data-icon={item.icon}
                aria-hidden="true"
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <section
        className="roadmap-calendar-shell"
        data-testid="roadmap-calendar"
        aria-label={`${calendar.monthLabel} roadmap calendar`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="roadmap-weekdays" role="row">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className={`roadmap-weekday${studyDays.includes(label) ? ' roadmap-weekday-studyday' : ''}`}
              role="columnheader"
            >
              {label}
            </div>
          ))}
        </div>

        <div
          key={calendar.monthKey}
          className="roadmap-calendar-slide"
          data-direction={slideDirection}
          role="grid"
        >
          {calendar.weeks.map((week) => {
            const isCurrentWeek = week.some((day) => day.date === today)
            return (
              <div key={week[0].date} className="roadmap-week-row" role="row">
                {week.map((day) => (
                  <CalendarCell
                    key={day.date}
                    day={day}
                    isToday={day.date === today}
                    isDeadline={day.date === roadmap.deadline && day.isInMonth}
                    isCurrentWeek={isCurrentWeek}
                    isStudyDay={day.isInMonth && isStudyDay(day.date, studyDays)}
                    onBubbleClick={handleCalendarBubbleSelect}
                    onOverflowClick={handleOverflowSelect}
                    onDayClick={handleMobileDaySelect}
                    onAddSessionClick={setAddSessionDate}
                    canAddSession={!readOnly}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </section>

      <section className={`dir-panel${directoryCollapsed ? ' collapsed' : ''}`} aria-label="Materials directory">
        <button
          type="button"
          className="dir-head"
          aria-expanded={!directoryCollapsed}
          onClick={() => setDirectoryCollapsed((collapsed) => !collapsed)}
        >
          <span className="ttl">Materials</span>
          <span className="count-pill">{materialLedger.length} · {Math.round(materialPercent)}% done</span>
          <svg className="icon icon-sm chev" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {!directoryCollapsed && (
          <div className="dir-body">
            {materialLedger.length === 0 ? (
              <p className="roadmap-muted">No materials are attached to this roadmap.</p>
            ) : (
              materialLedger.map((material) => {
                const progressPercent = material.estimatedMinutes > 0
                  ? Math.round((material.estimatedConsumedMinutes / material.estimatedMinutes) * 100)
                  : 0
                return (
                  <div className="dir-row" key={material.materialId}>
                    <div className="material-icon art" aria-hidden="true">
                      {material.title.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="dir-prog">
                      <div className="dir-title">{material.title}</div>
                      <div className="dir-bar" aria-hidden="true">
                        <span style={{ width: `${Math.min(100, progressPercent)}%` }} />
                      </div>
                      <div className="dir-meta">
                        {material.done ? 'done' : material.started ? 'in progress' : 'not started'} · {formatMinutes(material.estimatedConsumedMinutes)} of {formatMinutes(material.estimatedMinutes)}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      disabled={readOnly}
                      onClick={() => setProgressMaterial(material)}
                    >
                      Mark progress
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}
      </section>

      <footer className="roadmap-footer">
        {readOnly ? (
          <span className="roadmap-readonly-note" data-testid="roadmap-readonly">
            Read-only history view
          </span>
        ) : (
          <>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => void resolveRoadmap('RoadmapMarkedComplete')}
            >
              Mark roadmap complete
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => void resolveRoadmap('RoadmapMarkedAbandoned')}
            >
              Abandon roadmap
            </button>
          </>
        )}
        <button className="btn btn-ghost" type="button" disabled>
          Edit roadmap
        </button>
        {readOnly ? (
          <button className="btn btn-ghost" type="button" disabled>
            Replan
          </button>
        ) : (
          <Link className="btn btn-ghost" to="/replan">
            Replan
          </Link>
        )}
      </footer>

      <DayDetailModal
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
        onSelectBubble={handleDayBubbleSelect}
      />
      <DaySheet
        day={selectedSheetDay}
        onClose={() => setSelectedSheetDay(null)}
        onSelectBubble={handleDayBubbleSelect}
        canAddSession={!readOnly}
        onAddSession={(date) => {
          setSelectedSheetDay(null)
          setAddSessionDate(date)
        }}
      />
      <SessionDetailModal
        bubble={selectedBubble}
        onClose={() => setSelectedBubble(null)}
        canEdit={false}
      />
      <BookingEditorSheet
        bubble={selectedBooking}
        materials={materialOptions}
        onClose={() => setSelectedBooking(null)}
        onSave={(bubble, draft) => void handleSaveBooking(bubble, draft)}
        onRemove={(bubble) => void handleRemoveBooking(bubble)}
      />
      <AddSessionSheet
        date={addSessionDate}
        materials={materialOptions}
        capMinutes={todayCapMinutes}
        onClose={() => setAddSessionDate(null)}
        onCreate={(draft) => void handleCreateBooking(draft)}
      />
      <MaterialProgressSheet
        material={progressMaterial}
        onClose={() => setProgressMaterial(null)}
        onSave={(material, percentDone) => void handleMarkMaterialProgress(material, percentDone)}
      />
    </div>
  )
}
