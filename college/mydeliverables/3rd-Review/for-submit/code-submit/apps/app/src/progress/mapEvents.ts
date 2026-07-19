import type { Event } from '../events/EventStore'
import type {
  SessionEvent,
  ExceptionalTag,
  RecalibrationResolution,
  RoadmapInput,
} from '@study-tracker/progress'
import { buildMaterialLedger } from '@study-tracker/progress'
import type { Booking, DayOfWeek, Slot } from '@study-tracker/roadmap-engine'
import type {
  BookingClearedPayload,
  BookingEditedPayload,
  MaterialAddedPayload,
  MaterialProgressMarkedPayload,
  RoadmapCreatedPayload,
  SessionBookedPayload,
} from '../sync/types'
import { deriveRoadmapLifecycle, type RoadmapLifecycleEntry } from '../roadmap/roadmapLifecycle'

export function mapSessions(events: Event[]): SessionEvent[] {
  // D-06: gap sessions remain available to global progress stats; roadmap progress
  // scopes them by each roadmap's date window in deriveRoadmapLifecycle.
  return events
    .filter((e) => e.kind === 'SessionLogged')
    .map((e) => ({
      date: e.payload.date as string,
      source: ((e.payload.source as string) ?? 'manual') as 'active' | 'manual',
      plannedMinutes: e.payload.plannedMinutes as number | undefined,
      activeMinutes: e.payload.activeMinutes as number | undefined,
      duration: (e.payload.duration as number) ?? 0,
      materialId: e.payload.materialId as string | undefined,
      materialRole: e.payload.role as SessionEvent['materialRole'],
      startedAt: e.payload.startedAt as string | undefined,
      sessionId: e.payload.sessionId as string | undefined,
      bookingId: e.payload.bookingId as string | undefined,
      resolution: e.payload.resolution as SessionEvent['resolution'],
      materialPosition: e.payload.materialPosition as SessionEvent['materialPosition'],
      materialConsumedMinutes: e.payload.materialConsumedMinutes as number | undefined,
      plannedSessionMinutes: e.payload.plannedSessionMinutes as number | undefined,
    }))
}

export function mapExceptionalTags(events: Event[]): ExceptionalTag[] {
  return events
    .filter((e) => e.kind === 'SessionTaggedExceptional')
    .map((e) => ({
      sessionId: e.payload.sessionId as string,
      exceptional: e.payload.exceptional as boolean,
    }))
}

export function mapResolutions(events: Event[]): RecalibrationResolution[] {
  return events
    .filter((e) => e.kind === 'RecalibrationPromptResolved')
    .map((e) => ({
      resolution: e.payload.resolution as RecalibrationResolution['resolution'],
      resolvedAt: e.createdAt,
    }))
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function dayOfWeekForISO(iso: string): DayOfWeek {
  const day = new Date(`${iso}T00:00:00.000Z`).getUTCDay()
  return (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const)[day]
}

function dayDiff(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00.000Z`).getTime()
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime()
  return Math.round((endMs - startMs) / 86_400_000)
}

function slotFromBooking(booking: Booking, payload: RoadmapCreatedPayload): Slot {
  const weekIndex = Math.max(0, Math.floor(dayDiff(payload.startDate, booking.date) / 7))
  return {
    date: booking.date,
    dayOfWeek: dayOfWeekForISO(booking.date),
    weekIndex,
    capacityMinutes: booking.estimatedDuration,
    plannedMinutes: booking.estimatedDuration,
    candidateMaterialIds: booking.materialId ? [booking.materialId] : [],
    role: null,
    sessionTitle: null,
  }
}

function toRoadmapInput(
  payload: RoadmapCreatedPayload,
  bookings: Booking[] = [],
  materialMetrics: { totalMinutes?: number; remainingMinutes?: number } = {},
): RoadmapInput {
  const slots = payload.slots ?? bookings.map((booking) => slotFromBooking(booking, payload))
  return {
    startDate: payload.startDate,
    deadline: payload.deadline,
    weeks: payload.weeks,
    weeklyHours: payload.weeklyHours,
    selectedStudyDays: payload.selectedStudyDays,
    weekdayHours: payload.weekdayHours,
    weekendHours: payload.weekendHours,
    materialTotalMinutes: materialMetrics.totalMinutes,
    materialRemainingMinutes: materialMetrics.remainingMinutes,
    slots: slots.map((slot) => ({
      date: slot.date,
      dayOfWeek: slot.dayOfWeek,
      weekIndex: slot.weekIndex,
      plannedMinutes: slot.plannedMinutes,
      candidateMaterialIds: slot.candidateMaterialIds,
      role: slot.role,
      sessionTitle: slot.sessionTitle ?? null,
    })),
  }
}

function materialMetricsForRoadmap(
  events: Event[],
  entry: RoadmapLifecycleEntry,
): { totalMinutes?: number; remainingMinutes?: number } {
  const materials = mapMaterialsForRoadmap(events, entry)
  if (materials.length === 0) return {}

  const ledger = buildMaterialLedger(
    materials.map((material) => ({
      id: material.materialId,
      title: material.title,
      estimatedMinutes: material.estimatedDuration,
    })),
    mapSessions(events),
    mapMaterialProgressMarks(events, entry.roadmapCreatedAt),
  )

  return {
    totalMinutes: ledger.reduce((total, material) => total + material.estimatedMinutes, 0),
    remainingMinutes: ledger.reduce((total, material) => total + material.remainingEstimatedMinutes, 0),
  }
}

function roadmapIdentity(event: Event): string {
  if (event.kind !== 'RoadmapReplanned') return event.createdAt
  const originalCreatedAt = event.payload.roadmapCreatedAt
  return typeof originalCreatedAt === 'string' ? originalCreatedAt : event.createdAt
}

function effectiveEstimatedDuration(
  material: MaterialAddedPayload,
  roadmapEntry: RoadmapLifecycleEntry,
): number {
  const override = roadmapEntry.payload.materialDurationOverrides?.[material.materialId]
  if (typeof override !== 'number') return material.estimatedDuration
  return Math.max(0, Math.min(material.estimatedDuration, override))
}

function foldBookingEvents(events: Event[], roadmapCreatedAt: string, baseBookings: Booking[]): Booking[] {
  const byId = new Map(baseBookings.map((booking) => [booking.id, { ...booking }]))
  for (const event of events) {
    if (event.kind === 'SessionBooked') {
      const payload = event.payload as unknown as SessionBookedPayload
      if (payload.roadmapCreatedAt !== roadmapCreatedAt) continue
      byId.set(payload.bookingId, {
        id: payload.bookingId,
        date: payload.date,
        estimatedDuration: payload.estimatedDuration,
        ...(payload.materialId ? { materialId: payload.materialId } : {}),
        status: 'booked',
      })
    }
    if (event.kind === 'BookingEdited') {
      const payload = event.payload as unknown as BookingEditedPayload
      if (payload.roadmapCreatedAt !== roadmapCreatedAt) continue
      const existing = byId.get(payload.bookingId)
      if (!existing) continue
      const next = { ...existing }
      if (payload.date !== undefined) next.date = payload.date
      if (payload.estimatedDuration !== undefined) next.estimatedDuration = payload.estimatedDuration
      if (payload.materialId === null) {
        delete next.materialId
      } else if (payload.materialId !== undefined) {
        next.materialId = payload.materialId
      }
      byId.set(payload.bookingId, next)
    }
    if (event.kind === 'BookingCleared') {
      const payload = event.payload as unknown as BookingClearedPayload
      if (payload.roadmapCreatedAt !== roadmapCreatedAt) continue
      byId.delete(payload.bookingId)
    }
  }
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

function legacyBookingsFromSlots(payload: RoadmapCreatedPayload, today?: string): Booking[] {
  return (payload.slots ?? [])
    .filter((slot) => today === undefined || slot.date >= today)
    .map((slot) => ({
      id: `legacy:${slot.weekIndex}:${slot.dayOfWeek}:${slot.date}`,
      date: slot.date,
      estimatedDuration: slot.plannedMinutes || slot.capacityMinutes,
      materialId: slot.candidateMaterialIds.find((id) => id !== '__rest__'),
      status: 'booked' as const,
    }))
}

export function mapBookings(events: Event[], roadmapCreatedAt?: string): Booking[] {
  const scopedRoadmapCreatedAt = roadmapCreatedAt ?? deriveRoadmapLifecycle(events).active[0]?.roadmapCreatedAt
  if (!scopedRoadmapCreatedAt) return []
  return foldBookingEvents(events, scopedRoadmapCreatedAt, [])
}

export function deriveBookingsForRoadmap(
  events: Event[],
  roadmapEntry: RoadmapLifecycleEntry,
  today?: string,
): Booking[] {
  const baseBookings = roadmapEntry.payload.slots
    ? legacyBookingsFromSlots(roadmapEntry.payload, today)
    : []
  return foldBookingEvents(events, roadmapEntry.roadmapCreatedAt, baseBookings)
}

export function mapMaterialProgressMarks(
  events: Event[],
  roadmapCreatedAt?: string,
) {
  return events
    .filter((event) => event.kind === 'MaterialProgressMarked')
    .map((event) => event.payload as unknown as MaterialProgressMarkedPayload)
    .filter((payload) => roadmapCreatedAt === undefined || payload.roadmapCreatedAt === roadmapCreatedAt)
    .map((payload) => ({
      materialId: payload.materialId,
      markedAt: payload.markedAt,
      materialPosition: payload.materialPosition,
    }))
}

export function mapMaterialsForRoadmap(
  events: Event[],
  roadmapEntry: RoadmapLifecycleEntry,
): MaterialAddedPayload[] {
  const materialIds = roadmapEntry.payload.materialIds ??
    [...new Set((roadmapEntry.payload.slots ?? [])
      .flatMap((slot) => slot.candidateMaterialIds)
      .filter((id) => id !== '__rest__'))]
  const byId = new Map<string, MaterialAddedPayload>()
  for (const event of events) {
    if (event.kind !== 'MaterialAdded') continue
    const payload = event.payload as unknown as MaterialAddedPayload
    byId.set(payload.materialId, payload)
  }
  return materialIds.flatMap((materialId) => {
    const material = byId.get(materialId)
    return material
      ? [{
          ...material,
          estimatedDuration: effectiveEstimatedDuration(material, roadmapEntry),
        }]
      : []
  })
}

export function capacityWeeklyTarget(payload: RoadmapCreatedPayload, weekStartDate: string): number {
  let total = 0
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDaysISO(weekStartDate, offset)
    const day = dayOfWeekForISO(date)
    if (!payload.selectedStudyDays.includes(day)) continue
    total += (day === 'Sat' || day === 'Sun' ? payload.weekendHours : payload.weekdayHours) * 60
  }
  return Math.round(total)
}

export function findRoadmap(events: Event[]): RoadmapInput | null {
  const roadmapEvents = events.filter(
    (e) => e.kind === 'RoadmapCreated' || e.kind === 'RoadmapReplanned',
  )
  if (roadmapEvents.length === 0) return null
  const latest = roadmapEvents[roadmapEvents.length - 1]
  const payload = latest.payload as unknown as RoadmapCreatedPayload
  const bookings = payload.slots ? [] : foldBookingEvents(events, roadmapIdentity(latest), [])
  return toRoadmapInput(payload, bookings)
}

// UI-facing current-roadmap resolver. Terminal plans are archival, so abandoned
// or completed roadmaps stop driving Home/progress while their sessions remain.
export function findActiveRoadmap(events: Event[]): RoadmapInput | null {
  const active = deriveRoadmapLifecycle(events).active[0]
  if (!active) return null
  const bookings = active.payload.slots ? [] : deriveBookingsForRoadmap(events, active)
  return toRoadmapInput(active.payload, bookings, materialMetricsForRoadmap(events, active))
}
