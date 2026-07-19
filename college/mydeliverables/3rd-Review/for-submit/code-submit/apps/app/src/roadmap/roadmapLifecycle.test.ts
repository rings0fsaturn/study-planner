import { describe, expect, it } from 'vitest'
import type { Event } from '../events/EventStore'
import type { RoadmapCreatedPayload } from '../sync/types'
import { deriveRoadmapLifecycle } from './roadmapLifecycle'

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
      {
        date: '2026-06-05',
        dayOfWeek: 'Fri',
        weekIndex: 0,
        plannedMinutes: 45,
        capacityMinutes: 45,
        candidateMaterialIds: ['mat-2'],
        role: 'practice',
        sessionTitle: 'Problem set',
      },
    ],
    ...overrides,
  }
}

function noSlotsRoadmapPayload(overrides: Partial<RoadmapCreatedPayload> = {}): RoadmapCreatedPayload {
  const payload = roadmapPayload({
    materialIds: ['mat-1', 'mat-2'],
    ...overrides,
  })
  delete payload.slots
  return payload
}

function event(
  kind: string,
  payload: unknown,
  createdAt: string,
): Event {
  return { kind, payload: payload as Record<string, unknown>, createdAt }
}

describe('roadmapLifecycle', () => {
  it('classifies the latest roadmap as active when no terminal event exists', () => {
    const groups = deriveRoadmapLifecycle([
      event('RoadmapCreated', roadmapPayload(), '2026-06-01T00:00:00.000Z'),
    ])

    expect(groups.active).toHaveLength(1)
    expect(groups.active[0]).toMatchObject({
      roadmapCreatedAt: '2026-06-01T00:00:00.000Z',
      status: 'active',
      title: 'Distributed systems',
      weeks: 4,
      percentComplete: 0,
    })
  })

  it('classifies a roadmap as completed by its matching terminal event', () => {
    const groups = deriveRoadmapLifecycle([
      event('RoadmapCreated', roadmapPayload(), '2026-06-01T00:00:00.000Z'),
      event(
        'RoadmapMarkedComplete',
        {
          roadmapCreatedAt: '2026-06-01T00:00:00.000Z',
          resolvedAt: '2026-06-20T00:00:00.000Z',
        },
        '2026-06-20T00:00:00.000Z',
      ),
    ])

    expect(groups.active).toHaveLength(0)
    expect(groups.completed).toHaveLength(1)
    expect(groups.completed[0].resolvedAt).toBe('2026-06-20T00:00:00.000Z')
  })

  it('classifies a roadmap as abandoned by its matching terminal event', () => {
    const groups = deriveRoadmapLifecycle([
      event('RoadmapCreated', roadmapPayload(), '2026-06-01T00:00:00.000Z'),
      event(
        'RoadmapMarkedAbandoned',
        {
          roadmapCreatedAt: '2026-06-01T00:00:00.000Z',
          resolvedAt: '2026-06-15T00:00:00.000Z',
          reason: 'Changed exam plan',
        },
        '2026-06-15T00:00:00.000Z',
      ),
    ])

    expect(groups.abandoned).toHaveLength(1)
    expect(groups.abandoned[0]).toMatchObject({
      status: 'abandoned',
      reason: 'Changed exam plan',
    })
  })

  it('collapses a replan chain into one active entry', () => {
    const originalCreatedAt = '2026-06-01T00:00:00.000Z'
    const groups = deriveRoadmapLifecycle([
      event('RoadmapCreated', roadmapPayload({ purpose: 'Original' }), originalCreatedAt),
      event(
        'RoadmapReplanned',
        { ...roadmapPayload({ purpose: 'Replanned once' }), roadmapCreatedAt: originalCreatedAt },
        '2026-06-10T00:00:00.000Z',
      ),
      event(
        'RoadmapReplanned',
        { ...roadmapPayload({ purpose: 'Replanned latest' }), roadmapCreatedAt: originalCreatedAt },
        '2026-06-15T00:00:00.000Z',
      ),
    ])

    expect(groups.active).toHaveLength(1)
    expect(groups.active[0].roadmapCreatedAt).toBe(originalCreatedAt)
    expect(groups.active[0].title).toBe('Replanned latest')
    expect(groups.active[0].payload.purpose).toBe('Replanned latest')
    expect(groups.all).toHaveLength(1)
  })

  it('marks a collapsed replan chain completed by the original identity', () => {
    const originalCreatedAt = '2026-06-01T00:00:00.000Z'
    const groups = deriveRoadmapLifecycle([
      event('RoadmapCreated', roadmapPayload({ purpose: 'Original' }), originalCreatedAt),
      event(
        'RoadmapReplanned',
        { ...roadmapPayload({ purpose: 'Replanned latest' }), roadmapCreatedAt: originalCreatedAt },
        '2026-06-15T00:00:00.000Z',
      ),
      event(
        'RoadmapMarkedComplete',
        {
          roadmapCreatedAt: originalCreatedAt,
          resolvedAt: '2026-06-20T00:00:00.000Z',
        },
        '2026-06-20T00:00:00.000Z',
      ),
    ])

    expect(groups.active).toHaveLength(0)
    expect(groups.completed).toHaveLength(1)
    expect(groups.completed[0]).toMatchObject({
      roadmapCreatedAt: originalCreatedAt,
      status: 'completed',
      title: 'Replanned latest',
      resolvedAt: '2026-06-20T00:00:00.000Z',
    })
  })

  it('keeps two distinct original roadmaps with the older completed', () => {
    const firstCreatedAt = '2026-06-01T00:00:00.000Z'
    const secondCreatedAt = '2026-07-01T00:00:00.000Z'
    const groups = deriveRoadmapLifecycle([
      event('RoadmapCreated', roadmapPayload({ purpose: 'First' }), firstCreatedAt),
      event(
        'RoadmapMarkedComplete',
        {
          roadmapCreatedAt: firstCreatedAt,
          resolvedAt: '2026-06-20T00:00:00.000Z',
        },
        '2026-06-20T00:00:00.000Z',
      ),
      event(
        'RoadmapCreated',
        roadmapPayload({
          purpose: 'Second',
          startDate: '2026-07-01',
          deadline: '2026-08-01',
        }),
        secondCreatedAt,
      ),
    ])

    expect(groups.active.map((entry) => entry.roadmapCreatedAt)).toEqual([secondCreatedAt])
    expect(groups.completed.map((entry) => entry.roadmapCreatedAt)).toEqual([firstCreatedAt])
    expect(groups.all.map((entry) => entry.status)).not.toContain('superseded')
  })

  it('does not count sessions outside a roadmap window toward progress', () => {
    const base = roadmapPayload()
    const groups = deriveRoadmapLifecycle([
      event(
        'RoadmapCreated',
        roadmapPayload({
          startDate: '2026-01-01',
          deadline: '2026-01-31',
          slots: [{ ...base.slots![0], date: '2026-04-01' }],
        }),
        '2026-01-01T00:00:00.000Z',
      ),
      event(
        'SessionLogged',
        {
          sessionId: 's1',
          date: '2026-04-01',
          materialId: 'mat-1',
          duration: 60,
        },
        '2026-04-01T12:00:00.000Z',
      ),
    ])

    expect(groups.active[0].completedSlots).toBe(0)
    expect(groups.active[0].percentComplete).toBe(0)
  })

  it('counts sessions only inside each roadmap window', () => {
    const base = roadmapPayload()
    const firstCreatedAt = '2026-06-01T00:00:00.000Z'
    const secondCreatedAt = '2026-07-01T00:00:00.000Z'
    const groups = deriveRoadmapLifecycle([
      event(
        'RoadmapCreated',
        roadmapPayload({
          purpose: 'First',
          startDate: '2026-06-01',
          deadline: '2026-06-30',
          slots: [{ ...base.slots![0], date: '2026-06-03' }],
        }),
        firstCreatedAt,
      ),
      event(
        'SessionLogged',
        {
          sessionId: 'june-session',
          date: '2026-06-03',
          materialId: 'mat-1',
          duration: 60,
        },
        '2026-06-03T12:00:00.000Z',
      ),
      event(
        'RoadmapMarkedComplete',
        {
          roadmapCreatedAt: firstCreatedAt,
          resolvedAt: '2026-06-30T00:00:00.000Z',
        },
        '2026-06-30T00:00:00.000Z',
      ),
      event(
        'RoadmapCreated',
        roadmapPayload({
          purpose: 'Second',
          startDate: '2026-07-01',
          deadline: '2026-07-31',
          slots: [{ ...base.slots![0], date: '2026-07-03' }],
        }),
        secondCreatedAt,
      ),
      event(
        'SessionLogged',
        {
          sessionId: 'july-session',
          date: '2026-07-03',
          materialId: 'mat-1',
          duration: 60,
        },
        '2026-07-03T12:00:00.000Z',
      ),
    ])

    expect(groups.completed[0]).toMatchObject({
      roadmapCreatedAt: firstCreatedAt,
      completedSlots: 1,
      percentComplete: 100,
    })
    expect(groups.active[0]).toMatchObject({
      roadmapCreatedAt: secondCreatedAt,
      completedSlots: 1,
      percentComplete: 100,
    })
  })

  it('groups multiple historical roadmaps and computes slot completion percent', () => {
    const groups = deriveRoadmapLifecycle([
      event('RoadmapCreated', roadmapPayload({ purpose: 'First' }), '2026-06-01T00:00:00.000Z'),
      event(
        'SessionLogged',
        {
          sessionId: 's1',
          date: '2026-06-03',
          materialId: 'mat-1',
          duration: 60,
        },
        '2026-06-03T12:00:00.000Z',
      ),
      event(
        'RoadmapMarkedComplete',
        {
          roadmapCreatedAt: '2026-06-01T00:00:00.000Z',
          resolvedAt: '2026-06-20T00:00:00.000Z',
        },
        '2026-06-20T00:00:00.000Z',
      ),
      event('RoadmapCreated', roadmapPayload({ purpose: 'Second' }), '2026-07-01T00:00:00.000Z'),
      event(
        'RoadmapMarkedAbandoned',
        {
          roadmapCreatedAt: '2026-07-01T00:00:00.000Z',
          resolvedAt: '2026-07-04T00:00:00.000Z',
        },
        '2026-07-04T00:00:00.000Z',
      ),
      event('RoadmapReplanned', roadmapPayload({ purpose: 'Current' }), '2026-07-10T00:00:00.000Z'),
    ])

    expect(groups.completed.map((entry) => entry.title)).toEqual(['First'])
    expect(groups.completed[0].percentComplete).toBe(50)
    expect(groups.abandoned.map((entry) => entry.title)).toEqual(['Second'])
    expect(groups.active.map((entry) => entry.title)).toEqual(['Current'])
  })

  it('computes no-slots progress from booking events', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const groups = deriveRoadmapLifecycle([
      event('RoadmapCreated', noSlotsRoadmapPayload(), createdAt),
      event(
        'SessionBooked',
        {
          roadmapCreatedAt: createdAt,
          bookingId: 'booking-1',
          date: '2026-06-03',
          estimatedDuration: 60,
          materialId: 'mat-1',
        },
        '2026-06-01T00:10:00.000Z',
      ),
      event(
        'SessionBooked',
        {
          roadmapCreatedAt: createdAt,
          bookingId: 'booking-2',
          date: '2026-06-05',
          estimatedDuration: 45,
          materialId: 'mat-2',
        },
        '2026-06-01T00:20:00.000Z',
      ),
      event(
        'SessionBooked',
        {
          roadmapCreatedAt: createdAt,
          bookingId: 'cleared-booking',
          date: '2026-06-07',
          estimatedDuration: 30,
        },
        '2026-06-01T00:30:00.000Z',
      ),
      event(
        'BookingCleared',
        {
          roadmapCreatedAt: createdAt,
          bookingId: 'cleared-booking',
        },
        '2026-06-01T00:40:00.000Z',
      ),
      event(
        'SessionLogged',
        {
          sessionId: 's1',
          date: '2026-06-03',
          materialId: 'mat-1',
          bookingId: 'booking-1',
          resolution: 'completed',
          duration: 60,
        },
        '2026-06-03T12:00:00.000Z',
      ),
      event(
        'SessionLogged',
        {
          sessionId: 's2',
          date: '2026-06-05',
          materialId: 'mat-2',
          bookingId: 'booking-2',
          resolution: 'interrupted',
          duration: 20,
        },
        '2026-06-05T12:00:00.000Z',
      ),
    ])

    expect(groups.active).toHaveLength(1)
    expect(groups.active[0].payload.slots).toBeUndefined()
    expect(groups.active[0]).toMatchObject({
      totalSlots: 2,
      completedSlots: 1,
      percentComplete: 50,
    })
  })
})
