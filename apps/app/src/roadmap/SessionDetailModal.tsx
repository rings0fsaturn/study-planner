import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import type { BoundCalendarDay, CalendarBubble, CalendarBubbleStatus } from './calendarModel'
import { statusStyleFor } from './statusStyles'

interface SessionDetailModalProps {
  bubble: CalendarBubble | null
  onClose: () => void
  canEdit?: boolean
  onLogSession?: (bubble: CalendarBubble) => void
  onRename?: (bubble: CalendarBubble, title: string) => void
  onNudgeMinutes?: (bubble: CalendarBubble, deltaMinutes: number) => void
  onMoveNextDay?: (bubble: CalendarBubble) => void
  onMarkDone?: (bubble: CalendarBubble) => void
}

interface DayDetailModalProps {
  day: BoundCalendarDay | null
  onClose: () => void
  onSelectBubble: (bubble: CalendarBubble) => void
}

interface StatusCopy {
  pillLabel: string
  actionLabel: string
}

export function statusCopyFor(status: CalendarBubbleStatus): StatusCopy {
  switch (status) {
    case 'done':
      return { pillLabel: 'Completed', actionLabel: 'View session' }
    case 'booked':
      return { pillLabel: 'Booked', actionLabel: 'View booking' }
    case 'missed':
      return { pillLabel: 'Missed', actionLabel: 'View booking' }
    case 'unplanned':
      return { pillLabel: 'Unplanned', actionLabel: 'View session' }
  }
}

function formatDate(date: string): string {
  return format(parseISO(date), 'EEEE, MMM d')
}

function formatMinutes(minutes: number | undefined): string {
  const safeMinutes = Math.max(0, Math.round(minutes ?? 0))
  if (safeMinutes < 60) return `${safeMinutes}m`
  const hours = Math.floor(safeMinutes / 60)
  const rest = safeMinutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

function sessionBody(bubble: CalendarBubble): string {
  const planned = bubble.plannedMinutes
  const logged = bubble.loggedMinutes ?? (bubble.status === 'unplanned' ? bubble.minutes : 0)

  if (bubble.status === 'done') {
    return `${formatMinutes(logged)} logged against ${formatMinutes(planned)} planned.`
  }

  if (bubble.status === 'booked') {
    return `${formatMinutes(planned)} planned. Nothing has been logged yet.`
  }

  if (bubble.status === 'missed') {
    return `${formatMinutes(planned)} planned. No matching session was logged.`
  }

  return `${formatMinutes(logged)} logged outside the roadmap.`
}

function ModalFrame({
  ariaLabel,
  children,
  onClose,
}: {
  ariaLabel: string
  children: ReactNode
  onClose: () => void
}) {
  const frame = (
    <div
      className="modal-overlay center roadmap-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onClose}
    >
      <div
        className="modal-card roadmap-modal-card"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="roadmap-modal-close"
          aria-label="Close modal"
          onClick={onClose}
        >
          <svg className="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 7l10 10" />
            <path d="M17 7L7 17" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return frame

  return createPortal(frame, document.body)
}

export function SessionDetailModal({
  bubble,
  onClose,
  canEdit = false,
  onLogSession = () => undefined,
  onRename = () => undefined,
  onNudgeMinutes = () => undefined,
  onMoveNextDay = () => undefined,
  onMarkDone = () => undefined,
}: SessionDetailModalProps) {
  const [draftTitle, setDraftTitle] = useState('')

  useEffect(() => {
    setDraftTitle(bubble?.sessionTitle?.trim() || bubble?.label || '')
  }, [bubble])

  if (!bubble) return null

  const style = statusStyleFor(bubble.status)
  const copy = statusCopyFor(bubble.status)
  const trimmedTitle = draftTitle.trim()

  return (
    <ModalFrame ariaLabel="Roadmap session detail" onClose={onClose}>
      <div className="modal-eyebrow">{formatDate(bubble.date)}</div>
      <div className="modal-title">{bubble.label}</div>
      <div className="roadmap-modal-status-row">
        <span className={`roadmap-status-pill ${style.chipClass}`} data-status={bubble.status}>
          {copy.pillLabel}
        </span>
      </div>
      <div className="modal-body">
        <p>{sessionBody(bubble)}</p>
        {bubble.materialTitle && (
          <p className="roadmap-modal-material">
            Material:{' '}
            {bubble.materialUrl ? (
              <a href={bubble.materialUrl} target="_blank" rel="noreferrer">
                {bubble.materialTitle}
              </a>
            ) : (
              <span>{bubble.materialTitle}</span>
            )}
          </p>
        )}
      </div>
      {canEdit ? (
        <div className="roadmap-edit-panel" aria-label="Roadmap quick actions">
          <button
            className="btn btn-accent btn-block"
            type="button"
            onClick={() => onLogSession(bubble)}
          >
            Log session
          </button>

          <label className="roadmap-edit-field">
            <span className="modal-eyebrow">Session title</span>
            <input
              className="field-input"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              aria-label="Session title"
            />
          </label>
          <button
            className="btn btn-secondary btn-block"
            type="button"
            disabled={trimmedTitle.length === 0}
            onClick={() => onRename(bubble, trimmedTitle)}
          >
            Save title
          </button>

          <div className="roadmap-edit-row">
            <button className="btn btn-ghost" type="button" onClick={() => onNudgeMinutes(bubble, -15)}>
              -15 min
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => onNudgeMinutes(bubble, 15)}>
              +15 min
            </button>
          </div>

          <div className="roadmap-edit-row">
            <button className="btn btn-secondary" type="button" onClick={() => onMoveNextDay(bubble)}>
              Move to next day
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => onMarkDone(bubble)}>
              {bubble.status === 'done' ? 'Mark undone' : 'Mark done'}
            </button>
          </div>
        </div>
      ) : (
        <p className="roadmap-readonly-detail">{copy.actionLabel}</p>
      )}
    </ModalFrame>
  )
}

export function DayDetailModal({
  day,
  onClose,
  onSelectBubble,
}: DayDetailModalProps) {
  if (!day) return null

  return (
    <ModalFrame ariaLabel="Roadmap day sessions" onClose={onClose}>
      <div className="modal-eyebrow">{formatDate(day.date)}</div>
      <div className="modal-title">Sessions for this day</div>
      <div className="roadmap-day-list">
        {day.bubbles.map((bubble) => {
          const style = statusStyleFor(bubble.status)
          const copy = statusCopyFor(bubble.status)
          return (
            <button
              key={bubble.id}
              type="button"
              className="roadmap-day-list-row"
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
    </ModalFrame>
  )
}
