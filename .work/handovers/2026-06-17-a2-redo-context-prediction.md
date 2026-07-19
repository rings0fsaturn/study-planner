# Handoff → Codex: A2 redo — context-aware prediction (D-A7)

**Date:** 2026-06-17 · **From:** Cowork planning/review agent · **For:** Codex (gpt-5.5)
**Phase:** A2 (re-scoped) · **Decision:** D-A7 · **Last A2 commit:** `c601725` (steps 1–5, leakage-free, verified)

## Why this redo

A2 steps 1–5 shipped clean (leakage removed in `c601725`), but on the honest run **no candidate beats pooling on any band** — because the calibration track only scores the **context-blind** `fit_global(sessions) -> float` against the **context-specific** target `r_star[t]`. So `covariate_bayes` computes role/time/day multipliers and is then forced to discard them. On "recover `m_global`," pooling is near-optimal by design, so the covariate model only adds variance.

D-A7 re-scopes A2 to the **fair test**: score the candidates on **context-aware next-session prediction**, where modelling structure can actually pay off (and which is what finish-date projection needs). Full rationale: `../plans/active/2026-06-14-pillar-a-rigour.md` → Decisions log **D-A7**; acceptance = VERIFICATION **A2.8/A2.9**.

## Step 0 — commit the planning docs first

Cowork can't commit. Establish the baseline before coding:

```bash
git add ../plans/active/2026-06-14-pillar-a-rigour.md ../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md 2026-06-17-a2-redo-context-prediction.md
git commit -m "docs(plan): D-A7 re-scope A2 to context-aware prediction"
```

## What to build (A2.8)

1. **Add `predict_next(history, next_context) -> float` to the `CalibrationCandidate` interface** (`research/comparison/src/research_comparison/baselines/calibration.py`, Protocol at the top).
   - `next_context` = the upcoming session's observable context: material `role` + `started_at` (→ `infer_time_of_day`, `infer_day_of_week`). It is **known** at prediction time (it's the schedule) — using it is *not* leakage. Its pace is what we predict.
   - **Context-blind** candidates (`PooledBayesianCalibrator`, `SMACalibrator`, `EWMACalibrator`, `IncumbentCalibration`): default `predict_next = fit_global(history)` (ignore `next_context`). A shared default/mixin is fine.
   - **`CovariateBayesCalibrator` / `EBPartialPoolCalibrator`:** `predict_next = global_multiplier · role_mult[role] · time_mult[tod] · day_mult[dow]` from `fit_effects(history)` — multipliers estimated from the learner's **own past** sessions only. (You already compute these in `CovariateEffectFit`; this just stops discarding them.)

2. **Add a context-aware prequential metric.** For each upcoming session `t` in the grid, score `predict_next(active_sessions[:t], context_of(active_sessions[t]))` against `active_targets[t]` (already `truth["r_star"]` — the noise-free context-specific pace; see `runners/calibration.py:156-157`, `metrics/prequential.py`). Add it as a new per-row field (e.g. `context_pred_mae`) and a `paired_vs_incumbent` block. **Keep** the existing `recovery_mae` / `prequential_mae` / `coverage` — report them honestly alongside (pooling stays competitive on recovery; that contrast is the point).

## Success criterion (A2.9)

`covariate_bayes` and/or `eb_partial_pool` **beats `pooled_bayes` on the context-aware prediction metric** with a bootstrap CI on Δ (use `metrics/rigour.bootstrap_delta_ci`) excluding 0 in its favour — small-band emphasis for EB. Report the `m_global`-recovery comparison honestly (pooling competitive there).

**Honest exit:** if neither beats pooling even on the prediction metric, record the robust null as the finding — that is an acceptable close, not a failure to paper over.

## Tests (extend `research/comparison/tests/test_calibration_track.py`)

- `predict_next` applies the correct multipliers for a given upcoming context (hand-check on a fixture with known effects).
- On a fixture with planted context structure, `covariate_bayes`/`eb_partial_pool` context-prediction error **<** `pooled_bayes`'s.
- Keep the existing leakage-guard test (unsupported context effects stay at 1.0) and `infer_day_of_week` determinism test green.

## No-leakage / no-gaming guards (carried — these are why the last two redos happened)

- **Never** import the generator's `ROLE_RHO` / `TAU_GENERIC` (or any `params.py` truth) into `baselines/`. Multipliers come **only** from the learner's own past sessions.
- The upcoming context (role/day/time) is observable; the upcoming **pace** is not — don't peek at `r_star[t]` when predicting `t`.
- `ridge` stays neutral/fixed here; any strength tuning happens **only** on held-out archetypes in A3 (D-A4), never on the scoring cells.
- The number must be *earned* — no constant tuned to hit a target, no candidate seeded with truth. (A1's `4.20` and A2's leaked prior are the two patterns to avoid.)

## Verify, then report

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison python -m research_comparison.runners.calibration
uv run --package research-comparison pytest research/comparison/tests/test_calibration_track.py -q
python3 -c "import json;d=json.load(open('research/results/calibration/calibration_results.json'));print({b:{c:round(d['paired_vs_incumbent'][b].get(c,{}).get('context_pred_mae_delta',float('nan')),5) for c in ('covariate_bayes','eb_partial_pool')} for b in ('small','medium','max')})"
```

After it passes: set Phase A2 `Status:` to `✅ Complete — <sha>`, fill the A2 Resolution block in `VERIFICATION.md` (files, SHA, context-prediction Δ + CI per band, deviations, self-check vs A2.8/A2.9), commit code + plan + verification together, and hand back for review. A phase is not done until the reviewer marks it `✅ Verified`.

## Files in play

- `research/comparison/src/research_comparison/baselines/calibration.py` — interface + candidate `predict_next`.
- `research/comparison/src/research_comparison/metrics/prequential.py` — context-aware scoring (new fn or extend).
- `research/comparison/src/research_comparison/runners/calibration.py` — wire the new metric + `paired_vs_incumbent` block; `context_of(session)` from role + `started_at`.
- `research/comparison/tests/test_calibration_track.py` — new tests.
- `../plans/active/2026-06-14-pillar-a-rigour.md` (Phase A2 status) + `…-VERIFICATION.md` (A2 report) — update on completion.
