import { describe, expect, it } from 'vitest'
import type { Event } from '../../events/EventStore'
import type { RoadmapCreatedPayload } from '../../sync/types'
import { mapToRegenerateRequest } from './mapToRegenerateRequest'

function event(kind: string, payload: unknown, createdAt: string): Event {
  return { kind, payload: payload as Record<string, unknown>, createdAt }
}

function roadmapPayload(overrides: Partial<RoadmapCreatedPayload> = {}): RoadmapCreatedPayload {
  return {
    startDate: '2026-06-01',
    deadline: '2026-06-30',
    weeks: 4,
    purpose: 'Systems exam',
    selectedStudyDays: ['Mon', 'Wed'],
    weekdayHours: 1.5,
    weekendHours: 2,
    weeklyHours: 5,
    slots: [
      {
        weekIndex: 0,
        dayOfWeek: 'Mon',
        date: '2026-06-01',
        capacityMinutes: 90,
        role: 'anchor',
        candidateMaterialIds: ['mat-1'],
        plannedMinutes: 80,
        sessionTitle: 'Read consistency chapter',
      },
      {
        weekIndex: 0,
        dayOfWeek: 'Wed',
        date: '2026-06-03',
        capacityMinutes: 90,
        role: 'practice',
        candidateMaterialIds: ['mat-2'],
        plannedMinutes: 45,
        sessionTitle: 'Practice quorum problems',
      },
    ],
    ...overrides,
  }
}

function baseEvents(): Event[] {
  return [
    event(
      'MaterialAdded',
      {
        materialId: 'mat-1',
        title: 'Distributed Systems',
        estimatedDuration: 300,
        kind: 'article',
        role: 'anchor',
      },
      '2026-05-31T09:00:00.000Z',
    ),
    event(
      'MaterialAdded',
      {
        materialId: 'mat-2',
        title: 'Practice Set',
        estimatedDuration: 180,
        kind: 'manual',
        role: 'practice',
      },
      '2026-05-31T09:05:00.000Z',
    ),
    event('RoadmapCreated', roadmapPayload(), '2026-05-31T10:00:00.000Z'),
  ]
}

describe('mapToRegenerateRequest', () => {
  it('maps materials in MaterialAdded order with exact Python field names', () => {
    const request = mapToRegenerateRequest(baseEvents(), '2026-06-02')

    expect(request.input.materials).toEqual([
      {
        id: 'mat-1',
        title: 'Distributed Systems',
        totalMinutes: 300,
        role: 'anchor',
        additionOrder: 0,
      },
      {
        id: 'mat-2',
        title: 'Practice Set',
        totalMinutes: 180,
        role: 'practice',
        additionOrder: 1,
      },
    ])
    expect(Object.keys(request.input.materials[0])).toEqual([
      'id',
      'title',
      'totalMinutes',
      'role',
      'additionOrder',
    ])
  })

  it('pulls capacity fields from the latest active roadmap payload', () => {
    const request = mapToRegenerateRequest(baseEvents(), '2026-06-02')

    expect(request.input).toMatchObject({
      weeks: 4,
      startDate: '2026-06-01',
      selectedStudyDays: ['Mon', 'Wed'],
      weekdayHours: 1.5,
      weekendHours: 2,
    })
  })

  it('builds completed and today pins from derived slot state', () => {
    const request = mapToRegenerateRequest([
      ...baseEvents(),
      event(
        'SessionLogged',
        {
          sessionId: 'session-1',
          date: '2026-06-01',
          materialId: 'mat-1',
          duration: 82,
          source: 'manual',
        },
        '2026-06-01T12:00:00.000Z',
      ),
    ], '2026-06-03')

    expect(request.pins).toEqual([
      {
        weekIndex: 0,
        dayOfWeek: 'Mon',
        materialId: 'mat-1',
        sessionTitle: 'Read consistency chapter',
        plannedMinutes: 80,
        reason: 'completed',
      },
      {
        weekIndex: 0,
        dayOfWeek: 'Wed',
        materialId: 'mat-2',
        sessionTitle: 'Practice quorum problems',
        plannedMinutes: 45,
        reason: 'today',
      },
    ])
  })

  it('omits user-edited pins until RoadmapEdited events exist', () => {
    const request = mapToRegenerateRequest(baseEvents(), '2026-06-02')

    expect(request.pins.every((pin) => pin.reason !== 'user-edited')).toBe(true)
  })

  it('maps RoadmapEdited events into user-edited pins', () => {
    const request = mapToRegenerateRequest([
      ...baseEvents(),
      event(
        'RoadmapEdited',
        {
          roadmapCreatedAt: '2026-05-31T10:00:00.000Z',
          weekIndex: 0,
          dayOfWeek: 'Wed',
          materialId: 'mat-2',
          sessionTitle: 'Practice quorum problems revised',
          plannedMinutes: 60,
        },
        '2026-06-02T09:00:00.000Z',
      ),
    ], '2026-06-20')

    expect(request.pins).toContainEqual({
      weekIndex: 0,
      dayOfWeek: 'Wed',
      materialId: 'mat-2',
      sessionTitle: 'Practice quorum problems revised',
      plannedMinutes: 60,
      reason: 'user-edited',
    })
  })

  it('matches user-edited pins by original roadmap identity after an in-place replan', () => {
    const originalCreatedAt = '2026-05-31T10:00:00.000Z'
    const replanCreatedAt = '2026-06-10T10:00:00.000Z'
    const request = mapToRegenerateRequest([
      ...baseEvents(),
      event(
        'RoadmapReplanned',
        { ...roadmapPayload({ purpose: 'Replanned' }), roadmapCreatedAt: originalCreatedAt },
        replanCreatedAt,
      ),
      event(
        'RoadmapEdited',
        {
          roadmapCreatedAt: originalCreatedAt,
          weekIndex: 0,
          dayOfWeek: 'Wed',
          materialId: 'mat-2',
          sessionTitle: 'Identity-preserved edit',
          plannedMinutes: 60,
        },
        '2026-06-11T09:00:00.000Z',
      ),
    ], '2026-06-20')

    expect(request.pins).toContainEqual({
      weekIndex: 0,
      dayOfWeek: 'Wed',
      materialId: 'mat-2',
      sessionTitle: 'Identity-preserved edit',
      plannedMinutes: 60,
      reason: 'user-edited',
    })
  })

  it('scopes regenerate materials to the latest active roadmap slots', () => {
    const oldPayload = roadmapPayload({
      purpose: 'Old roadmap',
      startDate: '2026-05-01',
      deadline: '2026-05-31',
      slots: [
        {
          ...roadmapPayload().slots![0],
          date: '2026-05-04',
          candidateMaterialIds: ['old-mat'],
        },
      ],
    })
    const activePayload = roadmapPayload()

    const request = mapToRegenerateRequest([
      event(
        'MaterialAdded',
        {
          materialId: 'old-mat',
          title: 'Old Course',
          estimatedDuration: 90,
          kind: 'manual',
          role: 'foundation',
        },
        '2026-04-30T09:00:00.000Z',
      ),
      event('RoadmapCreated', oldPayload, '2026-04-30T10:00:00.000Z'),
      event(
        'RoadmapMarkedComplete',
        {
          roadmapCreatedAt: '2026-04-30T10:00:00.000Z',
          resolvedAt: '2026-05-31T10:00:00.000Z',
        },
        '2026-05-31T10:00:00.000Z',
      ),
      ...baseEvents(),
      event('RoadmapCreated', activePayload, '2026-05-31T10:00:00.000Z'),
    ], '2026-06-20')

    expect(request.input.materials.map((material) => material.id)).toEqual(['mat-1', 'mat-2'])
  })
})
