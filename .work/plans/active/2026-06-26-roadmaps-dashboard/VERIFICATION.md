# VERIFICATION — Roadmaps dashboard

Round-trips between agents. **Planner** pre-fills acceptance criteria. **Developer (Codex/Sonnet)** fills the implementer report per phase. **Reviewer (Cowork)** fills findings by diffing the reported commit SHA against the criteria. A phase is done only when the reviewer marks it `✅ Verified`.

- Plan: [`PLAN.md`](./PLAN.md)
- Slug: `2026-06-26-roadmaps-dashboard`
- Step 0 baseline commit (planning docs): `4d3bca9` (native side fills after `docs(plan): add roadmaps-dashboard plan + verification`)

Status legend: `☐` pending · `✅` met · `❌` failed · `➖` n/a.

## Redo protocol — what to do when a phase gets `🔁 Changes requested`

When the reviewer marks a phase `🔁 Changes requested`, the implementing agent (developer) does the following, in order. **Do not start a later phase until the redo is committed and the reviewer has re-verified** (a `🔁` phase blocks the phases that depend on it).

1. **Read the reviewer findings, not just the summary.** Implement exactly the bullets under that phase's **Required changes**. Do not re-architect, re-scope, or "improve" unrelated things in the same change — keep the redo surgical so the re-review diff is small.
2. **Add the regression test the finding asks for.** Every change request names a missing/failing test; add it and make it fail against the old code first, then pass with the fix (state both in the resolution).
3. **Commit the redo as its own commit**, separate from any in-flight later-phase work. Suggested message: `fix(<area>): <phase> redo — <one-line>`. **Never bundle a redo with Phase N+1 WIP** — it makes the SHA un-reviewable and risks shipping unfinished work. (Cowork cannot commit; if the fix is authored in Cowork, the native side commits it before anything else proceeds.)
4. **Fill the phase's `Resolution (Developer fills on redo)` block:** the redo **commit SHA** (not "pending" — a real SHA the reviewer can `git show`), the files changed, what changed, and the before/after test result. A resolution without a committed SHA cannot be re-verified.
5. **Set the resolution status to `✅ Fixed by developer; reviewer re-check pending`** and hand back. Do **not** flip the reviewer's `Status:` line yourself — only the reviewer marks `✅ Verified`.
6. **Reviewer re-check:** the reviewer `git show`s the redo SHA, confirms each required change + its test, and updates the phase's reviewer `Status:` to `✅ Verified (redo <sha> re-checked)` or back to `🔁` with new findings. Then the dependent phases unblock.

If the redo reveals the **plan itself** was wrong (not just the implementation), stop and surface it — amend `PLAN.md` and log a new `D-xx` decision rather than silently diverging.

---

## Phase 1 — Typed events + in-place lifecycle identity

### Acceptance criteria (pre-filled)

- [ ] `RoadmapReplannedPayload` (extends created shape + `roadmapCreatedAt`) and `RoadmapEditedPayload` added to `sync/types.ts`; `pnpm --filter app typecheck` clean.
- [ ] `deriveRoadmapLifecycle` groups roadmap events by stable identity (`RoadmapCreated.createdAt`; `RoadmapReplanned.payload.roadmapCreatedAt` points back) and surfaces the **latest snapshot per identity**.
- [ ] A replan chain (`Created(A)` + `Replanned(roadmapCreatedAt=A)` ×2) collapses to **one** `active` entry whose `roadmapCreatedAt === A` and whose `payload` is the latest snapshot.
- [ ] Terminal event on the original identity (`MarkedComplete(roadmapCreatedAt=A)`) moves the collapsed entry to `completed`, not `active`.
- [ ] `superseded` no longer appears in the active/history derivation (removed or unused).
- [ ] New tests in `roadmapLifecycle.test.ts` green: chain collapse, terminal-on-original, two-distinct-roadmaps.
- [ ] No `SessionLogged` payload change; no Dexie schema bump.

### Implementer report (Developer fills)

Files changed:
- `apps/app/src/sync/types.ts`
- `apps/app/src/roadmap/roadmapLifecycle.ts`
- `apps/app/src/roadmap/roadmapLifecycle.test.ts`
- `.work/plans/active/2026-06-26-roadmaps-dashboard/PLAN.md`

Commit SHA: `4631152`

What was done:
- Added typed `RoadmapReplannedPayload` with `roadmapCreatedAt` stable identity and optional replan `option`.
- Added typed `RoadmapEditedPayload` for future in-place slot edits.
- Refactored `deriveRoadmapLifecycle` to collapse `RoadmapCreated`/`RoadmapReplanned` events by original `RoadmapCreated.createdAt`, surfacing the latest snapshot for that identity.
- Removed `superseded` from `RoadmapLifecycleStatus` and `RoadmapLifecycleGroups`; current app code did not consume it outside the lifecycle module.
- Added/updated tests for replan-chain collapse, terminal events on the original identity, and two distinct original roadmaps with the older completed.

Deviations + why:
- The plan allowed keeping `superseded` only if other code imported it. Search showed no external consumers, so it was removed from the public lifecycle groups instead of kept unused.
- Default shell Node `v18.19.0` cannot run the app Vitest suite in this checkout because jsdom/html-encoding-sniffer loads an ESM dependency through `require()`. The same commands were rerun with Node `v22.17.1`, which is the working local Node path for this repo.
- The final commit SHA is recorded in this follow-up doc state because amending a self-referential SHA changes the commit hash.

Self-check vs criteria:
- ✅ `RoadmapReplannedPayload` and `RoadmapEditedPayload` are present in `sync/types.ts`.
- ✅ `deriveRoadmapLifecycle` groups by stable identity: `RoadmapCreated.createdAt` for originals, `RoadmapReplanned.payload.roadmapCreatedAt` for replans, with fallback to the event's own `createdAt`.
- ✅ Replan chain test proves one `active` entry with `roadmapCreatedAt === originalCreatedAt` and the latest payload.
- ✅ Terminal-on-original test proves `RoadmapMarkedComplete(roadmapCreatedAt=A)` moves the collapsed latest snapshot to `completed`.
- ✅ Distinct-roadmaps test proves older completed and newer active identities remain separate, with no `superseded` status.
- ✅ No `SessionLogged` payload change and no Dexie schema change.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app test -- roadmapLifecycle` passed: 39 test files, 411 tests.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app typecheck` passed.
- ✅ `grep -n "superseded" src/roadmap/roadmapLifecycle.ts` returned no matches, as expected.

### Reviewer findings (Cowork fills)

Reviewed by diff of commit `4631152` (read-only `git show`); tests not re-run in the Cowork sandbox (Node-version/jsdom block — same constraint as the calendar slice), so verdicts are diff + inspection against criteria.

- Per-criterion verdict:
  - ✅ Both payloads added to `sync/types.ts` verbatim (`RoadmapReplannedPayload extends RoadmapCreatedPayload` + `roadmapCreatedAt`; `RoadmapEditedPayload`).
  - ✅ Identity grouping correct — `roadmapIdentity()` returns `payload.roadmapCreatedAt` for replans (fallback to own `createdAt`), snapshot map keeps the latest event per identity.
  - ✅ Replan-chain collapse — `snapshotsByIdentity` + `activeIdentity` yield one active entry with `roadmapCreatedAt === A` and the latest payload; test `collapses a replan chain into one active entry` asserts `all.length === 1`.
  - ✅ Terminal-on-original — `latestTerminalFor` now keys on identity; test proves `MarkedComplete(A)` → `completed`, not `active`.
  - ✅ `superseded` removed from the status union and `RoadmapLifecycleGroups`; `grep` clean.
  - ✅ All three required tests present and asserting the right shapes.
  - ✅ No `SessionLogged` change, no Dexie bump.
- Issues:
  - Minor (non-blocking): an *orphan* roadmap that is neither terminated nor the most-recent identity is now **dropped from `all`** (status stays `null`). Previously it was `superseded` — but that group was never rendered, so this is not a UI regression. Under D-01 (one active, old roadmaps get terminal events) it shouldn't arise; worth a note only.
  - Minor: `activeIdentity` is chosen by identity `createdAt` (original), not latest event time. Correct for well-formed data; in malformed multi-active data it could pick a different "active" than the old latest-event logic. Acceptable under D-01.
- Required changes: none.
- **Status:** ✅ Verified

### Resolution (Developer fills on redo)

---

## Phase 2 — Session attribution by date window

### Acceptance criteria (pre-filled)

- [ ] `completedSlotCount` filters `SessionLogged` to those whose `date` is within the roadmap's `[startDate, deadline]` (inclusive, ISO-string compare).
- [ ] A session dated outside a roadmap's window does NOT count toward its `completedSlots`/`percentComplete`.
- [ ] Two historical roadmaps each count only their own window's sessions (frozen history).
- [ ] Active roadmap still shows live progress; `findRoadmap` semantics (latest = active) unchanged.
- [ ] Gap-sessions (outside any window) documented as global-stats-only (comment present).
- [ ] New window tests in `roadmapLifecycle.test.ts` green; typecheck clean.

### Implementer report (Developer fills)

Files changed:
- `apps/app/src/roadmap/roadmapLifecycle.ts`
- `apps/app/src/roadmap/roadmapLifecycle.test.ts`
- `apps/app/src/progress/mapEvents.ts`
- `.work/plans/active/2026-06-26-roadmaps-dashboard/PLAN.md`

Commit SHA: `37a0361`

What was done:
- Added inclusive `[startDate, deadline]` filtering inside `completedSlotCount` before sessions can match roadmap slots.
- Added a D-06 comment in `mapEvents.ts` documenting that gap sessions remain available to global stats while roadmap progress scopes by date window.
- Added tests proving an out-of-window matching slot/session pair does not count and separate roadmap windows each count their own sessions.

Deviations + why:
- The out-of-window exclusion test uses a deliberately inconsistent roadmap slot date to make the window filter observable; normal generated slots should already live inside their roadmap window, but the contract is about session attribution and the filter should be explicit.
- `findRoadmap` behavior was left unchanged per plan. No behavior change was needed outside `completedSlotCount`.
- Verification used Node `v22.17.1`; default shell Node `v18.19.0` remains unsuitable for this app Vitest suite.
- The final commit SHA is recorded in this follow-up doc state because amending a self-referential SHA changes the commit hash.

Self-check vs criteria:
- ✅ `completedSlotCount` filters sessions to the roadmap's inclusive date window before matching slots.
- ✅ A session outside the roadmap window does not count toward `completedSlots` or `percentComplete`.
- ✅ Two roadmap windows each count their own dated sessions.
- ✅ Active roadmap progress still updates from live sessions; `findRoadmap` semantics were not changed.
- ✅ Gap-session/global-stats-only behavior is documented in `mapEvents.ts`.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app test -- roadmapLifecycle` passed: 39 test files, 413 tests.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app typecheck` passed.

### Reviewer findings (Cowork fills)

Reviewed by diff of commit `37a0361`.

- Per-criterion verdict:
  - ✅ `completedSlotCount` adds `inWindow(date)` = `date >= startDate && date <= deadline` and filters sessions before the greedy slot match. Inclusive, ISO-string compare (safe for `YYYY-MM-DD`).
  - ✅ Out-of-window session excluded — test `does not count sessions outside a roadmap window toward progress`.
  - ✅ Per-window counting — test `counts sessions only inside each roadmap window`.
  - ✅ `findRoadmap` unchanged; active still = latest.
  - ✅ Gap-session/global-stats-only documented in both `roadmapLifecycle.ts` and `mapEvents.ts` (D-06 comments).
  - ✅ Two window tests present.
- Issues: none. (Minor, shared with Phase 5: "today"/window edges use UTC-derived ISO dates; off-by-one possible near local midnight — acceptable and internally consistent.)
- Required changes: none.
- **Status:** ✅ Verified

### Resolution (Developer fills on redo)

---

## Phase 3 — Re-entrant onboarding + nav/routing reshape

### Acceptance criteria (pre-filled)

- [ ] NavBar item points at `/roadmaps`, label "Roadmaps"; both `/roadmaps` and `/roadmap` highlight it (prefix match verified).
- [ ] `OnboardingGate` does NOT redirect to `/home` when in new-roadmap mode (`?new=1` or `state.newRoadmap`), even though `OnboardingCompleted` exists.
- [ ] First-run gating preserved: with no `OnboardingCompleted`, the gate behaves exactly as before.
- [ ] `Step3Preview.handleCommit` branches: new-mode + active → save draft, no `RoadmapCreated`/no second `OnboardingCompleted`, `navigate('/roadmaps')`.
- [ ] new-mode + no active → emit `RoadmapCreated` (no duplicate `OnboardingCompleted`), clear draft, `navigate('/roadmaps')`.
- [ ] first-run → unchanged emits + `navigate('/onboarding/4')`.
- [ ] `RoadmapCalendar` (non-readOnly) shows a "← Roadmaps" back link to `/roadmaps` (no `/study` in `to`).
- [ ] Onboarding/gate tests green for: new-mode opens despite completion, first-run still redirects, draft-vs-start branch behavior.

### Implementer report (Developer fills)

Files changed:
- `apps/app/src/components/NavBar.tsx`
- `apps/app/src/onboarding/OnboardingGate.tsx`
- `apps/app/src/onboarding/OnboardingGate.test.tsx`
- `apps/app/src/onboarding/steps/Step3Preview.tsx`
- `apps/app/src/onboarding/steps/Step3Preview.test.tsx`
- `apps/app/src/roadmap/RoadmapCalendar.tsx`
- `apps/app/src/roadmap/roadmap.css`
- `.work/plans/active/2026-06-26-roadmaps-dashboard/PLAN.md`

Commit SHA: `0fc02ce`

What was done:
- Changed the NavBar roadmap item to label `Roadmaps` and route to `/roadmaps`, keeping prefix matching for both `/roadmaps` and `/roadmap`.
- Added `newRoadmapMode` detection in `OnboardingGate` from `?new=1` or router state `{ newRoadmap: true }`.
- Updated `Step3Preview.handleCommit` to branch by existing events: first-run remains unchanged; completed-user new mode with active roadmap saves the draft and returns to `/roadmaps`; completed-user new mode with no active roadmap emits `RoadmapCreated`, avoids duplicate `OnboardingCompleted`, clears draft, and returns to `/roadmaps`.
- Added a non-readOnly calendar back link to `/roadmaps`.
- Added tests for gate query/state modes and the two new preview commit branches.

Deviations + why:
- No `App.tsx` structural route change was needed because `/onboarding`, `/roadmap`, and `/roadmaps` already existed.
- The calendar back link uses `&larr;` in source so the rendered label matches the plan while keeping the file ASCII.
- Verification used Node `v22.17.1`; default shell Node `v18.19.0` remains unsuitable for this app Vitest suite.
- The final commit SHA is recorded in this follow-up doc state because amending a self-referential SHA changes the commit hash.

Self-check vs criteria:
- ✅ NavBar item points at `/roadmaps`, label `Roadmaps`, with prefix `/roadmap`.
- ✅ `OnboardingGate` bypasses the completed redirect in new-roadmap mode via query param or router state.
- ✅ Completed-without-new-mode guard still hides the wizard.
- ✅ `Step3Preview` active-new-mode path saves the draft, emits no `RoadmapCreated`, emits no duplicate `OnboardingCompleted`, and navigates to `/roadmaps`.
- ✅ `Step3Preview` completed/no-active new-mode path emits `RoadmapCreated`, emits no duplicate `OnboardingCompleted`, clears the draft, and navigates to `/roadmaps`.
- ✅ First-run behavior remains covered by the existing onboarding flow test: `MaterialAdded` events, then `RoadmapCreated`, then `OnboardingCompleted`.
- ✅ `RoadmapCalendar` renders a non-readOnly back link to `/roadmaps`; no `/study` prefixes were introduced.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app test -- Onboarding` passed: 39 test files, 418 tests.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app typecheck` passed.

### Reviewer findings (Cowork fills)

Reviewed by diff of commit `0fc02ce`.

Phase 3 (`0fc02ce`) — 🔁 Changes requested. One real defect: in `Step3Preview.handleCommit`, the `MaterialAdded` emission loop runs before the save-as-draft branch. So saving a next-roadmap draft writes N `MaterialAdded` events to the global log even though no `RoadmapCreated` is emitted. Since `mapToRegenerateRequest` reads all `MaterialAdded` events with no roadmap scoping, the draft's materials leak into the active roadmap's replan input, and they get re-emitted/duplicated when the draft is later started. Fix: move the draft branch to the top of the `try`, before the loop, so a draft save emits zero events; its state already lives in `onboardingDraft`. Everything else in Phase 3 — gate bypass, nav change, no-active commit path, and back link — is correct.

- Per-criterion verdict:
  - ✅ NavBar item → `/roadmaps`, label "Roadmaps", `prefix: '/roadmap'`; `isActive` uses `pathname.startsWith(prefix)` so both `/roadmaps` and `/roadmap` highlight it. Verified.
  - ✅ `OnboardingGate` bypasses the `/home` redirect in new-roadmap mode (`?new=1` or `state.newRoadmap`); first-run gating preserved.
  - ✅ new-mode + no active → emits `RoadmapCreated`, skips duplicate `OnboardingCompleted`, clears draft, navigates `/roadmaps`.
  - ✅ first-run → `RoadmapCreated` + `OnboardingCompleted`, navigate `/onboarding/4`.
  - ✅ Calendar (non-readOnly) renders `← Roadmaps` back link `to="/roadmaps"` (no `/study`).
  - ⚠️ new-mode + active → returns to `/roadmaps` without emitting `RoadmapCreated`/`OnboardingCompleted` — **but see the defect below**: it returns *after* the `MaterialAdded` loop has already fired.
- Issues:
  - 🔴 **Premature `MaterialAdded` on save-as-draft (functional defect).** In `Step3Preview.handleCommit`, the `for (const mat of expandedMaterials) { logEvent('MaterialAdded', …) }` loop runs *before* the `if (newRoadmapMode && hasCompletedOnboarding && hasActiveRoadmap) { navigate('/roadmaps'); return }` branch. So saving a next-roadmap draft writes N `MaterialAdded` events into the global log even though no `RoadmapCreated` is emitted. Because `mapToRegenerateRequest.materialPayloads(events)` reads **all** `MaterialAdded` events with no roadmap scoping, the consequences are: (1) the draft's materials **leak into the currently-active roadmap's replan input** (load-bearing for Phase 7 / issue 010); (2) when the draft is later resumed and started, `MaterialAdded` fires **again** → duplicate `materialId` events. A draft must not write to the event log — its state already persists in the `onboardingDraft` row via `OnboardingProvider`.
- Required changes:
  - Move the save-as-draft branch to the **top of the `try`**, before the `MaterialAdded` loop (compute `existingEvents`/`hasCompletedOnboarding`/`hasActiveRoadmap` there). The draft path must emit **zero** events and simply `navigate('/roadmaps')`. Add a test asserting that finishing a new roadmap while one is active emits **no** `MaterialAdded` and **no** `RoadmapCreated`.
- **Status:** ✅ Verified (redo `521cd6d` re-checked 2026-06-27)

**Reviewer re-check (`521cd6d`):** Confirmed by `git show` — the draft branch is now the first thing in the `try`, ahead of the `MaterialAdded` loop, so the draft path emits zero events. Test `finishing a new roadmap while one is active saves a draft without creating another roadmap` (Step3Preview.test.tsx:278) now asserts `MaterialAdded` length 0 **and** `not.toContain('RoadmapCreated')` **and** navigation to `/roadmaps`; the no-active sibling test still asserts exactly one `MaterialAdded` + one `RoadmapCreated`. Change request fully resolved.

### Resolution (Developer fills on redo)

Commit SHA: `521cd6d`

What changed:
- Moved the new-roadmap + active-roadmap draft branch to the top of `Step3Preview.handleCommit`, before any `MaterialAdded` emission.
- Updated the active-plan draft test to assert zero `MaterialAdded`, zero `RoadmapCreated`, and zero duplicate `OnboardingCompleted` events.

Verification:
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app test -- Step3Preview Onboarding` passed: 45 test files, 440 tests.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app typecheck` passed.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm lint` passed with existing warnings only.

Status after redo: ✅ Fixed by developer; reviewer re-check pending.

---

## Phase 4 — Roadmaps dashboard

### Acceptance criteria (pre-filled)

- [ ] `roadmapDraft.ts::deriveRoadmapDraft` returns `null` when no `OnboardingCompleted`, or `stepReached <= 1`, or no `deadline`; returns a summary (title fallback "Untitled plan", correct `stepLabel`) otherwise.
- [ ] Dashboard renders three zones: Active hero (title, range, weeks, progress, actions Open / Edit & add / Close), Next-up draft, History (completed + abandoned rows → read-only calendar).
- [ ] Active hero shows progress and at least sessions + percent (richer stats per OQ-01 or follow-up filed).
- [ ] Draft card appears only after step 1 (D-12); shows "paused at step N · <label>"; lock note present when a plan is active.
- [ ] **Start plan** disabled while a plan is active; enabled only when none active (non-overlap, D-01/D-04); promotion routes through `/onboarding/<step>?new=1`, NOT a direct `RoadmapCreated` from the dashboard.
- [ ] Close (Complete/Abandon) goes through the shared resolve helper (same path as the calendar); on close with a draft, an inline "Ready to start <draft>?" prompt appears.
- [ ] Empty state ("Plan your next roadmap" → `/onboarding?new=1`) when no active plan and no draft.
- [ ] Read-only history detail unchanged (clicking a row opens `RoadmapCalendar readOnly`).
- [ ] Tests green: `roadmapDraft` thresholds, dashboard Start-disabled-while-active, draft-after-step-1, close→prompt; typecheck + lint clean.

### Implementer report (Developer fills)

Files changed:
- `apps/app/src/App.tsx`
- `apps/app/src/pages/Roadmaps.tsx`
- `apps/app/src/pages/Roadmaps.test.tsx`
- `apps/app/src/roadmap/RoadmapCalendar.tsx`
- `apps/app/src/roadmap/resolveRoadmap.ts`
- `apps/app/src/roadmap/roadmap.css`
- `apps/app/src/roadmap/roadmapDraft.ts`
- `apps/app/src/roadmap/roadmapDraft.test.ts`
- `.work/plans/active/2026-06-26-roadmaps-dashboard/PLAN.md`

Commit SHA: `2cba6cf`

What was done:
- Added `deriveRoadmapDraft`, which reads the existing `onboardingDraft` row and exposes a dashboard-ready summary only for completed users with meaningful post-step-1 draft state.
- Reworked `/roadmaps` into a dashboard with Active, Next up, and History zones.
- Added the active roadmap hero with title, date range, weeks, progress bar, session count, logged time, percent complete, and actions for Open plan, Edit & add, and Close plan.
- Added a Next-up draft card with resume/start/discard controls, active-plan lock messaging, and no direct `RoadmapCreated` emission from the dashboard.
- Extracted shared terminal-event emission into `resolveRoadmap.ts` and made both the dashboard and `RoadmapCalendar` use it.
- Added an inline "Ready to start <draft>?" prompt after closing an active roadmap while a draft exists.
- Preserved `/onboarding?new=1` through the onboarding index redirect so the exact empty-state route keeps new-roadmap mode.
- Added tests for draft thresholds, active hero rendering, active-plan start locking, enabled start when no active plan exists, draft presence, close prompt, and read-only history detail.

Deviations + why:
- `App.tsx` was touched even though Phase 4's main file list was the dashboard/roadmap modules. The direct `/onboarding?new=1` route requested by the plan would otherwise hit the onboarding index redirect and lose its query string before `OnboardingGate` could keep new-roadmap mode active.
- The active hero stat strip implements sessions, logged time, and percent complete. Richer streak/projection stats remain covered by the plan's OQ-01 follow-up.
- Verification used Node `v22.17.1`; default shell Node `v18.19.0` remains unsuitable for this app Vitest/jsdom stack.
- `pnpm lint` passed with 9 existing `no-explicit-any` warnings in unrelated files (`OnboardingGate.test.tsx`, `YouTubePlayerAdapter.test.ts`, `loadYouTubeApi.ts`).
- The final commit SHA is recorded in this follow-up doc state because amending a self-referential SHA changes the commit hash.

Self-check vs criteria:
- ✅ `deriveRoadmapDraft` returns `null` when onboarding is incomplete, step is `<= 1`, or deadline is missing; it returns title fallback and correct step labels otherwise.
- ✅ Dashboard renders Active hero, Next-up draft, and History zones.
- ✅ Active hero shows title, range, weeks, progress, session count, logged time, percent complete, and Open / Edit & add / Close actions.
- ✅ Draft card appears only when a derived post-step-1 draft exists and shows `Paused at step N · <label>` plus the active-plan lock note.
- ✅ Start plan is disabled while a roadmap is active and enabled when no roadmap is active; it navigates to `/onboarding/<step>?new=1` and does not emit `RoadmapCreated` directly.
- ✅ Complete/Abandon actions use the shared resolver; closing with a draft shows the inline ready-to-start prompt.
- ✅ Empty state routes to `/onboarding?new=1`; `App.tsx` preserves that search query into `/onboarding/1`.
- ✅ Read-only history detail remains available by selecting a completed/abandoned row.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app test -- Roadmaps roadmapDraft` passed: 41 test files, 429 tests.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app typecheck` passed.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm lint` passed with existing warnings only.

### Reviewer findings (Cowork fills)

Reviewed by diff of commit `2cba6cf`.

- Per-criterion verdict:
  - ✅ `deriveRoadmapDraft` returns `null` for `!hasCompletedOnboarding`, missing `deadline`, or `stepReached <= 1`; otherwise `{ title: purpose||'Untitled plan', stepReached, stepLabel }` with the correct label map.
  - ✅ Dashboard renders Active hero / Next-up draft / History; hero shows title, range, weeks, progress, sessions + logged time + percent.
  - ✅ Draft card appears only post-step-1 (D-12); shows "Paused at step N · <label>" + lock note when active.
  - ✅ **Start plan** `disabled={activeEntry !== null}`; promotion via `onboardingPath()` = `/onboarding/<step>?new=1` — no direct `RoadmapCreated` from the dashboard.
  - ✅ Close goes through shared `resolveRoadmap` (calendar adopted the same helper this phase); close-with-draft shows the inline "Ready to start <title>?" prompt → Start now routes to `onboardingPath`.
  - ✅ Empty state → `/onboarding?new=1`; `OnboardingIndexRedirect` preserves `search`+`state` so new-mode survives the index redirect (good catch on the `App.tsx` deviation).
  - ✅ Read-only history detail preserved; Discard uses `onboardingDraft.delete(1)`.
- Issues:
  - The Next-up draft card surfaces the draft correctly, but its trustworthiness depends on the Phase 3 fix — until then a draft also leaves stray `MaterialAdded` events (Phase 3 defect), which doesn't break the dashboard but pollutes the log. No change needed in Phase 4 itself.
- Required changes: none (dashboard is correct as committed).
- **Status:** ✅ Verified

### Resolution (Developer fills on redo)

---

## Phase 5 — Deadline-passed banner

### Acceptance criteria (pre-filled)

- [ ] `useRoadmapEndedState` returns `ended === true` only for an active entry whose `deadline < today` with no terminal event; `false` for future-deadline or terminated plans.
- [ ] `RoadmapEndedBanner` is a non-dismissible (no close control) inline banner with exactly three actions: Mark complete, Extend deadline (→ `/replan`), Abandon.
- [ ] Banner mounted as the first child on Home (independent of `RecalibrationBanner`), only when ended.
- [ ] Dashboard active hero flips its pill to "● Ended — needs review" and surfaces the three actions when ended.
- [ ] Calendar (non-readOnly) shows the banner strip atop when ended.
- [ ] Mark complete / Abandon route through the shared resolve helper (same terminal events).
- [ ] Tests green: hook truth table (past/future/terminated), banner renders three actions + no dismiss; typecheck clean.

### Implementer report (Developer fills)

Files changed:
- `apps/app/src/pages/Home.tsx`
- `apps/app/src/pages/Roadmaps.tsx`
- `apps/app/src/pages/Roadmaps.test.tsx`
- `apps/app/src/roadmap/RoadmapCalendar.tsx`
- `apps/app/src/roadmap/RoadmapEndedBanner.tsx`
- `apps/app/src/roadmap/RoadmapEndedBanner.test.tsx`
- `apps/app/src/roadmap/roadmap.css`
- `apps/app/src/roadmap/useRoadmapEndedState.ts`
- `apps/app/src/roadmap/useRoadmapEndedState.test.ts`
- `.work/plans/active/2026-06-26-roadmaps-dashboard/PLAN.md`

Commit SHA: `03a2537`

What was done:
- Added `useRoadmapEndedState.ts` with a pure `deriveRoadmapEndedState` helper and a live hook for active-plan ended detection.
- Added `RoadmapEndedBanner`, a non-dismissible inline banner with Mark complete, Extend deadline, and Abandon actions.
- Mounted the ended banner as the first child in `Home.tsx`, above the date/greeting header and independent of `RecalibrationBanner`.
- Mounted the banner in the dashboard active hero and changed the active status pill to `• Ended — needs review` when the active deadline has passed.
- Mounted the banner at the top of non-readOnly `RoadmapCalendar`.
- Routed Mark complete and Abandon through the shared `resolveRoadmap` helper everywhere; Extend deadline links to `/replan`.
- Added tests for ended-state past/future/terminal truth table, the hook itself, banner actions/no-dismiss control, and dashboard ended rendering.

Deviations + why:
- Home, Roadmaps, and Calendar use the pure derivation from the hook module where they already have event arrays in scope, avoiding duplicate live queries while keeping the exported hook available and directly tested.
- `RoadmapEndedBanner` accepts an optional `onExtendDeadline` for testability while still rendering the required `/replan` link.
- Verification used Node `v22.17.1`; default shell Node `v18.19.0` remains unsuitable for this app Vitest/jsdom stack.
- `pnpm lint` passed with the same 9 existing `no-explicit-any` warnings in unrelated files.
- The final commit SHA is recorded in this follow-up doc state because amending a self-referential SHA changes the commit hash.

Self-check vs criteria:
- ✅ Ended state is true only for an active entry whose `deadline < today`; future active plans and completed past-deadline plans return false.
- ✅ `RoadmapEndedBanner` is non-dismissible and renders exactly three actions: Mark complete, Extend deadline, Abandon.
- ✅ Home renders the banner before the date/greeting header when ended, separate from `RecalibrationBanner`.
- ✅ Dashboard status pill flips to `• Ended — needs review` and surfaces the same three banner actions.
- ✅ Calendar renders the banner only for non-readOnly active ended plans.
- ✅ Mark complete and Abandon route through the shared resolve helper.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app test -- RoadmapEnded useRoadmapEndedState` passed: 43 test files, 435 tests.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app typecheck` passed.
- ✅ Extra guard: `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm lint` passed with existing warnings only.

### Reviewer findings (Cowork fills)

Reviewed by diff of commit `03a2537`.

- Per-criterion verdict:
  - ✅ `deriveRoadmapEndedState` (pure) + `useRoadmapEndedState` (live) compute `ended = active[0].deadline < today`. Terminated plans aren't `active` (Phase 1), so completed/abandoned past-deadline → `ended: false`; future deadline → `false`. Matches the truth table.
  - ✅ `RoadmapEndedBanner` is non-dismissible (no close control) with exactly three actions: Mark complete, Extend deadline (`<Link to="/replan">`), Abandon. `role="status"`.
  - ✅ Mounted on Home as the **first child** of the outer wrapper, above the date header, independent of `RecalibrationBanner`, only when `ended`.
  - ✅ Dashboard flips the pill to "• Ended — needs review" and surfaces the banner, scoped to the active entry (`activeEnded` guards by `roadmapCreatedAt`).
  - ✅ Calendar mounts the banner only when `!readOnly && ended && matches selected`.
  - ✅ Mark complete / Abandon route through shared `resolveRoadmap` on all three surfaces.
  - ✅ Hook truth-table tests + banner action/no-dismiss tests present.
- Issues:
  - Minor: `todayISO()` uses `new Date().toISOString().slice(0,10)` (UTC). Near local midnight the "ended" flip can be off by one day. Consistent with Phase 2; acceptable. Note only.
- Required changes: none.
- **Status:** ✅ Verified

### Resolution (Developer fills on redo)

---

## Phase 6 — Add-session quick-log + inline light edits

### Acceptance criteria (pre-filled)

- [ ] `logRoadmapEdit.ts` emits a `RoadmapEdited` event keyed to the active roadmap identity (`roadmapCreatedAt`) with the slot fields.
- [ ] Calendar day-tap (non-readOnly) opens a log action pre-filled with that day's date + slot material/title; emits `SessionLogged` that attributes by date window (D-06).
- [ ] Inline light edits (rename, move material, mark done, nudge minutes) emit `RoadmapEdited`; they are future-only (past/locked days not editable).
- [ ] Emitted `RoadmapEdited` is consumed as a `user-edited` pin by `mapToRegenerateRequest` (integration assertion).
- [ ] `readOnly` (history) mode renders NONE of the new edit/log affordances.
- [ ] No structural reflow happens here (that's `/replan`, Phase 7).
- [ ] Tests green: `logRoadmapEdit`, calendar log + rename, readOnly gating; typecheck clean.

### Implementer report (Developer fills)

Files changed:
- `apps/app/src/roadmap/RoadmapCalendar.tsx`
- `apps/app/src/roadmap/RoadmapCalendar.test.tsx`
- `apps/app/src/roadmap/SessionDetailModal.tsx`
- `apps/app/src/roadmap/edit/logRoadmapEdit.ts`
- `apps/app/src/roadmap/edit/logRoadmapEdit.test.ts`
- `apps/app/src/roadmap/replan/mapToRegenerateRequest.test.ts`
- `apps/app/src/roadmap/roadmap.css`
- `.work/plans/active/2026-06-26-roadmaps-dashboard/PLAN.md`

Commit SHA: `c771f63`

What was done:
- Added `logRoadmapEdit`, a helper that emits typed `RoadmapEdited` payloads through the shared sync `logEvent` path.
- Added future-only quick actions to the roadmap session detail modal for planned slot bubbles: Log session, rename session title, nudge planned minutes, move to next day, and mark done/undone.
- Gated all new quick actions behind non-readOnly mode and future/today slot dates; read-only history still shows inspection-only modal actions.
- `Log session` emits `SessionLogged` with the slot date, material id, planned duration, role, and source `roadmap`, so the session attributes by the roadmap date window.
- Inline edits emit `RoadmapEdited` keyed by the active roadmap identity.
- Added integration coverage proving `RoadmapEdited` events become `user-edited` pins in `mapToRegenerateRequest`.

Deviations + why:
- The plan's "move material to another day" is implemented as a simple "Move to next day" light edit in this phase. Full arbitrary drag/drop or day picker belongs with the broader Phase 7 `/replan` editing flow.
- "Mark done" logs the planned session and records a `RoadmapEdited` pin; "Mark undone" records a `RoadmapEdited` pin only. The current event model has no delete-session/undo-session event, so true undo of already-logged time is intentionally not invented here.
- Verification used Node `v22.17.1`; default shell Node `v18.19.0` remains unsuitable for this app Vitest/jsdom stack.
- `pnpm lint` passed with the same 9 existing `no-explicit-any` warnings in unrelated files.
- The final commit SHA is recorded in this follow-up doc state because amending a self-referential SHA changes the commit hash.

Self-check vs criteria:
- ✅ `logRoadmapEdit` emits `RoadmapEdited` with roadmap identity and slot fields.
- ✅ Calendar quick Log session emits `SessionLogged` with tapped slot date and material id.
- ✅ Inline rename, minute nudge, move-next-day, and done-toggle actions emit `RoadmapEdited`.
- ✅ Edits are future-only and hidden in readOnly history mode.
- ✅ `RoadmapEdited` is consumed as a `user-edited` pin by `mapToRegenerateRequest`.
- ✅ No structural reflow is performed in this phase; `/replan` remains the structural path.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app test -- RoadmapCalendar logRoadmapEdit` passed: 45 test files, 440 tests.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app typecheck` passed.
- ✅ Extra guard: `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm lint` passed with existing warnings only.

### Reviewer findings (Cowork fills)

Reviewed by diff of commit `c771f63` (read-only `git show`); tests not re-run in the sandbox (diff + inspection).

- Per-criterion verdict:
  - ✅ `logRoadmapEdit` emits a typed `RoadmapEdited` event; `editPayloadForBubble` keys it on `selectedRoadmap.roadmapCreatedAt` (= identity, post-Phase-1) with the slot fields.
  - ⚠️ Day-tap "Log session" emits `SessionLogged` with the slot `date` + `materialId` + role/duration, so it **does** attribute by date window (D-06) — **but** it sets `source: 'roadmap'` (see defect below).
  - ✅ Inline light edits (rename, ±15 min nudge, move-to-next-day, mark done/undone) emit `RoadmapEdited`; gated future-only via `isEditableBubble` (`!readOnly && slotRef && date >= today`).
  - ✅ Integration test `maps RoadmapEdited events into user-edited pins` proves the pin path.
  - ✅ `readOnly` mode renders none of the new affordances (`canEdit` requires `!readOnly`; the modal falls back to the disabled button).
  - ✅ No structural reflow performed here.
- Issues:
  - 🔴 **`source: 'roadmap'` breaks streak credit and violates the `source` union (functional defect).** `handleLogSession` emits `SessionLogged` with `source: 'roadmap'`, but `source` is a load-bearing enum: `packages/progress/src/streak.ts` counts a day only when `sess.source === 'manual'`, and `calibration/bayesian/trend/cusum` key on `=== 'active'`. `mapEvents.ts` types the field `'active' | 'manual'` via a cast, so `'roadmap'` is a type lie that passes silently. Net effect: a session logged from the roadmap calendar **does not count toward the streak**, while the identical session logged via the Log page (`'manual'`) does — a surprising, inconsistent regression for the headline "add sessions" feature. (Roadmap progress via `completedSlotCount` is unaffected — it matches on date+materialId, not source — and exclusion from `'active'` calibration is fine.)
  - 🟠 **`mark done` re-logs on every tap unless already done; `mark undone` is a near no-op.** Acknowledged deviation (no undo-session event in the model). Acceptable, but "Mark undone" emits a `RoadmapEdited` pin identical to the slot and cannot remove the already-logged `SessionLogged`, so the UI can imply an undo that didn't happen. Consider hiding "Mark undone" until an undo-session event exists, or labelling it accurately.
  - 🟡 Note (non-blocking): quick actions live in `SessionDetailModal` (desktop hover/session modal). The mobile `DayDetailModal` (day-sheet) was not given the same affordances — confirm the mobile path reaches `SessionDetailModal`, else mobile users can't quick-log/edit.
  - 🟡 Cross-phase risk for Phase 7: `userEditedPins(events, roadmapEvent.createdAt)` matches `RoadmapEdited.roadmapCreatedAt` against `latestActiveRoadmapEvent.createdAt`. After an in-place replan (Phase 7), the latest active event is a `RoadmapReplanned` whose `createdAt` ≠ the identity that edits are keyed to, so user-edited pins could be dropped. Match by identity, not latest-event `createdAt`, in Phase 7.
- Required changes:
  - Emit roadmap quick-logged sessions with `source: 'manual'` (they're user-asserted, like Log-page entries) so they earn streak credit and stay within the `'active' | 'manual'` union — **or** explicitly extend the union to include `'roadmap'` and update `streak.ts` (+ `mapEvents.ts` typing) to count it. Add a test asserting a roadmap-logged session increments the streak.
- **Status:** ✅ Verified on working tree (redo SHA pending native commit) — 2026-06-27

**Reviewer re-check (`d544994`):** The required change is correctly applied — `RoadmapCalendar.tsx` emits `source: 'manual'` and no `'roadmap'` source remains in the file; `RoadmapCalendar.test.tsx` asserts the emitted source is `manual`; and `packages/progress/test/streak.test.ts` adds `roadmap quick-log sessions use manual credit and count toward the streak grid`, which proves a manual-credit session lands in the streak grid (`todayCell.level === 1`). The two non-blocking notes (mark-undone no-op; mobile day-sheet affordances) remain open follow-ups, not blockers. The Phase 6 fix was committed separately before Phase 7, so the redo is reviewable independently.

### Resolution (Developer fills on redo)

Files changed:
- `apps/app/src/roadmap/RoadmapCalendar.tsx`
- `apps/app/src/roadmap/RoadmapCalendar.test.tsx`
- `packages/progress/test/streak.test.ts`

Commit SHA: `d544994`

What changed:
- Changed the roadmap calendar quick-log `SessionLogged` payload from `source: 'roadmap'` to `source: 'manual'`, matching the existing `SessionEvent` union and the Log page semantics.
- Updated the calendar quick-log test to assert the emitted source is `manual`.
- Added a progress-package regression asserting the manual-credit path used by roadmap quick-log sessions contributes to the streak grid.

Verification:
- ✅ Before the implementation change, `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app test -- RoadmapCalendar` failed because quick-log emitted `source: 'roadmap'` instead of `manual`.
- ✅ After the implementation change, `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app test -- RoadmapCalendar` passed: 45 test files, 440 tests.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter @study-tracker/progress test -- streak` passed: 9 test files, 81 tests.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm typecheck` passed.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm lint` passed with the same 9 existing warnings only.

Status after redo: ✅ Fixed by developer; reviewer re-check completed; committed as `d544994`.

---

## Phase 7 — `/replan` preview-and-confirm + in-place commit

### Acceptance criteria (pre-filled)

- [ ] `parseRoadmapOutput` runtime-validates the regenerate response (shape check on `weeks[]`/`warnings`) and throws a typed error on malformed input instead of casting; no bad `RoadmapReplanned` is committed.
- [ ] `commitReplan.ts` emits exactly one `RoadmapReplanned` whose `roadmapCreatedAt === original active identity` and whose slots are the regenerated set.
- [ ] After commit, `deriveRoadmapLifecycle` shows ONE active entry with the new slots (in place, D-07) — not a new/superseded sibling.
- [ ] `/replan` renders a preview of the regenerated rest-of-plan (reusing Step3Preview presentation) + a pin summary ("N locked, M re-planned").
- [ ] Actions: Apply → commit + `navigate('/roadmap')`; Keep current → no commit.
- [ ] `ReplanStub` removed; `/replan` mounts `<Replan />`; the three existing entry points (calendar, Week, Home modal) all land on it.
- [ ] Extend-deadline intent (from Phase 5 banner) pre-fills a later deadline (per OQ-02 mechanism).
- [ ] Tests green: malformed→typed error/no commit, well-formed parse, `commitReplan` identity + one-active-after, `Replan` preview/apply/keep; typecheck + lint clean.
- [ ] Three-option scope picker explicitly NOT built here (remains issue 010).

### Implementer report (Developer fills)

Files changed:
- `apps/app/src/App.tsx`
- `apps/app/src/onboarding/components/SchedulePreview.tsx`
- `apps/app/src/pages/Home.tsx`
- `apps/app/src/pages/Home.test.tsx`
- `apps/app/src/pages/Replan.tsx`
- `apps/app/src/pages/Replan.test.tsx`
- `apps/app/src/pages/Roadmaps.test.tsx`
- `apps/app/src/roadmap/RoadmapEndedBanner.tsx`
- `apps/app/src/roadmap/RoadmapEndedBanner.test.tsx`
- `apps/app/src/roadmap/replan/commitReplan.ts`
- `apps/app/src/roadmap/replan/commitReplan.test.ts`
- `apps/app/src/roadmap/replan/mapToRegenerateRequest.ts`
- `apps/app/src/roadmap/replan/mapToRegenerateRequest.test.ts`
- `apps/app/src/roadmap/replan/replanRoadmap.ts`
- `apps/app/src/roadmap/replan/replanRoadmap.test.ts`
- `apps/app/src/roadmap/roadmap.css`

Commit SHA: `734dd32`

What was done:
- Replaced the `/replan` stub with a preview-and-confirm page that regenerates the active roadmap, renders a read-only `SchedulePreview`, shows the pin summary, and supports Apply / Keep current.
- Added `commitReplan`, which emits exactly one `RoadmapReplanned` event carrying the original `roadmapCreatedAt` identity and flattened regenerated slots.
- Hardened `parseRoadmapOutput` so malformed regenerate responses throw a typed `RoadmapServiceError` instead of being cast into a commit-ready roadmap.
- Fixed the Phase 7 cross-phase risks: `RoadmapEdited` pins now match by stable roadmap identity after in-place replans, and regenerate materials are scoped to the active roadmap's slot material IDs instead of the global `MaterialAdded` log.
- Routed Home recalibration, Week, calendar, and ended-banner extension through the same `/replan` screen; the ended banner now uses `/replan?intent=extend`.

Deviations + why:
- Added a `readOnly` mode to the existing `SchedulePreview` instead of extracting a separate `RoadmapPreview` component. This reuses the onboarding presentation without exposing no-op inline editors on `/replan`.
- Extend-deadline intent uses the plan's OQ-02 default query string (`?intent=extend`) and implements a one-week extension preview/commit. The richer three-option scope picker remains out of scope in issue 010.
- The Phase 6 redo was already committed separately as `d544994`; Phase 7 commit `734dd32` contains only the Phase 7 code/test surface.

Self-check vs criteria:
- ✅ `parseRoadmapOutput` runtime-validates `weeks[]`/`warnings` and throws a typed `RoadmapServiceError` for malformed responses.
- ✅ `commitReplan` emits one `RoadmapReplanned` keyed to the original roadmap identity.
- ✅ `deriveRoadmapLifecycle` still shows one active entry after commit with the regenerated slots.
- ✅ `/replan` renders a regenerated preview plus a pin summary (`N locked, M will be re-planned`).
- ✅ Apply commits and navigates to `/roadmap`; Keep current navigates without committing.
- ✅ `ReplanStub` is removed and `/replan` mounts `<Replan />`.
- ✅ Calendar, Week, Home recalibration, and ended-banner extension entry points all route to `/replan` (extension uses `?intent=extend`).
- ✅ Three-option scope picker was not built.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm --filter app test -- replan commitReplan Replan Home` passed: 48 test files, 450 tests.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm typecheck` passed.
- ✅ `env PATH=/Users/rsaji/.nvm/versions/node/v22.17.1/bin:$PATH pnpm lint` passed with the same 9 existing warnings only.

### Reviewer findings (Cowork fills)

- Per-criterion verdict:
- Issues:
- Required changes:
- **Status:** ☐ awaiting implementation

### Resolution (Developer fills on redo)
