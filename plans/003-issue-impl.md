# Implementation Plan: Issue #003 — Sync Events to Postgres; Restore on a Fresh Device

## Status: IN PROGRESS

**Completed Phases:** 0, 1, 2, 3, 4  
**Current Phase:** 5 (Snapshot/Restore)  
**Pending Phases:** 6, 7, 8, 9, 10

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
| `apps/app/src/sync/SyncEngine.ts` | ✅ Done (core + pull + retry) |
| `apps/app/src/sync/SyncEngine.test.ts` | ✅ Done (45 tests) |

### Remaining Files

| File | Purpose |
|------|---------|
| `apps/app/src/sync/SyncProvider.tsx` | React context; creates SyncEngine per user; lifecycle hooks |
| `apps/app/src/sync/useSync.ts` | Hook: `{ syncState, logEvent, forceSyncNow }` |
| `apps/app/src/sync/index.ts` | Barrel export |
| `apps/app/src/components/SyncIndicator.tsx` | "Synced X ago" pill widget |
| `apps/app/src/components/SyncIndicator.test.tsx` | 4 rendering tests per state |
| `apps/app/src/events/EventStoreProvider.tsx` | Upgrade Dexie schema to v2 (add sync_queue, sync_meta tables) |
| `apps/app/src/App.tsx` | Nest `<SyncProvider>` inside `<EventStoreProvider>` |
| `apps/app/src/pages/Log.tsx` | Replace `eventStore.append()` → `useSync().logEvent()` |
| `apps/app/src/pages/Home.tsx` | Add `<SyncIndicator />` next to greeting |
| `packages/design-tokens/src/components.css` | Add `.sync-indicator` |
| `e2e/sync.spec.ts` | Cross-device session visibility E2E |

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

### Phase 5: Snapshot/Restore (IN PROGRESS)
- Tests: round-trip snapshot save/load, schemaVersion check, missing snapshot graceful
- Implementation: `saveSnapshot()`, `restoreFromCloud()`, snapshot scheduling

### Phase 6: SyncProvider + Lifecycle Hooks
- Tests: mount creates engine, user switch restores, visibility/pagehide wiring
- Implementation: `SyncProvider.tsx`, `useSync` hook, lifecycle handlers

### Phase 7: SyncIndicator Component
- Tests: idle/syncing/error/offline render states, click triggers forceSyncNow
- Implementation: `SyncIndicator.tsx` with design tokens

### Phase 8: Integration
- Wire into `App.tsx`, `Log.tsx`, `Home.tsx`
- Add `.sync-indicator` to design tokens

### Phase 9: E2E Test
- Test: session logged on device A appears on device B after sync

### Phase 10: Final Verification
- Run all tests
- Verify no regressions

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

- [ ] A Postgres `events` table exists with row-level security restricting reads/writes to `auth.uid() = user_id`
- [ ] Every event appended to the local EventStore is pushed to the `events` table
- [ ] Sync queue retries with backoff on transient failure; queue survives a refresh
- [ ] On `pagehide`, pending events are flushed via `sendBeacon`
- [x] Snapshots are written to Supabase Storage on a debounced cadence (debounce window documented in the implementation)
- [ ] Every snapshot includes a `schemaVersion` integer field
- [ ] On sign-in on a fresh device, the client pulls the latest snapshot, applies it, then pulls and replays events newer than the snapshot's `as_of` timestamp
- [ ] On returning to a tab (`visibilitychange` → visible), the client pulls events newer than its local high-water mark
- [ ] `/study/home` shows a "Synced X ago" indicator; tapping it forces a pull
- [ ] Account-switch wipe (from slice 2) is followed by a restore-from-cloud for the new user
- [x] SyncEngine has tests for: event push ordering, retry/backoff, snapshot round-trip, fresh-device restore, account-switch wipe + restore
- [ ] An end-to-end test covers: log a session on device A → sign in on device B → see the session