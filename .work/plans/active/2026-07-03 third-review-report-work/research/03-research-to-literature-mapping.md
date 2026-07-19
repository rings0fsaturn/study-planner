---
title: Research-to-Literature Mapping — which papers support which algorithm
status: durable reference (third-review-report-work research stage 3)
last_updated: 2026-07-03
scope: >
  Every literature-survey artifact in the repo (raw DOI candidate lists, the automated
  scoring pipeline, the curated shortlist, and the dissertation's final 48-entry
  bibliography), cross-referenced against the actual research workstreams found in
  research/ (Stage 2) so each algorithm/model has a named evidentiary trail — and so gaps
  (literature with no corresponding implementation) are visible rather than implied.
sources: One research-agent trace over college/mydeliverables/zero/literatures/*,
  college/mydeliverables/1st-Review/literature-survey-draft.md, main.tex's
  thebibliography block and \cite{} sites, plus this session's Stage-2 research inventory.
---

# Research ↔ Literature Mapping

## 1. Provenance pipeline (how a paper reaches the dissertation)

Two parallel curation pipelines converge into `main.tex`'s 48-entry `thebibliography`:

```
Pillar A: dois-pillarA.txt (107 raw candidates)
            -> hand-curated into pillar-candidates.md (5 topic clusters, ~21 papers)
            -> literature-survey-draft.md -> main.tex §2.1
            (NOT run through the automated scorer — manually triaged)

Pillar B: dois.txt (184 raw candidates, both pillars)
            -> evaluate_papers.py (CrossRef/OpenAlex/arXiv/Zenodo metadata + keyword-cluster scoring)
            -> evaluated_papers_pillarB.json (158 scored + 26 arxiv_failed)
            -> pillarB-selected.md (curated ★anchor/🔗bridge shortlist, overrides raw score)
            -> literature-survey-draft.md -> main.tex §2.2
```

**Scoring methodology** (`evaluate_papers.py`): 12 weighted keyword clusters
(`bayesian_calibration` 1.0, `change_point_detection` 1.0, `gaussian_process` 0.9,
`adaptive_scheduling` 0.9, `self_regulated_learning` 0.7, `spaced_practice` 0.7,
`student_performance` 0.5 — deliberately low-weighted catch-all, `knowledge_tracing` 1.0,
`question_generation` 1.0, `answer_evaluation` 0.8, `assessment_integrity` 1.0,
`concept_extraction` 0.8), thresholded into STRONG (≥3.0) / GOOD (≥1.5) / PARTIAL (≥0.5) /
WEAK fit. This score is **advisory, not decisive** — final selection in `pillarB-selected.md`
overrode it based on topical-fit-per-theme and thesis-narrative relevance (e.g. several
STRONG-FIT KT papers were dropped as redundant once one exemplar per sub-theme was chosen).

**Known methodology gap**: the arXiv fetch path in `evaluate_papers.py` silently failed for
all 26 `10.48550/arXiv.*` DOIs submitted. Manual recovery (13 via WebFetch, 13 via OpenAlex)
was required — and that recovery set includes the **Pillar-B base paper itself** (`clst2024`)
plus 5 other final bibliography entries. Without the manual catch, the automated pipeline
would have silently dropped its own anchor paper.

## 2. Pillar A — algorithm ↔ literature, with implementation status

| Algorithm / model (in `research/comparison`) | Production status (Stage 1/2) | Supporting `main.tex` citations | §2.1 subsection |
|---|---|---|---|
| Bayesian hierarchical pace calibration (`compute_hierarchical_model`, the plain-Bayesian baseline) | **Live** — computed first in every `/v1/calibration` call, but its `globalMultiplier` is overridden before reaching the client (see Doc 1 §3.6) | `chen2024` (hierarchical Bayesian teaching model), `zanellati2024` (BKT+ML hybrid survey), `zambrano2024` (BKT fairness/bias), `mai2025` (Transformer-Bayesian hybrid KT) | §2.1.1 |
| `enriched_shrink` / `enriched_dual_prior` (10-feature ridge+shrink log-linear regression, dual population-prior ensemble) | **Live** — this IS the production override (`packages/py-progress/src/py_progress/enriched.py`, hyperparameters `ridge=2.0, shrink=6.0` byte-identical to the research harness's candidate) | Not directly cited by name (it's this dissertation's own contribution, benchmarked against baselines drawn from `chen2024`/`zambrano2024`'s line of hierarchical/context-aware calibration work) | §2.1.1, §2.5 (Proposed Solution) |
| CUSUM change-point detection (`run_cusum`, production) | **Live**, but see gap below | `saqr2026` (critical-slowing-down / early-warning indicators), `qiao2026` (ML for statistical process control — i.e. CUSUM/EWMA family), `boca2024` (change detection + continual learning), `cheng2024` (behavioral-change modelling) | §2.1.2 |
| `detect_cusum_robust` (dual-arm, MAD-robust z-score, grid-tuned) — the version actually benchmarked as the winning detector | **Research-only** — production's `run_cusum` is a simpler single-arm, mean/std-based CUSUM with generic factors (`CUSUM_SLACK_FACTOR=0.5, CUSUM_THRESHOLD_FACTOR=4.5`), not the tuned dual-arm design (`step_h=2.5/step_k=0.25`, `drift_h=4.5/drift_k=0.15`) that `research/results/detection/detection_results.json` shows winning. **The literature-supported, benchmark-winning detector was not the one ported to production.** | same as above | §2.1.2 |
| GP burn-up projection (`fit_burn_up_gp`, RBF kernel) | **Live** (`packages/py-progress/src/py_progress/gp.py`, imported directly by both the app and `research/comparison`'s `forecast_gp_finish` baseline — i.e. research literally benchmarks the production function) | `perezsuay2024` (GP regression on Moodle logs), `chenyao2025` (GP + metaheuristic optimization), `lin2024` (scalable GP learning-curve prediction), `huang2025` (GP classifier), `kayande2025` (multi-modal engagement/dropout ML) | §2.1.3 |
| GP cold-start/non-crossing composite (`gp_plus_analytic`) | **Live** — `research-eta-model-selection` R4 (2026-06-30) validated this composite (beats plain GP on cold-start plans only); `packages/progress/src/projectFinish.ts` (2026-07-01) promotes the identical design (`COLD_START_N=5`, same branching) one day later. **Corrected 2026-07-03** — an earlier pass of this doc did not check this. | `perezsuay2024`, `lin2024` (GP-projection literature base) | §2.1.3, §2.5 (Proposed Solution) |
| Split-conformal interval correction (`forecast_conformal_finish`) | **Research-only, still a genuine gap.** `research/results/projection*/projection_results.json` (both frozen and the 2026-06-30 decoupled re-run) shows the plain GP under-covers (~0.19–0.49 actual vs 0.95 nominal by band) and conformal correction reaches proper coverage (~0.91–0.99 by band); grep confirms `conformal` appears nowhere in `packages/progress/`, `packages/py-progress/`, or `apps/app/src/`. **Distinct from the cold-start composite above** (which was promoted) — production ships the poorly-calibrated GP interval for any plan past the cold-start threshold, without the literature-motivated fix the research itself identifies as necessary. | `perezsuay2024`, `lin2024` (both underpin the GP-projection literature base this finding was tested against) | §2.1.3, §2.4 (Limitations) |
| Adaptive scheduling — `dp_capacity`, `local_search_repair`, `topological_prereq` (beat the pre-redesign incumbent in `research/results/scheduling/scheduling_results.json`) | **Not a gap — explicitly retired by product decision, 2026-06-30.** `.work/plans/active/2026-06-30-material-session-decoupling/DECISIONS.md` D1 drops "prescriptive day-by-day packing" entirely (bookings are now blank, material chosen at session start); §5c states outright: *"Dropped: the scheduling track (constrained packer retired...)."* The problem these algorithms solved no longer exists in the product. **Corrected 2026-07-03** — an earlier pass of this doc mischaracterized this as an unaddressed gap; see `02-research-to-app-mapping.md` §1 for the full correction. | `islam2024` (base paper — predict-then-optimize DP scheduling), `fabregar2025`, `pagano2026`, `liu2025` — these citations describe the *retired* research question, not a live production gap | §2.1.4 |
| `schedule_rule_based`-family role-tagging (anchor→foundation→practice phase-priority heuristic) | **Live**, but now understood as a deliberately lighter mechanism for a smaller, different problem (session-phase guidance for the booking model), not the same optimization problem `dp_capacity` et al. were benchmarked against. `packages/roadmap-engine/src/roadmap-engine.ts` (phase-priority tables, `roleOrder`/`checkAnchorStride`) | `islam2024` remains the base paper this heuristic notionally descends from, though the comparison to DP/graph alternatives above no longer applies post-redesign | §2.1.4 |
| Self-regulated-learning (SRL) trace analytics | **Not implemented as a distinct engine** anywhere in `research/` or the app — no SRL-specific metric, trace-tagging, or rubric exists in the codebase | `alhazbi2024` (SRL measurement systematic review), `debarba2025` (SRL rubric validation), `uzun2025` (SRL + feedback engagement), `butt2025` (hybrid ML/rough-set at-risk detection) | §2.1.5 — **pure literature grounding with no corresponding implementation; closest analog is the app's manual "mark session unusual" exceptional-tagging feature, which is not SRL-theoretic** |

**`research/doc/2026-06-20-change-detection-literature-survey.md` is a separate, unmerged trail** — an
internal Phase-6 research memo surveying KSWIN/MMD, residual-coupled DDM/HDDM/RDDM, e-detectors, and
hierarchical composition detectors as candidates to beat the CUSUM/CSD baseline. It cites its own
reference list (Lu et al. 2019, Gama et al. 2014, Aminikhanghahi & Cook 2017, Shin/Ramdas/Rinaldo
2023, Alippi/Boracchi/Roveri 2017) — **none of which appear in `main.tex`'s bibliography**. Its
conclusion (a "robust null" — no new detector family beats the existing CUSUM/CSD frontier,
reconfirmed across 3 iterations in `research/scripts/unified_detector_sim.py` v1→v3) is a genuine
research finding but currently lives outside the citation trail that would connect it to §2.1.2.

## 3. Pillar B — model/technique ↔ literature, with implementation status

| Model / technique | Production or research status | Supporting `main.tex` citations | §2.2 subsection |
|---|---|---|---|
| pyBKT (classic Bayesian Knowledge Tracing) | **Research-only** (`research/kt-bench`), and only 1 of its 2 dataset cells is credible — `accoding×pybkt` fails the ECE gate (0.272 > 0.25 threshold), `nips2020×pybkt` is fully **blocked** (AUC 0.509, degenerate) | `zanellati2024`, `zambrano2024` (BKT survey/fairness — same citations reused from §2.1.1) | §2.2.1 |
| DKT / AKT / deep_irt / SAKT (deep KT models via pyKT) | **Research-only**, 9 of 12 model×dataset cells credibility-gated as reportable; `akt` is the best full-sequence AUC on both datasets (0.763 NIPS2020, 0.718 ACcoding) | `dkvmn2024` (deep KT/DKVMN), `slam2026` (multi-concept KT), `su2025` (question-info-integrated KT), `conceptkt2026` (concept-driven KT + forgetting), `graphkt2025` (graph KT) | §2.2.1 |
| **CLST** (LLM-fine-tuned-as-tracer, cold-start focus) — the Pillar-B *base paper* | **Not implemented at all.** `research/doc/2026-06-14-clst-llm-tracer-requirements.md` is a requirements-only doc (REQ-1…10); the `dkt_clst_config` model-registry entry is explicitly labeled `distinct_method:false, alias_of:"dkt"` — an honest relabel of what the registry calls out as a previously-mislabeled DKT run, not a real CLST implementation. Blocked on needing a separate LLM environment. | `clst2024` | §2.2.1 |
| MAML-KT (few-shot meta-learning cold-start) | **Not implemented** — literature-only, no corresponding code found in `research/` | `maml2026` | §2.2.1 |
| Automatic item/question generation (LLM-based) | **Not implemented** — no LLM item-generation code exists anywhere in the repo (`research/` or `apps/`) | `itemgen2024`, `lecturequiz2026`, `nikolovski2025`, `burke2025`, `alamoudi2025` | §2.2.2 |
| Concept/knowledge-component extraction & tagging | **Not implemented** | `kctag2024`, `concepttag2024`, `qmatrix2026`, `hendrawan2026`, `keenkt2026` | §2.2.3 |
| Automated answer evaluation / LLM grading | **Not implemented** | `llmgrade2024`, `essay2024`, `jukiewicz2026`, `senanayake2024`, `baral2024` | §2.2.4 |
| Assessment integrity / gaming-the-system detection | **Not implemented** | `gaming2026`, `integrity2024`, `erdem2025` | §2.2.5 |
| Spaced-repetition review scheduling | **Not implemented** — the app has no review-interval/spaced-repetition scheduler; roadmap scheduling is one-shot capacity packing only | `spaced2025`, `retrieval2025`, `conceptkt2026` (reused) | §2.2.6 |

**The KT-bench (`research/kt-bench`) is the only Pillar-B workstream with actual running code**,
and it covers exactly one of eight §2.2 subsections (knowledge tracing itself — and even there, not
the base paper's own method, CLST). The other seven literature clusters (question generation, concept
extraction, answer evaluation, integrity, spaced repetition) are **pure literature survey with zero
experimental or production counterpart** anywhere in this repository. This is worth stating plainly
in the dissertation's scope/limitations framing: Pillar B's *literature* is broad (27 of 48 final
citations), but its *implemented* research is narrow (one benchmark: 5 KT model architectures on 2
datasets), and **none of Pillar B — including the implemented KT-bench — has any integration point
into the shipped web app** (confirmed in Stage 1: no page, hook, or engine in `apps/app/src`
references quizzes, assessments, knowledge tracing, or any Pillar-B concept).

## 4. Candidate-to-final selection density (for methodology transparency)

| List | Candidates | Made the final 48-entry bibliography |
|---|---|---|
| `dois-pillarA.txt` (raw) | 107 | ~21, via `pillar-candidates.md` curation |
| `pillar-candidates.md` Pillar-A clusters | 21 | 19 (2 final entries — `qiao2026`, `boca2024` — were pulled directly from the raw list outside the shown clusters) |
| `dois.txt` (raw, both pillars) | 184 | 27 Pillar-B entries draw from this + the arXiv-recovery set |
| `evaluated_papers_pillarB.json` scored entries | 158 (58 STRONG, 52 GOOD fit) | ~21 of 27 Pillar-B entries trace to a scored row; 6 are the arXiv-recovery set that never got scored |
| `pillarB-selected.md` shortlist | ~26 named papers | 27 (near-1:1 — this file *is* the effective final Pillar-B selection) |

Explicitly rejected as keyword false-positives (flagged in `pillarB-selected.md`'s own notes): a
military-medicine self-report/psychiatric paper, an astrophysical-ices paper, and a duplicate
"Teaching and Learning in the Digital Era" DOI entry — all matched cluster keywords spuriously and
were dropped on inspection. Selection overall favored **topical coverage across sub-themes** over raw
keyword score — several higher-scoring KT/AQG papers were left out once one exemplar per sub-theme was
already chosen, while at least one modest-scoring paper (`spaced2025`, GOOD FIT 1.6) was kept because
it was the best available fit for a specific narrative role (review-timing) that higher-scoring papers
didn't address.

## 5. Summary for the dissertation's related-work chapter

- **Pillar A's literature-to-implementation trail is tight and mostly honest**: every implemented
  algorithm family (Bayesian calibration, CUSUM detection, GP projection, heuristic scheduling) has
  direct citation support. Two genuine variant gaps remain, both quantified in `research/results/` and
  documented rather than glossed over: the dual-arm tuned CUSUM vs. production's simpler single-arm
  CUSUM, and split-conformal GP interval correction vs. production's uncorrected GP interval. A third
  apparent gap (scheduling: DP/graph methods vs. the shipped heuristic) turned out, on closer
  cross-referencing with `.work/plans/active/2026-06-30-material-session-decoupling/`, to be a
  **retired research question** (the packing problem those algorithms solved no longer exists
  post-redesign), not a gap — and a fourth (GP cold-start behavior) turned out to already be
  **promoted** (`packages/progress/src/projectFinish.ts`, one day after validation). See Doc 2 §1/§3
  for the full, corrected research→app accounting.
- **Pillar B's literature-to-implementation trail is broad-but-shallow**: the literature review spans
  8 sub-themes and 27 citations, but only 1 sub-theme (knowledge tracing) has running code, that code
  doesn't implement its own base paper's method, and none of it reaches the shipped app. This asymmetry
  is worth stating explicitly rather than letting the citation count imply broader implementation than
  exists.
