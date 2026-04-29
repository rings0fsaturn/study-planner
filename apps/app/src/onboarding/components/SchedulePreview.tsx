import type { RoadmapOutput } from '@study-tracker/progress-engine'
import { ROLE_TO_LABEL } from '@study-tracker/progress-engine'
import { InlineEditTitle } from './InlineEditTitle'
import { TieResolver } from './TieResolver'

interface SchedulePreviewProps {
  roadmap: RoadmapOutput
  materials: Array<{ id: string; title: string }>
  onResolveTie: (weekIndex: number, dayOfWeek: string, materialId: string | null) => void
  onRename: (weekIndex: number, dayOfWeek: string, newTitle: string) => void
}

function formatMinutes(m: number): string {
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}m`
}

export function SchedulePreview({ roadmap, materials, onResolveTie, onRename }: SchedulePreviewProps) {
  return (
    <div className="schedule-card">
      {roadmap.weeks.map(week => {
        const sessionCount = week.slots.filter(s => s.candidateMaterialIds.length >= 1).length
        const weekMins = week.slots.reduce((sum, s) => sum + (s.plannedMinutes || 0), 0)
        return (
          <div key={week.weekIndex} className="sched-week">
            <div className="sched-week-label">
              <span>Week {week.weekIndex + 1} · {week.startDate}</span>
              <span>{sessionCount} session{sessionCount !== 1 ? 's' : ''} · {formatMinutes(weekMins)}</span>
            </div>
            {week.slots.map(slot => {
              const key = `${slot.weekIndex}:${slot.dayOfWeek}`
              if (slot.candidateMaterialIds.length === 0) {
                return (
                  <div key={key} className="sched-row">
                    <span className="sched-day">{slot.dayOfWeek}</span>
                    <span className="sched-title" style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                      Rest day
                    </span>
                    <span className="sched-dur" />
                  </div>
                )
              }
              if (slot.candidateMaterialIds.length >= 2) {
                return (
                  <TieResolver key={key} slot={slot} materials={materials}
                    onResolve={materialId => onResolveTie(slot.weekIndex, slot.dayOfWeek, materialId)} />
                )
              }
              return (
                <div key={key} className="sched-row">
                  <span className="sched-day">{slot.dayOfWeek}</span>
                  <span className="sched-title">
                    {slot.role && (
                      <span className="tag tag-sm" style={{ marginRight: '6px' }}>
                        {ROLE_TO_LABEL[slot.role]}
                      </span>
                    )}
                    <InlineEditTitle
                      title={slot.sessionTitle ?? ''}
                      onCommit={newTitle => onRename(slot.weekIndex, slot.dayOfWeek, newTitle)}
                    />
                  </span>
                  <span className="sched-dur">{formatMinutes(slot.plannedMinutes)}</span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}