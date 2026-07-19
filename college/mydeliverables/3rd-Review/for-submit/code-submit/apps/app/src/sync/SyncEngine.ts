import type { EventStore } from '../events/EventStore';
import type {
  SupabaseClientLike,
  SyncState,
  SyncOptions,
  QueuedEvent,
  SyncMeta,
  SnapshotPayload,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// INDUSTRY PATTERN: Event sourcing with a remote append-log
//
// Invariants this engine enforces:
//   1. Supabase `events` table is the ONE source of truth. IndexedDB is a
//      write-ahead cache and read optimisation — never the authority.
//   2. A snapshot is ONLY saved after a successful flush. Snapshot ↔ server
//      log are always consistent up to `asOfRemoteId`.
//   3. Every snapshot upload is bracketed by a `sync_checkpoints` tombstone
//      row. A client that finds a checkpoint with a matching `as_of_remote_id`
//      knows the snapshot in Storage is trustworthy.
//   4. New clients: download checkpoint → validate → restore snapshot →
//      pull delta. They never replay from id=0 unless no snapshot exists.
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<SyncOptions> = {
  snapshotInterval: 50,
  snapshotTimeThreshold: 24 * 60 * 60 * 1000,
  snapshotDebounceMs: 10_000,
  backoffBaseMs: 1_000,
  maxRetries: 5,
  visibilityIdleThresholdMs: 5 * 60 * 1_000,
};

const CURRENT_SCHEMA_VERSION = 1;

// ─── Supabase table shape for the checkpoint tombstone ───────────────────────
interface SyncCheckpointRow {
  user_id: string;
  as_of_remote_id: number;
  schema_version: number;
  event_count: number;
  created_at: string; // ISO string — set by Supabase default
}

export class SyncEngine {
  private state: SyncState;
  private opts: Required<SyncOptions>;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private writeCount = 0;
  private destroyed = false;
  private lastSnapshotTime = 0;

  // Tracks whether we have ever successfully written a snapshot for this user.
  // Checked after each successful flush so a brand-new user gets a snapshot
  // immediately rather than waiting for the interval threshold.
  private hasEverSnapshottedThisSession = false;

  // Prevents concurrent restoreFromCloud calls (e.g. React Strict Mode double-mount)
  // from both wiping + bulkAppending the snapshot and duplicating events.
  private restoreInFlight: Promise<void> | null = null;

  constructor(
    private supabase: SupabaseClientLike,
    private eventStore: EventStore,
    private userId: string,
    private clientId: string,
    private onStateChange?: (state: SyncState) => void,
    private sendBeaconUrl: string = '',
    options: SyncOptions = {}
  ) {
    this.opts = { ...DEFAULT_OPTIONS, ...options };
    this.state = {
      status: 'idle',
      lastSyncedAt: null,
      lastError: null,
      pendingCount: 0,
      initialRestorePending: true,
    };
  }

  // ─── State ────────────────────────────────────────────────────────────────

  private notifyState(partial: Partial<SyncState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange?.(this.state);
  }

  getState(): SyncState {
    return { ...this.state };
  }

  // ─── Write path ───────────────────────────────────────────────────────────

  async logEvent(kind: string, payload: Record<string, unknown>, createdAt = new Date().toISOString()): Promise<number> {
    if (this.destroyed) throw new Error('SyncEngine has been destroyed');

    const localId = await this.eventStore.append(kind, payload, createdAt);

    await this.eventStore.table('sync_queue').add({
      kind,
      payload,
      createdAt,
      localId,
      retries: 0,
    });

    this.writeCount++;

    const now = Date.now();
    const timeThresholdMet =
      this.lastSnapshotTime > 0 &&
      now - this.lastSnapshotTime >= this.opts.snapshotTimeThreshold;

    if (this.writeCount >= this.opts.snapshotInterval || timeThresholdMet) {
      this.scheduleSnapshot();
    }

    this.notifyState({ pendingCount: await this.getPendingCount() });
    this.scheduleFlush();

    return localId;
  }

  private async getPendingCount(): Promise<number> {
    return this.eventStore.table('sync_queue').count();
  }

  // ─── Timers ───────────────────────────────────────────────────────────────

  private scheduleFlush(delayMs = 200) {
    if (this.destroyed) return;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushQueue().catch(() => {
        // Errors handled internally via state transitions
      });
    }, delayMs);
  }

  private scheduleSnapshot() {
    if (this.destroyed) return;
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = setTimeout(() => {
      this.saveSnapshot().catch(() => {
        // Errors handled internally
      });
    }, this.opts.snapshotDebounceMs);
  }

  // ─── Flush (local → remote) ───────────────────────────────────────────────

  async flushQueue(): Promise<void> {
    if (this.destroyed) return;

    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const queue = (await this.eventStore
      .table('sync_queue')
      .orderBy('id')
      .toArray()) as QueuedEvent[];

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
      if (error) throw error;

      const idsToRemove = queue
        .map(item => item.id)
        .filter((id): id is number => id !== undefined);

      if (idsToRemove.length > 0) {
        await this.eventStore.table('sync_queue').bulkDelete(idsToRemove);
      }

      this.notifyState({
        status: 'idle',
        lastSyncedAt: new Date(),
        pendingCount: 0,
      });

      // ── INDUSTRY RULE ────────────────────────────────────────────────────
      // After a successful flush, check if we need a snapshot.
      //
      // Two triggers:
      //   a) No snapshot has ever been saved for this user (cold start path)
      //      — schedule immediately so a new device can restore without
      //      replaying the entire event log from id=0.
      //   b) Normal thresholds (writeCount, time) already handled in logEvent,
      //      but we re-check here in case flush was called manually via
      //      forceSyncNow().
      // ─────────────────────────────────────────────────────────────────────
      const needsFirstSnapshot = !this.hasEverSnapshottedThisSession;
      const intervalMet = this.writeCount >= this.opts.snapshotInterval;

      if (needsFirstSnapshot || intervalMet) {
        this.scheduleSnapshot();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      for (const item of queue) {
        if (item.id !== undefined) {
          await this.eventStore
            .table('sync_queue')
            .update(item.id, { retries: item.retries + 1 });
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

  // ─── Pull (remote → local) ────────────────────────────────────────────────

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

      if (error) throw error;

      const remoteEvents = (data ?? []) as Array<{
        id: number;
        kind: string;
        payload: Record<string, unknown>;
        client_id: string;
        device_local_id: number;
        created_at: string;
      }>;

      // Skip events that originated from this client — we already have them
      // in the local event store from when they were logged.
      const existingSessionIds = await this.getLocalSessionIds();
      const foreignEvents = remoteEvents.filter(e => {
        if (e.client_id === this.clientId) return false;
        if (e.kind === 'SessionLogged') {
          const sessionId = e.payload.sessionId as string | undefined;
          if (sessionId && existingSessionIds.has(sessionId)) return false;
        }
        return true;
      });

      if (foreignEvents.length > 0) {
        await this.eventStore.bulkAppend(
          foreignEvents.map(e => ({
            kind: e.kind,
            payload: e.payload,
            createdAt: e.created_at,
          }))
        );

        await this.reconcileSessionState(foreignEvents);
      }

      // Advance cursor even for own-client events so we don't re-fetch them.
      const maxRemoteId =
        remoteEvents.length > 0
          ? Math.max(...remoteEvents.map(e => e.id))
          : lastPulledId;

      if (maxRemoteId > lastPulledId) {
        await this.setLastPulledId(maxRemoteId);
      }

      this.notifyState({ status: 'idle', lastSyncedAt: new Date() });

      return foreignEvents.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.notifyState({ status: 'error', lastError: message });
      return 0;
    }
  }

  // ─── Snapshot save ────────────────────────────────────────────────────────

  async saveSnapshot(): Promise<void> {
    if (this.destroyed) return;

    // ── INDUSTRY RULE ────────────────────────────────────────────────────────
    // ALWAYS flush before snapshotting.
    //
    // Without this, a snapshot can capture local events that Supabase has
    // never seen. A cold-start client restores those events then pulls delta
    // from Supabase — but Supabase's event log starts from a different point,
    // so the two histories diverge.
    //
    // Invariant: snapshot.asOfRemoteId == lastPulledId == highest id in the
    // events table that this client has synced. This is only guaranteed if
    // the flush completed first.
    // ─────────────────────────────────────────────────────────────────────────
    await this.flushQueue();

    // If flush left us in an error state (network down, max retries hit),
    // abort. We must not snapshot a state that's inconsistent with the server.
    if (this.state.status === 'error') return;

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

    // ── INDUSTRY PATTERN: Checkpoint tombstone ───────────────────────────────
    // Write a row to `sync_checkpoints` BEFORE uploading the blob.
    // Purpose: if the Storage upload fails mid-way, the stale/partial blob in
    // Storage will have NO matching checkpoint row. A restoring client always
    // validates checkpoint.as_of_remote_id == snapshot.asOfRemoteId before
    // trusting the blob. Mismatches → fall back to full pull from id=0.
    //
    // This is the "write-ahead log" pattern applied to snapshot management:
    // the checkpoint row is the intent record; the blob upload is the
    // data record. A client considers a snapshot valid only when both exist
    // and agree.
    // ─────────────────────────────────────────────────────────────────────────
    const checkpoint: Omit<SyncCheckpointRow, 'created_at'> = {
      user_id: this.userId,
      as_of_remote_id: lastPulledId,
      schema_version: CURRENT_SCHEMA_VERSION,
      event_count: snapshot.events.length,
    };

    const { error: checkpointError } = await this.supabase
      .from('sync_checkpoints')
      .upsert(checkpoint, { onConflict: 'user_id' });

    if (checkpointError) {
      this.notifyState({
        status: 'error',
        lastError: `Checkpoint write failed: ${checkpointError.message}`,
      });
      return;
    }

    // Now safe to upload the blob — checkpoint tombstone is in place.
    const { error: uploadError } = await this.supabase.storage
      .from('sync-snapshots')
      .upload(path, blob, { upsert: true });

    if (uploadError) {
      // Checkpoint row exists but blob failed — next restore will detect
      // the mismatch and fall back to pullAndMerge(). Safe state.
      this.notifyState({
        status: 'error',
        lastError: `Snapshot upload failed: ${uploadError.message}`,
      });
      return;
    }

    this.writeCount = 0;
    this.lastSnapshotTime = Date.now();
    this.hasEverSnapshottedThisSession = true;

    this.notifyState({ status: 'idle', lastSyncedAt: new Date() });
  }

  // ─── Snapshot restore ─────────────────────────────────────────────────────

  async restoreFromCloud(): Promise<void> {
    if (this.destroyed) return;

    if (this.restoreInFlight) {
      return this.restoreInFlight;
    }

    this.restoreInFlight = this.doRestoreFromCloud();
    try {
      await this.restoreInFlight;
    } finally {
      this.restoreInFlight = null;
      this.notifyState({ initialRestorePending: false });
    }
  }

  private async doRestoreFromCloud(): Promise<void> {
    if (this.destroyed) return;

    const path = `${this.userId}/snapshot.json`;

    this.notifyState({ status: 'syncing', lastError: null });

    try {
      // Same device re-login: IndexedDB already has events. Skip wipe + snapshot
      // restore — only flush pending writes and pull remote delta. Full restore
      // is for cold-start clients with an empty local event log.
      const localEventCount = await this.eventStore.table('events').count();
      if (localEventCount > 0) {
        this.notifyState({ initialRestorePending: false });
        await this.flushQueue();
        await this.deduplicateLocalSessionEvents();
        await this.pullAndMerge();
        this.notifyState({ status: 'idle', lastSyncedAt: new Date() });
        return;
      }

      // ── Step 1: Fetch the checkpoint tombstone ──────────────────────────
      // The checkpoint row is the authority. If it doesn't exist, there is no
      // valid snapshot to restore — fall through to a full pull.
      const { data: checkpointRows, error: checkpointFetchError } = await this.supabase
        .from('sync_checkpoints')
        .select('as_of_remote_id, schema_version, event_count')
        .eq('user_id', this.userId)
        .maybeSingle();

      if (checkpointFetchError) throw checkpointFetchError;

      if (!checkpointRows) {
        // No checkpoint → no trusted snapshot. Pull everything from id=0.
        await this.pullAndMerge();
        return;
      }

      const checkpoint = checkpointRows as Pick<
        SyncCheckpointRow,
        'as_of_remote_id' | 'schema_version' | 'event_count'
      >;

      // ── Step 2: Schema version guard ────────────────────────────────────
      if (checkpoint.schema_version > CURRENT_SCHEMA_VERSION) {
        this.notifyState({
          status: 'error',
          lastError: `Snapshot schema v${checkpoint.schema_version} is newer than supported v${CURRENT_SCHEMA_VERSION}. Please update the app.`,
        });
        return;
      }

      // ── Step 3: Download the blob ────────────────────────────────────────
      const { data: blob, error: downloadError } = await this.supabase.storage
        .from('sync-snapshots')
        .download(path);

      if (downloadError) {
        const msg = downloadError.message.toLowerCase();
        if (msg.includes('not found') || msg.includes('404')) {
          // Checkpoint exists but blob is gone (upload failed previously).
          // Pull from scratch — safe fallback.
          await this.pullAndMerge();
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

      // ── Step 4: Validate snapshot against checkpoint ─────────────────────
      // This is the tombstone check. If they disagree, the blob was uploaded
      // in a partial or corrupt state. Discard and pull from scratch.
      const snapshotIsValid =
        snapshot.asOfRemoteId === checkpoint.as_of_remote_id &&
        snapshot.events.length === checkpoint.event_count &&
        snapshot.schemaVersion === checkpoint.schema_version;

      if (!snapshotIsValid) {
        console.warn(
          '[SyncEngine] Snapshot failed checkpoint validation — falling back to full pull.',
          {
            checkpointRemoteId: checkpoint.as_of_remote_id,
            snapshotRemoteId: snapshot.asOfRemoteId,
            checkpointEventCount: checkpoint.event_count,
            snapshotEventCount: snapshot.events.length,
          }
        );
        await this.pullAndMerge();
        return;
      }

      // ── Step 5: Restore ──────────────────────────────────────────────────
      await this.eventStore.wipe();

      if (snapshot.events.length > 0) {
        await this.eventStore.bulkAppend(
          snapshot.events.map(e => ({
            kind: e.kind,
            payload: e.payload,
            createdAt: e.createdAt,
          }))
        );
      }

      await this.setLastPulledId(snapshot.asOfRemoteId);

      // ── Step 6: Pull delta ───────────────────────────────────────────────
      // Snapshot brings us up to asOfRemoteId. pullAndMerge fetches
      // everything from asOfRemoteId+1 onward — the events that arrived
      // after the snapshot was taken.
      await this.pullAndMerge();

      this.notifyState({ status: 'idle', lastSyncedAt: new Date() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.notifyState({ status: 'error', lastError: message });
    }
  }

  // ─── Local deduplication ──────────────────────────────────────────────────

  /**
   * Remove duplicate SessionLogged rows that share the same sessionId.
   * Keeps the row with the lowest local id (first inserted).
   * Heals corruption from concurrent snapshot restores on re-login.
   */
  private async deduplicateLocalSessionEvents(): Promise<void> {
    const all = await this.eventStore.getAll();
    const keepIdBySession = new Map<string, number>();
    const idsToDelete: number[] = [];

    for (const event of all) {
      if (event.kind !== 'SessionLogged' || event.id === undefined) continue;

      const sessionId = event.payload.sessionId as string | undefined;
      if (!sessionId) continue;

      const keptId = keepIdBySession.get(sessionId);
      if (keptId === undefined) {
        keepIdBySession.set(sessionId, event.id);
        continue;
      }

      if (event.id < keptId) {
        idsToDelete.push(keptId);
        keepIdBySession.set(sessionId, event.id);
      } else {
        idsToDelete.push(event.id);
      }
    }

    if (idsToDelete.length > 0) {
      await this.eventStore.table('events').bulkDelete(idsToDelete);
    }
  }

  // ─── Cursor helpers ───────────────────────────────────────────────────────

  private async getLocalSessionIds(): Promise<Set<string>> {
    const all = await this.eventStore.getAll();
    const ids = new Set<string>();
    for (const event of all) {
      if (event.kind === 'SessionLogged') {
        const sessionId = event.payload.sessionId as string | undefined;
        if (sessionId) ids.add(sessionId);
      }
    }
    return ids;
  }

  private async getLastPulledId(): Promise<number> {
    const meta = (await this.eventStore
      .table('sync_meta')
      .get('lastPulledId')) as SyncMeta | undefined;
    return (meta?.value as number) ?? 0;
  }

  private async setLastPulledId(id: number): Promise<void> {
    await this.eventStore.table('sync_meta').put({ key: 'lastPulledId', value: id });
  }

  // ─── Session state reconciliation ─────────────────────────────────────────

  private async reconcileSessionState(
    foreignEvents: Array<{
      kind: string;
      payload: Record<string, unknown>;
    }>
  ): Promise<void> {
    const sessionTable = this.eventStore.table('activeSession');

    for (const event of foreignEvents) {
      switch (event.kind) {
        case 'SessionStarted': {
          const existing = await sessionTable.get(1);
          if (!existing) {
            await sessionTable.put({
              id: 1,
              sessionId: event.payload.sessionId,
              materialId: event.payload.materialId,
              sessionTitle: event.payload.sessionTitle,
              slotDate: event.payload.slotDate,
              weekIndex: event.payload.weekIndex,
              plannedMinutes: event.payload.plannedMinutes,
              startedAt: event.payload.startedAt,
              status: 'active',
              pauseIntervals: [],
              pomodoroConfig: event.payload.pomodoroConfig ?? { workMinutes: 50, breakMinutes: 10 },
            });
          }
          break;
        }
        case 'SessionPaused': {
          const current = await sessionTable.get(1);
          if (current && current.sessionId === event.payload.sessionId) {
            await sessionTable.update(1, { status: 'paused' });
          }
          break;
        }
        case 'SessionResumed': {
          const current = await sessionTable.get(1);
          if (current && current.sessionId === event.payload.sessionId) {
            await sessionTable.update(1, { status: 'active' });
          }
          break;
        }
        case 'SessionLogged':
        case 'SessionAbandoned': {
          const current = await sessionTable.get(1);
          if (current && current.sessionId === event.payload.sessionId) {
            await sessionTable.delete(1);
          }
          break;
        }
      }
    }
  }

  // ─── Public controls ──────────────────────────────────────────────────────

  async forceSyncNow(): Promise<void> {
    if (this.destroyed) return;
    await this.flushQueue();
  }

  async handleVisibilityChange(wasHidden: boolean, hiddenDurationMs: number): Promise<void> {
    if (this.destroyed) return;
    if (wasHidden && hiddenDurationMs > this.opts.visibilityIdleThresholdMs) {
      await this.pullAndMerge();
    }
  }

  async flushOnPageHide(): Promise<void> {
    if (this.destroyed) return;

    const queue = (await this.eventStore
      .table('sync_queue')
      .orderBy('id')
      .toArray()) as QueuedEvent[];

    if (queue.length === 0) return;

    const records = queue.map(item => ({
      user_id: this.userId,
      kind: item.kind,
      payload: item.payload,
      client_id: this.clientId,
      device_local_id: item.localId,
      created_at: item.createdAt,
    }));

    const body = JSON.stringify(records);

    if (this.sendBeaconUrl && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(this.sendBeaconUrl, new Blob([body], { type: 'application/json' }));
    } else {
      await this.flushQueue();
    }
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
