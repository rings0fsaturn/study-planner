import { describe, expect, it } from 'vitest'
import type { Event } from '../events/EventStore'
import type { RoadmapCreatedPayload } from '../sync/types'
import type { RoadmapLifecycleEntry } from './roadmapLifecycle'
import { summarizeRoadmapProgress } from './roadmapProgress'

function noSlotsRoadmapPayload(overrides: Partial<RoadmapCreatedPayload> = {}): RoadmapCreatedPayload {
  return {
    startDate: '2026-06-01',
    deadline: '2026-07-01',
    weeks: 4,
    purpose: 'Distributed systems',
    selectedStudyDays: ['Mon', 'Wed'],
    weekdayHours: 1,
    weekendHours: 2,
    weeklyHours: 4,
    materialIds: ['mat-1', 'mat-2'],
    ...overrides,
  }
}

function activeEntry(
  roadmapCreatedAt: string,
  payload: RoadmapCreatedPayload = noSlotsRoadmapPayload(),
): RoadmapLifecycleEntry {
  return {
    roadmapCreatedAt,
    eventKind: 'RoadmapCreated',
    status: 'active',
    payload,
    title: payload.purpose ?? 'Roadmap',
    startDate: payload.startDate,
    deadline: payload.deadline,
    weeks: payload.weeks,
    totalSlots: 0,
    completedSlots: 0,
    percentComplete: 0,
  }
}

function event(kind: string, payload: unknown, createdAt: string): Event {
  return { kind, payload: payload as Record<string, unknown>, createdAt }
}

describe('summarizeRoadmapProgress', () => {
  it('computes no-slots progress from bookings, sessions, and the material ledger', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const payload = noSlotsRoadmapPayload()
    const events = [
      event('RoadmapCreated', payload, createdAt),
      event(
        'MaterialAdded',
        {
          materialId: 'mat-1',
          title: 'Concepts',
          estimatedDuration: 100,
          kind: 'manual',
          role: 'foundation',
        },
        '2026-06-01T00:01:00.000Z',
      ),
      event(
        'MaterialAdded',
        {
          materialId: 'mat-2',
          title: 'Practice',
          estimatedDuration: 80,
          kind: 'manual',
          role: 'practice',
        },
        '2026-06-01T00:02:00.000Z',
      ),
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
        'SessionLogged',
        {
          sessionId: 's1',
          date: '2026-06-03',
          materialId: 'mat-1',
          source: 'active',
          bookingId: 'booking-1',
          resolution: 'completed',
          duration: 50,
          activeMinutes: 50,
          materialConsumedMinutes: 100,
        },
        '2026-06-03T12:00:00.000Z',
      ),
      event(
        'SessionLogged',
        {
          sessionId: 's2',
          date: '2026-06-05',
          materialId: 'mat-2',
          source: 'active',
          bookingId: 'booking-2',
          resolution: 'interrupted',
          duration: 20,
          activeMinutes: 20,
          materialConsumedMinutes: 20,
        },
        '2026-06-05T12:00:00.000Z',
      ),
    ]

    expect(summarizeRoadmapProgress(activeEntry(createdAt, payload), events)).toEqual({
      sessionsCount: 1,
      loggedMinutes: 70,
      totalPlannedMinutes: 180,
      toGoMinutes: 60,
      completedSlots: 1,
      totalSlots: 2,
      percentComplete: 50,
    })
  })

  it('uses materialDurationOverrides for no-slots material totals and remaining minutes', () => {
    const createdAt = '2026-06-01T00:00:00.000Z'
    const payload = noSlotsRoadmapPayload({
      materialDurationOverrides: { 'mat-1': 50 },
    })
    const events = [
      event('RoadmapCreated', payload, createdAt),
      event(
        'MaterialAdded',
        {
          materialId: 'mat-1',
          title: 'Concepts',
          estimatedDuration: 100,
          kind: 'manual',
          role: 'foundation',
        },
        '2026-06-01T00:01:00.000Z',
      ),
      event(
        'MaterialAdded',
        {
          materialId: 'mat-2',
          title: 'Practice',
          estimatedDuration: 80,
          kind: 'manual',
          role: 'practice',
        },
        '2026-06-01T00:02:00.000Z',
      ),
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
    ]

    expect(summarizeRoadmapProgress(activeEntry(createdAt, payload), events)).toMatchObject({
      totalPlannedMinutes: 130,
      toGoMinutes: 130,
    })
  })
})
