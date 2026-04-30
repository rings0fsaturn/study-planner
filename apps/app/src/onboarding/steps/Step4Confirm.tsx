import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEventStore } from '../../events/useEventStore'
import { CheckpointGate } from '../CheckpointGate'
import type { RoadmapCreatedPayload, MaterialAddedPayload } from '../../sync/types'

function formatMinutes(m: number): string {
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}m`
}

export function Step4Confirm() {
  const navigate = useNavigate()
  const eventStore = useEventStore()

  const events = useLiveQuery(() => eventStore.getAll(), [eventStore])

  const summary = (() => {
    if (!events) return null
    const roadmapEvents = events.filter(e => e.kind === 'RoadmapCreated')
    if (roadmapEvents.length === 0) return null
    const roadmap = roadmapEvents[roadmapEvents.length - 1].payload as unknown as RoadmapCreatedPayload

    const today = new Date().toISOString().split('T')[0]
    const firstSlot = roadmap.slots
      .filter(s => s.date >= today && s.candidateMaterialIds.length >= 1)
      .sort((a, b) => a.date.localeCompare(b.date))[0]

    if (!firstSlot) return { roadmap, firstMaterial: null, firstSlot: null }

    const materialEvents = events.filter(e => e.kind === 'MaterialAdded')
    const firstMaterialId = firstSlot.candidateMaterialIds[0]
    const firstMaterial = materialEvents
      .map(e => e.payload as unknown as MaterialAddedPayload)
      .find(m => m.materialId === firstMaterialId)

    return { roadmap, firstMaterial, firstSlot }
  })()

  if (!summary) {
    return (
      <CheckpointGate step={4}>
        <div className="onboarding-step">
          <div style={{ textAlign: 'center' }}>
            <div className="onboarding-success-check">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h1 className="onboarding-h1">All set.</h1>
          </div>
          <div className="onboarding-spacer" />
          <div className="onboarding-actions">
            <button className="btn btn-primary btn-lg onboarding-continue-btn" onClick={() => navigate('/home')}>
              Go to home
              <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        </div>
      </CheckpointGate>
    )
  }

  const { roadmap, firstMaterial, firstSlot } = summary

  return (
    <CheckpointGate step={4}>
      <div className="onboarding-step">
        <div style={{ textAlign: 'center' }}>
          <div className="onboarding-success-check">
            <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 className="onboarding-h1">All set.</h1>
          <p className="onboarding-lead">
            Done by {roadmap.deadline} · {roadmap.weeks} week{roadmap.weeks !== 1 ? 's' : ''} · {roadmap.weeklyHours}h/week.
          </p>
        </div>

        {firstMaterial && firstSlot && (
          <div style={{ marginBottom: 32 }}>
            <div className="mono-caps" style={{ marginBottom: 12 }}>FIRST UP · TODAY</div>
            <div className="material-row inverted">
              <div className="material-icon bk">BK</div>
              <div className="material-body">
                <div className="material-title">{firstMaterial.title}</div>
                <div className="material-meta">
                  ~{formatMinutes(firstSlot.plannedMinutes)} · {firstMaterial.estimatedDuration / 60}h cap
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="onboarding-spacer" />

        <div className="onboarding-actions">
          <button className="btn btn-primary btn-lg onboarding-continue-btn" onClick={() => navigate('/home')}>
            Go to home
            <svg className="icon" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>
      </div>
    </CheckpointGate>
  )
}
