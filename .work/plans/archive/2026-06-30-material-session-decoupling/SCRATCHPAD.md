# Scratchpad - 2026-06-30-material-session-decoupling
_Plan: .work/plans/active/2026-06-30-material-session-decoupling/PLAN.md · Log: VERIFICATION.md · Updated: 2026-07-02T09:00_

## Now
Phase 7 rework (`6d4cc89`) reviewed and re-checked by Cowork — **✅ Verified**. All 7 phases of the material-session-decoupling plan are now `✅ Verified`. Also fixed doc drift: `PLAN.md` phase-status lines for Phases 2/3/4/7 had fallen out of sync with `VERIFICATION.md` (Phase 3's line was mistakenly overwritten by the `6d4cc89` commit's status edit meant for Phase 7); all corrected this session.

## Alignment
Aligned with PLAN.md Phase 7 / D-09 / D22 and the review. Slot-regeneration remains retired; `RoadmapReplanned` remains a capacity/deadline/material snapshot plus booking events, with no slots or `/v1/roadmap/regenerate` call.

## Open
- Native side: commit this reviewer's doc updates (VERIFICATION.md, PLAN.md, STATUS.md, this file) per Step 0/Rule 3 — Cowork cannot commit.
- Run the full `pnpm` test suite + the 2 new Phase 7 Playwright specs on a machine with registry access (this Cowork sandbox has no network route to npm registries and a pre-existing `@rollup/rollup-linux-arm64-gnu` gap, so `vitest`/`pnpm` could not be run here — reviewer corroborated via direct per-package `tsc`/`eslint` instead).
- Non-blocking follow-up (optional): file an issue for the shorten-ceiling ratchet — a material shortened in one replan can't be lengthened back toward its original estimate in a later replan session via the UI.
- OQ-04 (real N=1 data validation) remains open, tracked separately.

## Blockers
- — none

## Deferrals
- `replanRoadmap.ts` / `mapToRegenerateRequest.ts` kept but no longer called from Replan.tsx (retired from live path).
- `/v1/roadmap/regenerate` removed from replan path per D-09.
- E2E specs are not the first verification target for this rework; focus on app unit tests + typecheck unless the changed surface needs browser confirmation.

## Checklist
- [x] Trace current Replan.tsx, commitReplan.ts, mapEvents/material ledger, and related tests.
- [x] Fix lever state initialization from async `replanData` without clobbering user edits.
- [x] Make live projection capacity-aware and shorten/drop-aware.
- [x] Consume `materialDurationOverrides` on read for roadmap ETA/directory/remaining.
- [x] Compute `weeks` from replan start-to-deadline span in `commitReplan`.
- [x] Add/update unit tests for F1-F3.
- [x] Run focused tests, typecheck, lint, and diff-check.
- [x] Append VERIFICATION.md rework report and update STATUS.md/PLAN.md.

## In-flight edits
— none expected after commit `6d4cc89`; verify with `git status --short --branch` before resuming.

## Decisions in force
- Commit order: RoadmapReplanned → BookingCleared × N → SessionBooked × M
- Live re-projection may stay analytic/fast, but must be capacity-aware and visibly respond to hours/day, study days, shorten, and drop.
- Single hoursPerDay stepper applies to both weekday/weekend unless code inspection shows the mock/plan requires split controls.
- Replan.test.tsx mocks commitReplan; commitReplan.test.ts covers the full emit sequence
- Verification passed: `pnpm --filter app test -- Replan mapEvents roadmapProgress commitReplan` (58 files / 509), `pnpm --filter app typecheck`, `pnpm lint` (0 errors, 4 pre-existing warnings), `git diff --check`.
- Commit: `6d4cc89` (`fix(replan): close phase 7 review gaps`).

## Resolved (recent)
- Phase 5/6 deviations rectified + E2E run green; both ✅ Verified.
- D6 pace-first recommendation implemented and verified (Phase 6 resolution).
- Phase 7 initial implementation committed at `31feaa2`; review found F1-F3 requiring rework.
- F1 fixed: async capacity hydration + capacity-aware finish preview.
- F2 fixed: `materialDurationOverrides` consumed/preserved on read/apply.
- F3 fixed: replanned `weeks` recomputed from start→deadline span.
- **Phase 7 rework re-checked and ✅ Verified 2026-07-02** (`6d4cc89`) — F1/F2/F3 confirmed fixed by diff + manual logic trace; typecheck/lint independently reproduced; test execution not reproducible in this sandbox (pre-existing rollup arm64 gap, disclosed rather than assumed). PLAN.md status-line drift (Phases 2/3/4/7) corrected. **All 7 phases now ✅ Verified.**
