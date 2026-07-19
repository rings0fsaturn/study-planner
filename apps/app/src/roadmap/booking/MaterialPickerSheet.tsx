import { useEffect, useState } from 'react'
import { materialIcon, materialStatusLine, type BookingMaterialOption } from './types'

interface MaterialPickerSheetProps {
  /** When null the picker is closed. */
  open: boolean
  materials: BookingMaterialOption[]
  /** Currently attached material id, or null for "pick at start". */
  selectedMaterialId: string | null
  onCancel: () => void
  /** null = detach ("No material · pick at start"). */
  onSelect: (materialId: string | null) => void
}

/**
 * Radio-list material picker (D21 / roadmap.html #bkPick). Reused by the booking
 * editor and add-session sheets for attach / swap / detach. First row is always
 * "No material · pick at start"; each material row shows an icon + title + status
 * subline. Mirrors the `.chooser` pattern used in PreSessionSetup.
 */
export function MaterialPickerSheet({
  open,
  materials,
  selectedMaterialId,
  onCancel,
  onSelect,
}: MaterialPickerSheetProps) {
  const [choice, setChoice] = useState<string | null>(selectedMaterialId)

  useEffect(() => {
    setChoice(selectedMaterialId)
  }, [selectedMaterialId, open])

  if (!open) return null

  return (
    <div
      className="bk-overlay show"
      role="dialog"
      aria-modal="true"
      aria-label="Choose material"
      onClick={onCancel}
    >
      <div className="bk-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="bk-grip" aria-hidden="true" />
        <div className="bk-head">
          <div className="bk-eyebrow">Choose material</div>
          <div className="bk-title">Attach to this session</div>
        </div>

        <div className="chooser">
          <button
            type="button"
            className={`chooser-row${choice === null ? ' sel' : ''}`}
            aria-pressed={choice === null}
            onClick={() => setChoice(null)}
          >
            <span className="chooser-radio" aria-hidden="true" />
            <span className="material-icon chooser-icon" aria-hidden="true">—</span>
            <span className="body">
              <span className="ttl">No material · pick at start</span>
            </span>
          </button>

          {materials.map((material) => {
            const icon = materialIcon(material)
            const selected = choice === material.materialId
            return (
              <button
                key={material.materialId}
                type="button"
                className={`chooser-row${selected ? ' sel' : ''}`}
                aria-pressed={selected}
                onClick={() => setChoice(material.materialId)}
              >
                <span className="chooser-radio" aria-hidden="true" />
                <span className={`material-icon ${icon.cls} chooser-icon`} aria-hidden="true">
                  {icon.label}
                </span>
                <span className="body">
                  <span className="ttl">{material.title}</span>
                  <span className="sub">{materialStatusLine(material)}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="bk-actions">
          <button
            className="btn btn-accent btn-block"
            type="button"
            onClick={() => onSelect(choice)}
          >
            Use this material
          </button>
          <button className="btn btn-ghost btn-block" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
