# Handover → next session: A6 calibration DONE (verified), detection design-probe = honest null, next = write Phase 6

**Date:** 2026-06-19 · **From:** Cowork planning/review agent · **For:** a fresh Cowork session
**Plan this continues:** [`../plans/active/2026-06-18-pillar-a-custom-calibration-detection/PLAN.md`](../plans/active/2026-06-18-pillar-a-custom-calibration-detection/PLAN.md) + its `VERIFICATION.md`

---

## TL;DR / where things stand

- **Calibration (A6 Phases 1–5): built by Codex, reviewed by Cowork, all `✅ Verified`.** The custom `enriched_shrink` calibrator is a **real, honest, Holm-surviving held-out win on `context_pred_mae`** that **holds on the reality regime** — it overturns the prior calibration null. The archetype-aware variants do **not** beat it (reported honestly). One small documentation fix is still pending (OQ-03 ledger caveat — see below).
- **Change detection (Phase 6): design pressure-tested via a Cowork simulation probe only — NOT yet in the real harness.** After two comprehensive probe runs (+ a GLR detector and a repaired union), the result is a **robust null: no unified detector dominates the CUSUM/CSD Pareto frontier.** Recommendation on the table: **accept the null and write the Phase 6 plan around it.**
- **Decision pending from the user:** (a) write the Phase 6 PLAN+VERIFICATION around the honest null (Cowork's recommendation), or (b) park detection and ship calibration as the headline. The user has not yet answered this; it is the exact entry point for the next session.

---

## 1. Calibration (Phases 1–5) — verified; the numbers

Reviewed against the committed diffs + stamped evidence; findings written into `VERIFICATION.md` (all five phases `✅ Verified`).

- **Dataset v2 (Phase 2):** archetypes extended 6→9 (`night_owl`, `crammer`, `steady_improver`), pre-registration re-frozen → `PARAMS_VERSION_HASH = 21c2cdabfa91`. Datasets: frozen `research/datasets/synthetic-21c2cdabfa91-seed0-n5400`, reality `research/datasets/synthetic-reality-c545404bcacf-seed0-n5400`. TRAIN = `steady, morning_lark, marathon_runner, crammer, steady_improver`; HELD-OUT = `deadline_sprinter, fading_flame, night_owl, weekend_warrior`. An observable `planned_horizon` field was added to the learner record (deadline date + planned_total_sessions) — plan-side, not truth.
- **`enriched_shrink` (Phase 3):** features = ρ/τ/ν + `same_day_count` (fatigue) + deadline-proximity (from `planned_horizon`) + recency, fit per-learner with partial-pooling shrinkage toward a TRAIN-only population prior `(XᵀX+ridge+shrink·I)β = Xᵀy+shrink·prior`. **Held-out `context_pred_mae`: Holm-surviving vs the incumbent (11/12 frozen), vs `pooled_bayes` (11/12 frozen, 9/12 reality), vs `ewma` (11/12 frozen, 5/12 reality). Holds on reality.** Max-band MAE ≈0.074 vs pooled ≈0.104.
- **Archetype variants (Phase 4):** hard router + soft, built as routed **priors** (not fixed shapes, per D-05). They do **not** beat `enriched_shrink` (frozen drift router 3 wins / 8 significant not-wins; soft 0 reality wins). Honest non-recommendation — matches the design-probe prediction that the membership layer adds ~nothing over shrinkage.
- **Decision (Phase 5):** recommend `enriched_shrink`; do not recommend the archetype layer; `recovery_mae` mixed and not the headline. Evidence: `research/doc/verification-runs/2026-06-19-a6-final/{evidence.json,SUMMARY.md}`. Commits: `83bcede` (P1), `02cedbc` (P2), `8545481` (P3), `a919ea4` (P4), `922c64e` (P5).
- **Integrity confirmed by review:** no generator-truth import in `baselines/`; observable-only `predict_next`; λ/shrink/temperature tuned on **held-out-TRAIN only** (provenance `fit_on_train_archetypes_only`); genuine no-leakage test; additive.

### ⚠️ Pending calibration loose ends (do these next session before closing calibration)

1. **OQ-03 ledger caveat (Phase 5, required doc fix).** Add to `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`: on the **frozen** regime `planned_total_sessions ≡ realized count` (deadline feature is "over-clean"); the deadline-feature claim is defensible because it **holds on reality, where dropout makes `planned ≠ observed`** — so lead the deadline claim with the reality result. Phase 5 is `✅ Verified` *conditional on this addition*.
2. **Uncommitted Cowork edits.** The reviewer-findings I wrote into `VERIFICATION.md` (Phases 1–5) are in the working tree, unstaged. Per Rule 3 Cowork cannot commit; **Codex's next Step 0 must commit them** (`docs(review): A6 calibration phases 1-5 verified`).
3. **Process note for Phase 6:** the Phase-2 pre-registration review gate was bypassed in the batch run (Codex regenerated before Cowork sign-off). I verified the params/split retroactively (they match the agreed design), so it stands — but **restore the stop-gate for Phase 6's dataset change.**

---

## 2. Change detection — design probe outcome (honest null)

Detection is **deferred Phase 6** in the plan and was only **pressure-tested via a Cowork simulation probe** this session — *nothing has been added to the real harness yet*.

### Decisions reached this session

- **Dataset (Option A, agreed):** balance shift types across the train/held-out split — `steady_improver`'s slow rise becomes a **train-side DRIFT example**, `night_owl` stays a **no-shift false-alarm control**. This fixes the "drift only exists in held-out `fading_flame`" trap (the detection analog of the calibration deadline-ramp trap). **Not yet implemented** in the generator — it's a Phase-2-style re-freeze that Phase 6 must do first.
- **Model ask (from user):** a *unified* detector that fuses the field's strengths into one mathematical model, not a bake-off of separate algorithms.

### What was built in the probe + the result

Probe script (standalone, **scratchpad only**): `unified_detector_sim.py`, `VERSION = "a6-detsim-v2"`. Self-identifying header (must read `a6-detsim-v2` and `detectors (12): … unified_glr` — earlier reviews were polluted by a **stale copy at `research/scripts/unified_detector_sim.py`**; beware that desync). Comprehensive run: 1500 train / 1500 test, 5 reps, 600 learner-bootstraps, both regimes, thresholds + secondary knobs tuned on TRAIN only, no leakage, per-shift-type Pareto frontiers, dominance = fraction of the cusum+csd frontier matched/beaten with bootstrap CIs.

Unified candidates tried: `unified_gate` (AR(1)-whiten + CUSUM/PH max-fusion + CSD-gated adaptive threshold), `unified_two_stage` (CSD proposes → whitened-CUSUM confirms), `unified_full` (union of fast + drift paths, repaired so its FAR floor is no longer pinned), `unified_glr` (windowed step+drift Generalized Likelihood Ratio on whitened residuals — the principled one).

**Verdict (robust across two comprehensive runs): NO unified detector dominates the CUSUM/CSD frontier**, on either regime or shift type. Sub-findings, all honest:

- **AR(1)-whitening does NOT help** — `unified_gate` 7.48 vs `unified_gate_nowhiten` 7.30 (frozen), 56.17 vs 56.02 (reality): consistently slightly worse. The headline "fix the noise model" lever fails here.
- **GLR is low-false-alarm but SLOW** — `unified_glr` reaches FARs below CUSUM's floor but with ~+3 sessions latency at matched FAR; dom_frac ≈ 0. The "GLR improves the low-FAR end" hypothesis is **falsified**.
- **Only modest partial drift gains (real, CI excludes 0, far from dominance):** `unified_two_stage` frozen drift dom_frac 0.26 CI [0.19, 0.38]; repaired `unified_full` frozen drift 0.13 CI [0.06, 0.20] (faster where it competes). Step: none. Reality: none.
- **Reality drifts are undetectable by EVERYONE** (all reality-drift dominance rows `n/a` — CUSUM/CSD themselves miss them; the multi-shift reality drifts are below the detection floor).
- `page_hinkley` is "best" on the aggregate comp score, but that score under-weights false alarms; under the Pareto/dominance lens (the brief's actual bar) nothing dominates.

This **reinforces the prior A4/A5 conclusion** ("Pareto frontier, no single dominating method") with the new candidates, and is the detection-side echo of the calibration archetype-layer null.

### Probe artifacts (for reference)

- Script: `unified_detector_sim.py` (`a6-detsim-v2`) — canonical copy in the Cowork outputs scratchpad; a stale copy sits at `research/scripts/`.
- Latest results (the correct v2 run): repo-root `../archive/unified_detector_summary.md` + `../archive/unified_detector_results.json`.

---

## 3. Exact next entry point

**First, get the user's decision** (the open question I left them with): accept the detection null and write Phase 6, or park detection?

**If proceeding to write Phase 6** (Cowork's recommendation), the PLAN + VERIFICATION should follow the same build→test→review loop and cover:

1. **Dataset re-freeze (Option A)** — a pre-registration act (honor the stop-gate this time): make `steady_improver` carry a labelled train-side drift in the regime schedule, keep `night_owl` a no-shift control; re-freeze pre-registration; regenerate; re-verify reality moment-bounds. (Mirror calibration Phase 2.) Note: this re-hashes `PARAMS_VERSION_HASH` again — confirm whether to fold it into the existing v2 hash or a v3.
2. **Additive detection candidates in the real harness** (`research/comparison/src/research_comparison/baselines/detection.py`, registered in `runners/detection.py` `detection_candidates()` and added as a Pareto-probe family in `_pareto_probe_rows`): the two with any signal — an **AR(1)-whitening front-end** and the **two-stage (CSD-propose / whitened-CUSUM-confirm)** detector — plus optionally GLR as an additive candidate. Score vs `cusum` under `mc_correction`.
3. **Score under the rigour protocol** (200 seeds, held-out, Holm) on frozen + reality; emit `evidence.json` + `SUMMARY.md`.
4. **Expected close = honest null**: report the latency↔false-alarm **Pareto frontier + per-shift-type winners** (drift→cusum; step→page_hinkley/csd), the **modest partial drift gain** from the fused detectors, and the **three negatives** (whitening, GLR, no-dominance), plus the **reality-drift-undetectable** finding. Set the success bar as the brief's: a fused operating point that *dominates* the frontier, Holm-surviving on held-out — which the probe predicts will not be met. A null is the legitimate, expected result.

**Do NOT** keep iterating the unified detector to manufacture a dominating point — the principled options the brief named (two-stage, AR(1)-whitening, GLR, BOCPD-AR1) have been exhausted; the frontier split (CUSUM owns low-FAR, CSD owns fast-mid) and the undetectable reality drifts look intrinsic. Further fishing is the exact failure this track exists to prevent.

---

## 4. Reference paths

- Plan + verification: `plans/2026-06-18-pillar-a-custom-calibration-detection/{PLAN.md,VERIFICATION.md}`
- Calibration final evidence: `research/doc/verification-runs/2026-06-19-a6-final/{evidence.json,SUMMARY.md}` (+ per-phase dirs `…-a6-{baseline,dataset-v2,enriched,archetype}`)
- Claims ledger (needs OQ-03 caveat added): `research/doc/2026-06-18-pillar-a-report-claims-and-caveats.md`
- Detection design briefs: `2026-06-18-pillar-a-custom-algorithms-handover.md` (failure modes + detector options), `../prompts/2026-06-19-archetype-aware-calibrator-prompt.md` (calibration prompt)
- Detection harness to extend (Phase 6): `research/comparison/src/research_comparison/baselines/detection.py`, `runners/detection.py`, `metrics/detection.py`
- Detection probe + results: `unified_detector_sim.py` (`a6-detsim-v2`, scratchpad), repo-root `unified_detector_{summary.md,results.json}`
- Generator truth (read-only): `research/comparison/src/research_comparison/generator/{regimes,reality,pace,effects,noise}.py`; `params.py`; `college/scope/archetype-preregistration.md`
