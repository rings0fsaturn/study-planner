# #43 Mastery and Adaptive Difficulty — plan

_Spec: GitHub #43 (copy: specs/phase2-tickets/11-mastery-adaptive-difficulty.md) · Updated: 2026-09-20_

## Scope decisions (user, 2026-09-20)

- BKT direct behind the #14 interface (no Bayesian baseline first).
- BKT parameters from a small offline bake-off; pinned defaults + `modelVersion` if data is thin.
- Minimal UI in #43: the projection + one-band recommendation contract; the advisory surface stays #47.

## Phases

### P0 — prereq and claim
- #41 wayfinder exit (resolution comment, close, map #4 line, STATUS flip, folder archive) — the user assigned this as the #43 prereq.
- Claim #43 on GitHub; open `active/issue-43-mastery-adaptive-difficulty/`; STATUS row.
- Done `575f5c7` (wrap) + `d1d85e5` (feature).

### P1 — BKT parameter bake-off
- Method: `research/bkt_bakeoff.py` — two-regime synthetic ground truth (quick_mastery / slow_noisy, 2000 learners each, 1–12 steps) + the documented pyBKT EM-fit evidence (credibility tracker: ECE 0.272 accoding, degenerate nips2020) as the fitted baseline to beat. 81-candidate grid, 10-bin ECE + AUC.
- Winner: p_init .15 / learn .10 / slip .05 / guess .20 — mean ECE .0571 / AUC .7845, balanced per regime.
- Real-data sanity: 35 (material, skill) sequences from the dev account's 39 graded attempts — non-degenerate, honest cold start (single correct -> 0.51/uncertainty 1.0).
- Output: `packages/py-progress/src/py_progress/mastery.py` (BktParams defaults, MODEL_VERSION "bkt-v1", BAKEOFF_SOURCE pointer), `research/bkt-bakeoff-results.md`.

### P2 — contracts
- openapi.yaml: `AdaptiveRecommendation`, `MasterySnapshot` + `MasterySnapshotEntry`, `GenerationRequest.masterySnapshot` (additive), `GET /v1/mastery/recommendations`.
- Fixtures: `mastery-projection.json`, `adaptive-recommendation.json`, `mastery-snapshot.json` + README rows + 3 contract tests.

### P3 — engines + parity
- `py_progress/mastery.py` (bkt_forward, project_mastery, recommend_band) + exports.
- TS mirror `packages/progress/src/mastery.ts` + index exports.
- 9 golden fixture cases (cold start, single correct, saturate, collapse, rebuildable, one-band up/down, cold-start keep, clamp) via `scripts/fixture-export/progress-cases.ts`, Python `_dispatch` wiring.
- Unit tests: `test_mastery.py` (10) + `test/mastery.test.ts` (11).

### P4 — service route
- `routers/mastery.py`: GET /v1/mastery + /v1/mastery/recommendations — stateless rebuild from `question_attempts.grade` (perSkill + materialId), RLS owner-scoped, no server store; `UserScopedClient.list_graded_attempts`; wired in main.py.
- 7 API tests (`test_mastery_api.py`).

### P5 — client (minimal)
- Dexie v7 `masteryCache` (non-synced, derived).
- `getMastery` on the assessment client; `masteryCache.ts` save/read; `masterySnapshot` types on GenerationRequest (contract seam; the server does not consume it yet).
- PracticeThis Adaptive chip enabled: per-problem band = `recommendBand` over the material's projections (cold start keeps mid band; fetch failure falls back to mid band, advisory).
- Fixed a pre-existing fake bug (`scriptListAttempts` called a nonexistent method).

### P6 — verification
- Contracts 31 passed; py-progress 100 passed; TS 113 passed; service 678 passed / 7 documented pre-existing; app 907 passed / 2 WSL TZ flakes (green under forks); typecheck, lint, build green.
- Live: `e2e/mastery-live.spec.ts` 2/2 (rebuildable projection + one-band recommendation over a seeded fresh grade; Adaptive chip selectable at desktop); practice live spec 2/2 (no regression).

## Deviations (additive, recorded)

- Bake-off uses synthetic ground truth + documented evidence because the public-fold sequence data and results are gone from disk (zips + `research/results/kt` wiped); regeneration would need a network download (out of budget for this slice). The #48 harness owns the full estimator comparison.
- Fixture re-export surfaced a pre-existing phase-1 TS/Python drift (e.g. TS omits `nextSessionForecast` when unset; Python emits null). The committed goldens were restored; the drift is NOT fixed here (out of scope, recorded in state.md Open).
- `recommendBand` cold-start guard: n=0 keeps the band (no evidence -> no movement), documented in the engine docstring.
- `masterySnapshot` is contract-defined and typed but not yet sent by the client; the adaptive mechanism today is the recommended `recipe.difficulty` band. Server-side snapshot consumption belongs to #13's generation seam (out of #43 scope).