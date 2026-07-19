import { useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import type { BoundCalendarDay, CalendarBubble } from './calendarModel'
import { statusCopyFor } from './SessionDetailModal'
import { statusStyleFor } from './statusStyles'

interface DaySheetProps {
  day: BoundCalendarDay | null
  onClose: () => void
  onSelectBubble: (bubble: CalendarBubble) => void
  onAddSession?: (date: string) => void
  canAddSession?: boolean
}

function formatDate(date: string): string {
  return format(parseISO(date), 'EEEE, MMM d')
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes))
  if (safeMinutes < 60) return `${safeMinutes}m`
  const hours = Math.floor(safeMinutes / 60)
  const rest = safeMinutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export function DaySheet({
  day,
  onClose,
  onSelectBubble,
  onAddSession,
  canAddSession = false,
}: DaySheetProps) {
  const sheetRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (day) sheetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [day])

  if (!day) return null

  return (
    <section
      ref={sheetRef}
      className="roadmap-day-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Roadmap day sheet"
    >
      <div className="roadmap-day-sheet-handle" aria-hidden="true" />
      <div className="roadmap-day-sheet-head">
        <div>
          <div className="modal-eyebrow">{formatDate(day.date)}</div>
          <h2 className="roadmap-day-sheet-title">Sessions for this day</h2>
        </div>
        <button
          type="button"
          className="roadmap-modal-close"
          aria-label="Close day sheet"
          onClick={onClose}
        >
          <svg className="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 7l10 10" />
            <path d="M17 7L7 17" />
          </svg>
        </button>
      </div>

      <div className="roadmap-day-sheet-list">
        {day.bubbles.map((bubble) => {
          const style = statusStyleFor(bubble.status)
          const copy = statusCopyFor(bubble.status)
          return (
            <button
              key={bubble.id}
              type="button"
              className="roadmap-day-sheet-row"
              onClick={() => onSelectBubble(bubble)}
            >
              <span className={`roadmap-day-list-status ${style.chipClass}`} data-status={bubble.status}>
                {copy.pillLabel}
              </span>
              <span className="roadmap-day-list-title">{bubble.label}</span>
              <span className="roadmap-day-list-minutes">{formatMinutes(bubble.minutes)}</span>
            </button>
          )
        })}
      </div>
      {day.bubbles.length === 0 && (
        <p className="roadmap-day-sheet-empty">No sessions booked for this day.</p>
      )}
      {canAddSession && onAddSession && (
        <button
          type="button"
          className="btn btn-accent btn-block roadmap-day-sheet-add"
          onClick={() => onAddSession(day.date)}
        >
          + Add session
        </button>
      )}
    </section>
  )
}
