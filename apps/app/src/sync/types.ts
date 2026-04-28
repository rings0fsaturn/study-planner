export interface SyncState {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncedAt: Date | null;
  lastError: string | null;
  pendingCount: number;
}

export interface SyncOptions {
  snapshotInterval?: number;      // events count threshold (default: 50)
  snapshotTimeThreshold?: number; // ms since last snapshot (default: 24h)
  snapshotDebounceMs?: number;    // ms to debounce snapshot save (default: 10000)
  backoffBaseMs?: number;         // base retry delay (default: 1000)
  maxRetries?: number;            // max retry attempts (default: 5)
  visibilityIdleThresholdMs?: number; // ms hidden before pull on visible (default: 5min)
}

export interface SnapshotPayload {
  schemaVersion: number;
  asOfRemoteId: number;
  asOfCreatedAt: string;
  events: Array<{
    kind: string;
    payload: Record<string, unknown>;
    createdAt: string;
    clientId: string;
    deviceLocalId: number;
  }>;
}

export interface QueuedEvent {
  id?: number;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
  localId: number;
  retries: number;
}

export interface SyncMeta {
  key: string;
  value: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseClientLike = any;
