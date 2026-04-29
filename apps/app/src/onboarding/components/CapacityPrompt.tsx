import { useNavigate } from 'react-router-dom'
import type { CapacityCheck, Warning } from '@study-tracker/progress-engine'

interface CapacityPromptProps {
  capacityCheck: CapacityCheck
  warnings: Warning[]
  onCompress: () => void
  onKeepBuffer: () => void
}

export function OverCapacityModal({ capacityCheck, warnings: _warnings, onCompress: _onCompress, onKeepBuffer: _onKeepBuffer }: CapacityPromptProps) {
  const navigate = useNavigate()

  if (capacityCheck.status !== 'over-capacity') return null
  const overflowMins = capacityCheck.totalMaterialMinutes - capacityCheck.totalCapacityMinutes
  if (overflowMins <= 0) return null

  return (
    <div className="modal-overlay center">
      <div className="modal-card">
        <div className="modal-eyebrow">Plan doesn't fit</div>
        <div className="modal-title">Your materials need more time</div>
        <div className="modal-body">
          Your materials total <strong>{Math.round(capacityCheck.totalMaterialMinutes / 60)}h {capacityCheck.totalMaterialMinutes % 60}m</strong>,
          but your plan only has capacity for <strong>{Math.round(capacityCheck.totalCapacityMinutes / 60)}h {capacityCheck.totalCapacityMinutes % 60}m</strong>
          across {Math.round(overflowMins / 60)}h {overflowMins % 60}m over.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="btn btn-secondary btn-block" onClick={() => navigate('/onboarding/1')}>
            Adjust deadline
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => navigate('/onboarding/2')}>
            Adjust hours
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => navigate('/onboarding/3')}>
            Adjust scope
          </button>
        </div>
      </div>
    </div>
  )
}

export function UnderCapacityBanner({ capacityCheck, onCompress, onKeepBuffer }: CapacityPromptProps) {
  if (capacityCheck.status !== 'under-capacity-buffer') return null
  const bufferMins = capacityCheck.totalCapacityMinutes - capacityCheck.totalMaterialMinutes
  const suggestedWeeks = capacityCheck.suggestedWeeks

  return (
    <div className="banner attention" style={{ marginBottom: '16px' }}>
      <div className="banner-body">
        <div className="banner-title">
          You have {Math.round(bufferMins / 60)}h of buffer in this plan.
        </div>
        <div className="banner-desc">
          Want to compress the timeline to finish earlier?
          {suggestedWeeks ? ` You could finish in ${suggestedWeeks} weeks.` : ''}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button className="chip" onClick={onCompress}>Compress to {suggestedWeeks} weeks</button>
          <button className="chip" onClick={onKeepBuffer}>Keep buffer</button>
        </div>
      </div>
    </div>
  )
}