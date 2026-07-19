---
title: KT Datasets Acquired — Handoff to Plan the Integration & Re-run (+ Pillar-A improvements)
purpose: The two public datasets the KT bench was blocked on are now in the repo. The dev for the KT-bench build (Part 3 plan / tracker Phase 4) is DONE. This handover briefs the NEXT session, which has TWO workstreams — (A) WRITE THE IMPLEMENTATION PLAN to use these two datasets to replace the smoke-fixture KT numbers with real public-benchmark numbers, and (B) take on the Pillar-A rigour & extensions improvements.
audience: next planning agent, candidate (Rohit Saji), guide/advisor
status: ready-to-plan (no code to write yet — write the plan(s) first)
last_updated: 2026-06-14
related:
  - ../plans/2026-06-13-research-tier-3-kt-bench.md
  - ../plans/2026-06-13-research-tier.md
  - ./2026-06-13-research-tier-status-and-blockers.md
  - ../college/scope/research-tasklist.md
  - ../college/scope/research-build-plan.md
  - ../research/doc/2026-06-14-pillar-a-rigour-and-extensions.md
---

> **Two workstreams for the next session.** **(A)** KT real-data integration & re-run
> (Pillar B) — the bulk of this handover, below. **(B)** Pillar-A rigour & extensions —
> driving the adaptation-track errors down; see the dedicated section near the end and the
> full note in
> [`research/doc/2026-06-14-pillar-a-rigour-and-extensions.md`](../../../research/doc/2026-06-14-pillar-a-rigour-and-extensions.md).

## One-line status

The KT-bench **pipeline is built and complete** (Part 3 plan, tracker Phase 4 — phases 4a/4b/4c all `✅ Complete`), but every artifact was produced from a **12-learner smoke fixture** (`folds_raw_source: smoke_fixture`). **Both public datasets it needs are now in the repo.** This session did not write integration code — it acquired and verified the data, updated the deck/tasklist, and wrote this handoff. **The next session's deliverable is a PLAN, not code.**

## What the next session must produce

Write a phase-by-phase implementation plan — same house style as
[`../../plans/active/2026-06-13-research-tier-3-kt-bench.md`](../../plans/active/2026-06-13-research-tier-3-kt-bench.md)
(operating-manual preamble, Decisions log, Architecture overview, Files-touched index,
vertical-slice phases each with prereq/post verification + rollback) — titled something like
**`../../plans/active/2026-06-14-kt-realdata-integration.md`**. The plan's goal:

> Take the two acquired raw datasets, land them where the existing `kt-bench/preprocess.py`
> expects them, re-run the bench in `--mode raw`, and swap every smoke-fixture KT artifact for
> a real public-benchmark one — with the provenance stamp flipping from `smoke_fixture` to
> `public_raw`, AUC in the literature band, and the report tables/figures regenerated.

Crucially, **the pipeline already exists** — this plan is about *feeding it real data + an
adapter for ACcoding*, not rebuilding models. Keep it tight.

## The two datasets (acquired & verified this session)

### 1. Eedi / NeurIPS-2020 Education Challenge, Tasks 3 & 4  — the `nips2020` MCQ modality

- **Location:** `research/datasets/NeurIPS 2020.zip` (656 MB, store-compressed).
- **The file the bench needs:** `data/train_data/train_task_3_4.csv` — **1,382,727 interactions**,
  columns `QuestionId, UserId, AnswerId, IsCorrect, CorrectAnswer, AnswerValue`. This is the
  **exact pyKT `NIPS34` / `nips_task34` input format** — no reshaping needed.
- **Supporting metadata (same zip, `data/metadata/`):**
  - `question_metadata_task_3_4.csv` — `QuestionId → SubjectId` list (the concept/KC tags).
  - `subject_metadata.csv` — the subject/concept hierarchy (`SubjectId, Name, ParentId, Level`).
  - `student_metadata_task_3_4.csv`, `answer_metadata_task_3_4.csv` — learner/answer side-data.
  - `data/test_data/test_*_task_4*.csv` — official task-4 test splits.
- **Also present (ignore):** ~951 question images + tasks 1&2 files (`train_task_1_2.csv`, 430 MB).
- **Open item for the plan:** verify pyKT's `nips_task34` reader's expected on-disk layout —
  it likely wants the metadata CSVs (esp. `question_metadata_task_3_4.csv` for KC tags)
  alongside `train_task_3_4.csv`, not just the train file. Confirm by reading
  `kt-bench/.venv/.../pykt/preprocess/` before finalizing the landing path.

### 2. ACcoding — substitute for the dead POJ coding log (the `poj` coding modality)

- **Location:** `research/datasets/acoding/ACcoding.zip` (170 MB) + `acoding/README.md`.
  Upstream: https://zenodo.org/record/6522395 (README confirms it).
- **Scale:** 4,046,652 submissions · 27,444 students · 4,559 tasks · 6 years · **100 KP tags**.
- **Format:** 6 MySQL dump files (`source xxx.sql`). The interaction log is
  `submissions.sql` (≈1.49 GB uncompressed). Key tables/columns:
  - `submissions`: `id (AUTO_INCREMENT), lang, result (enum), score, time_cost, memory_cost,
    code_length, detail, creator_id, problem_id, contest_id`.
    `result` enum = `WT, JG, AC, WA, CE, REG, MLE, REP, PE, TLE, IFNR, OFNR, EFNR, OE`.
  - `problems`: `id, access_level, difficulty, updated_at, creator_id`.
  - `tags` (KP names, e.g. "Binary Search Tree") + `problem_tags` (`tag_id, problem_id, weight`)
    = the concept map (CONTAIN relation).
- **Mapping to what pyKT's POJ reader expects** (`pykt/preprocess/poj_preprocess.py` needs a
  `poj_log.csv` with `User, Problem, Result, Submit Time`; it sets concept=Problem, questions="NA"):

  | pyKT `poj_log.csv` | ACcoding source | note |
  |---|---|---|
  | `User` | `submissions.creator_id` | direct |
  | `Problem` | `submissions.problem_id` | direct (doubles as concept) |
  | `Result` | `submissions.result` | `AC` → `Accepted`; drop `WT`/`JG` (non-terminal); all else → `Wrong Answer` (pyKT only needs Accepted=1 vs 0) |
  | `Submit Time` | **— missing —** | **caveat below** |

- **⚠️ The one real catch — no submission timestamp.** The physical `submissions` table has
  `time_cost`/`memory_cost` (execution cost) but **no submit-time column** (the README's logical
  `SUBMIT.time` is not materialized in the dump). pyKT orders each learner's sequence by
  `Submit Time`. Decision for the plan: **use the auto-increment `id` as the chronological
  surrogate** (it counts up in submission order) — synthesize a timestamp from `id`. KT only
  needs ordering, not wall-clock time. Record this as a provenance note.
- **No MySQL required.** Don't follow the README's "import into MySQL 5.7" path. Stream
  `submissions.sql` and parse the `INSERT INTO submissions VALUES (...)` rows directly. The
  messy `detail` column (compiler text with commas/quotes/newlines) sits in the *middle*;
  parse robustly from the ends — `id`/`lang`/`result` are at the front, and
  `creator_id, problem_id, contest_id` are the **last three** integers of each row.

## How the existing bench consumes data (so the plan targets the right seam)

`research/kt-bench/preprocess.py` already defines the contract (read it first):

```python
DATASETS = {
  "nips2020": DatasetSpec(public_name="nips2020", pykt_name="nips_task34", raw_file="train_task_3_4.csv"),
  "poj":      DatasetSpec(public_name="poj",      pykt_name="poj",         raw_file="poj_log.csv"),
}
# raw_dataset_path() looks under:  <raw-root>/<pykt_name>/<raw_file>  then  <raw-root>/<public_name>/<raw_file>
# main(): --datasets nips2020,poj  --mode {auto,raw,smoke}  --raw-root data  --folds-dir folds
```

So, mechanically, the real-data path is:
1. Land `train_task_3_4.csv` (+ required metadata) at `<raw-root>/nips_task34/` (or `/nips2020/`).
2. Produce `poj_log.csv` from ACcoding and land it at `<raw-root>/poj/`.
3. Run `make kt` (or `preprocess.py --mode raw`) → real folds export → train/coldstart/calibrate
   → `pybkt_runner` on the same folds → clean-env `join.py` → `report/generated/kt_*`.
The smoke→real swap is **auditable**: each `folds.json` records `raw_source`, flipping from
`smoke_fixture` to `public_raw`.

## Decisions / open questions the plan should resolve

1. **Naming for ACcoding.** Keep it flowing through the existing `"poj"` DatasetSpec (lowest
   friction — pyKT's POJ reader handles `poj_log.csv` as-is), **or** add a new
   `"accoding"` DatasetSpec for honest provenance/labels in tables. (Recommend: add an
   `accoding` spec aliasing the `poj` pyKT reader, so report labels say "ACcoding (coding)".)
2. **ACcoding timestamp surrogate** — confirm `id`-as-order (above) and how to encode it.
3. **Concept layer for coding** — problem-as-concept (matches pyKT POJ, zero extra work) vs
   tag-based KCs via `problem_tags` (richer, but diverges from pyKT's POJ reader → custom
   preprocess). Phase-I default is native problem-as-concept; note tags as a Phase-II option.
4. **Eedi reader layout** — confirm whether `nips_task34` needs the metadata CSVs co-located
   (almost certainly the question/subject metadata for KC tags). Land them accordingly.
5. **Adapter location & form** — a new `research/kt-bench/adapters/accoding_to_poj.py` (stream
   `submissions.sql` → `poj_log.csv`)? Where does the unzip land (datasets are gitignored;
   the zips themselves probably shouldn't be committed — confirm `.gitignore`).
6. **Re-run scope** — full 5-fold × 5 models × both datasets is heavy. Decide config/seed
   (fixed config, `WANDB_MODE=offline` per OQ-06) and whether to subsample ACcoding's 4M rows
   for tractable training on this machine.
7. **ECE binning** (OQ-07) — lock 10 equal-width bins before presenting real numbers.

## Environment & gotchas (carried from Phase 4 implementation notes)

- Isolated env: `research/kt-bench/.venv` on **system Python 3.9.6** (`uv python install 3.12`
  failed on this machine); pinned `torch==2.3.1`, **`pykt-toolkit==0.0.38`** (0.0.39 not on
  PyPI). It is **not** a `uv` workspace member and stays out of `uv.lock` (D-13).
- The clean-env `join.py` must **never import torch/pyKT** — there's a test enforcing it
  (`research/comparison/tests/test_kt_join.py`). Keep the seam = `results/kt/*.json`.
- `pyBKT` in the clean env needs a narrow process-local import shim (sklearn/`AttributeError`
  on Python 3.14) — already in `pybkt_runner.py`; don't remove it.
- If torch/dataset pulls fail on this machine, use the corporate-mirror / CA-bundle patterns in
  `.claude/rules/docker-colima-setup.md` and `.claude/rules/pnpm-build-registry.md`.
- Repo norm: **heavy/isolated-env steps are written, not run, in CI** ("E2E/heavy envs: write,
  don't run here"). The plan should mark train/coldstart as manual-run with smoke guards.

## Definition of done for the work the plan describes (so the plan can state its DoD)

- `research/results/kt/*.json` and `folds/*_folds.json` carry `raw_source: public_raw`
  (no `smoke_fixture`) for both `nips2020` and the ACcoding/`poj` modality.
- Full-seq AUC lands in the ~0.70–0.82 literature band for at least DKT on `nips2020`;
  cold-start AUC curve is monotone-ish in `k ∈ {3,5,10,20}`; ECE table present.
- `report/generated/{kt_auc.tex, kt_ece.tex, kt_coldstart.pdf, kt_reliability.pdf,
  kt_provenance.txt}` regenerated; `kt_provenance.txt` no longer says `smoke_fixture`.
- `uv run --package research-comparison pytest research/comparison/tests/test_kt_join.py -q`
  green; `research/results/kt_summary.json` reports zero grid gaps.
- Tracker Phase 4 in [`research-tasklist.md`](../../../college/scope/research-tasklist.md) flips from
  "⚠️ smoke" to "✅ complete (real public-benchmark numbers)".

## Workstream B — Pillar-A rigour & extensions (also for the next session)

Separate from the KT work above. Pillar A (calibration / detection / projection / scheduling)
has shipped genuine 720-learner results, but two things need work and the candidate set can be
widened. **Full reasoning, candidate algorithms, and priority order are in
[`research/doc/2026-06-14-pillar-a-rigour-and-extensions.md`](../../../research/doc/2026-06-14-pillar-a-rigour-and-extensions.md);
tracker tasks are `PA+.1–PA+.8` in [`research-tasklist.md`](../../../college/scope/research-tasklist.md).**

Priority order (most error-reduction per unit effort):

1. **Projection coverage fix** — CIs under-cover badly (~0.2–0.68 vs 0.95); likely a
   homoscedastic-Gaussian GP ignoring the lognormal-AR(1) noise. Fix with heteroscedastic /
   Student-t GP or a conformal wrapper. *(The one red result on slide 4.)*
2. **Calibration covariates + pooling** — add τ (time-of-day) + ν (day-of-week) effects and
   empirical-Bayes partial pooling; hierarchical Bayes currently only *ties* pooled, which
   means the hierarchy is doing no work as specified.
3. **Statistical rigour** — 200+ seeds, bootstrap CIs on Δ, held-out archetypes,
   multiple-comparison correction.
4. **Dataset-to-reality** — enrich the generator (continuous archetypes, richer regimes,
   bursty missingness, heavy tails, logged-time misreporting) and fit its moments to a real
   engagement dataset (OULAD / EdNet / Junyi — *time-on-task*, **not** KT correctness), then
   re-check the ranking holds.

Plus new candidates (BOCPD/Page-Hinkley for detection, conformal/BSTS/forward-sim for
projection, ILP/CP-SAT + local-search for scheduling, Kalman/particle for calibration) and
tweaks to the winners (CUSUM robust scaling + per-shift tuning; greedy lookahead + prereq-aware
ordering).

**Do first:** verify the open code questions in the doc (do calibrators use τ/ν? does the GP
model AR(1)/heteroscedasticity? any hyperparameter circularity?) — they confirm #1 and #2
before any build. **Note:** the KT benchmark is irrelevant to Pillar A (different
target/data/metric) — don't cross the streams.

This workstream can be its own plan (e.g. `../../plans/active/2026-06-14-pillar-a-rigour.md`) or folded into
Part 2's fan-out plan; the next session decides.

## Pointers

- **Build plan being extended:** [`../../plans/active/2026-06-13-research-tier-3-kt-bench.md`](../../plans/active/2026-06-13-research-tier-3-kt-bench.md)
  (phases 4a/4b/4c `✅ Complete`; OQ-05/06/07 still open).
- **Prior status/blocker snapshot:** [`../2026-06-13-research-tier-status-and-blockers.md`](../2026-06-13-research-tier-status-and-blockers.md).
- **Code to read first:** `research/kt-bench/preprocess.py`, `kt-bench/.venv/.../pykt/preprocess/poj_preprocess.py`,
  `research/comparison/src/research_comparison/kt/{join.py,pybkt_runner.py}`, the `kt` target in `Makefile`.
- **Guidance-call artifacts that already reflect this:** `college/mydeliverables/2nd-Guidance-call/status-research-tier-deck.pptx` + `status-research-tier-script.md`.
