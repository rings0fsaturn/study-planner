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

export interface SupabaseClientLike {
  from: (table: string) => {
    insert: (values: Record<string, unknown> | Record<string, unknown>[]) => {
      select: () => Promise<{ data: Array<Record<string, unknown>> | null; error: Error | null }>;
    };
    select: (columns?: string) => {
      eq: (column: string, value: unknown) => {
        order: (column: string, options?: { ascending?: boolean }) => {
          gt: (column: string, value: unknown) => Promise<{ data: Array<Record<string, unknown>> | null; error: Error | null }>;
          gte: (column: string, value: unknown) => Promise<{ data: Array<Record<string, unknown>> | null; error: Error | null }>;
        };
      };
    };
  };
  storage: {
    from: (bucket: string) => {
      upload: (path: string, fileBody: Blob | File | FormData | ArrayBuffer | string, options?: Record<string, unknown>) => Promise<{ data: { path: string } | null; error: Error | null }>;
      download: (path: string) => Promise<{ data: Blob | null; error: Error | null }>;
      list: (path: string, options?: Record<string, unknown>) => Promise<{ data: Array<{ name: string }> | null; error: Error | null }>;
    };
  };
}
