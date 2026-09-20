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
  materialTitleIndex,
  materialUsageLabels,
  roadmapMaterialPayloads,
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

describe('roadmapMaterialPayloads', () => {
  const roadmapA = '2026-06-01T00:00:00.000Z'
  const roadmapB = '2026-07-01T00:00:00.000Z'

  function attached(
    roadmapCreatedAt: string,
    materialId: string,
    estimatedDuration: number,
    createdAt = '2026-06-02T00:00:00.000Z',
  ): Event {
    return event(
      'MaterialAttached',
      {
        roadmapCreatedAt,
        materialId,
        title: 'OSTEP',
        estimatedDuration,
        kind: 'file',
        role: 'foundation',
      },
      createdAt,
    )
  }

  it('scopes an attachment to its own roadmap and keeps that roadmap budget', () => {
    const emptyScope = roadmapPayload({ slots: undefined, materialIds: [] })
    const events = [
      event('RoadmapCreated', emptyScope, roadmapA),
      event('RoadmapCreated', emptyScope, roadmapB),
      attached(roadmapA, 'mat-lib', 90),
      attached(roadmapB, 'mat-lib', 45),
    ]

    expect(roadmapMaterialPayloads(events, emptyScope, roadmapA)).toMatchObject([
      { materialId: 'mat-lib', estimatedDuration: 90 },
    ])
    expect(roadmapMaterialPayloads(events, emptyScope, roadmapB)).toMatchObject([
      { materialId: 'mat-lib', estimatedDuration: 45 },
    ])
  })

  it('keeps declared order and appends attached materials', () => {
    const scope = roadmapPayload({ slots: undefined, materialIds: ['mat-1', 'mat-2'] })
    const events = [
      event('MaterialAdded', { materialId: 'mat-1', title: 'One', estimatedDuration: 30, kind: 'manual', role: 'anchor' }, '2026-05-01T00:00:00.000Z'),
      event('MaterialAdded', { materialId: 'mat-2', title: 'Two', estimatedDuration: 40, kind: 'manual', role: 'foundation' }, '2026-05-01T00:00:00.000Z'),
      event('RoadmapCreated', scope, roadmapA),
      attached(roadmapA, 'mat-3', 60),
    ]

    expect(roadmapMaterialPayloads(events, scope, roadmapA).map((m) => m.materialId)).toEqual([
      'mat-1',
      'mat-2',
      'mat-3',
    ])
  })

  it('takes the last attach as the budget for a re-attached material', () => {
    const scope = roadmapPayload({ slots: undefined, materialIds: [] })
    const events = [
      event('RoadmapCreated', scope, roadmapA),
      attached(roadmapA, 'mat-lib', 60, '2026-06-02T00:00:00.000Z'),
      attached(roadmapA, 'mat-lib', 120, '2026-06-03T00:00:00.000Z'),
    ]

    expect(roadmapMaterialPayloads(events, scope, roadmapA)).toMatchObject([
      { materialId: 'mat-lib', estimatedDuration: 120 },
    ])
  })

  it('falls back to slot candidates when materialIds is absent', () => {
    const scope = roadmapPayload()
    const events = [
      event('MaterialAdded', { materialId: 'mat-1', title: 'One', estimatedDuration: 30, kind: 'manual', role: 'anchor' }, '2026-05-01T00:00:00.000Z'),
      event('RoadmapCreated', scope, roadmapA),
      attached(roadmapA, 'mat-9', 30),
    ]

    expect(roadmapMaterialPayloads(events, scope, roadmapA).map((m) => m.materialId)).toEqual([
      'mat-1',
      'mat-9',
    ])
  })

  function detached(roadmapCreatedAt: string, materialId: string, createdAt: string): Event {
    return event('MaterialDetached', { roadmapCreatedAt, materialId }, createdAt)
  }

  it('masks an attached material after a detach and restores it on re-attach', () => {
    const scope = roadmapPayload({ slots: undefined, materialIds: [] })
    const events = [
      event('RoadmapCreated', scope, roadmapA),
      attached(roadmapA, 'mat-lib', 60, '2026-06-02T00:00:00.000Z'),
      detached(roadmapA, 'mat-lib', '2026-06-03T00:00:00.000Z'),
    ]

    expect(roadmapMaterialPayloads(events, scope, roadmapA)).toEqual([])

    const reattached = [
      ...events,
      attached(roadmapA, 'mat-lib', 45, '2026-06-04T00:00:00.000Z'),
    ]
    expect(roadmapMaterialPayloads(reattached, scope, roadmapA)).toMatchObject([
      { materialId: 'mat-lib', estimatedDuration: 45 },
    ])
  })

  it('masks a declared material too', () => {
    const scope = roadmapPayload({ slots: undefined, materialIds: ['mat-1', 'mat-2'] })
    const events = [
      event('MaterialAdded', { materialId: 'mat-1', title: 'One', estimatedDuration: 30, kind: 'manual', role: 'anchor' }, '2026-05-01T00:00:00.000Z'),
      event('MaterialAdded', { materialId: 'mat-2', title: 'Two', estimatedDuration: 40, kind: 'manual', role: 'foundation' }, '2026-05-01T00:00:00.000Z'),
      event('RoadmapCreated', scope, roadmapA),
      detached(roadmapA, 'mat-1', '2026-06-03T00:00:00.000Z'),
    ]

    expect(roadmapMaterialPayloads(events, scope, roadmapA).map((m) => m.materialId)).toEqual([
      'mat-2',
    ])
  })

  it('ignores a detach that belongs to another roadmap', () => {
    const scope = roadmapPayload({ slots: undefined, materialIds: [] })
    const events = [
      event('RoadmapCreated', scope, roadmapA),
      attached(roadmapA, 'mat-lib', 60),
      detached(roadmapB, 'mat-lib', '2026-06-03T00:00:00.000Z'),
    ]

    expect(roadmapMaterialPayloads(events, scope, roadmapA).map((m) => m.materialId)).toEqual([
      'mat-lib',
    ])
  })
})

describe('materialUsageLabels', () => {
  const roadmapA = '2026-06-01T00:00:00.000Z'
  const roadmapB = '2026-07-01T00:00:00.000Z'

  function attached(roadmapCreatedAt: string, materialId: string, createdAt: string): Event {
    return event(
      'MaterialAttached',
      {
        roadmapCreatedAt,
        materialId,
        title: 'OSTEP',
        estimatedDuration: 60,
        kind: 'file',
        role: 'foundation',
      },
      createdAt,
    )
  }

  it('names every roadmap whose latest state for the material is attached', () => {
    const events = [
      event('RoadmapCreated', roadmapPayload({ purpose: 'Networks', materialIds: [] }), roadmapA),
      event(
        'RoadmapMarkedComplete',
        { roadmapCreatedAt: roadmapA, resolvedAt: '2026-06-30T00:00:00.000Z' },
        '2026-06-30T00:00:00.000Z',
      ),
      event('RoadmapCreated', roadmapPayload({ purpose: 'Databases', materialIds: [] }), roadmapB),
      attached(roadmapA, 'mat-lib', '2026-06-02T00:00:00.000Z'),
      attached(roadmapB, 'mat-lib', '2026-07-02T00:00:00.000Z'),
    ]

    expect(materialUsageLabels(events, 'mat-lib')).toEqual([
      'Databases · Jul 1, 2026',
      'Networks · Jul 1, 2026',
    ])
  })

  it('drops a roadmap after a detach and returns it on re-attach', () => {
    const scope = roadmapPayload({ purpose: 'Networks', materialIds: [] })
    const events = [
      event('RoadmapCreated', scope, roadmapA),
      attached(roadmapA, 'mat-lib', '2026-06-02T00:00:00.000Z'),
      event('MaterialDetached', { roadmapCreatedAt: roadmapA, materialId: 'mat-lib' }, '2026-06-03T00:00:00.000Z'),
    ]

    expect(materialUsageLabels(events, 'mat-lib')).toEqual([])

    const reattached = [...events, attached(roadmapA, 'mat-lib', '2026-06-04T00:00:00.000Z')]
    expect(materialUsageLabels(reattached, 'mat-lib')).toEqual(['Networks · Jul 1, 2026'])
  })

  it('ignores an unrelated material and an undefined id', () => {
    const scope = roadmapPayload({ purpose: 'Networks', materialIds: [] })
    const events = [
      event('RoadmapCreated', scope, roadmapA),
      attached(roadmapA, 'mat-lib', '2026-06-02T00:00:00.000Z'),
    ]

    expect(materialUsageLabels(events, 'mat-other')).toEqual([])
    expect(materialUsageLabels(events, undefined)).toEqual([])
  })
})

describe('materialTitleIndex', () => {
  it('labels a material that is not in any roadmap set', () => {
    const index = materialTitleIndex([
      event('MaterialAdded', { materialId: 'mat-old', title: 'Old book', estimatedDuration: 30, kind: 'manual', role: 'foundation' }, '2026-05-01T00:00:00.000Z'),
      event('MaterialAttached', { roadmapCreatedAt: '2026-06-01T00:00:00.000Z', materialId: 'mat-lib', title: 'OSTEP', estimatedDuration: 60, kind: 'file', role: 'foundation', url: 'https://example.test/ostep.pdf' }, '2026-06-02T00:00:00.000Z'),
    ])

    expect(index.get('mat-old')).toEqual({ title: 'Old book' })
    expect(index.get('mat-lib')).toEqual({ title: 'OSTEP', url: 'https://example.test/ostep.pdf' })
    expect(index.get('mat-missing')).toBeUndefined()
  })

  it('still labels a detached material, so a booked bubble keeps its title', () => {
    const index = materialTitleIndex([
      event('MaterialAttached', { roadmapCreatedAt: '2026-06-01T00:00:00.000Z', materialId: 'mat-lib', title: 'OSTEP', estimatedDuration: 60, kind: 'file', role: 'foundation' }, '2026-06-02T00:00:00.000Z'),
      event('MaterialDetached', { roadmapCreatedAt: '2026-06-01T00:00:00.000Z', materialId: 'mat-lib' }, '2026-06-03T00:00:00.000Z'),
    ])

    expect(index.get('mat-lib')).toEqual({ title: 'OSTEP' })
  })
})
