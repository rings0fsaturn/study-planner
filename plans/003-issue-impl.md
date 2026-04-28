# Implementation Plan: Issue #003 — Sync Events to Postgres; Restore on a Fresh Device

## Status: COMPLETE

**Completed Phases:** 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10  
**Current Phase:** N/A (All done!)

---

## Architecture Summary

**SyncEngine wraps EventStore writes**: `syncEngine.logEvent()` calls `eventStore.append()` internally then enqueues for push. `Log.tsx` uses `useSync().logEvent()` instead of `eventStore.append()`.

**SyncIndicator below header, inline with greeting**: Right-aligned next to "Hello, {email}" on Home.

```
UI (Log.tsx) → syncEngine.logEvent() → EventStore.append() → Dexie (local)
                                           ↓
                                    SyncEngine.enqueue() → queue in Dexie
                                           ↓
                                    SyncEngine.flushQueue() → Supabase Postgres

UI (Home.tsx) ← useLiveQuery(eventStore.getAll()) ← Dexie (local) ← SyncEngine.pullAndMerge() ← Postgres
```

---

## File Manifest

### Completed Files ✅

| File | Status |
|------|--------|
| `apps/app/supabase/migrations/003_events_table.sql` | ✅ Done |
| `apps/app/src/events/EventStore.ts` | ✅ Done (enhanced) |
| `apps/app/src/events/EventStore.test.ts` | ✅ Done (15 tests) |
| `apps/app/src/sync/types.ts` | ✅ Done |
| `apps/app/src/sync/SyncEngine.ts` | ✅ Done (core + pull + retry + snapshot + restore) |
| `apps/app/src/sync/SyncEngine.test.ts` | ✅ Done (53 tests - includes snapshot/restore tests) |
| `apps/app/src/events/EventStoreProvider.tsx` | ✅ Done (Dexie v2 schema) |
| `apps/app/src/sync/SyncProvider.tsx` | ✅ Done (context + lifecycle) |
| `apps/app/src/sync/SyncProvider.test.tsx` | ✅ Done (5 tests) |
| `apps/app/src/sync/useSync.ts` | ✅ Done |
| `apps/app/src/sync/index.ts` | ✅ Done (barrel export) |
| `apps/app/src/components/SyncIndicator.tsx` | ✅ Done |
| `apps/app/src/components/SyncIndicator.test.tsx` | ✅ Done (12 tests) |
| `packages/design-tokens/src/components.css` | ✅ Done (`.sync-indicator` CSS) |

### Remaining Files

| File | Purpose |
|------|---------|
| `apps/app/src/App.tsx` | ✅ Done - Nest `<SyncProvider>` inside `<EventStoreProvider>` |
| `apps/app/src/pages/Log.tsx` | ✅ Done - Replace `eventStore.append()` → `useSync().logEvent()` |
| `apps/app/src/pages/Home.tsx` | ✅ Done - Add `<SyncIndicator />` next to greeting |
| `e2e/sync.spec.ts` | ✅ Done - Cross-device session visibility E2E |

---

## TDD Execution Order (Completed)

### Phase 0: Database Migration ✅
- Migration SQL for `events` table + RLS + storage bucket

### Phase 1: EventStore Enhancements ✅
- Added `bulkAppend`, `getMaxId`, `getEventsSince`, `table` accessor
- 15 unit tests passing

### Phase 2: SyncEngine Core (logEvent, queue, flush) ✅
- `logEvent`: appends to EventStore, enqueues for push
- `flushQueue`: pushes events to Supabase, clears queue on success
- Queue persistence across re-initialization
- State transitions: idle → syncing → idle/error
- 45 total unit tests passing

### Phase 3: pullAndMerge ✅
- Fetches only events with id > lastPulledId
- Skips events from this device (matching client_id)
- Merges new events into local EventStore
- Updates lastPulledId
- Returns count of new events

### Phase 4: Retry/Backoff ✅
- Increments retries on push failure
- Pre-push guard: skips push if maxRetries exceeded
- Exponential backoff scheduling
- State transitions on retry exhaustion

---

## TDD Execution Order (Remaining)

### Phase 5: Snapshot/Restore ✅
- Tests: round-trip snapshot save/load, schemaVersion check, missing snapshot graceful, pull after restore, snapshot scheduling
- Implementation: `saveSnapshot()`, `restoreFromCloud()`, snapshot scheduling
- 8 new tests added: saveSnapshot (2), restoreFromCloud (4), snapshot scheduling (2)
- All 53 tests passing

### Phase 6: SyncProvider + Lifecycle Hooks ✅
- Tests: mount creates engine, user switch restores, visibility/pagehide wiring
- Implementation: `SyncProvider.tsx`, `useSync` hook, lifecycle handlers
- EventStoreProvider upgraded to Dexie v2 schema (sync_queue, sync_meta tables)
- All 5 tests passing

### Phase 7: SyncIndicator Component ✅
- Tests: idle/syncing/error/offline render states, click triggers forceSyncNow, formatTimeAgo
- Implementation: `SyncIndicator.tsx`, `SyncIndicator.test.tsx`, `.sync-indicator` CSS
- Online/offline detection added to SyncProvider
- 12 tests passing

### Phase 8: Integration ✅
- Wire into `App.tsx`, `Log.tsx`, `Home.tsx`
- Add `.sync-indicator` to design tokens
- Implement sendBeacon flush on pagehide
- Implement handleVisibilityChange pull
- Implement time-based snapshot trigger (24h threshold)

### Phase 9: E2E Test ✅
- Test: session logged on device A appears on device B after sync
- Created `e2e/sync.spec.ts`

### Phase 10: Final Verification ✅
- All tests pass (70 unit tests)
- Build succeeds
- TypeScript typecheck passes

---

## Key Technical Details

**Dedup on pull**: Each event carries `clientId` (UUID per device) and `deviceLocalId` (originating Dexie id). On pull, events with matching `clientId` are skipped.

**Retry logic**: Uses `>` (strict greater-than) for exhaustion check. With `maxRetries: 0`, exactly 1 attempt is allowed before max is considered exceeded.

**Snapshot cadence**: Triggered after every 50 local writes OR 24 hours since last snapshot, with 10-second debounce.

---

## Design-System Compliance

| Element | Design Token / Class |
|---------|---------------------|
| SyncIndicator container | `.sync-indicator` |
| Sync dot (idle/moss) | `.sync-indicator-dot` |
| Sync dot (syncing/terracotta pulse) | `.sync-indicator.syncing .sync-indicator-dot` |
| Sync dot (failed/rust) | `.sync-indicator.failed .sync-indicator-dot` |
| Sync dot (offline/ink-faint) | `.sync-indicator.offline .sync-indicator-dot` |

---

## Acceptance Criteria (from issue #003)

- [x] A Postgres `events` table exists with row-level security restricting reads/writes to `auth.uid() = user_id`
- [x] Every event appended to the local EventStore is pushed to the `events` table
- [x] Sync queue retries with backoff on transient failure; queue survives a refresh
- [x] On `pagehide`, pending events are flushed via `sendBeacon`
- [x] Snapshots are written to Supabase Storage on a debounced cadence (debounce window documented in the implementation)
- [x] Every snapshot includes a `schemaVersion` integer field
- [x] On sign-in on a fresh device, the client pulls the latest snapshot, applies it, then pulls and replays events newer than the snapshot's `as_of` timestamp
- [x] On returning to a tab (`visibilitychange` → visible), the client pulls events newer than its local high-water mark
- [x] `/study/home` shows a "Synced X ago" indicator; tapping it forces a pull
- [x] Account-switch wipe (from slice 2) is followed by a restore-from-cloud for the new user
- [x] SyncEngine has tests for: event push ordering, retry/backoff, snapshot round-trip, fresh-device restore, account-switch wipe + restore
- [x] An end-to-end test covers: log a session on device A → sign in on device B → see the session