# #43 Mastery and Adaptive Difficulty — verification

_Updated: 2026-09-20 · Status: complete_

## ACs

| AC | Evidence | Status |
|---|---|---|
| Mastery is stateless, owner-scoped, rebuildable, exposed behind the agreed interface | `GET /v1/mastery` rebuilds from `question_attempts.grade` on every call (no store, no migration); RLS SELECT owner-scoping; unit `test_mastery_projection_is_rebuildable` + live scenario (two identical GETs; row deletion removes the projection) | ✅ |
| BKT updates consume per-skill observations without a parallel mastery model | `perSkill[]` from each graded attempt feeds `bkt_forward`; no server mastery table, no `MasteryUpdated` event; live scenario seeds one graded observation and the projection appears with n=1 / mastery ~0.51 | ✅ |
| Adaptive recommendations move one band at a time and include model-version context | `recommend_band` (±1, clamped 1..5, cold start keeps band); `AdaptiveRecommendation` carries `currentBand`/`recommendedBand`/`targetExpectedCorrectness`/`modelVersion`; live scenario: band 3 -> 2 for p=0.51 | ✅ |
| TypeScript/Python parity, cold start, rebuild, boundary tests pass | 9 golden parity fixtures (cold start, single correct, saturation, collapse, rebuildable, one-band up/down, cold-start keep, clamp) green on both sides; py 100 passed, TS 113 passed | ✅ |

## Gates

| Gate | Result |
|---|---|
| Contract tests | 31 passed (3 new: mastery fixtures, snapshot in GenerationRequest, recommendations route typing) |
| py-progress | 100 passed (9 mastery parity + 10 unit) |
| packages/progress (TS) | 113 passed (11 mastery unit), typecheck + lint clean |
| Intelligence service | 678 passed / 7 failed — the documented pre-existing set (`test_retrieval_probe` 2, `test_v1_integration` goldens 5) |
| App suite | 907 passed / 2 failed — the documented WSL TZ pair, 2/2 green under `--pool=forks` |
| Ruff | clean on all touched files |
| pnpm typecheck / lint / build | green |
| Live E2E (real stack) | `e2e/mastery-live.spec.ts` 2/2 in 14.5 s; `e2e/practice-run-live.spec.ts` 2/2 in 2.0 m (no regression from the PracticeThis change) |

## Bake-off evidence

`research/bkt-bakeoff-results.md` — two-regime synthetic ground truth, 81-candidate grid, winner p_init .15 / learn .10 / slip .05 / guess .20 (mean ECE .0571 / AUC .7845), real-data sanity over 35 (material, skill) sequences, constants pinned as `bkt-v1` with `BAKEOFF_SOURCE` in the engine module.

## Live evidence

- `e2e/mastery-live.spec.ts` — scenario 1: seeded graded observation -> projection (n=1, mastery 0.5104, uncertainty ~1.0, modelVersion bkt-v1) -> identical second GET -> recommendation 3->2 -> cleanup -> projection gone. Scenario 2: Adaptive chip enabled + selectable on the ACCA material practice page.
- Cleanup verified: only the spec-created attempt rows are touched; the frozen ACCA material and its pre-existing history are preserved.