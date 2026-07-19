# Handover — Roadmaps dashboard (Phases 1–6 reviewed; Phase 7 in flight)

**Date:** 2026-06-27
**Workstream:** `[APP]` Roadmaps dashboard — multi-roadmap lifecycle + re-entrant onboarding
**Plan:** [`plans/active/2026-06-26-roadmaps-dashboard/PLAN.md`](../plans/active/2026-06-26-roadmaps-dashboard/PLAN.md)
**Running log / review:** [`plans/active/2026-06-26-roadmaps-dashboard/VERIFICATION.md`](../plans/active/2026-06-26-roadmaps-dashboard/VERIFICATION.md)
**Index row:** `STATUS.md` → Active → `[APP] Roadmaps dashboard`

## Where this came from

Grilled with Rohit (one active roadmap per non-overlapping period; one queued draft; re-entrant onboarding returning to `/roadmaps`; edits update in place; deadline-passed banner; sessions attributed by date window). Plan authored in 7 phases; built on the verified `2026-06-26-roadmap-calendar` base. Full design rationale is in the plan's Decisions log (D-01…D-12).

## State as of this session (review by `git show`, read-only; tests not run in Cowork sandbox)

| Phase | Commit | Verdict |
|---|---|---|
| 1 — typed events + in-place lifecycle identity | `4631152` | ✅ Verified |
| 2 — session attribution by date window | `37a0361` | ✅ Verified |
| 3 — re-entrant onboarding + nav reshape | `0fc02ce` → redo `521cd6d` | ✅ Verified (redo re-checked) |
| 4 — Roadmaps dashboard | `2cba6cf` | ✅ Verified |
| 5 — deadline-passed banner | `03a2537` | ✅ Verified |
| 6 — add-session quick-log + inline edits | `c771f63` → source fix **uncommitted** | ✅ Verified on working tree; **SHA pending native commit** |
| 7 — `/replan` preview-confirm + in-place commit | — | 🟡 In progress (`aed9efd` marked it in progress) |

Per-criterion findings live in each phase's Reviewer block in VERIFICATION.md. A **Redo protocol** section was added near the top of VERIFICATION.md (what an agent must do when a phase is `🔁 Changes requested`).

## Outstanding actions (next session entry point — do in this order)

1. **Commit the Phase 6 fix as its OWN commit.** It is currently uncommitted and **intermixed with Phase 7 WIP** in the working tree. Commit only: `apps/app/src/roadmap/RoadmapCalendar.tsx` (the `source: 'manual'` line at ~321), `apps/app/src/roadmap/RoadmapCalendar.test.tsx`, `packages/progress/test/streak.test.ts`. Then record the real SHA in the Phase 6 **Resolution** block (replace "pending native commit") and upgrade its reviewer status to committed-`✅ Verified`. Do NOT let it ride inside a Phase 7 commit.
2. **Continue/finish Phase 7** (`/replan` preview-confirm + in-place `RoadmapReplanned` commit; runtime-validate `parseRoadmapOutput`; reuse Step3Preview presentation; unify the three entry points). Acceptance criteria are pre-filled in VERIFICATION.md Phase 7. The richer three-option scope picker stays [`issue 010`](../specs/issues/010-replan-flow-with-three-options.md).

## Risks / notes to carry into Phase 7

- **Materials are global, not roadmap-scoped.** `mapToRegenerateRequest.materialPayloads(events)` reads ALL `MaterialAdded` events. With multiple historical roadmaps (and after the Phase 3 fix, drafts no longer leak materials), a replan of the active roadmap still pulls every material ever added. Decide whether Phase 7 / issue 010 must scope materials to the active roadmap.
- **`userEditedPins` matches by latest-event `createdAt`, not identity.** `userEditedPins(events, roadmapEvent.createdAt)` compares `RoadmapEdited.roadmapCreatedAt` (= original identity, set by Phase 6) against `latestActiveRoadmapEvent.createdAt`. After an in-place replan, the latest active event is a `RoadmapReplanned` whose `createdAt` ≠ the identity → user-edited pins can be dropped. Phase 7 should match by **identity**.
- **`source` enum is load-bearing.** `streak.ts` counts `'manual'`; `calibration/bayesian/trend/cusum` key on `'active'`; `mapEvents.ts` types it `'active' | 'manual'`. Don't introduce new `source` values without updating these (this was the Phase 6 change request).
- Minor/non-blocking: UTC `today` boundary in date comparisons (Phases 2/5); mobile `DayDetailModal` lacks the quick-edit affordances that `SessionDetailModal` has; "Mark undone" is a near no-op (no undo-session event in the model).

## Process reminders (Cowork side)

- Cowork is plan/review only — read-only on code, read-only git. All doc edits this session are left in the working tree (`STATUS.md`, the plan's `VERIFICATION.md`, this handover) for the **native side to commit**.
- Tests can't run in the Cowork sandbox (Node/jsdom); the developer runs Vitest under Node `v22.17.1` (default shell Node `v18.19.0` fails before collection).
