---
title: Sync events to Postgres; restore on a fresh device
type: AFK
blocked_by: [2]
covers_user_stories: [36, 37, 38, 39, 40, 41, 45]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

The local-first sync loop. Every event written to the local EventStore is pushed to a Postgres `events` table; on a fresh device, signing in pulls a snapshot from Supabase Storage plus any events newer than the snapshot, and the user sees their full history. Snapshots are written on a debounced cadence and carry a `schemaVersion` integer so future migrations have a hook.

The user surface is small: a "Synced X ago" indicator on Home, tappable to force a pull. Everything else is plumbing — but plumbing that the next ten slices depend on, which is why it gets its own tracer.

## Acceptance criteria

- [ ] A Postgres `events` table exists with row-level security restricting reads/writes to `auth.uid() = user_id`
- [ ] Every event appended to the local EventStore is pushed to the `events` table
- [ ] Sync queue retries with backoff on transient failure; queue survives a refresh
- [ ] On `pagehide`, pending events are flushed via `sendBeacon`
- [ ] Snapshots are written to Supabase Storage on a debounced cadence (debounce window documented in the implementation)
- [ ] Every snapshot includes a `schemaVersion` integer field
- [ ] On sign-in on a fresh device, the client pulls the latest snapshot, applies it, then pulls and replays events newer than the snapshot's `as_of` timestamp
- [ ] On returning to a tab (`visibilitychange` → visible), the client pulls events newer than its local high-water mark
- [ ] `/study/home` shows a "Synced X ago" indicator; tapping it forces a pull
- [ ] Account-switch wipe (from slice 2) is followed by a restore-from-cloud for the new user
- [ ] SyncEngine has tests for: event push ordering, retry/backoff, snapshot round-trip, fresh-device restore, account-switch wipe + restore
- [ ] An end-to-end test covers: log a session on device A → sign in on device B → see the session

## Blocked by

- Blocked by #2
