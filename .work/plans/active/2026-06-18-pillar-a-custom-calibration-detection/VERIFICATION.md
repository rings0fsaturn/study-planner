# VERIFICATION — Pillar-A custom calibration (archetype-aware) + deferred detection

Companion to [`PLAN.md`](PLAN.md). This is the **review round-trip** artifact for the build → test → review → advise loop (PLAN D-02).

**How this file is used (each phase):**

1. **Cowork** pre-fills *Acceptance criteria* (below) from the plan. *(done — checkboxes start unchecked.)*
2. **Codex/Sonnet** fills *Implementer report* after building the phase: files changed, commit SHA, what was done, deviations + why, and a self-check against each criterion. Then **STOP for review**.
3. **Cowork** fills *Reviewer findings*: read the committed diff at the reported SHA (`git show <sha>`) and the phase's `evidence.json`/`SUMMARY.md`; give a per-criterion verdict + required changes; set status `✅ Verified` or `🔁 Changes requested`.
4. **Codex** fills *Resolution* on redo. Loop until `✅ Verified`.

**Global rules every phase is also checked against** (brief Rules 1–6): no generator-truth import in `baselines/`; membership/features inferred from observed series only; `predict_next` uses observable next-context only; all hyperparameters (λ, shrink, temperature, #classes) tuned on **held-out-TRAIN** archetypes only and recorded in provenance; no magic constants; candidates additive (shipped ones untouched); only Holm-surviving held-out wins reported as wins; **every script emits `ProgressLogger` progress + `run_with_heartbeat` (D-08)**.

---

## Phase 1 — Baseline lock + heartbeat-instrumented review scaffolding

### Acceptance criteria (Cowork pre-filled)

- [ ] Calibration track run **unchanged** at `--seeds 200` on frozen AND reality; incumbent `context_pred_mae`/`recovery_mae` per band reproduced and recorded as the bar.
- [ ] `research/comparison/scripts/capture_evidence.py` created; writes `evidence.json` (A3/A4 field shape) + `SUMMARY.md` into `research/doc/verification-runs/2026-06-19-a6-baseline/`.
- [ ] The capture script uses `ProgressLogger` and wraps its loop in `run_with_heartbeat`; accepts `--quiet` (D-08).
- [ ] `test_capture_evidence.py` added and passing; full `pytest research/comparison/tests -q` passes.
- [ ] Zero source/data/config changes outside the new script + its test + the verification-run dir.

### Implementer report (Codex/Sonnet fills)

_Files changed:_ `research/comparison/scripts/capture_evidence.py`;
`research/comparison/tests/test_capture_evidence.py`;
`research/doc/verification-runs/2026-06-19-a6-baseline/evidence.json`;
`research/doc/verification-runs/2026-06-19-a6-baseline/SUMMARY.md`;
`PLAN.md`;
`VERIFICATION.md`.

_Commit SHA:_ `83bcedea78a70d6c7715e1dba90cfc769c83b952`.

_What was done:_ Committed the plan/verification baseline first (`a10eaff`), then
ran the Phase 1 prereqs: both frozen/reality dataset files existed and
`uv run --package research-comparison pytest research/comparison/tests -q`
passed (`82 passed`). Added a RED test for the new capture script, confirmed it
failed because the script was missing, then implemented
`capture_evidence.py` with `ProgressLogger`, `run_with_heartbeat`, repeatable
`--result label=path`, `--output-dir`, and `--quiet`. Re-ran the focused test
green (`1 passed`). Ran the calibration track at 200 seeds on frozen and
reality with `--out-dir` scratch locations to preserve both result JSONs, then
captured the committed review artifacts at
`research/doc/verification-runs/2026-06-19-a6-baseline/{evidence.json,SUMMARY.md}`.
Post-verification file checks passed and the full research test suite passed
(`83 passed`).

_Deviations + why:_ The runner commands used `--out-dir` scratch directories so
both frozen and reality outputs could be captured before the second run
overwrote the default calibration result path. The 45 MB raw result JSONs were
removed before staging because Phase 1 requires the small stamped
`evidence.json` and `SUMMARY.md`, not the intermediate raw inputs. Per the
active user goal, I did not stop for Cowork review after this phase; the
review-ready artifacts and report are recorded here.

_Self-check vs criteria:_ Calibration was rerun unchanged at 200 seeds on both
datasets and the incumbent bars are in `SUMMARY.md`; `capture_evidence.py`
writes A6 `evidence.json` plus `SUMMARY.md` with scored split, seed count,
params hash, per-band `context_pred_mae`/`recovery_mae`, and Holm survivors;
the script uses `ProgressLogger` and `run_with_heartbeat` and accepts
`--quiet`; `test_capture_evidence.py` passes; the full suite passes; source
changes are limited to the new script, its test, the Phase 1 review artifacts,
and this plan/verification update.

### Reviewer findings (Cowork fills)

_Per-criterion verdict / issues / required changes:_ Reviewed diff at `83bcede`. ✅ All five criteria met: calibration track re-run unchanged at 200 seeds on frozen + reality, incumbent `context_pred_mae`/`recovery_mae` per band recorded as the bar in `SUMMARY.md`; `capture_evidence.py` uses `ProgressLogger` + `run_with_heartbeat` + `--quiet` (D-08) and emits `evidence.json` (A3/A4 field shape) + `SUMMARY.md`; `test_capture_evidence.py` added and passing; changes confined to the new script, its test, and the `2026-06-19-a6-baseline/` dir (zero source/data/config touched). Accepted note: the per-phase stop was collapsed because the user authorised batch execution of Phases 1–5.  ·  **Status:** ✅ Verified

### Resolution (Codex fills on redo)

n/a — verified.

---

## Phase 2 — Dataset v2: extend archetypes, add deadline horizon, re-freeze, regenerate, re-verify reality

### Acceptance criteria (Cowork pre-filled)

- [ ] **Pre-registration gate honoured:** proposed archetype params + TRAIN/HELD-OUT split + horizon-field schema were posted and marked `✅ Verified` by Cowork **before** regeneration/scoring.
- [ ] `night_owl`, `crammer`, `steady_improver` added to `ARCHETYPES` with principled, literature-anchored params; `delta_deadline` honours per-archetype `deadline_ramp_start`; `trend_multiplier` added additively (OQ-02 decision recorded).
- [ ] Observable `planned_horizon` (deadline date + `planned_total_sessions`) emitted into the **learner record** only (not the truth sidecar); confirmed it is a plan input, not pace-derived (D-04).
- [ ] `college/scope/archetype-preregistration.md` re-frozen with a new dated entry; `PARAMS_VERSION_HASH` changed; TRAIN/HELD-OUT split pre-committed there (D-03).
- [ ] Frozen + reality datasets regenerated at 200 seeds into new hash dirs.
- [ ] `verify_reality_bounds.py` created (heartbeat-instrumented); regenerated archetypes' moments (AR(1) φ, shift freq, gap dist, dropout) fall inside OULAD bounds; `reality_bounds_check.json` written.
- [ ] `test_generator.py` updated (new-archetype shapes + horizon present, truth un-leaked) + `test_reality_bounds.py` added; all tests pass.
- [ ] Incumbent baseline re-captured on the v2 dataset.

### Implementer report (Codex/Sonnet fills)

_Files changed:_ `college/scope/archetype-preregistration.md`;
`research/comparison/src/research_comparison/params.py`;
`research/comparison/src/research_comparison/generator/effects.py`;
`research/comparison/src/research_comparison/generator/generate.py`;
`research/comparison/src/research_comparison/generator/reality.py`;
`research/comparison/src/research_comparison/metrics/rigour.py`;
`research/comparison/src/research_comparison/runners/calibration.py`;
`research/comparison/scripts/verify_reality_bounds.py`;
`research/comparison/tests/test_generator.py`;
`research/comparison/tests/test_reality_bounds.py`;
`research/datasets/synthetic-21c2cdabfa91-seed0-n5400/manifest.json`;
`research/datasets/synthetic-reality-c545404bcacf-seed0-n5400/manifest.json`;
`research/doc/verification-runs/2026-06-19-a6-dataset-v2/{evidence.json,SUMMARY.md,reality_bounds_check.json}`;
this plan and verification file.

_Commit SHA:_ `02cedbc741daec21f208fca379f5af8a5cc10c5b`.

_What was done:_ Added `night_owl`, `crammer`, and `steady_improver` to
`ARCHETYPES`; generalized `delta_deadline` with `deadline_ramp_start`; added
`trend_multiplier`; wired both frozen and reality generation to apply trend;
emitted learner-visible `planned_horizon` while keeping it out of sidecars;
included `PARAMS_VERSION_HASH` in the reality hash payload so v2 reality data
gets a new id; recorded sidecar-only dropout metadata in reality generation;
updated the train split to
`steady/morning_lark/marathon_runner/crammer/steady_improver` while preserving
legacy six-archetype compatibility; added the heartbeat-instrumented
`verify_reality_bounds.py`; and added focused generator/reality-bounds tests.
The new frozen params hash is `21c2cdabfa91`. Generated datasets:
`synthetic-21c2cdabfa91-seed0-n5400` and
`synthetic-reality-c545404bcacf-seed0-n5400`.

_Verification run:_ Focused Phase 2 tests passed
(`13 passed`). Generated both 200-seed v2 datasets with progress logs. Ran
`verify_reality_bounds.py` against the v2 reality dataset and A5 OULAD bounds;
`reality_bounds_check.json` reports `status=pass`, overall
`ar1_phi=0.2194209267`, `shift_frequency_per_100_days=9.5235711487`,
`dropout_probability=0.2170370370`, and gap quantiles within bounds. Re-ran
calibration on v2 frozen and reality datasets, captured
`evidence.json`/`SUMMARY.md`, then removed raw scratch result JSONs. Phase DONE
checks passed: `9 21c2cdabfa91`, new dataset manifest dirs exist, learner
records carry `planned_horizon`, bounds artifact exists, and the full research
suite passed (`86 passed`).

_Deviations + why:_ The pre-registration content was written before scoring,
but Cowork did not mark it `✅ Verified` before regeneration because the active
user goal asks Codex to complete Phases 1-5 in this run. During v2 baseline
recapture, learners with exactly 3 active sessions produced no next-session
context-prediction errors, leading to NaN aggregation; I fixed the runner to
skip learners with fewer than 4 active sessions. Only dataset `manifest.json`
files are staged per existing repo convention; large generated
`learners.jsonl`/`sidecars.jsonl`/`face_validity.json` remain ignored.

_Self-check vs criteria:_ New archetypes, split, params, and horizon schema are
pre-registered in `college/scope/archetype-preregistration.md`; `PARAMS_VERSION_HASH`
changed to `21c2cdabfa91`; `delta_deadline` and `trend_multiplier` cover the
new shapes; `planned_horizon` is observable in learner records and absent from
sidecars; frozen and reality datasets were regenerated at 200 seeds; the
reality verifier is heartbeat-instrumented and wrote passing bounds evidence;
generator and bounds tests pass; the full suite passes; v2 incumbent baseline
evidence has been recaptured for Phase 3.

### Reviewer findings (Cowork fills)

_Per-criterion verdict; check the new hash is reproducible, the split is balanced (D-03), horizon is non-leaky, reality bounds pass:_ Reviewed diff at `02cedbc`. ✅ Technical criteria all met: `night_owl` (τ-mirror), `crammer` (`deadline_ramp=1.35`, `deadline_ramp_start=0.90`), `steady_improver` (`trend_total=+0.20`) added to `params.py` with principled params; `delta_deadline` honours `deadline_ramp_start` and `trend_multiplier` is additive (OQ-02 resolved as recommended — `fading_flame`'s regime left untouched); `planned_horizon` is emitted into the **learner record only** (confirmed absent from the truth sidecar) and derived from the plan, not `r_star` (D-04); pre-registration re-frozen with a dated changelog entry carrying the exact D-03 5/4 split; `PARAMS_VERSION_HASH` → `21c2cdabfa91`; frozen (`…-n5400`) + reality (`synthetic-reality-c545404bcacf-…`) regenerated at 200 seeds; `verify_reality_bounds.py` is heartbeat-instrumented and `reality_bounds_check.json` status = `pass`; generator + bounds tests added. The two shared-code edits are both sound and **symmetric across all candidates** (no per-candidate bias): `metrics/rigour.py` only updates `DEFAULT_HELDOUT_TRAIN_ARCHETYPES` to the 5 train types and makes the splitter intersect with available archetypes (legacy-dataset safety); the `<3`→`<4` active-session skip is a NaN-handling fix (a 3-active-session learner yields no context-prediction point). **Process deviation, accepted retroactively:** criterion #1 (Cowork marks the pre-registration `✅ Verified` *before* regeneration) was bypassed in the batch run. I reviewed the pre-registration content retroactively — it matches the design agreed during grill-me exactly, with provenance, and was frozen before the new candidates were *scored*, so the no-post-hoc-tuning guard holds. Restore the gate for Phase 6.  ·  **Status:** ✅ Verified

### Resolution (Codex fills on redo)

n/a — verified. (Process: re-instate the pre-registration stop-gate before Phase 6.)

---

## Phase 3 — Enriched + partial-pooling calibrator + TRAIN-prior pre-pass

### Acceptance criteria (Cowork pre-filled)

- [ ] `EnrichedShrinkageCalibrator` added to `baselines/calibration.py`, registered in `calibration_candidates()`, exposing `fit_global`/`predict_next`/`fit_interval`; shipped candidates untouched.
- [ ] L1 features include `same_day_count` (fatigue), session-position `progress` + calendar `days_to_deadline` (from `planned_horizon`), recency/own-trend, plus existing ρ/τ/ν.
- [ ] Partial-pooling shrinkage toward an injected population prior implemented as `(XᵀX+λI)β = Xᵀy + λ·prior` (D-05).
- [ ] TRAIN-only population-prior pre-pass added to `run_calibration_track` (mirrors `tune_cusum_params`), recorded in provenance as `fit_on_train_archetypes_only`.
- [ ] `_context_of` extended to pass observable next-context only (`materialRole`, `startedAt`, `planned_horizon`, `session_index`) — never `r_star`/truth.
- [ ] `pooled_bayes`/`ewma`-baselined `mc_correction` block added alongside the incumbent block (D-07).
- [ ] **No-leakage test** passes: identical output with truth fields stripped/shuffled. Effect-recovery + predict_next + finite tests pass.
- [ ] λ/shrink tuned on held-out-TRAIN only, recorded in provenance.
- [ ] Scored at 200 seeds on v2 frozen AND reality; `evidence.json` (with `delta_ci`, `scored_split="held_out"`, both mc_correction blocks) + `SUMMARY.md` written for review.
- [ ] All scripts heartbeat-instrumented (D-08).

### Implementer report (Codex/Sonnet fills)

_Files changed:_ `research/comparison/src/research_comparison/baselines/calibration.py`;
`research/comparison/src/research_comparison/runners/calibration.py`;
`research/comparison/scripts/capture_evidence.py`;
`research/comparison/tests/test_calibration_track.py`;
`research/doc/verification-runs/2026-06-19-a6-enriched/{evidence.json,SUMMARY.md}`;
this plan and verification file.

_Commit SHA:_ `8545481648a6db93ba30559b7a8e2d994f48d8d4`.

_What was done:_ Added `EnrichedShrinkageCalibrator` with L1 features for
role/time/day, same-day fatigue, planned progress, deadline urgency, and
recency. It implements `fit_global`, `predict_next`, `fit_interval`, and an
internal coefficient fit using shrinkage toward an injected population prior.
The calibration runner now enriches active sessions with observable
`planned_horizon` and `session_index`, fits an `enriched_shrink` prior on TRAIN
archetypes only, tunes ridge/shrink on TRAIN seed `<5` midpoint next-session
validation, registers the tuned enriched candidate without removing shipped
candidates, and emits `population_prior` plus
`mc_correction_simple_baselines` for `pooled_bayes` and `ewma`. The capture
script now preserves those extra correction blocks in review evidence.

_Verification run:_ Focused calibration tests passed (`17 passed`). Candidate
registration prints `enriched_shrink`. Scored v2 frozen and v2 reality at
200 seeds; both runs emitted progress and used the TRAIN-only pre-pass. Captured
Phase 3 evidence at
`research/doc/verification-runs/2026-06-19-a6-enriched/evidence.json` and
`SUMMARY.md`. Evidence includes population-prior provenance and simple-baseline
correction blocks. Frozen selected `ridge=1.0, shrink=6.0`; reality selected
`ridge=1.0, shrink=2.0`; both use TRAIN archetypes
`crammer/marathon_runner/morning_lark/steady/steady_improver`. Full research
suite passed (`90 passed`).

_Deviations + why:_ The first TRAIN tuning implementation used full
prequential refits and was interrupted twice after heartbeat output showed it
was too slow for the 5,400-learner dataset. I replaced it with a bounded
TRAIN-only midpoint next-session validation loop and changed the population
prior from one pooled all-session fit to a per-learner TRAIN seed `<20`
coefficient average, avoiding the pooled same-day O(N^2) feature path. This
keeps tuning and prior fitting strictly TRAIN-only while making the scoring
run practical. Per the active user goal, I did not stop for Cowork review after
Phase 3; the review-ready evidence and report are recorded here.

_Self-check vs criteria:_ `enriched_shrink` is added and registered; shipped
candidates remain present; features are observable only and no generator-truth
imports were added to `baselines/calibration.py`; shrinkage uses an injected
population prior; `_context_of` passes only material role, timestamp,
planned horizon, and session index; TRAIN-only prior/tuning provenance is in
the payload; `pooled_bayes`/`ewma` MC correction blocks are emitted; no-leakage
tests pass; frozen and reality 200-seed evidence is captured; heartbeat output
is present for the pre-pass and learner scoring.

### Reviewer findings (Cowork fills)

_Review the diff at SHA + the evidence.json: did `enriched_shrink` beat the incumbent and `pooled_bayes`/`ewma` on held-out `context_pred_mae` (Holm)? Does it hold on reality? Any wrong-direction Holm-significant cells? No-leakage test genuine?_ Reviewed diff at `8545481` + `evidence.json`. ✅ All criteria met. Integrity: **no generator-truth import** in `baselines/calibration.py` (grep-confirmed — only `py_progress`/`numpy`); features observable-only (fatigue via same-day grouping, session-position progress + calendar days-to-deadline from `planned_horizon`, recency, ρ/τ/ν); shrinkage is exactly `(XᵀX + ridge + shrink·I)β = Xᵀy + shrink·prior` (D-05); `_context_of` passes observable next-context only (no `r_star`); population prior + λ/shrink tuning are strictly **TRAIN-archetype-only** (`seed<20` / `seed<5`), recorded in provenance as `fit_on_train_archetypes_only`; `pooled_bayes`/`ewma` `mc_correction` blocks added (D-07); the no-leakage test is **genuine** (pollutes history + next-context with `r_star`/`sidecar_archetype`/`regime_schedule`, asserts identical `predict_next`). **Result is a real, earned win:** held-out `context_pred_mae` Holm-surviving vs the `hierarchical_bayes` incumbent (11/12 frozen) and vs `pooled_bayes` (11/12 frozen, 9/12 reality) and `ewma` (11/12 frozen, 5/12 reality); means ≈0.074 vs pooled ≈0.104 at max band; **holds on reality**. No wrong-direction Holm cells for `enriched_shrink` on `context_pred_mae` (1 significant not-win frozen, 0 reality). The deviation (prior = per-learner TRAIN-`seed<20` coefficient average rather than a pooled all-session fit; bounded midpoint tuning for runtime) is transparently recorded, TRAIN-only, and principled. This overturns the prior calibration null *honestly*, via the observable signals the baselines ignored.  ·  **Status:** ✅ Verified

### Resolution (Codex fills on redo)

n/a — verified.

---

## Phase 4 — Archetype-aware variants (hard router + soft), as shrinkage priors

### Acceptance criteria (Cowork pre-filled)

- [ ] Label-free behavioural fingerprint added (computable from `sessions` alone); standardiser fit on TRAIN only.
- [ ] TRAIN pre-pass extended to fit per-TRAIN-type priors + prototype centroids (no held-out data used).
- [ ] `ArchetypeRouterHardCalibrator` + `ArchetypeSoftCalibrator` added and registered (additive); both route to a **prior**, not a fixed shape (D-05).
- [ ] Temperature/#-effective-classes tuned on held-out-TRAIN only, recorded in provenance.
- [ ] Tests: fingerprint label-free (truth-shuffle invariant); router sends a held-out `deadline_sprinter` toward the `crammer` prior; soft falls back to population when ambiguous. All pass.
- [ ] Scored at 200 seeds on v2 frozen AND reality; `evidence.json` + `SUMMARY.md` written.
- [ ] Heartbeat-instrumented (D-08).

### Implementer report (Codex/Sonnet fills)

_Files changed:_ `research/comparison/src/research_comparison/baselines/calibration.py`;
`research/comparison/src/research_comparison/runners/calibration.py`;
`research/comparison/scripts/capture_evidence.py`;
`research/comparison/tests/test_calibration_track.py`;
`research/comparison/tests/test_capture_evidence.py`;
`research/doc/verification-runs/2026-06-19-a6-archetype/{evidence.json,SUMMARY.md}`;
this plan and verification file.

_Commit SHA:_ `a919ea44beaf3f2edbc8a1f5d47edb9d4b9d8d9a`.

_What was done:_ Added the label-free behavioural fingerprint with
evening-minus-morning, weekend-minus-weekday, late-minus-early,
final-stretch-bump, and volatility features. Added
`ArchetypeRouterHardCalibrator` and `ArchetypeSoftCalibrator`, both registered
additively and both delegating to the enriched shrinkage fit with a routed or
soft-blended TRAIN-type prior. Extended the TRAIN pre-pass to fit per-TRAIN-type
coefficient priors, TRAIN-fit fingerprint prototypes/standardiser values, and a
soft temperature grid. The runner records the archetype audit under
`population_prior.enriched_shrink.archetype_variants`. I also added
`mc_correction_reference_baselines`, including `enriched_shrink`, so Phase 4 can
directly evaluate the archetype variants against the Phase 3 workhorse.

_Verification run:_ Candidate registration prints both
`archetype_router_hard` and `archetype_soft`. Focused tests passed
(`21 passed`). Scored v2 frozen and v2 reality at 200 seeds with heartbeat
progress; captured review artifacts at
`research/doc/verification-runs/2026-06-19-a6-archetype/evidence.json` and
`SUMMARY.md`, then removed raw scratch result JSONs. Evidence records TRAIN
archetypes `crammer/marathon_runner/morning_lark/steady/steady_improver` for
both runs and selected soft temperature `0.5` for both runs. Full research suite
passed (`93 passed`).

_Result vs `enriched_shrink`:_ Direct Holm correction versus `enriched_shrink`
is now in `reference_baseline_mc_survivors.enriched_shrink`. On frozen
`context_pred_mae`, `archetype_router_hard` and `archetype_soft` each have
3 Holm-surviving wins, but `archetype_router_hard` also has 8 significant
not-wins and `archetype_soft` has 1. On reality `context_pred_mae`,
`archetype_router_hard` has 2 wins and 1 significant not-win; `archetype_soft`
has no Holm-surviving wins over `enriched_shrink`. This is not a clean Phase 4
recommendation for archetype-awareness over the simpler enriched model.

_Deviations + why:_ The plan already required the variants to beat
`enriched_shrink`, but the Phase 3 runner only emitted Holm blocks versus the
incumbent and simple baselines. I added the reference-baseline correction block
and preserved/surfaced it in `capture_evidence.py` so the acceptance question is
auditable from the evidence artifact. Per the active user goal, I did not stop
for Cowork review after Phase 4; the review-ready evidence and report are
recorded here.

_Self-check vs criteria:_ The fingerprint is computed from observed sessions
only and has a truth-shuffle invariant test; the TRAIN pre-pass fits type priors
and prototypes using TRAIN archetypes only; both archetype candidates are
registered additively and route to shrinkage priors; temperature tuning is
TRAIN-only and recorded in provenance; focused and full tests pass; frozen and
reality 200-seed evidence is captured; scripts emit heartbeat progress during
scoring and capture.

### Reviewer findings (Cowork fills)

_Does either variant beat `enriched_shrink` on held-out `context_pred_mae` (Holm)? If not, that's a legitimate result (D-06) — confirm it's reported as such, not hidden._ Reviewed diff at `a919ea4` + `evidence.json`. ✅ All criteria met. The behavioural fingerprint is label-free (genuine truth-shuffle invariance test); both `ArchetypeRouterHardCalibrator` and `ArchetypeSoftCalibrator` are registered additively and **delegate to the enriched fit with a routed/blended prior — not a fixed shape** (D-05 honoured; this is the exact correction the design probe proved necessary, and `test_router_routes_sprinter_toward_crammer_prior` confirms the routing mechanism); type-priors/prototypes/standardiser and the soft temperature are fit/tuned **TRAIN-only**, recorded in provenance; a `reference_baseline` `mc_correction` vs `enriched_shrink` was added so the D-06 question is auditable from the artifact. **Honest negative result, correctly reported as a non-recommendation:** neither variant cleanly beats `enriched_shrink` on held-out `context_pred_mae` — hard router 3 wins / 8 significant not-wins (frozen), 2 / 1 (reality); soft 3 / 1 (frozen), **0 wins (reality)**. This matches D-06 and the simulation's prediction (the membership layer adds ~nothing over shrinkage); it is surfaced in the evidence and SUMMARY, not hidden.  ·  **Status:** ✅ Verified

### Resolution (Codex fills on redo)

n/a — verified.

---

## Phase 5 — Honest decision + findings note

### Acceptance criteria (Cowork pre-filled)

- [ ] All calibration candidates re-scored at 200 seeds on v2 frozen AND reality; final `evidence.json` carries `delta_ci`, `scored_split="held_out"`, both mc_correction blocks, `params_version_hash`, seed count.
- [ ] Winner chosen by the D-07 bar (Holm-surviving held-out `context_pred_mae`; tie-break holds-on-reality, then simplicity per D-06), **or** an explicit honest null written.
- [ ] `2026-06-19-a6-final/SUMMARY.md` states per band+regime outcomes, each tied to evidence file + commit SHA; no fabricated numbers.
- [ ] Claims & caveats ledger updated with the A6 calibration outcome in the agreed honest framing.

### Implementer report (Codex/Sonnet fills)

_Files changed:_ `research/doc/verification-runs/2026-06-19-a6-final/evidence.json`;
`research/doc/verification-runs/2026-06-19-a6-final/SUMMARY.md`;
`research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`;
this plan and verification file.

_Commit SHA:_ `922c64e56975d639e4e22e70115a4663486c5c1f`.

_What was done:_ Re-scored the full calibration candidate set at 200 seeds on
the v2 frozen dataset and the v2 reality-matched dataset. Captured final
review artifacts under
`research/doc/verification-runs/2026-06-19-a6-final/`, then removed raw scratch
result JSONs. Rewrote the final summary decision section and updated the claims
and caveats ledger with the A6 calibration outcome.

_Decision:_ Recommend `enriched_shrink` for the primary held-out
`context_pred_mae` use case. It has Holm-surviving wins against `pooled_bayes`
in 11/12 frozen cells and 9/12 reality cells, and against `ewma` in 11/12
frozen cells and 5/12 reality cells. Do not recommend the archetype hard/soft
layer over `enriched_shrink`: direct comparisons show isolated wins but also
significant losses, and the soft variant has no Holm-surviving reality
`context_pred_mae` wins over `enriched_shrink`. `recovery_mae` remains mixed and
is not the headline claim.

_Verification run:_ Phase 5 prereq full suite passed (`93 passed`). Final frozen
and reality scoring runs emitted heartbeat progress and wrote raw scratch JSONs;
`capture_evidence.py` wrote `evidence.json` and `SUMMARY.md`. DONE checks passed:
the final evidence file exists, it contains `survives_holm_win`, and the final
summary exists. Final full research suite passed (`93 passed`).

_Deviations + why:_ Raw scratch result JSONs were removed after capture; only
the small review artifacts are committed. Per the active user goal, I did not
stop for Cowork review after Phase 5; the review-ready evidence and report are
recorded here.

_Self-check vs criteria:_ Final evidence and summary are present; the summary
states per-regime/band means plus the decision framing; the claims ledger
records the A6 outcome with evidence path; full tests pass; no source code was
changed in Phase 5.

### Reviewer findings (Cowork fills)

_Verify every claim against the stamped evidence; confirm no overstatement beyond Holm-surviving held-out wins._ Reviewed diff at `922c64e` + final `evidence.json`. ✅ Decision and scoring are correct; **one required honest-framing addition.** The final evidence carries `delta_ci`, `scored_split="held_out"`, both incumbent and `pooled_bayes`/`ewma` `mc_correction` blocks, the `reference_baseline` block, `params_version_hash`, and seed count. I cross-checked every headline number against the `mc_survivors`/reference blocks: `enriched_shrink` 11/12 vs pooled (frozen) and 9/12 (reality); 11/12 vs ewma (frozen) and 5/12 (reality); the archetype variants' win/loss tallies match. The recommendation (recommend `enriched_shrink`; archetype layer not recommended; `recovery_mae` mixed and not the headline) is faithful to the numbers and not overstated; the claims-ledger update is honest and appropriately qualified. **Required follow-up (documentation, non-blocking for the science — do before the report/Phase 6):** add the OQ-03 caveat to the claims ledger — on the *frozen* regime `planned_total_sessions ≡ realized count` and `deadline = last realized session date`, so the session-position progress feature there is essentially exact; the deadline-feature claim is defensible because it **holds on the reality regime, where dropout makes `planned ≠ observed`**. Lead the deadline-feature claim with the reality result and disclose the frozen over-cleanness.  ·  **Status:** ✅ Verified (with the ledger caveat to add before the report)

### Resolution (Codex fills on redo)

…

---

## Phase 6 (DEFERRED) — Change-detection track

### Acceptance criteria (Cowork pre-filled)

- [ ] **Not started until Phase 5 `✅ Verified` and a dedicated grill-me has specced the detection design** (D-01). Criteria to be expanded then (target: a fused operating point that dominates the CUSUM↔CSD Pareto frontier, Holm-surviving on held-out, holding on reality).

### Implementer report / Reviewer findings / Resolution

_(deferred)_
