# State – issue-43-mastery-adaptive-difficulty

_Spec: GitHub #43 (copy: specs/phase2-tickets/11-mastery-adaptive-difficulty.md, parent #32, map #4) · Plan: active/issue-43-mastery-adaptive-difficulty/plan/ · STATUS row: issue-43-mastery-adaptive-difficulty · Status: done · Updated: 2026-09-20_

## Current state & next

- P1–P6 complete and verified 2026-09-20: bake-off, contracts, engines + parity, service route, minimal client, live E2E. All four ACs ticked in `plan/VERIFICATION.md`.
- Next: the wayfinder exit (resolution comment + close #43 + map #4 line + STATUS Done + archive) — this is the only remaining step.

## Done so far

- 2026-09-20: P0 – #41 wayfinder exit (resolution comment, close, map #4 line incl. the missing #39/#40/#42 lines, STATUS flip, folder archived, commits `575f5c7` + `50e60e3`); #43 claimed on GitHub; task folder + STATUS row opened.
- 2026-09-20: P1 – BKT parameter bake-off (`research/bkt_bakeoff.py` + `research/bkt-bakeoff-results.md`): two-regime synthetic ground truth + documented pyBKT EM-fit evidence; winner p_init .15 / learn .10 / slip .05 / guess .20 (mean ECE .0571 / AUC .7845); real-data sanity over 35 sequences non-degenerate; constants pinned in `py_progress/mastery.py` as `bkt-v1` with `BAKEOFF_SOURCE`.
- 2026-09-20: P2 – contracts: `AdaptiveRecommendation` + `MasterySnapshot`(+Entry), `GenerationRequest.masterySnapshot`, `GET /v1/mastery/recommendations` in openapi.yaml; 3 fixtures + README rows + 3 contract tests (31 passed).
- 2026-09-20: P3 – engines: `py_progress/mastery.py` (bkt_forward, project_mastery, recommend_band) + TS mirror `packages/progress/src/mastery.ts`; 9 golden parity fixtures; 10 py + 11 TS unit tests (py 100, TS 113 passed).
- 2026-09-20: P4 – service: `routers/mastery.py` (stateless GET /v1/mastery + /v1/mastery/recommendations rebuilt from `question_attempts.grade`), `UserScopedClient.list_graded_attempts`, router wired; 7 API tests (678 passed / 7 pre-existing).
- 2026-09-20: P5 – client (minimal): Dexie v7 `masteryCache`, `getMastery`, `masteryCache.ts`, PracticeThis Adaptive chip enabled with one-band selection (cold start + fetch failure fall back to band 3); pre-existing fake `scriptListAttempts` bug fixed; app suite 907 passed / 2 TZ flakes.
- 2026-09-20: P6 – live E2E: `e2e/mastery-live.spec.ts` 2/2 (seeded fresh grade -> projection -> identical rebuild -> one-band recommendation -> cleanup; Adaptive chip selectable); practice live spec 2/2 (no regression). AC1–AC4 ticked.

## Flow trace

- Contract seam: `/v1/mastery` GET returns `MasteryProjection[]`; `/v1/mastery/recommendations` returns `AdaptiveRecommendation[]`; `GenerationRequest.masterySnapshot` carries the client-supplied snapshot (contract-defined; not yet sent by the client — #13's generation seam owns consumption).
- Observation input: `question_attempts.grade.perSkill[]` + `grade.materialId`, ordered by `graded_at`; the route groups by (materialId, skillTag) and rebuilds each projection from the full sequence (`routers/mastery.py:_observations_by_key`).
- Engine: `py_progress/mastery.py` — forward-filter BKT (no forget), entropy-based uncertainty, `recommend_band` ±1 clamped with a cold-start keep-band guard; `MODEL_VERSION = "bkt-v1"`.
- Parity: `scripts/fixture-export/progress-cases.ts` golden cases consumed by `packages/py-progress/tests/test_fixtures.py` `_dispatch` (TZ=Asia/Kolkata export convention).
- Client: `getMastery` on `AssessmentClient`; PracticeThis resolves each problem's band from the material's projections via `recommendBand` (mid-band reference), caches projections in `masteryCache` (Dexie v7, non-synced).
- Downstream: #44 AC3 (mastery on valid grades) is satisfied by this slice; #47 (roadmap feedback surface) consumes the same projection + recommendation contracts.

## Files affected

- `.work/active/issue-43-mastery-adaptive-difficulty/` – state.md, SCRATCHPAD.md, plan/PLAN.md, plan/VERIFICATION.md, research/bkt_bakeoff.py, research/bkt-bakeoff-results.md.
- `.work/STATUS.md` – issue-43 Active row; `_Last reconciled`.
- GitHub `rings0fsaturn/study-planner` #43 – assigned (claimed).
- `packages/py-progress/src/py_progress/mastery.py` (+ `__init__.py` exports) – BKT engine (new).
- `packages/py-progress/tests/test_mastery.py` (new), `test_fixtures.py` (`_dispatch` mastery wiring).
- `packages/progress/src/mastery.ts` (new) + `index.ts` exports + `test/mastery.test.ts` (new).
- `scripts/fixture-export/progress-cases.ts` – 9 mastery golden cases.
- `services/intelligence/contracts/phase2/openapi.yaml` + `fixtures/{mastery-projection,adaptive-recommendation,mastery-snapshot}.json` + `fixtures/README.md` + `tests/test_contracts.py`.
- `services/intelligence/app/routers/mastery.py` (new), `app/userrest.py` (`list_graded_attempts`), `app/main.py` (router wiring).
- `services/intelligence/tests/test_mastery_api.py` (new).
- `apps/app/src/events/EventStoreProvider.tsx` – Dexie v7 `masteryCache`.
- `apps/app/src/assessments/{types.ts, assessmentClient.ts, masteryCache.ts (new), testing/fakeAssessmentClient.ts}`.
- `apps/app/src/pages/materials/PracticeThis.tsx` + `.test.tsx` – Adaptive chip + band resolution.
- `e2e/mastery-live.spec.ts` (new).

## Pitfalls & rules

- The bake-off could not use the public-fold sequences: both raw zips and `research/results/kt` are gone from disk; regenerating needs a network download. The #48 harness owns the full estimator comparison; a new bake-off ships a new `MODEL_VERSION`, never a silent param change.
- Fixture export must run with `TZ=Asia/Kolkata` (the Python conftest convention); a UTC export silently rewrites every timezone-sensitive golden.
- Re-exporting the pillar-a goldens surfaced a pre-existing TS/Python drift (TS omits `nextSessionForecast` when unset, Python emits null; `burnUp.startDate` shape). Committed goldens restored; drift unfixed here — see Open.
- `recommend_band` must not move the band at n=0 (cold start); the guard is in the engine, not the caller.
- Adaptive is advisory: a failed mastery fetch falls back to the mid band and never blocks the run.
- Live seeding needs a valid uuid `id` and the account's own `user_id`; service-role inserts bypass RLS; cleanup by marker `client_attempt_id` only.

## Decisions in force

- BKT direct behind the #14 interface; params from the offline bake-off (user 2026-09-20).
- Minimal UI in #43; the advisory surface belongs to #47 (user 2026-09-20).
- Mastery stays a stateless projection: no server store, no migration, no `MasteryUpdated` event (map #4 #14/#15).
- The client computes bands via the TS mirror (`recommendBand`); `masterySnapshot` rides the contract but the server's generation seam (#13) is not wired in this slice.

## Open

- Pre-existing phase-1 TS/Python parity drift (exposed by the fixture re-export, restored): `nextSessionForecast` omitted by TS vs null by Python; `burnUp.startDate` mismatch on empty roadmaps; compute-progress/calibration goldens would fail if regenerated today. Fix = a dedicated parity-repair pass, out of #43 scope.
- Wayfinder exit pending: resolution comment, #43 close, map #4 line, STATUS flip, archive.