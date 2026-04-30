import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { EventStore } from '../events/EventStore';
import { SyncEngine } from './SyncEngine';
import type { SupabaseClientLike, SyncState, SyncOptions } from './types';

interface FakeRemoteEvent {
  id: number;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
  client_id: string;
  device_local_id: number;
  created_at: string;
}

interface FakeCheckpointRow {
  user_id: string;
  as_of_remote_id: number;
  schema_version: number;
  event_count: number;
  created_at: string;
}

function createFakeSupabase(): SupabaseClientLike & { _events: FakeRemoteEvent[]; _shouldFailNextPush: boolean; _shouldFailNextPull: boolean; _snapshots: Map<string, Blob>; _checkpoints: Map<string, FakeCheckpointRow> } {
  let nextRemoteId = 1;
  const events: FakeRemoteEvent[] = [];
  const snapshots = new Map<string, Blob>();
  const checkpoints = new Map<string, FakeCheckpointRow>();
  const flags = { shouldFailNextPush: false, shouldFailNextPull: false };

  const self: SupabaseClientLike & { _events: FakeRemoteEvent[]; _shouldFailNextPush: boolean; _shouldFailNextPull: boolean; _snapshots: Map<string, Blob>; _checkpoints: Map<string, FakeCheckpointRow> } = {
    get _events() { return events; },
    get _shouldFailNextPush() { return flags.shouldFailNextPush; },
    set _shouldFailNextPush(v: boolean) { flags.shouldFailNextPush = v; },
    get _shouldFailNextPull() { return flags.shouldFailNextPull; },
    set _shouldFailNextPull(v: boolean) { flags.shouldFailNextPull = v; },
    get _snapshots() { return snapshots; },
    get _checkpoints() { return checkpoints; },

    from: (table: string) => {
      if (table === 'sync_checkpoints') {
        return {
          insert: (_values: Record<string, unknown> | Record<string, unknown>[]) => ({ select: async () => ({ data: [], error: null }) }),
          upsert: (row: Record<string, unknown>, _options?: Record<string, unknown>) => {
            const fullRow: FakeCheckpointRow = {
              user_id: row.user_id as string,
              as_of_remote_id: row.as_of_remote_id as number,
              schema_version: row.schema_version as number,
              event_count: row.event_count as number,
              created_at: new Date().toISOString(),
            };
            checkpoints.set(fullRow.user_id, fullRow);
            return Promise.resolve({ data: [fullRow as unknown as Record<string, unknown>], error: null });
          },
          select: (_columns?: string) => {
            return {
              eq: (_column: string, value: unknown) => {
                return {
                  order: () => {
                    throw new Error('order not used on sync_checkpoints');
                  },
                  maybeSingle: async () => {
                    const row = checkpoints.get(value as string);
                    return { data: (row as unknown as Record<string, unknown>) ?? null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table !== 'events') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        insert: (values: Record<string, unknown> | Record<string, unknown>[]) => {
          return {
            select: async () => {
              if (flags.shouldFailNextPush) {
                flags.shouldFailNextPush = false;
                return { data: null, error: new Error('Network error') };
              }
              const items = Array.isArray(values) ? values : [values];
              const inserted: FakeRemoteEvent[] = items.map(v => ({
                id: nextRemoteId++,
                user_id: v.user_id as string,
                kind: v.kind as string,
                payload: v.payload as Record<string, unknown>,
                client_id: v.client_id as string,
                device_local_id: v.device_local_id as number,
                created_at: v.created_at as string,
              }));
              events.push(...inserted);
              return { data: inserted as unknown as Array<Record<string, unknown>>, error: null };
            }
          };
        },
        upsert: () => Promise.resolve({ data: [], error: null }),
        select: (_columns?: string) => {
          return {
            eq: (_column: string, value: unknown) => {
              return {
                order: (_column: string, _options?: { ascending?: boolean }) => {
                  return {
                    gt: async (_col: string, val: unknown) => {
                      if (flags.shouldFailNextPull) {
                        flags.shouldFailNextPull = false;
                        return { data: null, error: new Error('Network error') };
                      }
                      const filtered = events
                        .filter(e => e.user_id === value)
                        .filter(e => e.id > (val as number))
                        .sort((a, b) => a.id - b.id);
                      return { data: filtered as unknown as Array<Record<string, unknown>>, error: null };
                    },
                    gte: async (_col: string, val: unknown) => {
                      if (flags.shouldFailNextPull) {
                        flags.shouldFailNextPull = false;
                        return { data: null, error: new Error('Network error') };
                      }
                      const filtered = events
                        .filter(e => e.user_id === value)
                        .filter(e => e.id >= (val as number))
                        .sort((a, b) => a.id - b.id);
                      return { data: filtered as unknown as Array<Record<string, unknown>>, error: null };
                    }
                  };
                },
                maybeSingle: () => {
                  throw new Error('maybeSingle not used on events');
                }
              };
            }
          };
        }
      };
    },

    storage: {
      from: (_bucket: string) => {
        return {
          upload: async (path: string, fileBody: Blob | File | FormData | ArrayBuffer | string) => {
            const blob = fileBody instanceof Blob ? fileBody : new Blob([fileBody as string]);
            snapshots.set(path, blob);
            return { data: { path }, error: null };
          },
          download: async (path: string) => {
            const blob = snapshots.get(path);
            if (!blob) return { data: null, error: new Error('Not found') };
            return { data: blob, error: null };
          },
          list: async (path: string) => {
            const items = Array.from(snapshots.keys())
              .filter(k => k.startsWith(path))
              .map(k => ({ name: k }));
            return { data: items, error: null };
          }
        };
      }
    }
  };
  return self;
}

function createEventStore(userId: string): { db: Dexie; eventStore: EventStore } {
  const db = new Dexie(`StudyTracker_${userId}_SyncTest`);
  db.version(1).stores({
    events: '++id, kind, createdAt',
    sync_queue: '++id, kind, createdAt, retries',
    sync_meta: 'key'
  });
  return { db, eventStore: new EventStore(db) };
}

async function clearDb(db: Dexie) {
  await db.table('events').clear();
  await db.table('sync_queue').clear();
  await db.table('sync_meta').clear();
}

describe('SyncEngine', () => {
  let fakeSupabase: ReturnType<typeof createFakeSupabase>;
  let db: Dexie;
  let eventStore: EventStore;
  const userId = 'test-user-123';
  const clientId = 'test-client-456';
  let stateChanges: SyncState[] = [];

  beforeEach(async () => {
    fakeSupabase = createFakeSupabase();
    const created = createEventStore(userId);
    db = created.db;
    eventStore = created.eventStore;
    await db.open();
    await clearDb(db);
    stateChanges = [];
  });

  function createEngine(opts?: SyncOptions) {
    return new SyncEngine(
      fakeSupabase as unknown as SupabaseClientLike,
      eventStore,
      userId,
      clientId,
      (state) => stateChanges.push(state),
      '',
      opts
    );
  }

  describe('logEvent', () => {
    it('appends to local EventStore and enqueues for push', async () => {
      const engine = createEngine();
      const localId = await engine.logEvent('SessionLogged', { duration: 45 });

      expect(typeof localId).toBe('number');
      expect(localId).toBeGreaterThan(0);

      const events = await eventStore.getAll();
      expect(events).toHaveLength(1);
      expect(events[0].kind).toBe('SessionLogged');
      expect(events[0].payload.duration).toBe(45);

      const queue = await eventStore.table('sync_queue').toArray();
      expect(queue).toHaveLength(1);
      expect(queue[0].kind).toBe('SessionLogged');
      expect(queue[0].localId).toBe(localId);
    });

    it('enqueues multiple events in order', async () => {
      const engine = createEngine();
      await engine.logEvent('SessionLogged', { duration: 30 });
      await engine.logEvent('SessionLogged', { duration: 60 });
      await engine.logEvent('RoadmapCreated', { title: 'My Roadmap' });

      const queue = await eventStore.table('sync_queue').toArray();
      expect(queue).toHaveLength(3);
      expect(queue[0].payload.duration).toBe(30);
      expect(queue[1].payload.duration).toBe(60);
      expect(queue[2].kind).toBe('RoadmapCreated');
    });

    it('queue survives re-initialization', async () => {
      const engine1 = createEngine();
      await engine1.logEvent('SessionLogged', { duration: 45 });

      // Simulate page refresh: create new engine with same store
      createEngine();
      const queue = await eventStore.table('sync_queue').toArray();
      expect(queue).toHaveLength(1);
      expect(queue[0].kind).toBe('SessionLogged');
    });
  });

  describe('flushQueue', () => {
    it('pushes queued events to Supabase and clears queue on success', async () => {
      const engine = createEngine();
      await engine.logEvent('SessionLogged', { duration: 45 });
      await engine.logEvent('SessionLogged', { duration: 60 });

      await engine.flushQueue();

      // Verify remote events
      expect(fakeSupabase._events).toHaveLength(2);
      expect(fakeSupabase._events[0].kind).toBe('SessionLogged');
      expect(fakeSupabase._events[0].device_local_id).toBeGreaterThan(0);
      expect(fakeSupabase._events[0].client_id).toBe(clientId);
      expect(fakeSupabase._events[0].user_id).toBe(userId);

      // Verify queue cleared
      const queue = await eventStore.table('sync_queue').toArray();
      expect(queue).toHaveLength(0);
    });

    it('keeps events in queue on push failure', async () => {
      const engine = createEngine();
      await engine.logEvent('SessionLogged', { duration: 45 });

      fakeSupabase._shouldFailNextPush = true;
      await engine.flushQueue();

      // Remote should be empty
      expect(fakeSupabase._events).toHaveLength(0);

      // Queue should still have the event
      const queue = await eventStore.table('sync_queue').toArray();
      expect(queue).toHaveLength(1);
      expect(queue[0].kind).toBe('SessionLogged');
    });

    it('does nothing when queue is empty', async () => {
      const engine = createEngine();
      await engine.flushQueue();
      expect(fakeSupabase._events).toHaveLength(0);
    });

    it('transitions state to syncing then idle on success', async () => {
      const engine = createEngine();
      await engine.logEvent('SessionLogged', { duration: 45 });

      stateChanges = [];
      await engine.flushQueue();

      const statuses = stateChanges.map(s => s.status);
      expect(statuses).toContain('syncing');
      expect(statuses[statuses.length - 1]).toBe('idle');
    });

    it('transitions state to error on persistent failure', async () => {
      const engine = createEngine({ maxRetries: 0 });
      await engine.logEvent('SessionLogged', { duration: 45 });

      fakeSupabase._shouldFailNextPush = true;
      stateChanges = [];
      await engine.flushQueue();

      const lastState = stateChanges[stateChanges.length - 1];
      expect(lastState.status).toBe('error');
      expect(lastState.lastError).toBeTruthy();
    });
  });

  describe('pullAndMerge', () => {
    it('fetches only events with id > lastPulledId', async () => {
      // Seed remote with events from another device
      fakeSupabase._events.push(
        { id: 1, user_id: userId, kind: 'SessionLogged', payload: { duration: 10 }, client_id: 'other-client', device_local_id: 1, created_at: '2024-01-15T08:00:00Z' },
        { id: 2, user_id: userId, kind: 'SessionLogged', payload: { duration: 20 }, client_id: 'other-client', device_local_id: 2, created_at: '2024-01-15T09:00:00Z' },
        { id: 3, user_id: userId, kind: 'SessionLogged', payload: { duration: 30 }, client_id: 'other-client', device_local_id: 3, created_at: '2024-01-15T10:00:00Z' }
      );

      const engine = createEngine();
      // Set lastPulledId to 1, so only events 2 and 3 should be fetched
      await eventStore.table('sync_meta').put({ key: 'lastPulledId', value: 1 });

      const count = await engine.pullAndMerge();

      expect(count).toBe(2);
      const localEvents = await eventStore.getAll();
      expect(localEvents).toHaveLength(2);
      expect(localEvents[0].payload.duration).toBe(20);
      expect(localEvents[1].payload.duration).toBe(30);
    });

    it('skips events from this device (matching client_id)', async () => {
      fakeSupabase._events.push(
        { id: 1, user_id: userId, kind: 'SessionLogged', payload: { duration: 10 }, client_id: clientId, device_local_id: 1, created_at: '2024-01-15T08:00:00Z' },
        { id: 2, user_id: userId, kind: 'SessionLogged', payload: { duration: 20 }, client_id: 'other-client', device_local_id: 2, created_at: '2024-01-15T09:00:00Z' }
      );

      const engine = createEngine();
      const count = await engine.pullAndMerge();

      expect(count).toBe(1);
      const localEvents = await eventStore.getAll();
      expect(localEvents).toHaveLength(1);
      expect(localEvents[0].payload.duration).toBe(20);
    });

    it('merges new events into local EventStore and updates lastPulledId', async () => {
      fakeSupabase._events.push(
        { id: 5, user_id: userId, kind: 'RoadmapCreated', payload: { title: 'My Roadmap' }, client_id: 'other-client', device_local_id: 10, created_at: '2024-01-15T10:00:00Z' }
      );

      const engine = createEngine();
      const count = await engine.pullAndMerge();

      expect(count).toBe(1);

      // Verify local store
      const localEvents = await eventStore.getAll();
      expect(localEvents).toHaveLength(1);
      expect(localEvents[0].kind).toBe('RoadmapCreated');

      // Verify lastPulledId updated
      const meta = await eventStore.table('sync_meta').get('lastPulledId');
      expect(meta.value).toBe(5);
    });

    it('returns zero when no new events exist', async () => {
      const engine = createEngine();
      const count = await engine.pullAndMerge();
      expect(count).toBe(0);
    });

    it('deduplicates events already present locally', async () => {
      // Event exists both remotely and locally
      fakeSupabase._events.push(
        { id: 1, user_id: userId, kind: 'SessionLogged', payload: { duration: 30 }, client_id: 'other-client', device_local_id: 5, created_at: '2024-01-15T10:00:00Z' }
      );
      // Simulate local event that was already pulled before
      await eventStore.append('SessionLogged', { duration: 30 });
      // Manually insert sync_meta to record we know about remote id 1
      await eventStore.table('sync_meta').put({ key: 'lastPulledId', value: 1 });

      const engine = createEngine();
      const count = await engine.pullAndMerge();

      // Already up to date, no new events
      expect(count).toBe(0);
    });

    it('transitions state to syncing then idle on success', async () => {
      fakeSupabase._events.push(
        { id: 1, user_id: userId, kind: 'SessionLogged', payload: { duration: 30 }, client_id: 'other-client', device_local_id: 1, created_at: '2024-01-15T10:00:00Z' }
      );

      const engine = createEngine();
      stateChanges = [];
      await engine.pullAndMerge();

      const statuses = stateChanges.map(s => s.status);
      expect(statuses).toContain('syncing');
      expect(statuses[statuses.length - 1]).toBe('idle');
    });

    it('transitions state to error on pull failure', async () => {
      fakeSupabase._shouldFailNextPull = true;

      const engine = createEngine();
      stateChanges = [];
      await engine.pullAndMerge();

      const lastState = stateChanges[stateChanges.length - 1];
      expect(lastState.status).toBe('error');
      expect(lastState.lastError).toBeTruthy();
    });
  });

  describe('retry and backoff', () => {
    it('increments retries on push failure', async () => {
      const engine = createEngine({ maxRetries: 5 });
      await engine.logEvent('SessionLogged', { duration: 45 });

      fakeSupabase._shouldFailNextPush = true;
      await engine.flushQueue();

      const queue = await eventStore.table('sync_queue').toArray();
      expect(queue).toHaveLength(1);
      expect(queue[0].retries).toBe(1);
    });

    it('succeeds on manual retry after transient failure', async () => {
      const engine = createEngine({ maxRetries: 5 });
      await engine.logEvent('SessionLogged', { duration: 45 });

      // First attempt fails
      fakeSupabase._shouldFailNextPush = true;
      await engine.flushQueue();
      expect(fakeSupabase._events).toHaveLength(0);

      // Manual retry succeeds
      await engine.flushQueue();

      expect(fakeSupabase._events).toHaveLength(1);
      const queue = await eventStore.table('sync_queue').toArray();
      expect(queue).toHaveLength(0);
    });

    it('gives up after maxRetries and transitions to error', async () => {
      const engine = createEngine({ maxRetries: 2 });
      await engine.logEvent('SessionLogged', { duration: 45 });

      // Initial attempt fails
      fakeSupabase._shouldFailNextPush = true;
      await engine.flushQueue(); // fails, retries = 1

      // Retry 1 fails
      fakeSupabase._shouldFailNextPush = true;
      await engine.flushQueue(); // fails, retries = 2

      // Retry 2 fails — max reached
      fakeSupabase._shouldFailNextPush = true;
      await engine.flushQueue(); // fails, retries = 3, max reached

      const queue = await eventStore.table('sync_queue').toArray();
      expect(queue).toHaveLength(1);
      expect(queue[0].retries).toBe(3);

      const lastState = engine.getState();
      expect(lastState.status).toBe('error');
    });

    it('does not attempt push when maxRetries already exhausted', async () => {
      const engine = createEngine({ maxRetries: 0 });
      await engine.logEvent('SessionLogged', { duration: 45 });

      fakeSupabase._shouldFailNextPush = true;
      await engine.flushQueue(); // initial fails, retries = 1, max reached

      // Reset flag — but engine should not attempt push because max retries reached
      fakeSupabase._shouldFailNextPush = false;
      await engine.flushQueue();

      // Should still have the event in queue (not pushed)
      expect(fakeSupabase._events).toHaveLength(0);
      const queue = await eventStore.table('sync_queue').toArray();
      expect(queue).toHaveLength(1);
    });

    it('queue survives across engine re-initialization', async () => {
      const engine1 = createEngine({ maxRetries: 5 });
      await engine1.logEvent('SessionLogged', { duration: 45 });
      fakeSupabase._shouldFailNextPush = true;
      await engine1.flushQueue();

      // Simulate page refresh
      const engine2 = createEngine();
      const queue = await eventStore.table('sync_queue').toArray();
      expect(queue).toHaveLength(1);
      expect(queue[0].retries).toBe(1);

      // Now succeed with new engine
      fakeSupabase._shouldFailNextPush = false;
      await engine2.flushQueue();

      expect(fakeSupabase._events).toHaveLength(1);
    });
  });

  describe('saveSnapshot', () => {
    it('saves snapshot to storage with correct payload', async () => {
      const engine = createEngine();
      await engine.logEvent('SessionLogged', { duration: 30 });
      await engine.logEvent('SessionLogged', { duration: 45 });

      await engine.saveSnapshot();

      const snapshotKey = `${userId}/snapshot.json`;
      const blob = fakeSupabase._snapshots.get(snapshotKey);
      expect(blob).toBeDefined();

      const text = await blob!.text();
      const payload = JSON.parse(text);

      expect(payload.schemaVersion).toBe(1);
      expect(payload.asOfRemoteId).toBe(0);
      expect(payload.events).toHaveLength(2);
      expect(payload.events[0].kind).toBe('SessionLogged');
      expect(payload.events[0].payload.duration).toBe(30);
      expect(payload.events[1].payload.duration).toBe(45);
    });

    it('tracks asOfRemoteId based on lastPulledId', async () => {
      await eventStore.table('sync_meta').put({ key: 'lastPulledId', value: 5 });

      const engine = createEngine();
      await engine.logEvent('SessionLogged', { duration: 30 });

      await engine.saveSnapshot();

      const snapshotKey = `${userId}/snapshot.json`;
      const blob = fakeSupabase._snapshots.get(snapshotKey)!;
      const payload = JSON.parse(await blob.text());

      expect(payload.asOfRemoteId).toBe(5);
    });
  });

  describe('restoreFromCloud', () => {
    it('restores local events from snapshot', async () => {
      const snapshotData = {
        schemaVersion: 1,
        asOfRemoteId: 10,
        asOfCreatedAt: '2024-01-15T10:00:00Z',
        events: [
          { kind: 'SessionLogged', payload: { duration: 30 }, createdAt: '2024-01-15T08:00:00Z', clientId: 'other', deviceLocalId: 1 },
          { kind: 'RoadmapCreated', payload: { title: 'My Roadmap' }, createdAt: '2024-01-15T09:00:00Z', clientId: 'other', deviceLocalId: 2 }
        ]
      };
      const blob = new Blob([JSON.stringify(snapshotData)], { type: 'application/json' });
      fakeSupabase._snapshots.set(`${userId}/snapshot.json`, blob);
      fakeSupabase._checkpoints.set(userId, {
        user_id: userId,
        as_of_remote_id: 10,
        schema_version: 1,
        event_count: 2,
        created_at: '2024-01-15T10:00:00Z',
      });

      const engine = createEngine();
      await engine.restoreFromCloud();

      const localEvents = await eventStore.getAll();
      expect(localEvents).toHaveLength(2);
      expect(localEvents[0].kind).toBe('SessionLogged');
      expect(localEvents[1].kind).toBe('RoadmapCreated');

      const meta = await eventStore.table('sync_meta').get('lastPulledId');
      expect(meta.value).toBe(10);
    });

    it('pulls newer remote events after restore', async () => {
      fakeSupabase._events.push(
        { id: 11, user_id: userId, kind: 'SessionLogged', payload: { duration: 60 }, client_id: 'other-client', device_local_id: 3, created_at: '2024-01-15T11:00:00Z' }
      );

      const snapshotData = {
        schemaVersion: 1,
        asOfRemoteId: 10,
        asOfCreatedAt: '2024-01-15T10:00:00Z',
        events: [
          { kind: 'SessionLogged', payload: { duration: 30 }, createdAt: '2024-01-15T08:00:00Z', clientId: 'other', deviceLocalId: 1 }
        ]
      };
      const blob = new Blob([JSON.stringify(snapshotData)], { type: 'application/json' });
      fakeSupabase._snapshots.set(`${userId}/snapshot.json`, blob);
      fakeSupabase._checkpoints.set(userId, {
        user_id: userId,
        as_of_remote_id: 10,
        schema_version: 1,
        event_count: 1,
        created_at: '2024-01-15T10:00:00Z',
      });

      const engine = createEngine();
      await engine.restoreFromCloud();

      const localEvents = await eventStore.getAll();
      expect(localEvents).toHaveLength(2);
      expect(localEvents[1].payload.duration).toBe(60);
    });

    it('handles missing snapshot gracefully', async () => {
      const engine = createEngine();
      await engine.logEvent('SessionLogged', { duration: 30 });

      await engine.restoreFromCloud();

      const localEvents = await eventStore.getAll();
      expect(localEvents).toHaveLength(1);
    });

    it('refuses snapshot with future schemaVersion', async () => {
      const snapshotData = {
        schemaVersion: 999,
        asOfRemoteId: 10,
        asOfCreatedAt: '2024-01-15T10:00:00Z',
        events: [
          { kind: 'SessionLogged', payload: { duration: 30 }, createdAt: '2024-01-15T08:00:00Z', clientId: 'other', deviceLocalId: 1 }
        ]
      };
      const blob = new Blob([JSON.stringify(snapshotData)], { type: 'application/json' });
      fakeSupabase._snapshots.set(`${userId}/snapshot.json`, blob);
      fakeSupabase._checkpoints.set(userId, {
        user_id: userId,
        as_of_remote_id: 10,
        schema_version: 999,
        event_count: 1,
        created_at: '2024-01-15T10:00:00Z',
      });

      const engine = createEngine();
      await engine.restoreFromCloud();

      const localEvents = await eventStore.getAll();
      expect(localEvents).toHaveLength(0);

      const state = engine.getState();
      expect(state.status).toBe('error');
      expect(state.lastError).toContain('schema v999');
    });
  });

  describe('snapshot scheduling', () => {
    it('triggers snapshot after snapshotInterval writes', async () => {
      const engine = createEngine({ snapshotInterval: 3, snapshotDebounceMs: 0 });

      await engine.logEvent('SessionLogged', { duration: 30 });
      await engine.logEvent('SessionLogged', { duration: 45 });
      await engine.logEvent('SessionLogged', { duration: 60 });

      // Wait for debounced snapshot timer to fire
      await new Promise(resolve => setTimeout(resolve, 10));

      const snapshotKey = `${userId}/snapshot.json`;
      const blob = fakeSupabase._snapshots.get(snapshotKey);
      expect(blob).toBeDefined();
    });

    it('does not trigger snapshot before interval reached', async () => {
      const engine = createEngine({ snapshotInterval: 5, snapshotDebounceMs: 0 });

      await engine.logEvent('SessionLogged', { duration: 30 });
      await engine.logEvent('SessionLogged', { duration: 45 });

      // Wait to ensure no snapshot was triggered
      await new Promise(resolve => setTimeout(resolve, 10));

      const snapshotKey = `${userId}/snapshot.json`;
      const blob = fakeSupabase._snapshots.get(snapshotKey);
      expect(blob).toBeUndefined();
    });
  });
});
