# Sync Architecture

Write-ahead queue pattern. Local events queued in `sync_queue`, flushed to Supabase `public.events`. Snapshots to Supabase Storage for fast restore.

## Files

| File | Purpose |
|---|---|
| `apps/app/src/sync/SyncEngine.ts` | Deep module: queue flush, snapshot create/restore, delta pull, retry. DI via constructor. |
| `apps/app/src/sync/SyncProvider.tsx` | Creates SyncEngine when user + EventStore ready. Browser lifecycle hooks. |
| `apps/app/src/sync/useSync.ts` | Hook: `SyncState` (status, lastSyncedAt, pendingCount, lastError) |
| `apps/app/src/sync/types.ts` | SyncState, SyncOptions, SnapshotPayload, QueuedEvent, SupabaseClientLike |

## Flow

1. **Local append** → event → `events` table + `sync_queue` table
2. **Flush** → queued events inserted to Supabase `public.events`, removed from queue on success
3. **Snapshot** → threshold reached (count or time) → JSON blob to `sync-snapshots` Storage bucket
4. **Restore** → new device: download snapshot, replay delta events since snapshot

## Browser Lifecycle

- `visibilitychange` (return to foreground) → pull remote delta if idle > 5 min
- `pagehide` / `beforeunload` → flush via `sendBeacon`

## Retry

Exponential backoff, configurable base (default 1s), max retries (default 5).

## Testing

See `sync-provider-testing.md` for patterns: prototype spies, manual event dispatch, act() wrapping.
