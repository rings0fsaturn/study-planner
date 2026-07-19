import type { MaterialKind, MaterialPosition } from '../session/types';

export interface SyncState {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncedAt: Date | null;
  lastError: string | null;
  pendingCount: number;
  /** True until the first restoreFromCloud() attempt settles.
   * Cleared early on the fast path; kept true during a cold-start snapshot restore. */
  initialRestorePending: boolean;
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

import type { DayOfWeek, Slot } from '@study-tracker/roadmap-engine'

export interface PlaylistVideoInfo {
  youtubeVideoId: string
  title: string
  durationMinutes: number
}

export interface MaterialAddedPayload {
  materialId: string
  title: string
  estimatedDuration: number
  url?: string
  kind: MaterialKind
  role: 'anchor' | 'foundation' | 'practice'
  playlistId?: string
  youtubeVideoId?: string
  videos?: PlaylistVideoInfo[]
}

export interface RoadmapCreatedPayload {
  startDate: string
  deadline: string
  weeks: number
  purpose?: string
  selectedStudyDays: DayOfWeek[]
  weekdayHours: number
  weekendHours: number
  weeklyHours: number
  /** Ordered selected material IDs for no-slot roadmaps. */
  materialIds?: string[]
  /** Roadmap-scoped remaining-duration overrides from replan/shorten flows. */
  materialDurationOverrides?: Record<string, number>
  /** Legacy read-only slot payload. New roadmaps omit slots and emit SessionBooked events. */
  slots?: Slot[]
}

export interface SessionBookedPayload {
  roadmapCreatedAt: string
  bookingId: string
  date: string
  estimatedDuration: number
  materialId?: string
}

export interface BookingEditedPayload {
  roadmapCreatedAt: string
  bookingId: string
  date?: string
  estimatedDuration?: number
  /** null detaches material so the user picks at session start. */
  materialId?: string | null
}

export interface BookingClearedPayload {
  roadmapCreatedAt: string
  bookingId: string
}

export interface MaterialProgressMarkedPayload {
  roadmapCreatedAt: string
  materialId: string
  markedAt: string
  materialPosition: MaterialPosition
  source: 'directory' | 'session-end'
}

export interface RoadmapMarkedCompletePayload {
  roadmapCreatedAt: string
  resolvedAt: string
  reason?: string
}

export interface RoadmapMarkedAbandonedPayload {
  roadmapCreatedAt: string
  resolvedAt: string
  reason?: string
}

export interface RoadmapReplannedPayload extends RoadmapCreatedPayload {
  // identity of the original RoadmapCreated this revises; collapses to one entry (D-07)
  roadmapCreatedAt: string
  // which entry path produced this replan, for analytics/history (optional)
  option?: 'extend-deadline' | 'increase-hours' | 'trim-scope' | 'edit'
}

export interface RoadmapEditedPayload {
  // identity of the roadmap being edited in place (D-07/D-10)
  roadmapCreatedAt: string
  weekIndex: number
  dayOfWeek: DayOfWeek
  // null materialId means "rest day" / cleared
  materialId: string | null
  sessionTitle: string | null
  plannedMinutes: number
}

export interface SupabaseClientLike {
  from: (table: string) => {
    insert: (values: Record<string, unknown> | Record<string, unknown>[]) => {
      select: () => PromiseLike<{ data: Array<Record<string, unknown>> | null; error: Error | null }>;
    };
    upsert: (row: Record<string, unknown>, options?: Record<string, unknown>) => PromiseLike<{ data: Array<Record<string, unknown>> | null; error: Error | null }>;
    select: (columns?: string) => {
      eq: (column: string, value: unknown) => {
        order: (column: string, options?: { ascending?: boolean }) => {
          gt: (column: string, value: unknown) => PromiseLike<{ data: Array<Record<string, unknown>> | null; error: Error | null }>;
          gte: (column: string, value: unknown) => PromiseLike<{ data: Array<Record<string, unknown>> | null; error: Error | null }>;
        };
        maybeSingle: () => PromiseLike<{ data: Record<string, unknown> | null; error: Error | null }>;
      };
    };
  };
  storage: {
    from: (bucket: string) => {
      upload: (path: string, fileBody: Blob | File | FormData | ArrayBuffer | string, options?: Record<string, unknown>) => PromiseLike<{ data: { path: string } | null; error: Error | null }>;
      download: (path: string) => PromiseLike<{ data: Blob | null; error: Error | null }>;
      list: (path: string, options?: Record<string, unknown>) => PromiseLike<{ data: Array<{ name: string }> | null; error: Error | null }>;
    };
  };
}
