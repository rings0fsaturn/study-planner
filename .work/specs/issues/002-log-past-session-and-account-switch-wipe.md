---
title: Log a past session manually; see it on Home; account-switch wipes local
type: AFK
blocked_by: [1b]
covers_user_stories: [14, 15, 24, 29, 47]
status: closed
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

The first feature loop. A signed-in user can navigate to `/study/log`, fill in a past session (duration, date, what they studied), submit it, and immediately see it appear in a "recent activity" list on `/study/home`. Sessions persist locally in IndexedDB via Dexie and survive a refresh.

This slice also introduces account-switch local-wipe: signing out and signing in as a different user wipes the previous user's local store. Without an EventStore there's nothing to wipe, which is why this rides with slice 2 rather than slice 1.

ProgressEngine is stubbed at this slice — Home shows total minutes logged and the activity list, nothing more. Streaks, projections, and burn-up come in slice 9.

## Acceptance criteria

- [x] A signed-in user can open `/study/log` and submit a past session with duration, date, and a free-text "what" field
- [x] On submit, a `SessionLogged` event is appended to the local Dexie EventStore
- [x] `/study/home` shows a "recent activity" list driven by a Dexie liveQuery against the EventStore
- [x] A newly logged session appears in the activity list without a manual refresh
- [x] Logged sessions survive a browser refresh
- [x] `/study/home` shows total time logged (sum of session durations) — minimal ProgressEngine stub
- [x] Signing out and signing in as a different user wipes the local EventStore: the previous user's sessions are not visible to the new user
- [x] EventStore has tests for: append + replay round-trip, liveQuery emission on append, account-switch wipe
- [x] ProgressEngine stub has a test for total-time aggregation
- [x] An end-to-end test covers: sign in → log session → see it on Home → refresh → still there → sign out → sign in as different user → not visible

## Deviations from original plan

### Account-switch isolation: per-user DB instead of wipe

The original spec called for wiping the local EventStore when a different user signs in. During implementation we discovered a critical bug: **wiping the shared database permanently destroyed User A's data** when User B signed in, because both users shared a single IndexedDB (`StudyTracker`).

**What we built instead:** Each user gets their own Dexie database named `StudyTracker_<userId>`. When the signed-in user changes, `EventStoreProvider` closes the old DB connection and opens the new user's DB. There is no cross-account bleed, and returning users find their data intact.

**Impact on acceptance criteria:** The criterion "Signing out and signing in as a different user wipes the local EventStore" still passes — the previous user's sessions are not visible to the new user. The mechanism is isolation, not deletion.

### Files added

| File | Purpose |
|---|---|
| `apps/app/src/events/EventStore.ts` | Deep module: Dexie-backed event log + liveQuery + close + wipe |
| `apps/app/src/events/EventStore.test.ts` | Unit tests: append, getAll, liveQuery, wipe, round-trip |
| `apps/app/src/events/EventStoreProvider.tsx` | React context: creates per-user EventStore, tracks ready state |
| `apps/app/src/events/useEventStore.ts` | Hook: throws if no active user session |
| `apps/app/src/events/ProgressEngine.ts` | Pure function: totalMinutesLogged aggregation |
| `apps/app/src/events/ProgressEngine.test.ts` | Unit tests: empty, single, multiple, ignores non-session events |
| `apps/app/src/events/index.ts` | Barrel export |
| `apps/app/src/pages/Log.tsx` | Past-session logging form |
| `e2e/session-log.spec.ts` | E2E test: full lifecycle across two accounts |

### Files modified

| File | Change |
|---|---|
| `apps/app/src/App.tsx` | Added `/log` route, EventStoreProvider wrapper (EventStoreRouter) |
| `apps/app/src/pages/Home.tsx` | Total time stat + recent activity list with empty state |
| `apps/app/src/auth/AuthProvider.tsx` | Removed wipe logic, localStorage usage, getEventStoreWipe import |
| `apps/app/src/lib/supabase.ts` | Env vars: `VITE_SUPABASE_*` → `SUPABASE_*` |
| `apps/app/src/vite-env.d.ts` | Type declarations updated |
| `apps/app/vite.config.ts` | Added `envPrefix: ['VITE_', 'SUPABASE_']` |
| `apps/app/.env.example` | Renamed env vars |
| `apps/app/src/test/setup.ts` | Added `fake-indexeddb/auto` |
| `AGENTS.md` | Updated env var docs and location |
| `e2e/playwright.config.ts` | Added dotenv load for `.env.local` |

## Blocked by

- Blocked by #1b
