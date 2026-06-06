---
title: Pillars, Algorithms, and Base Papers
purpose: List the components and candidate algorithms for each pillar, and the two base papers
audience: candidate, future agents
status: approved
last_updated: 2026-06-06
---

## Pillar A — closed-loop adaptation (components and candidates)

Each component is compared against a baseline offline (see
[phase1-research-plan.md](./phase1-research-plan.md)).

| Component | Chosen technique | Compared against (baselines) |
|---|---|---|
| Pace calibration | Hierarchical Bayesian (global → per-role → per-context) | Simple Moving Average |
| Behavioural-change detection | CUSUM | EWMA, Critical-Slowing-Down (CSD) indicators |
| Progress projection | Gaussian Process regression (with 95% CI) | Linear extrapolation |
| Schedule generation | Constraint-based with role-based material phasing | Rule-based, Dynamic Programming |
| Trend tracking (supporting) | Kalman filter over CUSUM-segmented phases | — |

These already exist in TypeScript (`packages/progress`, `packages/roadmap-engine`); the
research compares them in Python and they become the deployed inference. The TS engines
are R2/R3 deliverables as a deployed product; Phase I focuses on the offline comparison.

## Pillar B — assessment-based verification (components and candidates)

| Component | Chosen technique | Notes / candidates |
|---|---|---|
| Item generation | LLM, concept-tagged items from ingested material | Compare prompting strategies; guard hallucination |
| Answer evaluation | LLM grading (theory) + programmatic/LLM (coding) | Two modalities (theory + code), per guide's request |
| Mastery estimation | **Concept-level** knowledge tracing, cold-start tolerant | BKT (via pyBKT, interpretable) / Deep-IRT as production; DKT/AKT/UKT as offline AUC baselines |
| Concept (KC) extraction | LLM tags each generated item with a concept | The bridge that lets KT trace mastery over generated, unique items |
| Review placement | Spaced-repetition-informed scheduling | When to place assessments in the roadmap |

Key adaptation: standard KT assumes a fixed item bank answered by many learners. This
project has **LLM-generated, per-learner, often-unique items** and **one learner**, so KT
is done at the **concept level** (mastery of concepts, not items) and must tolerate
cold-start. This is itself a Phase-II novelty hook. See
[pykt-and-knowledge-tracing.md](./pykt-and-knowledge-tracing.md).

**Assessment style** (decided 2026-06-06): the learner selects their assessment style.
Two committed tiers:
- **Tier 1 — presets:** Generic or Exam-realistic (mirrors a declared target exam: timer, section structure, marks/negative-marking).
- **Tier 2 — build-your-own pattern:** learner composes their own pattern from a fixed gradable palette (sections, item types, marks, timing, negative marking). One pattern schema underlies both tiers.

Tier-3 dynamic inference (NLP/past-paper → spec) was considered and explicitly rejected
as out of scope. See [pillarB-assessment-design.md](./pillarB-assessment-design.md) for
the full design including what parameters remain under user research.

## Base papers

A single primary base paper per pillar (the work it extends); novelty = the verified
closed loop neither base paper does.

| Pillar | Base paper | What I extend |
|---|---|---|
| A | **Islam et al. (2024)** — predict-then-optimize (ANN grade prediction + dynamic-programming schedule), IEEE ICCIT | static → adaptive (Bayesian/GP); course-level → session-level; one-shot → closed-loop; point estimate → calibrated uncertainty |
| B | **CLST (2024)** — Cold-Start Mitigation in Knowledge Tracing (aligns a generative LLM as a student knowledge tracer), arXiv:2406.10296 | fixed-bank, many-learner KT → concept-level KT over LLM-generated items, single-learner, as an honest-signal verifier |

Supporting anchors: Pagano 2026 (adaptive-vs-static evaluation design); Chen 2024
(hierarchical Bayesian feasibility, N=312); Saqr 2026 (CSD detection in real education);
Pérez-Suay 2024 (GP on educational data). For Pillar B: the lecture-to-quiz local-LLM
paper, concept-tagging papers, gaming-the-system paper.

## See also

- [phase1-research-plan.md](./phase1-research-plan.md) — how these algorithms are compared.
- [pykt-and-knowledge-tracing.md](./pykt-and-knowledge-tracing.md) — KT models in depth.
- `../../mydeliverables/zero/literatures/pillarB-selected.md` — full Pillar B paper list.
