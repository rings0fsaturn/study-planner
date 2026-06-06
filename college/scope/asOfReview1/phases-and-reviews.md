---
title: Phases, Reviews, and What Each Phase Covers
purpose: Document the PES review structure and the Phase-I / Phase-II scope split per pillar
audience: candidate, future agents
status: approved
last_updated: 2026-06-06
---

## PES review structure (authoritative, from the guidelines PDF)

The M.Tech project runs over two phases, each with three internal reviews plus a final
review. **Phase I has four touchpoints** (Zeroth + First + Second + Third);
**Phase II has three** (First + Second + Third). Phase II is explicitly the **novelty**
phase. Total marks 400 (240 internal, 160 external viva).

### Phase I — Research Objective 1

| Review | Deliverables | Code |
|---|---|---|
| Zeroth ✅ done | Title & Abstract, Introduction, Literature Survey, Proposed System, Timeline, References | — |
| **First — 7 Jun 2026** | Title & Abstract, Architectural Design, Algorithms/Techniques, Expected outcomes, References | **30%** |
| Second | Detailed Algo Design, Candidate contribution, Intermediate results, References | **80%** |
| Third (final) | Overall Design, Experimental Results, Performance Evaluation, **Model Comparison**, References, Demo, Journal paper draft | **100%** |

### Phase II — Research Objective 2 (focus on NOVELTY)

| Review | Deliverables | Code |
|---|---|---|
| First | Phase-1 Review, **Novelty proposal**, Proposed System (Phase II), Algorithms/Techniques, Expected outcomes, References | **40%** |
| Second | Modified Algorithm Design, Candidate contribution, Intermediate results, References | **80%** |
| Third (final) | Overall Design (I+II), Experimental Results, Performance Evaluation, Comparison with Existing systems, References, Demo, **Journal publication proof** | **100%** |

## What Phase I is about

Phase I builds and evaluates the **open-loop** system and **researches** the assessment
options:

- **Build (Pillar A, open-loop):** session logging + event store + data model (the "30%"
  for First Review), then the static schedule generator and progress dashboard.
- **Research (Pillar A):** offline comparison of candidate algorithms for each component
  (calibration, detection, projection, scheduling) on synthetic data with known ground
  truth, plus a synthetic data generator (itself a contribution).
- **Research (Pillar B):** survey and *design* the assessment-verification approach —
  which assessment method, item-generation approach, knowledge-tracing model, placement
  cadence, and LLM-cost model. **No Pillar B build in Phase I.**

Phase I is deliberately **entirely open-loop** — calibration is computed but not yet fed
back into rescheduling. (Conveniently, the existing app is already open-loop: the
calibration multiplier is computed but unused.) This preserves the novelty for Phase II.

## What Phase II is about (the novelty)

Phase II **closes the loop** and **builds** the assessment subsystem:

- Wire calibration → rescheduling; CUSUM regime shifts → replan triggers; GP projection
  uses calibrated multipliers.
- Implement the concrete assessment approach chosen in Phase I: LLM item generation
  grounded in ingested material, answer evaluation, concept-level knowledge tracing,
  placement policy.
- Evaluate **closed-loop + verified vs open-loop + unverified** on schedule adherence and
  measured learning gain.

## Phase split per pillar

| Pillar | Phase I | Phase II |
|---|---|---|
| A — adaptation | Build open-loop baseline; compare algorithms offline | Close the loop (calibration feeds rescheduling) |
| B — verification | Research options (survey + design, no build) | Build the chosen approach = the mandated novelty |

## Phase I — concrete deliverables per review

| Review | My concrete deliverables | Code milestone |
|---|---|---|
| **R1 — 7 Jun 2026** | Two-pillar architecture + algorithms; expected outcomes (per-component metric + baseline + hypothesis); 48 references (12 anchors); data-capture foundation built | Session logging + per-user event store + auth + cloud sync |
| **R2 ~21 Jun** | Detailed algorithm design; synthetic data generator built; 4-component algorithm comparison + intermediate results; static scheduler + dashboards | Scheduler + dashboards + data generator + comparison scripts |
| **R3 ~5 Jul** | Full model comparison vs baselines; performance evaluation (synthetic + public KT); open-loop planner demo; draft journal paper | 100% open-loop platform |

## Phase II — concrete deliverables per review

| Review | My concrete deliverables | Code milestone |
|---|---|---|
| **R1 · 40%** | Stand up Python Intelligence Service (FastAPI); migrate Pillar-A engines TS→Python; close loop v1 (calibration→reschedule); lock Pillar B design from user research; item-generation prototype; novelty proposal + Phase-II expected outcomes | Python service live; first loop wired |
| **R2 · 80%** | Full loop (CUSUM→replan triggers; GP uses calibrated pace); Pillar B auto-grading (code + theory) + cold-start KT→mastery; Tier-1 presets + Tier-2 pattern builder; intermediate results (closed-vs-open; KT-AUC on Eedi/POJ) | Full verified loop + Pillar B |
| **R3 · 100%** | End-to-end verified closed loop on real + synthetic data; full eval (closed + verified vs open + unverified — adherence + learning gain); model comparison vs Islam 2024 / CLST 2024 + baselines; working demo; journal publication proof | Evaluated, demo-ready system |

## Timeline (Phase I, approximate)

| Date | Event |
|---|---|
| May 30 | Guidance Call 1 ✅ |
| **Jun 7** | **Review 1** (architecture + algorithms + 30% code) |
| ~Jun 21 | Review 2 (detailed algo + intermediate results + 80%) |
| ~Jul 5 | Review 3 final (results + model comparison + demo + journal draft + 100%) |

## See also

- [phase1-research-plan.md](./phase1-research-plan.md) — the research methodology executed across Phase I.
- [project-overview.md](./project-overview.md) — the two-pillar thesis.
