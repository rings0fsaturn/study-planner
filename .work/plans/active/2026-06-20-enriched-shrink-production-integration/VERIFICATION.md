# VERIFICATION — enriched_shrink production integration (py_progress → FastAPI → UI)

Companion to [`PLAN.md`](PLAN.md). This is the **review round-trip** artifact for the build → test → review loop.

**How this file is used (each phase):**

1. **Cowork** pre-fills *Acceptance criteria* (below) from the plan. *(done — checkboxes start unchecked.)*
2. **Codex/Sonnet** fills *Implementer report* after building the phase: files changed, commit SHA, what was done, deviations + why, and a self-check against each criterion. Then **STOP for review**.
3. **Cowork** fills *Reviewer findings*: read the committed diff at the reported SHA (`git show <sha>`) and any `evidence.json`/`SUMMARY.md`; give a per-criterion verdict + required changes; set status `✅ Verified` or `🔁 Changes requested`.
4. **Codex** fills *Resolution* on redo. Loop until `✅ Verified`.

**Step 0 (before any code):** commit these planning docs verbatim — `docs(plan): add enriched-shrink-production-integration plan + verification`. Cowork cannot commit (it bricks `.git` locks in the sandbox); the native side establishes the baseline so later diffs are meaningful. If a reviewer leaves edits in this file, the next Step 0 commits the review before acting on it.

**Global rules every phase is also checked against:**
- Phase 0 (research) follows the brief's research rules: no generator-truth import in `baselines/`; observable next-context only in `predict_next`; prior weights / temperature tuned on **held-out-TRAIN** archetypes only and recorded in provenance; only Holm-surviving held-out wins count; emit `ProgressLogger` + `run_with_heartbeat`.
- Phases 1–3 (production): the `CalibrationState` contract stays backward-compatible (`nextSessionForecast` additive + optional); CUSUM / GP projection / scheduling untouched (PLAN D-03); the TS `computeCalibration` implementation is **not** changed (PLAN D-01); no secrets committed.

---

## Phase 0 — Validate the dual-prior weighting in the research harness (go/no-go)

### Acceptance criteria (Cowork pre-filled)

- [ ] `DualPriorWeightedCalibrator` added to `baselines/calibration.py`; composes two `EnrichedShrinkageCalibrator` members (reality + frozen prior); `_weights` returns the reality-favoured static fallback (`≈[0.6,0.4]`) when <2 active sessions; **no generator-truth import**.
- [ ] Candidate registered in `runners/calibration.py` with both regimes' TRAIN-fit priors; a `dual_prior_audit` block (both vectors + static weights + per-band weight summary) emitted next to `population_prior`.
- [ ] Scored on **reality** under the rigour protocol (200 seeds, held-out archetypes, Holm), reference baseline = `enriched_shrink` (reality-alone); `evidence.json` + `SUMMARY.md` written to `research/doc/verification-runs/2026-06-20-enriched-dualprior/`.
- [ ] **GO/NO-GO recorded:** GO iff `enriched_dual_prior` is a Holm-surviving win over `enriched_shrink` on `context_pred_mae` (reality); else NO-GO → production ships reality-alone (note added to PLAN D-02 in the same commit).
- [ ] `test_calibration_track.py` updated (candidate present + cold-start fallback weights); `uv run --package research-comparison pytest research/comparison/tests -q` passes.
- [ ] Zero changes outside `research/`.

### Implementer report (Codex/Sonnet fills)

_Files changed:_ `research/comparison/src/research_comparison/baselines/calibration.py`;
`research/comparison/src/research_comparison/runners/calibration.py`;
`research/comparison/tests/test_calibration_track.py`;
`research/doc/verification-runs/2026-06-20-enriched-dualprior/evidence.json`;
`research/doc/verification-runs/2026-06-20-enriched-dualprior/SUMMARY.md`.

_Commit SHA:_ `bd9eafafc33ec399ee8fec5f49ad7d0b982b3498`.

_What was done:_ Added `DualPriorWeightedCalibrator` to the research calibration
baselines, registered it in the calibration runner, and emitted
`dual_prior_audit` with the reality/frozen TRAIN-fit prior vectors, static
weights, and per-band weight summaries. Updated calibration tests for candidate
registration, cold-start fallback weights, scored runner output, and the audit
block. Ran the plan-required 200-seed reality calibration harness and captured
`evidence.json` plus `SUMMARY.md`.

_Deviations + why:_ The first prereq test run failed before Phase 0 because two
existing detector-sim entrypoints used a local `Progress` class name that the
repo-wide progress-logging gate did not recognize; fixed and committed that
separately as `acee4e9` before starting Phase 0. The runner resolves the
counterpart frozen/reality prior from the canonical 200-seed reference datasets
when the canonical datasets are scored; non-canonical test fixtures fall back to
the current dataset prior so tests stay hermetic.

_GO / NO-GO:_ **GO by the plan's stated criterion.** In `SUMMARY.md`, reference
baseline `enriched_shrink` / `context_pred_mae` on reality reports
`enriched_dual_prior` as a Holm-surviving winner in 7 cells. Held-out means:
max `0.137036` vs `0.138436`, medium `0.138572` vs `0.139730`, small
`0.143258` vs `0.142129`. Caveat: the result is mixed; the same reference block
also reports 2 Holm-significant not-win cells for `enriched_dual_prior` in
small-band archetypes.

_Self-check vs criteria:_ `DualPriorWeightedCalibrator` composes reality/frozen
`EnrichedShrinkageCalibrator` members and returns `[0.6, 0.4]` for cold-start
histories; no generator-truth imports or fields are used in `baselines/`.
Runner output includes `dual_prior_audit` with both prior vectors, static
weights, and per-band summaries. Evidence was scored on
`synthetic-reality-c545404bcacf-seed0-n5400` with 200 seeds, held-out
archetypes, Holm correction, and reference baseline `enriched_shrink`. Tests:
`uv run --package research-comparison pytest research/comparison/tests -q`
passed (`94 passed`). Implementation/evidence changes in the phase commit are
under `research/`; this follow-up docs commit records the SHA and GO result.

### Reviewer findings (Cowork fills)

**Reviewed:** `git show bd9eafa` (+ pre-fix `acee4e9`); `SUMMARY.md` reference-baseline `enriched_shrink` / reality.

_Per-criterion verdict:_
- ✅ `DualPriorWeightedCalibrator` present (`baselines/calibration.py`): composes reality+frozen `EnrichedShrinkageCalibrator` members, LOO weighting, `[0.6,0.4]` cold-start fallback (<2 active), no generator-truth import.
- ✅ Registered in the runner; `dual_prior_audit` emitted (both vectors + static weights + per-band summary).
- ✅ Scored on reality, 200 seeds, held-out, Holm, baseline `enriched_shrink`; `evidence.json` + `SUMMARY.md` written.
- ✅ GO recorded; criterion ("a Holm-surviving win over `enriched_shrink` on `context_pred_mae`/reality") met — **7 Holm wins**.
- ✅ Tests pass (`94 passed`); zero changes outside `research/`.

_Issues / required changes (non-blocking):_
- **Caveat — the win is band-dependent (carry to the claims ledger).** Vs reality-alone on `context_pred_mae`/reality: **7 Holm wins but 2 Holm-significant losses, both small-band** (small 0.14326 vs 0.14213, ≈+0.8% worse). The blend helps with more history (max/medium) and slightly hurts the cold-start point estimate — the reverse of D-02's stated rationale. It is *net* a real win, and `recovery_mae` is broadly better including small band (0.10282 vs 0.11499). **Required before the claim is written up:** frame it as a net win with a small-band point-estimate exception, not a uniform win — add to `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md` (same spirit as OQ-03).

_Status:_ ✅ Verified (GO upheld; ledger caveat required before write-up)

### Resolution (implementer fills on redo)

---

## Phase 1 — Promote the enriched calibrator into `py_progress`

### Acceptance criteria (Cowork pre-filled)

- [ ] `packages/py-progress/src/py_progress/enriched.py` created; `EnrichedShrinkageCalibrator` (+ required helpers, `EnrichedShrinkageFit`, `ENRICHED_FEATURE_NAMES`, `_safe_log`, `_posterior_interval`) lifted **verbatim except the import line** from research baselines; archetype/fingerprint code and unused imports **not** copied.
- [ ] `REALITY_POPULATION_PRIOR` + `FROZEN_POPULATION_PRIOR` constants present with the exact evidence.json vectors and a provenance comment; `PRODUCTION_PRIOR_STRATEGY` matches Phase 0's GO/NO-GO; `production_calibrator()` returns dual-prior (GO) or reality-alone (NO-GO).
- [ ] Symbols exported from `py_progress/__init__.py` (`__all__` updated).
- [ ] `test_enriched.py` added: empty → `≈BAYESIAN_PRIOR_MEAN`; deterministic finite positive `predict_next` with `planned_horizon`; **parity** with the research class (within 1e-9) on a fixed fixture; (GO only) cold-start weights `≈[0.6,0.4]`.
- [ ] `uv run --package py-progress pytest packages/py-progress/tests -q` passes; **`compute_calibration` unchanged this phase** (production behaviour identical).

### Implementer report (Codex/Sonnet fills)

_Files changed:_ `packages/py-progress/src/py_progress/enriched.py`;
`packages/py-progress/src/py_progress/__init__.py`;
`packages/py-progress/tests/test_enriched.py`.

_Commit SHA:_ `003247907257dda5749dfd09cff5a5843dd8c74f`.

_What was done:_ Promoted the enriched shrinkage calibrator into
`py_progress.enriched`, including the enriched feature helpers,
`EnrichedShrinkageFit`, `EnrichedShrinkageCalibrator`, Phase 0's
`DualPriorWeightedCalibrator`, frozen reality/frozen TRAIN prior constants, and
`production_calibrator()`. Exported the production symbols from
`py_progress.__init__`. Added focused py-progress tests for neutral cold-start
global pace, deterministic positive next-session prediction with
`planned_horizon`, research-class parity for the single-prior enriched model,
and dual-prior cold-start weights.

_Deviations + why:_ Phase 0 was GO, so `PRODUCTION_PRIOR_STRATEGY` is
`"dual_prior"`. The single-prior `EnrichedShrinkageCalibrator` was lifted with
the production import block and preserved for parity. The dual-prior production
wrapper adds one cold-start guard in `fit_global([])` to return
`BAYESIAN_PRIOR_MEAN`, satisfying this phase's acceptance criterion for empty
history while keeping `predict_next` and the single-prior parity path unchanged.

_Self-check vs criteria:_ `enriched.py` contains the required enriched symbols
without archetype/fingerprint/router variants; `REALITY_POPULATION_PRIOR` and
`FROZEN_POPULATION_PRIOR` match the evidence vectors and include provenance
comments; `PRODUCTION_PRIOR_STRATEGY` matches Phase 0 GO; exports are present in
`__all__`; `compute_calibration` was not touched in this phase. Verification:
`uv run --package py-progress pytest packages/py-progress/tests -q` passed
(`76 passed`), and the import smoke printed `1.0` for
`production_calibrator().fit_global([])`.

### Reviewer findings (Cowork fills)

**Reviewed:** `git show 0032479`; current `enriched.py` / `__init__.py`.

_Per-criterion verdict:_
- ✅ Faithful promotion — enriched class + helpers + `EnrichedShrinkageFit` + `ENRICHED_FEATURE_NAMES` + `_safe_log`/`_posterior_interval`; **no** archetype/fingerprint/router code; imports reduced to `py_progress.bayesian`/`config` + numpy.
- ✅ `REALITY_/FROZEN_POPULATION_PRIOR` match the evidence vectors with a provenance comment; `PRODUCTION_PRIOR_STRATEGY="dual_prior"` (matches GO); `production_calibrator()` returns the dual wrapper.
- ✅ Exports in `__all__`; `compute_calibration` untouched this phase; tests pass (`76 passed`).

_Issues / required changes (non-blocking):_
- **Note (my acceptance criterion's doing).** The dual wrapper's `fit_global([])` guards empty active history to return `BAYESIAN_PRIOR_MEAN` (1.0), diverging from the model's natural cold-start `exp(reality_intercept)≈0.878`. My criterion ("empty → ≈BAYESIAN_PRIOR_MEAN") forced this; it only affects the zero-active-session case and is a reasonable neutral "no data" default. Accepted — confirm it's intended (UI shows neutral pace before any active session).

_Status:_ ✅ Verified

### Resolution (implementer fills on redo)

---

## Phase 2 — Wire enriched pace + `nextSessionForecast` through `compute_calibration` and the FastAPI endpoint

### Acceptance criteria (Cowork pre-filled)

- [ ] `CalibrationState` gains `nextSessionForecast: float | None = None` (Python dataclass, last field); TS `types.ts` gains `nextSessionForecast?: number | null`; pydantic `CalibrationStatePayload` gains `nextSessionForecast`.
- [ ] `compute_calibration` keeps the hierarchical + CUSUM + trend pipeline; `globalMultiplier`/`globalPosterior.mean` now come from `production_calibrator().fit_global`; `nextSessionForecast` = `predict_next(visible, next_context)` when `next_context` is supplied, else `None`. `roleMultipliers`/`promptNeeded`/`insights`/`trend` unchanged in source.
- [ ] `CalibrationRequest` gains optional `nextContext` (with `planned_horizon{deadline, planned_total_sessions}` + role/date/session_index); router passes it through.
- [ ] `test_v1_integration.py` updated (inline payloads, no missing fixtures): `globalMultiplier` equals the enriched pace; `nextSessionForecast` non-null with `nextContext` and null without; `/v1/progress` + `/v1/roadmap/*` still pass.
- [ ] `uv run --package intelligence pytest services/intelligence/tests -q` and `uv run --package py-progress pytest packages/py-progress/tests -q` pass; TS `computeCalibration` implementation untouched (D-01).

### Implementer report (Codex/Sonnet fills)

_Files changed:_ `packages/py-progress/src/py_progress/types.py`;
`packages/py-progress/src/py_progress/calibration.py`;
`packages/progress/src/types.ts`;
`services/intelligence/app/schemas/progress.py`;
`services/intelligence/app/routers/calibration.py`;
`services/intelligence/tests/test_v1_integration.py`;
`tests/fixtures/pillar-a/progress/compute-calibration-*.expected.json`.

_Commit SHA:_ `eef569acd5076f2df7b931bdea97d984586acdf6`.

_What was done:_ Added optional `nextSessionForecast` to the Python and TS
`CalibrationState` contract and to the FastAPI payload model. `compute_calibration`
now preserves the existing hierarchical/CUSUM/trend pipeline, but replaces
`globalMultiplier` and `globalPosterior.mean` with
`production_calibrator().fit_global(visible)` and computes
`nextSessionForecast` from `predict_next(visible, next_context)` only when a
request supplies `nextContext`. The calibration router now passes `nextContext`
through. Added an inline service test that verifies the enriched pace equals
`production_calibrator().fit_global(sessions)`, the forecast is non-null with
context, and the forecast is null without context.

_Deviations + why:_ The plan expected inline payload tests only, but this
checkout already has golden fixture coverage for `computeCalibration`. Those
five expected JSON files were regenerated from the current Python implementation
so the existing py-progress parity suite and service golden suite continue to
cover the changed contract. No TS `computeCalibration` implementation was
modified.

_Self-check vs criteria:_ `CalibrationState` gained additive optional
`nextSessionForecast`; `roleMultipliers`, `trend`, `promptNeeded`, and
`insightsByContext` still come from the existing hierarchical/CUSUM/trend path;
`CalibrationRequest` accepts optional `nextContext` with `planned_horizon`;
router passes it through; `/v1/progress` and `/v1/roadmap/*` golden tests still
run through the same service suite. Verification:
`uv run --package intelligence pytest services/intelligence/tests -q` passed
(`38 passed`, one existing Starlette/httpx warning) and
`uv run --package py-progress pytest packages/py-progress/tests -q` passed
(`76 passed`).

### Reviewer findings (Cowork fills)

**Reviewed:** `git show eef569a`; current `calibration.py`; golden-fixture diffs.

_Per-criterion verdict:_
- ✅ `nextSessionForecast` added as the last, optional field on the Python dataclass, TS `types.ts` (`?: number | null`), and `CalibrationStatePayload` — additive, backward-compatible (D-04).
- ✅ `compute_calibration` keeps `compute_hierarchical_model` + `detect_regime_shifts` (CUSUM) + `analyze_trend`; `globalMultiplier`/`globalPosterior.mean` = `production_calibrator().fit_global(visible)`; `nextSessionForecast` = `predict_next(visible, next_context)` iff `next_context`, else `None`; role/trend/prompt/insights still from the existing pipeline.
- ✅ `CalibrationRequest` gains optional `nextContext` (planned_horizon + role/date/index); router passes it through.
- ✅ **D-03 intact** — `cusum.py`/`gp.py`/`trend.py`/roadmap engine untouched. **D-01 intact** — TS `calibration.ts` implementation unchanged (only `types.ts` +1).
- ✅ Tests pass (intelligence `38`, py-progress `76`).

_Issues / required changes (none):_
- **Golden-fixture regeneration verified clean.** Spot-checked `compute-calibration-30-sessions`: only `globalMultiplier`/`globalPosterior` changed materially (0.9201→0.8994); `roleMultipliers`/`trend`/`insights` moved only at ~1e-16 (floating-point noise), `promptNeeded` unchanged → the regeneration did **not** silently alter the unchanged hierarchical/CUSUM/trend pipeline.

_Status:_ ✅ Verified

### Resolution (implementer fills on redo)

---

## Phase 3 — Switch the app's `useCalibrationState` to call the FastAPI service

### Acceptance criteria (Cowork pre-filled)

- [ ] `apps/app/src/lib/intelligenceClient.ts` created; reads `import.meta.env.VITE_INTELLIGENCE_URL` (default `http://localhost:8000`); `postCalibration` throws on non-2xx.
- [ ] `useCalibration.ts` builds the request from mapped events + derives `nextContext` (deadline + `planned_total_sessions = slots.length` + up-next slot via the same logic as `ProgressEngine.getUpNextSlot`); POSTs to the service; returns `CalibrationState` on success and `null` while loading / on error (so `Home`/`Week` null-guards hold). TS `computeCalibration` no longer imported by the app.
- [ ] `VITE_INTELLIGENCE_URL` documented in `apps/app/.env.example`.
- [ ] `useCalibration.test.ts` added (request carries `planned_horizon`; success maps state; rejection → null), using the Dexie test setup; `pnpm --filter app test` + `pnpm --filter app typecheck` pass.
- [ ] Playwright spec for the Home pace/forecast path is **written** (mocked `/v1/calibration`) but **not run** (per `CLAUDE.md` E2E constraint).

### Implementer report (Codex/Sonnet fills)

_Files changed:_ `apps/app/src/lib/intelligenceClient.ts`;
`apps/app/src/progress/useCalibration.ts`;
`apps/app/src/progress/useCalibration.test.ts`;
`apps/app/src/events/ProgressEngine.ts`;
`apps/app/.env.example`;
`e2e/calibration-service.spec.ts`.

_Commit SHA:_ `e4555c14a52d88b4a47265bbd7e2e0271fcaf5c6`.

_What was done:_ Added the app-side Intelligence Service client and rewired
`useCalibrationState` so the hook maps Dexie events into the FastAPI
`/v1/calibration` request shape. The request includes sessions, exceptional
tags, resolutions, and an optional `nextContext` derived from the latest roadmap:
up-next date/role/index plus `planned_horizon.deadline` and
`planned_horizon.planned_total_sessions`. The hook now returns the service
`CalibrationState` on success and `null` while loading or if the request fails.
`ProgressEngine.getUpNextSlot` was generalized so the app can reuse the same
up-next slot logic with the progress mapper's roadmap shape. Added
`VITE_INTELLIGENCE_URL` to the app env template, a Vitest hook test, and a
Playwright spec that mocks `/v1/calibration` and asserts Home sends planned
horizon context.

_Deviations + why:_ The Playwright spec was written but not run, per the phase's
E2E constraint. The app test gate initially exposed two pre-existing
date-sensitive test fixtures: `Step1Deadline.test.tsx` used `2026-06-15`, which
is now before the current minimum date (`2026-06-20`), and
`SessionLifecycle.test.ts` attempted to test local-midnight stale handling with
UTC literals that no longer crossed the local date boundary before the six-hour
rule. Those fixture fixes were committed separately as
`14af4ac7a57af69cb9dda8913029b03c1624dc90` before the Phase 3 implementation
commit.

_Self-check vs criteria:_ `intelligenceClient.ts` reads
`import.meta.env.VITE_INTELLIGENCE_URL` with the `http://localhost:8000`
fallback and throws on non-2xx responses. `useCalibration.ts` no longer imports
`computeCalibration`; it builds the mapped request, derives `nextContext` through
the shared `getUpNextSlot` path, posts to the service, and preserves the existing
`null` loading/error behaviour expected by `Home` and `Week`.
`VITE_INTELLIGENCE_URL` is documented in `apps/app/.env.example`.
`useCalibration.test.ts` covers planned horizon request construction, success
state mapping, and rejection-to-null. Verification:
`pnpm --filter app test` passed (`31 passed`, `369 passed`) and
`pnpm --filter app typecheck` passed. E2E coverage was added in
`e2e/calibration-service.spec.ts` but not run.

### Reviewer findings (Cowork fills)

**Reviewed:** `git show e4555c1`; current `useCalibration.ts`, `intelligenceClient.ts`, `ProgressEngine.ts` diff.

_Per-criterion verdict:_
- ✅ `intelligenceClient.ts` reads `VITE_INTELLIGENCE_URL` (localhost fallback), throws on non-2xx.
- ✅ `useCalibration.ts` no longer imports `computeCalibration`; builds the request from mapped events; derives `nextContext` with `planned_horizon{deadline, planned_total_sessions=slots.length}` + up-next slot via the shared `getUpNextSlot`; returns `null` while loading / on error (Home/Week null-guards hold).
- ✅ `VITE_INTELLIGENCE_URL` documented in `.env.example`; `useCalibration.test.ts` covers request construction / success / rejection→null; `pnpm --filter app test` (`369`) + typecheck pass.
- ✅ Playwright `e2e/calibration-service.spec.ts` written, not run (CLAUDE.md E2E constraint).

_Issues / required changes (non-blocking):_
- **Deviation (accepted):** `ProgressEngine.ts` was modified (not in the plan's file index) to make `getProjectedFinish`/`getUpNextSlot` generic over a `RoadmapSlotLike` shape so the hook can reuse them. Backward-compatible — existing `RoadmapCreatedPayload` callers still satisfy the constraint and the filter/return logic is unchanged.
- **UX note (→ OQ-02):** the hook `setState(null)` before each refetch, so pace/progress briefly blanks on every event change and a POST fires per change. Minor flicker; fold into the offline/caching follow-up.

_Status:_ ✅ Verified

### Resolution (implementer fills on redo)

---

## Sign-off

- [x] All four phases `✅ Verified` by Cowork review (2026-06-20), against the committed diffs at `bd9eafa` / `0032479` / `eef569a` / `e4555c1`. **One non-blocking follow-up:** add the Phase-0 small-band caveat (band-dependent `context_pred_mae` win — 2 Holm-significant small-band losses) to `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md` before the dual-prior win is written up.
- [x] MASTER_TRACKER §4 + §8 rows reflect production integration state; `last_updated` is already `2026-06-20` and remains current for this same-day update.
- [x] OQ-01 (projection wiring), OQ-02 (offline caching), OQ-03 (prod auth/deploy) carried forward in the open questions and MASTER_TRACKER §8.

Final implementer audit: `uv run --package py-progress pytest packages/py-progress/tests -q`
passed (`76 passed`); `uv run --package intelligence pytest services/intelligence/tests -q`
passed (`38 passed`, one existing Starlette/httpx deprecation warning);
`pnpm --filter app test` passed (`31` files, `369` tests); and
`pnpm --filter app typecheck` passed.
