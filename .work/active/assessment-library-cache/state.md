# State – assessment-library-cache

_Spec: .work/specs/issues/assessment-library-cache.md · Plan: .work/active/assessment-library-cache/plan/ · STATUS row: assessment-library-cache · Status: active · Updated: 2026-10-09_

## Current state & next

- P1-P3 done 2026-10-09: cache-first seed plus background revalidation (P2), hub polish (P3), review gates re-passed, live AC1-AC3 + request-id join verified.
- Focused suites 62 green; `tsc --noEmit` and eslint clean; full app suite 1089 pass with only the 2 known `seedTestData` TZ flakes.
- R1 PASS and R2 PASS-WITH-MINORS for both P2 and P3 recorded in `plan/VERIFICATION.md`; review-fixed items landed, deferrals explicit.
- Next: wrap the task (move to archive, flip STATUS row) once the user confirms; AC4 live account switch stays unit-only because only one live dev account exists.

## Done so far

- 2026-10-09 OPEN: created `.work/active/assessment-library-cache/` (plan, prompts, research) plus spec `.work/specs/issues/assessment-library-cache.md` plus STATUS row.
- 2026-10-09 START: bootstrapped `state.md` and seeded `SCRATCHPAD.md` from spec and live code.
- 2026-10-09 PLAN: wrote `plan/PLAN.md` (mechanism, slices, gates) and seeded `plan/VERIFICATION.md` (AC1-AC5 matrix).
- 2026-10-09 P1: added 5 behavior tests to `apps/app/src/library/useLibraryRows.test.tsx` (cache-first paint, stale convergence, failed-revalidation retry scope, cache-seeded account switch, concurrent titles) plus `seedCached` and `renderAccountSwitcher` helpers and a `refreshing` probe readout.
- 2026-10-09 P2: `seedFromCache` plus `refreshing` plus the restructured hydration effect in `apps/app/src/library/useLibraryRows.ts`.
- 2026-10-09 R1/R2 first pass found one must-fix (effect-body failedIds repair); fixed by render-time `uniqueIdSet`/`visibleFailedIds`; re-reviews PASS / PASS-WITH-MINORS.
- 2026-10-09 P3: `LibraryHubRefreshing` (inline No-Spinner dots + mono-caps "Refreshing", `role="status"`) behind a `refreshing` prop on `LibraryHubShell`; both hubs gate it `!loading && refreshing && rows > 0`; `MATERIAL_TITLE_PENDING` ('Loading title…') replaces the `MATERIAL_UNAVAILABLE` page fallback; `hydrateTitles` resolves referenced ids to `MATERIAL_UNAVAILABLE` on list failure; 4 new tests (indicator x2, pending title, titles failure, cold-cache negative gate).
- 2026-10-09 P3 R1/R2 reviews: PASS / PASS-WITH-MINORS, no must-fix; inert CSS color removed, cold-cache negative test added, PLAN line 24 corrected; structural minors deferred with reasons in `plan/VERIFICATION.md`.
- 2026-10-09 P5 live: with 9 warm cached envelopes and all assessment GETs delayed 4 s, reload painted 9 rows at 1309 ms with the indicator visible, then converged (evidence `plan/evidence/reload-cached-refreshing.png`); offline eviction scenario painted 9 rows at 1334 ms with 1 honest unavailable + working Retry (evidence `plan/evidence/offline-cached-retry.png`); request id `1cf28218-…` joined to the intelligence log (GET /v1/assessments/85b8b234-… 200).

## Flow trace

1. Library hub gating lives in `apps/app/src/pages/assessments/AssessmentLibrary.tsx:34` with `useLibraryRows().loading`.
2. Loading remains `!eventStore || events == null || !hydrated`; `hydrated` now flips as soon as any envelope is seeded from Dexie, or after the envelope network pass on a cold cache.
3. Main effect (`apps/app/src/library/useLibraryRows.ts`): `seedFromCache` (Dexie envelope plus local attempts) -> paint -> start `hydrateTitles` concurrently -> `hydrateEnvelopes` revalidation -> `setFailedIds`.
4. `refreshing` is true while that background work runs; it is the P3 indicator input and is reset on account switch.
5. `mergeEnvelopes` (`apps/app/src/pages/practice/practiceRunModel.ts:69`) stays the only merge path, so stale cache to fresh network keeps assessment identity.
6. `hydrateEnvelopes` failure path falls back to `cachedAssessment`, so failed revalidation never blanks a painted row; only uncached ids reach `failedIds`.
7. `visibleFailedIds` intersects `failedIds` with the current `uniqueIds` at render, hiding stale cross-account failures from `errorCount`, `reload`, and `activeIds`.
8. Active-subset poll untouched; cached rows with local attempts read via `seedFromCache` then `refreshAttempts` merges server echoes.
9. P3: `LibraryHubShell` owns the background-revalidation indicator (inline `processing-dots` + mono-caps `Refreshing`, `role="status"`); hubs pass `refreshing={!loading && refreshing && rows.length > 0}` so it never shows with the skeleton or empty state.
10. P3: page title fallback is `MATERIAL_TITLE_PENDING` while `materialTitles[id]` is absent; `hydrateTitles` success and failure both resolve every referenced id, so pending only exists while the list call is in flight.

## Files affected

- `.work/specs/issues/assessment-library-cache.md` – task contract – why.
- `.work/active/assessment-library-cache/state.md` – durable task record – why.
- `.work/active/assessment-library-cache/SCRATCHPAD.md` – session ledger – why.
- `.work/active/assessment-library-cache/plan/PLAN.md` – implementation plan – why.
- `.work/active/assessment-library-cache/plan/VERIFICATION.md` – AC matrix plus review log – why.
- `apps/app/src/library/useLibraryRows.ts` – cache-first seed, `refreshing`, concurrent titles, render-time visible failures (P2); `MATERIAL_TITLE_PENDING` plus titles-failure resolution (P3).
- `apps/app/src/library/useLibraryRows.test.tsx` – 5 slices plus shared fixtures (P1); titles-failure test (P3).
- `apps/app/src/library/LibraryHubShell.tsx` – `refreshing` prop plus `LibraryHubRefreshing` indicator – P3.
- `apps/app/src/library/library.css` – `.library-refreshing` layout rule – P3.
- `apps/app/src/pages/assessments/AssessmentLibrary.tsx` – indicator gate plus pending title fallback – P3.
- `apps/app/src/pages/practice/PracticeHub.tsx` – indicator gate plus pending title fallback – P3.
- `apps/app/src/pages/assessments/AssessmentLibrary.test.tsx` – indicator, pending-title, and cold-cache negative-gate tests – P3.
- `apps/app/src/pages/practice/PracticeHub.test.tsx` – indicator test plus `seedCached` helper – P3.
- `.work/active/assessment-library-cache/plan/evidence/` – live reload/offline screenshots – P5.
- `.work/STATUS.md` – Active row for assessment-library-cache – why.

## Pitfalls & rules

- Must keep per-user isolation: flow recreation plus full view-model reset on account switch per `useLibraryRows.ts` (rule 30).
- On account switch the new flow pairs with the old user's events for a tick; never repair `failedIds` in the effect body, derive visibility from the current id set instead (race found by R2).
- Must not change generation semantics: one family plus one question per call with bounded concurrency per rule 42.
- Must keep error normalization centralized in `assessmentClient.ts` per rule 22.
- Must route new frontend warnings through `logger`, keep `X-Request-ID` per logical call, no silent except per rule 17.
- Must test Dexie through unique per-test fake users plus cleanup per rule 32; no production `StudyTracker_<userId>` names with real users.
- Must not edit a released Dexie version; no schema change in this slice (rule 31).
- Must stage only plan-named paths; never print or commit credentials; preserve unrelated worktree changes.
- Vite on WSL serves stale code after `/mnt/d` edits: restart the app (`./full-app restart app`) before any live browser verification, or cache-first behavior looks broken when the old bundle is running (rule 53; hit during P5).

## Decisions in force

- Decided cache-first with background revalidation over a bulk list endpoint because it needs no server or schema change (2026-10-09).
- Decided to keep `mergeEnvelopes` as the merge authority because practice recovery already proved it identity-stable (2026-10-09).
- Decided TDD vertical slices (one behavior then minimal code) per the tdd skill, not horizontal test dumps (2026-10-09).
- Decided titles never gate first paint; pages fall back until titles land (2026-10-09).
- Decided a cold cache keeps the skeleton until the first network pass because there is nothing honest to paint (2026-10-09).
- Decided stale failures are hidden at render via `visibleFailedIds`, not repaired in an effect (2026-10-09).
- Decided GET revalidation stays at `HYDRATION_CONCURRENCY` 4; it rises only with measured p95 and generation bounds stay fixed (2026-10-09).
- Decided the refreshing indicator is the No-Spinner inline dots + mono-caps label in the hub head, gated on painted rows, because the design system has no other background-activity language and the Sync Indicator precedent is a pill (2026-10-09).
- Decided a titles list failure resolves referenced ids to `MATERIAL_UNAVAILABLE` because a failed list is a resolved outcome; permanent pending would lie (2026-10-09).
- Decided the neutral placeholder is a render-time `?? MATERIAL_TITLE_PENDING` fallback, not stored state, because absence already means unresolved (2026-10-09).

## Open

- AC4 live account switch deferred: only one live dev account exists; unit slice 4 covers the reset path.
- P3 review deferrals: cross-file `ProcessingDots` extraction (4th copy, touches Home/PracticeCoach/LoadingState); folding `!loading` into the hook's `refreshing` signal; `fillUnavailableTitles` helper for the two fallback loops; empty `primaryMaterialId` would show pending (unreachable from shipped writers).
- Follow-up candidates from P2 reviews: useLiveQuery display-source restructure, poll/revalidation overlap, bounded local read consolidation, advisory catch dedup.
- `seedFromCache` extraction kept despite one call site: both the seeded paint and the failed-revalidation fallback share the path; plan line 44 makes extraction optional (R1 defer-ok).
- `mergeEnvelopes` can momentarily downgrade a fresher in-memory envelope to a staler cache row only if the advisory cache write failed; revalidation converges (R2 defer-ok).
- Rule-32 strictness on the test helper DB naming deferred: it follows the file's existing seeded-store pattern with per-test cleanup of invented users.
- One full-suite run showed a load-induced flake in the pre-existing dirty `PracticeRun.test.tsx` (passes 3/3 standalone); not touched by this change.
