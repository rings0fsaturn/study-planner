# Verification – assessment-library-cache

_Plan: `plan/PLAN.md` · Spec: `.work/specs/issues/assessment-library-cache.md` · Updated: 2026-10-09_

## Gates

- [x] P1 hook tests green (slices 1-5). Evidence: `pnpm --filter app exec vitest run src/library/useLibraryRows.test.tsx src/library/libraryModel.test.ts` → 39 passed. Slices: cache-first paint (network gated); stale generating → ready convergence; failed revalidation keeps cached rows and retries only uncached ids; cache-seeded account-switch reset; concurrent late titles.
- [x] P2 hook change green (typecheck plus lint). Evidence: `pnpm --filter app exec tsc --noEmit` clean; `eslint src/library/useLibraryRows.ts src/library/useLibraryRows.test.tsx` clean.
- [x] P3 hub polish green. Evidence: indicator + pending-title tests in `AssessmentLibrary.test.tsx` / `PracticeHub.test.tsx` plus titles-failure test in `useLibraryRows.test.tsx`; focused suites → 62 passed; `tsc --noEmit` clean; eslint clean; impeccable detector only pre-existing font-size advisories.
- [x] Full app suite: no regressions beyond the 2 pre-existing TZ flakes. Evidence: `pnpm --filter app test` → 1090 passed, 2 failed (both `seedTestData.test.ts` TZ flakes noted in PLAN baseline). One load-induced flake observed in the pre-existing dirty `PracticeRun.test.tsx` (passes 3/3 standalone, 2 subsequent full runs clean); not touched by this change.
- [x] R1 code review re-PASS. Evidence: re-review verdict PASS after refix; round-1 must-fix (render-time `visibleFailedIds`) and minors 2/3/4 landed; deferrals judged honest. P3 review below.
- [x] R2 thermo review re-PASS. Evidence: re-review verdict PASS-WITH-MINORS, no must-fix; two P3-tracked minors recorded below. P3 review below.
- [x] P5 live reload plus offline plus request-id join with evidence (account switch unit-only, see AC4). Evidence: `.work/active/assessment-library-cache/plan/evidence/reload-cached-refreshing.png`, `offline-cached-retry.png`.

## AC matrix

| AC | Statement | Evidence | Verdict |
|----|-----------|----------|---------|
| AC1 | Reload with unchanged assessments paints cached rows without waiting for network. | Unit slice 1 (seeded envelope + hanging `getAssessment` paints `a-1:ready`, `loading` done, `refreshing` true). Live: with 9 warm cached envelopes and every `/v1/assessments/*` request delayed 4 s, reload painted all 9 cards at 1309 ms (`REFRESHING` visible, no skeleton) while 9 revalidation GETs were still in flight; converged to 9 rows at ~17.7 s. Screenshot: `evidence/reload-cached-refreshing.png`. | PASS |
| AC2 | Background revalidation converges to full-hydration rows. | Unit slice 2: cached `generating` converges to network `ready`, single row (`^a-1:ready$`). Live: delayed revalidation converged to the same 9 rows with no identity churn and the indicator detached. | PASS |
| AC3 | Offline reload keeps cached rows with honest retry states. | Unit slice 3: offline keeps cached `a-1:ready`, uncached `a-2:unavailable`, `errorCount` 1, reload retries only `a-2`. Live: evicted one Dexie envelope, aborted all assessment requests, reload painted 9 rows at 1334 ms (8 Ready + 1 `Unavailable offline`), banner "1 unavailable offline"; Retry recovered the evicted row to 9 rows / 0 unavailable and the cache back to 9 entries. Screenshot: `evidence/offline-cached-retry.png`. | PASS |
| AC4 | Account switch never renders the previous user's envelopes. | Unit slice 4: offline, cache-seeded both users; after switch only `b-1:ready`, no `a-1`, 0 errors. Live account switch deferred: only one live dev account exists; the per-user Dexie DB plus full view-model reset path is unit-proven. | PASS (unit); live deferred |
| AC5 | No generation, attempt, grading, or logging contract changes. | Diff touches only library hook/shell/pages plus tests; no server/router/attemptFlow/event changes; new failures log via `logger.debug` per rule 17; no console. Live request-id join: `1cf28218-a034-4281-8548-d43a898dd8d0` → `app.middleware request GET /v1/assessments/85b8b234-… status 200 latency_ms 565` in the intelligence log. | PASS |

## Review log

- R1 (standards + spec axis) first pass: PASS-WITH-MINORS. Fixed: drop `any` from seed result; titles never gate paint (cold path); test dedup (`renderAccountSwitcher`), `Assessment[]` typing, honest test names, waitFor on titles fallback. Deferred with reason: rule-32 test DB naming follows the file's existing seeded-store pattern with per-test cleanup; `refreshing` consumer arrives in P3 by design; local Dexie read consolidation; advisory catch dedup.
- R1 re-pass: PASS (no new hard standards violation or spec deviation).
- R2 (thermo) first pass: PASS-WITH-MINORS. Must-fix fixed: effect-body failedIds repair replaced by render-time `uniqueIdSet`/`visibleFailedIds`. Deferred to P3 or follow-up: useLiveQuery-as-display-source restructure; poll/revalidation overlap; bounded revalidation concurrency (plan allows only with measured p95).
- R2 re-pass: PASS-WITH-MINORS. No must-fix. Tracked for P3: (1) `refreshing` needs its production consumer; (2) warm-cache + slow titles currently falls back to `MATERIAL_UNAVAILABLE` in the pages - P3 should use a neutral placeholder instead.
- P3 R1 (standards + spec): PASS, no critical/high/medium. Low findings: (a) the No-Spinner dots markup is now a 4th copy; (b) `.library-refreshing` `color` was inert; (c) cold-cache negative gate untested. Fixed: (b) deleted, (c) added `keeps the skeleton without a refreshing indicator when nothing is cached`; (a) deferred: extraction would touch three unrelated surfaces (Home, PracticeCoach, LoadingState) outside this task's blast radius.
- P3 R2 (thermo): PASS-WITH-MINORS, no must-fix. Low findings: (a) `!loading` conjunct duplicated in both hubs; (b) catch-fill loop duplicates the success-path fallback; (c) empty `primaryMaterialId` would show pending forever; (d) dots duplication (same as R1a). Deferred with reason: (a) per-consumer row gate keeps the hook signal raw and both hubs still need `rows.length > 0`, so folding `!loading` into the hook only halves one conjunct; (b) both branches are 5 readable lines and a helper would spread + copy on the hot success path; (c) unreachable from shipped writers (`AssessmentConfig` always sends a material id; `libraryModel`'s `?? []` is defensive); (d) see R1a.
- P3 plan-doc correction: PLAN line 24 now records the neutral pending placeholder (R1 spec-axis note); the spec never mandated the `MATERIAL_UNAVAILABLE` string.
- Out-of-scope observation: one full-suite run showed `PracticeRun.test.tsx > keeps the reveal gate closed until an attempt exists` failing under parallel load; that file is pre-existing dirty and unrelated, passes standalone 3/3, and two later full runs were clean.
- Live-run note: the first live reload attempt ran against a stale pre-P2 Vite bundle (rule 53); `./full-app restart app` served the new code and all live numbers above are from the restarted runtime.
