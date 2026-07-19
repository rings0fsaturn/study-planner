---
title: Session-runtime events never reach cloud sync (SessionLifecycle bypasses sync_queue)
type: AFK
blocked_by: []
covers_user_stories: []
---

## Parent

PRD: `PRD-study-tracker-web.md` · Found in: `.work/plans/active/2026-07-03 third-review-report-work/research/01-app-architecture-and-data-flow.md` §4.3 / §4.6 and §5 finding #1 (architecture/research audit, 2026-07-03).

## What's wrong

`SessionLifecycle` writes its events straight to the local Dexie `events` table via
`EventStore.append()`, **never** through `SyncEngine.logEvent()` — so the events it emits
are never queued for cloud sync and never reach Supabase.

Evidence (verified by direct read, not inference):

- `apps/app/src/pages/Session.tsx:81-82` constructs the lifecycle with the **raw**
  `eventStore` returned by `useEventStore()`:
  ```ts
  const lc = new SessionLifecycle({ eventStore, /* ... */ })
  ```
- `apps/app/src/session/SessionLifecycle.ts` has exactly 5 event-emitting call sites
  (`start`, `pause`, `resume`, `doAbandon`, `logSession`), and every one calls
  `this.eventStore.append(...)` directly — the class never imports or calls
  `useSync()`/`SyncEngine.logEvent()`.
- `sync_queue` insertion happens **only** inside `SyncEngine.logEvent()`
  (`apps/app/src/sync/SyncEngine.ts:100`). Confirmed by repo-wide grep: `sync_queue` is
  referenced only in `SyncEngine.ts` and the Dexie schema declarations
  (`EventStoreProvider.tsx`) — nowhere in `SessionLifecycle.ts`.
- This means `SessionStarted`, `SessionPaused`, `SessionResumed`, `SessionAbandoned`, and
  **timer-completed** `SessionLogged` events (the primary way most sessions get logged) are
  written locally and **never flushed to Supabase**. They exist only on the device that
  produced them.
- **Manually-logged sessions are unaffected** — `apps/app/src/pages/Log.tsx` uses
  `useSync().logEvent(...)`, which correctly enqueues.
- This directly contradicts the design intent documented in the code itself, at
  `apps/app/src/session/types.ts:233`:
  > "This record is the local source of truth for the session UI. It is NOT synced to
  > Supabase directly — instead, the lifecycle events (SessionStarted, SessionPaused,
  > etc.) flow through the sync pipeline, and remote devices reconstruct the active
  > session from those events."

  The comment describes the intended design; the actual wiring in `Session.tsx` doesn't
  implement it.

## Product impact

Cross-device session history is incomplete for anyone using the in-app timer (the primary
session-logging path) — a user who studies on their phone and later opens the app on their
laptop will not see those sessions, their streak will be wrong, their calibration/progress
calculations (which read from local events only, so this is self-consistent per-device but
inconsistent across devices) will diverge, and a fresh-device restore (`SyncEngine`'s
snapshot-restore path) will silently omit every timer-based session ever logged. There is
currently no test coverage that would catch this — `SyncEngine.test.ts` never exercises
`SessionLifecycle` end-to-end.

## What to build

Route `SessionLifecycle`'s writes through the sync pipeline instead of (or in addition to)
the raw `EventStore`. Two viable approaches — pick one and note the choice in the PR:

**Option A — inject a sync-aware writer.** Change `SessionLifecycleDeps` to accept a
`logEvent: (kind: string, payload: Record<string, unknown>, createdAt?: string) => Promise<number>`
function (the same shape `useSync().logEvent` already has) instead of a raw `EventStore`,
and have `Session.tsx` pass `logEvent` from `useSync()`. `SessionLifecycle` would need a
separate raw `eventStore` reference kept only for its non-event-emitting reads/writes
(`table('activeSession')` persistence, `getAll()` for plan derivation) — those are local-only
by design and should stay on `EventStore` directly.

**Option B — make `EventStore.append` always sync-aware.** Have `SyncEngine`/`EventStoreProvider`
wrap `EventStore.append` so every append automatically enqueues to `sync_queue`, removing the
current split between "goes through `useSync().logEvent`" and "goes through raw
`eventStore.append`" as two different code paths with two different sync behaviors. This is a
bigger, more architectural change (touches the `EventStore`/`SyncEngine` contract) but removes
the whole class of "did I remember to use `logEvent`" bugs for future event-emitting code, not
just this one.

Whichever option is chosen, also decide what to do about **existing local-only session data**
already sitting in users' `events` tables un-synced — likely nothing retroactive is possible
(the queue only holds forward-looking writes), but note this as a known data gap in the fix's
PR description rather than silently moving on.

## Acceptance criteria

- [ ] `SessionStarted`, `SessionPaused`, `SessionResumed`, `SessionAbandoned`, and
      timer-completed `SessionLogged` events are enqueued to `sync_queue` at the same time
      they're appended locally (verify via a new test asserting `sync_queue` row count
      increases after each `SessionLifecycle` transition).
- [ ] A cross-device scenario test (two `SyncEngine` instances sharing a fake Supabase
      backend, per the pattern in `SyncEngine.test.ts`) confirms a timer-completed session
      logged on device A appears in device B's event log after a pull.
- [ ] `activeSession` table writes (local-only by design — used for same-device recovery)
      are **not** changed to sync — only the lifecycle *events* need to reach the cloud;
      remote devices already reconstruct active-session state from synced events per
      `SyncEngine.reconcileSessionState()`.
- [ ] The design-intent comment at `apps/app/src/session/types.ts:233` is either now
      accurate, or corrected to describe whatever the fixed behavior actually is.
- [ ] `pnpm --filter @study-tracker/app test` passes, including the new coverage above.
- [ ] `pnpm --filter @study-tracker/app typecheck` passes.

## Notes

**Severity: High.** This is a real data-completeness gap in the app's core value
proposition (cross-device sync), not a cosmetic issue, and it currently has zero test
coverage. Found via an architecture audit (2026-07-03), not reported by a user — worth
confirming with product/Rohit whether any users have already been affected (i.e., whether
a one-time backfill/reconciliation pass is also needed) before treating this as "just fix
the write path going forward."
