import { type ReactNode, useCallback } from 'react'
import { DragDropProvider, DragOverlay, type DragEndEvent, type DragStartEvent, PointerSensor } from '@dnd-kit/react'
import type { SlotKey } from './useSwapStateMachine'
import { formatMinutes } from './SchedulePreview'

interface SlotInfo {
  dayOfWeek: string
  sessionTitle: string | null
  plannedMinutes: number
  candidateMaterialIds: string[]
}

interface SwapDndContextProps {
  isDesktop: boolean
  onStartDrag: (key: SlotKey) => void
  onDrop: (target: SlotKey) => void
  onCancelDrag: () => void
  slotLookup: (key: string) => SlotInfo | undefined
  children: ReactNode
}

function parseSlotKey(id: string): SlotKey | null {
  const parts = id.split(':')
  if (parts.length !== 2) return null
  const weekIndex = parseInt(parts[0], 10)
  if (isNaN(weekIndex)) return null
  return { weekIndex, dayOfWeek: parts[1] }
}

export function SwapDndContext({ isDesktop, onStartDrag, onDrop, onCancelDrag, slotLookup, children }: SwapDndContextProps) {
  if (!isDesktop) return <>{children}</>

  return (
    <SwapDndContextInner
      onStartDrag={onStartDrag}
      onDrop={onDrop}
      onCancelDrag={onCancelDrag}
      slotLookup={slotLookup}
    >
      {children}
    </SwapDndContextInner>
  )
}

function SwapDndContextInner({
  onStartDrag,
  onDrop,
  onCancelDrag,
  slotLookup,
  children,
}: Omit<SwapDndContextProps, 'isDesktop'>) {
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.operation.source?.id
    if (!id) return
    const key = parseSlotKey(String(id))
    if (key) onStartDrag(key)
  }, [onStartDrag])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const targetId = event.operation.target?.id
    if (!targetId) {
      onCancelDrag()
      return
    }
    const key = parseSlotKey(String(targetId))
    if (key) {
      onDrop(key)
    } else {
      onCancelDrag()
    }
  }, [onDrop, onCancelDrag])

  return (
    <DragDropProvider
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      sensors={[PointerSensor]}
    >
      {children}
      <DragOverlay className="swap-drag-overlay" dropAnimation={null}>
        {(source) => {
          if (!source) return null
          const info = slotLookup(String(source.id))
          if (!info) return null
          return (
            <>
              <span className="sched-day">{info.dayOfWeek}</span>
              <span className="sched-title">
                {info.candidateMaterialIds.length === 0
                  ? 'Rest day'
                  : info.sessionTitle ?? 'Session'}
              </span>
              {info.plannedMinutes > 0 && (
                <span className="sched-dur">{formatMinutes(info.plannedMinutes)}</span>
              )}
            </>
          )
        }}
      </DragOverlay>
    </DragDropProvider>
  )
}
