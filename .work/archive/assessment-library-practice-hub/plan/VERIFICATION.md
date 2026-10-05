# Verification – assessment-library-practice-hub

_Plan: `.work/plans/2026-09-28-assessment-library-practice-hub.md` · Ticket: #81 · Prototype: #80_

## AC matrix

| AC | Claim | Evidence | Status |
|---|---|---|---|
| AC1 | Both hubs live at `/assessments` and `/practice` (basename-safe), nested under Materials tab + sub-nav, B card grid at 1280 and 375 with empty states | `e2e/assessment-library-live.spec.ts` desktop + phone (both green 2026-09-29); `plan/evidence/assessment-library-desktop.png`, `assessment-library-mobile.png` | ✅ |
| AC2 | Objective, written, coding rows render honest status/score and open shipped taking/review; hidden material veiled | Live: objective generated + graded (score 1.00/0.00 on card), hub card click lands on shipped `Objective assessment` review (summary + navigator terminal tab); REDACTION_RE clean on detail + run pages | ✅ |
| AC3 | Practice resume reopens at resume point, completed reopen summary, abandoned read as history, generating honest with no invented grade | Live desktop: 1-problem written run graded, Resume click reopens `Problem 1`, `Finish run` lands `Run summary`, History `Open summary` reopens summary. Live phone: in-progress run resumes at `Problem 1` | ✅ |
| AC4 | Material detail backlink section; placeholder gone; roadmap Used by untouched | Live desktop: `Assessments and practice runs` backlink lists the fresh assessment href; `Assessments will appear here once created.` count 0; `Used by` block untouched (renders `DSA` roadmap row) | ✅ |
| AC5 | Every honest state reachable at both widths, zero console errors, no overflow | `errors()` fixture empty in both scenarios; `assertNoOverflow` green both widths; desktop grid >= 2 columns, phone grids exactly 1 column | ✅ |
| AC6 | Marginalia world; typecheck/lint/build green; live E2E green at 1280+375 with request-id join and cleanup | `pnpm --filter app test` 1077 passed + 2 pre-existing `seedTestData` TZ flakes (Phase 0 baseline); `pnpm typecheck` clean; `pnpm lint` clean; `pnpm build` green; generation `X-Request-ID 730fa22e-...` joins to 1 intelligence log line; PostgREST cleanup verified 0 leftovers; build contains no prototype JS (0 hits in `dist/assets/*.js`; route string only in DEV-guarded sourcemap source, removed in Phase 7) | ✅ |
| AC7 | Wayfinder exit: resolution comment, ACs ticked, map #4 line, close | Resolution `issuecomment-5995858547`, 7/7 ticked, map #4 `issuecomment-5995871363` + local `research/map-4.md` line, #81 CLOSED 2026-10-05 | ✅ |

## Commands and results

- Phase 0 baseline 2026-09-28: `pnpm --filter app test` 1006 passed / 2 failed (seedTestData TZ flake); `pnpm typecheck` clean; `pnpm lint` clean.
- Phase 1 2026-09-28: `vitest run src/library` 30/30 green; `pnpm --filter app test` 1036 passed / 2 failed (same pre-existing flakes); `tsc --noEmit` clean; `eslint src/library` clean.
- Phase 6 2026-09-29: `e2e/assessment-library-live.spec.ts --project=app --workers=1` 2 passed (desktop 2.1m, phone 1.3m); `pnpm --filter app test` 1077 passed / 2 failed (same pre-existing seedTestData TZ flakes); `pnpm typecheck` clean; `pnpm lint` clean; `pnpm build` green.
- Phase 6 2026-10-05 (this session): focused `vitest run src/library AssessmentLibrary PracticeHub` 52/52 green; `pnpm --filter app test` 1077 passed + same 2 pre-existing flakes; `pnpm typecheck` clean; `pnpm lint` clean; live round 1 (unmodified spec) 2 passed 3.6m; live round 2 (strengthened spec, see TDD) 2 passed 2.8m (desktop 1.7m + phone 1.1m, both request-id joins 1 line each); `pnpm build` green.
- Phase 7 2026-10-05: prototype dir deleted (3 files, 1364 lines) + `App.tsx` DEV route removed (7 lines); `pnpm build` green (chunk-size warning only); `dist` 0 hits for `assessment-library-prototype` / `AssessmentLibraryPrototype` (whole-dist grep); `pnpm typecheck` + `pnpm lint` clean; focused 82/82; full suite 1077 passed + same 2 pre-existing `seedTestData` TZ flakes (one transient `useLibraryRows reloads-only-failed` flake on first full run, green in isolation and on re-run); graphify scoped `update apps/app/src` rebuilt (2318 nodes, 6443 edges); full-repo `update .` timed out at 180s (recorded, not a gate).

## TDD evidence (RED -> GREEN)

- Phase 6: spec TDD is scenario-as-test. RED rounds (each fixed without weakening the assertion): (1) objective grade asserted inside the unmounted taker - real UI renders the review surface, switched to navigator-tab + summary-score (the practice-run-live pattern); (2) link located by href-as-accessible-name - accessible name is the title text, switched to `href$=` (basename-proof); (3) nested `filter({has})` card scoping - switched to atomic `article:has(a[href$=...])` plus first-card + href-identity where newest-first order guarantees it; (4) graded detail shows review not taker - assertion switched to the shipped review treatment; (5) backlink 60s timeout on a 10-envelope hydration - budget raised to 180s, green.
- Phase 6 2026-10-05 review-gate hardening (strengthened green spec, never weakened): (a) phone one-column guard made unconditional with `expect(grid).toBeVisible` wait; (b) response-body redaction tracking added (`watchResponses` + `assertRedaction`, coding-assessment-live pattern) over `/rest/v1|/v1/assessments|/v1/attempts` plus DOM; (c) generation retry loop count-based (no `isVisible` sampling); (d) dead `HUB_WAIT_MS` deleted; (e) phone captures and joins its own generation `X-Request-ID`. Re-run: 2 passed 2.8m.

## Review gate

- Phase 1 2026-09-28: OCR delegate BLOCK (stale per-user AttemptFlow, rule 30; poll-all scope MAJOR; 6 MINORs) + thermo-nuclear BLOCK (dual finished-resolution; third is-graded predicate; 3 MAJORs). Fixes deferred by human STOP. Detail in `state.md` Review verdicts.
- Phase 6 2026-10-05: OCR delegate PASS-WITH-MINORS (2 MAJOR spec-strength: phone vacuous grid guard, response-body redaction gap; 4 MINOR: dead HUB_WAIT_MS, isVisible sampling, phone log-join gap, .first() noted OK - all fixed in spec, re-run green). Thermo-nuclear PASS-WITH-MINORS (6 MINOR: newest-first comparator 5x, CardActions shell 5x, phone vacuous same, dead const same, count/totalCount, dbOf wrapper; known-deferred not re-flagged - impl refactors deferred, prior gates stand). Detail in `SCRATCHPAD.md`.
- Phase 7 2026-10-05: OCR delegate PASS (no Critical/High/Medium; 2 LOW test-only notes: response redaction race + unbounded buffer, optional polish, not blocking). Thermo-nuclear PASS-WITH-MINORS (2 MINOR test-only duplications: generation-id tracker + log-join block, deferred to next e2e touch, no action before merge). Deletion is the code-judo move (-1364 lines, one branch removed, zero new abstractions). Both verdicts recorded; no fix required.

## Live evidence

- Phase 6 2026-10-05: `plan/evidence/assessment-library-desktop.png` + `assessment-library-mobile.png` refreshed by the strengthened-spec run (2 passed 2.8m, both request-id joins green, redaction clean).
