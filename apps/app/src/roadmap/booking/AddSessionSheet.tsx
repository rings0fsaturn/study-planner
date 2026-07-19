import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { MaterialPickerSheet } from './MaterialPickerSheet'
import { materialIcon, type BookingMaterialOption } from './types'

interface AddSessionSheetProps {
  date: string | null
  materials: BookingMaterialOption[]
  /** Remaining daily soft cap in minutes (D5); drives the "within today's Xh cap" hint. */
  capMinutes?: number
  onClose: () => void
  onCreate: (draft: { date: string; estimatedDuration: number; materialId?: string }) => void
}

function formatMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, Math.round(minutes))
  if (safeMinutes < 60) return `${safeMinutes}m`
  const hours = Math.floor(safeMinutes / 60)
  const rest = safeMinutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

function formatDay(date: string): string {
  try {
    return format(parseISO(date), 'EEE, MMM d')
  } catch {
    return date
  }
}

export function AddSessionSheet({
  date,
  materials,
  capMinutes,
  onClose,
  onCreate,
}: AddSessionSheetProps) {
  const [duration, setDuration] = useState(60)
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    setDuration(60)
    setMaterialId(null)
    setPickerOpen(false)
  }, [date])

  if (!date) return null

  const attached = materialId
    ? materials.find((material) => material.materialId === materialId)
    : undefined
  const capHint = capMinutes && capMinutes > 0 ? `within today's ${formatMinutes(capMinutes)} cap` : null

  return (
    <div className="bk-overlay show" role="dialog" aria-modal="true" aria-label="Add session">
      <div className="bk-sheet">
        <div className="bk-grip" aria-hidden="true" />
        <div className="bk-head">
          <div className="bk-eyebrow">New session</div>
          <div className="bk-title">{formatDay(date)}</div>
        </div>

        <div className="bk-rows">
          <div className="bk-row">
            <span className="lbl">
              Length
              {capHint ? <span className="hint">{capHint}</span> : null}
            </span>
            <span className="ctrl">
              <span className="stepper">
                <button type="button" aria-label="Decrease new session duration" onClick={() => setDuration((current) => Math.max(15, current - 15))}>
                  −
                </button>
                <span className="val">{formatMinutes(duration)}</span>
                <button type="button" aria-label="Increase new session duration" onClick={() => setDuration((current) => current + 15)}>
                  +
                </button>
              </span>
            </span>
          </div>
          <div className="bk-row">
            <span className="lbl">
              Material
              <span className="hint">optional — or pick at start</span>
            </span>
            <span className="ctrl">
              {attached ? (
                <button type="button" className="bk-link" onClick={() => setPickerOpen(true)}>
                  <span className={`material-icon ${materialIcon(attached).cls}`} aria-hidden="true">
                    {materialIcon(attached).label}
                  </span>
                  {attached.title}
                </button>
              ) : (
                <button type="button" className="bk-link" onClick={() => setPickerOpen(true)}>
                  Attach
                  <svg className="icon icon-sm" viewBox="0 0 24 24" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              )}
            </span>
          </div>
        </div>

        <div className="bk-actions">
          <button
            className="btn btn-accent btn-block"
            type="button"
            onClick={() => onCreate({
              date,
              estimatedDuration: duration,
              ...(materialId ? { materialId } : {}),
            })}
          >
            Add session
          </button>
          <button className="btn btn-ghost btn-block" type="button" onClick={onClose}>
            Cancel
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
