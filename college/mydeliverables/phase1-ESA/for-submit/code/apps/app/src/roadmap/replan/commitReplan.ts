import {
  generateBookings,
  type DayOfWeek,
  type BookingLayoutInput,
} from '@study-tracker/roadmap-engine'
import type { Event } from '../../events/EventStore'
import type {
  RoadmapReplannedPayload,
  MaterialAddedPayload,
} from '../../sync/types'
import { deriveRoadmapLifecycle } from '../roadmapLifecycle'
import { deriveBookingsForRoadmap } from '../../progress/mapEvents'

export interface CommitReplanOptions {
  events: Event[]
  roadmapCreatedAt: string
  logEvent: (kind: string, payload: Record<string, unknown>, createdAt?: string) => Promise<unknown>
  today: string
  deadline: string
  weekdayHours: number
  weekendHours: number
  selectedStudyDays: DayOfWeek[]
  /** Ordered material IDs to include (dropped materials excluded). */
  materialIds: string[]
  /** materialId → shortened remaining minutes; absent = no override. */
  materialDurationOverrides?: Record<string, number>
  /** Materials with their target remaining durations for generating new bookings. */
  materials: Array<Pick<MaterialAddedPayload, 'materialId' | 'title' | 'role'> & { remainingMinutes: number }>
}

function computeWeeklyHours(
  weekdayHours: number,
  weekendHours: number,
  selectedStudyDays: DayOfWeek[],
): number {
  let total = 0
  for (const day of selectedStudyDays) {
    total += (day === 'Sat' || day === 'Sun') ? weekendHours : weekdayHours
  }
  return total
}

function dayDiff(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00.000Z`).getTime()
  const endMs = new Date(`${end}T00:00:00.000Z`).getTime()
  return Math.round((endMs - startMs) / 86_400_000)
}

function roadmapWeeks(startDate: string, deadline: string): number {
  return Math.max(1, Math.ceil(Math.max(0, dayDiff(startDate, deadline)) / 7))
}

export async function commitReplan(options: CommitReplanOptions): Promise<void> {
  const {
    events, roadmapCreatedAt, logEvent, today,
    deadline, weekdayHours, weekendHours, selectedStudyDays,
    materialIds, materialDurationOverrides, materials,
  } = options

  const lifecycle = deriveRoadmapLifecycle(events)
  const entry =
    lifecycle.active.find((c) => c.roadmapCreatedAt === roadmapCreatedAt) ??
    lifecycle.all.find((c) => c.roadmapCreatedAt === roadmapCreatedAt)

  if (!entry) throw new Error('No roadmap found for replan commit')

  // 1. Emit RoadmapReplanned with new capacity/deadline/materialIds (no slots).
  const weeklyHours = computeWeeklyHours(weekdayHours, weekendHours, selectedStudyDays)
  const overrides =
    materialDurationOverrides && Object.keys(materialDurationOverrides).length > 0
      ? materialDurationOverrides
      : undefined

  const replannedPayload: RoadmapReplannedPayload = {
    ...entry.payload,
    roadmapCreatedAt,
    deadline,
    weekdayHours,
    weekendHours,
    weeklyHours,
    selectedStudyDays,
    materialIds,
    materialDurationOverrides: overrides,
    slots: undefined,
    weeks: roadmapWeeks(entry.payload.startDate, deadline),
    option: 'edit',
  }

  await logEvent('RoadmapReplanned', replannedPayload as unknown as Record<string, unknown>)

  // 2. Clear all future bookings for this roadmap.
  const futureBookings = deriveBookingsForRoadmap(events, entry, today).filter(
    (b) => b.date >= today,
  )
  for (const booking of futureBookings) {
    await logEvent('BookingCleared', { roadmapCreatedAt, bookingId: booking.id })
  }

  // 3. Generate and emit new bookings for the remaining work.
  const layoutInput: BookingLayoutInput = {
    startDate: today,
    deadline,
    selectedStudyDays,
    weekdayHours,
    weekendHours,
    materials: materials.map((m, index) => ({
      id: m.materialId,
      title: m.title,
      totalMinutes: m.remainingMinutes,
      role: m.role,
      additionOrder: index,
    })),
  }

  const { bookings: newBookings } = generateBookings(layoutInput)
  for (const booking of newBookings) {
    const payload: Record<string, unknown> = {
      roadmapCreatedAt,
      bookingId: booking.id,
      date: booking.date,
      estimatedDuration: booking.estimatedDuration,
    }
    if (booking.materialId !== undefined) payload.materialId = booking.materialId
    await logEvent('SessionBooked', payload)
  }
}
