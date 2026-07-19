import { describe, expect, it } from 'vitest'
import type { Event } from '../events/EventStore'
import type { RoadmapCreatedPayload } from '../sync/types'
import { deriveRoadmapLifecycle } from '../roadmap/roadmapLifecycle'
import {
  deriveBookingsForRoadmap,
  findActiveRoadmap,
  findRoadmap,
  mapBookings,
  mapMaterialsForRoadmap,
  mapSessions,
} from './mapEvents'

function roadmapPayload(overrides: Partial<RoadmapCreatedPayload> = {}): RoadmapCreatedPayload {
  return {
    startDate: '2026-06-01',
    deadline: '2026-07-01',
    weeks: 4,
    purpose: 'Distributed systems',
    selectedStudyDays: ['Mon', 'Wed'],
    weekdayHours: 1,
    weekendHours: 2,
    weeklyHours: 4,
    slots: [
      {
        date: '2026-06-03',
        dayOfWeek: 'Wed',
        weekIndex: 0,
        plannedMinutes: 60,
        capacityMinutes: 60,
        candidateMaterialIds: ['mat-1'],
        role: 'anchor',
        sessionTitle: 'Read chapter 1',
      },
    ],
    ...overrides,
  }
}

function event(kind: string, payload: unknown, createdAt: string): Event {
  return { kind, payload: payload as Record<string, unknown>, createdAt }
}

describe('mapEvents roadmap resolution', () => {
  it('returns null when the latest roadmap is abandoned with no successor', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const events = [
      event('RoadmapCreated', roadmapPayload(), createdAt),
      event(
        'RoadmapMarkedAbandoned',
        {
          roadmapCreatedAt: createdAt,
          resolvedAt: '2026-06-20T00:00:00.000Z',
        },
        '2026-06-20T00:00:00.000Z',
      ),
    ]

    expect(findActiveRoadmap(events)).toBeNull()
  })

  it('returns null when the latest roadmap is completed with no successor', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const events = [
      event('RoadmapCreated', roadmapPayload(), createdAt),
      event(
        'RoadmapMarkedComplete',
        {
          roadmapCreatedAt: createdAt,
          resolvedAt: '2026-06-20T00:00:00.000Z',
        },
        '2026-06-20T00:00:00.000Z',
      ),
    ]

    expect(findActiveRoadmap(events)).toBeNull()
  })

  it('tracks a new active roadmap after abandoning an older one', () => {
    const firstCreatedAt = '2026-06-01T00:00:00.000Z'
    const secondCreatedAt = '2026-07-01T00:00:00.000Z'
    const active = findActiveRoadmap([
      event('RoadmapCreated', roadmapPayload({ purpose: 'Old plan' }), firstCreatedAt),
      event(
        'RoadmapMarkedAbandoned',
        {
          roadmapCreatedAt: firstCreatedAt,
          resolvedAt: '2026-06-20T00:00:00.000Z',
        },
        '2026-06-20T00:00:00.000Z',
      ),
      event(
        'RoadmapCreated',
        roadmapPayload({
          purpose: 'New plan',
          startDate: '2026-07-01',
          deadline: '2026-08-01',
          slots: [
            {
              ...roadmapPayload().slots![0],
              date: '2026-07-03',
              sessionTitle: 'New plan session',
            },
          ],
        }),
        secondCreatedAt,
      ),
    ])

    expect(active?.startDate).toBe('2026-07-01')
    expect(active?.deadline).toBe('2026-08-01')
    expect(active?.slots[0]?.sessionTitle).toBe('New plan session')
  })

  it('keeps replan parity with the old latest-roadmap resolver while active', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const events = [
      event('RoadmapCreated', roadmapPayload({ purpose: 'Original' }), createdAt),
      event(
        'RoadmapReplanned',
        {
          ...roadmapPayload({
            purpose: 'Replanned',
            deadline: '2026-08-01',
            slots: [
              {
                ...roadmapPayload().slots![0],
                plannedMinutes: 90,
                sessionTitle: 'Replanned session',
              },
            ],
          }),
          roadmapCreatedAt: createdAt,
        },
        '2026-06-10T00:00:00.000Z',
      ),
    ]

    expect(findActiveRoadmap(events)).toEqual(findRoadmap(events))
    expect(findActiveRoadmap(events)?.deadline).toBe('2026-08-01')
    expect(findActiveRoadmap(events)?.slots[0]).toMatchObject({
      plannedMinutes: 90,
      sessionTitle: 'Replanned session',
    })
  })

  it('keeps session mapping global after a roadmap is abandoned', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const events = [
      event('RoadmapCreated', roadmapPayload(), createdAt),
      event(
        'RoadmapMarkedAbandoned',
        {
          roadmapCreatedAt: createdAt,
          resolvedAt: '2026-06-20T00:00:00.000Z',
        },
        '2026-06-20T00:00:00.000Z',
      ),
      event(
        'SessionLogged',
        {
          date: '2026-06-03',
          source: 'active',
          plannedMinutes: 60,
          duration: 45,
          materialId: 'mat-1',
          role: 'anchor',
          sessionId: 's-1',
        },
        '2026-06-03T12:00:00.000Z',
      ),
    ]

    expect(findActiveRoadmap(events)).toBeNull()
    expect(mapSessions(events)).toHaveLength(1)
    expect(mapSessions(events)[0]).toMatchObject({
      sessionId: 's-1',
      duration: 45,
    })
  })

  it('maps booking session metadata from SessionLogged payloads', () => {
    const [mapped] = mapSessions([
      event(
        'SessionLogged',
        {
          date: '2026-06-03',
          source: 'active',
          plannedMinutes: 60,
          plannedSessionMinutes: 45,
          activeMinutes: 30,
          duration: 30,
          materialId: 'mat-1',
          role: 'anchor',
          sessionId: 's-1',
          bookingId: 'booking-1',
          resolution: 'interrupted',
          materialPosition: { kind: 'percent', value: 40 },
          materialConsumedMinutes: 20,
        },
        '2026-06-03T12:00:00.000Z',
      ),
    ])

    expect(mapped).toMatchObject({
      bookingId: 'booking-1',
      resolution: 'interrupted',
      plannedSessionMinutes: 45,
      materialPosition: { kind: 'percent', value: 40 },
      materialConsumedMinutes: 20,
    })
  })

  it('folds booking events for no-slot roadmaps', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const events = [
      event('RoadmapCreated', roadmapPayload({ slots: undefined, materialIds: ['mat-1'] }), createdAt),
      event(
        'SessionBooked',
        {
          roadmapCreatedAt: createdAt,
          bookingId: 'booking-1',
          date: '2026-06-03',
          estimatedDuration: 60,
          materialId: 'mat-1',
        },
        '2026-06-01T00:01:00.000Z',
      ),
      event(
        'BookingEdited',
        {
          roadmapCreatedAt: createdAt,
          bookingId: 'booking-1',
          estimatedDuration: 45,
          materialId: null,
        },
        '2026-06-01T00:02:00.000Z',
      ),
    ]

    expect(mapBookings(events)).toEqual([
      {
        id: 'booking-1',
        date: '2026-06-03',
        estimatedDuration: 45,
        status: 'booked',
      },
    ])
    expect(findActiveRoadmap(events)?.slots[0]).toMatchObject({
      date: '2026-06-03',
      plannedMinutes: 45,
      candidateMaterialIds: [],
    })
  })

  it('applies booking clears in event order', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const events = [
      event('RoadmapCreated', roadmapPayload({ slots: undefined, materialIds: ['mat-1'] }), createdAt),
      event(
        'SessionBooked',
        {
          roadmapCreatedAt: createdAt,
          bookingId: 'booking-1',
          date: '2026-06-03',
          estimatedDuration: 60,
        },
        '2026-06-01T00:01:00.000Z',
      ),
      event(
        'BookingCleared',
        { roadmapCreatedAt: createdAt, bookingId: 'booking-1' },
        '2026-06-01T00:02:00.000Z',
      ),
    ]

    expect(mapBookings(events)).toEqual([])
  })

  it('adapts future legacy slots into bookings and applies booking events on top', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const events = [
      event('RoadmapCreated', roadmapPayload(), createdAt),
      event(
        'SessionBooked',
        {
          roadmapCreatedAt: createdAt,
          bookingId: 'extra',
          date: '2026-06-05',
          estimatedDuration: 30,
        },
        '2026-06-01T00:01:00.000Z',
      ),
    ]
    const active = deriveRoadmapLifecycle(events).active[0]

    expect(deriveBookingsForRoadmap(events, active!, '2026-06-01')).toEqual([
      {
        id: 'legacy:0:Wed:2026-06-03',
        date: '2026-06-03',
        estimatedDuration: 60,
        materialId: 'mat-1',
        status: 'booked',
      },
      {
        id: 'extra',
        date: '2026-06-05',
        estimatedDuration: 30,
        status: 'booked',
      },
    ])
  })

  it('scopes no-slot roadmap materials by materialIds instead of all MaterialAdded events', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const events = [
      event('MaterialAdded', { materialId: 'mat-1', title: 'Old', estimatedDuration: 30, kind: 'manual', role: 'anchor' }, '2026-05-01T00:00:00.000Z'),
      event('MaterialAdded', { materialId: 'mat-2', title: 'Current', estimatedDuration: 45, kind: 'manual', role: 'foundation' }, '2026-06-01T00:00:00.000Z'),
      event('RoadmapCreated', roadmapPayload({ slots: undefined, materialIds: ['mat-2'] }), createdAt),
    ]
    const active = deriveRoadmapLifecycle(events).active[0]

    expect(mapMaterialsForRoadmap(events, active!).map((material) => material.materialId)).toEqual(['mat-2'])
  })

  it('applies active roadmap materialDurationOverrides when mapping materials and progress inputs', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const events = [
      event('MaterialAdded', { materialId: 'mat-1', title: 'Current', estimatedDuration: 120, kind: 'manual', role: 'anchor' }, '2026-06-01T00:00:00.000Z'),
      event('RoadmapCreated', roadmapPayload({ slots: undefined, materialIds: ['mat-1'] }), createdAt),
      event(
        'RoadmapReplanned',
        {
          ...roadmapPayload({ slots: undefined, materialIds: ['mat-1'] }),
          roadmapCreatedAt: createdAt,
          materialDurationOverrides: { 'mat-1': 75 },
        },
        '2026-06-10T00:00:00.000Z',
      ),
    ]
    const active = deriveRoadmapLifecycle(events).active[0]

    expect(mapMaterialsForRoadmap(events, active!)[0].estimatedDuration).toBe(75)
    expect(findActiveRoadmap(events)).toMatchObject({
      materialTotalMinutes: 75,
      materialRemainingMinutes: 75,
    })
  })
})
