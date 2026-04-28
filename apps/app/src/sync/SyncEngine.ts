import type { EventStore } from '../events/EventStore';
import type { SupabaseClientLike, SyncState, SyncOptions, QueuedEvent, SyncMeta, SnapshotPayload } from './types';

const DEFAULT_OPTIONS: Required<SyncOptions> = {
  snapshotInterval: 50,
  snapshotTimeThreshold: 24 * 60 * 60 * 1000,
  snapshotDebounceMs: 10000,
  backoffBaseMs: 1000,
  maxRetries: 5,
  visibilityIdleThresholdMs: 5 * 60 * 1000,
};

const CURRENT_SCHEMA_VERSION = 1;

export class SyncEngine {
  private state: SyncState;
  private opts: Required<SyncOptions>;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private writeCount = 0;
  private destroyed = false;

  constructor(
    private supabase: SupabaseClientLike,
    private eventStore: EventStore,
    private userId: string,
    private clientId: string,
    private onStateChange?: (state: SyncState) => void,
    options: SyncOptions = {}
  ) {
    this.opts = { ...DEFAULT_OPTIONS, ...options };
    this.state = {
      status: 'idle',
      lastSyncedAt: null,
      lastError: null,
      pendingCount: 0,
    };
  }

  private notifyState(partial: Partial<SyncState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange?.(this.state);
  }

  getState(): SyncState {
    return { ...this.state };
  }

  async logEvent(kind: string, payload: Record<string, unknown>): Promise<number> {
    if (this.destroyed) {
      throw new Error('SyncEngine has been destroyed');
    }

    const localId = await this.eventStore.append(kind, payload);
    const createdAt = new Date().toISOString();

    await this.eventStore.table('sync_queue').add({
      kind,
      payload,
      createdAt,
      localId,
      retries: 0,
    });

    this.writeCount++;

    if (this.writeCount >= this.opts.snapshotInterval) {
      this.scheduleSnapshot();
    }

    this.notifyState({ pendingCount: await this.getPendingCount() });
    this.scheduleFlush();

    return localId;
  }

  private async getPendingCount(): Promise<number> {
    return await this.eventStore.table('sync_queue').count();
  }

  private scheduleFlush(delayMs = 200) {
    if (this.destroyed) return;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      this.flushQueue().catch(() => {
        // Errors are handled internally via state transitions
      });
    }, delayMs);
  }

  private scheduleSnapshot() {
    if (this.destroyed) return;
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
    }
    this.snapshotTimer = setTimeout(() => {
      this.saveSnapshot().catch(() => {
        // Errors handled internally
      });
    }, this.opts.snapshotDebounceMs);
  }

  async flushQueue(): Promise<void> {
    if (this.destroyed) return;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const queue = await this.eventStore.table('sync_queue').orderBy('id').toArray() as QueuedEvent[];
    if (queue.length === 0) return;

    const maxRetriesInQueue = Math.max(...queue.map(item => item.retries));

    if (maxRetriesInQueue > this.opts.maxRetries) {
      this.notifyState({
        status: 'error',
        lastError: 'Max retries exceeded',
        pendingCount: queue.length,
      });
      return;
    }

    this.notifyState({ status: 'syncing', lastError: null });

    const records = queue.map(item => ({
      user_id: this.userId,
      kind: item.kind,
      payload: item.payload,
      client_id: this.clientId,
      device_local_id: item.localId,
      created_at: item.createdAt,
    }));

    try {
      const { error } = await this.supabase.from('events').insert(records).select();

      if (error) {
        throw error;
      }

      const idsToRemove = queue.map(item => item.id).filter((id): id is number => id !== undefined);
      if (idsToRemove.length > 0) {
        await this.eventStore.table('sync_queue').bulkDelete(idsToRemove);
      }

      this.notifyState({
        status: 'idle',
        lastSyncedAt: new Date(),
        pendingCount: 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      for (const item of queue) {
        if (item.id !== undefined) {
          await this.eventStore.table('sync_queue').update(item.id, { retries: item.retries + 1 });
        }
      }

      const updatedRetries = maxRetriesInQueue + 1;

      if (updatedRetries > this.opts.maxRetries) {
        this.notifyState({
          status: 'error',
          lastError: message,
          pendingCount: queue.length,
        });
        return;
      }

      const backoffMs = this.opts.backoffBaseMs * Math.pow(2, maxRetriesInQueue);
      this.scheduleFlush(backoffMs);

      this.notifyState({
        status: 'error',
        lastError: message,
        pendingCount: queue.length,
      });
    }
  }

  async pullAndMerge(): Promise<number> {
    if (this.destroyed) return 0;

    const lastPulledId = await this.getLastPulledId();

    this.notifyState({ status: 'syncing', lastError: null });

    try {
      const { data, error } = await this.supabase
        .from('events')
        .select('id, kind, payload, client_id, device_local_id, created_at')
        .eq('user_id', this.userId)
        .order('id', { ascending: true })
        .gt('id', lastPulledId);

      if (error) {
        throw error;
      }

      const remoteEvents = (data ?? []) as Array<{
        id: number;
        kind: string;
        payload: Record<string, unknown>;
        client_id: string;
        device_local_id: number;
        created_at: string;
      }>;

      const newEvents = remoteEvents.filter(e => e.client_id !== this.clientId);

      if (newEvents.length > 0) {
        const eventsToInsert = newEvents.map(e => ({
          kind: e.kind,
          payload: e.payload,
          createdAt: e.created_at,
        }));
        await this.eventStore.bulkAppend(eventsToInsert);
      }

      const maxRemoteId = remoteEvents.length > 0
        ? Math.max(...remoteEvents.map(e => e.id))
        : lastPulledId;

      if (maxRemoteId > lastPulledId) {
        await this.setLastPulledId(maxRemoteId);
      }

      this.notifyState({
        status: 'idle',
        lastSyncedAt: new Date(),
      });

      return newEvents.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.notifyState({
        status: 'error',
        lastError: message,
      });
      return 0;
    }
  }

  private async getLastPulledId(): Promise<number> {
    const meta = await this.eventStore.table('sync_meta').get('lastPulledId') as SyncMeta | undefined;
    return (meta?.value as number) ?? 0;
  }

  private async setLastPulledId(id: number): Promise<void> {
    await this.eventStore.table('sync_meta').put({ key: 'lastPulledId', value: id });
  }

  async forceSyncNow(): Promise<void> {
    if (this.destroyed) return;
    await this.flushQueue();
  }

  async saveSnapshot(): Promise<void> {
    if (this.destroyed) return;

    const events = await this.eventStore.getAll();
    const lastPulledId = await this.getLastPulledId();

    const snapshot: SnapshotPayload = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      asOfRemoteId: lastPulledId,
      asOfCreatedAt: new Date().toISOString(),
      events: events.map(e => ({
        kind: e.kind,
        payload: e.payload,
        createdAt: e.createdAt,
        clientId: this.clientId,
        deviceLocalId: e.id ?? 0,
      })),
    };

    const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' });
    const path = `${this.userId}/snapshot.json`;

    const { error } = await this.supabase.storage
      .from('sync-snapshots')
      .upload(path, blob, { upsert: true });

    if (error) {
      this.notifyState({
        status: 'error',
        lastError: `Snapshot save failed: ${error.message}`,
      });
      return;
    }

    this.writeCount = 0;

    this.notifyState({
      status: 'idle',
      lastSyncedAt: new Date(),
    });
  }

  async restoreFromCloud(): Promise<void> {
    if (this.destroyed) return;

    const path = `${this.userId}/snapshot.json`;

    this.notifyState({ status: 'syncing', lastError: null });

    try {
      const { data: blob, error: downloadError } = await this.supabase.storage
        .from('sync-snapshots')
        .download(path);

      if (downloadError) {
        if (downloadError.message.includes('Not found') || downloadError.message.includes('404')) {
          this.notifyState({ status: 'idle', lastError: null });
          return;
        }
        throw downloadError;
      }

      if (!blob) {
        this.notifyState({
          status: 'error',
          lastError: 'Snapshot download returned empty data',
        });
        return;
      }

      const text = await blob.text();
      const snapshot: SnapshotPayload = JSON.parse(text);

      if (snapshot.schemaVersion > CURRENT_SCHEMA_VERSION) {
        this.notifyState({
          status: 'error',
          lastError: `Snapshot schemaVersion ${snapshot.schemaVersion} is newer than supported ${CURRENT_SCHEMA_VERSION}. Please update the app.`,
        });
        return;
      }

      await this.eventStore.wipe();

      if (snapshot.events.length > 0) {
        const eventsToRestore = snapshot.events.map(e => ({
          kind: e.kind,
          payload: e.payload,
          createdAt: e.createdAt,
        }));
        await this.eventStore.bulkAppend(eventsToRestore);
      }

      await this.setLastPulledId(snapshot.asOfRemoteId);

      await this.pullAndMerge();

      this.notifyState({
        status: 'idle',
        lastSyncedAt: new Date(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.notifyState({
        status: 'error',
        lastError: message,
      });
    }
  }

  handleVisibilityChange(_wasHidden: boolean, _hiddenDurationMs: number): void {
    if (this.destroyed) return;
    // Stub for Phase 6
  }

  async flushOnPageHide(): Promise<void> {
    if (this.destroyed) return;
    await this.flushQueue();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }
}