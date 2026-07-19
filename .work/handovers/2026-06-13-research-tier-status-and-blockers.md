---
title: Research Tier — Status & Blockers (for R2 guidance call)
purpose: Summarise what is implemented in the /research tier as of 2026-06-13, and surface the knowledge-tracing dataset blocker, so this can be turned into a status PPTX for the 2nd guidance call.
audience: candidate (Rohit Saji), guide/advisor
status: status-snapshot
last_updated: 2026-06-13
related:
  - ../plans/2026-06-13-research-tier.md
  - ../plans/2026-06-13-research-tier-1-foundation.md
  - ../plans/2026-06-13-research-tier-2-pillar-a-fanout.md
  - ../plans/2026-06-13-research-tier-3-kt-bench.md
  - ../plans/2026-06-13-research-tier-4-validation-outputs.md
  - ../college/scope/research-build-plan.md
---

## One-line status

The **offline `/research` tier is built and runnable end-to-end**. **Pillar A (adaptation) is complete with genuine results** — a full Monte-Carlo algorithm comparison across all four components, every figure/table auto-generated and provenance-stamped. **Pillar B (knowledge tracing) is complete as a *pipeline*, but its numbers are placeholders**: the two public benchmark datasets it needs (Eedi NeurIPS-2020 Tasks 3 & 4, and the POJ coding log) are **no longer reachable**, so the bench currently runs on a tiny smoke fixture. Report/journal wiring and the N=1 case study (the final part) are not started.

## Status at a glance

| Phase (tracker) | What | Status |
|---|---|---|
| 0 Scaffold & environment | `research/` tree, uv workspace member, frozen-param loader, provenance stamp, Makefile | ✅ Done |
| 1 Synthetic generator | 6 archetypes × 3 length-bands, ground-truth sidecar, seed-deterministic | ✅ Done |
| 2 Calibration (tracer bullet) | Bayesian vs SMA/EWMA/pooled, convergence curve + winner table | ✅ Done (genuine) |
| 3a Change detection | CUSUM vs EWMA-chart vs CSD, latency-vs-false-alarm per shift-type, ROC | ✅ Done (genuine) |
| 3b Projection | GP vs linear vs Kalman, CI coverage + finish-date error | ✅ Done (genuine) |
| 3c Scheduling | greedy vs DP vs rule-based, deadline drift / capacity / prereq order | ✅ Done (genuine) |
| 3d Oracles + sensitivity sweep | upper-bound baselines + robustness heatmap over the param grid | ✅ Done (genuine) |
| 7 Closed-loop machinery | built + archived; **deliberately held for Phase II** | ✅ Done (not shown in Phase I) |
| 4 Knowledge-tracing bench | pyBKT + DKT/AKT/Deep-IRT/SAKT/CLST, cold-start curve, ECE | ⚠️ **Pipeline done, numbers are placeholders — dataset blocker** |
| 5 N=1 real-data validation | own-session face-validity + case study | ☐ Not started |
| 6 Report/journal wiring | `\input` generated tables/figures into the report; reproducibility gate | ☐ Not started |

Counting Phase 0 as setup, **7 of 8 phases are functionally complete; 1 is blocked on data; 2 remain.**

## What's done — Pillar A (adaptation): genuine, complete

This is the strong part of the story and is ready to present.

- **Synthetic learner generator** with **known ground truth.** Six literature-anchored archetypes (Steady, Morning-Lark, Fading-Flame, Weekend-Warrior, Deadline-Sprinter, Marathon-Runner) across three journey-length bands (Small / Medium / Max). Parameters were **pre-registered and frozen before any comparison was run** (params hash `e716cd12dddc`), the generator is **seed-deterministic** (same seed → identical bytes), planted regime shifts are labelled in a sidecar, and emitted sessions are clipped to a physically plausible range (<2% clip rate enforced as a test).
- **A genuine, not rigged, multi-candidate comparison** for all four Pillar-A components. The shipped engines (`py-progress`, `py-roadmap-engine`) are imported as *peer candidates* — never re-implemented — and compete against research-only baselines. Each result is a **paired test (Δ, p-value, effect size) over a real Monte-Carlo run of 720 learners** (6 archetypes × 3 bands × 40 seeds):
  - **Pace calibration** — Hierarchical Bayesian vs SMA / EWMA / pooled Bayesian → convergence curve + winner table.
  - **Change detection** — CUSUM vs EWMA control-chart vs Critical-Slowing-Down, scored **per shift-type** (step vs drift) with a ROC, so no detector wins by construction.
  - **Projection** — Gaussian-process vs linear vs Kalman → 95% CI coverage, interval sharpness, finish-date error.
  - **Scheduling** — greedy (incumbent) vs DP vs rule-based → deadline drift, capacity-violation, prerequisite order, generation time.
- **Oracle upper-bound baselines** (confirm each task is even solvable before reading candidate results) and a **sensitivity sweep** over the pre-registered parameter grid with a **robustness heatmap** (does the winner ranking hold as noise/shift sizes change?).
- **Every artifact is auto-generated and provenance-stamped** — convergence PDF, detection latency figure, projection reliability plot, scheduling table, robustness heatmap, plus booktabs `.tex` tables — each carrying the seed + generator version + params hash.
- **The closed loop** (calibration → re-plan feedback) is **built and archived but intentionally not presented in Phase I** — it is the headline novelty reserved for Phase II.

**Test coverage:** 9 pytest suites in the clean environment, green at their commits (generator determinism + oracle recovery, calibration/detection/projection/scheduling tracks, oracles+sweep, closed-loop, KT join boundary).

## What's done — Pillar B (knowledge tracing): pipeline complete, numbers are placeholders

The **entire KT benchmark pipeline is built, isolated, and runs end-to-end** — this is real engineering progress:

- A **quarantined environment** (`research/kt-bench/`, own pinned PyTorch + pyKT venv, kept out of the main lockfile) so a heavy/fragile deep-learning stack can never break the Pillar-A pipeline. The two worlds talk only through `research/results/kt/*.json`; the clean harness reads those and never imports torch/pyKT (enforced by a test).
- **Preprocessing + shared 5-fold split export**, **five models** (pyBKT, DKT, AKT, Deep-IRT, SAKT, plus the CLST cold-start method), a **cold-start AUC harness** (first k ∈ {3, 5, 10, 20} interactions), **ECE / reliability calibration**, and a **clean-env join → cold-start curve, reliability diagram, full-seq AUC table, ECE table** (360 result rows, zero grid gaps).

**The catch:** every KT result is stamped **`folds_raw_source: smoke_fixture`**. Because the real raw datasets are unreachable (see blocker), preprocessing fell back to a deterministic 12-learner synthetic fixture. So the AUC / cold-start / ECE values produced so far are **placeholders that prove the plumbing works — they are NOT real benchmark results** and must not be reported as findings. The report even carries an honest note to this effect (`report/generated/kt_provenance.txt`: "Fold raw sources: smoke_fixture").

## 🚩 Blocker — the KT benchmark raw datasets are unreachable

**What's needed:** the raw logs the plan specified —
1. **Eedi / NeurIPS 2020 Education Challenge, Tasks 3 & 4** (`train_task_3_4.csv`; pyKT's `nips_task34` / NIPS34) — the MCQ modality.
2. **POJ knowledge-tracing raw log** (`poj_log.csv`) — the coding modality.

**What happened:** these were historically distributed via the CodaLab competition page and an Azure blob link (and POJ via dataset mirrors). Those sources are now dead/inaccessible, so neither raw file could be fetched. The bench therefore ran on smoke fixtures.

**Why it matters:** Pillar B's intended R3 deliverable — the **"verify genuine learning" story: real cold-start AUC + mastery calibration (ECE) on public benchmarks** — currently has **no real numbers**. It is the only piece of the comparison that depends on external data we don't control.

**Good news / containment:** the blocker is **purely data access, not engineering.** The pipeline is data-source-agnostic — drop the real raw files under `--raw-root` and re-run `make kt`, and real folds replace the smoke ones automatically (the smoke provenance stamp makes the swap auditable). Pillar A is entirely unaffected.

### Options (decision to raise with the guide)

| Option | What it means | Trade-off |
|---|---|---|
| **A. Get official Eedi access** | Request the NeurIPS-2020 / Eedi dataset via a data-sharing agreement (it now generally requires a request rather than an open link) | Most faithful to the plan; lead-time/approval risk before R3 |
| **B. Substitute durable pyKT benchmarks** | Swap Eedi (MCQ) for **ASSISTments-2009/2015** or **Algebra-2005 / Bridge-2006** — classic, still-distributed, pyKT-bundled math KT sets | Keeps cold-start AUC + ECE methodology intact with *real* data; loses exact "Eedi MCQ" framing |
| **C. MCQ-only for R3, coding pending** | Run KT on one real MCQ dataset now (via B); document POJ/coding KT as pending while a source is found | Unblocks the headline cold-start result; coding modality deferred |
| **D. Proceed on placeholders, swap later** | Present the *methodology + working pipeline* now; backfill real numbers once data lands | De-risks the R3 timeline; numbers arrive late |

**Recommended framing for the call:** lead with B+D — the methodology and full pipeline are done and demonstrable today; pick a still-available benchmark (ASSISTments/Algebra) to produce *real* cold-start + ECE numbers without waiting on Eedi approval, and treat POJ/coding as a follow-up. (This is your call to confirm with the guide.)

## What's left (after the blocker is resolved)

- **Phase 5 — N=1 real-data validation** (not started): export your own logged study sessions, overlay real-vs-synthetic distributions for generator face-validity, and run your sessions through the harness as a feasibility case study — explicitly *no* performance claims from N=1.
  - ⏰ **Start logging your own study sessions in the app now.** This can't be compressed later; you want ~15–25 real sessions by R3.
- **Phase 6 — Report & journal wiring** (not started): the generated figures/tables already exist in `report/generated/`; this phase `\input`s them into `main.tex`, adds provenance footnotes, builds the IMRAD journal skeleton, and adds a reproducibility gate (clean clone → `make all` → report compiles, 0 undefined refs).

## Minor environment notes (rigour / reproducibility)

These were handled and recorded; worth a line if asked about reproducibility:

- KT bench pinned to `pykt-toolkit==0.0.38` (0.0.39 was not on PyPI) and `torch==2.3.1`; its venv runs on system Python 3.9.6 because `uv python install 3.12` failed on this machine.
- `pyBKT` constrained to `>=1.4,<1.4.2` (a build whose metadata mis-reports its version); a narrow, process-local import shim works around a pyBKT/sklearn incompatibility on the clean Python stack.
- Scheduling derives neutral `(materials, capacity, deadline)` inputs from each learner's sessions, since Part 1 datasets don't persist explicit scenario tuples; schedulers still receive inputs only (no learner execution), preserving the intended neutrality.

## Suggested slide outline for the PPTX

1. **Title / context** — Adaptive Study Planning; the offline `/research` tier is what evaluators grade.
2. **Status at a glance** — the phase table above (green Pillar A, amber KT, grey remaining).
3. **Pillar A — done & genuine** — the four-track comparison, 720-learner Monte-Carlo, pre-registered params, one example figure (convergence or detection ROC).
4. **Rigour highlights** — pre-registration, oracle baselines, sensitivity sweep, paired tests, full provenance stamping (this is the methodological selling point).
5. **Pillar B — pipeline built** — the isolated bench, shared-fold fairness, cold-start + ECE design; one diagram of the two-environment boundary.
6. **🚩 Blocker** — Eedi (NeurIPS-2020 Tasks 3&4) + POJ raw data unreachable → KT numbers are placeholders today.
7. **Options & ask** — table A–D; your recommendation (B+D); the decision you need from the guide.
8. **What's next** — Phase 5 (N=1, start logging now) + Phase 6 (report/journal wiring) → R3 readiness.

## Evidence / pointers

- **Plans (with per-phase completion shas):** [`../plans/active/2026-06-13-research-tier.md`](../plans/active/2026-06-13-research-tier.md) (index) and parts 1–4.
- **Commit trail:** `Phase 0 … Phase 7 … Phase 4a/4b/4c` (each with a "record completion sha" commit); `Phase 4c: expose KT raw-source provenance`.
- **Genuine Pillar-A results:** `research/results/{calibration,detection,projection,scheduling,sweep}/…json` — provenance `n_learners: 720`, params hash `e716cd12dddc`, seed 0.
- **Placeholder KT results:** `research/results/kt/*.json` — provenance `folds_raw_source: smoke_fixture`; honest note in `college/mydeliverables/1st-Review/report/generated/kt_provenance.txt`.
- **Generated, ready-to-wire artifacts:** `college/mydeliverables/1st-Review/report/generated/` (calibration / detection / projection / scheduling / robustness PDFs + `.tex`; KT figures/tables present but placeholder-backed).

## Sources (dataset availability)

- [Diagnostic Questions: The NeurIPS 2020 Education Challenge (arXiv 2007.12061)](https://arxiv.org/abs/2007.12061)
- [The NeurIPS 2020 Education Challenge — results (PMLR v133)](http://proceedings.mlr.press/v133/wang21a/wang21a.pdf)
- [pyKT: A Python Library to Benchmark Deep Learning based Knowledge Tracing Models (arXiv 2206.11460)](https://arxiv.org/pdf/2206.11460)
- [pyKT datasets documentation](https://pykt-toolkit.readthedocs.io/en/latest/datasets.html)
