---
name: sync-boundaries
description: Preserve the local-first write-ahead sync model, user ownership, and restore semantics.
---

# Sync Boundaries

Keep the local event append authoritative for immediate product behavior.
Queue cloud work through the existing sync engine instead of making pages write directly to Supabase.
Remove queued work only after the remote write is confirmed.

Preserve client identifiers and deduplication behavior across retries and restores.
Scope every remote operation, snapshot path, cursor, and restore to the authenticated user.
Do not merge events from different users or silently replace newer local history with an older snapshot.

Keep browser lifecycle listeners and engine ownership in `SyncProvider`.
Keep retry, timeout, delta-pull, snapshot, and restore behavior in `SyncEngine` or its focused collaborators.

Update local schema, remote migration, payload types, restore tests, and retry tests together when the sync contract changes.
Verify offline append, retry after failure, fresh-device restore, and account switching for cross-cutting sync changes.
