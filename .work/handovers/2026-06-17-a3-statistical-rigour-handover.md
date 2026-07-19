# Handover → Codex (new session): Phase A3 — statistical rigour (PA+.3)

**Date:** 2026-06-17 · **From:** Cowork planning/review agent · **For:** a fresh Codex (gpt-5.5) session
**Plan:** [`../plans/active/2026-06-14-pillar-a-rigour.md`](../plans/active/2026-06-14-pillar-a-rigour.md) · **Checklist (your scorecard):** [`../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md`](../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md) → criteria **A3.1–A3.7**

> You are the **implementing** agent. The plan is the source of truth; this is your entry point and the rules of engagement. Read the plan's operating-manual preamble, then Phase A3, then the VERIFICATION A3 criteria. Do not re-plan — if reality contradicts a step, set the phase `🛑 Blocked: <reason>` and hand back.

## Orientation (this repo's workflow)

- Two environments, hard split: the **clean `uv` workspace `research/comparison`** (all your work) imports `py-progress`/`py-roadmap-engine` as peer candidates; the isolated `research/kt-bench` is **off-limits** here.
- The work is plan-driven and reviewed: you implement a phase, fill your section of `VERIFICATION.md`, commit, and a reviewer checks the diff against the acceptance criteria. **A phase is not done until the reviewer marks it `✅ Verified`.**
- Phases A0, A1, A2 are already `✅ Verified`. A1's projection-coverage *achievement* was deferred into A3 as **A3.7** (decision **D-A6**); A2 was re-scoped to context-aware prediction (decision **D-A7**) and verified.

## Step 0 — before any code: commit the pending review docs

A reviewer's A2 verdict is sitting uncommitted in the working tree. Establish the baseline first so later diffs are clean:

```bash
git status                       # expect modified: ../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md
git add ../plans/active/2026-06-14-pillar-a-rigour-VERIFICATION.md
git commit -m "docs(review): A2 verified (D-A7)"
```

(If `git status` shows nothing to commit, it was already committed — proceed.) Do **not** stage `.codex/**`.

## What A3 is

Make every Pillar-A "winner" claim defensible: more seeds, confidence intervals on the deltas, an honest held-out-tuning protocol, and multiple-comparison correction — across all four tracks (calibration, detection, projection, scheduling) — **plus** the across-learner conformal coverage carried from A1. The rigour utilities already exist in `research/comparison/src/research_comparison/metrics/rigour.py` (shipped in A0): `bootstrap_delta_ci`, `holm_bonferroni`, `benjamini_hochberg`, `heldout_archetype_split`. **Use them; do not re-implement.**

### Acceptance criteria (full text in VERIFICATION.md — this is the checklist)

- **A3.1 — `--seeds` knob (default 200).** Thread a seed count through all four runners (`runners/{calibration,detection,projection,scheduling}.py`). Keep **seed 0** and the frozen params hash **`e716cd12dddc`** (`PARAMS_VERSION_HASH` in `params.py`). Document that `n_learners = 6 archetypes × 3 bands × seeds` and that bumping seeds changes nothing about the regime.
- **A3.2 — bootstrap CIs on Δ.** Add `delta_ci_low`/`delta_ci_high` (from `bootstrap_delta_ci`) next to `delta`/`p_value`/`effect_size` in each track's paired-vs-incumbent block. **Note:** only **calibration** has a paired block today (`paired_vs_incumbent` + `paired_vs_pooled_bayes`). **detection, projection, scheduling have NO paired block yet** — you must add one (incumbents: detection `cusum`, projection `gp_ard`, scheduling `greedy_incumbent`) before the CIs can attach.
- **A3.3 — held-out archetypes (the circularity guard — most important).** Use `heldout_archetype_split` (default train `{steady, marathon_runner, morning_lark}`, test `{deadline_sprinter, fading_flame, weekend_warrior}`). **Any tunable hyperparameter is fitted on the TRAIN archetypes only and scored on the held-out set.** Record the partition in each result's `_provenance` (must be disjoint). Tunables include: projection conformal calibration-size / GP-t params (A1/A3.7), A2 `ridge`, detection CUSUM `k`/`h` (A4 later). This split is the whole point — see "What to avoid".
- **A3.4 — multiple-comparison correction.** Apply Holm (primary) + BH (reported) across all band×archetype×shift comparison cells; mark which "wins" survive correction. This needs per-archetype granularity — check the runners retain per-archetype cells (they currently aggregate by band / shift-type / material-mix), and add the breakdown if missing.
- **A3.5 — re-run + regenerate.** Run all four tracks at ≥200 seeds; regenerate the winner tables/figures under `college/mydeliverables/1st-Review/report/generated/` with CIs and corrected-significance flags.
- **A3.6 — tests.** Extend each track's test to assert the result JSON now carries `delta_ci_low/high` + a `mc_correction` block, and a disjoint held-out partition in `_provenance`.
- **A3.7 — across-learner conformal projection coverage (carried from A1 / D-A6).** Re-calibrate the projection `conformal` finish-date interval on the **across-learner** residual population: hold out a set of learners per length-band, take one finish-date residual per held-out learner, use that quantile for a new learner → marginal coverage **≈0.95 by construction** (exchangeable units). Today's honest within-learner conformal is 0.50/0.67 on max/medium — lift it toward 0.95 **with no tuned constants**. Keep `gp_ard` as the under-covered incumbent for contrast. **Replace** the current degenerate coverage test (it asserts `1.0` on a noise-free fixture) with a **noisy-fixture** test asserting ≈0.95 within MC error on `medium`+`max`, reporting coverage **and** sharpness. Regenerate `projection_reliability.pdf`.

## Suggested order (and the one real dependency)

1. A3.1 seeds knob → 2. A3.3 held-out split + provenance → 3. A3.2 paired blocks + CIs (detection/projection/scheduling need the block built) → 4. A3.4 MC correction → 5. **A3.7** (across-learner conformal — needs the held-out population from step 2) → 6. A3.5 full re-run + regen → 7. A3.6 tests. Do A3.7 after the held-out machinery exists; it reuses that population.

## What to FOLLOW

- **Frozen regime:** seed 0 + hash `e716cd12dddc` stay fixed; more seeds = more learners, same regime. Per-track result JSON shapes already differ (calibration `winner_per_band`; detection `winner_by_shift_type` + `roc`; projection `winner_by_band`; scheduling `winner_by_material_mix`) — preserve them; add fields, don't rename.
- **Reuse A0's `metrics/rigour.py`** for every CI / correction / split — don't hand-roll.
- **Commit discipline:** after the phase, set Phase A3 `Status: ✅ Complete — <sha>`, fill the A3 Resolution block in `VERIFICATION.md` (files, SHA, seeds used, the held-out partition, per-criterion self-check, deviations + why), and commit code + plan + verification together. Results under `research/results/**` are gitignored — that's expected; the committable record is the docs + code.
- **Honesty over green numbers:** if a candidate that won at 40 seeds loses (or its win doesn't survive Holm/BH) at 200 seeds, **report that** — a win dropping under correction is a finding, not a failure.

## What to AVOID (read this twice — it's why A1 and A2 each needed a redo)

- **Never tune to hit a target on the cells you report.** A3 exists to *prevent* this: tunable hyperparameters are set on the **held-out TRAIN archetypes only**, never on the held-out TEST set or the cells whose numbers you report. Two prior phases were sent back for exactly this failure mode:
  - A1 multiplied the conformal interval by a hardcoded `4.20` to hit 0.95 → rejected. For A3.7, coverage must come from the across-learner residual quantile **by construction**, with at most a *principled* (φ-derived) adjustment — **no magic constants**.
  - A2 seeded a candidate's prior with the generator's true `ROLE_RHO`/`TAU_GENERIC` → rejected. **Never import generator truth (`params.py` `ROLE_RHO`/`TAU_GENERIC`/`m_global`/`r_star`) into `baselines/`.** Estimate everything from the learners' own data.
- **Do not change the frozen regime toward any winner.** Range changes go in pre-reg §10, never candidate-favouring point values.
- **Do not replace or hand-tune a shipped candidate to win.** A3 adds rigour around the existing candidates; it does not re-tune them on scoring cells. (New candidates are A4, not A3.)
- **Do not depend on gitignored artifacts in tests** (A1 did this — a test read `research/results/.../*.json` and broke the clean-clone guarantee). Tests build their own fixtures.
- **Do not touch `research/kt-bench`**, the closed loop, or `.codex/**`. KT is a different plan; the closed loop is held for Phase II.
- **Don't peek at the future.** Prequential / coverage code predicts session `t` from `sessions[:t]` and the *observable* context only — never the realized pace of `t` or the noise-free `r_star[t]`.

## Runtime heads-up

200 seeds = **3,600 learners per track** (vs 720 at 40). The four tracks + sweep will be slow. **Smoke-test at a low seed count first** (e.g. `--seeds 5`) to confirm wiring, then do the full `--seeds 200` run once. Don't run the known-blocked E2E/build setup.

## Commands

```bash
export PATH="$HOME/.local/bin:$PATH"     # uv lives here; Bash resets env per call
uv run --package research-comparison python -m research_comparison.runners.calibration --seeds 200
uv run --package research-comparison python -m research_comparison.runners.detection   --seeds 200
uv run --package research-comparison python -m research_comparison.runners.projection  --seeds 200
uv run --package research-comparison python -m research_comparison.runners.scheduling  --seeds 200
uv run --package research-comparison pytest research/comparison/tests -q
```

## What the reviewer will verify (so you can self-check first)

1. **No leakage / no tuning on scoring cells** — the held-out partition is real and disjoint in `_provenance`; any tunable was fit on TRAIN archetypes only; no generator constants in `baselines/`; no magic constants; A3.7 coverage is by-construction, not dialed in.
2. **Seeds + frozen regime** — `n_learners` reflects ≥200 seeds; hash still `e716cd12dddc`, seed 0.
3. **CIs + MC correction present and correct** — `delta_ci_low/high` on all four tracks' paired blocks; Holm/BH `mc_correction` block; which wins survive is marked.
4. **A3.7** — conformal coverage ≈0.95 on medium/max **earned** (not constant-inflated); sharpness reported; degenerate test replaced with a noisy-fixture one; `projection_reliability.pdf` regenerated and actually changed.
5. **Tests** non-vacuous and green; numbers ground-checked against the working-tree result JSON.

## Report back

Fill the A3 Resolution block in `VERIFICATION.md` with: commit SHA, files changed, seeds used, the recorded held-out partition, per-criterion self-check (A3.1–A3.7), and any deviations + why. Then it's ready for review. If A3.7 conformal still under-covers after an honest across-learner construction, **say so** — that's a finding to surface, not to hide.

## Files likely in play

`research/comparison/src/research_comparison/runners/{calibration,detection,projection,scheduling}.py` · `…/metrics/rigour.py` (reuse) + paired/aggregate metrics · `…/baselines/projection.py` (A3.7 conformal) · `research/comparison/tests/*` · `college/mydeliverables/1st-Review/report/generated/*` · `../plans/active/2026-06-14-pillar-a-rigour.md` + `…-VERIFICATION.md` (status + A3 Resolution).
