import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import Dexie from 'dexie'
import { EventStore } from '../events/EventStore'
import { SyncProvider } from '../sync/SyncProvider'
import type { SupabaseClientLike } from '../sync/types'
import { DevSeeder } from './DevSeeder'

const { mockUseEventStoreContext } = vi.hoisted(() => ({ mockUseEventStoreContext: vi.fn() }))

vi.mock('../events/EventStoreProvider', () => ({
  useEventStoreContext: mockUseEventStoreContext,
  EventStoreProvider: ({ children }: { children: React.ReactNode }) => children,
}))

function createFakeSupabase(): SupabaseClientLike {
  return {
    from: (table: string) => {
      if (table === 'sync_checkpoints') {
        return {
          insert: () => ({ select: async () => ({ data: [], error: null }) }),
          upsert: () => Promise.resolve({ data: [], error: null }),
          select: () => ({
            eq: () => ({
              order: () => { throw new Error('unused') },
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }
      }
      return {
        insert: () => ({ select: async () => ({ data: [], error: null }) }),
        upsert: () => Promise.resolve({ data: [], error: null }),
        select: () => ({
          eq: () => ({
            order: () => ({
              gt: async () => ({ data: [], error: null }),
              gte: async () => ({ data: [], error: null }),
            }),
            maybeSingle: () => { throw new Error('unused') },
          }),
        }),
      }
    },
    storage: {
      from: () => ({
        upload: async (path: string) => ({ data: { path }, error: null }),
        download: async () => ({ data: null, error: new Error('Not found') }),
        list: async () => ({ data: [], error: null }),
      }),
    },
  } as unknown as SupabaseClientLike
}

describe('DevSeeder __seedSynth sync routing', () => {
  let db: Dexie
  let eventStore: EventStore

  beforeEach(async () => {
    db = new Dexie(`StudyTrackerTest_DevSeeder_${Date.now()}_${Math.floor(Math.random() * 1e6)}`)
    db.version(1).stores({ events: '++id, kind, createdAt' })
    db.version(2).stores({
      events: '++id, kind, createdAt',
      sync_queue: '++id, kind, createdAt, retries',
      sync_meta: 'key',
    })
    await db.open()
    eventStore = new EventStore(db)
    mockUseEventStoreContext.mockReturnValue({ eventStore, ready: true })
  })

  afterEach(async () => {
    delete (window as Partial<Window>).__seed
    delete (window as Partial<Window>).__wipe
    delete (window as Partial<Window>).__seedSynth
    delete (window as Partial<Window>).__wipeSynth
    db.close()
    await Dexie.delete(db.name)
  })

  it('inside SyncProvider: seeds through the sync queue with createdAt preserved', async () => {
    const { unmount } = render(
      <SyncProvider supabase={createFakeSupabase()} userId="synth-test-user" eventStore={eventStore}>
        <DevSeeder />
      </SyncProvider>,
    )
    await waitFor(() => expect(window.__seedSynth).toBeDefined())
    await act(async () => {
      await window.__seedSynth('steady', ['m1', 'm2', 'm3'], '2026-08-10')
    })
    const events = await eventStore.getAll()
    const queue = await eventStore.table('sync_queue').toArray()
    expect(events.length).toBeGreaterThan(0)
    expect(queue.length).toBe(events.length)
    const eventTimes = events.map((e) => e.createdAt).sort()
    const queueTimes = queue.map((q: { createdAt: string }) => q.createdAt).sort()
    expect(queueTimes).toEqual(eventTimes)
    unmount()
  })

  it('outside SyncProvider: falls back to local-only bulkAppend without crashing', async () => {
    const { unmount } = render(<DevSeeder />)
    await waitFor(() => expect(window.__seedSynth).toBeDefined())
    await act(async () => {
      await window.__seedSynth('steady', ['m1', 'm2', 'm3'], '2026-08-10')
    })
    const events = await eventStore.getAll()
    const queue = await eventStore.table('sync_queue').toArray()
    expect(events.length).toBeGreaterThan(0)
    expect(queue.length).toBe(0)
    unmount()
  })

  it('__wipeSynth drains the sync queue so wiped events cannot resurrect in cloud', async () => {
    const { unmount } = render(
      <SyncProvider supabase={createFakeSupabase()} userId="synth-test-user" eventStore={eventStore}>
        <DevSeeder />
      </SyncProvider>,
    )
    await waitFor(() => expect(window.__seedSynth).toBeDefined())
    await act(async () => {
      await window.__seedSynth('steady', ['m1', 'm2', 'm3'], '2026-08-10')
    })
    expect((await eventStore.table('sync_queue').toArray()).length).toBeGreaterThan(0)
    await act(async () => {
      await window.__wipeSynth()
    })
    expect(await eventStore.getAll()).toHaveLength(0)
    expect(await eventStore.table('sync_queue').toArray()).toHaveLength(0)
    unmount()
  })
})
