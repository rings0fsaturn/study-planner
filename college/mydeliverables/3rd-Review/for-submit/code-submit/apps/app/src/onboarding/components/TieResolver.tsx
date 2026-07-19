import type { Slot } from '@study-tracker/roadmap-engine'

interface TieResolverProps {
  slot: Slot
  materials: Array<{ id: string; title: string }>
  onResolve: (materialId: string | null) => void
}

export function TieResolver({ slot, materials, onResolve }: TieResolverProps) {
  return (
    <div className="sched-row" style={{ background: 'rgba(184, 92, 56, 0.06)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
      <span className="sched-day">{slot.dayOfWeek}</span>
      <div style={{ flex: 1 }}>
        <div className="mono-caps" style={{ marginBottom: '4px', color: 'var(--terracotta)' }}>Pick one</div>
        <div className="chip-row">
          {slot.candidateMaterialIds.map(id => {
            if (id === '__rest__') {
              return (
                <button key="__rest__" className="chip" onClick={() => onResolve(null)}>
                  Rest day
                </button>
              )
            }
            const mat = materials.find(m => m.id === id)
            return (
              <button key={id} className="chip" onClick={() => onResolve(id)}>
                Review {mat?.title ?? id}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}