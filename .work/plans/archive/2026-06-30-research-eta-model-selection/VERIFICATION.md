---
title: "VERIFICATION — research ETA model selection + Pillar-A re-validation"
companion: ./PLAN.md
status: P0–R5 ✅ (synthetic workstream COMPLETE) · R6 ⏸ DEFERRED — blocked on real N=1 data (stub-only now)
legend: "☐ not started · 🟡 implemented, awaiting reviewer · ✅ reviewer-verified · ❌ failed/blocked"
---

# Verification log

> **Protocol.** The executor fills the *Developer* block of each phase (what was done, files, commit SHA,
> deviations, evidence) and flips the phase marker ☐→🟡. The **reviewer** reads the spec + the actual diff
> + the stamped result JSONs, fills the *Reviewer* block, and flips 🟡→✅ (or ❌ with reasons). **A phase
> is not done until the reviewer signs it.** Record real numbers and real run-vs-authored-only status — no
> fabrication (PLAN §0.3).

---

## P0 — Baseline, environment, commit-the-plan  ✅ (P0b frozen baseline on disk and snapshotted — R1 ready)
**Acceptance criteria**
- [x] Planning docs committed before any code (Step-0). SHA: `17bb1af4b2ca8b85430aa94bfd50fe1e79e277d1`
- [x] Harness test status recorded (ran: `92/94` pass; or blocked with reason): `2 failed in research/comparison/tests/test_closed_loop.py; both fail because closed-loop regeneration passes RoadmapInput(materials=[]) into py_roadmap_engine, which raises ValueError("at least one material required"). Initial sandbox run was blocked by uv cache permission at /Users/rsaji/.cache/uv; escalated uv run completed.`
- [x] A-series projection provenance recorded from `research/results/projection/projection_results.json`:
      `dataset_id=synthetic-reality-3b404c903563-seed0-n3600`, `seeds=200`, `bands=small,medium,max`, `n_learners=3600`, `scored_split=held_out`.
- [x] Baseline headline numbers snapshotted: calibration winner/Holm survivors; detection robust-null;
      projection coverage/MAE/sharpness per band.
- [x] P0b corrective frozen A-series baseline regenerated on `research/datasets/synthetic-21c2cdabfa91-seed0-n5400` and snapshotted; D-08 superseded by D-09.
- [x] Refreshed calibration result contains `enriched_shrink` and current-code dual-prior candidate `enriched_dual_prior`.

**Developer notes:** P0 implemented by Codex on 2026-06-30. Step-0 planning-doc commit:
`17bb1af4b2ca8b85430aa94bfd50fe1e79e277d1`. P0 evidence commit:
`5a3eec91bdb05de177428f597543869c113d110f`.

Files changed for P0 evidence: `SCRATCHPAD.md`, `VERIFICATION.md` only.

Commands run:
- `uv run --package research-comparison pytest research/comparison/tests -q`
  - sandbox attempt failed before tests: `Failed to initialize cache at /Users/rsaji/.cache/uv`.
  - escalated rerun completed: `92 passed, 2 failed in 81.80s`.
  - failing tests: `test_closed_loop_run_regenerates_when_shift_is_detected` and
    `test_closed_vs_open_metrics_include_adherence_and_finish_drift`.
  - failure root at baseline: `packages/py-roadmap-engine/src/py_roadmap_engine/engine.py:294`
    raises `ValueError("at least one material required")` after
    `research_comparison.runners.closed_loop.run_closed_loop_for_scenario(...)` calls
    `regenerate_roadmap(...)` with `RoadmapInput(materials=[])`.
- `jq` extraction commands over:
  - `research/results/projection/projection_results.json`
  - `research/results/calibration/calibration_results.json`
  - `research/results/detection/detection_results.json`

Projection provenance actually on disk:
`dataset_id=synthetic-reality-3b404c903563-seed0-n3600`; `seed_count=200`;
`bands=[small, medium, max]`; `n_learners=3600`; formula `6 archetypes x 3 bands x 200 seeds`;
`scored_split=held_out`; `generator_version=0.1.0`; `params_version_hash=3b404c903563`;
train archetypes `marathon_runner,morning_lark,steady`; held-out archetypes
`deadline_sprinter,fading_flame,weekend_warrior`.

Baseline headline snapshot:
- Calibration: on-disk candidate set is legacy-only
  (`covariate_bayes, eb_partial_pool, ewma, hierarchical_bayes, kalman, oracle_calibration,
  pooled_bayes, sma`); `enriched_shrink` and `dual_prior` are not present in this P0 JSON.
  m_global winners are `oracle_calibration` for max/medium/small; non-oracle
  `hierarchical_bayes` MAE is max `0.1529828211272382`, medium `0.11212833534127313`,
  small `0.11001981825580294`. Context-pred Holm survivors vs `hierarchical_bayes` are
  `ewma`, `sma`, and `oracle_calibration`; recovery-mae Holm survivor is `oracle_calibration` only.
- Detection: robust-null holds in this baseline. `cusum` wins drift and step; no non-oracle detector has
  `survives_holm_win=true`. Drift: latency `4.13731380394727`, false alarm `0.18408558783043402`,
  missed `168.0`, score `16808.73945349971`. Step: latency `2.5582565598190596`, false alarm
  `0.20726369989319746`, missed `285.0`, score `28507.73984905715`.
- Projection: `gp_ard` by band: max coverage `0.13083333333333333`, MAE `30.236875`,
  sharpness `9.068541666666667`; medium coverage `0.2674206349206349`, MAE `13.002420634920634`,
  sharpness `8.738333333333333`; small coverage `0.31152777777777774`, MAE `6.320277777777777`,
  sharpness `7.710277777777779`. Holm survivors vs `gp_ard`: `conformal` 9 cells,
  `gp_hetero_t` 9 cells, `kalman` 3 cells, `linear` 3 cells, `oracle_projection` 9 cells. Treat oracle
  as an upper bound only.

Deviation/reviewer flag: PLAN expected the D-05 parity target may be the frozen
`synthetic-21c2cdabfa91-seed0-n5400` / 9-archetype lineage, but the only on-disk projection result is
`synthetic-reality-3b404c903563-seed0-n3600` / 6 archetypes. PLAN D-05 says to match the current on-disk
projection result rather than guessing, so SCRATCHPAD D-08 resolves OQ-4 to the current stamped JSON.
Reviewer should either accept this parity target or request a regenerated A-series baseline before R1/R5
parity is relied on.

**Reviewer findings (2026-06-30 · Cowork/planner):** Execution **ACCEPTED**; parity target **REJECTED**
(D-08). P0 stays **🟡** pending one corrective run (**P0b** below). **R1 is UNBLOCKED — start it now in
parallel.** All claims independently re-verified against the repo.

*Verified ✅:*
- Commits scoped correctly: `17bb1af` added the plan docs (PLAN/SCRATCHPAD/VERIFICATION + a saved
  `prompt.txt`); `5a3eec9` touched **only** SCRATCHPAD + VERIFICATION → **no code changed**, so the two
  `test_closed_loop` failures are **pre-existing**, not introduced.
- Test status real (92 passed / 2 failed). The 2 failures live in the **closed-loop** track
  (`py_roadmap_engine` rejecting `RoadmapInput(materials=[])`), which is part of the **retired
  scheduling/closed-loop area — OUT of scope** (§5c drops scheduling). **Not a blocker;** leave as-is.
- Provenance faithfully reported, and — credit to the executor — **both** real problems were *flagged*
  rather than buried.

*Critical finding — why P0 is not ✅ (parity anchor is the wrong dataset):* all three on-disk result JSONs
(`projection`, `calibration`, `detection`) were generated from
`synthetic-reality-3b404c903563-seed0-n3600` — the **reality-matched, 6-archetype (3 train / 3 held),
n3600** lineage (`generator_regime=reality_matched`), **not** an A-series frozen baseline. Two
consequences make it unusable as the headline parity anchor:
  1. The on-disk **calibration** baseline contains legacy candidates only
     (`covariate_bayes, eb_partial_pool, ewma, hierarchical_bayes, kalman, pooled_bayes, sma`) —
     **no `enriched_shrink` / `dual_prior`**. R2's entire purpose is to re-confirm those two transfer;
     there is nothing to compare them against. (The live code *does* register them —
     `baselines/calibration.py:932-933` — so a fresh run will include them.)
  2. R5 requires dissertation-grade parity with the **A-series** (9 archetypes, 5 train / 4 held). The
     reality 6-archetype run is a different experiment (PA+.7 reality-matching), not the A-series baseline.

→ **D-08 is rejected.** The correct anchor is already on disk and free to use:
`synthetic-21c2cdabfa91-seed0-n5400` — **frozen** regime, **9 archetypes × 3 bands × 200 = 5400**, which
is exactly what the live `PARAMS_VERSION_HASH` and the dual-prior `FROZEN_REFERENCE_DATASET_ID` resolve to.
(Note: the older `e716cd12dddc`/n3600 frozen lineage the claims-ledger cites also exists on disk — in the
R5 ledger note, record which lineage each number comes from; do **not** silently mix lineages.)

*REQUIRED — P0b (does NOT block R1; must land before R2/R4/R5 comparisons):* regenerate the frozen
A-series baseline with the **current** code, all three tracks, on the 9-archetype frozen dataset, to the
**default** out-dirs (this IS the legitimate A-series baseline — default out-dirs are correct here; the
"separate --out-dir" rule applies only to the *decoupled* runs):
```
uv run --package research-comparison python -m research_comparison.runners.calibration \
  --dataset-dir research/datasets/synthetic-21c2cdabfa91-seed0-n5400 --seeds 200 --quiet
uv run --package research-comparison python -m research_comparison.runners.detection  \
  --dataset-dir research/datasets/synthetic-21c2cdabfa91-seed0-n5400 --seeds 200 --quiet
uv run --package research-comparison python -m research_comparison.runners.projection \
  --dataset-dir research/datasets/synthetic-21c2cdabfa91-seed0-n5400 --seeds 200 --quiet
```
Then: confirm the calibration result now contains `enriched_shrink` + `dual_prior`; re-snapshot the three
headline blocks into SCRATCHPAD §5 as the **authoritative** P0 baseline; mark D-08 superseded by a new
decision recording the frozen 9-archetype anchor. Flip P0 → ✅ once P0b's baseline is on disk and
snapshotted.

*Out of scope / no action:* the 2 closed-loop test failures (retired track). *Open for Rohit (optional):*
whether to also refresh the reality lineage — not needed for this workstream.

**Developer P0b follow-up (2026-06-30 · Codex):** Completed the reviewer-required corrective baseline.
D-08 is superseded; the authoritative P0 parity anchor for R2/R4/R5 is now the frozen A-series dataset
`synthetic-21c2cdabfa91-seed0-n5400` (9 archetypes × 3 bands × 200 seeds = 5400 learners).

Commands run:
```
uv run --package research-comparison python -m research_comparison.runners.calibration \
  --dataset-dir research/datasets/synthetic-21c2cdabfa91-seed0-n5400 --seeds 200 --quiet
uv run --package research-comparison python -m research_comparison.runners.detection \
  --dataset-dir research/datasets/synthetic-21c2cdabfa91-seed0-n5400 --seeds 200 --quiet
uv run --package research-comparison python -m research_comparison.runners.projection \
  --dataset-dir research/datasets/synthetic-21c2cdabfa91-seed0-n5400 --seeds 200 --quiet
```

Result files verified on disk:
- `research/results/calibration/calibration_results.json` — `102M`, mtime `2026-06-30 11:48`.
- `research/results/detection/detection_results.json` — `13M`, mtime `2026-06-30 11:48`.
- `research/results/projection/projection_results.json` — `74M`, mtime `2026-06-30 12:28`.

Shared P0b provenance from all three result JSONs:
`dataset_id=synthetic-21c2cdabfa91-seed0-n5400`; `seed_count=200`; `bands=[small, medium, max]`;
`n_learners=5400`; `scored_split=held_out`; `generator_version=0.1.0`;
`params_version_hash=21c2cdabfa91`; train archetypes
`crammer,marathon_runner,morning_lark,steady,steady_improver`; held-out archetypes
`deadline_sprinter,fading_flame,night_owl,weekend_warrior`.

P0b calibration snapshot:
- Candidate set is now `archetype_router_hard, archetype_soft, covariate_bayes, eb_partial_pool,
  enriched_dual_prior, enriched_shrink, ewma, hierarchical_bayes, kalman, oracle_calibration,
  pooled_bayes, sma`. This satisfies the reviewer requirement for `enriched_shrink` plus dual-prior
  visibility; the actual current-code candidate name is `enriched_dual_prior`.
- `m_global` winners are all `oracle_calibration`. Non-oracle comparison values:
  max `hierarchical_bayes=0.026354900745805085`, `enriched_shrink=0.056212252802336035`,
  `enriched_dual_prior=0.062103710154268625`; medium
  `hierarchical_bayes=0.04562505437289908`, `enriched_shrink=0.049223212296770055`,
  `enriched_dual_prior=0.06371362073990708`; small
  `hierarchical_bayes=0.07906760923042382`, `enriched_shrink=0.04944408506263499`,
  `enriched_dual_prior=0.07521373672819062`.
- `context_pred_mae` non-oracle values:
  max `hierarchical_bayes=0.10440349677245025`, `enriched_shrink=0.0743644361853051`,
  `enriched_dual_prior=0.07964693330557786`; medium
  `hierarchical_bayes=0.1075614799189899`, `enriched_shrink=0.08132948740137101`,
  `enriched_dual_prior=0.08712631181875113`; small
  `hierarchical_bayes=0.11106906535728693`, `enriched_shrink=0.09635347023180586`,
  `enriched_dual_prior=0.1004458991381396`.
- Holm survivors vs `hierarchical_bayes`: `context_pred_mae` has
  `archetype_router_hard, archetype_soft, covariate_bayes, eb_partial_pool, enriched_dual_prior,
  enriched_shrink, ewma, oracle_calibration`; `recovery_mae` has
  `archetype_router_hard, archetype_soft, enriched_dual_prior, enriched_shrink, oracle_calibration`.

P0b detection snapshot:
- Overall winners: `cusum` for `drift`; `page_hinkley` for `step`.
- `drift` winner metrics (`cusum`): latency `1.3606837606837607`,
  false alarm `0.2960410840918919`, missed `15.0`, score `1508.761710862981`.
- `step` winner metrics (`page_hinkley`): latency `3.03`, false alarm `0.14928175554741097`,
  missed `0.0`, score `6.762043888685274`.
- Comparator details: `step/cusum` latency `1.425`, false alarm `0.3117871322402778`,
  missed `0.0`, score `9.219678306006946`; `step/csd` latency `5.155`,
  false alarm `0.08346613127896195`, missed `0.0`, score `7.241653281974049`;
  `drift/csd` latency `4.0988235294117645`, false alarm `0.04880510931950491`,
  missed `175.0`, score `17505.3189512624`; `drift/page_hinkley` latency
  `2.3905109489051095`, false alarm `0.13856685388266293`, missed `52.0`,
  score `5205.8546822959715`.
- Multiple-comparison correction baseline is `cusum`, primary `holm_bonferroni`.
  Holm-surviving wins: `csd` 3 cells and `page_hinkley` 3 cells. Exact survivor cells:
  `band=max|archetype=fading_flame|shift_type=drift` (`csd` delta `-3.318025024032897`,
  p `1.7966938086023196E-36`; `page_hinkley` delta `-3.0276344173216705`,
  p `1.270717319979601E-63`), `band=max|archetype=fading_flame|shift_type=step`
  (`csd` delta `-1.9780250240328965`, p `1.06794415545707E-12`; `page_hinkley`
  delta `-2.4576344173216707`, p `1.837227654076149E-40`), and
  `band=medium|archetype=fading_flame|shift_type=drift` (`csd` delta
  `-3.8151852022816963`, p `2.2289628195690317E-35`; `page_hinkley` delta
  `-3.2217753932095623`, p `8.763552967143099E-65`). This current-code frozen baseline is
  not the old pure robust-null snapshot.

P0b projection snapshot:
- Winners by band are all `oracle_projection`; oracle remains an upper bound only.
- `gp_ard` baseline: max coverage `0.186875`, MAE `20.1709375`, sharpness `6.610625`;
  medium coverage `0.29080357142857144`, MAE `9.4475`, sharpness `4.98110119047619`;
  small coverage `0.43822916666666667`, MAE `2.1460416666666666`, sharpness
  `1.9139583333333334`.
- `conformal`: max coverage `0.93734375`, MAE `20.1709375`, sharpness `92.0`;
  medium coverage `0.9899702380952381`, MAE `9.4475`, sharpness `85.9946130952381`;
  small coverage `0.9689583333333333`, MAE `2.1460416666666666`, sharpness `15.7884375`.
- `kalman`: max coverage `0.1065625`, MAE `34.07828125`, sharpness `1.958125`;
  medium coverage `0.1799702380952381`, MAE `12.8925`, sharpness `1.915327380952381`;
  small coverage `0.5084375`, MAE `2.5221875`, sharpness `1.82875`.
- Multiple-comparison correction baseline is `gp_ard`, primary `holm_bonferroni`.
  Holm survivors: `conformal` 12 cells, `gp_hetero_t` 12 cells, `linear` 4 cells,
  `oracle_projection` 12 cells.

Projection-run deviation and fix:
- First P0b projection run failed deterministically with `OverflowError: date value out of range`
  in `research/comparison/src/research_comparison/baselines/projection.py`, where
  `_index_to_date()` attempted to add a pathological far-future day offset emitted by the linear
  baseline.
- Fix: `_index_to_date()` now clamps non-finite/out-of-range offsets to Python's supported
  `date.min`/`date.max` range before serializing. Regression test added:
  `test_linear_forecast_caps_pathological_far_future_dates` in
  `research/comparison/tests/test_projection_track.py`.
- Verification:
  - `uv run --package research-comparison pytest research/comparison/tests/test_projection_track.py -q -k linear_forecast_caps_pathological_far_future_dates`
    → `1 passed, 9 deselected`.
  - `uv run --package research-comparison pytest research/comparison/tests/test_projection_track.py -q -k 'linear or kalman or projection_runner'`
    → `4 passed, 6 deselected`.
  - Full `test_projection_track.py` was attempted after the focused passes but interrupted by the user;
    it is not counted as completed verification.

Per reviewer instruction, P0 is flipped to ✅ because P0b's frozen baseline is on disk and snapshotted.

**Reviewer sign-off — P0b (2026-06-30 · Cowork/planner): ✅ RATIFIED. P0 is genuinely complete.**
Independently re-verified against the repo:
- All three on-disk result JSONs now stamp `synthetic-21c2cdabfa91-seed0-n5400` — **9 archetypes × 3 bands
  × 200 = 5400**, frozen hash `21c2cdabfa91`, held-out split 5-train/4-held (matches
  `DEFAULT_HELDOUT_TRAIN_ARCHETYPES`). Correct A-series anchor. ✅
- Calibration registry now includes `enriched_shrink` + `enriched_dual_prior` (+ `archetype_router_hard`,
  `archetype_soft`). The dual-prior win R2 must test **is present** on this baseline: `enriched_shrink` and
  `enriched_dual_prior` are Holm survivors vs `hierarchical_bayes` on **both** `recovery_mae` and
  `context_pred_mae`. So R2 has a genuine win to re-confirm transfers. ✅
- The "overflow fix" (`_index_to_date` clamp to `date.min/max` + non-finite guard) is **safe and
  legitimate** — it round-trips in-range dates identically and only tames pathological far-future indices
  (the frozen `max` band's long horizons trigger it; it will also matter for the R4 analytic candidate).
  Regression test added. Accepted into scope as a necessary baseline-completion fix.

Two findings to carry forward (not P0 defects — context for later phases):
1. **Detection baseline is NOT a pure robust-null on this lineage.** Current code gives `cusum` wins
   `drift` but **`page_hinkley` wins `step`**, and `csd`+`page_hinkley` Holm-survive vs `cusum` on the
   `fading_flame` cells. This matches the **A4** result, not the simpler "nothing beats CUSUM" framing.
   **R3 must state its verdict against THIS baseline** (drift→cusum, step→page_hinkley), not against a
   pure-null strawman.
2. **Name reconciliation:** the dual-prior candidate is registered as **`enriched_dual_prior`** (not
   `dual_prior` as the PLAN prose says). R2/R4/R5 must use `enriched_dual_prior` in all paired comparisons
   and write-ups.

Process note for future phases: leave the phase marker at **🟡** when you finish and let the reviewer flip
🟡→✅ (you pre-set ✅ here; substance was correct so I ratified, but keep the gate one-directional going
forward). **R1 is cleared to start.**

---

## R1 — `decoupled` generator regime  ✅ (reviewer-verified — invariants re-checked over full 5400-learner dataset)
**Acceptance criteria**
- [ ] New dataset `synthetic-decoupled-<hash>-seed0-n5400` created; **A-series + reality datasets
      untouched** (list `research/datasets/` before/after — both unchanged).
- [ ] `GENERATOR_VERSION == "0.2.0"`; manifest stamps base `params_version_hash` **AND** new
      `decoupled_params_hash`; `PARAMS_VERSION_HASH` and `calibration.py:49-50` reference ids **unchanged** (D-01).
- [ ] New pre-reg doc `college/scope/decoupled-session-preregistration.md` committed; cadence/partial/dial
      params frozen there with brief justification (OQ-2).
- [ ] `SessionEvent` extended (`plannedSessionMinutes, resolution, materialPosition, bookingId, isAdHoc`);
      `GroundTruth` extended (`study_days, adherence_bias, interruption_rate, adhoc_rate`).
- [ ] Tests assert (D-02/D-03): `len(r_star)==len(sessions)`; `all(duration>0)`; for every active event
      `abs(active/planned − r_star_i) < 1e-6` **including partials**; partials `resolution=="interrupted"`
      with `0<plannedMinutes<chunk`; ad-hoc sessions off study-days; `face_validity.json` has the new dists.
- [ ] Latent-pace core unchanged (no edits to `pace.py` constants / regimes / `m_global`).

**Developer notes:** R1 implemented by Codex on 2026-06-30. Implementation commit:
`36f271868e7a6c1c6c70eacd76ce4bd2a4a5b3c6` (`feat(research): add decoupled generator`).

Files changed for R1 implementation:
- `college/scope/decoupled-session-preregistration.md`
- `research/comparison/src/research_comparison/params_decoupled.py`
- `research/comparison/src/research_comparison/generator/types.py`
- `research/comparison/src/research_comparison/generator/capacity.py`
- `research/comparison/src/research_comparison/generator/generate.py`
- `research/comparison/src/research_comparison/manifest.py`
- `research/comparison/tests/test_generator.py`
- `research/datasets/synthetic-decoupled-9e6d48db2da8-seed0-n5400/manifest.json`

Commands and evidence:
- Red state captured after tests were authored:
  `uv run --package research-comparison pytest research/comparison/tests/test_generator.py -q`
  initially failed at collection because `DECOUPLED_REGIME` was not implemented yet.
- Focused R1 tests:
  `uv run --package research-comparison pytest research/comparison/tests/test_generator.py -q`
  → `14 passed`.
- Generator/provenance tests:
  `uv run --package research-comparison pytest research/comparison/tests/test_generator.py research/comparison/tests/test_scaffold.py -q`
  → `17 passed`.
- Smoke generation:
  `uv run --package research-comparison python -m research_comparison.generator.generate --regime decoupled --seeds 4 --out-dir /private/tmp/study-r1-decoupled-smoke --quiet`
  → `synthetic-decoupled-9e6d48db2da8-seed0-n108`.
- Full generation:
  `uv run --package research-comparison python -m research_comparison.generator.generate --regime decoupled --seeds 200 --out-dir research/datasets --quiet`
  → `synthetic-decoupled-9e6d48db2da8-seed0-n5400`.

Full dataset invariant summary:
- Manifest: `dataset_id=synthetic-decoupled-9e6d48db2da8-seed0-n5400`,
  `generator_version=0.2.0`, `params_version_hash=9e6d48db2da8`,
  `base_params_version_hash=21c2cdabfa91`, `decoupled_params_hash=a99216b83551`,
  `seed_count=200`, `n_learners=5400`.
- Generated local data files exist in the dataset dir: `learners.jsonl`, `sidecars.jsonl`,
  `face_validity.json`, and `manifest.json`; the first three remain ignored by repo convention, while
  the manifest is committed.
- Full dataset has `346394` events; observed partial rate `0.2004538184841539`; observed ad-hoc rate
  `0.14957822595079592`.
- Structured validation over all learners: `bad_ratio=0` for active `activeMinutes/plannedMinutes`
  vs `r_star` at `1e-6`; `bad_duration=0`; `bad_ad_hoc=0`.
- `face_validity.json` includes `pace_ratio`, `duration`, `gaps_days`, `planned_session_minutes`,
  `material_position`, `adherence_ratio`, `partial_fraction`, `is_adhoc`, and `resolution`.

Protection checks:
- Dataset listing before R1 contained only `oulad`, frozen `synthetic-21c2cdabfa91-seed0-n5400`, older
  frozen `synthetic-e716cd12dddc-*`, and reality `synthetic-reality-*` datasets. After R1, the only added
  dataset directory is `synthetic-decoupled-9e6d48db2da8-seed0-n5400`.
- P0b default result files were not clobbered: calibration `102M Jun 30 11:48`, detection `13M Jun 30
  11:48`, projection `74M Jun 30 12:28`.
- `PARAMS_VERSION_HASH` still derives from `college/scope/archetype-preregistration.md`; calibration
  reference ids remain `synthetic-21c2cdabfa91-seed0-n5400` and
  `synthetic-reality-c545404bcacf-seed0-n5400`.

OQ-2 resolution: frozen cadence/adherence params are recorded in the new pre-reg doc. The implementation
uses 3-6 study days/week, ad-hoc target `Uniform(0.10,0.20)`, interruption target
`Uniform(0.15,0.25)`, partial fraction `Uniform(0.25,0.70)`, and dial/adherence bias
`LogNormal(mu=0,sigma=0.12)` clipped to `[0.85,1.20]`.

Deviation/reviewer flag: the first full decoupled dataset validation found 82 rounding-only
`active/planned` drift cases above the strict `1e-6` threshold. The decoupled event writer now serializes
the material denominator and active minutes at 12-decimal precision; regeneration then produced
`bad_ratio=0`. This is a serialization precision fix, not a latent-pace math change.

**Reviewer findings (2026-06-30 · Cowork/planner): ✅ VERIFIED — all six R1 acceptance criteria met.**
Independently re-checked against the repo and the generated data (not just the dev's reported numbers):

*Provenance & protection ✅*
- New dataset `synthetic-decoupled-9e6d48db2da8-seed0-n5400`: regime `decoupled`, `generator_version=0.2.0`,
  `base_params_version_hash=21c2cdabfa91` + `decoupled_params_hash=a99216b83551`, 9 archetypes × 3 bands ×
  200 = 5400. Dataset hash is **reproducible**: `sha256("21c2cdabfa91:a99216b83551")[:12] = 9e6d48db2da8`
  (matches PLAN D-01).
- `research/datasets/` diff = only the decoupled dir added; all frozen + reality datasets intact. Frozen P0
  baseline result JSONs untouched (default dirs). `PARAMS_VERSION_HASH` source unchanged;
  `calibration.py:49-50` reference ids unchanged.
- Commit `36f2718` touched **no** `pace.py`/`regimes.py`/`materials.py`/`reality.py` → latent-pace core
  preserved; `generate_decoupled_learner` reuses `latent_base`.

*Independent invariant sweep over ALL 5400 learners / 346,394 events → ZERO violations:*
- `len(r_star)==len(sessions)` (D-03): 0 bad. `all(duration>0)` (D-03): 0 bad.
- `active/planned == r_star` at 1e-6 **including partials** (D-02, the transfer-critical one): 0 bad.
- partials `0<plannedMinutes<materialChunkMinutes`: 0 bad; complete `plannedMinutes==chunk`: 0 bad.
- ad-hoc sessions fall on weekdays **outside** `study_days`: 0 bad. All four new `GroundTruth` fields
  present on every learner.
- Rates in-family: ad-hoc ≈ 0.150 (target U(0.10,0.20)); partials ≈ 0.228 of active events / 0.200 of all
  events (target interruption U(0.15,0.25)). (The dev's 0.2004 used total-events as denominator, mine 0.228
  used active — same data, different denominator; no discrepancy.)
- `SessionEvent` extended with all five fields **plus** a bonus `materialChunkMinutes` (sound addition —
  makes the partial-bounds invariant directly checkable). `face_validity.json` carries the new dists.
- Tests (`test_generator.py`, 14→ passed) assert the D-02/D-03 invariants + separate-hash/manifest/
  face-validity. The serialization-precision fix (12-dp) that cleared the 82 rounding drifts is an honest,
  correct fix — re-verified `bad_ratio=0` independently above.

OQ-2 resolved & frozen in the pre-reg doc + D-11. **R1 is done. R2/R3/R4 are cleared** (decoupled dataset,
separate `--out-dir`s, compare to the frozen P0 baseline; use `enriched_dual_prior`; R3 vs the
drift→cusum/step→page_hinkley baseline). Process note honored: marker left at 🟡 for me to flip — good.

---

## R2 — Calibration regression (transfer → re-confirm)  ✅ (reviewer-verified — Holm counts re-derived from both JSONs)
**Acceptance criteria**
- [ ] Ran on the decoupled dataset with a **separate `--out-dir`** (A-series `research/results/calibration/`
      not clobbered). Out path: `__________`
- [ ] Held-out + Holm verdict for `enriched_shrink` / `enriched_dual_prior` (the registered dual-prior
      name — see P0b sign-off) vs `hierarchical_bayes` recorded (`survives_holm_win`), compared to the P0
      baseline (both survive on the frozen baseline; goal is to confirm they still do on decoupled data).
- [ ] If degraded by partials: fallback run (down-weight/exclude) recorded; chosen inclusion policy +
      justification documented (OQ-1).
- [ ] Only **Holm-surviving** improvements reported as "wins."

**Developer notes:**
R2 implemented by Codex on 2026-06-30. Evidence/docs commit:
`51a5d4087d7353bdd4e33060a3048252fa50d415`.

Files changed for committed R2 evidence:
- `.work/plans/active/2026-06-30-research-eta-model-selection/SCRATCHPAD.md`
- `.work/plans/active/2026-06-30-research-eta-model-selection/VERIFICATION.md`

Generated result file on disk, ignored by existing repo convention:
- `research/results/calibration_decoupled/calibration_results.json` (`103M`, mtime `2026-06-30 15:02:39`)

Commands run:
```
uv run --package research-comparison python -m research_comparison.runners.calibration \
  --dataset-dir /private/tmp/study-r1-decoupled-smoke/synthetic-decoupled-9e6d48db2da8-seed0-n108 \
  --out-dir /private/tmp/study-r2-calibration-smoke --seeds 4 --quiet
uv run --package research-comparison python -m research_comparison.runners.calibration \
  --dataset-dir research/datasets/synthetic-decoupled-9e6d48db2da8-seed0-n5400 \
  --out-dir research/results/calibration_decoupled --seeds 200 --quiet
uv run --package research-comparison pytest research/comparison/tests/test_calibration_track.py -q
```
The first uv attempt hit the known sandbox cache restriction at `/Users/rsaji/.cache/uv`; escalated reruns
completed. Focused calibration tests passed: `21 passed in 1.76s`.

R2 provenance:
`dataset_id=synthetic-decoupled-9e6d48db2da8-seed0-n5400`; `scored_split=held_out`;
`generator_version=0.2.0`; `params_version_hash=9e6d48db2da8`; `seed_count=200`;
`n_learners=5400`; `bands=[small, medium, max]`; train archetypes
`crammer, marathon_runner, morning_lark, steady, steady_improver`; held-out archetypes
`deadline_sprinter, fading_flame, night_owl, weekend_warrior`.

Protection check: frozen P0b calibration anchor was not clobbered:
`research/results/calibration/calibration_results.json` remains `102M`, mtime `2026-06-30 11:48:07`.
The protected calibration reference ids in `runners/calibration.py` remain
`synthetic-21c2cdabfa91-seed0-n5400` and `synthetic-reality-c545404bcacf-seed0-n5400`.

Headline held-out means from the decoupled result:
- `recovery_mae`: max `hierarchical_bayes=0.053781208921856095`,
  `enriched_shrink=0.05796821240533966`, `enriched_dual_prior=0.05796821240533963`;
  medium `hierarchical_bayes=0.06282626722706933`, `enriched_shrink=0.0464706622090255`,
  `enriched_dual_prior=0.046470662209025446`; small `hierarchical_bayes=0.07298248820655219`,
  `enriched_shrink=0.041654466222238236`, `enriched_dual_prior=0.041654466222238166`.
- `context_pred_mae`: max `hierarchical_bayes=0.0637788512190975`,
  `enriched_shrink=0.0330672740666157`, `enriched_dual_prior=0.033067274066615714`;
  medium `hierarchical_bayes=0.06772464999821183`, `enriched_shrink=0.0409602186967752`,
  `enriched_dual_prior=0.040960218696775214`; small `hierarchical_bayes=0.07099182097701337`,
  `enriched_shrink=0.05645622275279758`, `enriched_dual_prior=0.0564562227527976`.

Holm verdict vs `hierarchical_bayes`:
- `context_pred_mae`: `enriched_shrink` and `enriched_dual_prior` both survive as Holm wins in all
  12 held-out band/archetype cells.
- `recovery_mae`: both survive as Holm wins in 8/12 cells, have one Holm-significant loss
  (`band=max|archetype=night_owl`), and three non-winning/non-significant cells. Win cells are
  max/fading_flame, max/weekend_warrior, medium/fading_flame, medium/weekend_warrior, and all four small-band
  held-out archetypes.

Comparison to the frozen P0b baseline:
- P0b `context_pred_mae` had 11/12 Holm-win cells for each enriched candidate and one small/night_owl
  Holm-significant loss; decoupled improves this to 12/12 wins.
- P0b `recovery_mae` had `enriched_shrink` 6/12 Holm-win cells and `enriched_dual_prior` 2/12; decoupled
  improves both to 8/12. Therefore the partial-included decoupled run does not degrade the transfer
  evidence relative to P0b.

OQ-1 resolution / fallback: no fallback run was executed. The inclusion policy remains **include partial
throughput points**, because the decoupled partial-included run improved or preserved the relevant
Holm-surviving evidence compared with the frozen baseline. Reporting is cell-level only: only
Holm-surviving improvements are called wins; `max/night_owl` recovery is explicitly a loss/caveat.

**Reviewer findings (2026-06-30 · Cowork/planner): ✅ VERIFIED — the calibration win TRANSFERS (and
strengthens) on the decoupled data with partial-chunk points included.** I re-derived every Holm count
directly from both result JSONs (not from the dev's summary):

*Decoupled (`research/results/calibration_decoupled/`, dataset `synthetic-decoupled-9e6d48db2da8-seed0-n5400`,
held_out, full candidate registry incl. `enriched_shrink` + `enriched_dual_prior`):*
- `context_pred_mae`: `enriched_shrink` **12/12** Holm wins, 0 losses; `enriched_dual_prior` **12/12**, 0
  losses.
- `recovery_mae`: both **8/12** Holm wins, **1** Holm-significant loss — `band=max|archetype=night_owl`.

*Frozen P0b baseline (`research/results/calibration/`), re-counted for comparison:*
- `context_pred_mae`: both 11/12 wins, 1 loss (`small|night_owl`).
- `recovery_mae`: `enriched_shrink` 6/12 wins / 6 sig-losses; `enriched_dual_prior` 2/12 / 6 sig-losses.

→ Net: context-pred 11/12 → **12/12**; recovery `enriched_shrink` 6 → **8**, `enriched_dual_prior` 2 → **8**
(and recovery sig-losses drop from 6 → 1). The transfer is confirmed and at least as strong. All dev-reported
numbers match exactly.

*Protection & method ✅:* ran to a SEPARATE out-dir; frozen anchor untouched (still 6/12 & 2/12, i.e. not
re-run/clobbered); no code change (pure re-run, correct per D-02); calibration reference ids unchanged;
21 calibration-track tests pass. OQ-1 resolved: **include** partials (the win improved, so no down-weight
fallback needed) — honest, and the `max/night_owl` recovery loss is reported as a caveat, not buried.

*Forward note for R5 / claims-ledger (not an R2 defect):* frame this as "the win **transfers and holds**,"
NOT "decoupling improves calibration" — the decoupled run is a different DGP (partials add data per
learner), so the apparent strengthening should be reported conservatively. The persistent `night_owl`
recovery weak-cell (present on both lineages) is worth a one-line caveat. **R2 done; R3 and R4 remain
(independent, either order).**

---

## R3 — Detection regression (must re-run)  ✅ (reviewer-verified — winners + Holm cells re-derived)
**Acceptance criteria**
- [ ] Ran on the decoupled dataset, separate `--out-dir`. Out path: `__________`
- [ ] `paired_vs_incumbent` / `mc_correction` vs `cusum` recorded; verdict stated: robust-null **holds** or
      **changed** (which detector / shift_type / band, Holm-surviving) vs A4.
- [ ] CUSUM tuning confirmed **train-archetypes-only** (no leakage); shift-onset mapping onto the active
      axis sanity-checked under the new cadence.

**Developer notes:**
R3 implemented by Codex on 2026-06-30. Evidence/docs commit:
`96368dea5f72ef41eb439ba1fbf434046a2da9aa`.

Files changed for committed R3 evidence:
- `.work/plans/active/2026-06-30-research-eta-model-selection/SCRATCHPAD.md`
- `.work/plans/active/2026-06-30-research-eta-model-selection/VERIFICATION.md`

Generated result file on disk, ignored by existing repo convention:
- `research/results/detection_decoupled/detection_results.json` (`13M`, mtime `2026-06-30 16:37`)

Commands run:
```
uv run --package research-comparison python -m research_comparison.runners.detection \
  --dataset-dir /private/tmp/study-r1-decoupled-smoke/synthetic-decoupled-9e6d48db2da8-seed0-n108 \
  --out-dir /private/tmp/study-r3-detection-smoke --seeds 4 --quiet
uv run --package research-comparison python -m research_comparison.runners.detection \
  --dataset-dir research/datasets/synthetic-decoupled-9e6d48db2da8-seed0-n5400 \
  --out-dir research/results/detection_decoupled --seeds 200 --quiet
uv run --package research-comparison pytest research/comparison/tests/test_detection_track.py -q
```
Also ran an inline `PYTHONPATH=research/comparison/src python3` dataset-level active-axis mapping sanity
check over all decoupled learners, reading `learners.jsonl` / `sidecars.jsonl` and calling the live
`_active_series_with_indices(...)` and `_shifts_on_active_axis(...)` helpers.

The first uv smoke attempt hit the known sandbox cache restriction at `/Users/rsaji/.cache/uv`; escalated
reruns completed. Focused detection tests passed: `8 passed in 0.93s`.

R3 provenance:
`dataset_id=synthetic-decoupled-9e6d48db2da8-seed0-n5400`; `scored_split=held_out`;
`generator_version=0.2.0`; `params_version_hash=9e6d48db2da8`; `seed_count=200`;
`n_learners=5400`; `bands=[small, medium, max]`; train archetypes
`crammer, marathon_runner, morning_lark, steady, steady_improver`; held-out archetypes
`deadline_sprinter, fading_flame, night_owl, weekend_warrior`.

Protection check: frozen P0b detection anchor was not clobbered:
`research/results/detection/detection_results.json` remains `13M`, mtime `2026-06-30 11:48`.

CUSUM tuning / leakage check:
- Live anchor verified: `run_detection_track(...)` computes the archetype split from dataset archetypes and
  calls `tune_cusum_params(learners, sidecars, split["train"])`.
- Result metadata confirms `method=grid_search_train_archetypes_only`, train archetypes as above, selected
  params `{step_k: 0.45, step_h: 3.5, drift_k: 0.15, drift_h: 4.5}`.
- Existing train-only tuning regression test passed in `test_detection_track.py`.

Active-axis mapping sanity check under the decoupled cadence:
- Live anchor verified: `_active_series_with_indices(...)` reads only `source=="active"` sessions with
  `plannedMinutes>0` and uses `activeMinutes/plannedMinutes`; `_shifts_on_active_axis(...)` maps each raw
  regime onset to the first active original event index at or after that onset.
- Full dataset check over all `5400` learners: `raw_shifts=1720`, `mapped_shifts=1720`,
  `unmapped_tail_shifts=0`, `bad_mappings=0`. No focused code test was added because the existing ordering
  logic still matched the new cadence and the dataset-level sanity check found no changed ordering.

Headline decoupled result:
- Winner by shift type: `cusum` wins both `drift` and `step`. This changes the P0b baseline shape, where
  drift→`cusum` but step→`page_hinkley`.
- Drift `cusum`: latency `2.294314381270903`, false alarm `0.19204096308226398`, missed `2.0`, score
  `207.09533845832752`.
- Step `cusum`: latency `1.375`, false alarm `0.17977427274222404`, missed `0.0`, score
  `5.869356818555601`. Step `page_hinkley` score is `6.502785692486437`.

Overall paired deltas vs `cusum`:
- drift/csd delta `52.24497139273184`, p `4.151920318569917E-74`.
- drift/page_hinkley delta `11.683183504703685`, p `3.555715731555795E-9`.
- step/csd delta `2.962598976218512`, p `0.0831041143117605`.
- step/page_hinkley delta `0.633428873930836`, p `0.0000820270265637579`.

Cell-level Holm-surviving wins vs `cusum`:
- `band=max|archetype=fading_flame|shift_type=drift`, `page_hinkley`, delta
  `-0.906571126069164`, p `7.977878181339604E-8`.
- `band=medium|archetype=fading_flame|shift_type=drift`, `csd`, delta
  `-2.74707349251134`, p `3.6834168178369585E-29`.
- `band=medium|archetype=fading_flame|shift_type=drift`, `page_hinkley`, delta
  `-1.9542051530171258`, p `2.0362612193628E-27`.

Verdict against the P0b baseline shape: **changed, and more CUSUM-favoring under the decoupled cadence.**
P0b had drift→`cusum`, step→`page_hinkley`, with `csd`/`page_hinkley` Holm-surviving on fading_flame
max-drift, max-step, and medium-drift cells. Decoupled has drift→`cusum`, step→`cusum`; only the
fading_flame drift cells at max/medium retain Holm-surviving `csd`/`page_hinkley` wins. The pure-null
strawman remains false at cell level, but no deployable detector displaces CUSUM overall on the decoupled
track, and no step-cell Holm win survives.

**Reviewer findings (2026-06-30 · Cowork/planner): ✅ VERIFIED.** Re-derived from
`research/results/detection_decoupled/detection_results.json` (decoupled n5400, held_out):
- `winner_by_shift_type`: drift→`cusum`, **step→`cusum`** (changed from P0b step→`page_hinkley`).
- Holm-surviving deployable wins vs `cusum` = exactly **3 cells**: `page_hinkley` max/fading_flame/drift,
  and `csd`+`page_hinkley` medium/fading_flame/drift. All other deployables ≤ cusum. Matches dev report.
- Frozen P0b anchor intact (`research/results/detection/`, still drift→cusum/step→page_hinkley, hash
  21c2cdabfa91). Separate out-dir used; CUSUM tuned train-archetypes-only
  (`grid_search_train_archetypes_only`); active-axis onset mapping clean over all 5400 learners
  (1720/1720 mapped, 0 bad). 8 detection-track tests pass.
- Verdict accurate & honest: under the noisier decoupled cadence the result becomes **more
  CUSUM-favoring** — the step-band `page_hinkley` edge from A4/P0b disappears; only the `fading_flame`
  drift cells retain non-CUSUM Holm wins. Good framing for R5 (state vs A4/P0b, not vs a pure-null).

---

## R4 — ETA benchmark (HEADLINE)  ✅ (reviewer-verified — Holm verdict + forecaster code re-checked)
**Acceptance criteria**
- [ ] `forecast_analytic_required_rate` + `forecast_gp_plus_analytic` added to `baselines/projection.py`
      (correct signature + return shape); both registered in `projection_candidates()` (runners/projection.py).
- [ ] No `tf` double-count (analytic implemented in actual-minutes currency per PLAN R4 note).
- [ ] Ran full decoupled dataset, separate `--out-dir`. Out path: `__________`
- [ ] Per-band coverage / MAE-days / sharpness recorded for `gp_ard`, `analytic_required_rate`,
      `gp_plus_analytic`; **paired-Holm vs `gp_ard`** with `survives_holm_win`.
- [ ] **Explicit verdict sentence:** does the composite (and/or analytic) beat `gp_ard` under held-out +
      Holm, on which bands? → `__________`
- [ ] R4a cold-start eval recorded (composite vs `gp_ard` at small `t`).
- [ ] R4b reference-line eval done **or** explicitly logged as deferred.
- [ ] Oracles still treated as upper bounds only.
- [ ] New-forecaster tests added (shape, cold-start switch, non-crossing rescue).

**Developer notes:**
R4 implemented by Codex on 2026-06-30. Code/tests commit:
`7f97a3cb43be764e250ca5243d8dc7cfc4b295fa`.

Files changed for R4 code/tests:
- `research/comparison/src/research_comparison/baselines/projection.py`
- `research/comparison/src/research_comparison/runners/projection.py`
- `research/comparison/tests/test_projection_track.py`

Files changed for committed R4 evidence:
- `.work/plans/active/2026-06-30-research-eta-model-selection/SCRATCHPAD.md`
- `.work/plans/active/2026-06-30-research-eta-model-selection/VERIFICATION.md`

Generated result file on disk, ignored by existing repo convention:
- `research/results/projection_decoupled/projection_results.json` (`132M`, mtime `2026-06-30 17:25`)

Commands run:
```
uv run --package research-comparison pytest research/comparison/tests/test_projection_track.py -q \
  -k 'analytic_required_rate or gp_plus_analytic or projection_candidates'
uv run --package research-comparison pytest research/comparison/tests/test_projection_track.py -q
uv run --package research-comparison python -m research_comparison.runners.projection \
  --dataset-dir /private/tmp/study-r1-decoupled-smoke/synthetic-decoupled-9e6d48db2da8-seed0-n108 \
  --out-dir /private/tmp/study-r4-projection-smoke --seeds 4 --quiet
uv run --package research-comparison python -m research_comparison.runners.projection \
  --dataset-dir research/datasets/synthetic-decoupled-9e6d48db2da8-seed0-n5400 \
  --out-dir research/results/projection_decoupled --seeds 200 --quiet
```

The focused test command was red first at collection because the new forecaster imports were not yet
implemented, then green after implementation: `4 passed, 9 deselected`. Full projection tests passed:
`13 passed in 97.47s`. Smoke projection wrote
`/private/tmp/study-r4-projection-smoke/projection_results.json`. The full benchmark wrote
`research/results/projection_decoupled/projection_results.json`.

R4 implementation notes:
- Added `forecast_analytic_required_rate(...)` in actual-minutes currency:
  `consumed_actual / elapsed_days` for effective daily rate and `remaining_actual / effective_daily`
  for days left. No throughput-factor multiplication is applied.
- Added `forecast_gp_plus_analytic_finish(...)`: cold-start fallback when `len(sessions) < COLD_START_N`,
  GP non-crossing rescue when the GP predicted finish reaches `horizon_end_date`, otherwise GP point + CI.
- Registered `analytic_required_rate` and `gp_plus_analytic` in `projection_candidates()`.
- Set `COLD_START_N=5` and extended `default_t_grid` with `t=3`; the payload now includes
  `cold_start_eval`.
- `reference_line_eval` is present with `status="deferred"` and options
  `linear_to_deadline` / `capacity_shaped` per PLAN D-07's lower-priority allowance.

R4 provenance:
`dataset_id=synthetic-decoupled-9e6d48db2da8-seed0-n5400`; `scored_split=held_out`;
`generator_version=0.2.0`; `params_version_hash=9e6d48db2da8`; `seed_count=200`;
`n_learners=5400`; `bands=[small, medium, max]`; train archetypes
`crammer, marathon_runner, morning_lark, steady, steady_improver`; held-out archetypes
`deadline_sprinter, fading_flame, night_owl, weekend_warrior`.

Protection check: frozen P0b projection anchor was not clobbered:
`research/results/projection/projection_results.json` remains `74M`, mtime `2026-06-30 12:28`.

Per-band held-out metrics (coverage / MAE-days / sharpness):
- max: `gp_ard=0.18305555555555553 / 39.53 / 7.955416666666666`;
  `analytic_required_rate=0.16652777777777777 / 53.18875 / 6.948472222222222`;
  `gp_plus_analytic=0.1948611111111111 / 52.10486111111111 / 10.707083333333333`.
- medium: `gp_ard=0.2765178571428571 / 15.331294642857141 / 4.715133928571428`;
  `analytic_required_rate=0.2524330357142857 / 17.462477678571428 / 4.786852678571428`;
  `gp_plus_analytic=0.2912053571428571 / 17.099375 / 6.221741071428571`.
- small: `gp_ard=0.49370833333333336 / 2.3605625 / 1.6494375`;
  `analytic_required_rate=0.5541875 / 2.6165208333333334 / 2.5414375000000002`;
  `gp_plus_analytic=0.5516041666666667 / 2.1386041666666666 / 2.2782291666666667`.

Band-level paired deltas vs `gp_ard`:
- max: analytic delta `13.813958333333332` (p `1.497639506256032E-18`), composite delta
  `12.484322222222222` (p `1.6136722359015614E-15`) — both worse.
- medium: analytic delta `2.3727484375` (p `6.367674123357731E-9`), composite delta
  `1.6362714285714284` (p `0.00001775162459571553`) — both worse.
- small: analytic delta `-0.22866333333333327` (p `0.12866069027806384`) — not significant;
  composite delta `-0.72837875` (p `6.345483612505526E-28`) — better.

Cell-level Holm verdict vs `gp_ard`:
- `gp_plus_analytic` survives as a Holm win in all four small held-out cells:
  `small|deadline_sprinter` delta `-0.6706508333333332` (p `3.102292811909608E-7`),
  `small|fading_flame` delta `-0.6304708333333333` (p `6.697666051794205E-8`),
  `small|night_owl` delta `-0.8604408333333333` (p `4.817884368561571E-10`),
  `small|weekend_warrior` delta `-0.7519525` (p `7.192617306070427E-10`).
- `analytic_required_rate` has no Holm-surviving wins. Its small-band deltas are directionally better but
  non-significant; max is worse in all four cells, and medium has three Holm-significant losses.
- `gp_plus_analytic` has Holm-significant losses in all max cells and non-significant worse deltas in all
  medium cells.

Explicit headline verdict: **`gp_plus_analytic` beats `gp_ard` under held-out + Holm on the small band
only. It does not beat `gp_ard` on medium or max. `analytic_required_rate` does not beat `gp_ard` under
Holm on any band.** Oracles remain upper bounds only and are not reported as method wins.

R4a cold-start (`t=3`, held-out only):
- max: `gp_ard=coverage 0.0125, MAE 57.73375, sharpness 1.03125`;
  composite/analytic `coverage 0.07, MAE 82.22625, sharpness 14.70875`.
- medium: `gp_ard=coverage 0.03375, MAE 26.845, sharpness 1.18875`;
  composite/analytic `coverage 0.13375, MAE 30.7325, sharpness 9.3375`.
- small: `gp_ard=coverage 0.185, MAE 5.095, sharpness 1.4425`;
  composite/analytic `coverage 0.43875, MAE 4.075, sharpness 4.2525`.

R4b reference-line eval: explicitly deferred in the payload with reason
`R4 prioritized candidate selection and cold-start scoring; linear-to-deadline vs capacity-shaped
reference-line evaluation is lower-priority per PLAN D-07.`

Deviation/reviewer flag: full R4 benchmark was long (`~36` minutes Python CPU) because the composite
currently calls GP independently to determine non-crossing instead of reusing the already-computed
`gp_ard` forecast for the same learner/t. This affects runtime only; tests and full benchmark completed.

**Reviewer findings (2026-06-30 · Cowork/planner): ✅ VERIFIED — headline result confirmed, honestly
reported, no overclaim.** Re-derived from `research/results/projection_decoupled/projection_results.json`
(decoupled n5400, held_out) and re-read the forecaster code (commit `7f97a3c`):

*Holm verdict vs `gp_ard` (12 held-out band/archetype cells), independently counted:*
- `gp_plus_analytic`: **4 Holm wins — all 4 SMALL-band cells** (deadline_sprinter, fading_flame, night_owl,
  weekend_warrior); **4 significant losses (all max cells)**; medium not significant.
- `analytic_required_rate`: **0 Holm wins anywhere; 7 significant losses.**
- `winner_by_band` is `oracle_projection` on all bands (upper bound — correctly not claimed as a method win).
All numbers match the dev's report.

*Code ✅:* `forecast_analytic_required_rate` is pure actual-minutes
(`days_left = remaining_actual / effective_daily`) — **no throughput-factor multiplication, no
double-count** (PLAN R4 honored). Composite = cold-start(`<COLD_START_N=5`)→analytic, GP-non-crossing
(`gp_finish >= horizon_end`)→analytic rescue, else GP. `default_t_grid` extended with `t=3`;
`cold_start_eval` present; `reference_line_eval` present with `status="deferred"` (allowed per D-07, logged
not dropped). New forecaster tests added; 13 projection-track tests pass. Separate out-dir; frozen
projection anchor intact (hash 21c2cdabfa91, old candidate set).

*HEADLINE VERDICT (decision-relevant — this is what #3 hinges on):* the proposed #3 ETA composite
`gp_plus_analytic` **beats the `gp_ard` incumbent under held-out + Holm on the SMALL band only** (the
low-data / cold-start regime — exactly where the analytic fallback is designed to help), and is
**significantly worse on max**; the pure `analytic_required_rate` never wins. So #3 is **partially
validated, not a general win.** Honest framing for R5/DECISIONS: keep #3 at 🟡→ "qualified" — the composite
is justified as a **cold-start / small-plan fallback layered on GP**, NOT as a replacement for GP on
data-rich plans (where `gp_ard`/`conformal` remain better; recall conformal is the coverage fix). The
product can still ship the composite (GP everywhere + analytic at cold start), but the dissertation must
state the benefit as regime-specific.

*Non-blocking notes:* (1) runtime ~36 min because the composite recomputes GP independently instead of
reusing the runner's `gp_ard` forecast — pure optimization opportunity if R4 is ever re-run, not a
correctness issue. (2) R4b reference-line is deferred — fine for now, but R5/dissertation will want it
eventually to justify the displayed ideal line. **R4 done. R5 (rigour parity + claims-ledger) and R6
(N=1) remain.**

---

## R5 — Rigour parity + claims ledger  ✅ (reviewer-verified — all three docs read against the evidence)
**Acceptance criteria**
- [ ] R2/R3/R4 protocol matches the A-series projection config recorded in P0 (D-05); provenance hashes
      stamped in each result JSON.
- [ ] `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md` appended: calibration source-change +
      transfer status; partial-inclusion caveat + policy; detection re-run verdict; ETA verdict to the
      strength Holm supports.
- [ ] Comparability doc (frozen vs decoupled headline per track) written under `research/doc/`.
- [ ] DECISIONS.md change log updated: #3 flipped to locked-claimable **or** kept 🟡 per evidence.

**Developer notes:**
R5 implemented by Codex on 2026-06-30. Evidence/docs commit:
`8ae07b4e0d614cc97d8e386478c1a561fbb36727`.

Files changed for R5:
- `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`
- `research/doc/2026-06-30-frozen-vs-decoupled-comparability.md`
- `.work/plans/active/2026-06-30-material-session-decoupling/DECISIONS.md`
- `.work/plans/active/2026-06-30-research-eta-model-selection/SCRATCHPAD.md`
- `.work/plans/active/2026-06-30-research-eta-model-selection/VERIFICATION.md`

R5 is docs-only. No new benchmark was run and no code/test was authored for this phase.

Protocol parity confirmed from stamped JSONs:
- Frozen P0b anchor: `research/results/{calibration,detection,projection}/*_results.json` from
  `synthetic-21c2cdabfa91-seed0-n5400`.
- Decoupled R2/R3/R4 results:
  `research/results/calibration_decoupled/calibration_results.json`,
  `research/results/detection_decoupled/detection_results.json`, and
  `research/results/projection_decoupled/projection_results.json`, all from
  `synthetic-decoupled-9e6d48db2da8-seed0-n5400`.
- All six result JSONs stamp the parity protocol: 200 seeds, 5400 learners, 9 archetypes, 3 bands,
  `scored_split=held_out`, train archetypes `crammer, marathon_runner, morning_lark, steady,
  steady_improver`, and held-out archetypes `deadline_sprinter, fading_flame, night_owl,
  weekend_warrior`.
- Live rigour anchors re-checked: `DEFAULT_SEED_COUNT=200`; held-out split uses the same 5 train
  archetypes; `paired_metric_result(...)` writes bootstrap `delta_ci_low` / `delta_ci_high`; correction
  blocks set `primary="holm_bonferroni"` and `reported="benjamini_hochberg"`.

Claims-ledger updates:
- Added `Material/session decoupling validation (R2-R4, 2026-06-30)` to
  `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`.
- Calibration framing: `planned` changed source (slot chunk -> material throughput), but signal shape is
  identical; `enriched_shrink` and `enriched_dual_prior` transfer and hold with partials included
  (`context_pred_mae` 12/12; `recovery_mae` 8/12). It explicitly avoids claiming that decoupling improves
  calibration and records the `max|night_owl` recovery loss.
- Detection framing: verdict stated against the A4/P0b shape, not a pure-null strawman. Decoupled is more
  CUSUM-favoring: drift -> `cusum`, step -> `cusum`; only fading-flame drift cells retain non-CUSUM
  Holm wins.
- ETA framing: `gp_plus_analytic` is qualified to the small/cold-start regime only. It beats `gp_ard`
  on small held-out cells, loses on max, and `analytic_required_rate` never wins. `gp_ard` / conformal
  remain the data-rich-plan story, with conformal as the coverage fix.

Comparability doc:
- Wrote `research/doc/2026-06-30-frozen-vs-decoupled-comparability.md` with protocol table, frozen vs
  decoupled headline numbers per track, and claim-discipline wording.

DECISIONS update:
- Updated material/session `DECISIONS.md` open question #3 and change log to mark #3 as **🟡 QUALIFIED**
  rather than locked/proven as a GP replacement: small-plan / cold-start benefit proven, not a general win.

Commands / checks run:
- `jq` protocol/correction extraction over frozen and decoupled calibration/detection/projection JSONs.
- `rg` / `sed` checks over `research/comparison/src/research_comparison/{runners,metrics}/rigour.py` and
  result-writer/runner provenance call sites.
- `git diff --check` → passed.
- `git diff --cached --check` → passed.

Deviation: none. This phase intentionally ran no new benchmark per the R5 instructions.

**Reviewer findings (2026-06-30 · Cowork/planner): ✅ VERIFIED — all four acceptance criteria met; the
docs match the evidence and do NOT overclaim.** I read the rendered content of all three artifacts (not
just the dev summary):

- *Parity (D-05):* both anchor and decoupled JSONs stamp the same protocol — 200 seeds / 5400 / 9 arch /
  3 bands / held-out (5 train, 4 held) / Holm-primary + BH-reported / bootstrap Δ-CIs. Parity is correctly
  on the PROTOCOL (decoupled is its own DGP/hash by design). ✓
- *Claims-ledger* (`research/doc/2026-06-18-...md`, new "Material/session decoupling validation (R2-R4)"
  section + changelog row): calibration framed "holds, not improves" with the `max|night_owl` caveat and
  partials-included external-validity note; detection stated vs A4/P0b (more CUSUM-favoring, step→cusum,
  3 fading_flame drift exceptions); **ETA #3 = qualified, small-band only, `analytic` never wins, conformal
  = coverage fix.** Every number matches my independent R2/R3/R4 counts. No Holm-loss dressed as a win. ✓
- *Comparability doc* (`research/doc/2026-06-30-frozen-vs-decoupled-comparability.md`): protocol table +
  per-track frozen-vs-decoupled Holm tables, all matching the result JSONs; claim-discipline TL;DR correct. ✓
- *DECISIONS.md*: #3 flipped to **🟡 QUALIFIED by R4** with the exact "cold-start/small-plan fallback
  layered on GP, not a general GP replacement" wording + dated change-log entry. Correctly NOT locked. ✓

Docs-only phase; no code/benchmark; `git diff --check` clean. (Minor: the ledger cites an R4 follow-up
commit `7d55bc1` alongside `7f97a3c` — not part of R5, no impact on this verdict.)

**R5 done. Only R6 (N=1 real-data circularity guard) remains** — note its PLAN/​prompt availability gate:
if no real N=1 logged sessions exist, the executor must stop and ask, not fabricate.

---

## R6 — N=1 real-data circularity guard (Research Phase 5)  ⏸ DEFERRED — blocked on real N=1 data (2026-06-30)
**Acceptance criteria**
- [ ] (DEFERRED) Partial-session throughput `active/(position×chunk)` from real N=1 data compared to the
      synthetic partial distribution (in-family or flagged).
- [ ] (DEFERRED) ETA candidates run on the real burn-up curve; finish-date error reported **descriptively**
      (N=1, no significance / no algorithm-superiority claim).
- [ ] (DEFERRED) Descriptive bounds only — **no** synthetic parameter tuned to real data (circularity guard).
- [ ] (DO NOW — does not need data) Write-up **stub** under `research/doc/` with the protocol + **explicit
      non-claims** + "execution pending real N=1 data"; check `college/scope/research-tasklist.md` P5.6
      (write-up stub) and leave P5.1–P5.5 open.

**Planner decision (2026-06-30 · Cowork, confirmed by Rohit):** **No N=1 real logged sessions exist yet**,
so R6's data-dependent core (partial-throughput overlay, ETA-on-real, descriptive bounds) is **DEFERRED**,
NOT executed and NOT fabricated. This is the correct call — synthetic scoring is model-dependent and the
guard is meaningless without real data.
- **Unblocks when:** real session logs are captured (e.g. the candidate's own usage via
  `research/comparison/scripts/capture_evidence.py`, or pilot users). Then run R6 as specified.
- **Do now (non-fabricating):** the executor may write the **stub** doc (protocol + explicit non-claims +
  pending-data status) and tick P5.6 only. Leave R6's marker DEFERRED until the data exists; do not flip ✅.
- **Consequence for the dissertation (already hedged):** external validity of the *new event types*
  (esp. interrupted/partial throughput) rests on the synthetic generator alone until R6 runs. The
  claims-ledger's partials "external-validity caveat" (R5) **carries this** — keep it; do not soften it.

**Developer notes:**

**Reviewer findings:**

---

## Cross-cutting checks (reviewer, at wrap)
- [ ] Scheduling track **not run / not extended** (§5c dropped).
- [ ] No edits to `apps/ packages/ e2e/ services/`; only `research/`, `college/scope/` pre-reg + docs, plan docs.
- [ ] No A-series dataset/result overwritten; reference dataset ids in `calibration.py` intact.
- [ ] Every "win" in the write-up is Holm-surviving; degradations reported honestly.
- [ ] Open questions OQ-1..OQ-4 resolved here (not silently).
