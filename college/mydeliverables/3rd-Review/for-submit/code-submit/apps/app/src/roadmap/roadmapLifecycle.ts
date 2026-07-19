import type { Event } from '../events/EventStore'
import type {
  RoadmapCreatedPayload,
  RoadmapMarkedAbandonedPayload,
  RoadmapMarkedCompletePayload,
  RoadmapReplannedPayload,
} from '../sync/types'

type RoadmapPayload = RoadmapCreatedPayload | RoadmapReplannedPayload

export type RoadmapLifecycleStatus = 'active' | 'completed' | 'abandoned'

export interface RoadmapLifecycleEntry {
  roadmapCreatedAt: string
  eventKind: 'RoadmapCreated' | 'RoadmapReplanned'
  status: RoadmapLifecycleStatus
  payload: RoadmapPayload
  title: string
  startDate: string
  deadline: string
  weeks: number
  totalSlots: number
  completedSlots: number
  percentComplete: number
  resolvedAt?: string
  reason?: string
}

export interface RoadmapLifecycleGroups {
  active: RoadmapLifecycleEntry[]
  completed: RoadmapLifecycleEntry[]
  abandoned: RoadmapLifecycleEntry[]
  all: RoadmapLifecycleEntry[]
}

interface TerminalEvent {
  kind: 'RoadmapMarkedComplete' | 'RoadmapMarkedAbandoned'
  createdAt: string
  payload: RoadmapMarkedCompletePayload | RoadmapMarkedAbandonedPayload
}

interface RoadmapSnapshot {
  roadmapCreatedAt: string
  latestEvent: Event
  payload: RoadmapPayload
}

function isRoadmapEvent(event: Event): boolean {
  return event.kind === 'RoadmapCreated' || event.kind === 'RoadmapReplanned'
}

function isTerminalEvent(event: Event): event is Event & TerminalEvent {
  return event.kind === 'RoadmapMarkedComplete' || event.kind === 'RoadmapMarkedAbandoned'
}

function eventTime(event: { createdAt: string }): number {
  return new Date(event.createdAt).getTime()
}

function terminalTime(event: TerminalEvent): number {
  return new Date(event.payload.resolvedAt || event.createdAt).getTime()
}

function latestTerminalFor(
  roadmapCreatedAt: string,
  terminals: TerminalEvent[],
): TerminalEvent | null {
  const roadmapTime = new Date(roadmapCreatedAt).getTime()

  return terminals
    .filter((event) =>
      event.payload.roadmapCreatedAt === roadmapCreatedAt &&
      eventTime(event) >= roadmapTime,
    )
    .sort((a, b) => terminalTime(b) - terminalTime(a))[0] ?? null
}

function roadmapIdentity(event: Event): string {
  if (event.kind !== 'RoadmapReplanned') return event.createdAt

  const originalCreatedAt = event.payload.roadmapCreatedAt
  return typeof originalCreatedAt === 'string' ? originalCreatedAt : event.createdAt
}

function bookingIdsForRoadmap(events: Event[], roadmapCreatedAt: string): Set<string> {
  const ids = new Set<string>()
  for (const event of events) {
    if (event.kind === 'SessionBooked' && event.payload.roadmapCreatedAt === roadmapCreatedAt) {
      ids.add(event.payload.bookingId as string)
    }
    if (event.kind === 'BookingCleared' && event.payload.roadmapCreatedAt === roadmapCreatedAt) {
      ids.delete(event.payload.bookingId as string)
    }
  }
  return ids
}

function completedBookingCount(events: Event[], bookingIds: Set<string>): number {
  const completed = new Set<string>()
  for (const event of events) {
    if (event.kind !== 'SessionLogged') continue
    const bookingId = event.payload.bookingId
    if (typeof bookingId !== 'string' || !bookingIds.has(bookingId)) continue
    if (event.payload.resolution === 'interrupted') continue
    completed.add(bookingId)
  }
  return completed.size
}

function completedSlotCount(events: Event[], roadmap: RoadmapPayload): number {
  const slots = roadmap.slots ?? []
  const usedSessionIndexes = new Set<number>()
  const inWindow = (date: string | undefined): boolean =>
    date !== undefined && date >= roadmap.startDate && date <= roadmap.deadline
  const sessions = events
    .filter((event) => event.kind === 'SessionLogged')
    .map((event, index) => ({
      index,
      date: event.payload.date as string | undefined,
      materialId: event.payload.materialId as string | undefined,
    }))
    // D-06: roadmap progress ignores gap sessions; global stats still consume them.
    .filter((session) => inWindow(session.date))

  let completed = 0
  for (const slot of slots) {
    const match = sessions.find((session) =>
      !usedSessionIndexes.has(session.index) &&
      session.date === slot.date &&
      session.materialId !== undefined &&
      slot.candidateMaterialIds.includes(session.materialId)
    )

    if (match) {
      usedSessionIndexes.add(match.index)
      completed += 1
    }
  }

  return completed
}

function entryTitle(payload: RoadmapCreatedPayload): string {
  return payload.purpose?.trim() || 'Roadmap'
}

export function deriveRoadmapLifecycle(events: Event[]): RoadmapLifecycleGroups {
  const roadmapEvents = events
    .filter(isRoadmapEvent)
    .sort((a, b) => eventTime(a) - eventTime(b))
  const terminals = events
    .filter(isTerminalEvent)
    .sort((a, b) => eventTime(a) - eventTime(b))
  const snapshotsByIdentity = new Map<string, RoadmapSnapshot>()
  for (const event of roadmapEvents) {
    const identity = roadmapIdentity(event)
    const existing = snapshotsByIdentity.get(identity)
    if (existing && eventTime(existing.latestEvent) > eventTime(event)) {
      continue
    }

    snapshotsByIdentity.set(identity, {
      roadmapCreatedAt: identity,
      latestEvent: event,
      payload: event.payload as unknown as RoadmapPayload,
    })
  }

  const snapshots = [...snapshotsByIdentity.values()]
  const activeIdentity = snapshots
    .filter((snapshot) => latestTerminalFor(snapshot.roadmapCreatedAt, terminals) === null)
    .sort((a, b) =>
      new Date(b.roadmapCreatedAt).getTime() - new Date(a.roadmapCreatedAt).getTime()
    )[0]?.roadmapCreatedAt ?? null

  const all = snapshots
    .map((snapshot) => {
      const payload = snapshot.payload
      const terminal = latestTerminalFor(snapshot.roadmapCreatedAt, terminals)
      const bookingIds = payload.slots
        ? null
        : bookingIdsForRoadmap(events, snapshot.roadmapCreatedAt)
      const totalSlots = payload.slots?.length ?? bookingIds?.size ?? 0
      const completedSlots = payload.slots
        ? completedSlotCount(events, payload)
        : completedBookingCount(events, bookingIds ?? new Set())
      const percentComplete = totalSlots === 0
        ? 0
        : Math.round((completedSlots / totalSlots) * 100)

      let status: RoadmapLifecycleStatus | null = null
      if (terminal?.kind === 'RoadmapMarkedComplete') {
        status = 'completed'
      } else if (terminal?.kind === 'RoadmapMarkedAbandoned') {
        status = 'abandoned'
      } else if (snapshot.roadmapCreatedAt === activeIdentity) {
        status = 'active'
      }

      if (status === null) return null

      const entry: RoadmapLifecycleEntry = {
        roadmapCreatedAt: snapshot.roadmapCreatedAt,
        eventKind: snapshot.latestEvent.kind as 'RoadmapCreated' | 'RoadmapReplanned',
        status,
        payload,
        title: entryTitle(payload),
        startDate: payload.startDate,
        deadline: payload.deadline,
        weeks: payload.weeks,
        totalSlots,
        completedSlots,
        percentComplete,
      }

      if (terminal?.payload.resolvedAt !== undefined) {
        entry.resolvedAt = terminal.payload.resolvedAt
      }
      if (terminal?.payload.reason !== undefined) {
        entry.reason = terminal.payload.reason
      }

      return entry
    })
    .filter((entry): entry is RoadmapLifecycleEntry => entry !== null)
    .sort((a, b) =>
      new Date(b.roadmapCreatedAt).getTime() - new Date(a.roadmapCreatedAt).getTime()
    )

  return {
    active: all.filter((entry) => entry.status === 'active'),
    completed: all.filter((entry) => entry.status === 'completed'),
    abandoned: all.filter((entry) => entry.status === 'abandoned'),
    all,
  }
}
