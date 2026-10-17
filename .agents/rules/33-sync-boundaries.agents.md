---
name: sync-boundaries
description: Preserve the local-first write-ahead sync model, user ownership, and restore semantics.
---

# Sync Boundaries

Keep the local event append authoritative for immediate product behavior.
Queue cloud work through the existing sync engine instead of making pages write directly to Supabase.
Only `SyncEngine.logEvent` enqueues to `sync_queue`; `bulkAppend` (seeds, restores) bypasses it, so bulk-seeded histories stay local-only.
Wipe and queue are independent: `EventStore.wipe()` clears the `events` table only, never `sync_queue` or checkpoints.
After a wipe, still-queued rows push wiped events to cloud on the next flush.
Resets that need a clean slate (runbook reruns, test isolation) must clear `sync_queue` explicitly.
`SyncProvider` renders `BootScreen` instead of children until the initial restore completes.
Components or hooks moved inside `SyncRouter` stay unavailable during that window, so wait for restore (or the safety timeout) before driving them from specs or console.
Remove queued work only after the remote write is confirmed.

Preserve client identifiers and deduplication behavior across retries and restores.
Scope every remote operation, snapshot path, cursor, and restore to the authenticated user.
Do not merge events from different users or silently replace newer local history with an older snapshot.

Keep browser lifecycle listeners and engine ownership in `SyncProvider`.
Keep retry, timeout, delta-pull, snapshot, and restore behavior in `SyncEngine` or its focused collaborators.

Update local schema, remote migration, payload types, restore tests, and retry tests together when the sync contract changes.
Verify offline append, retry after failure, fresh-device restore, and account switching for cross-cutting sync changes.
