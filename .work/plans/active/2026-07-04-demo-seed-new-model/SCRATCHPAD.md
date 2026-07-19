# Scratchpad - 2026-07-04-demo-seed-new-model
_Plan: `.work/plans/active/2026-07-04-demo-seed-new-model/PLAN.md` | Log: `VERIFICATION.md` | Updated: 2026-07-04T08:28_

## Now
Reviewer blocker fix was implemented in `337976b`.
The seed now uses local calendar-day helpers for `today`, study-day matching, booking date keys, and the today-unlogged rule.
Seeded `createdAt`, `startedAt`, and `endedAt` fields remain ISO timestamps.
Added `apps/app/src/dev/seedTestData.test.ts` for the `Asia/Kolkata` late-evening UTC boundary.
Verification passed: `grep -c "slots"` output `0`, terminal-event grep output `2`, app typecheck passed, app lint exited 0 with the same four pre-existing YouTube `any` warnings, app tests passed `535/535`, and progress tests passed `98/98`.
Full-app status was healthy for intelligence and app.
Live Chromium verification after sync-settled `__wipe()` / `__seed()` / reload showed Home `4 DAYS EARLY`, today's `Start session` card, Week burn-up visible, `/roadmaps` active hero `41%`, one abandoned history row, one completed history row, and console errors `0`.
`PLAN.md` and `VERIFICATION.md` now mark Phases 1-3 reviewer-verified with fix commit `337976b`.
The immediate next action is to commit this SHA-recording docs update.

## Alignment
Work remains aligned with D-01 dev-only scope.
Phase 3 is verification-first.
No production roadmap, progress, chart, or page logic may change unless a genuine live defect is observed and surfaced as a new decision before implementation.
Expected files are `.work/plans/active/2026-07-04-demo-seed-new-model/PLAN.md`, `VERIFICATION.md`, `SCRATCHPAD.md`, and `.work/STATUS.md`, plus `apps/app/src/dev/seedTestData.ts` only if pace tuning is needed.

## Open
- Pre-existing unrelated dirty files in `.work/plans/active/2026-07-02-material-session-ui-bugs/` must stay unstaged and out of demo-seed commits.

## Blockers
- none

## Deferrals
- OQ-01 remains deferred: active-roadmap progress is not scoped away from prior `SessionLogged` events.
- OQ-02 remains deferred: past roadmap logged progress should wait for OQ-01.
- Any production chart or projection fix remains deferred until a live defect is confirmed and the user approves a new decision.

## Checklist
- [x] Read `.work/README.md`, `.work/STATUS.md`, `PLAN.md`, and `VERIFICATION.md`.
- [x] Read project-local scratchpad and work-journal skills.
- [x] Read project-local plan-implementor and code-memory skills.
- [x] Read applicable project rules for full-app verification, Playwright config, pnpm build registry, and roadmap-engine context.
- [x] Confirm Step 0 planning docs are already committed.
- [x] Check git status before Phase 3.
- [x] Read Phase 3 contract and acceptance criteria.
- [x] Record Phase 3 start in `PLAN.md` and `SCRATCHPAD.md`.
- [x] Commit Phase 3 start marker in `PLAN.md` only.
- [x] Run Phase 3 prereq verification.
- [x] Start or confirm full app runtime.
- [x] Sign in with the test account, run `__wipe()` and `__seed()`.
- [x] Verify Home projection, this-week, streak, up-next, and recent activity.
- [x] Verify Week burn-up chart, daily bars, provisional finish, and past-week nav.
- [x] Verify `/roadmaps` active hero and exactly one completed plus one abandoned history row.
- [x] Capture Home, Week, and Roadmaps screenshots.
- [x] Decide whether pace tuning is needed.
- [x] Tune `apps/app/src/dev/seedTestData.ts` so active hero lands in the 40-70% acceptance range.
- [x] Re-run app typecheck after final seed tuning.
- [x] Re-run app lint after seed tuning.
- [x] Re-run the live screenshot pass after pace tuning.
- [x] Fill Phase 3 implementer report in `VERIFICATION.md`.
- [x] Update `.work/STATUS.md`.
- [x] Commit Phase 3 and amend `pending` to the real commit SHA.
- [x] Read the reviewer-fix plan from the fresh context.
- [x] Switch seed date handling from UTC day keys back to local calendar-day keys.
- [x] Add deterministic `Asia/Kolkata` boundary coverage for the reviewer finding.
- [x] Run grep guards, app typecheck, app lint, app tests, and progress tests.
- [x] Repeat full-app live browser verification after the fix.
- [x] Fill reviewer findings and redo resolution sections for Phases 1-3.
- [x] Commit reviewer blocker fix and replace pending SHA references.

## In-flight edits
- none

## Decisions in force
- D-01: dev-only seed scope; do not change production progress, roadmap, chart, or page logic.
- D-02: past roadmaps will carry no `SessionLogged` when Phase 2 runs.
- D-03: all seed dates are relative to the run date.
- D-04: seeded active `SessionLogged` events omit `materialPosition`.
- D-05: leave today and future bookings unlogged.
- D-06: booking material assignment is sequential in curriculum order.
- D-07: chart and projection issues require live verification before any production change.
- Phase 1 implementation omits Phase 2-only terminal-event imports until Phase 2 to satisfy `noUnusedLocals`.
- New console help text uses plain hyphens to follow project punctuation instructions.
- Seed date keys use local day helpers to match Home's `format(new Date(), 'yyyy-MM-dd')` convention.
- Phase 2 proceeds by explicit user request even though Phase 1's reviewer block is still blank.
- Phase 2 terminal payload objects stay unannotated so the plan's grep guard counts only emitted terminal event kinds.
- Phase 3 proceeds by explicit user request even though prior reviewer sections are still blank.
- Phase 3 live checks must wait for `Synced` before `__wipe()` / `__seed()`; otherwise initial cloud restore can overwrite the seed on reload.
- The seed may tune its deterministic skip probability because the active hero acceptance target is based on completed booking count, not logged minutes.

## Resolved (recent)
- Step 0 planning baseline resolved: `PLAN.md` and `VERIFICATION.md` are already tracked in `1532a5c`.
- Phase 1 prereqs resolved: legacy `slots` present, `materialIds` and `SessionBookedPayload` exist, and `DayOfWeek` is exported.
- Punctuation decision resolved: new text uses plain hyphens, not em dashes.
- Phase 1 implementation commit resolved: `ebf6bbf`.
- Phase 1 verification resolved: grep guards, typecheck, lint, and live Chromium smoke passed.
- Phase 2 helper prereq resolved: `bookingsForWindow`, `roadmapEvent`, and `bookingEvent` are present.
- Phase 2 prereq drift resolved: the semantic placeholder was present despite exact grep case and punctuation drift, and the user had explicitly requested Phase 2.
- Phase 2 static verification resolved: grep guard returned `2`, typecheck passed, and lint exited 0 with the same four pre-existing warnings.
- Phase 2 live smoke resolved: `/study/roadmaps` showed exactly two history rows, one abandoned and one completed, with zero browser console errors.
- Phase 2 commit resolved: `edd31ba`.
- Phase 3 browser-launch blocker resolved: sandboxed Chromium failed with macOS Mach port permission, and escalated Playwright runs worked.
- Phase 3 script selector issue resolved: the sign-in submit button must be selected as `form button[type="submit"]` because the disabled Google button also contains "Continue".
- Phase 3 sync timing issue resolved: wait for the sync indicator to show `Synced` before seeding.
- Phase 3 active hero resolved: `PAST_SESSION_SKIP_PROBABILITY = 0.01` yields `41%`.
- Phase 3 projection resolved: pace multipliers `0.78 + rand() * 0.1` and `0.62 + rand() * 0.1` yield `4 DAYS EARLY`.
- Phase 3 screenshots resolved: final Week screenshot captures the visible burn-up chart before the past-week navigation click.
- Phase 3 commit resolved: `cf91289`.
- Reviewer blocker resolved in working tree: the seed no longer uses UTC day boundaries for booking date keys.
- Reviewer blocker resolved in `337976b`: Phase 1, Phase 2, and Phase 3 reviewer sections are filled and marked verified.
