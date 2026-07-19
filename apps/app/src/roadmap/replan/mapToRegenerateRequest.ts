import { deriveSlotStatuses, type RoadmapInput as ProgressRoadmapInput } from '@study-tracker/progress'
import type { DayOfWeek, Pin, RoadmapInput as EngineRoadmapInput } from '@study-tracker/roadmap-engine'
import type { Event } from '../../events/EventStore'
import type {
  MaterialAddedPayload,
  RoadmapCreatedPayload,
  RoadmapReplannedPayload,
} from '../../sync/types'

type RoadmapPayload = RoadmapCreatedPayload | RoadmapReplannedPayload

export interface RoadmapRegenerateRequest {
  input: EngineRoadmapInput
  pins: Pin[]
}

interface PinnableSlot {
  weekIndex: number
  dayOfWeek: string
  candidateMaterialIds: string[]
  sessionTitle?: string | null
  plannedMinutes: number
}

const DAY_MAP: Record<string, DayOfWeek> = {
  Mon: 'Mon',
  Tue: 'Tue',
  Wed: 'Wed',
  Thu: 'Thu',
  Fri: 'Fri',
  Sat: 'Sat',
  Sun: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

function toDayOfWeek(value: string): DayOfWeek {
  const normalized = DAY_MAP[value]
  if (!normalized) {
    throw new Error(`Unsupported roadmap day: ${value}`)
  }
  return normalized
}

function latestActiveRoadmapEvent(events: Event[]): Event | null {
  const terminals = new Set(
    events
      .filter((event) =>
        event.kind === 'RoadmapMarkedComplete' ||
        event.kind === 'RoadmapMarkedAbandoned'
      )
      .map((event) => event.payload.roadmapCreatedAt as string | undefined)
      .filter((createdAt): createdAt is string => createdAt !== undefined),
  )

  const latestRoadmap = events
    .filter((event) =>
      event.kind === 'RoadmapCreated' || event.kind === 'RoadmapReplanned'
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null

  if (!latestRoadmap || terminals.has(roadmapIdentity(latestRoadmap))) return null
  return latestRoadmap
}

function roadmapIdentity(event: Event): string {
  if (event.kind !== 'RoadmapReplanned') return event.createdAt

  const originalCreatedAt = event.payload.roadmapCreatedAt
  return typeof originalCreatedAt === 'string' ? originalCreatedAt : event.createdAt
}

function materialPayloads(events: Event[], roadmap: RoadmapPayload): MaterialAddedPayload[] {
  const activeMaterialIds = new Set(
    roadmap.materialIds ??
      (roadmap.slots ?? [])
        .flatMap((slot) => slot.candidateMaterialIds)
        .filter((materialId) => materialId !== '__rest__'),
  )

  return events
    .filter((event) => event.kind === 'MaterialAdded')
    .map((event) => event.payload as unknown as MaterialAddedPayload)
    .filter((material) => activeMaterialIds.has(material.materialId))
}

function toProgressRoadmap(payload: RoadmapPayload): ProgressRoadmapInput {
  const slots = payload.slots ?? []
  return {
    startDate: payload.startDate,
    deadline: payload.deadline,
    weeks: payload.weeks,
    weeklyHours: payload.weeklyHours,
    slots: slots.map((slot) => ({
      date: slot.date,
      dayOfWeek: slot.dayOfWeek,
      weekIndex: slot.weekIndex,
      plannedMinutes: slot.plannedMinutes,
      candidateMaterialIds: slot.candidateMaterialIds,
      role: slot.role,
      sessionTitle: slot.sessionTitle,
    })),
  }
}

function sessionEvents(events: Event[]) {
  return events
    .filter((event) => event.kind === 'SessionLogged')
    .map((event) => ({
      date: event.payload.date as string,
      source: ((event.payload.source as string) ?? 'manual') as 'active' | 'manual',
      duration: (event.payload.duration as number) ?? 0,
      materialId: event.payload.materialId as string | undefined,
      sessionId: event.payload.sessionId as string | undefined,
    }))
}

function pinKey(pin: Pick<Pin, 'weekIndex' | 'dayOfWeek'>): string {
  return `${pin.weekIndex}:${pin.dayOfWeek}`
}

function pinFromSlot(
  slot: PinnableSlot,
  reason: Pin['reason'],
): Pin {
  return {
    weekIndex: slot.weekIndex,
    dayOfWeek: toDayOfWeek(slot.dayOfWeek),
    materialId: slot.candidateMaterialIds[0] ?? null,
    sessionTitle: slot.sessionTitle ?? null,
    plannedMinutes: slot.plannedMinutes,
    reason,
  }
}

function userEditedPins(events: Event[], roadmapCreatedAt: string): Pin[] {
  return events
    .filter((event) => event.kind === 'RoadmapEdited')
    .filter((event) => {
      const target = event.payload.roadmapCreatedAt as string | undefined
      return target === undefined || target === roadmapCreatedAt
    })
    .map((event) => event.payload)
    .filter((payload) =>
      typeof payload.weekIndex === 'number' &&
      typeof payload.dayOfWeek === 'string' &&
      typeof payload.plannedMinutes === 'number'
    )
    .map((payload) => ({
      weekIndex: payload.weekIndex as number,
      dayOfWeek: toDayOfWeek(payload.dayOfWeek as string),
      materialId: (payload.materialId as string | undefined) ?? null,
      sessionTitle: (payload.sessionTitle as string | undefined) ?? null,
      plannedMinutes: payload.plannedMinutes as number,
      reason: 'user-edited' as const,
    }))
}

export function mapToRegenerateRequest(
  events: Event[],
  today: string,
): RoadmapRegenerateRequest {
  const roadmapEvent = latestActiveRoadmapEvent(events)
  if (!roadmapEvent) {
    throw new Error('No active roadmap to regenerate')
  }

  const payload = roadmapEvent.payload as unknown as RoadmapPayload
  const activeIdentity = roadmapIdentity(roadmapEvent)
  const materials = materialPayloads(events, payload).map((material, additionOrder) => ({
    id: material.materialId,
    title: material.title,
    totalMinutes: material.estimatedDuration,
    role: material.role,
    additionOrder,
  }))
  const input: EngineRoadmapInput = {
    materials,
    weeks: payload.weeks,
    startDate: payload.startDate,
    selectedStudyDays: payload.selectedStudyDays.map(toDayOfWeek),
    weekdayHours: payload.weekdayHours,
    weekendHours: payload.weekendHours,
  }

  const pinsByKey = new Map<string, Pin>()
  const derived = deriveSlotStatuses(toProgressRoadmap(payload), sessionEvents(events), today)
  for (const derivedSlot of derived.slots) {
    if (derivedSlot.status === 'done') {
      const pin = pinFromSlot(derivedSlot.slot, 'completed')
      pinsByKey.set(pinKey(pin), pin)
    }
  }

  for (const slot of payload.slots ?? []) {
    if (slot.date !== today) continue
    const pin = pinFromSlot(slot, 'today')
    if (!pinsByKey.has(pinKey(pin))) {
      pinsByKey.set(pinKey(pin), pin)
    }
  }

  for (const pin of userEditedPins(events, activeIdentity)) {
    if (!pinsByKey.has(pinKey(pin))) {
      pinsByKey.set(pinKey(pin), pin)
    }
  }

  return {
    input,
    pins: [...pinsByKey.values()],
  }
}
