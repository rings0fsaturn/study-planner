import { afterEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { createEventStore } from './EventStoreProvider'

describe('EventStoreProvider schema', () => {
  const dbNames: string[] = []

  afterEach(async () => {
    await Promise.all(
      dbNames.splice(0).map(async (name) => {
        await Dexie.delete(name)
      }),
    )
  })

  it('migrates a v4 user database to v5 without losing events', async () => {
    const userId = `migration-${crypto.randomUUID()}`
    const dbName = `StudyTracker_${userId}`
    dbNames.push(dbName)

    const v4Db = new Dexie(dbName)
    v4Db.version(4).stores({
      events: '++id, kind, createdAt',
      sync_queue: '++id, kind, createdAt, retries',
      sync_meta: 'key',
      onboardingDraft: 'id',
      activeSession: 'id',
    })
    await v4Db.open()
    await v4Db.table('events').add({
      kind: 'SessionLogged',
      payload: { duration: 45 },
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    v4Db.close()

    const store = createEventStore(userId)
    const events = await store.getAll()
    await store.table('calibrationCache').put({
      key: 'last',
      state: { globalMultiplier: 1 },
      updatedAt: Date.now(),
    })

    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('SessionLogged')
    await expect(store.table('calibrationCache').get('last')).resolves.toMatchObject({
      key: 'last',
      state: { globalMultiplier: 1 },
    })

    store.close()
  })
})
