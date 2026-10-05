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
| AC7 | Wayfinder exit: resolution comment, ACs ticked, map #4 line, close | Phase 7 (not started) | ☐ |

## Commands and results

- Phase 0 baseline 2026-09-28: `pnpm --filter app test` 1006 passed / 2 failed (seedTestData TZ flake); `pnpm typecheck` clean; `pnpm lint` clean.
- Phase 1 2026-09-28: `vitest run src/library` 30/30 green; `pnpm --filter app test` 1036 passed / 2 failed (same pre-existing flakes); `tsc --noEmit` clean; `eslint src/library` clean.
- Phase 6 2026-09-29: `e2e/assessment-library-live.spec.ts --project=app --workers=1` 2 passed (desktop 2.1m, phone 1.3m); `pnpm --filter app test` 1077 passed / 2 failed (same pre-existing seedTestData TZ flakes); `pnpm typecheck` clean; `pnpm lint` clean; `pnpm build` green.

## TDD evidence (RED -> GREEN)

- Phase 6: spec TDD is scenario-as-test. RED rounds (each fixed without weakening the assertion): (1) objective grade asserted inside the unmounted taker - real UI renders the review surface, switched to navigator-tab + summary-score (the practice-run-live pattern); (2) link located by href-as-accessible-name - accessible name is the title text, switched to `href$=` (basename-proof); (3) nested `filter({has})` card scoping - switched to atomic `article:has(a[href$=...])` plus first-card + href-identity where newest-first order guarantees it; (4) graded detail shows review not taker - assertion switched to the shipped review treatment; (5) backlink 60s timeout on a 10-envelope hydration - budget raised to 180s, green.

## Review gate

- Phase 1 2026-09-28: OCR delegate BLOCK (stale per-user AttemptFlow, rule 30; poll-all scope MAJOR; 6 MINORs) + thermo-nuclear BLOCK (dual finished-resolution; third is-graded predicate; 3 MAJORs). Fixes deferred by human STOP. Detail in `state.md` Review verdicts.

## Live evidence

- (Phase 6 screenshots in `plan/evidence/`)
