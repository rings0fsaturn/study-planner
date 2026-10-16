import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { EventStore } from '../events/EventStore';
import { DurabilityHooks } from '../lib/DurabilityHooks';
import { SyncEngine } from '../sync/SyncEngine';
import type { SupabaseClientLike } from '../sync/types';
import { SessionLifecycle } from './SessionLifecycle';
import type { SessionSlotData } from './types';
import { SESSION_EVENT_KINDS, DEFAULT_POMODORO_CONFIG } from './types';

const DB_NAME = 'StudyTrackerTest-SessionLifecycleSync';

function createFakeSupabase(): SupabaseClientLike {
  return {
    from: () => ({
      insert: () => ({ select: async () => ({ data: [], error: null }) }),
      upsert: () => Promise.resolve({ data: [], error: null }),
      select: () => ({
        eq: () => ({
          order: () => ({ gt: async () => ({ data: [], error: null }), gte: async () => ({ data: [], error: null }) }),
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: 'x' }, error: null }),
        download: async () => ({ data: null, error: new Error('Not found') }),
        list: async () => ({ data: [], error: null }),
      }),
    },
  } as unknown as SupabaseClientLike;
}

const slotData: SessionSlotData = {
  materialId: 'mat-1',
  sessionTitle: 'Practice problems · ch. 5',
  slotDate: '2026-04-29',
  weekIndex: 2,
  plannedMinutes: 60,
};

describe('SessionLifecycle sync wiring (issue 019)', () => {
  let db: Dexie;
  let eventStore: EventStore;
  let durability: DurabilityHooks;
  let engine: SyncEngine;
  let currentTime: Date;

  beforeEach(async () => {
    db = new Dexie(DB_NAME);
    db.version(1).stores({
      events: '++id, kind, createdAt',
      activeSession: 'id',
      sync_queue: '++id, kind, createdAt, retries',
      sync_meta: 'key',
    });
    eventStore = new EventStore(db);
    await db.open();
    await db.table('events').clear();
    await db.table('activeSession').clear();
    await db.table('sync_queue').clear();
    await db.table('sync_meta').clear();
    durability = new DurabilityHooks(document, window);
    currentTime = new Date('2026-04-29T09:00:00Z');
    engine = new SyncEngine(createFakeSupabase(), eventStore, 'user-1', 'client-A', undefined, '');
  });

  afterEach(() => {
    engine.destroy();
    durability.destroy();
    db.close();
  });

  function makeLifecycle() {
    return new SessionLifecycle({
      eventStore,
      logEvent: (kind, payload, createdAt) => engine.logEvent(kind, payload, createdAt),
      durabilityHooks: durability,
      now: () => currentTime,
      pomodoroConfig: DEFAULT_POMODORO_CONFIG,
      audioContext: null,
    });
  }

  async function queueCount(): Promise<number> {
    return eventStore.table('sync_queue').count();
  }

  it('start enqueues SessionStarted', async () => {
    const lc = makeLifecycle();
    await lc.start(slotData);
    expect(await queueCount()).toBe(1);
    lc.destroy();
  });

  it('pause enqueues SessionPaused', async () => {
    const lc = makeLifecycle();
    await lc.start(slotData);
    await lc.pause();
    const kinds = (await eventStore.table('sync_queue').toArray()).map((r: { kind: string }) => r.kind);
    expect(kinds).toContain(SESSION_EVENT_KINDS.STARTED);
    expect(kinds).toContain(SESSION_EVENT_KINDS.PAUSED);
    expect(await queueCount()).toBe(2);
    lc.destroy();
  });

  it('resume enqueues SessionResumed', async () => {
    const lc = makeLifecycle();
    await lc.start(slotData);
    await lc.pause();
    await lc.resume();
    expect(await queueCount()).toBe(3);
    lc.destroy();
  });

  it('end enqueues SessionLogged and keeps activeSession local-only', async () => {
    const lc = makeLifecycle();
    await lc.start(slotData);
    currentTime = new Date('2026-04-29T09:45:00Z');
    await lc.end();
    const queue = await eventStore.table('sync_queue').toArray();
    expect(queue.map((r: { kind: string }) => r.kind).sort()).toEqual(
      [SESSION_EVENT_KINDS.STARTED, SESSION_EVENT_KINDS.LOGGED].sort(),
    );
    // activeSession persistence stays local-only
    expect(await eventStore.table('activeSession').count()).toBe(0);
    lc.destroy();
  });

  it('abandon enqueues SessionAbandoned', async () => {
    const lc = makeLifecycle();
    await lc.start(slotData);
    await lc.resolveWalkAway('discard');
    const kinds = (await eventStore.table('sync_queue').toArray()).map((r: { kind: string }) => r.kind);
    expect(kinds).toContain(SESSION_EVENT_KINDS.ABANDONED);
    lc.destroy();
  });
});

describe('SessionLifecycle cross-device (issue 019 AC2)', () => {
  it('timer-completed session on device A appears on device B after flush + pull', async () => {
    const remote: Array<{
      id: number;
      user_id: string;
      kind: string;
      payload: Record<string, unknown>;
      client_id: string;
      device_local_id: number;
      created_at: string;
    }> = [];
    let nextId = 1;
    const sharedSupabase = {
      from: (table: string) => {
        if (table !== 'events') throw new Error(`Unexpected table: ${table}`);
        return {
          insert: (values: Record<string, unknown> | Record<string, unknown>[]) => ({
            select: async () => {
              const items = Array.isArray(values) ? values : [values];
              const inserted = items.map((v) => ({
                id: nextId++,
                user_id: v.user_id as string,
                kind: v.kind as string,
                payload: v.payload as Record<string, unknown>,
                client_id: v.client_id as string,
                device_local_id: v.device_local_id as number,
                created_at: v.created_at as string,
              }));
              remote.push(...inserted);
              return { data: inserted, error: null };
            },
          }),
          upsert: () => Promise.resolve({ data: [], error: null }),
          select: () => ({
            eq: (_col: string, userId: unknown) => ({
              order: () => ({
                gt: async (_c: string, val: unknown) => ({
                  data: remote.filter((e) => e.user_id === userId && e.id > (val as number)),
                  error: null,
                }),
                gte: async (_c: string, val: unknown) => ({
                  data: remote.filter((e) => e.user_id === userId && e.id >= (val as number)),
                  error: null,
                }),
              }),
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      },
      storage: {
        from: () => ({
          upload: async () => ({ data: { path: 'x' }, error: null }),
          download: async () => ({ data: null, error: new Error('Not found') }),
          list: async () => ({ data: [], error: null }),
        }),
      },
    } as unknown as SupabaseClientLike;

    function deviceDb(name: string): { db: Dexie; store: EventStore } {
      const db = new Dexie(name);
      db.version(1).stores({
        events: '++id, kind, createdAt',
        activeSession: 'id',
        sync_queue: '++id, kind, createdAt, retries',
        sync_meta: 'key',
      });
      return { db, store: new EventStore(db) };
    }

    const a = deviceDb('StudyTrackerTest-SessionSync-A');
    const b = deviceDb('StudyTrackerTest-SessionSync-B');
    await a.db.open();
    await b.db.open();
    const engineA = new SyncEngine(sharedSupabase, a.store, 'user-1', 'client-A', undefined, '');
    const engineB = new SyncEngine(sharedSupabase, b.store, 'user-1', 'client-B', undefined, '');
    const durabilityA = new DurabilityHooks(document, window);
    let now = new Date('2026-04-29T09:00:00Z');

    try {
      const lc = new SessionLifecycle({
        eventStore: a.store,
        logEvent: (kind, payload, createdAt) => engineA.logEvent(kind, payload, createdAt),
        durabilityHooks: durabilityA,
        now: () => now,
        pomodoroConfig: DEFAULT_POMODORO_CONFIG,
        audioContext: null,
      });
      await lc.start(slotData);
      now = new Date('2026-04-29T09:45:00Z');
      await lc.end();
      lc.destroy();

      await engineA.flushQueue();
      const pulled = await engineB.pullAndMerge();
      expect(pulled).toBeGreaterThan(0);

      const eventsB = await b.store.getAll();
      const logged = eventsB.find((e) => e.kind === SESSION_EVENT_KINDS.LOGGED);
      expect(logged).toBeTruthy();
      const eventsA = await a.store.getAll();
      const loggedA = eventsA.find((e) => e.kind === SESSION_EVENT_KINDS.LOGGED);
      expect(logged?.payload.sessionId).toBe(loggedA?.payload.sessionId);
    } finally {
      engineA.destroy();
      engineB.destroy();
      durabilityA.destroy();
      await a.db.table('events').clear();
      await a.db.table('sync_queue').clear();
      await b.db.table('events').clear();
      await b.db.table('sync_queue').clear();
      a.db.close();
      b.db.close();
    }
  });
});
