---
title: Project Scope as of Review 1
purpose: Single source of truth for the project's scope, phases, datasets, and research plan as decided in the grill sessions leading up to Phase-I First Review
audience: candidate (Rohit Saji), future agents working on the report or implementation
status: approved (as of 2026-06-06)
last_updated: 2026-06-06
---

## Overview

This folder captures every scope decision made for the M.Tech project **"Adaptive Study
Planning for Self-Directed Learners"** (PES University / Great Learning, M.Tech Data
Science and Artificial Intelligence) during the grill sessions preceding the Phase-I
First Review (7 June 2026). It records the two-pillar thesis, the Phase-I / Phase-II
split, the datasets, the Phase-I research plan, the role of pyKT, the chosen base papers,
the architecture, and the evaluation methodology.

**Candidate:** Rohit Saji · Reg PES2PGE24DS201  
**Guide:** Prof. Ramesh Prakash Guledgudd · PES University  
**Project period:** May – October 2026

## Files in this folder

- [`project-overview.md`](./project-overview.md) — The problem, the one-sentence thesis, the two pillars, and what is novel.
- [`phases-and-reviews.md`](./phases-and-reviews.md) — PES review structure, what Phase I vs Phase II each cover, the per-pillar phase split, and the timeline with concrete deliverables per review.
- [`pillars-and-algorithms.md`](./pillars-and-algorithms.md) — Pillar A and Pillar B components, candidate algorithms, and the two base papers.
- [`pillarB-assessment-design.md`](./pillarB-assessment-design.md) — Detailed Pillar B design: user-selectable assessment style (Tier 1 + Tier 2), the one pattern schema, two modalities, exam-aware design, and what remains under user research.
- [`datasets.md`](./datasets.md) — Datasets for each pillar (synthetic + public KT), data status, and why synthetic is justified.
- [`phase1-research-plan.md`](./phase1-research-plan.md) — The 4-stage research methodology, synthetic data generator, model-comparison plan, evaluation methodology, and expected outcomes.
- [`pykt-and-knowledge-tracing.md`](./pykt-and-knowledge-tracing.md) — What pyKT is, its datasets/models, concept-level KT for generated items, cold-start, and how it's used in research vs production.
- [`architecture.md`](./architecture.md) — The three-tier architecture and the key source-of-truth decision.
- [`decisions-log.md`](./decisions-log.md) — Chronological log of every grill decision with rationale.

## Where to start

- **New to the project:** read `project-overview.md`, then `phases-and-reviews.md`.
- **Writing the report / lit survey:** `pillars-and-algorithms.md` + `datasets.md` + `phase1-research-plan.md`.
- **Implementing:** `architecture.md` + `pykt-and-knowledge-tracing.md`.
- **Auditing what was decided and why:** `decisions-log.md`.

## See also

- `../../mydeliverables/1st-Review/report/main.tex` — dissertation report (29 pp, 48 references, compiles clean).
- `../../mydeliverables/1st-Review/deck/review1-deck.pptx` — 12-slide Review-1 deck (build script: `build_deck.cjs`).
- `../../mydeliverables/1st-Review/deck/assets/architecture_horizontal.{tex,pdf,png}` — horizontal TikZ architecture diagram for the deck.
- `../../../design/architecture.md` — the Mermaid architecture diagram.
- `../../../plans/deferrals/2026-06-04-review1-prep-deferrals.md` — running deferral/decision log.
