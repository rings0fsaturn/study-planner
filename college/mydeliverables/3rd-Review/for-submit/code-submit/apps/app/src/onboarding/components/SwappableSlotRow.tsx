import { useEffect, useState, useRef, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useDraggable, useDroppable } from '@dnd-kit/react'
import type { SwapState, SlotKey } from './useSwapStateMachine'

interface SwappableSlotRowProps {
  slot: { weekIndex: number; dayOfWeek: string; plannedMinutes: number; capacityMinutes: number; candidateMaterialIds: string[] }
  slotKey: SlotKey
  swapState: SwapState
  onTapSlot: (key: SlotKey) => void
  isSwappable: boolean
  isDesktop: boolean
  children: ReactNode
}

function slotKeyEq(a: SlotKey | null, b: SlotKey): boolean {
  if (!a) return false
  return a.weekIndex === b.weekIndex && a.dayOfWeek === b.dayOfWeek
}

const WIGGLE = [0, -2, 2, -2, 0]
const SHAKE = [0, -4, 4, -4, 4, 0]
const MOSS_FLASH = 'rgba(74, 107, 58, 0.15)'
const TRANSPARENT = 'rgba(74, 107, 58, 0)'

function slotId(key: SlotKey): string {
  return `${key.weekIndex}:${key.dayOfWeek}`
}

export function SwappableSlotRow({
  slot,
  slotKey,
  swapState,
  onTapSlot,
  isSwappable,
  isDesktop,
  children,
}: SwappableSlotRowProps) {
  const reducedMotion = useReducedMotion()
  const inSwapMode = swapState.mode !== 'idle'
  const isSource = slotKeyEq(swapState.source, slotKey)
  const isDest = slotKeyEq(swapState.destination, slotKey)
  const isRejected = slotKeyEq(swapState.rejectedSlot, slotKey)
  const isPostSwap = swapState.mode === 'post-swap' && swapState.justSwapped && (
    slotKeyEq(swapState.justSwapped.source, slotKey) || slotKeyEq(swapState.justSwapped.dest, slotKey)
  )
  const isBothSelected = swapState.mode === 'both-selected' && (isSource || isDest)
  const hasCapacityWarning = slot.plannedMinutes > 0 && slot.capacityMinutes > 0 && slot.plannedMinutes > slot.capacityMinutes
  const isDragging = swapState.mode === 'dragging' && slotKeyEq(swapState.source, slotKey)

  const handleRef = useRef<Element | null>(null)

  const swapModeActive = inSwapMode && swapState.mode !== 'dragging'

  const { ref: draggableRef, isDragSource } = useDraggable({
    id: slotId(slotKey),
    disabled: !isDesktop || !isSwappable || swapModeActive,
    handle: handleRef,
  })

  const { ref: droppableRef, isDropTarget } = useDroppable({
    id: slotId(slotKey),
    disabled: !isDesktop || swapModeActive,
  })

  const [animateX, setAnimateX] = useState<number[]>([0])
  const [bgColor, setBgColor] = useState(TRANSPARENT)

  useEffect(() => {
    if (reducedMotion) return
    if (isBothSelected) {
      setAnimateX(WIGGLE)
      const t = setTimeout(() => setAnimateX([0]), 350)
      return () => clearTimeout(t)
    }
  }, [isBothSelected, reducedMotion])

  useEffect(() => {
    if (reducedMotion) return
    if (isRejected) {
      setAnimateX(SHAKE)
      const t = setTimeout(() => setAnimateX([0]), 350)
      return () => clearTimeout(t)
    }
  }, [isRejected, reducedMotion])

  useEffect(() => {
    if (isPostSwap) {
      setBgColor(MOSS_FLASH)
      if (!reducedMotion) {
        setAnimateX(WIGGLE)
        const tWiggle = setTimeout(() => setAnimateX([0]), 350)
        const tBg = setTimeout(() => setBgColor(TRANSPARENT), 1500)
        return () => { clearTimeout(tWiggle); clearTimeout(tBg) }
      }
      const t = setTimeout(() => setBgColor(TRANSPARENT), 1500)
      return () => clearTimeout(t)
    }
  }, [isPostSwap, reducedMotion])

  const classNames = ['sched-row']
  if (inSwapMode) classNames.push('swap-mode')
  if (isSource) classNames.push('swap-source')
  if (isDest) classNames.push('swap-dest')
  if (isRejected) classNames.push('swap-rejected')
  if (isDragSource || isDragging) classNames.push('swap-dragging')
  if (isPostSwap) classNames.push('swap-complete')
  if (isDropTarget) classNames.push('drop-hover')

  const handleClick = () => {
    if (!inSwapMode) return
    onTapSlot(slotKey)
  }

  const setRefs = (el: HTMLDivElement | null) => {
    draggableRef(el)
    droppableRef(el)
  }

  return (
    <motion.div
      ref={setRefs}
      className={classNames.join(' ')}
      onClick={handleClick}
      animate={{
        x: animateX,
        backgroundColor: bgColor,
      }}
      transition={{
        x: { duration: 0.3, ease: 'easeInOut' },
        backgroundColor: { duration: 1.5, ease: 'easeOut' },
      }}
      role={inSwapMode ? 'button' : undefined}
      tabIndex={inSwapMode && isSwappable ? 0 : undefined}
      aria-selected={isSource || isDest || undefined}
      aria-label={inSwapMode ? `${slot.dayOfWeek} session` : undefined}
      onKeyDown={inSwapMode ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onTapSlot(slotKey)
        }
      } : undefined}
      data-capacity-warning={hasCapacityWarning || undefined}
      data-drop-target={isDropTarget || undefined}
    >
      {isDesktop && isSwappable && (
        <svg
          ref={(el) => { handleRef.current = el }}
          className="sched-drag-handle"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="5" cy="3" r="1.2" />
          <circle cx="11" cy="3" r="1.2" />
          <circle cx="5" cy="8" r="1.2" />
          <circle cx="11" cy="8" r="1.2" />
          <circle cx="5" cy="13" r="1.2" />
          <circle cx="11" cy="13" r="1.2" />
        </svg>
      )}
      {children}
    </motion.div>
  )
}
