# Scratchpad – issue-43-mastery-adaptive-difficulty · session 2026-09-20
_state.md: active/issue-43-mastery-adaptive-difficulty/state.md · Updated: 2026-09-20T11:00_

## Now / Next
- Doing: P6 – live E2E verification of /v1/mastery + adaptive practice
- Next: run the managed runtime + sidecar, write the live spec, tick ACs
- Blocked: none

## Session log
- 09:20 DONE   #41 wayfinder exit – resolution comment + close on GitHub, map #4 Decisions-so-far appended (incl. missing #39/#40/#42 lines), STATUS flipped, folder archived, commit `575f5c7`
- 09:25 DONE   #43 claimed on GitHub (assignee `rings0fsaturn`)
- 09:30 EDIT   opened `active/issue-43-mastery-adaptive-difficulty/` – state.md bootstrapped, STATUS row added
- 09:40 FOUND  no public-fold sequence data on disk (nips2020/accoding zips gone, `research/results/kt` wiped) – bake-off uses synthetic ground truth + the documented pyBKT EM-fit evidence (ECE 0.272 accoding, degenerate nips2020)
- 09:45 FOUND  live account holds 39 graded attempts (35 (material, skill) sequences) – real product-shaped observations with `grade.perSkill[]` + `materialId`
- 09:55 EDIT   `packages/py-progress/src/py_progress/mastery.py` – BKT engine (bkt_forward, project_mastery, recommend_band, BktParams, MODEL_VERSION) – verified via bake-off
- 10:05 DONE   P1 bake-off: winner p_init=.15 learn=.10 slip=.05 guess=.20, mean ECE .0571 / AUC .7845, balanced across both regimes; real-data sanity non-degenerate; constants pinned + `BAKEOFF_SOURCE` recorded; results in `research/bkt-bakeoff-results.md`
- 10:20 EDIT   P2 contracts – openapi: AdaptiveRecommendation + MasterySnapshot(+Entry) schemas, `/v1/mastery/recommendations` route, `GenerationRequest.masterySnapshot`; 3 fixtures + fixture README rows + 3 contract tests – verified 31 passed
- 10:35 EDIT   P3 engines – TS mirror `packages/progress/src/mastery.ts` (+ index exports), 9 fixture-export parity cases (TZ=Asia/Kolkata re-export), `_dispatch` wiring, `test_mastery.py` (10) + `test/mastery.test.ts` (11) – verified py 100 passed, TS 113 passed, typecheck+lint clean
- 10:40 FOUND  re-exporting fixtures surfaced pre-existing phase-1 TS/Python drift (TS omits `nextSessionForecast` when unset; Python emits null; `burnUp.startDate` shape) – restored the committed goldens (git checkout), drift recorded here, NOT fixed in #43 (out of scope)
- 10:50 EDIT   P4 service – `routers/mastery.py` (GET /v1/mastery + /v1/mastery/recommendations, stateless rebuild from `question_attempts.grade`), `UserScopedClient.list_graded_attempts`, router wired in main.py; 7 API tests – verified 678 passed / 7 pre-existing failures, ruff clean
- 11:00 EDIT   P5 client – Dexie v7 `masteryCache`, `getMastery` on the assessment client, `masteryCache.ts` save/read, PracticeThis Adaptive chip enabled with one-band selection (cold start + fetch-failure fall back to band 3); fake client `getMastery`+`masteryProjection`; fixed pre-existing fake `scriptListAttempts` bug; PracticeThis tests 19 passed, client tests 37 passed, full app suite 907 passed / 2 TZ flakes (green under forks), typecheck+lint+build green
- 11:05 NEXT   P6 – live E2E