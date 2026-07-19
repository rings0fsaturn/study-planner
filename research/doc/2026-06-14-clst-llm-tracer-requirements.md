---
title: Real CLST (LLM-as-knowledge-tracer) — requirements & context for a future research + implementation session
purpose: Capture everything a fresh session needs to RESEARCH and PLAN a genuine CLST implementation for the KT bench. CLST is currently a relabeled alias (`dkt_clst_config`), not a real method. This doc is the brief; the next session produces the research note + phase-by-phase plan from it.
audience: next planning agent (new session), candidate (Rohit Saji), guide/advisor
status: requirement (not a build plan yet — research + plan first)
created: 2026-06-14
related:
  - ./2026-06-14-kt-credibility-and-validation-guidelines.md
  - ./2026-06-14-kt-credibility-tracker.md
  - ../../plans/2026-06-14-kt-realdata-integration.md
  - ../../plans/2026-06-13-research-tier-3-kt-bench.md
  - ../../college/scope/asOfReview1/pillarB-assessment-design.md
  - ../../college/scope/asOfReview1/pykt-and-knowledge-tracing.md
  - ../../college/scope/research-build-plan.md
---

## The ask (one line)

Implement **CLST** — *Cold-start mitigation in knowledge tracing by aligning a generative LLM as a
student knowledge tracer* (arXiv:2406.10296, 2024) — as a **real, distinct** candidate in the KT
bench, replacing today's honest-but-placeholder `dkt_clst_config` relabel, so the cold-start story
the thesis is built on is actually backed by the method it cites. **This doc is the requirement; the
next session does the research and writes the phase plan.** Do not start coding from this doc alone.

## Why this exists (decision history — do not relitigate)

- **CLST 2024 is the Pillar-B base paper** (decisions log #5: "Pillar B = CLST 2024 (cold-start KT)").
  The whole project narrative is "build on and improve" two base papers — Islam 2024 (Pillar A) and
  **CLST 2024 (Pillar B)** — where the novelty is the closed loop neither paper does. CLST is not
  optional colour; it is the named extension base for the mastery/verification pillar.
- The KT real-data integration plan (`plans/2026-06-14-kt-realdata-integration.md`) shipped `clst`
  as a candidate, but the implementation **aliased it to DKT** (`train.py: PYKT_MODEL = {"clst":
  "dkt"}`) — CLST was never actually built; pyKT does not ship it.
- The credibility audit (commit `d04057b`) flagged this under gate **G8 (method fidelity / no silent
  alias)**. The agreed interim fix is to **relabel** the alias to `dkt_clst_config` so no table
  claims a method that isn't run. That relabel is the *honest stopgap*. **This doc is the follow-on:
  build the real thing as its own deliberate slice.**

## What CLST actually is (so the next session scopes it right)

From the abstract (arXiv:2406.10296): most KT models are **ID-based** and weak at cold-start; CLST
mitigates this by **using a generative LLM's external knowledge**. The method:

1. **Frames KT as an NLP task** — a learner's problem-solving history is expressed in **natural
   language** (item/concept described in words + the running correctness history).
2. **Fine-tunes a generative LLM** on the NL-formatted KT dataset to predict the next response.
3. **Evaluated in data-scarce (cold-start) settings** — the paper reports gains with **< 100
   students** on prediction, reliability (calibration), and cross-domain generalization, vs ID-based
   baselines.

Implication: CLST is **not a torch sequence model you wire into pyKT** like DKT/AKT/SAKT/Deep-IRT. It
is an **LLM fine-tuning + inference pipeline** in a different paradigm. That is why it is its own
slice and the single highest-complexity cell in the bench.

## Repo state the next session inherits

- **The seam is fixed and must be honoured (D-13/D-14).** Every KT result is a JSON under
  `research/results/kt/{dataset}__{model}__fold{f}__k{k}.json` keyed `{dataset, model, fold, k}` with
  a `_provenance` stamp; the clean-env `join.py` only *reads* these and **must never import the KT
  model stack**. CLST results must use the **same schema** and the **same folds**
  (`research/kt-bench/folds/{dataset}_folds.json`, currently `raw_source: public_raw`,
  nips2020 = 3,935 sequences, accoding = 1,944). Cold-start uses the existing first-`k` truncation,
  `k ∈ {3,5,10,20}`.
- **Models registry / fidelity.** When CLST becomes real, flip its `model_registry` entry from
  alias → distinct method and re-add `clst` (or keep `clst` as the real name and retire
  `dkt_clst_config`). The credibility guard test `test_model_registry` must then accept `clst` as a
  genuine method.
- **Credibility tracker.** Cells **5 (`clst × nips2020`)** and **11 (`clst × accoding`)** in
  `research/doc/2026-06-14-kt-credibility-tracker.md` are the cells this work makes credible. They
  must pass gates **G1 (provenance), G2 (real run depth), G3 (grid complete), G4 (above chance),
  G5 (ECE sane), G6 (cold-start monotone — the headline for CLST), G7 (reproducibility), G8
  (fidelity)**.
- **Environments today:** isolated `research/kt-bench/.venv` is **system Python 3.9.6, CPU
  `torch==2.3.1`, `pykt-toolkit==0.0.38`** — *not* suitable for LLM fine-tuning. The clean
  `research/comparison` `uv` env is numpy-only. **CLST needs a new environment** (see Decisions).
- **Repo norm:** "E2E/heavy envs: write, don't run here" and `CLAUDE.md` ("only write the test, don't
  run"). The fine-tune/inference is **manual-run by the candidate**; the session writes the code +
  a smoke path.

## Data reality — verified, and it constrains the method

CLST's edge is feeding the LLM **item text / external knowledge**. The acquired datasets provide
**concept/tag names and structure, but essentially no item prose.** Confirmed by inspection:

| Dataset | What text exists | What is MISSING | Consequence for CLST |
|---|---|---|---|
| **nips2020** (Eedi) | Concept **names** + hierarchy in `subject_metadata.csv` (`SubjectId, Name, ParentId, Level` — e.g. "Maths → Number → BIDMAS"); per-question `QuestionId → SubjectId` | **No question stem text** — Eedi Task 3/4 questions are **images** (~951 image files in the zip), not text in the CSVs | NL serialization can use concept-name paths + correctness history, but **not the actual question wording**. CLST's "external knowledge" lever is partially blunted. |
| **accoding** (coding) | KP **tag names** in `tags.sql` (e.g. "0-1 Knapsack Problem", "A+B Problem") via `problem_tags`; per-problem `difficulty` | `problems` table has **no title/description column** (only `access_level, test_setting` (JSON of test-case files), `difficulty`, `updated_at`, `creator_id`) — **no problem statement prose** | NL serialization leans on tag names + difficulty + correctness history; again no full item text. |

**This is the single most important research finding to carry forward:** on these two public datasets
you can give the LLM **concept/tag names, hierarchy, and difficulty**, but **not full item stems**.
The next session must decide whether that is enough to reproduce CLST's effect, whether to (a) accept
the limitation and report it, (b) source item text from elsewhere (Eedi question images → OCR/caption;
ACcoding problem statements → not in the dump, would need the live OJ), or (c) frame the contribution
as "CLST-style concept-text tracer" and be explicit about the divergence from the paper. **Do not
silently claim full-CLST fidelity if only concept names are used.**

## Requirements (what "done" means for the eventual plan)

Functional:

- **REQ-1 — Real method.** A genuine CLST candidate: NL-serialize KT sequences, fine-tune a
  generative LLM as the tracer, infer next-response probabilities. No alias to DKT.
- **REQ-2 — Same seam.** Emit `research/results/kt/{dataset}__clst__fold{f}__k{k}.json` on the
  **identical folds**, same schema + `_provenance` stamp (incl. base-model id, adapter hash, seed,
  fine-tune config). The clean-env join/report must consume it with no special-casing.
- **REQ-3 — Calibrated probability.** Produce a real P(correct) per evaluated item (e.g. correct/
  incorrect token logit, or a verbalized-probability readout), so AUC **and** ECE are computable on
  the same basis as the other models.
- **REQ-4 — Cold-start curve.** Reuse the `k ∈ {3,5,10,20}` truncation. This is **the** headline for
  CLST — the plan must make the cold-start curve the primary deliverable, not full-seq AUC.
- **REQ-5 — Fidelity + registry.** Update the `model_registry` so `clst` is a distinct method; the
  `test_model_registry` guard accepts it; retire `dkt_clst_config`.
- **REQ-6 — Credibility.** Cells 5 & 11 reach the bar in the credibility guideline (G1–G8), or are
  recorded `🛑 blocked` with an explicit, honest reason (e.g. "concept-name-only; reported as a
  CLST-style variant").

Non-functional / boundaries:

- **REQ-7 — Env isolation.** The LLM stack lives in its **own** environment (new venv or service),
  never imported by the clean `research/comparison` workspace. The seam stays `results/kt/*.json`.
- **REQ-8 — Reproducibility & cost.** Fixed seed, recorded base model + adapter + fine-tune config;
  a documented runtime/cost note (fine-tune + per-fold inference is far heavier than other models).
- **REQ-9 — Write-don't-run-here.** Code + smoke path written in-session; full fine-tune/inference is
  the candidate's manual offline run.
- **REQ-10 — Honest scope.** Any divergence from the paper (esp. concept-names-only) is stated in the
  report's methods/limitations.

## Key decisions the next session must resolve BEFORE coding (gating forks)

1. **Compute path:** local GPU fine-tune (PEFT/LoRA on an open 7–8B model; needs GPU + newer
   Python/torch + `transformers`/`peft`/`accelerate`/`bitsandbytes`) **vs** a hosted fine-tune/
   inference API. Trade-offs: cost, determinism, data egress (datasets are public, so egress is
   acceptable but note it), reproducibility, and whether a GPU is even available to the candidate.
2. **Base model:** which generative LLM (size, license, instruction-tuned vs base). Must be
   reproducible and citable.
3. **Dataset scope:** both datasets vs **ACcoding-only** first (ACcoding has tag names + difficulty;
   Eedi lacks stems and is image-based — arguably the weaker CLST fit). A staged scope is reasonable.
4. **NL serialization schema:** exactly how a (truncated) sequence becomes a prompt — concept/tag
   names + hierarchy + difficulty + correctness history → "next correct?" — and the inverse readout
   for a probability.
5. **Probability readout:** correct/incorrect token logit vs classifier head vs verbalized
   probability; pick the one that gives well-calibrated scores for ECE.
6. **Item-text strategy:** accept concept-names-only, or invest in sourcing real item text (Eedi
   image OCR/captioning; ACcoding statements aren't in the dump). Decide and record.
7. **Fairness vs the other models:** CLST trains on the same folds, but its "training set" is the
   same learners' sequences serialized to NL — confirm no leakage of held-out test items into the
   fine-tune set, mirroring the other models' fold discipline (D-14).

## Suggested phase skeleton for the eventual plan (a starting point, not the plan)

- **C0 — Research note.** Read the CLST paper in full; write a short `research/doc/` note: exact
  method, the NL format the paper used, how it read out probabilities, what data it had (it had item
  text — flag the gap vs our concept-names-only reality), and the decisions above resolved.
- **C1 — Env + base model + scope decision slice** (no code): resolve the 7 forks; record as a
  decisions log in the plan.
- **C2 — Item-text enrichment + NL serializer** (clean, testable): build the concept/tag-name +
  difficulty + history → prompt formatter and the probability readout; unit-test on a fixture.
  Export the per-fold serialized datasets (the CLST analogue of the sequence sidecar).
- **C3 — Fine-tune + inference harness** in the new env, writing the existing result schema on the
  shared folds; smoke path (tiny subset, 1 step) for sanity; full run is manual.
- **C4 — Calibration + cold-start curve + join + registry flip:** ECE + reliability, the cold-start
  curve as the headline, `model_registry` `clst` → distinct, regenerate `report/generated/kt_*`,
  flip credibility-tracker cells 5 & 11.

## Complexity & risk (set expectations)

- **Highest-complexity cell in the KT bench** — multi-day, research-grade, new infra. The other deep
  models are "wire pyKT's existing class"; CLST is "build a method pyKT doesn't have, in a paradigm
  the bench env doesn't support."
- **Top risks:** (a) **no item stems** on either dataset blunts CLST's core mechanism — biggest
  scientific risk; (b) GPU/cost/availability for fine-tuning; (c) extracting **calibrated**
  probabilities from a generative model; (d) keeping the comparison **fair** (same folds, no
  test-item leakage into the fine-tune set); (e) reproducibility of LLM training.
- **Mitigation:** stage to ACcoding-first; be explicit if it's "CLST-style (concept-text) tracer"
  rather than full-CLST; lean on the **cold-start curve** (CLST's actual claim) rather than full-seq
  AUC for the headline.

## Acceptance criteria (ties back to the credibility gates)

The eventual plan is done when, for `clst × {nips2020|accoding}`:
- **G1–G3** pass (real provenance, full run depth, complete grid, 0 gaps) — same as every other cell.
- **G4/G5** pass (above chance; ECE sane) on real LLM predictions.
- **G6** is the centrepiece — a credible cold-start AUC curve where CLST's low-`k` behaviour is
  competitive/superior (the paper's claim); reported even if full-seq AUC isn't best.
- **G7** pass (seed + base model + adapter + config recorded; re-run reproduces within tolerance).
- **G8** pass (registry says `clst` is a distinct method; `dkt_clst_config` retired).
- The report and tracker state any divergence from the paper honestly (esp. the concept-names-only
  limitation).

## Read-first pointers for the next session

- The CLST paper: arXiv:2406.10296 (abstract summarised above; read the full method + their NL format
  and eval protocol).
- `college/scope/asOfReview1/pillarB-assessment-design.md` (§ "Model: concept-level cold-start KT,
  base paper CLST 2024") and `college/scope/asOfReview1/pykt-and-knowledge-tracing.md` (cold-start
  framing, csKT row).
- `college/scope/asOfReview1/decisions-log.md` #5 (CLST as Pillar-B base paper) and #12 (concept-level
  KT, deep models as offline AUC baselines).
- `plans/2026-06-14-kt-realdata-integration.md` (the seam, schema, folds, env constraints; how the
  other models were wired) and `research/kt-bench/{train.py,coldstart.py}` (the alias to remove and
  the schema to match).
- `research/doc/2026-06-14-kt-credibility-and-validation-guidelines.md` + `…-tracker.md` (gates G1–G8;
  cells 5 & 11).
- Data: `research/kt-bench/data/nips_task34/metadata/subject_metadata.csv` (concept names) and the
  ACcoding `tags.sql` / `problem_tags.sql` / `problems.sql` (tag names + difficulty; **no item prose**
  — verify before designing the serializer).
