# State – roadmap-material-attach

_Spec: GitHub #63 · Plan: active/roadmap-material-attach/plan/PLAN.md · STATUS row: roadmap-material-attach · Status: P1–P4 done; P5 next · Updated: 2026-09-12_

## Current state & next

- **#63 filed + claimed 2026-09-12**; branch `phase2/issue-63-roadmap-material-attach` cut off `2091d8e` in a fresh worktree (`/mnt/d/study/git/study-planner-web-issue-63`). Phase 0 done.
- **P4 done 2026-09-12 (unit + live E2E).** The booking sheets' empty material picker no longer dead-ends: it offers `Add a material to this roadmap`, which closes the sheet and opens the roadmap's "+" picker in one click (D-10). `e2e/roadmap-material-attach-live.spec.ts` runs the whole story on the real stack at 1280 and 375 (`--workers=1`, 2 passed, ~29 s, zero page errors) and **closes all three P1–P3 deferrals**: the fresh 375 attach, OQ-07, and AC6's booked-bubble leg.
- **OQ-07 resolved: the per-row minutes + role controls stay.** Measured at 375x812 — 158 px each inside a 375 px sheet, longest role label (`Foundations`) fully rendered, `scrollWidth === clientWidth`; 196 px each at 1280. D-06's batch-role fallback is not needed. Evidence: `research/2026-09-12-p4-oq07-375.png`.
- **The shared account's roadmap is clean again:** only its own two materials (`Introduction to Spring Data JPA …`, `Designing-Data-Intensive-Applications`) and its own two bookings. The *library*, however, still carries two `E2E P2 attach <epoch-ms>` materials left by the P2 live run (P3's note about deleting "the throwaway library material" was true for one of the two) — left alone on purpose; deleting them is the user's call.
- **Branch state:** `d2f3176` (P1), `33c46d9` (P1 records), `6e4d142` (P2), `9f7aecc` (P3), `34655be` (session-end docs), plus the P4 feat + records commits. Per-phase commits with the `.work/` records riding along in the same commit.
- Five phases: P1 attach + shared reader (done), P2 minutes + role at attach time (done), P3 detach (done), P4 session surfaces + live E2E (**done**), P5 library usage (next).

## Done so far

- 2026-09-12 (session c, P4): **the session surfaces never dead-end, and the flow is live-verified.** `MaterialPickerSheet` gained an optional `onRequestAddMaterial`; with an empty roadmap it renders a first-class `Add a material to this roadmap` row above `No material · pick at start` (`.chooser-row.chooser-add`), `AddSessionSheet`/`BookingEditorSheet` pass it through, and `RoadmapCalendar.handleRequestAddMaterial` closes the open sheet and opens the "+" picker. The new `e2e/roadmap-material-attach-live.spec.ts` covers attach (90 min / `practice`) → directory `of 1h 30m` → New session → Attach → book → detach from the badge → the booked bubble keeps its title → booking removed, at 1280, and the same attach measured at 375. Both scenarios undo their own writes. All red-first where unit-level.
- 2026-09-12 (session b, P3): **a material can be taken back out of the roadmap's set.** On the user's instruction the affordance is the row's material badge: hover it and a `×` fades in (also on keyboard focus), its tooltip reads `Detach material from roadmap?` plus how many upcoming sessions keep their label and logged time, and one click logs `MaterialDetached`. No confirm sheet and no cascade (OQ-06 resolved as "no"), so the plan's `MaterialRemoveSheet` was dropped. The reader's mask from P1 was already in place, so nothing else moved. Live at 1280: opacity 0 -> 1 on hover, row and header count dropped on click, re-attach restored both. AC6 ticked; the booked-bubble leg was unit-covered until P4 made it live.
- 2026-09-12 (session b, P2): **minutes + role are chosen at attach time.** `MaterialPicker` gained `withPlan`, seeding a minutes field (`estimatedMinutes ?? 60`) and a role select (`ROLE_TO_LABEL`) per selected row and handing the plan back keyed by selected ids; the controls sit in a `.checkbox-entry` wrapper beside the row label, because a control nested inside the label would also toggle the checkbox. `RoadmapCalendar` passes `withPlan`. Live at 1280: attached at 90 minutes as `practice` -> directory row `0m of 1h 30m` and session setup `Practice`. AC2 ticked. Deviation: the planned `defaultMinutes` prop was dropped (the caller has no library rows to build it from).
- 2026-09-12 (session b, live pass): **P1 live-verified at 1280** on a stack started from this worktree — the directory "+" attached a real library material and the header moved `1 MATERIALS` -> `2 MATERIALS`, the directory row appeared, New session -> Attach listed it and session setup showed it as `Foundations`, with no page errors. Transcript + two reusable findings (the repo Playwright config's marketing webServer never comes up in a worktree; `app-mobile` is pinned to `roadmap.spec.ts`): `research/2026-09-12-p1-live-verification.md`. **The first of those findings did not reproduce in P4** — see Pitfalls.
- 2026-09-12 (session b): **P0 + P1** — #63 filed/claimed, worktree + branch cut, then P1 implemented and unit-verified: shared `roadmapMaterialPayloads`/`materialTitleIndex` replacing the three duplicated joins; `MaterialAttachedPayload`/`MaterialDetachedPayload`; the directory "+" + `handleAttachMaterials`; `MaterialKind` `'file'` + `toMaterialKind`; `MaterialPicker` `excludeIds` + selection records (+ the three call sites). Deviations and the AC4 grep result are in `plan/PLAN.md` Phase 1 Notes.
- 2026-09-12: wrote `plan/PLAN.md` (Phase 0 + P1–P5; AC1–AC7; D-01…D-10) + `plan/VERIFICATION.md`; seeded `state.md`; added the STATUS row.
- 2026-09-12: OQ round answered by the user — 60-minute default, user-chosen role chip, empty library routes to the Materials create flow, P5 (library usage) in scope, detach in scope. Plan revised: **D-06 rewritten** (role is user-selected per material) and **D-09/D-10 added**; phases reordered to put detach (P3) next to the reader work and library usage last (P5).
- 2026-09-12: established the two-worlds diagnosis against the code, not the notes: roadmap materials come from `MaterialAdded` + `roadmap.payload.materialIds` (`progress/mapEvents.ts:241`), the library is Supabase `materials` reached only from `/materials`, and the id→payload join is duplicated in three readers.

## Flow trace

1. Roadmap materials: `mapMaterialsForRoadmap(events, entry)` joins `entry.payload.materialIds ?? slot candidateMaterialIds` against `MaterialAdded` events (`progress/mapEvents.ts:241`); `effectiveEstimatedDuration` caps each by `payload.materialDurationOverrides` (`:155`).
2. The same join is re-implemented in `roadmap/roadmapProgress.ts:50` (no slot fallback) and `roadmap/replan/mapToRegenerateRequest.ts:80` (drives Replan) — three copies, which is why a new material source must be added once, centrally. No other reader touches `payload.materialIds`.
3. Downstream of `mapMaterialsForRoadmap`: the calendar + its Materials directory (`RoadmapCalendar.tsx:190-214`, `:554-604`), the booking sheets' picker (`booking/AddSessionSheet.tsx:126`), and session setup / up-next (`session/sessionPlanning.ts:244`) — all ledger-driven, so one reader change reaches every surface.
4. Calendar bubble labels come from `collectMaterialsById(materialPayloads)` → `calendarModel.materialInfoById`, which falls back to the literal `'Session · pick at start'` when a booking's materialId is missing (`calendarModel.ts:148-166`). P1 replaces the source with a global `materialTitleIndex(events)` so detach cannot blank a booked bubble's label.
5. The booking sheets only ever receive the roadmap's own `materialOptions`, so on a roadmap with no materials their picker had nothing to show. P4 gives `MaterialPickerSheet` an `onRequestAddMaterial` CTA that hands control back to `RoadmapCalendar`, which closes the sheet and opens the "+" planning picker (`RoadmapCalendar.tsx` `handleRequestAddMaterial`).
6. The library: `MaterialClient.listMaterials()` (archived excluded, `materialClient.ts:217`); `MaterialPicker` implements `purpose="planning"` ("Attach to roadmap", contentless selectable, empty state → `/materials/new`) and is called only from `RoadmapCalendar`.
7. The reverse direction is stubbed: `pages/materials/MaterialDetail.tsx:191` hardcodes `usage: string[] = []`, so the usage block and the delete warning can never name a roadmap. (P5.)
8. Sync safety: `logEvent(kind, payload)` is free-form (`sync/SyncEngine.ts:96`), `public.events.kind` is plain `TEXT` with no CHECK (`migrations/003_events_table.sql:10`), and `Event` is `{id?, kind, payload, createdAt}` with an autoincrement id — `getAll()` order is insertion order, which is the attach/detach tie-break (`events/EventStore.ts:13/27`).

## Files affected

- `apps/app/src/sync/types.ts` — `MaterialAttachedPayload`, `MaterialDetachedPayload`.
- `apps/app/src/progress/mapEvents.ts` — exported `roadmapMaterialPayloads`, `materialTitleIndex`; `mapMaterialsForRoadmap` delegates; `effectiveEstimatedDuration` takes the payload.
- `apps/app/src/roadmap/roadmapProgress.ts`, `roadmap/replan/mapToRegenerateRequest.ts` — dropped their local joins onto the shared reader.
- `apps/app/src/session/types.ts`, `session/PreSessionSetup.tsx`, `session/components/MaterialStrip.tsx` — `MaterialKind` gained `'file'` plus its chip/label cases.
- `apps/app/src/materials/types.ts` (+ `types.test.ts`) — `toMaterialKind`.
- `apps/app/src/materials/MaterialPicker.tsx` — `excludeIds`, `MaterialPickerSelection` callback, `withPlan` minutes + role controls, all-excluded empty state.
- `apps/app/src/roadmap/RoadmapCalendar.tsx` — the "+", `handleAttachMaterials`, global title index, header split into `.dir-head-toggle` + `.dir-add`, hover-detach, `handleRequestAddMaterial` wired into both booking sheets.
- `apps/app/src/roadmap/booking/MaterialPickerSheet.tsx` (+ `AddSessionSheet.tsx`, `BookingEditorSheet.tsx`) — `onRequestAddMaterial` and its empty-roadmap CTA, passed through both sheets.
- `apps/app/src/session/session.css` — `.chooser-add` (dashed row) for that CTA.
- `apps/app/src/roadmap/roadmap.css` — the `.dir-add`/detach-control styles.
- `apps/app/src/pages/materials/MaterialLibrary.tsx`, `MaterialDetail.tsx`, `PracticeThis.tsx` — picker call sites moved to selection records.
- `e2e/roadmap-material-attach-live.spec.ts` — new live spec (desktop 1280 + phone 375).

## Pitfalls & rules

- **A booking does not move the material ledger.** `buildMaterialLedger` consumes **logged sessions** (`activeMinutesLogged`/`materialConsumedMinutes`) and progress marks only (`packages/progress/src/materialLedger.ts:49-90`); booking a session changes nothing in `consumed/remaining`. Do not write live assertions that expect a booking to move the directory's minutes.
- **The repo Playwright config does run in this worktree.** P4 ran `pnpm exec playwright test -c e2e/playwright.config.ts ...` repeatedly here (app project and marketing project) with both webServers coming up; the P1 note about the marketing webServer never becoming reachable did not reproduce, and no throwaway config was needed. If it fails another time, capture the webServer output before assuming the config is at fault.
- **`smoke.spec.ts:53` fails on this branch, unrelated to #63:** `getByRole('button', { name: 'Continue' })` matches both the submit button and "Continue with Google" (strict mode). Pre-existing; fix separately with `exact: true`.
- **`locator.filter({ hasText: /^Title/ })` does not work on `.dir-row`** — the row's inner text starts with the `×` detach glyph, so an anchored regex never matches. Filter on a substring, or target `.dir-title`.
- **A live spec must wait out the event-log replay.** The first `/study/roadmap` load after sign-in can take longer than the 5 s default expect timeout on the shared account (the second test in a file is the common victim); give the readiness assertion an explicit timeout (~20 s).
- **A control whose accessible name carries a material title breaks unscoped locators.** The detach button's `aria-label` contains the title, so unscoped `getByRole('button', { name: /Operating Systems/ })` queries become strict-mode hazards. Scope such queries to the dialog or list they mean (`within(...)`).
- **Vitest invocation.** The app `test` script is already `vitest run`; `pnpm --filter app test -- --run <path>` makes vitest treat the path as a name filter and scan the whole suite. Use `pnpm --filter app test <path>`.
- **A selection-shaped picker callback breaks every call site.** Changing `MaterialPicker.onContinue` from ids to records touched three files the plan had not indexed; the compiler found them. Grep the call sites before changing a callback's argument type.
- **Three readers, one join (fixed in P1).** Adding a material source in `mapMaterialsForRoadmap` alone left Replan and the progress summary silently dropping it; all three now call `roadmapMaterialPayloads`. Any new material source must go in that one reader.
- **`MaterialAdded` is not roadmap-scoped.** The roadmap association lives on `roadmap.payload.materialIds`; a bare `MaterialAdded` row changes nothing for any roadmap.
- **Order, not timestamps.** Attach/detach precedence comes from the `events` array order returned by `EventStore.getAll()`; do not compare `createdAt` (same-millisecond appends are possible).
- **A detach must not blank a booked bubble.** The calendar label lookup must stay independent of the active set (D-09 / `materialTitleIndex`), and `RoadmapCalendar`'s header count must keep using the active set, not the title index.
- **Session length ≠ material budget.** A booking's `estimatedDuration` is session length; the material's `estimatedDuration` is its roadmap budget, consumed through the ledger. Do not merge them.
- **Progress is global per materialId.** `buildMaterialLedger` matches sessions by `materialId` across all roadmaps, so the same library material attached to two roadmaps shares its consumed minutes (pre-existing behaviour; note it, do not "fix" it here). This is also why a re-attach resurrects the removed material's logged minutes.
- **Nested interactive elements are invalid.** `dir-head` was a single `<button>`, so the "+" became its sibling (D-05); the detach `×` sits beside the badge, not inside it; the picker's minutes/role fields sit beside the row `<label>`, because a control nested in a label also fires the label's click.
- **WSL/drvfs staleness (rule 53).** Vite misses edits on `/mnt/d`; after frontend changes run `./full-app restart app` and hard-reload before judging the UI.
- **Live runs leave library rows behind.** A live spec that creates library materials must delete them; the shared account currently still carries two `E2E P2 attach <epoch-ms>` rows from the P2 session.
- **Rule 30/33 boundaries.** New kinds are additive rows on the event log; no direct page-level Supabase writes, no Dexie schema change.

## Decisions in force

- Decided to carry the attach as a new `MaterialAttached` event shaped `MaterialAddedPayload & { roadmapCreatedAt }` because #7 specifies a thin pointer on the log and the shape lets every existing reader compile untouched (2026-09-12, D-01).
- Decided to carry the removal as `MaterialDetached {roadmapCreatedAt, materialId}`, masked by event order, never cascading into bookings or logged sessions, with re-attach restoring the material and its logged minutes (2026-09-12, D-09 — user: "need to implement").
- Decided to reuse `MaterialPicker` (`purpose="planning"`) with `excludeIds` and per-row minutes + role controls rather than build a fourth material list (2026-09-12, D-02/D-03/D-06).
- Decided the per-material budget is the attach event's `estimatedDuration`, default 60 (2026-09-12, D-03 — user: "default is ok").
- Decided the role is user-selected per attached material via a native select over the engine's `ROLE_TO_LABEL` (2026-09-12, D-06 — user: "add a role chip let user select").
- Decided an empty library routes to the Materials create flow (`/materials/new`) rather than creating inline, and the same principle now covers an empty *roadmap*: the booking sheets' empty picker offers "Add a material to this roadmap" (the roadmap's "+") instead of creating anything inline (2026-09-12, D-10, extended in P4).
- Decided the detach affordance is a `×` revealed on hover (or keyboard focus) over the row's material badge, with the upcoming-session count disclosed in its tooltip, and one click removes the material with **no** confirm sheet and **no** cascade into bookings (2026-09-12, user instruction — supersedes the planned `MaterialRemoveSheet`, resolves OQ-06).
- Decided attached materials are pointers: archiving the library row does not detach it (2026-09-12, D-08, per #19's no-silent-detachment rule).
- Decided the picker seeds each selected row's minutes from the library row's own estimate (`estimatedMinutes ?? 60`) and its role from `foundation` (2026-09-12, P2 — supersedes that part of the plan).
- Decided the per-row minutes + role controls stay rather than collapsing to one batch role: measured 158 px each inside a 375 px sheet with the longest role label fully rendered and no overflow (2026-09-12, P4 — resolves OQ-07).

## Open

- **P5 and AC5 remain**: `useMaterialUsage` + `MaterialDetail` must name the roadmaps a library material feeds (the usage block and the delete warning are still hardcoded empty).
- **Two leftover library materials on the shared account**: `E2E P2 attach 1789200978749` and `E2E P2 attach 1789200922951` (P2 live-run artifacts). Deleting them is unreversible, so it was left to the user; they also mean every live attach run picks up throwaway rows.
- **Pre-existing `smoke.spec.ts:53` failure** (strict-mode `Continue` vs `Continue with Google`) — unrelated to #63, fix with `exact: true` when someone is in that file.
