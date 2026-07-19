---
title: KT bench — credibility & validation guidelines (what must pass before a result counts)
purpose: Define, gate-by-gate, what the implementing agent must TEST before any KT model×dataset cell may be marked "credible" (i.e. reportable as a real public-benchmark finding rather than a smoke-depth placeholder). Pairs with the living tracker at research/doc/2026-06-14-kt-credibility-tracker.md.
audience: implementing agent, candidate (Rohit Saji), guide/advisor
status: active guideline
created: 2026-06-14
related:
  - ./2026-06-14-kt-credibility-tracker.md  (the living tracker the agent fills in)
  - ../../plans/2026-06-14-kt-realdata-integration.md
  - ../../plans/2026-06-13-research-tier-3-kt-bench.md
  - ../../college/scope/research-tasklist.md
---

## Why this document exists

The KT real-data integration (`plans/2026-06-14-kt-realdata-integration.md`, commit `d04057b`) wired
real pyKT training and real pyBKT fits, flipped the folds to `public_raw`, and regenerated the report
artifacts — but the **re-run was not uniform**. An audit found that only **one** of twelve
model×dataset cells (`dkt` × `nips2020`) was actually a full, trustworthy run; the rest carried a
`public_raw` provenance stamp on top of **smoke-depth training** (`smoke_sequences_per_fold=64`,
`epochs=1`) or a **degenerate fit** (pyBKT flat at AUC ≈ 0.51). A `public_raw` stamp alone does **not**
make a number credible.

This guideline makes "credible" an explicit, testable bar. A cell may be marked ✅ in the tracker
**only when every gate below passes**. The companion tracker records, per cell, which gates have
passed and the evidence.

## Definitions

- **Cell** = one `(model, dataset)` pair, e.g. `dkt × nips2020`. Each cell owns 6 result families:
  full-sequence AUC, cold-start AUC at `k ∈ {3,5,10,20}`, and ECE/reliability. There are
  **6 models** (`pybkt, dkt, akt, deep_irt, sakt, clst`) × **2 datasets** (`nips2020, accoding`)
  = **12 cells**.
- **Credible** = all applicable gates G1–G8 pass for that cell. Credible ⇒ reportable as a real
  result (with its caveats).
- **Headline-grade** = credible **and** the metric lands in the published literature band for that
  modality (currently only meaningful for the MCQ band on `nips2020`).
- **Smoke-depth** = trained with `smoke_sequences_per_fold > 0` or `epochs < the full value`. Smoke
  numbers are **never** credible regardless of provenance stamp.

## The credibility gates

A cell is credible when **G1–G8 all pass**. Gates marked **(auto)** should be enforced by a
clean-env test so they cannot silently regress; gates marked **(manual)** are judged by inspecting
the result JSON / figures and recorded in the tracker with evidence.

### G1 — Real provenance & data integrity **(auto)**

- Every result file for the cell has `_provenance.folds_raw_source == "public_raw"` (no
  `smoke_fixture`).
- `_provenance.folds_hash` matches the SHA-256 of the tracked `folds/{dataset}_folds.json`; for
  pyBKT, `_provenance.sequences_hash` matches `folds/{dataset}_sequences.csv`. (Catches stale
  results produced against folds that were since re-exported.)
- The folds JSON itself records `raw_source: public_raw` and a `train_valid_rows` count ≫ the
  10-row smoke fixture.

**Test:** load every `research/results/kt/{dataset}__{model}__*` file, assert the provenance fields;
recompute and compare the folds hash.

### G2 — Full training depth & completeness **(auto)** — *this is the gate that was missed*

- Deep models: `training_config.smoke_sequences_per_fold == 0` **and**
  `training_config.epochs >= 5` (or the agreed full-run epoch count) for **all 5 folds**.
- `n_predictions` per fold is consistent with the fold's real test size (within ±5%), **not** the
  tell-tale `64`. Record the expected test size per fold from the folds JSON.
- pyBKT: fit on the **full** train split (no per-skill row cap); `n_predictions` per fold equals the
  test split's interaction count.

**Test:** assert `smoke==0`, `epochs>=5`, and `n_predictions` within tolerance of the fold test size
for every reportable full-seq row. **A cell with any `smoke>0` or `epochs<5` full-seq row fails G2.**

### G3 — Grid completeness **(auto)**

- All 5 folds × `{full, 3, 5, 10, 20}` results present, plus one ECE file per fold.
- `research/results/kt_summary.json` reports **zero gaps** for the cell, and
  `_provenance.folds_raw_sources == ["public_raw"]`.

**Test:** the existing `join.py` gap-check over `DEFAULT_DATASETS=[nips2020, accoding]`,
`DEFAULT_MODELS=[pybkt,dkt,akt,deep_irt,sakt,clst]` returns no missing `(dataset,model,fold,k)`.

### G4 — Separation from chance & fold stability **(manual + auto floor)**

- Mean 5-fold full-seq AUC ≥ **0.55**, **and** the cell is *reliably* above chance: either
  `min_fold_AUC > 0.50` or `mean − 1.96·SE > 0.50`.
- **Degenerate-flatness guard:** reject the pyBKT-style signature — a large prediction set
  (`n_predictions` in the hundreds of thousands) with AUC pinned at ≈ 0.508–0.509 across all folds
  and near-zero fold variance. That pattern means the model is emitting an almost constant score
  (a keying/feature bug), not learning. Flag any cell whose mean AUC ∈ [0.49, 0.52] **and** fold
  std < 0.01 for investigation, not credit.
- Report per-fold AUC mean ± std in the tracker.

**Test (auto floor):** assert mean full-seq AUC > 0.52 for every cell intended to be reportable;
emit a warning (not a pass) for cells in the degenerate band.

### G5 — Calibration sane **(manual)**

- ECE computed on **real** predictions, 10 equal-width bins (OQ-07 locked).
- ECE ≤ **0.15** ⇒ well-calibrated (record). ECE in (0.15, 0.25] ⇒ acceptable but note it.
  ECE > **0.25** ⇒ **investigate** before crediting — on a near-chance model this usually confirms
  the predictions are degenerate (e.g. pyBKT/nips2020 ECE ≈ 0.485).
- The reliability bins must contain real mass (not all predictions piled in one bin).

### G6 — Cold-start curve shape **(manual + auto)**

- AUC(`k`) is **monotone-ish non-decreasing** in `k` (a single dip ≤ 0.02 is tolerated; a collapse
  such as the observed `akt`/`sakt` drop at `k=20` below `k=3` fails).
- Every `k` is above chance (> 0.50).
- The headline cold-start cell (`dkt × nips2020`) should show a clean rise toward the full-seq AUC.

**Test (auto):** for each reportable cell assert `AUC(k=10) >= AUC(k=3) - 0.02` and all `AUC(k) > 0.5`.

### G7 — Reproducibility **(manual)**

- A fixed `seed` and full `training_config` (model_config, epochs, batch_size, lr) are recorded in
  every result's `_provenance`/`training_config`.
- Re-running the cell with the same seed reproduces the full-seq AUC within **±0.01** (deep models
  are seeded; pyBKT `num_fits`/seed recorded). Record the two AUCs in the tracker.
- `WANDB_MODE=offline` for all deep runs.

### G8 — Method fidelity (no silent aliases, sane KC space) **(manual + auto registry)**

- Each model name maps to the **distinct, correct** method it claims. **Known issue:** `clst` is
  currently aliased to DKT (`train.py: PYKT_MODEL = {"clst": "dkt"}`). To pass G8, either implement
  CLST as its own cold-start method, **or** relabel it (e.g. `dkt_clst_config`) so no table claims a
  method that isn't run. Maintain a small `model_registry` manifest stating, per model name, the
  underlying pyKT model and whether it is a true distinct method.
- **pyBKT KC space sanity:** the skill keys fed to pyBKT must be atomic KCs, not compound
  `"_"`-joined multi-subject strings. On `nips2020`, Eedi level-3 subjects get joined into compound
  concept strings; that explodes the skill cardinality into thousands of one-shot "skills" and makes
  BKT degenerate (the G4 flat signature). Verify `nunique(skill)` is in a sane range and that BKT
  separates from chance after the keying fix (split compound KCs to one row per atomic subject, or
  hash to a bounded skill set — record the choice).

**Test (auto registry):** assert no model in the reportable set is a silent alias of another unless
whitelisted in the manifest; assert pyBKT skill cardinality per dataset is below a sane ceiling.

## Dataset / modality-specific expectations

| Dataset | Modality | KC source | Credible bar (G4) | Headline band | Notes |
|---|---|---|---|---|---|
| `nips2020` | Eedi MCQ | level-3 subjects (`question_metadata` × `subject_metadata`) | mean AUC > 0.55, above chance | **0.70–0.82** full-seq for a strong deep model (DKT/AKT) | pyBKT needs the KC-keying fix (G8); DKT/nips2020 is the current proven cell (0.743) |
| `accoding` | coding (problem-as-concept, D-20) | `Problem` id | mean AUC > 0.55, above chance, **stable across subsample sizes** | no tight published band — judge on separation + stability, not an absolute number | record `max_learners` subsample (OQ-K2); re-check AUC stable at 1k/3k/10k learners before crediting |

For `accoding` there is no clean literature band, so "credible" rests on G1–G8 (especially G2 full
depth, G4 separation, G7 reproducibility, G8 problem-as-concept fidelity) plus a **subsample-stability
check**: the cell's AUC must not swing materially when `max_learners` changes, or the number is an
artifact of the cut.

## Automated guard tests to add (so credibility can't silently regress)

Extend `research/comparison/tests/test_kt_join.py` (clean env, no torch) with:

1. `test_no_smoke_in_reportable` — for every full-seq row of a model listed as reportable, assert
   `training_config.smoke_sequences_per_fold == 0` and `epochs >= 5`. *(Would have caught the
   d04057b issue immediately.)*
2. `test_provenance_public_raw` — every joined row's `folds_raw_source == "public_raw"`; folds hash
   matches.
3. `test_auc_above_chance` — every reportable cell mean full-seq AUC > 0.52; warn on the degenerate
   band [0.49, 0.52] with std < 0.01.
4. `test_coldstart_monotone` — `AUC(k=10) >= AUC(k=3) - 0.02` and all `AUC(k) > 0.5` per reportable
   cell.
5. `test_model_registry` — no silent aliases outside the whitelist; pyBKT skill cardinality under
   the ceiling.

These tests read only `research/results/kt/*.json` + the folds (the existing seam), so they run in
CI without torch/pyKT. A "reportable" allow-list (which cells the report cites) lives in the test or
a small manifest so partial progress doesn't fail CI — cells not yet run are simply not in the
allow-list.

## Procedure — get every cell to credible (the full-grid re-run)

Run in the isolated env (`research/kt-bench/.venv`), `WANDB_MODE=offline`. **Write-don't-run-here**
applies in CI; the candidate runs this offline.

```bash
cd research/kt-bench

# 1. Deep models — FULL depth (smoke=0, epochs>=5), both datasets, all 5 folds
for ds in nips2020 accoding; do
  WANDB_MODE=offline ./.venv/bin/python train.py \
    --dataset "$ds" --models dkt,akt,deep_irt,sakt,clst \
    --folds "folds/${ds}_folds.json" --smoke 0 --epochs 5
  WANDB_MODE=offline ./.venv/bin/python coldstart.py \
    --dataset "$ds" --k 3,5,10,20 --smoke 0
  ./.venv/bin/python calibrate.py --dataset "$ds"
done

# 2. CLST fidelity (G8): either implement a distinct CLST method, or relabel the alias before re-run.

# 3. pyBKT — fix KC keying (G8) for nips2020, then real fit on shared folds (clean env)
cd ../..
export PATH="$HOME/.local/bin:$PATH"
uv run --package research-comparison python -m research_comparison.kt.pybkt_runner --dataset nips2020
uv run --package research-comparison python -m research_comparison.kt.pybkt_runner --dataset accoding

# 4. Re-join + regenerate report artifacts, then run the guard tests
uv run --package research-comparison python -m research_comparison.kt.join
uv run --package research-comparison pytest research/comparison/tests/test_kt_join.py -q
```

After each cell completes, **update the tracker** (`research/results/kt/CREDIBILITY_TRACKER.md`):
flip its gates, paste the per-fold AUC mean±std / ECE / cold-start row, and set the cell status.

## Definition of done (whole effort)

- All **12 cells** marked ✅ credible in the tracker (G1–G8 pass), **or** any cell that cannot reach
  credible is explicitly marked 🛑 with the reason recorded (e.g. "pyBKT/nips2020 — KC space
  intractable for BKT; documented as a limitation, excluded from headline").
- `dkt × nips2020` (and ideally a second deep model) is **headline-grade** (0.70–0.82).
- The 5 guard tests pass; `kt_summary.json` shows zero gaps, `folds_raw_sources: ["public_raw"]`.
- `report/generated/kt_*` regenerated from the credible set; the tracker's "reportable allow-list"
  matches what the report cites.
- The tracker's changelog reflects the final state and the tracker is committed alongside the
  results.

## How "credible" maps to the tracker

The tracker holds one row per cell with a column per gate (G1–G8) and an overall status. The agent
flips a gate to `✅` only after the corresponding test/inspection above passes, and sets the cell
status to `✅ credible` only when all applicable gates are green. Reading the tracker top-to-bottom
tells you exactly which cells are trustworthy, which are still smoke/degenerate, and what evidence
backs each call — without re-deriving any of it.
