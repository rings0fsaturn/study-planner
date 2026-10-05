# State – assessment-library-practice-hub

_Spec: GitHub #81 (rings0fsaturn/study-planner) + prototype #80 · Plan: `.work/plans/2026-09-28-assessment-library-practice-hub.md` · STATUS row: assessment-library-practice-hub · Status: active (Phases 1-5 done + gates passed, Phase 6 not started) · Updated: 2026-09-28_

## Current state & next

- Phase 0 done: task opened 2026-09-28, baseline recorded (app 1006/1008, 2 pre-existing TZ flakes; typecheck/lint clean), prototype untouched.
- Phase 1 done and green: `apps/app/src/library/` (34/34 focused tests incl. partial/failed-sizing/missing-warnings/account-switch tests; `tsc` + `eslint` clean; full suite 1040 passed + same 2 pre-existing flakes). Both review gates re-PASS after fixing every BLOCK/MAJOR/MINOR code finding.
- Phase 2 done and green 2026-09-28: subnav on /materials + /assessments, NavBar Materials prefixes, LibraryCards + library.css, AssessmentLibrary page, /assessments route, shared formatShortDate (4 call sites). Focused 78/78, full suite 1057 passed + 2 pre-existing flakes; typecheck/lint clean; OCR PASS + refix re-PASS; thermo BLOCK then re-PASS; browser-verified 1280/375 (9 real cards, zero console errors, no overflow; evidence in plan/evidence/).
- Phase 3 done and green 2026-09-28: /practice route + PracticeHub (Resume/History sections) + PracticeRunCard (full D-05 run table) + shared LibraryHubShell (both hubs migrated onto it). Focused 10/10 new, 18/18 both hubs, 52 with library suites; full suite 1069 passed + same 2 pre-existing TZ flakes; tsc + eslint clean; OCR PASS + refix re-PASS; thermo PASS + refix re-PASS; browser-verified 1280/375 (honest empty state on shared account, subnav counts, Materials tab active, zero console errors, no overflow; evidence in plan/evidence/phase3-*).
- Phase 4 done and green 2026-09-28: MaterialLibrarySection (compact list via useLibraryRows({materialId}), shared family/mode labels, full D-05 notes incl. missingCount) wired below Used by; placeholder retired to "Not attached to any roadmap yet.". Focused 74/74, full suite 1077 passed + same 2 pre-existing TZ flakes, tsc + eslint clean; OCR PASS-WITH-MINORS + thermo BLOCK both cleared on refix (labels shared, state tests added); browser-verified 1280/375 (empty + populated ACCA 9-row backlink, zero errors, no overflow; evidence in plan/evidence/phase4-*).
- Phase 5 done and green 2026-09-28: backlink polish only (4 inline styles folded into library.css, 44px backlink link targets, aria-labelledby on materialId, ready-score moved to tabular .library-score, title 18px -> 1.125rem on OCR refix). Browser-verified 1280/375 via throwaway live spec (zero console errors, no overflow on /assessments /practice /materials, keyboard focus + Enter opens, reduced-motion dots static; evidence in plan/evidence/phase5-*; spec deleted after). Focused 77/77, full suite 1077 passed + same 2 pre-existing TZ flakes; tsc + eslint clean; OCR PASS-WITH-MINORS + thermo PASS-WITH-MINORS, all findings fixed or explicitly deferred.
- Next: Phase 6 live E2E + full verification (owns e2e/assessment-library-live.spec.ts, VERIFICATION.md AC matrix, build, prototype removal is Phase 7).

## Done so far

- 2026-09-28 Phase 0: oriented on plan preamble, Decisions D-01..D-10, live code (`sync/types.ts`, `practiceRunModel.ts`, `App.tsx`, `NavBar.tsx`); created task folder, `state.md`, `SCRATCHPAD.md`, `plan/VERIFICATION.md` (AC1-AC7 matrix seeded from #81).
- 2026-09-28 Phase 1 TDD: `libraryModel.test.ts` (21 tests: pointer lists, D-05 assessment/run tables, ordering, split) -> `libraryModel.ts` (reuses `findPracticeRun`, `buildPracticeRunModel`, `buildReviewModel`, `mergeEnvelopes`); `useLibraryRows.test.tsx` (9 tests: hydration, cache write + attempt merge, cache fallback, offline + error count, reload-only-failed, generating poll, materialId filter, single `listMaterials` + fallback, counts) -> `useLibraryRows.ts` (`useLibraryRows` + `useLibraryCounts`, concurrency 4, 3 s poll gated on generating/in-flight, `reload()` retries failed ids only).
- 2026-09-28 Phase 1 verification: focused 30/30 green; full app suite 1036 passed / 2 failed (pre-existing `seedTestData.test.ts` TZ flakes, identical to baseline); `tsc --noEmit` clean; `eslint src/library` clean.

## Review verdicts (Phases 1-4: all re-PASS 2026-09-28)

Phase 1 fixes verified: per-user flow recreation + full state reset + flowOwner gate (cross-user writes gone); poll-only-active-subset (missing-envelope in, failedIds out) + in-flight guard; warningReasonOf field guard; failed totalCount from recipe.questionCount; single finishedByRun (createdAt tie-break); shared isGraded; split hydrateEnvelopes/hydrateTitles + titles Set; stable callbacks; parallel attempts; logger.debug advisory paths; content-key deps.
Phase 2 verdicts: OCR PASS (rules 12/11/42/17, D-05, a11y; accepted MAJOR: /practice tab targets unbuilt route until Phase 3; fixed MINORs: subnav end, NavBar test cleanup; deferred MINORs: regenerate log-only signal, formatter TZ, inline closure). Thermo BLOCK lifted on refix (formatShortDate shared ×4, material-row-status/actions-wrap reuse, internals unexported, subnavLinkClass).
Phase 3 verdicts: OCR PASS (D-05 mapping verified against buildPracticeRunRow/splitRunRows, single-accent, stretched-link, basename, rule 42 failed-honesty, a11y; 2 MINORs fixed: scriptReady dead param, CSS Phase 2 header) + refix re-PASS. Thermo PASS (2 MAJOR duplications: hub-chrome fixed via shared LibraryHubShell with 2 callers, card-internals deferred to Phase 5 full-diff gate per rule-of-three; abandoned graded-count MINOR rejected per locked D-05) + refix re-PASS (2 new MINORs fixed: shell-owned CSS imports, direct onReload handler).
Deferred product sign-off: OCR MINOR-4 (partial-envelope-as-ready row state).
Phase 4 verdicts: OCR PASS WITH MINORS (2 MAJORs fixed: missingCount note, failed/generating/unavailable tests; 6 MINORs: labels-dedup + innerHTML fixed, 44px/inline-styles/aria/tabular/'Failed' deferred to Phase 5). Thermo BLOCK lifted on refix (B1 shared familyLabel/modeLabel exports, B2 missingCount note + partial test; full shell convergence stays Phase 5).
Phase 5 verdicts: OCR PASS-WITH-MINORS (px title fixed to 1.125rem; nested-ternary MINOR declined as pre-existing Phase 4 idiom). Thermo PASS-WITH-MINORS (status-inline 4-site convergence + 44px touch-target token filed as follow-up slices, not this polish diff; t-display-3 + rem-override kept to preserve the Fraunces typeface).

## Files affected

- New: `apps/app/src/library/libraryModel.ts`, `apps/app/src/library/libraryModel.test.ts`, `apps/app/src/library/useLibraryRows.ts`, `apps/app/src/library/useLibraryRows.test.tsx`, `apps/app/src/library/LibraryCards.tsx`, `apps/app/src/library/library.css` (Phase 5: +`.library-backlink-*` classes, 44px backlink targets), `apps/app/src/library/LibraryHubShell.tsx`, `apps/app/src/library/MaterialLibrarySection.tsx` (Phase 5: CSS classes replace 4 inline styles, aria-labelledby on materialId, tabular `.library-score`), `apps/app/src/lib/formatShortDate.ts`, `apps/app/src/lib/formatShortDate.test.ts`, `apps/app/src/materials/MaterialsSubnav.tsx`, `apps/app/src/materials/MaterialsSubnav.test.tsx`, `apps/app/src/components/NavBar.test.tsx`, `apps/app/src/pages/assessments/AssessmentLibrary.tsx`, `apps/app/src/pages/assessments/AssessmentLibrary.test.tsx`, `apps/app/src/pages/practice/PracticeHub.tsx`, `apps/app/src/pages/practice/PracticeHub.test.tsx`.
- Modified: `apps/app/src/pages/practice/practiceRunModel.ts` (export isGraded), `apps/app/src/components/NavBar.tsx` (Materials prefixes), `apps/app/src/App.tsx` (/assessments + /practice routes), `apps/app/src/pages/materials/MaterialLibrary.tsx` (subnav + shared date), `apps/app/src/pages/materials/MaterialDetail.tsx` (shared date), `apps/app/src/prototype/material-library/MaterialLibraryPrototype.tsx` (shared date), `apps/app/src/pages/materials/MaterialLibrary.test.tsx` (+1 subnav test).
- Modified: `apps/app/src/pages/practice/practiceRunModel.ts` (export isGraded), `apps/app/src/components/NavBar.tsx` (Materials prefixes), `apps/app/src/App.tsx` (/assessments route), `apps/app/src/pages/materials/MaterialLibrary.tsx` (subnav + shared date), `apps/app/src/pages/materials/MaterialDetail.tsx` (shared date + Phase 4 backlink section + placeholder retirement), `apps/app/src/pages/materials/MaterialDetail.test.tsx` (Phase 4 provider wrap + 8 backlink tests), `apps/app/src/library/LibraryCards.tsx` (Phase 4 exported familyLabel/modeLabel), `apps/app/src/prototype/material-library/MaterialLibraryPrototype.tsx` (shared date), `apps/app/src/pages/materials/MaterialLibrary.test.tsx` (+1 subnav test).
- Task records: `.work/active/assessment-library-practice-hub/state.md`, `SCRATCHPAD.md`, `plan/VERIFICATION.md`; `.work/STATUS.md` row; plan phase markers.
- Untouched (other tasks' dirt): repair-validation-resilience files, college deletions, prototype dir + `App.tsx` prototype route.

## Pitfalls & rules

- Never `git add -A`; stage only plan-named paths. Never print or commit credentials.
- Rules in force: 10, 11, 12, 15, 16, 17, 30, 32, 33, 42, 53.
- No schema, event, server, or logging change (D-10).
- Test timing lesson: pre-hydration empty envelopes render `unavailable`, so hook tests must wait for post-hydration signals (`a-2:ready`, `errors 1`), not the first `unavailable` paint.

## Decisions in force

- D-01..D-10 from the plan.
- `unavailable` run rows sit in Resume (they carry a Resume action; plan table order implies it).

## Open

- Phase 6 live E2E + full verification (not started; owns the live spec, VERIFICATION.md AC matrix, build).
- Card-shell convergence: note fragments converged in Phase 4 refix; full shell unify stays deferred per thermo rule-of-three.
- Follow-up slices filed at Phase 5 gate (not this ticket): status-inline convergence across cards + backlink (4 sites), `--touch-target` token for the 3rd 44px literal, early-return refactor of the backlink nested ternary.
- Offline material titles fallback "Material unavailable" (D-08 follow-up).
- Cache writes on taking/review/run screens deferred (follow-up).
- Regenerate-failure user signal; formatter TZ pin; formatMinutes dedup candidate.
