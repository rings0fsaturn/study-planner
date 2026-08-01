import type { Event } from '../events/EventStore'
import type { RoadmapLifecycleEntry } from './roadmapLifecycle'
import { buildMaterialLedger, type MaterialProgressMark, type SessionEvent } from '@study-tracker/progress'

export interface RoadmapProgressSummary {
  sessionsCount: number
  loggedMinutes: number
  totalPlannedMinutes: number
  toGoMinutes: number
  completedSlots: number
  totalSlots: number
  percentComplete: number
}

function sessionDate(event: Event): string | null {
  const value = event.payload.date
  return typeof value === 'string' ? value : null
}

function sessionMaterialId(event: Event): string | null {
  const value = event.payload.materialId
  return typeof value === 'string' ? value : null
}

function sessionDuration(event: Event): number {
  const value = event.payload.duration
  return typeof value === 'number' ? value : 0
}

function sessionEvent(event: Event): SessionEvent {
  return {
    date: (event.payload.date as string | undefined) ?? '',
    source: ((event.payload.source as string | undefined) ?? 'manual') as 'active' | 'manual',
    plannedMinutes: event.payload.plannedMinutes as number | undefined,
    plannedSessionMinutes: event.payload.plannedSessionMinutes as number | undefined,
    activeMinutes: event.payload.activeMinutes as number | undefined,
    duration: sessionDuration(event),
    materialId: event.payload.materialId as string | undefined,
    materialRole: event.payload.role as SessionEvent['materialRole'],
    startedAt: event.payload.startedAt as string | undefined,
    sessionId: event.payload.sessionId as string | undefined,
    bookingId: event.payload.bookingId as string | undefined,
    resolution: event.payload.resolution as SessionEvent['resolution'],
    materialPosition: event.payload.materialPosition as SessionEvent['materialPosition'],
    materialConsumedMinutes: event.payload.materialConsumedMinutes as number | undefined,
  }
}

function materialLedgerForEntry(entry: RoadmapLifecycleEntry, events: Event[]) {
  const materialIds = entry.payload.materialIds ?? []
  if (materialIds.length === 0) return []
  const materialIdSet = new Set(materialIds)
  const materials = events
    .filter((event) => event.kind === 'MaterialAdded')
    .map((event) => event.payload)
    .filter((payload) =>
      typeof payload.materialId === 'string' &&
      materialIdSet.has(payload.materialId)
    )
    .map((payload) => ({
      id: payload.materialId as string,
      title: (payload.title as string | undefined) ?? payload.materialId as string,
      estimatedMinutes: effectiveEstimatedMinutesForEntry(
        entry,
        payload.materialId as string,
        (payload.estimatedDuration as number | undefined) ?? 0,
      ),
    }))
  const sessions = events
    .filter((event) => event.kind === 'SessionLogged')
    .map(sessionEvent)
  const marks: MaterialProgressMark[] = events
    .filter((event) =>
      event.kind === 'MaterialProgressMarked' &&
      event.payload.roadmapCreatedAt === entry.roadmapCreatedAt
    )
    .map((event) => ({
      materialId: event.payload.materialId as string,
      markedAt: event.payload.markedAt as string,
      materialPosition: event.payload.materialPosition as MaterialProgressMark['materialPosition'],
    }))

  return buildMaterialLedger(materials, sessions, marks)
}

function effectiveEstimatedMinutesForEntry(
  entry: RoadmapLifecycleEntry,
  materialId: string,
  estimatedMinutes: number,
): number {
  const override = entry.payload.materialDurationOverrides?.[materialId]
  if (typeof override !== 'number') return estimatedMinutes
  return Math.max(0, Math.min(estimatedMinutes, override))
}

interface BookingSummary {
  bookingId: string
  estimatedDuration: number
}

function bookingsForEntry(entry: RoadmapLifecycleEntry, events: Event[]): BookingSummary[] {
  const bookings = new Map<string, BookingSummary>()
  for (const event of events) {
    if (event.kind === 'SessionBooked' && event.payload.roadmapCreatedAt === entry.roadmapCreatedAt) {
      const bookingId = event.payload.bookingId as string
      bookings.set(bookingId, {
        bookingId,
        estimatedDuration: (event.payload.estimatedDuration as number) ?? 0,
      })
    }
    if (event.kind === 'BookingEdited' && event.payload.roadmapCreatedAt === entry.roadmapCreatedAt) {
      const bookingId = event.payload.bookingId as string
      const existing = bookings.get(bookingId)
      if (existing && typeof event.payload.estimatedDuration === 'number') {
        bookings.set(bookingId, {
          ...existing,
          estimatedDuration: event.payload.estimatedDuration,
        })
      }
    }
    if (event.kind === 'BookingCleared' && event.payload.roadmapCreatedAt === entry.roadmapCreatedAt) {
      bookings.delete(event.payload.bookingId as string)
    }
  }
  return [...bookings.values()]
}

export function summarizeRoadmapProgress(
  entry: RoadmapLifecycleEntry,
  events: Event[],
): RoadmapProgressSummary {
  const sessions = events.filter((event) => event.kind === 'SessionLogged')
  const usedSessionIndexes = new Set<number>()
  let completedSlots = 0
  let loggedMinutes = 0

  if (!entry.payload.slots) {
    const bookings = bookingsForEntry(entry, events)
    const ledger = materialLedgerForEntry(entry, events)
    const bookingIds = new Set(bookings.map((booking) => booking.bookingId))
    const completedBookingIds = new Set<string>()
    for (const session of sessions) {
      const bookingId = session.payload.bookingId
      if (typeof bookingId !== 'string' || !bookingIds.has(bookingId)) continue
      loggedMinutes += sessionDuration(session)
      if (session.payload.resolution !== 'interrupted') {
        completedBookingIds.add(bookingId)
      }
    }
    completedSlots = completedBookingIds.size
    const totalSlots = bookings.length
    const totalPlannedMinutes = ledger.length > 0
      ? ledger.reduce((total, material) => total + material.estimatedMinutes, 0)
      : bookings.reduce((total, booking) => total + booking.estimatedDuration, 0)
    const toGoMinutes = ledger.length > 0
      ? ledger.reduce((total, material) => total + material.remainingEstimatedMinutes, 0)
      : Math.max(0, totalPlannedMinutes - loggedMinutes)
    const percentComplete = totalSlots === 0
      ? 0
      : Math.round((completedSlots / totalSlots) * 100)

    return {
      sessionsCount: completedSlots,
      loggedMinutes,
      totalPlannedMinutes,
      toGoMinutes,
      completedSlots,
      totalSlots,
      percentComplete,
    }
  }

  const slots = entry.payload.slots
  for (const slot of slots) {
    const matchIndex = sessions.findIndex((session, index) => {
      const materialId = sessionMaterialId(session)
      return (
        !usedSessionIndexes.has(index) &&
        sessionDate(session) === slot.date &&
        materialId !== null &&
        slot.candidateMaterialIds.includes(materialId)
      )
    })

    if (matchIndex === -1) continue

    usedSessionIndexes.add(matchIndex)
    completedSlots += 1
    loggedMinutes += sessionDuration(sessions[matchIndex])
  }

  const totalSlots = slots.length
  const totalPlannedMinutes = slots.reduce(
    (total, slot) => total + slot.plannedMinutes,
    0,
  )
  const percentComplete = totalSlots === 0
    ? 0
    : Math.round((completedSlots / totalSlots) * 100)

  return {
    sessionsCount: completedSlots,
    loggedMinutes,
    totalPlannedMinutes,
    toGoMinutes: Math.max(0, totalPlannedMinutes - loggedMinutes),
    completedSlots,
    totalSlots,
    percentComplete,
  }
}
