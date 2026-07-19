---
title: KT bench — next-tests runbook (remaining cells to credibility)
purpose: A precise, ordered runbook for the remaining KT tests after the NIPS deep cells went credible. Tells the agent exactly what to run, how to watch run status via the built-in progress tracker, which gate each step satisfies, how to verify, and how to update the tracker/registry. Execute in order; do not flip Phase 4 complete until the final gate.
audience: implementing agent (new session), candidate (Rohit Saji)
status: active runbook
created: 2026-06-14
related:
  - ./2026-06-14-kt-credibility-tracker.md          (the living cell matrix this drives to green)
  - ./2026-06-14-kt-credibility-and-validation-guidelines.md   (gate definitions G1–G8)
  - ../../plans/2026-06-14-kt-realdata-integration.md
  - ../kt-bench/model_registry.json                  (allow-list + sampling/skill policy)
---

## Read first — current state (verified 2026-06-14, HEAD `b187fe7`)

**Credible & reportable (5 cells, NIPS only):** `dkt, akt, deep_irt, sakt, dkt_clst_config × nips2020`
— all full-depth (epochs 5, smoke 0, ~1.5k preds/fold), G1–G8 green, ECE ~0.036, in the 0.70–0.82
band. `kt_summary.json` is in `reportable_allowlist` mode: 150 rows, 0 gaps, `public_raw`. The report
artifacts cite only these 5. `model_registry.json` holds the allow-list + policy.

**Not yet credible (the work below):**

| Cell(s) | State | Step |
|---|---|---|
| `dkt, akt, deep_irt, sakt, dkt_clst_config × accoding` | ❌ smoke (epochs 1, smoke 64, n_pred 64) | **T1** (S3) |
| `pybkt × accoding` | 🟡 partial — AUC ~0.606 OK, but ECE 0.272 (>0.25), G7 + subsample-stability pending | **T2** (G7), **T3** (S6) |
| `pybkt × nips2020` | 🛑 blocked — degenerate (~0.509 flat, ~90% zero predictions) | **T4** (decide: fix or document) |
| Phase 4 final flip in `research-tasklist.md` | not allowed yet | **T5** (S9) |

> **Honest-result note up front:** ACcoding is problem-as-concept (≈3,817 sparse "skills"); deep KT may
> legitimately score near chance there **even at full depth**. A low *full-depth* AUC is a real finding
> (`❌ not credible — genuine`), **not** a smoke failure to "fix." Only treat it as fixable if `n_pred`
> is still 64 or `epochs<5` (i.e. it never actually ran full).

---

## How to know a script's run status — use the built-in progress tracker

Every long-running script logs to **stderr** via `research/kt-bench/progress_log.py`. Lines look like:

```
[kt-train-progress] 2026-06-14T09:41:02Z 045% state=train.fold.training elapsed=812s detail=accoding dkt fold 2/5; still running
```

Rules for the agent:

1. **Never run with `--quiet`** for these steps — you want the heartbeats. Capture them:
   `… 2>&1 | tee .work/logs/<step>.log`.
2. **To check status of a running/finished job**, `tail -n 5 .work/logs/<step>.log` and read the latest
   `[<label>-progress] … NNN% state=<state> elapsed=<s>s` line.
3. **Labels:** `kt-preprocess`, `kt-train`, `kt-coldstart`, `kt-calibrate`, `kt-pybkt`.
4. **Heartbeat = alive, not hung.** A line ending `…; still running` is emitted every ~30s while a
   blocking step (training a fold, fitting a skill) is in progress. Do **not** kill a job that is still
   emitting heartbeats. Only intervene if `elapsed` keeps growing with **no change of `state`** far
   beyond the per-fold time the credible NIPS runs took.
5. **train.py state sequence** (so you know where it is): `train.prepare_config` → `train.config_ready`
   → per fold `train.fold.setup` → `train.fold.training` (heartbeats) → `train.fold.evaluate` (75%) →
   `train.fold.wrote` → `train.complete` (100%). `kt-pybkt` logs per-fold + per-skill fit progress.
6. **Resumability:** `train.py --skip-complete` skips `kfull` rows that are already full-depth, so an
   interrupted grid can be re-invoked without redoing finished cells.

All heavy runs are **manual on the candidate's machine** (repo norm: "write, don't run here"). The
isolated env is `research/kt-bench/.venv`; the clean env is `uv run --package research-comparison …`.

---

## T1 — ACcoding deep full-depth rerun (S3) → gates G2/G4/G5/G6/G7

**Goal:** replace the smoke (epochs 1, n_pred 64) ACcoding deep rows with full runs, identical to how
the NIPS deep cells became credible.

```bash
cd research/kt-bench
mkdir -p .work/logs

# 1. Full-depth training, all 5 deep models, all 5 folds
WANDB_MODE=offline ./.venv/bin/python train.py \
  --dataset accoding --models dkt,akt,deep_irt,sakt,dkt_clst_config \
  --folds folds/accoding_folds.json --smoke 0 --epochs 5 --skip-complete \
  2>&1 | tee .work/logs/accoding-train.log

# 2. Cold-start curve (k=3,5,10,20), full depth
WANDB_MODE=offline ./.venv/bin/python coldstart.py \
  --dataset accoding --models dkt,akt,deep_irt,sakt,dkt_clst_config \
  --k 3,5,10,20 --folds folds/accoding_folds.json --smoke 0 \
  2>&1 | tee .work/logs/accoding-coldstart.log

# 3. ECE / reliability
./.venv/bin/python calibrate.py --dataset accoding \
  --models dkt,akt,deep_irt,sakt,dkt_clst_config \
  2>&1 | tee .work/logs/accoding-calibrate.log
```

**Watch:** `tail -f .work/logs/accoding-train.log` → expect `state=train.fold.training` heartbeats per
fold, ending `train.complete`.

**Verify (per cell):**
```bash
python3 - <<'PY'
import glob,json,statistics as st
for m in ["dkt","akt","deep_irt","sakt","dkt_clst_config"]:
    fs=sorted(glob.glob(f'research/results/kt/accoding__{m}__fold*__kfull.json'))
    a=[json.load(open(f))['auc'] for f in fs]; tc=json.load(open(fs[0]))['training_config']
    n=[json.load(open(f))['n_predictions'] for f in fs]
    print(f"{m:16s} mean={st.fmean(a):.4f} epochs={tc['epochs']} smoke={tc['smoke_sequences_per_fold']} n_pred={n}")
PY
```
- **G2 pass** iff `epochs=5, smoke=0, n_pred ≫ 64` (≈ real test size) for every fold.
- **G4:** mean AUC ≥ 0.55 & reliably > chance ⇒ candidate-credible. If full-depth AUC is < 0.55 / ≈
  chance, that is a **genuine ❌ (not smoke)** — record it as an honest result, don't keep "fixing."
- **G6:** cold-start AUC(k) monotone-ish, every k > 0.5. **G5:** ECE ≤ 0.15 good / >0.25 investigate.
- **G7:** rerun one model into a scratch dir with the same seed, diff AUC (see T2 pattern); ±0.01.

**Tracker update:** set rows 7–11 gates from the evidence; status `✅ credible` only if G1–G8 pass, else
`❌ not credible (genuine, full-depth)` with the AUC recorded.

---

## T2 — pyBKT × ACcoding reproducibility (G7) + ECE investigation (G5)

`pybkt × accoding` is partial: AUC ~0.606 (fine), but ECE 0.272 (>0.25) and G7 unverified.

**G7 reproducibility** — rerun into a scratch results dir, then diff full-seq AUC:
```bash
export PATH="$HOME/.local/bin:$PATH"
mkdir -p /tmp/kt-g7-pybkt-accoding/results
uv run --package research-comparison python -m research_comparison.kt.pybkt_runner \
  --dataset accoding --results-dir /tmp/kt-g7-pybkt-accoding/results 2>&1 | tee research/kt-bench/.work/logs/accoding-pybkt-g7.log
python3 - <<'PY'
import glob,json
def aucs(d): return {f.split('__fold')[1][0]: round(json.load(open(f))['auc'],6)
                     for f in sorted(glob.glob(f'{d}/accoding__pybkt__fold*__kfull.json'))}
a=aucs('research/results/kt'); b=aucs('/tmp/kt-g7-pybkt-accoding/results')
print('canonical',a); print('rerun    ',b)
print('max |Δ| =', max(abs(a[k]-b[k]) for k in a))
PY
```
- **G7 pass** iff max |Δ| ≤ 0.01.

**ECE (G5) investigation** — ECE 0.272 means scores are mis-calibrated, not necessarily wrong-ranked
(AUC is fine). Decide one of:
- (a) accept as `🟡 partial` and **report ECE honestly** as a pyBKT-on-ACcoding limitation, or
- (b) apply a post-hoc calibration (e.g. isotonic/Platt on a held-out slice **of the train fold only**)
  and re-measure ECE — *if and only if* it doesn't leak test data. Record the choice in the registry.

**Tracker update:** row 12 — set G7 from the diff; note the ECE decision. Cell stays `🟡 partial` until
**T3** (subsample stability) also passes.

---

## T3 — ACcoding subsample stability (S6 / OQ-K2) → unblocks crediting any ACcoding cell

`model_registry.json → dataset_sampling.accoding.required_max_learners = [1000, 3000, 10000]`, current
status `single_subsample_only`. Credit no ACcoding cell until AUC is stable across subsamples.

**Do it in isolated scratch roots — never overwrite the canonical `max_learners=3000` artifacts.**
For each `N ∈ {1000, 10000}` (3000 already exists):

```bash
cd research/kt-bench
for N in 1000 10000; do
  ROOT=.work/sub_$N
  mkdir -p $ROOT/data/poj $ROOT/folds .work/logs
  # 1. regenerate the coding log at this subsample
  ./.venv/bin/python adapters/accoding_to_poj.py --max-learners $N \
    --out $ROOT/data/poj/poj_log.csv 2>&1 | tee .work/logs/accoding-adapter-$N.log
  # 2. re-preprocess -> scratch folds + sequence sidecar (raw_source public_raw)
  ./.venv/bin/python preprocess.py --datasets accoding --mode raw \
    --raw-root $ROOT/data --folds-dir $ROOT/folds 2>&1 | tee .work/logs/accoding-prep-$N.log
  # 3. pyBKT on this subsample (clean env), into a scratch results dir
  cd ..
  PATH="$HOME/.local/bin:$PATH" uv run --package research-comparison python -m research_comparison.kt.pybkt_runner \
    --dataset accoding --folds kt-bench/$ROOT/folds/accoding_folds.json \
    --results-dir kt-bench/$ROOT/results 2>&1 | tee kt-bench/.work/logs/accoding-pybkt-$N.log
  cd kt-bench
done
```

**Verify stability:** compare mean full-seq AUC at N=1000 / 3000 / 10000.
- **Stable** (spread ≤ ~0.02) ⇒ S6 satisfied; set `dataset_sampling.accoding.status = "stable"`; ACcoding
  cells may now be credited on their own gates.
- **Unstable** ⇒ the ACcoding number is a subsample artifact; keep cells `🟡 partial` and report the
  instability honestly.

> Apply the same N=1000/10000 reruns to the **deep** models too if you want to credit the T1 deep cells
> (same scratch-root pattern, `train.py --raw-root`/`--folds` pointed at the scratch dirs). For a first
> pass, pyBKT-only stability is enough to characterise the dataset; deep-cell crediting can cite it.

---

## T4 — Decide pyBKT × NIPS (blocked): fix or document

Degenerate: AUC ~0.509 flat, ECE 0.485, ~90% exact-zero `correct_predictions`. The S2/S4 audit already
ruled out compound-KC keying and unseen-skill fallback — it's the trained pyBKT output itself.

**First, capture the evidence in-tree** (today it lives only in `/private/tmp` / prior audit):
```bash
python3 - <<'PY'
import glob,json,collections
fs=sorted(glob.glob('research/results/kt/nips2020__pybkt__fold*__kfull.json'))
if not fs: print("NOTE: no active nips2020 pybkt rows — regenerate to scratch to inspect"); raise SystemExit
import itertools
z=collections.Counter()
for f in fs:
    for s in json.load(open(f))['y_score']:
        z['zero' if s==0.0 else 'nonzero']+=1
print(z)
PY
```
Then choose:
- **(a) Fix attempt (own slice):** investigate the pyBKT formulation — binary correctness encoding, the
  `forgets=False` / `num_fits=1` settings, per-skill vs multi-skill fit, and the `predict` path that
  yields zeros. Re-fit, re-verify G4/G5/G6. Only if it clears the gates does the cell become credible.
- **(b) Document & keep blocked (recommended for now):** record it as an honest limitation — "BKT
  degenerates on Eedi MCQ under this formulation" — in `research/doc/` and the report's limitations.
  Leave it out of the allow-list. This does **not** block Phase 4 if every other cell is credible or
  explicitly blocked-with-reason.

Write the chosen outcome + the zero-prediction evidence into a short note under `research/doc/` so the
blocked call is reproducible without the `/tmp` artifacts.

---

## T5 — Re-join, guard tests, allow-list, and the Phase-4 flip (S7–S9)

After T1–T4 settle, regenerate and gate:

```bash
export PATH="$HOME/.local/bin:$PATH"
# 1. (if any cell changed credibility) update research/kt-bench/model_registry.json reportable_allowlist
# 2. re-join -> kt_summary + report artifacts from the allow-list
uv run --package research-comparison python -m research_comparison.kt.join
# 3. run the full guard suite (these encode the gates)
uv run --package research-comparison pytest research/comparison/tests/test_kt_join.py -q
```

The guard suite already enforces the gates — keep all green:
`test_no_smoke_in_reportable`, `test_allowlist_candidates_have_public_raw_matching_provenance`,
`test_allowlist_candidates_record_reproducibility_config`, `test_allowlist_candidates_auc_above_chance_floor`,
`test_allowlist_candidates_coldstart_curve_is_sane`, `test_model_registry_has_no_silent_aliases_and_allowlist_is_registered`,
`test_pybkt_skill_space_matches_registry_policy`, `test_accoding_subsample_provenance_matches_sampling_policy`,
`test_join_boundary_does_not_import_torch_or_pykt`.

**Then update the tracker** (`2026-06-14-kt-credibility-tracker.md`): flip the affected cell rows, the
cross-cutting gate rows, the snapshot tally, and add a Changelog line with the commit sha.

**S9 — Phase-4 final flip** in `college/scope/research-tasklist.md` is allowed **only when** every cell
is either `✅ credible` or `🛑 blocked`/`❌ not-credible (genuine)` **with recorded evidence** — no cell
left `🟡 partial` or `⏳`. Specifically: ACcoding deep cells resolved (T1), `pybkt × accoding` G7+S6
resolved (T2/T3), `pybkt × nips2020` decided (T4).

---

## Execution order & gate map (quick reference)

1. **T1** ACcoding deep full-depth (S3) → G2, then G4/G5/G6/G7 per cell.
2. **T2** `pybkt × accoding` G7 + ECE decision.
3. **T3** ACcoding subsample stability (S6/OQ-K2) → unblocks crediting ACcoding cells.
4. **T4** `pybkt × nips2020` fix-or-document (capture evidence in-tree first).
5. **T5** re-join → guard suite green → tracker/registry update → S9 flip (only if no cell left pending).

**Definition of done:** all 12 cells `✅ credible` or explicitly `🛑/❌-genuine` with evidence; guard suite
green; `kt_summary` 0 gaps + `public_raw`; report cites only credible cells; tracker + `research-tasklist`
Phase 4 updated; ACcoding sampling marked stable-or-unstable with data.

## Guardrails

- Subsample/reproducibility reruns go to **scratch dirs** (`/tmp/…` or `.work/sub_N/…`); never overwrite
  canonical artifacts. Compare, don't clobber.
- Clean-env steps (`pybkt_runner`, `join`, pytest) **must not import torch/pyKT** — a guard test enforces it.
- Don't credit any ACcoding cell while `dataset_sampling.accoding.status == "single_subsample_only"`.
- A low **full-depth** AUC is an honest result, not a bug to chase — record it and move on.
- Keep the guideline immutable; record state only in the tracker + `model_registry.json`.
