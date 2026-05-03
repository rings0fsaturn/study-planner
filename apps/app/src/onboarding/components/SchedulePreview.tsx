import { useCallback } from 'react'
import type { RoadmapOutput } from '@study-tracker/progress-engine'
import { ROLE_TO_LABEL } from '@study-tracker/progress-engine'
import { InlineEditTitle } from './InlineEditTitle'
import { SwappableSlotRow } from './SwappableSlotRow'
import { SwapGuidanceBanner } from './SwapGuidanceBanner'
import { SwapDndContext } from './SwapDndContext'
import type { SwapState, SlotKey } from './useSwapStateMachine'
import './swap.css'

interface SchedulePreviewProps {
  roadmap: RoadmapOutput
  materials: Array<{ id: string; title: string }>
  onResolveTie: (weekIndex: number, dayOfWeek: string, materialId: string | null) => void
  onRename: (weekIndex: number, dayOfWeek: string, newTitle: string) => void
  swapState?: SwapState
  onTapSlot?: (key: SlotKey) => void
  onStartDrag?: (key: SlotKey) => void
  onDrop?: (target: SlotKey) => void
  onCancelDrag?: () => void
  isDesktop?: boolean
}

export function formatMinutes(m: number): string {
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${m}m`
}

export function SchedulePreview({ roadmap, materials, onResolveTie, onRename, swapState, onTapSlot, onStartDrag, onDrop, onCancelDrag, isDesktop = false }: SchedulePreviewProps) {
  const defaultSwapState: SwapState = { mode: 'idle', source: null, destination: null, justSwapped: null, rejectedSlot: null, origin: null }
  const activeSwapState = swapState ?? defaultSwapState
  const handleTap = onTapSlot ?? (() => {})
  const handleStartDrag = onStartDrag ?? (() => {})
  const handleDrop = onDrop ?? (() => {})
  const handleCancelDrag = onCancelDrag ?? (() => {})

  const slotLookup = useCallback((id: string) => {
    const allSlots = roadmap.weeks.flatMap(w => w.slots)
    const parts = id.split(':')
    if (parts.length !== 2) return undefined
    const weekIndex = parseInt(parts[0], 10)
    const dayOfWeek = parts[1]
    const slot = allSlots.find(s => s.weekIndex === weekIndex && s.dayOfWeek === dayOfWeek)
    if (!slot) return undefined
    return {
      dayOfWeek: slot.dayOfWeek,
      sessionTitle: slot.sessionTitle,
      plannedMinutes: slot.plannedMinutes,
      candidateMaterialIds: slot.candidateMaterialIds,
    }
  }, [roadmap])

  return (
    <SwapDndContext
      isDesktop={isDesktop}
      onStartDrag={handleStartDrag}
      onDrop={handleDrop}
      onCancelDrag={handleCancelDrag}
      slotLookup={slotLookup}
    >
    <div className="schedule-card">
      {swapState && <SwapGuidanceBanner swapState={activeSwapState} />}
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
              const slotKey: SlotKey = { weekIndex: slot.weekIndex, dayOfWeek: slot.dayOfWeek }
              const isTie = slot.candidateMaterialIds.length >= 2
              const isRest = slot.candidateMaterialIds.length === 0
              const hasCapacityWarning = slot.plannedMinutes > 0 && slot.capacityMinutes > 0 && slot.plannedMinutes > slot.capacityMinutes

              if (isTie) {
                return (
                  <SwappableSlotRow
                    key={key}
                    slot={slot}
                    slotKey={slotKey}
                    swapState={activeSwapState}
                    onTapSlot={handleTap}
                    isSwappable={false}
                    isDesktop={isDesktop}
                  >
                    <span className="sched-day">{slot.dayOfWeek}</span>
                    <div style={{ flex: 1 }}>
                      <div className="mono-caps" style={{ marginBottom: '4px', color: 'var(--terracotta)' }}>Pick one</div>
                      <div className="chip-row">
                        {slot.candidateMaterialIds.map(id => {
                          if (id === '__rest__') {
                            return (
                              <button key="__rest__" className="chip" onClick={(e) => { e.stopPropagation(); onResolveTie(slot.weekIndex, slot.dayOfWeek, null) }}>
                                Rest day
                              </button>
                            )
                          }
                          const mat = materials.find(m => m.id === id)
                          return (
                            <button key={id} className="chip" onClick={(e) => { e.stopPropagation(); onResolveTie(slot.weekIndex, slot.dayOfWeek, id) }}>
                              Review {mat?.title ?? id}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </SwappableSlotRow>
                )
              }

              if (isRest) {
                return (
                  <SwappableSlotRow
                    key={key}
                    slot={slot}
                    slotKey={slotKey}
                    swapState={activeSwapState}
                    onTapSlot={handleTap}
                    isSwappable={true}
                    isDesktop={isDesktop}
                  >
                    <span className="sched-day">{slot.dayOfWeek}</span>
                    <span className="sched-title" style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                      Rest day
                    </span>
                    <span className="sched-dur" />
                  </SwappableSlotRow>
                )
              }

              return (
                <SwappableSlotRow
                  key={key}
                  slot={slot}
                  slotKey={slotKey}
                  swapState={activeSwapState}
                  onTapSlot={handleTap}
                  isSwappable={true}
                  isDesktop={isDesktop}
                >
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
                  <span className={`sched-dur${hasCapacityWarning ? ' capacity-warning' : ''}`}>
                    {formatMinutes(slot.plannedMinutes)}
                  </span>
                </SwappableSlotRow>
              )
            })}
          </div>
        )
      })}
    </div>
    </SwapDndContext>
  )
}
