import { describe, expect, it, afterEach } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import Dexie from 'dexie'
import { createEventStore } from '../../events/EventStoreProvider'
import { saveMasteryProjections } from '../../assessments/masteryCache'
import {
  FakeAssessmentClient,
  masteryProjection,
} from '../../assessments/testing/fakeAssessmentClient'
import { useRoadmapFeedback } from './useRoadmapFeedback'

const USER = 'roadmap-feedback-user'
const DB_NAME = `StudyTracker_${USER}`

afterEach(async () => {
  cleanup()
  await Dexie.delete(DB_NAME)
})

describe('useRoadmapFeedback', () => {
  it('is cold with no projections', async () => {
    const eventStore = createEventStore(USER)
    const client = new FakeAssessmentClient()
    const { result } = renderHook(() => useRoadmapFeedback(eventStore, client, ['mat-1']))

    await waitFor(() => expect(result.current.state).toBe('cold'))
    expect(result.current.headline).toBeNull()
    expect(result.current.evidence).toEqual([])
    eventStore.close()
  })

  it('is updated when the cache matches the server projection', async () => {
    const eventStore = createEventStore(USER)
    await saveMasteryProjections(eventStore, [
      masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 }),
    ])
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.8 })])

    const { result } = renderHook(() => useRoadmapFeedback(eventStore, client, ['mat-1']))
    await waitFor(() => expect(result.current.state).toBe('updated'))
    expect(result.current.headline?.materialId).toBe('mat-1')
    expect(result.current.recommendation?.recommendedBand).toBeGreaterThan(0)
    eventStore.close()
  })

  it('is stale when the server has more grades than the cache, and keeps showing the cache', async () => {
    const eventStore = createEventStore(USER)
    await saveMasteryProjections(eventStore, [
      masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.5 }),
    ])
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 5, mastery: 0.6 })])

    const { result } = renderHook(() => useRoadmapFeedback(eventStore, client, ['mat-1']))
    await waitFor(() => expect(result.current.state).toBe('stale'))
    expect(result.current.evidence[0].observations).toBe(4)
    eventStore.close()
  })

  it('rebuild adopts the fresh projection and returns to updated', async () => {
    const eventStore = createEventStore(USER)
    await saveMasteryProjections(eventStore, [
      masteryProjection({ materialId: 'mat-1', n: 4, mastery: 0.5 }),
    ])
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'mat-1', n: 5, mastery: 0.6 })])

    const { result } = renderHook(() => useRoadmapFeedback(eventStore, client, ['mat-1']))
    await waitFor(() => expect(result.current.state).toBe('stale'))

    act(() => result.current.rebuild())
    await waitFor(() => expect(result.current.state).toBe('updated'))
    expect(result.current.evidence[0].observations).toBe(5)
    eventStore.close()
  })

  it('falls back to the cache when the fetch fails', async () => {
    const eventStore = createEventStore(USER)
    await saveMasteryProjections(eventStore, [
      masteryProjection({ materialId: 'mat-1', n: 3, mastery: 0.8 }),
    ])
    const client = new FakeAssessmentClient()
    client.scriptGetMastery(new Error('offline'))

    const { result } = renderHook(() => useRoadmapFeedback(eventStore, client, ['mat-1']))
    await waitFor(() => expect(result.current.state).toBe('updated'))
    expect(result.current.evidence[0].observations).toBe(3)
    eventStore.close()
  })

  it('scopes projections to the roadmap materials', async () => {
    const eventStore = createEventStore(USER)
    const client = new FakeAssessmentClient()
    client.scriptGetMastery([masteryProjection({ materialId: 'other', n: 9, mastery: 0.9 })])

    const { result } = renderHook(() => useRoadmapFeedback(eventStore, client, ['mat-1']))
    await waitFor(() => expect(result.current.state).toBe('cold'))
    expect(result.current.evidence).toEqual([])
    eventStore.close()
  })
})
