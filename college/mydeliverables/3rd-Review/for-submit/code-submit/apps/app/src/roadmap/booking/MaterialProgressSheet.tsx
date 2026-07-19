import { useEffect, useState } from 'react'
import type { MaterialLedgerEntry } from '@study-tracker/progress'

interface MaterialProgressSheetProps {
  material: MaterialLedgerEntry | null
  onClose: () => void
  onSave: (material: MaterialLedgerEntry, percent: number) => void
}

function percentFromMaterial(material: MaterialLedgerEntry): number {
  if (material.estimatedMinutes <= 0) return 0
  return Math.round((material.estimatedConsumedMinutes / material.estimatedMinutes) * 100)
}

export function MaterialProgressSheet({
  material,
  onClose,
  onSave,
}: MaterialProgressSheetProps) {
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    setPercent(material ? percentFromMaterial(material) : 0)
  }, [material])

  if (!material) return null

  return (
    <div className="bk-overlay show" role="dialog" aria-modal="true" aria-label="Mark material progress">
      <div className="bk-sheet">
        <div className="bk-grip" aria-hidden="true" />
        <div className="bk-head">
          <div className="bk-eyebrow">Material progress</div>
          <div className="bk-title">{material.title}</div>
        </div>

        <label className="bk-progress-field">
          <span className="lbl">Progress</span>
          <input
            aria-label="Material progress percent"
            type="range"
            min={0}
            max={100}
            step={5}
            value={percent}
            onChange={(event) => setPercent(Number(event.target.value))}
          />
          <span className="bk-progress-value">{percent}%</span>
        </label>

        <div className="bk-actions">
          <button
            className="btn btn-accent btn-block"
            type="button"
            onClick={() => onSave(material, percent)}
          >
            Save progress
          </button>
          <button className="btn btn-ghost btn-block" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
