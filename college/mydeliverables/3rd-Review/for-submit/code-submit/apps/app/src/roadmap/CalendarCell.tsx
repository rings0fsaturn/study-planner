import type { BoundCalendarDay, CalendarBubble } from './calendarModel'
import { useMatchMedia } from '../lib/useMatchMedia'
import { statusStyleFor, type StatusIconName } from './statusStyles'

interface CalendarCellProps {
  day: BoundCalendarDay
  isToday: boolean
  isDeadline: boolean
  isCurrentWeek: boolean
  onBubbleClick?: (bubble: CalendarBubble) => void
  onOverflowClick?: (day: BoundCalendarDay) => void
  onDayClick?: (day: BoundCalendarDay) => void
  onAddSessionClick?: (date: string) => void
  canAddSession?: boolean
  isStudyDay?: boolean
}

function StatusIcon({ name }: { name: StatusIconName }) {
  if (name === 'ti-check') {
    return (
      <svg className="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12l4 4L19 6" />
      </svg>
    )
  }

  if (name === 'ti-clock') {
    return (
      <svg className="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </svg>
    )
  }

  if (name === 'ti-x') {
    return (
      <svg className="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7l10 10" />
        <path d="M17 7L7 17" />
      </svg>
    )
  }

  return (
    <svg className="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes))
  if (safeMinutes < 60) return `${safeMinutes}m`
  const hours = Math.floor(safeMinutes / 60)
  const rest = safeMinutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export function CalendarCell({
  day,
  isToday,
  isDeadline,
  isCurrentWeek,
  onBubbleClick = () => undefined,
  onOverflowClick = () => undefined,
  onDayClick = () => undefined,
  onAddSessionClick = () => undefined,
  canAddSession = false,
  isStudyDay = false,
}: CalendarCellProps) {
  const isCompact = useMatchMedia('(max-width: 560px)')
  const visibleBubbles = day.bubbles.slice(0, 3)
  const hiddenCount = Math.max(0, day.bubbles.length - visibleBubbles.length)
  const dotBubbles = day.bubbles.slice(0, 4)
  const canOpenDay = isCompact && day.isInMonth
  const showAddSession = canAddSession && day.isInMonth && day.bubbles.length === 0
  const classes = [
    'roadmap-day',
    day.isInMonth ? 'roadmap-day-in-month' : 'roadmap-day-outside',
    isCurrentWeek && 'roadmap-day-current-week',
    isToday && 'roadmap-day-today',
    isStudyDay && 'roadmap-day-studyday',
    isDeadline && 'roadmap-day-deadline',
    isCompact && 'roadmap-day-compact',
    canOpenDay && 'roadmap-day-tappable',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      role="gridcell"
      data-date={day.date}
      data-testid={isToday ? 'roadmap-today-cell' : undefined}
    >
      <div className="roadmap-day-head">
        <span className="roadmap-day-number">{day.dayOfMonth}</span>
        <span className="roadmap-day-markers">
          {isToday && <span className="roadmap-today-pill">Today</span>}
          {isDeadline && (
            <span className="roadmap-deadline-pill" data-testid="roadmap-deadline-marker">
              Deadline
            </span>
          )}
        </span>
      </div>

      {isCompact ? (
        <button
          type="button"
          className="roadmap-mobile-day-button"
          disabled={!canOpenDay}
          onClick={() => onDayClick(day)}
          aria-label={day.bubbles.length > 0 ? `Open ${day.date} sessions` : `Open ${day.date} day options`}
        >
          <span className="roadmap-mobile-dot-stack" aria-hidden="true">
            {dotBubbles.map((bubble) => {
              const style = statusStyleFor(bubble.status)
              return (
                <span
                  key={bubble.id}
                  className={`roadmap-status-dot ${style.chipClass}`}
                  data-status={bubble.status}
                  data-icon={style.icon}
                />
              )
            })}
          </span>
          {day.bubbles.length > 1 && (
            <span className="roadmap-mobile-count" aria-hidden="true">
              {day.bubbles.length}
            </span>
          )}
        </button>
      ) : (
        <div className="roadmap-bubble-stack">
          {visibleBubbles.map((bubble) => {
            const style = statusStyleFor(bubble.status)
            const isBlankBooking = bubble.status === 'booked' && bubble.materialId === undefined
            return (
              <button
                key={bubble.id}
                type="button"
                className={`roadmap-bubble ${style.chipClass}${isBlankBooking ? ' roadmap-booking-blank' : ''}`}
                data-status={bubble.status}
                data-icon={style.icon}
                disabled={!day.isInMonth}
                onClick={() => onBubbleClick(bubble)}
                aria-label={`${style.label}: ${bubble.label}, ${formatMinutes(bubble.minutes)}`}
              >
                <StatusIcon name={style.icon} />
                <span className="roadmap-bubble-label">{bubble.label}</span>
                <span className="roadmap-bubble-minutes">{formatMinutes(bubble.minutes)}</span>
              </button>
            )
          })}

          {hiddenCount > 0 && (
            <button
              type="button"
              className="roadmap-overflow"
              disabled={!day.isInMonth}
              onClick={() => onOverflowClick(day)}
            >
              +{hiddenCount} more
            </button>
          )}
          {showAddSession && (
            <button
              type="button"
              className="roadmap-add-session"
              onClick={() => onAddSessionClick(day.date)}
            >
              + add session
            </button>
          )}
        </div>
      )}

    </div>
  )
}
