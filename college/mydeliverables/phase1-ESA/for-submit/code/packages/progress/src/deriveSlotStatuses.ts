import type { RoadmapInput, RoadmapSlot, SessionEvent } from './types'

export type SlotStatus = 'done' | 'pending' | 'skipped'

export interface DerivedSlot {
  slot: RoadmapSlot
  status: SlotStatus
  loggedMinutes: number
  sessionIds: string[]
}

export interface UnplannedSession {
  date: string
  materialId?: string
  minutes: number
  sessionId?: string
}

export interface SlotStatusDerivation {
  slots: DerivedSlot[]
  unplanned: UnplannedSession[]
}

function sessionMinutes(session: SessionEvent): number {
  return session.duration
}

function toUnplannedSession(session: SessionEvent): UnplannedSession {
  return {
    date: session.date,
    materialId: session.materialId,
    minutes: sessionMinutes(session),
    sessionId: session.sessionId,
  }
}

/** @deprecated Use deriveBookingStatuses for material/session-decoupled roadmaps. */
export function deriveSlotStatuses(
  roadmap: RoadmapInput,
  sessions: SessionEvent[],
  today: string,
): SlotStatusDerivation {
  const assignedBySlot = roadmap.slots.map((): SessionEvent[] => [])
  const usedSlotIndexes = new Set<number>()
  const unplanned: UnplannedSession[] = []

  for (const session of sessions) {
    const matchingSlotIndex = roadmap.slots.findIndex((slot, index) => {
      return (
        !usedSlotIndexes.has(index) &&
        session.materialId !== undefined &&
        session.date === slot.date &&
        slot.candidateMaterialIds.includes(session.materialId)
      )
    })

    if (matchingSlotIndex === -1) {
      unplanned.push(toUnplannedSession(session))
      continue
    }

    usedSlotIndexes.add(matchingSlotIndex)
    assignedBySlot[matchingSlotIndex].push(session)
  }

  return {
    slots: roadmap.slots.map((slot, index) => {
      const assignedSessions = assignedBySlot[index]
      const status: SlotStatus =
        assignedSessions.length > 0 ? 'done' : slot.date >= today ? 'pending' : 'skipped'

      return {
        slot,
        status,
        loggedMinutes: assignedSessions.reduce(
          (total, session) => total + sessionMinutes(session),
          0,
        ),
        sessionIds: assignedSessions
          .map((session) => session.sessionId)
          .filter((sessionId): sessionId is string => sessionId !== undefined),
      }
    }),
    unplanned,
  }
}
