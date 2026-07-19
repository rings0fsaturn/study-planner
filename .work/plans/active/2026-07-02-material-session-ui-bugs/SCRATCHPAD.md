# Scratchpad - material-session-ui-bugs

_Plan: PLAN.md · Log: VERIFICATION.md · Updated: 2026-07-03T22:58 (Phase 8 implemented and committed in `f6313f8`)_

## Now
**Phase 8 is now active.**
The target is BUG-6: fix the cold-start cloud-restore race by gating centrally in `SyncProvider`, adding `initialRestorePending` to `SyncState`, keeping the already-hydrated fast path effectively instant, and rendering the D-09 Option C1 branded boot screen while a true cold-start restore is pending.
Phase 8 prereqs passed on 2026-07-03: the old four-field `SyncState` is still present, the `restoreFromCloud()` `finally` exists, `initialRestorePending` is absent, and `pnpm --filter @study-tracker/app test -- SyncEngine SyncProvider` passed with 59 files and 523 tests.
SyncEngine and SyncProvider red-green slices are complete.
Added three restore-pending tests in `apps/app/src/sync/SyncEngine.test.ts`, confirmed the expected red failure (`initialRestorePending` was `undefined`), then implemented the flag in `apps/app/src/sync/types.ts` and `apps/app/src/sync/SyncEngine.ts`.
Focused `pnpm --filter @study-tracker/app test -- SyncEngine` passed with 59 files and 526 tests.
Added provider tests for the boot-screen gate, timeout fallback, and `resolveInitialRestoreSafetyTimeoutMs`.
Confirmed the expected red failure for the missing `Study Tracker` boot screen, then implemented `BootScreen`, timer state, child gating, and timeout parsing in `apps/app/src/sync/SyncProvider.tsx`.
Focused `pnpm --filter @study-tracker/app test -- SyncProvider` passed with 59 files and 532 tests.
Added `.boot-*` CSS in `packages/design-tokens/src/components.css`, documented `VITE_INITIAL_RESTORE_TIMEOUT_MS`, and updated `SyncIndicator.test.tsx` fixtures for the new required `SyncState` field.
Phase 8 grep checks passed, `pnpm --filter @study-tracker/app typecheck` passed, and `pnpm --filter @study-tracker/app test -- SyncEngine SyncProvider` passed with 59 files and 532 tests.
Managed full-app browser verification passed after sandbox fallbacks: final path `/study/roadmaps`, route log only `/study/roadmaps`, no `/study/onboarding/1`, boot screen visible, observed boot-screen duration about 2808ms, and no browser console/page errors.
Reduced-motion verification passed: line/dot/caption animations computed to `none`, the line dash offset was `0px`, dot opacity was `1`, and caption opacity was `1`.
`PLAN.md`, `VERIFICATION.md`, `.work/STATUS.md`, and this scratchpad are updated with Phase 8 implementation evidence.
Next: hand off Phase 8 for reviewer verification.

## Alignment
Still aligned with the plan.
Phases 1-5 are implemented and reviewer-verified.
Phase 6 is implemented in `33a98c9` and awaiting reviewer verification.
Phase 7 is implemented in `75f734f` and awaiting reviewer verification.
The live plan has added Phases 6-8, and the user asked to start from Phase 8.
Per the plan preamble and this request, this turn is implementing Phase 8 only.
No event model, intelligence math, Python code, `RequireOnboarding.tsx`, or `OnboardingGate.tsx` edits are in scope for Phase 8.
The existing dirty third-review report files are unrelated and must not be staged or restored.
An unrelated deleted file is present before this session: `.work/plans/active/2026-07-03 third-review-report-work/research/SCRATCHPAD-research-2.md`.
An unrelated untracked file also appeared outside this work: `.work/plans/active/2026-07-03 third-review-report-work/research/SCRATCHPAD-research-3.md`.
Do not stage or restore that unrelated deletion.

## Open
- Phase 6 needs reviewer verification.
- Phase 7 needs reviewer verification.
- Phase 8 is fully spec'd with no open design questions.
  The live plan and `STATUS.md` say D-09 Option C1 is agreed; the older `VERIFICATION.md` Phase 8 acceptance checklist still contains one stale line saying the visual was pending.
  Resolved: `VERIFICATION.md` was corrected while filling the Phase 8 report.
- Run the authored hermetic E2E specs (`e2e/material-session-decoupling.spec.ts`'s two new BUG-2/BUG-4 cases) on a machine with `SUPABASE_SERVICE_ROLE_KEY` set — the reviewer replicated their assertions manually against the real test account instead, since the key is unset here. (Pre-existing item from the Phase 1-5 review, still open.)
- Phase 8's Verification (DONE) step now also asks the implementer to record the *actual observed* cold-start restore duration during the live re-check (there's no production telemetry for this yet — D-09 leaned on an existing app-wide timeout convention, `intelligenceClient.ts`'s `TIMEOUT_MS=8000`, rather than a measurement). Worth surfacing if that number turns out to be way off from 8000ms.

## Blockers
- none

## Deferrals
- BUG-4d: back-to-`/roadmaps` exit for re-entrant onboarding remains deferred.
  Trigger: picking up re-entrant onboarding UX work.
- Cleaner `.modal-overlay` and `.modal-card` consolidation remains deferred.
  Trigger: a follow-up modal consistency pass after the targeted `.bk-*` fix.
- Full Phase-5-port responsive-rule sweep remains deferred.
  Trigger: broader roadmap CSS audit, not this targeted burn-up fix.

## Checklist
- [x] Read the 2026-07-03 handover, `PLAN.md`, and this scratchpad at session start.
- [x] Diff `mocks/real-css/*.css` against live source — confirmed byte-identical, no refresh needed.
- [x] Invoke `/frontend-design` for aesthetic direction on the branded-loading moment.
- [x] Design 3 candidate treatments (C1 Notebook mark, C2 Ink curtain, C3 Quiet caption) spanning minimal→bold.
- [x] Build `mocks/proposed/bug6-branded-loading.html` (baseline + 3 options × 2 viewports + long-wait toggle).
- [x] Visually verify the mock via a throwaway Playwright screenshot script — no console/page errors.
- [x] Run `/grill-me` with Rohit — picked C1, confirmed long-wait copy, agreed 8000ms made configurable.
- [x] Used `/write-implementation-plan` (adapted to update the existing living plan, not scaffold a new file) to
      write D-09 ✅ Agreed, rewrite Phase 8 Steps 5-7 and add Steps 8-9, update Files-touched/Tests/Verification, close OQ-03.
- [x] Read `.work/README.md`, `.work/STATUS.md`, `PLAN.md`, `VERIFICATION.md`, and this scratchpad.
- [x] Read project-local `project-rules`, `code-memory`, `scratchpad`, and `work-journal` skills.
- [x] Read applicable rules: `playwright-config`, `playwright-full-app-lifecycle`, `css-workspace-packages`, `form-design-spacing`, and `roadmap-engine`.
- [x] Run Phase 6 prereq greps.
- [x] Run baseline `pnpm --filter @study-tracker/app test -- RoadmapCalendar`.
- [x] Implement Phase 6 `DaySheet.tsx` scroll effect.
- [x] Add `RoadmapCalendar.test.tsx` coverage for `scrollIntoView`.
- [x] Run Phase 6 verification: grep, app typecheck, and focused RoadmapCalendar test.
- [x] Run real-app 390px browser check through the managed full-app lifecycle.
- [x] Fill Phase 6 `VERIFICATION.md` implementer report.
- [x] Update `SCRATCHPAD.md`, `.work/STATUS.md`, and Phase 6 plan status.
- [x] Commit the scoped Phase 6 changes: `33a98c9`.
- [x] Commit the docs follow-up recording `33a98c9`.
- [x] Read `.work/README.md`, `.work/STATUS.md`, `PLAN.md`, `VERIFICATION.md`, and this scratchpad for the Phase 7 start.
- [x] Read project-local skills for plan implementation, scratchpad, work-journal, project rules, code memory, TDD, debug-session, and frontend design.
- [x] Read applicable rules: `css-workspace-packages`, `form-design-spacing`, `roadmap-engine`, `playwright-config`, and `playwright-full-app-lifecycle`.
- [x] Run Phase 7 prereq greps.
- [x] Inspect CSS neighborhood and identify the scoped minute-display restore needed for D-10.
- [x] Implement Phase 7 scoped CSS rule in `apps/app/src/roadmap/roadmap.css`.
- [x] Run Phase 7 verification grep.
- [x] Run `pnpm --filter @study-tracker/app typecheck`.
- [x] Run 390px real-browser visual check.
- [x] Fill Phase 7 `VERIFICATION.md` implementer report.
- [x] Update `SCRATCHPAD.md`, `.work/STATUS.md`, and Phase 7 plan status.
- [x] Commit scoped Phase 7 code and docs: `75f734f`.
- [x] Read `.work/README.md`, `.work/STATUS.md`, `PLAN.md`, `VERIFICATION.md`, and this scratchpad for the Phase 8 start.
- [x] Read project-local skills for plan implementation, scratchpad, work-journal, project rules, code memory, and TDD.
- [x] Read applicable rules: `sync-architecture`, `sync-provider-testing`, `auth-init-timeout`, `css-workspace-packages`, `dexie-test-setup`, `playwright-config`, `playwright-full-app-lifecycle`, and `pnpm-build-registry`.
- [x] Inspect dirty tree and identify unrelated third-review report changes that must stay out of Phase 8 staging.
- [x] Run Phase 8 prereq greps.
- [x] Run baseline `pnpm --filter @study-tracker/app test -- SyncEngine SyncProvider`.
- [x] Add failing SyncEngine tests for `initialRestorePending` fast path, slow success, and slow error.
- [x] Add failing SyncProvider tests for boot-screen gating, safety-timeout fallback, and timeout parsing.
- [x] Implement `initialRestorePending` in `SyncState` and `SyncEngine`.
- [x] Implement `SyncProvider` timeout parsing, boot screen, timers, and child gating.
- [x] Add Option C1 `.boot-*` CSS in `packages/design-tokens/src/components.css`.
- [x] Document `VITE_INITIAL_RESTORE_TIMEOUT_MS` in `CLAUDE.md` and `apps/app/.env.example`.
- [x] Run Phase 8 focused tests and typecheck.
- [x] Run the fresh-profile browser re-check and reduced-motion check through `./full-app`.
- [x] Fill Phase 8 `VERIFICATION.md`, update `PLAN.md`, update `.work/STATUS.md`, and refresh this scratchpad.
- [x] Commit only scoped Phase 8 files, then replace `pending` with the commit SHA and amend: `f6313f8`.

## In-flight edits
- Phase 8 SyncEngine edits complete and focused tests green: `apps/app/src/sync/types.ts`, `apps/app/src/sync/SyncEngine.ts`, and `apps/app/src/sync/SyncEngine.test.ts`.
- Phase 8 provider edits complete and focused tests green: `apps/app/src/sync/SyncProvider.tsx` and `apps/app/src/sync/SyncProvider.test.tsx`.
- Phase 8 CSS/docs/type fixture edits complete: `packages/design-tokens/src/components.css`, `CLAUDE.md`, `apps/app/.env.example`, and `apps/app/src/components/SyncIndicator.test.tsx`.
- Phase 8 implementation/report files were committed in `f6313f8`.
- Do not stage unrelated third-review/dissertation files: `.work/plans/active/2026-07-03 third-review-report-work/research/04-application-evolution-trace.md`, deleted `SCRATCHPAD-research-2.md`, untracked `SCRATCHPAD-research-3.md`, or untracked `college/mydeliverables/REPORT_WRITING_GUIDE.md`.
- Do not touch or stage the unrelated deleted `.work/plans/active/2026-07-03 third-review-report-work/research/SCRATCHPAD-research-2.md` or untracked sibling `SCRATCHPAD-research-3.md`.

## Decisions in force
- D-05: keep burn-up rendering client-side.
- D-05: planned burn-up baseline mirrors booking capacity by selected study day, using full weekday/weekend hours per selected day.
- D-05: do not use legacy slot-grid splitting for the fixed product burn-up chart.
- `BurnUpData.startDate` and `BurnUpData.deadline` remain optional.
- Week's low-data gate stays in place.
- E2E specs may be authored but not run (though this environment can run them — see `CLAUDE.md`; Phases 6-8 lean toward actually running visual/Playwright checks where practical).
- Reuse existing Marginalia palette and chart restraint; spend the UI change on clarity, not a new visual identity.
- Design deviation in force: high-range tick values target roughly six readable intervals rather than the plan's literal 2h step for large domains.
- Do not touch unrelated dirty rule/doc files or `_perm_test.txt`.
- D-07: BUG-6's fix is centralized in `SyncProvider`; `RequireOnboarding.tsx`/`OnboardingGate.tsx` are not modified.
- D-08: `initialRestorePending` clears immediately on the fast (already-hydrated) path; only the genuine cold-start slow path blocks — never add a visible delay to ordinary page reloads for returning users.
- D-09: Phase 8 ships **Option C1 ("Notebook mark")** — resolved, no longer open. The old plain `ProtectedRoute`-style "Loading..." placeholder is fully superseded; do not implement it. Safety timeout stays 8000ms but ships as a configurable `initialRestoreSafetyTimeoutMs` prop (env-var-backed default via `VITE_INITIAL_RESTORE_TIMEOUT_MS`), not a hardcoded literal.
- D-10: Phase 7 ships Option C (icon + duration, drop "Session" label) — resolved, no longer open.
- Phase 7 must scope the CSS to `.onboarding-mini-calendar` under `@media (max-width: 560px)` only, so the main roadmap calendar and wider onboarding preview do not change.
- Phase 6 must keep the DaySheet hooks before the `if (!day) return null` early return for Rules of Hooks compliance.
- Phase 8 must use prototype spies for `SyncProvider` tests because `SyncEngine` is constructed inside a `useEffect`.
- Phase 8 must use the managed full-app lifecycle for browser verification.
- Phase 8 implementation uses a plain hyphen in the boot subcaption instead of the mock's em dash to honor the repo instruction banning em dashes.
- Phase 8 boot CSS sets new letter spacing to `0` for the new classes to honor the frontend instruction.

## Resolved (recent)
- Phase 8 implementation and verification completed.
- Focused app typecheck and `SyncEngine SyncProvider` tests passed.
- Live fresh-profile deep-link check passed with no `/study/onboarding/1` visit.
- Reduced-motion boot-screen check passed.
- D-09 (Phase 8's loading-state visual + safety-timeout duration) — resolved via `/frontend-design` mock + `/grill-me`: Option C1, long-wait copy at ~3s, 8000ms timeout made configurable. OQ-03 closed. PLAN.md's Phase 8 fully rewritten (Steps 5-9) and ready to implement.
- Phase 5's full implementation checklist (prereqs → tests → implementation → verification → commits) completed; see the previous scratchpad revision or `VERIFICATION.md` for the itemized list.
- Planning handoff state superseded by implementation state for Phase 1 and Phase 2.
- Phase 1 verification passed and commit `0268f20` exists.
- Phase 2 verification passed and commit `0268f20` exists.
- Phase 3 verification passed and commit `3c8d869` exists.
- Phase 4 verification passed and commit `3c8d869` exists.
- Phase 5 prereq verification passed before edits.
- Phase 5 focused verification passed after implementation.
- Final-gate probe passed after the tick-density visual fix.
- Scoped Phase 5 implementation commit created: `256616b`.
- Scoped `.work` docs follow-up committed after recording `256616b`.
- Phase 6 implementation and verification completed.
- Scoped Phase 6 implementation commit created: `33a98c9`.
- Scoped `.work` docs follow-up committed after recording `33a98c9`.
- Full-app browser check completed and services stopped.
- Phase 7 implementation and verification completed.
- Scoped Phase 7 implementation commit created: `75f734f`.
