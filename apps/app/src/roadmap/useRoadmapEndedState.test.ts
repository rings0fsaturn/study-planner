import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Event } from '../events/EventStore'
import type { RoadmapCreatedPayload } from '../sync/types'
import { deriveRoadmapEndedState, useRoadmapEndedState } from './useRoadmapEndedState'

const hookState = vi.hoisted(() => ({
  events: [] as Event[],
}))

vi.mock('../events/useEventStore', () => ({
  useEventStore: () => ({
    getAll: vi.fn().mockResolvedValue(hookState.events),
  }),
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => hookState.events,
}))

function roadmapPayload(overrides: Partial<RoadmapCreatedPayload> = {}): RoadmapCreatedPayload {
  return {
    startDate: '2026-05-01',
    deadline: '2026-06-01',
    weeks: 4,
    purpose: 'Algorithms',
    selectedStudyDays: ['Mon'],
    weekdayHours: 1,
    weekendHours: 0,
    weeklyHours: 1,
    slots: [],
    ...overrides,
  }
}

function event(kind: string, payload: unknown, createdAt: string): Event {
  return { kind, payload: payload as Record<string, unknown>, createdAt }
}

describe('deriveRoadmapEndedState', () => {
  beforeEach(() => {
    hookState.events = []
  })

  it('returns ended for an active plan with a past deadline', () => {
    const state = deriveRoadmapEndedState([
      event('RoadmapCreated', roadmapPayload(), '2026-05-01T00:00:00.000Z'),
    ], '2026-06-02')

    expect(state.ended).toBe(true)
    expect(state.entry?.title).toBe('Algorithms')
  })

  it('returns not ended for an active plan with a future deadline', () => {
    const state = deriveRoadmapEndedState([
      event('RoadmapCreated', roadmapPayload({ deadline: '2026-06-10' }), '2026-05-01T00:00:00.000Z'),
    ], '2026-06-02')

    expect(state.ended).toBe(false)
    expect(state.entry?.title).toBe('Algorithms')
  })

  it('returns not ended for a completed plan with a past deadline', () => {
    const roadmapCreatedAt = '2026-05-01T00:00:00.000Z'
    const state = deriveRoadmapEndedState([
      event('RoadmapCreated', roadmapPayload(), roadmapCreatedAt),
      event(
        'RoadmapMarkedComplete',
        { roadmapCreatedAt, resolvedAt: '2026-06-02T00:00:00.000Z' },
        '2026-06-02T00:00:00.000Z',
      ),
    ], '2026-06-03')

    expect(state.ended).toBe(false)
    expect(state.entry).toBeNull()
  })

  it('useRoadmapEndedState returns the active ended entry from live events', () => {
    hookState.events = [
      event('RoadmapCreated', roadmapPayload({ deadline: '2026-06-01' }), '2026-05-01T00:00:00.000Z'),
    ]

    const { result } = renderHook(() => useRoadmapEndedState())

    expect(result.current.ended).toBe(true)
    expect(result.current.entry?.title).toBe('Algorithms')
  })
})
