import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { CalendarBubble } from '../calendarModel'
import { MaterialPickerSheet } from './MaterialPickerSheet'
import { materialIcon, type BookingEditDraft, type BookingMaterialOption } from './types'

export type { BookingEditDraft, BookingMaterialOption } from './types'

interface BookingEditorSheetProps {
  bubble: CalendarBubble | null
  materials: BookingMaterialOption[]
  onClose: () => void
  onSave: (bubble: CalendarBubble, draft: BookingEditDraft) => void
  onRemove: (bubble: CalendarBubble) => void
}

function formatMinutes(minutes: number): string {
  const safe = Math.max(5, Math.round(minutes))
  if (safe < 60) return `${safe}m`
  const hours = Math.floor(safe / 60)
  const rest = safe % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

function formatDay(date: string): string {
  if (!date) return 'Pick a day'
  try {
    return format(parseISO(date), 'EEE, MMM d')
  } catch {
    return date
  }
}

export function BookingEditorSheet({
  bubble,
  materials,
  onClose,
  onSave,
  onRemove,
}: BookingEditorSheetProps) {
  const [date, setDate] = useState('')
  const [duration, setDuration] = useState(60)
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const dateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDate(bubble?.date ?? '')
    setDuration(bubble?.plannedMinutes ?? bubble?.minutes ?? 60)
    setMaterialId(bubble?.materialId ?? null)
    setPickerOpen(false)
  }, [bubble])

  if (!bubble) return null

  const nudgeDuration = (delta: number) => {
    setDuration((current) => Math.max(15, current + delta))
  }

  const attached = materialId
    ? materials.find((material) => material.materialId === materialId)
    : undefined
  const icon = attached ? materialIcon(attached) : { cls: '', label: '—' }

  const openDayPicker = () => {
    const input = dateInputRef.current
    if (!input) return
    // Native date picker where supported; focus is the graceful fallback.
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker()
        return
      } catch {
        /* fall through to focus */
      }
    }
    input.focus()
    input.click()
  }

  return (
    <div
      className="bk-overlay show"
      role="dialog"
      aria-modal="true"
      aria-label="Edit booking"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="bk-sheet">
        <div className="bk-grip" aria-hidden="true" />
        <div className="bk-head">
          <div className="bk-eyebrow">Booked session</div>
          <div className="bk-title">{formatDay(date)}</div>
        </div>

        <button type="button" className="bk-matcard" aria-label="Change material" onClick={() => setPickerOpen(true)}>
          <div className={`material-icon ${icon.cls}`.trim()} aria-hidden="true">{icon.label}</div>
          <div className="body">
            <div className="ttl">{attached ? attached.title : 'No material — pick at start'}</div>
            <div className="sub">{attached ? 'Attached · tap to change' : 'Tap to attach a material'}</div>
          </div>
          <svg className="icon icon-sm chg" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </button>

        <div className="bk-rows">
          <div className="bk-row">
            <span className="lbl">Length</span>
            <span className="ctrl">
              <span className="stepper">
                <button type="button" aria-label="Decrease booking duration" onClick={() => nudgeDuration(-15)}>
                  −
                </button>
                <span className="val">{formatMinutes(duration)}</span>
                <button type="button" aria-label="Increase booking duration" onClick={() => nudgeDuration(15)}>
                  +
                </button>
              </span>
            </span>
          </div>
          <div className="bk-row">
            <span className="lbl">Day</span>
            <span className="ctrl">
              <button type="button" className="bk-link" onClick={openDayPicker}>
                {formatDay(date)}
                <svg className="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <input
                ref={dateInputRef}
                className="bk-date-hidden"
                type="date"
                aria-label="Booking date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </span>
          </div>
        </div>

        <div className="bk-actions">
          <button
            className="btn btn-accent btn-block"
            type="button"
            onClick={() => onSave(bubble, {
              date,
              estimatedDuration: duration,
              materialId,
            })}
          >
            Done
          </button>
          <button className="bk-remove" type="button" onClick={() => onRemove(bubble)}>
            Remove booking
          </button>
        </div>
      </div>

      <MaterialPickerSheet
        open={pickerOpen}
        materials={materials}
        selectedMaterialId={materialId}
        onCancel={() => setPickerOpen(false)}
        onSelect={(nextMaterialId) => {
          setMaterialId(nextMaterialId)
          setPickerOpen(false)
        }}
      />
    </div>
  )
}
