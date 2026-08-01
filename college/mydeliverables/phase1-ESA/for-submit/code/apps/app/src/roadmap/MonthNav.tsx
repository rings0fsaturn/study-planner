import { format } from 'date-fns'
import type { MonthBounds } from './calendarModel'
import { clampMonth, monthKeyToDate, shiftMonth } from './calendarModel'

interface MonthNavProps {
  viewMonth: string
  bounds: MonthBounds
  todayMonth: string
  onChange: (monthKey: string, direction: 'prev' | 'next' | 'today') => void
}

function ArrowIcon({ direction }: { direction: 'prev' | 'next' }) {
  const path = direction === 'prev'
    ? 'M15 6l-6 6 6 6'
    : 'M9 6l6 6-6 6'

  return (
    <svg className="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

export function MonthNav({
  viewMonth,
  bounds,
  todayMonth,
  onChange,
}: MonthNavProps) {
  const previousMonth = shiftMonth(viewMonth, -1, bounds)
  const nextMonth = shiftMonth(viewMonth, 1, bounds)
  const clampedToday = clampMonth(monthKeyToDate(todayMonth), bounds)
  const canGoPrevious = viewMonth > bounds.startMonth
  const canGoNext = viewMonth < bounds.endMonth
  const canResetToday = viewMonth !== clampedToday
  const label = format(monthKeyToDate(viewMonth), 'MMMM yyyy')

  return (
    <div className="roadmap-month-nav" aria-label="Roadmap month navigation">
      <button
        type="button"
        className="roadmap-nav-icon"
        aria-label="Previous month"
        disabled={!canGoPrevious}
        onClick={() => onChange(previousMonth, 'prev')}
      >
        <ArrowIcon direction="prev" />
      </button>

      <div className="roadmap-month-label" data-testid="roadmap-month-label">
        {label}
      </div>

      <button
        type="button"
        className="roadmap-nav-icon"
        aria-label="Next month"
        disabled={!canGoNext}
        onClick={() => onChange(nextMonth, 'next')}
      >
        <ArrowIcon direction="next" />
      </button>

      <button
        type="button"
        className="btn btn-secondary roadmap-today-button"
        disabled={!canResetToday}
        onClick={() => onChange(clampedToday, 'today')}
      >
        Today
      </button>
    </div>
  )
}
