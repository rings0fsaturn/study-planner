import { describe, expect, it, vi } from 'vitest'
import type { EventStore } from '../events/EventStore'
import { deriveRoadmapDraft } from './roadmapDraft'

function eventStoreWithDraft(state: Record<string, unknown> | null): EventStore {
  return {
    table: vi.fn(() => ({
      get: vi.fn().mockResolvedValue(state === null ? undefined : { state }),
    })),
  } as unknown as EventStore
}

describe('deriveRoadmapDraft', () => {
  it('returns null when onboarding has not been completed', async () => {
    const eventStore = eventStoreWithDraft({
      deadline: '2026-07-01',
      purpose: 'Networks',
      stepReached: 3,
    })

    await expect(deriveRoadmapDraft(eventStore, false)).resolves.toBeNull()
    expect(eventStore.table).not.toHaveBeenCalled()
  })

  it('returns null when the draft has not passed step 1', async () => {
    const eventStore = eventStoreWithDraft({
      deadline: '2026-07-01',
      purpose: 'Networks',
      stepReached: 1,
    })

    await expect(deriveRoadmapDraft(eventStore, true)).resolves.toBeNull()
  })

  it('returns null when the draft has no deadline', async () => {
    const eventStore = eventStoreWithDraft({
      purpose: 'Networks',
      stepReached: 3,
    })

    await expect(deriveRoadmapDraft(eventStore, true)).resolves.toBeNull()
  })

  it('returns a summary with title fallback and step label', async () => {
    const eventStore = eventStoreWithDraft({
      deadline: '2026-07-01',
      purpose: '   ',
      stepReached: 4,
    })

    await expect(deriveRoadmapDraft(eventStore, true)).resolves.toEqual({
      title: 'Untitled plan',
      stepReached: 4,
      stepLabel: 'Confirm',
    })
  })

  it('labels in-progress material drafts', async () => {
    const eventStore = eventStoreWithDraft({
      deadline: '2026-07-01',
      purpose: 'Graph algorithms',
      stepReached: 3,
    })

    await expect(deriveRoadmapDraft(eventStore, true)).resolves.toEqual({
      title: 'Graph algorithms',
      stepReached: 3,
      stepLabel: 'Materials',
    })
  })
})
