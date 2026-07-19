import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import Dexie from 'dexie';
import { EventStore } from '../events/EventStore';
import { resolveInitialRestoreSafetyTimeoutMs, SyncProvider } from './SyncProvider';
import { useSync } from './useSync';
import { SyncEngine } from './SyncEngine';
import type { SupabaseClientLike, SyncState } from './types';

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

function createFakeSupabase(): SupabaseClientLike & {
  _events: FakeRemoteEvent[];
  _snapshots: Map<string, Blob>;
  _checkpoints: Map<string, FakeCheckpointRow>;
  _shouldFailNextPush: boolean;
  _shouldFailNextPull: boolean;
} {
  let nextRemoteId = 1;
  const events: FakeRemoteEvent[] = [];
  const snapshots = new Map<string, Blob>();
  const checkpoints = new Map<string, FakeCheckpointRow>();
  const flags = { shouldFailNextPush: false, shouldFailNextPull: false };

  const self = {
    get _events() { return events; },
    get _snapshots() { return snapshots; },
    get _checkpoints() { return checkpoints; },
    get _shouldFailNextPush() { return flags.shouldFailNextPush; },
    set _shouldFailNextPush(v: boolean) { flags.shouldFailNextPush = v; },
    get _shouldFailNextPull() { return flags.shouldFailNextPull; },
    set _shouldFailNextPull(v: boolean) { flags.shouldFailNextPull = v; },

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
  return self as unknown as SupabaseClientLike & {
    _events: FakeRemoteEvent[];
    _snapshots: Map<string, Blob>;
    _checkpoints: Map<string, FakeCheckpointRow>;
    _shouldFailNextPush: boolean;
    _shouldFailNextPull: boolean;
  };
}

const mockLocalStorage: Record<string, string> = {};
vi.spyOn(localStorage, 'getItem').mockImplementation((key) => mockLocalStorage[key] ?? null);
vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => { mockLocalStorage[key] = value; });
vi.spyOn(localStorage, 'clear').mockImplementation(() => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); });

function createEventStore(userId: string): { db: Dexie; eventStore: EventStore } {
  const db = new Dexie(`StudyTrackerTest_SyncProvider_${userId}_${Date.now()}`);
  db.version(1).stores({
    events: '++id, kind, createdAt'
  });
  db.version(2).stores({
    events: '++id, kind, createdAt',
    sync_queue: '++id, kind, createdAt, retries',
    sync_meta: 'key'
  });
  return { db, eventStore: new EventStore(db) };
}

describe('resolveInitialRestoreSafetyTimeoutMs', () => {
  it('falls back to 8000 when unset', () => {
    expect(resolveInitialRestoreSafetyTimeoutMs(undefined)).toBe(8000);
  });

  it('uses a positive numeric env value', () => {
    expect(resolveInitialRestoreSafetyTimeoutMs('3000')).toBe(3000);
  });

  it('falls back to 8000 for non-numeric values', () => {
    expect(resolveInitialRestoreSafetyTimeoutMs('abc')).toBe(8000);
  });

  it('falls back to 8000 for non-positive values', () => {
    expect(resolveInitialRestoreSafetyTimeoutMs('0')).toBe(8000);
    expect(resolveInitialRestoreSafetyTimeoutMs('-100')).toBe(8000);
  });
});

describe('SyncProvider', () => {
  let fakeSupabase: ReturnType<typeof createFakeSupabase>;
  let eventStore: EventStore;
  let db: Dexie;

  beforeEach(async () => {
    fakeSupabase = createFakeSupabase();
    const userId = 'test-user-123';
    const created = createEventStore(userId);
    db = created.db;
    eventStore = created.eventStore;
    await db.open();
    localStorage.clear();
    mockLocalStorage['study_tracker_client_id'] = 'test-client-456';
  });

  afterEach(async () => {
    db.close();
  });

  describe('mount creates engine and provides context', () => {
    it('renders and provides sync context with logEvent, forceSyncNow, syncState', async () => {
      function TestComponent() {
        const { syncState, logEvent, forceSyncNow } = useSync();
        expect(syncState).toBeDefined();
        expect(typeof logEvent).toBe('function');
        expect(typeof forceSyncNow).toBe('function');
        return (
          <div>
            <span data-testid="status">{syncState.status}</span>
            <span data-testid="pending">{syncState.pendingCount}</span>
          </div>
        );
      }

      render(
        <SyncProvider
          supabase={fakeSupabase}
          userId="test-user-123"
          eventStore={eventStore}
        >
          <TestComponent />
        </SyncProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('status')).toBeDefined();
      });
      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('idle');
      });
      expect(screen.getByTestId('pending').textContent).toBe('0');
    });
  });

  describe('restoreFromCloud on mount', () => {
    it('calls restoreFromCloud when mounted', async () => {
      const restoreSpy = vi.spyOn(SyncEngine.prototype, 'restoreFromCloud');

      function TestComponent() {
        useSync();
        return <div>test</div>;
      }

      render(
        <SyncProvider
          supabase={fakeSupabase}
          userId="test-user-123"
          eventStore={eventStore}
        >
          <TestComponent />
        </SyncProvider>
      );

      await waitFor(() => {
        expect(restoreSpy).toHaveBeenCalled();
      });

      restoreSpy.mockRestore();
    });
  });

  describe('initial restore gating', () => {
    it('withholds children behind the boot screen until the initial restore clears', async () => {
      const restoreSpy = vi.spyOn(SyncEngine.prototype, 'restoreFromCloud');

      render(
        <SyncProvider
          supabase={fakeSupabase}
          userId="test-user-123"
          eventStore={eventStore}
        >
          <div data-testid="app-child">app ready</div>
        </SyncProvider>
      );

      expect(screen.getByText('Study Tracker')).toBeInTheDocument();
      expect(screen.queryByTestId('app-child')).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('app-child')).toBeInTheDocument();
      });
      expect(screen.queryByText('Study Tracker')).not.toBeInTheDocument();
      expect(restoreSpy).toHaveBeenCalled();

      restoreSpy.mockRestore();
    });

    it('renders children after the safety timeout when restoreFromCloud never settles', async () => {
      const restoreSpy = vi
        .spyOn(SyncEngine.prototype, 'restoreFromCloud')
        .mockReturnValue(new Promise(() => {}));

      render(
        <SyncProvider
          supabase={fakeSupabase}
          userId="test-user-123"
          eventStore={eventStore}
          initialRestoreSafetyTimeoutMs={20}
        >
          <div data-testid="app-child">app ready</div>
        </SyncProvider>
      );

      expect(screen.getByText('Study Tracker')).toBeInTheDocument();
      expect(screen.queryByTestId('app-child')).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('app-child')).toBeInTheDocument();
      });

      restoreSpy.mockRestore();
    });

    it('ignores stale engine notifications when switching users during initial restore', async () => {
      const engines: SyncEngine[] = [];
      const restoreSpy = vi
        .spyOn(SyncEngine.prototype, 'restoreFromCloud')
        .mockImplementation(function capturePendingRestore(this: SyncEngine) {
          engines.push(this);
          return new Promise(() => {});
        });

      const userA = 'restore-user-a';
      const userB = 'restore-user-b';
      const createdA = createEventStore(userA);
      const createdB = createEventStore(userB);
      await createdA.db.open();
      await createdB.db.open();

      const staleSettledState: SyncState = {
        status: 'idle',
        lastSyncedAt: null,
        lastError: null,
        pendingCount: 0,
        initialRestorePending: false,
      };

      const pendingState: SyncState = {
        ...staleSettledState,
        initialRestorePending: true,
      };

      const notifyEngine = (engine: SyncEngine, state: SyncState) => {
        const notifier = (engine as unknown as {
          onStateChange?: (newState: SyncState) => void;
        }).onStateChange;
        notifier?.(state);
      };

      try {
        const { rerender } = render(
          <SyncProvider
            supabase={fakeSupabase}
            userId={userA}
            eventStore={createdA.eventStore}
          >
            <div data-testid="app-child">app ready</div>
          </SyncProvider>
        );

        await waitFor(() => {
          expect(engines).toHaveLength(1);
        });
        expect(screen.queryByTestId('app-child')).not.toBeInTheDocument();

        act(() => {
          notifyEngine(engines[0], staleSettledState);
        });
        expect(screen.getByTestId('app-child')).toBeInTheDocument();

        rerender(
          <SyncProvider
            supabase={fakeSupabase}
            userId={userB}
            eventStore={createdB.eventStore}
          >
            <div data-testid="app-child">app ready</div>
          </SyncProvider>
        );

        expect(screen.getByText('Study Tracker')).toBeInTheDocument();
        expect(screen.queryByTestId('app-child')).not.toBeInTheDocument();

        await waitFor(() => {
          expect(engines).toHaveLength(2);
        });

        act(() => {
          notifyEngine(engines[0], staleSettledState);
        });

        expect(screen.getByText('Study Tracker')).toBeInTheDocument();
        expect(screen.queryByTestId('app-child')).not.toBeInTheDocument();

        act(() => {
          notifyEngine(engines[1], pendingState);
        });
        expect(screen.queryByTestId('app-child')).not.toBeInTheDocument();

        act(() => {
          notifyEngine(engines[1], staleSettledState);
        });
        expect(screen.getByTestId('app-child')).toBeInTheDocument();
      } finally {
        restoreSpy.mockRestore();
        createdA.db.close();
        createdB.db.close();
      }
    });
  });

  describe('user switch destroys old and creates new', () => {
    it('destroys old engine and creates new one on user change', async () => {
      const destroySpy = vi.spyOn(SyncEngine.prototype, 'destroy');
      const restoreSpy = vi.spyOn(SyncEngine.prototype, 'restoreFromCloud');

      const userA = 'user-a';
      const userB = 'user-b';

      const dbA = new Dexie(`StudyTrackerTest_SyncProvider_${userA}_${Date.now()}`);
      dbA.version(1).stores({ events: '++id, kind, createdAt' });
      dbA.version(2).stores({
        events: '++id, kind, createdAt',
        sync_queue: '++id, kind, createdAt, retries',
        sync_meta: 'key'
      });
      const storeA = new EventStore(dbA);
      await dbA.open();

      const dbB = new Dexie(`StudyTrackerTest_SyncProvider_${userB}_${Date.now()}`);
      dbB.version(1).stores({ events: '++id, kind, createdAt' });
      dbB.version(2).stores({
        events: '++id, kind, createdAt',
        sync_queue: '++id, kind, createdAt, retries',
        sync_meta: 'key'
      });
      const storeB = new EventStore(dbB);
      await dbB.open();

      const { rerender } = render(
        <SyncProvider
          supabase={fakeSupabase}
          userId={userA}
          eventStore={storeA}
        >
          <div>test</div>
        </SyncProvider>
      );

      await waitFor(() => {
        expect(restoreSpy).toHaveBeenCalled();
      });

      const prevRestoreCount = restoreSpy.mock.calls.length;

      rerender(
        <SyncProvider
          supabase={fakeSupabase}
          userId={userB}
          eventStore={storeB}
        >
          <div>test</div>
        </SyncProvider>
      );

      await waitFor(() => {
        expect(destroySpy).toHaveBeenCalled();
      });

      expect(restoreSpy.mock.calls.length).toBe(prevRestoreCount + 1);

      destroySpy.mockRestore();
      restoreSpy.mockRestore();
      dbA.close();
      dbB.close();
    });
  });

  describe('visibilitychange triggers pull after idle', () => {
    it('calls pullAndMerge when tab becomes visible after idle threshold', async () => {
      const pullSpy = vi.spyOn(SyncEngine.prototype, 'pullAndMerge');

      function TestComponent() {
        useSync();
        return <div>test</div>;
      }

      render(
        <SyncProvider
          supabase={fakeSupabase}
          userId="test-user-123"
          eventStore={eventStore}
        >
          <TestComponent />
        </SyncProvider>
      );

      document.dispatchEvent(new Event('visibilitychange'));

      await waitFor(() => {
        expect(pullSpy).toHaveBeenCalled();
      });

      pullSpy.mockRestore();
    });
  });

  describe('pagehide triggers flush', () => {
    it('calls flushOnPageHide on pagehide event', async () => {
      const flushSpy = vi.spyOn(SyncEngine.prototype, 'flushOnPageHide');

      function TestComponent() {
        useSync();
        return <div>test</div>;
      }

      render(
        <SyncProvider
          supabase={fakeSupabase}
          userId="test-user-123"
          eventStore={eventStore}
        >
          <TestComponent />
        </SyncProvider>
      );

      await act(async () => {
        window.dispatchEvent(new Event('pagehide'));
      });

      await waitFor(() => {
        expect(flushSpy).toHaveBeenCalled();
      });

      flushSpy.mockRestore();
    });
  });
});
