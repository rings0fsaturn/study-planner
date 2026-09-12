# State – roadmap-material-attach

_Spec: GitHub #63 · Plan: active/roadmap-material-attach/plan/PLAN.md · STATUS row: roadmap-material-attach · Status: P1–P3 done; P4 next · Updated: 2026-09-12_

## Current state & next

- **#63 filed + claimed 2026-09-12**; branch `phase2/issue-63-roadmap-material-attach` cut off `2091d8e` in a fresh worktree (`/mnt/d/study/git/study-planner-web-issue-63`). Phase 0 done.
- **P1, P2 and P3 done and live-verified at 1280.** One shared reader (`roadmapMaterialPayloads` + `materialTitleIndex`) replaces the three duplicated joins; a library material attaches through the directory "+" with its own minutes and role; the row's badge reveals a `×` on hover that detaches it, disclosing any upcoming sessions in its tooltip. `typecheck`/`lint` clean, `src/roadmap` + `src/progress` 122/122. AC1/AC2/AC3/AC4/AC6/AC7 ticked with their caveats.
- **The dev account is clean.** P3's live run took the leftover test attaches back off and deleted the throwaway library material; the roadmap holds only the two materials it started with. The earlier note about "3 attached" was wrong by one - a fresh browser was reading a partly-restored event log, and the roadmap had 2 of its own all along.
- **The dev stack runs from this worktree** (the main checkout's stack was stopped first; its gitignored env files were copied over). `./full-app status full` shows app 5173 + intelligence 8000 healthy.
- **Branch state:** `d2f3176` (P1), `33c46d9` (P1 records), `6e4d142` (P2), `9f7aecc` (P3), all pushed to `origin/phase2/issue-63-roadmap-material-attach`. Per-phase commits with the `.work/` records riding along in the same commit.
- **Still unmeasured: OQ-07** (per-row minutes+role vs one batch role at 375) and the fresh 375 attach. Nothing blocks either now that detach exists.
- Five phases: P1 attach + shared reader (done), P2 minutes + role at attach time (done), P3 detach (done), P4 session surfaces + live E2E, P5 library usage.

## Done so far

- 2026-09-12 (session b, P3): **a material can be taken back out of the roadmap's set.** On the user's instruction the affordance is the row's material badge: hover it and a `×` fades in (also on keyboard focus), its tooltip reads `Detach material from roadmap?` plus how many upcoming sessions keep their label and logged time, and one click logs `MaterialDetached`. No confirm sheet and no cascade (OQ-06 resolved as "no"), so the plan's `MaterialRemoveSheet` was dropped. The reader's mask from P1 was already in place, so nothing else moved. Live at 1280: opacity 0 -> 1 on hover, row and header count dropped on click, re-attach restored both. AC6 ticked; the booked-bubble leg is unit-covered only.
- 2026-09-12 (session b, P2): **minutes + role are chosen at attach time.** `MaterialPicker` gained `withPlan`, seeding a minutes field (`estimatedMinutes ?? 60`) and a role select (`ROLE_TO_LABEL`) per selected row and handing the plan back keyed by selected ids; the controls sit in a `.checkbox-entry` wrapper beside the row label, because a control nested inside the label would also toggle the checkbox. `RoadmapCalendar` passes `withPlan`. Live at 1280: attached at 90 minutes as `practice` -> directory row `0m of 1h 30m` and session setup `Practice`. AC2 ticked. Deviation: the planned `defaultMinutes` prop was dropped (the caller has no library rows to build it from). **OQ-07 unmeasured** — the picker had no rows at 375.
- 2026-09-12 (session b, live pass): **P1 live-verified at 1280** on a stack started from this worktree — the directory "+" attached a real library material and the header moved `1 MATERIALS` -> `2 MATERIALS`, the directory row appeared, New session -> Attach listed it and session setup showed it as `Foundations`, with no page errors. The 375 leg opened the picker and honoured `excludeIds` but had nothing left to attach; deferred until P3. Transcript + two reusable findings (the repo Playwright config's marketing webServer never comes up in a worktree; `app-mobile` is pinned to `roadmap.spec.ts`): `research/2026-09-12-p1-live-verification.md`.
- 2026-09-12 (session b): **P0 + P1** — #63 filed/claimed, worktree + branch cut, then P1 implemented and unit-verified: shared `roadmapMaterialPayloads`/`materialTitleIndex` replacing the three duplicated joins; `MaterialAttachedPayload`/`MaterialDetachedPayload`; the directory "+" + `handleAttachMaterials`; `MaterialKind` `'file'` + `toMaterialKind`; `MaterialPicker` `excludeIds` + selection records (+ the three call sites). `typecheck`/`lint` clean, app suite 800/802 (2 = WSL TZ pair). Deviations and the AC4 grep result are in `plan/PLAN.md` Phase 1 Notes.
- 2026-09-12: wrote `plan/PLAN.md` (Phase 0 + P1–P5; AC1–AC7; D-01…D-10) + `plan/VERIFICATION.md`; seeded `state.md`; added the STATUS row.
- 2026-09-12: OQ round answered by the user — 60-minute default, user-chosen role chip, empty library routes to the Materials create flow, P5 (library usage) in scope, detach in scope. Plan revised: **D-06 rewritten** (role is user-selected per material; the earlier fixed-`role: 'foundation'` simplification is superseded) and **D-09/D-10 added**; phases reordered to put detach (P3) next to the reader work and library usage last (P5).
- 2026-09-12: established the two-worlds diagnosis against the code, not the notes: roadmap materials come from `MaterialAdded` + `roadmap.payload.materialIds` (`progress/mapEvents.ts:241`), the library is Supabase `materials` reached only from `/materials`, and the id→payload join is duplicated in three readers.

## Flow trace

1. Roadmap materials: `mapMaterialsForRoadmap(events, entry)` joins `entry.payload.materialIds ?? slot candidateMaterialIds` against `MaterialAdded` events (`progress/mapEvents.ts:241`); `effectiveEstimatedDuration` caps each by `payload.materialDurationOverrides` (`:155`).
2. The same join is re-implemented in `roadmap/roadmapProgress.ts:50` (no slot fallback) and `roadmap/replan/mapToRegenerateRequest.ts:80` (drives Replan) — three copies, which is why a new material source must be added once, centrally. No other reader touches `payload.materialIds`.
3. Downstream of `mapMaterialsForRoadmap`: the calendar + its Materials directory (`RoadmapCalendar.tsx:190-214`, `:554-604`), the booking sheets' picker (`booking/AddSessionSheet.tsx:126`), and session setup / up-next (`session/sessionPlanning.ts:244`) — all ledger-driven, so one reader change reaches every surface.
4. Calendar bubble labels come from `collectMaterialsById(materialPayloads)` → `calendarModel.materialInfoById`, which falls back to the literal `'Session · pick at start'` when a booking's materialId is missing (`calendarModel.ts:148-166`). P1 replaces the source with a global `materialTitleIndex(events)` so detach cannot blank a booked bubble's label.
5. The library: `MaterialClient.listMaterials()` (archived excluded, `materialClient.ts:217`); `MaterialPicker` already implements `purpose="planning"` ("Attach to roadmap", contentless selectable, empty state → `/materials/new`) and **has no call site** — `MaterialLibrary.tsx` only opens `purpose="generation"`.
6. The reverse direction is stubbed: `pages/materials/MaterialDetail.tsx:191` hardcodes `usage: string[] = []`, so the usage block and the delete warning can never name a roadmap.
7. Sync safety: `logEvent(kind, payload)` is free-form (`sync/SyncEngine.ts:96`), `public.events.kind` is plain `TEXT` with no CHECK (`migrations/003_events_table.sql:10`), and `Event` is `{id?, kind, payload, createdAt}` with an autoincrement id — `getAll()` order is insertion order, which is the attach/detach tie-break (`events/EventStore.ts:13/27`).

## Files affected

- `apps/app/src/sync/types.ts` — `MaterialAttachedPayload`, `MaterialDetachedPayload`.
- `apps/app/src/progress/mapEvents.ts` — exported `roadmapMaterialPayloads`, `materialTitleIndex`; `mapMaterialsForRoadmap` delegates; `effectiveEstimatedDuration` takes the payload.
- `apps/app/src/roadmap/roadmapProgress.ts`, `roadmap/replan/mapToRegenerateRequest.ts` — dropped their local joins onto the shared reader.
- `apps/app/src/session/types.ts`, `session/PreSessionSetup.tsx`, `session/components/MaterialStrip.tsx` — `MaterialKind` gained `'file'` plus its chip/label cases.
- `apps/app/src/materials/types.ts` (+ `types.test.ts`) — `toMaterialKind`.
- `apps/app/src/materials/MaterialPicker.tsx` — `excludeIds`, `MaterialPickerSelection` callback, all-excluded empty state.
- `apps/app/src/roadmap/RoadmapCalendar.tsx`, `roadmap/roadmap.css` — the "+", `handleAttachMaterials`, global title index, header split into `.dir-head-toggle` + `.dir-add`.
- `apps/app/src/pages/materials/MaterialLibrary.tsx`, `MaterialDetail.tsx`, `PracticeThis.tsx` — picker call sites moved to selection records.

## Pitfalls & rules

- **A control whose accessible name carries a material title breaks unscoped locators.** The detach button's `aria-label` contains the title, so two pre-existing `getByRole('button', { name: /Operating Systems/ })` queries in `RoadmapCalendar.test.tsx` started matching two nodes. Scope such queries to the dialog or list they mean (`within(...)`) — an unscoped name query across the page is a standing strict-mode hazard here.
- **Vitest invocation.** The app `test` script is already `vitest run`; `pnpm --filter app test -- --run <path>` makes vitest treat the path as a name filter and scan the whole suite. Use `pnpm --filter app test <path>`. Found in P1.
- **A selection-shaped picker callback breaks every call site.** Changing `MaterialPicker.onContinue` from ids to records touched three files the plan had not indexed; the compiler found them. Grep the call sites before changing a callback's argument type.
- **Three readers, one join (fixed in P1).** Adding a material source in `mapMaterialsForRoadmap` alone left Replan and the progress summary silently dropping it; all three now call `roadmapMaterialPayloads`. Any new material source must go in that one reader.
- **`MaterialAdded` is not roadmap-scoped.** The roadmap association lives on `roadmap.payload.materialIds`; a bare `MaterialAdded` row changes nothing for any roadmap.
- **`roadmapProgress` lacked the slot fallback (fixed in P1).** It read `materialIds ?? []`, unlike the other two readers, so legacy slot-based roadmaps under-reported there. The shared reader resolves declared ids through slot candidates.
- **Order, not timestamps.** Attach/detach precedence comes from the `events` array order returned by `EventStore.getAll()`; do not compare `createdAt` (same-millisecond appends are possible).
- **A detach must not blank a booked bubble.** The calendar label lookup must stay independent of the active set (D-09 / `materialTitleIndex`), and `RoadmapCalendar`'s header count must keep using the active set, not the title index.
- **Session length ≠ material budget.** A booking's `estimatedDuration` is session length; the material's `estimatedDuration` is its roadmap budget, consumed through the ledger. Do not merge them.
- **Progress is global per materialId.** `buildMaterialLedger` matches sessions by `materialId` across all roadmaps, so the same library material attached to two roadmaps shares its consumed minutes (pre-existing behaviour; note it, do not "fix" it here). This is also why a re-attach resurrects the removed material's logged minutes.
- **Nested interactive elements are invalid.** `dir-head` was a single `<button>`, so the "+" became its sibling (the collapse control moved to `.dir-head-toggle`, D-05). The same trap bit twice more: the detach `×` sits beside the badge, not inside it, and the picker's minutes/role fields sit beside the row `<label>` — a control nested in a label also fires the label's click.
- **WSL/drvfs staleness (rule 53).** Vite misses edits on `/mnt/d`; after frontend changes run `./full-app restart app` and hard-reload before judging the UI.
- **Rule 30/33 boundaries.** New kinds are additive rows on the event log; no direct page-level Supabase writes, no Dexie schema change.

## Decisions in force

- Decided to carry the attach as a new `MaterialAttached` event shaped `MaterialAddedPayload & { roadmapCreatedAt }` because #7 specifies a thin pointer on the log and the shape lets every existing reader compile untouched (2026-09-12, D-01).
- Decided to carry the removal as `MaterialDetached {roadmapCreatedAt, materialId}`, masked by event order, never cascading into bookings or logged sessions, with re-attach restoring the material and its logged minutes (2026-09-12, D-09 — user: "need to implement").
- Decided to reuse `MaterialPicker` (`purpose="planning"`) with `excludeIds` and per-row minutes + role controls rather than build a fourth material list (2026-09-12, D-02/D-03/D-06).
- Decided the per-material budget is the attach event's `estimatedDuration`, default 60 (2026-09-12, D-03 — user: "default is ok").
- Decided the role is user-selected per attached material via a native select over the engine's `ROLE_TO_LABEL` (2026-09-12, D-06 — user: "add a role chip let user select"). **Supersedes** the earlier fixed-`role: 'foundation'` simplification.
- Decided an empty library routes to the Materials create flow (`/materials/new`) rather than creating inline (2026-09-12, D-10 — user: "let them add new material from materials tab if empty").
- Decided attached materials are pointers: archiving the library row does not detach it (2026-09-12, D-08, per #19's no-silent-detachment rule).
- Decided the picker seeds each selected row's minutes from the library row's own estimate (`estimatedMinutes ?? 60`) and its role from `foundation`, rather than taking a `defaultMinutes` prop from the caller: the calendar holds no library rows and never sees `estimatedMinutes` (2026-09-12, P2 — supersedes that part of the plan).
- Decided the detach affordance is a `×` revealed on hover (or keyboard focus) over the row's material badge, with the upcoming-session count disclosed in its tooltip, and that one click removes the material with **no** confirm sheet and **no** cascade into bookings (2026-09-12, user instruction — supersedes the planned `MaterialRemoveSheet` and resolves OQ-06).

## Open

- **OQ-07** per-row minutes + role controls vs one batch role for the whole selection (D-06) · unmeasured at 375 — the picker had no rows to render then · resolve by re-running the attach at 375 and deciding from that; D-06's fallback is one batch role.
- **The fresh 375 attach** (AC1's second viewport) · deferred through P1–P3 and still not run · unblocked now that P3 can take an attach back off; fold it into P4's live spec.
- **AC6's booked-bubble leg is unit-covered only** — no detached material had a booking · exercise it live in P4's spec, which books a session on the material before removing it.
- **The repo Playwright config cannot run in a worktree:** its marketing webServer (`pnpm --filter @study-tracker/marketing dev`, port 4321) never becomes reachable, so `config.webServer` times out and every project fails before a test runs · workaround used was a throwaway config declaring only the app webServer · promote to rule 10/16 at WRAP so the next worktree-based live pass does not rediscover it.
- **P4 and P5 remain** (session-surface empty-state CTA + the real live E2E spec; material-detail roadmap usage) · AC5 is still unticked.
