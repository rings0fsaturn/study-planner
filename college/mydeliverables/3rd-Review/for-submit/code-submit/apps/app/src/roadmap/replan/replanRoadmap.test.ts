import { describe, expect, it, vi } from 'vitest'
import type { RoadmapOutput } from '@study-tracker/roadmap-engine'
import type { Event } from '../../events/EventStore'
import { RoadmapServiceError } from '../../lib/intelligenceClient'
import type { RoadmapCreatedPayload } from '../../sync/types'
import { replanRoadmap } from './replanRoadmap'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}))

function event(kind: string, payload: unknown, createdAt: string): Event {
  return { kind, payload: payload as Record<string, unknown>, createdAt }
}

function roadmapPayload(): RoadmapCreatedPayload {
  return {
    startDate: '2026-06-01',
    deadline: '2026-06-30',
    weeks: 4,
    purpose: 'Systems exam',
    selectedStudyDays: ['Mon'],
    weekdayHours: 1,
    weekendHours: 0,
    weeklyHours: 1,
    slots: [
      {
        weekIndex: 0,
        dayOfWeek: 'Mon',
        date: '2026-06-01',
        capacityMinutes: 60,
        role: 'anchor',
        candidateMaterialIds: ['mat-1'],
        plannedMinutes: 60,
        sessionTitle: 'Read chapter',
      },
    ],
  }
}

function baseEvents(): Event[] {
  return [
    event(
      'MaterialAdded',
      {
        materialId: 'mat-1',
        title: 'Distributed Systems',
        estimatedDuration: 120,
        kind: 'article',
        role: 'anchor',
      },
      '2026-05-31T09:00:00.000Z',
    ),
    event('RoadmapCreated', roadmapPayload(), '2026-05-31T10:00:00.000Z'),
  ]
}

function roadmapOutput(): RoadmapOutput {
  return {
    weeks: [
      {
        weekIndex: 0,
        startDate: '2026-06-01',
        slots: [
          {
            weekIndex: 0,
            dayOfWeek: 'Mon',
            date: '2026-06-01',
            capacityMinutes: 60,
            role: 'anchor',
            candidateMaterialIds: ['mat-1'],
            plannedMinutes: 60,
            sessionTitle: 'Read chapter revised',
          },
        ],
      },
    ],
    warnings: [],
    capacityCheck: {
      totalCapacityMinutes: 60,
      totalMaterialMinutes: 60,
      status: 'fits',
    },
  }
}

describe('replanRoadmap', () => {
  it('runtime-validates malformed regenerate responses as typed roadmap errors', async () => {
    const transport = vi.fn().mockResolvedValue({ weeks: 'not-an-array', warnings: [] })

    await expect(
      replanRoadmap(baseEvents(), { today: '2026-06-02', transport }),
    ).rejects.toBeInstanceOf(RoadmapServiceError)
  })

  it('returns a well-formed regenerated roadmap output', async () => {
    const output = roadmapOutput()
    const transport = vi.fn().mockResolvedValue(output)

    await expect(
      replanRoadmap(baseEvents(), { today: '2026-06-02', transport }),
    ).resolves.toBe(output)
  })
})
