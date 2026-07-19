import { describe, expect, it, vi } from 'vitest'
import type { Event } from '../../events/EventStore'
import type { RoadmapCreatedPayload } from '../../sync/types'
import { deriveRoadmapLifecycle } from '../roadmapLifecycle'
import { commitReplan } from './commitReplan'

function event(kind: string, payload: unknown, createdAt: string): Event {
  return { kind, payload: payload as Record<string, unknown>, createdAt }
}

const ROADMAP_CREATED_AT = '2026-05-31T10:00:00.000Z'
const TODAY = '2026-06-10'
const DEADLINE = '2026-06-30'

function roadmapPayload(): RoadmapCreatedPayload {
  return {
    startDate: '2026-06-01',
    deadline: DEADLINE,
    weeks: 4,
    purpose: 'Systems exam',
    selectedStudyDays: ['Mon', 'Wed'],
    weekdayHours: 1,
    weekendHours: 0,
    weeklyHours: 2,
    materialIds: ['mat-1', 'mat-2'],
    slots: undefined,
  }
}

function baseEvents(): Event[] {
  return [
    event('MaterialAdded', { materialId: 'mat-1', title: 'Algo Book', estimatedDuration: 60, role: 'anchor' }, '2026-05-30T09:00:00.000Z'),
    event('MaterialAdded', { materialId: 'mat-2', title: 'Practice Set', estimatedDuration: 60, role: 'practice' }, '2026-05-30T09:01:00.000Z'),
    event('RoadmapCreated', roadmapPayload(), ROADMAP_CREATED_AT),
    // Two future bookings from onboarding
    event('SessionBooked', { roadmapCreatedAt: ROADMAP_CREATED_AT, bookingId: 'planned:0:2026-06-10', date: '2026-06-10', estimatedDuration: 60 }, '2026-05-31T10:01:00.000Z'),
    event('SessionBooked', { roadmapCreatedAt: ROADMAP_CREATED_AT, bookingId: 'planned:1:2026-06-12', date: '2026-06-12', estimatedDuration: 60 }, '2026-05-31T10:02:00.000Z'),
  ]
}

const materials = [
  { materialId: 'mat-1', title: 'Algo Book', role: 'anchor' as const, remainingMinutes: 60 },
  { materialId: 'mat-2', title: 'Practice Set', role: 'practice' as const, remainingMinutes: 60 },
]

describe('commitReplan', () => {
  it('emits RoadmapReplanned with new capacity/deadline/materialIds and no slots', async () => {
    const logEvent = vi.fn().mockResolvedValue(1)

    await commitReplan({
      events: baseEvents(),
      roadmapCreatedAt: ROADMAP_CREATED_AT,
      logEvent,
      today: TODAY,
      deadline: '2026-07-07',  // +1 week
      weekdayHours: 1.5,
      weekendHours: 1.5,
      selectedStudyDays: ['Mon', 'Wed', 'Fri'],
      materialIds: ['mat-1', 'mat-2'],
      materials,
    })

    const replanCall = logEvent.mock.calls.find((c) => c[0] === 'RoadmapReplanned')
    expect(replanCall).toBeDefined()
    const payload = replanCall![1]
    expect(payload.roadmapCreatedAt).toBe(ROADMAP_CREATED_AT)
    expect(payload.deadline).toBe('2026-07-07')
    expect(payload.weekdayHours).toBe(1.5)
    expect(payload.weekendHours).toBe(1.5)
    expect(payload.selectedStudyDays).toEqual(['Mon', 'Wed', 'Fri'])
    expect(payload.materialIds).toEqual(['mat-1', 'mat-2'])
    expect(payload.slots).toBeUndefined()
    expect(payload.weeks).toBe(6)
  })

  it('clears all future bookings before emitting new ones', async () => {
    const logEvent = vi.fn().mockResolvedValue(1)

    await commitReplan({
      events: baseEvents(),
      roadmapCreatedAt: ROADMAP_CREATED_AT,
      logEvent,
      today: TODAY,
      deadline: DEADLINE,
      weekdayHours: 1,
      weekendHours: 0,
      selectedStudyDays: ['Mon', 'Wed'],
      materialIds: ['mat-1', 'mat-2'],
      materials,
    })

    const cleared = logEvent.mock.calls.filter((c) => c[0] === 'BookingCleared')
    expect(cleared.length).toBeGreaterThanOrEqual(1)
    const clearedIds = cleared.map((c) => c[1].bookingId)
    // Both future bookings (2026-06-10 and 2026-06-12) should be cleared
    expect(clearedIds).toContain('planned:0:2026-06-10')
    expect(clearedIds).toContain('planned:1:2026-06-12')
  })

  it('emits new SessionBooked events for regenerated bookings', async () => {
    const logEvent = vi.fn().mockResolvedValue(1)

    await commitReplan({
      events: baseEvents(),
      roadmapCreatedAt: ROADMAP_CREATED_AT,
      logEvent,
      today: TODAY,
      deadline: DEADLINE,
      weekdayHours: 1,
      weekendHours: 0,
      selectedStudyDays: ['Mon', 'Wed'],
      materialIds: ['mat-1', 'mat-2'],
      materials,
    })

    const booked = logEvent.mock.calls.filter((c) => c[0] === 'SessionBooked')
    // 120 total minutes / 60 per day = 2 bookings
    expect(booked.length).toBe(2)
    // All new bookings link back to the roadmap
    booked.forEach((c) => expect(c[1].roadmapCreatedAt).toBe(ROADMAP_CREATED_AT))
  })

  it('writes materialDurationOverrides when materials are shortened', async () => {
    const logEvent = vi.fn().mockResolvedValue(1)

    await commitReplan({
      events: baseEvents(),
      roadmapCreatedAt: ROADMAP_CREATED_AT,
      logEvent,
      today: TODAY,
      deadline: DEADLINE,
      weekdayHours: 1,
      weekendHours: 0,
      selectedStudyDays: ['Mon', 'Wed'],
      materialIds: ['mat-1'],  // mat-2 dropped
      materialDurationOverrides: { 'mat-1': 30 },
      materials: [{ materialId: 'mat-1', title: 'Algo Book', role: 'anchor', remainingMinutes: 30 }],
    })

    const replanCall = logEvent.mock.calls.find((c) => c[0] === 'RoadmapReplanned')
    const payload = replanCall![1]
    expect(payload.materialIds).toEqual(['mat-1'])
    expect(payload.materialDurationOverrides).toEqual({ 'mat-1': 30 })
    // Dropped mat-2 not in materialIds
    expect((payload.materialIds as string[]).includes('mat-2')).toBe(false)
  })

  it('emit order: RoadmapReplanned first, then BookingCleared, then SessionBooked', async () => {
    const logEvent = vi.fn().mockResolvedValue(1)

    await commitReplan({
      events: baseEvents(),
      roadmapCreatedAt: ROADMAP_CREATED_AT,
      logEvent,
      today: TODAY,
      deadline: DEADLINE,
      weekdayHours: 1,
      weekendHours: 0,
      selectedStudyDays: ['Mon', 'Wed'],
      materialIds: ['mat-1', 'mat-2'],
      materials,
    })

    const kinds = logEvent.mock.calls.map((c) => c[0])
    const replannedIdx = kinds.indexOf('RoadmapReplanned')
    const firstClearedIdx = kinds.indexOf('BookingCleared')
    const firstBookedIdx = kinds.indexOf('SessionBooked')

    expect(replannedIdx).toBeLessThan(firstClearedIdx)
    expect(firstClearedIdx).toBeLessThan(firstBookedIdx)
  })

  it('updated lifecycle has one active entry with new deadline', async () => {
    const logEvent = vi.fn().mockResolvedValue(1)
    const newDeadline = '2026-07-07'

    await commitReplan({
      events: baseEvents(),
      roadmapCreatedAt: ROADMAP_CREATED_AT,
      logEvent,
      today: TODAY,
      deadline: newDeadline,
      weekdayHours: 1,
      weekendHours: 0,
      selectedStudyDays: ['Mon', 'Wed'],
      materialIds: ['mat-1', 'mat-2'],
      materials,
    })

    const replanPayload = logEvent.mock.calls.find((c) => c[0] === 'RoadmapReplanned')![1]
    const allEvents = [
      ...baseEvents(),
      event('RoadmapReplanned', replanPayload, '2026-06-10T12:00:00.000Z'),
    ]
    const lifecycle = deriveRoadmapLifecycle(allEvents)
    expect(lifecycle.active).toHaveLength(1)
    expect(lifecycle.active[0].roadmapCreatedAt).toBe(ROADMAP_CREATED_AT)
    expect(lifecycle.active[0].payload.deadline).toBe(newDeadline)
  })
})
