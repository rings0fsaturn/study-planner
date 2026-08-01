import { useCallback, useEffect, useMemo, useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  generateBookings,
  type Booking,
  type BookingLayoutInput,
  type CapacityCheck,
  type Material as RoadmapMaterial,
} from '@study-tracker/roadmap-engine'
import { useOnboarding } from '../OnboardingProvider'
import { useSync } from '../../sync/useSync'
import { useEventStore } from '../../events/useEventStore'
import type {
  MaterialAddedPayload,
  RoadmapCreatedPayload,
  SessionBookedPayload,
} from '../../sync/types'
import { deriveRoadmapLifecycle } from '../../roadmap/roadmapLifecycle'
import {
  buildMonthGrid,
  calendarMonthBounds,
  clampMonth,
  isStudyDay,
  monthKeyForDate,
  shiftMonth,
} from '../../roadmap/calendarModel'
import { useOnboardingNavigate } from '../useOnboardingNavigate'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

function formatMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes))
  if (rounded < 60) return `${rounded}m`
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

function formatShortDate(iso: string): string {
  return format(parseISO(iso), 'MMM d')
}

function roadmapWeeks(startDate: string, deadline: string): number {
  const days = differenceInCalendarDays(parseISO(deadline), parseISO(startDate))
  return Math.max(1, Math.ceil(Math.max(0, days) / 7))
}

function capacityHeadline(capacityCheck: CapacityCheck): string {
  if (capacityCheck.status === 'over-capacity') return 'Needs more time'
  return 'Your backlog fits your time'
}

function capacityMeta(capacityCheck: CapacityCheck): string {
  return `${formatMinutes(capacityCheck.totalMaterialMinutes)} of ${formatMinutes(capacityCheck.totalCapacityMinutes)} capacity`
}

function materialIcon(kind: string | undefined): string {
  if (kind === 'youtube') return 'YT'
  if (kind === 'article') return 'ART'
  return 'BK'
}

function bookingByDate(bookings: Booking[]): Map<string, Booking[]> {
  const byDate = new Map<string, Booking[]>()
  for (const booking of bookings) {
    const list = byDate.get(booking.date) ?? []
    list.push(booking)
    byDate.set(booking.date, list)
  }
  return byDate
}

export function Step3Preview() {
  const { state, expandedMaterials } = useOnboarding()
  const { logEvent } = useSync()
  const eventStore = useEventStore()
  const location = useLocation()
  const navigate = useNavigate()
  const stepNavigate = useOnboardingNavigate()
  const [committing, setCommitting] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const startDate = useMemo(() => todayISO(), [])
  const newRoadmapMode =
    new URLSearchParams(location.search).get('new') === '1' ||
    (location.state as { newRoadmap?: boolean } | null)?.newRoadmap === true

  const roadmapMaterials = useMemo((): RoadmapMaterial[] => (
    expandedMaterials
      .filter((material) => material.title && material.estimatedDuration > 0)
      .map((material, index) => ({
        id: material.id,
        title: material.title,
        totalMinutes: material.estimatedDuration,
        role: material.role,
        additionOrder: index,
      }))
  ), [expandedMaterials])

  const bookingInput = useMemo((): BookingLayoutInput | null => {
    if (!state.deadline || state.selectedStudyDays.length === 0 || roadmapMaterials.length === 0) return null
    return {
      startDate,
      deadline: state.deadline,
      selectedStudyDays: state.selectedStudyDays,
      weekdayHours: state.weekdayHours,
      weekendHours: state.weekendHours,
      materials: roadmapMaterials,
    }
  }, [roadmapMaterials, startDate, state.deadline, state.selectedStudyDays, state.weekdayHours, state.weekendHours])

  const bookingResult = useMemo(() => {
    if (!bookingInput) return null
    return generateBookings(bookingInput)
  }, [bookingInput])

  const bookings = bookingResult?.bookings ?? []
  const capacityCheck = bookingResult?.capacityCheck
  const finishDate = bookings[bookings.length - 1]?.date ?? state.deadline ?? startDate
  const bufferDays = state.deadline
    ? Math.max(0, differenceInCalendarDays(parseISO(state.deadline), parseISO(finishDate)))
    : 0
  const capacityPercent = capacityCheck && capacityCheck.totalCapacityMinutes > 0
    ? Math.min(100, Math.round((capacityCheck.totalMaterialMinutes / capacityCheck.totalCapacityMinutes) * 100))
    : 0

  const bounds = useMemo(() => {
    if (!state.deadline) return null
    return calendarMonthBounds(startDate, state.deadline)
  }, [startDate, state.deadline])
  const [viewMonth, setViewMonth] = useState(() => monthKeyForDate(finishDate))

  useEffect(() => {
    if (!bounds) return
    setViewMonth(clampMonth(finishDate, bounds))
  }, [bounds, finishDate])

  const calendar = useMemo(() => buildMonthGrid(`${viewMonth}-01`), [viewMonth])
  const bookingsForDate = useMemo(() => bookingByDate(bookings), [bookings])

  const toggleCalendar = useCallback(() => {
    setCalendarOpen((open) => !open)
  }, [])

  const handleCalendarKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleCalendar()
    }
  }, [toggleCalendar])

  const handleCommit = useCallback(async () => {
    if (!bookingInput || !capacityCheck || capacityCheck.status === 'over-capacity' || committing) return
    setCommitting(true)
    try {
      const existingEvents = await eventStore.getAll()
      const hasCompletedOnboarding = existingEvents.some((event) => event.kind === 'OnboardingCompleted')
      const hasActiveRoadmap = deriveRoadmapLifecycle(existingEvents).active.length > 0

      if (newRoadmapMode && hasCompletedOnboarding && hasActiveRoadmap) {
        navigate('/roadmaps')
        return
      }

      const committedMaterialIds: string[] = []
      for (const material of expandedMaterials) {
        if (!material.title || material.estimatedDuration <= 0) continue
        committedMaterialIds.push(material.id)
        const payload: MaterialAddedPayload = {
          materialId: material.id,
          title: material.title,
          estimatedDuration: material.estimatedDuration,
          url: material.url,
          kind: material.kind ?? 'manual',
          role: material.role,
          playlistId: material.playlistId,
          youtubeVideoId: material.youtubeVideoId,
          videos: material.playlistVideos?.map((video) => ({
            youtubeVideoId: video.youtubeVideoId,
            title: video.title,
            durationMinutes: video.durationMinutes,
          })),
        }
        await logEvent('MaterialAdded', payload as unknown as Record<string, unknown>)
      }

      const roadmapCreatedAt = new Date().toISOString()
      const roadmapPayload: RoadmapCreatedPayload = {
        startDate: bookingInput.startDate,
        deadline: bookingInput.deadline,
        weeks: roadmapWeeks(bookingInput.startDate, bookingInput.deadline),
        purpose: state.purpose || undefined,
        selectedStudyDays: state.selectedStudyDays,
        weekdayHours: state.weekdayHours,
        weekendHours: state.weekendHours,
        weeklyHours: state.weeklyHours,
        materialIds: committedMaterialIds,
      }

      await logEvent('RoadmapCreated', roadmapPayload as unknown as Record<string, unknown>, roadmapCreatedAt)

      for (const booking of bookings) {
        const payload: SessionBookedPayload = {
          roadmapCreatedAt,
          bookingId: booking.id,
          date: booking.date,
          estimatedDuration: booking.estimatedDuration,
        }
        await logEvent('SessionBooked', payload as unknown as Record<string, unknown>)
      }

      if (!hasCompletedOnboarding) {
        await logEvent('OnboardingCompleted', {})
      }
      await eventStore.table('onboardingDraft').clear()

      navigate(hasCompletedOnboarding ? '/roadmaps' : '/onboarding/4')
    } finally {
      setCommitting(false)
    }
  }, [
    bookingInput,
    bookings,
    capacityCheck,
    committing,
    eventStore,
    expandedMaterials,
    logEvent,
    navigate,
    newRoadmapMode,
    state.purpose,
    state.selectedStudyDays,
    state.weekdayHours,
    state.weekendHours,
    state.weeklyHours,
  ])

  if (!bookingInput || !capacityCheck) {
    return (
      <p className="onboarding-empty-preview">
        Add at least one material to see your plan preview.
      </p>
    )
  }

  const canGoPrevious = bounds ? viewMonth > bounds.startMonth : false
  const canGoNext = bounds ? viewMonth < bounds.endMonth : false
  const commitDisabled = committing || capacityCheck.status === 'over-capacity' || bookings.length === 0

  return (
    <div className="onboarding-step onboarding-preview onboarding-booking-preview">
      <h1 className="onboarding-h1 onboarding-preview-mobile-only">
        Here's a <em>plan</em>.
      </h1>
      <p className="onboarding-lead onboarding-preview-mobile-only">
        Booked until {formatShortDate(finishDate)} · {bookings.length} session{bookings.length !== 1 ? 's' : ''} · {formatMinutes(capacityCheck.totalMaterialMinutes)} total.
      </p>

      <section
        className="onboarding-verdict-card finish-toggle"
        role="button"
        tabIndex={0}
        aria-expanded={calendarOpen}
        aria-controls="onboarding-booking-calendar"
        onClick={toggleCalendar}
        onKeyDown={handleCalendarKeyDown}
      >
        <div className="onboarding-verdict-row">
          <div>
            <div className="stat-label">Projected finish</div>
            <div className={`stat-value md ${capacityCheck.status === 'over-capacity' ? 'rust' : 'moss'}`}>
              {formatShortDate(finishDate)}
            </div>
          </div>
          <span className="cal-affordance">
            Calendar
            <svg className="icon icon-sm cal-chev" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </div>
        <div className="mono-caps onboarding-estimate-line">
          <span className="provisional">estimate</span>
          {state.deadline ? ` · ${bufferDays} day${bufferDays !== 1 ? 's' : ''} before your ${formatShortDate(state.deadline)} deadline` : null}
        </div>
        <div className="finish-hint">Tap to see your booked study days and deadline.</div>
      </section>

      <section
        id="onboarding-booking-calendar"
        className={`onboarding-calendar-panel${calendarOpen ? ' open' : ''}`}
        aria-hidden={!calendarOpen}
      >
        <div className="cal-monthnav">
          <button
            type="button"
            className="cal-navbtn"
            aria-label="Previous month"
            disabled={!canGoPrevious}
            onClick={() => bounds && setViewMonth((month) => shiftMonth(month, -1, bounds))}
          >
            <svg className="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true"><polyline points="15 6 9 12 15 18"/></svg>
          </button>
          <span className="cal-monthlabel">{calendar.monthLabel}</span>
          <button
            type="button"
            className="cal-navbtn"
            aria-label="Next month"
            disabled={!canGoNext}
            onClick={() => bounds && setViewMonth((month) => shiftMonth(month, 1, bounds))}
          >
            <svg className="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>
          </button>
        </div>

        <div className="roadmap-calendar-shell onboarding-mini-calendar" aria-label={`${calendar.monthLabel} booked sessions`}>
          <div className="roadmap-weekdays" role="row">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className={`roadmap-weekday${state.selectedStudyDays.includes(label) ? ' roadmap-weekday-studyday' : ''}`}
                role="columnheader"
              >
                {label}
              </div>
            ))}
          </div>
          <div role="grid">
            {calendar.weeks.map((week) => (
              <div key={week[0].date} className="roadmap-week-row" role="row">
                {week.map((day) => {
                  const dayBookings = bookingsForDate.get(day.date) ?? []
                  const isDeadline = day.date === state.deadline && day.isInMonth
                  const studyDay = day.isInMonth && isStudyDay(day.date, state.selectedStudyDays)
                  return (
                    <div
                      key={day.date}
                      className={[
                        'roadmap-day',
                        day.isInMonth ? 'roadmap-day-in-month' : 'roadmap-day-outside',
                        day.date === startDate && 'roadmap-day-today',
                        studyDay && 'roadmap-day-studyday',
                        isDeadline && 'roadmap-day-deadline',
                      ].filter(Boolean).join(' ')}
                      role="gridcell"
                    >
                      <div className="roadmap-day-head">
                        <span className="roadmap-day-number">{day.dayOfMonth}</span>
                        <span className="roadmap-day-markers">
                          {day.date === startDate && <span className="roadmap-today-pill">Today</span>}
                          {isDeadline && <span className="roadmap-deadline-pill">Deadline</span>}
                        </span>
                      </div>
                      <div className="roadmap-bubble-stack">
                        {dayBookings.map((booking) => {
                          const bookedLabel = `Booked study session · ${formatMinutes(booking.estimatedDuration)} · ${format(parseISO(booking.date), 'EEE, MMM d')}`
                          return (
                            <div
                              key={booking.id}
                              className="roadmap-bubble roadmap-chip-booked"
                              data-status="booked"
                              title={bookedLabel}
                              aria-label={bookedLabel}
                            >
                              <svg className="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="8" />
                                <path d="M12 8v5l3 2" />
                              </svg>
                              <span className="roadmap-bubble-label">Session</span>
                              <span className="roadmap-bubble-minutes">{formatMinutes(booking.estimatedDuration)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="cal-legend">
          <span><span className="cal-swatch studyday" />study day</span>
          <span><span className="cal-swatch booked" />booked session</span>
          <span><span className="cal-swatch today" />today</span>
          <span><span className="cal-swatch deadline" />deadline</span>
        </div>
      </section>

      <section className="onboarding-verdict-card">
        <div className="onboarding-verdict-row">
          <span className="stat-label">{capacityHeadline(capacityCheck)}</span>
          <span className="t-body-sm">{capacityMeta(capacityCheck)}</span>
        </div>
        <div className="cap-bar" aria-hidden="true">
          <span style={{ width: `${capacityPercent}%` }} />
        </div>
        <div className="t-body-sm onboarding-muted">
          We book study sessions until your materials are done, then leave the rest as buffer.
        </div>
      </section>

      <div className="onboarding-preview-stats">
        <div className="stat"><div className="stat-value sm">{bookings.length}</div><div className="stat-label">sessions</div></div>
        <div className="stat"><div className="stat-value sm">{formatMinutes(capacityCheck.totalMaterialMinutes)}</div><div className="stat-label">total</div></div>
        <div className="stat"><div className="stat-value sm">{bufferDays} d</div><div className="stat-label">buffer</div></div>
      </div>

      <div className="mono-caps onboarding-directory-label">What you'll study</div>
      <div className="chip-row onboarding-directory-chips">
        {expandedMaterials
          .filter((material) => material.title && material.estimatedDuration > 0)
          .map((material) => (
            <span key={material.id} className="chip dir-chip">
              <span className={`material-icon tiny ${material.kind === 'youtube' ? 'yt' : material.kind === 'article' ? 'art' : 'bk'}`}>
                {materialIcon(material.kind)}
              </span>
              {material.title}
            </span>
          ))}
      </div>

      <div className="onboarding-actions onboarding-preview-actions">
        <button
          className="btn btn-secondary onboarding-back-btn onboarding-preview-back-btn"
          onClick={() => stepNavigate('/onboarding/3')}
          aria-label="Back"
        >
          <svg className="icon" viewBox="0 0 24 24"><polyline points="15 6 9 12 15 18"/></svg>
        </button>
        <button
          className="btn btn-primary btn-lg onboarding-continue-btn"
          disabled={commitDisabled}
          title={capacityCheck.status === 'over-capacity' ? 'Add more study time or remove material to continue.' : undefined}
          onClick={handleCommit}
        >
          {committing ? 'Saving...' : 'Looks good'}
          <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </div>
  )
}
