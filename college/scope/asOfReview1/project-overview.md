---
title: Project Overview and Thesis
purpose: State the problem, the one-sentence thesis, the two research pillars, and the novelty
audience: candidate, future agents
status: approved
last_updated: 2026-06-05
---

## Problem statement

Self-directed learners (people working through online courses, exam prep, or self-study
without an instructor) build fixed study plans that diverge from reality within days —
they fall behind or move ahead, the plan never adapts, and they have no trustworthy signal
of how far off-track they are or whether the time logged produced genuine learning.
Existing tools either track time without planning, or generate static plans that never
adapt to realised pace, and none verify that self-reported study actually resulted in
learning.

## One-sentence thesis

A **verified closed-loop** adaptive study-planning system for self-directed learners that
learns each learner's true pace from **assessment-verified** sessions, detects behavioural
shifts, projects completion with calibrated uncertainty, and automatically regenerates the
schedule — demonstrated to outperform a static open-loop planner on schedule adherence
**and genuine learning gains**.

## The two pillars

The project is organised around two interlocking research pillars (co-equal core
contributions).

- **Pillar A — Closed-loop adaptation.** Learn pace, detect shifts, project completion,
  regenerate schedule. Techniques: hierarchical Bayesian pace calibration → CUSUM
  change-point detection → Gaussian-process progress projection → constraint-based
  schedule generation.
- **Pillar B — Assessment-based verification.** Generate concept-tagged assessments from
  the learner's own material (LLM), grade them, and estimate genuine concept mastery via
  cold-start knowledge tracing. This is the **honest signal** that (a) stops users gaming
  the tracker with fake sessions and (b) provides the ground-truth learning measure the
  evaluation otherwise lacked.

The two pillars interlock: garbage sessions → garbage calibration → garbage schedule.
Pillar B makes the Pillar A loop **trustworthy**.

## Why Pillar B exists (origin)

Pillar B was added on the **direct instruction of the project guide** at the First
Guidance Call. The guide's question — "how do you stop users passing false session data?"
— is, underneath, a critique of the evaluation: self-reported study time has no ground
truth. The guide's proposed fix (periodic, material-grounded quizzes) became Pillar B,
which simultaneously solves the cheating problem and the evaluation-validity problem.

## What is novel (the gap)

Each technique exists in the literature in isolation; nobody combines learner calibration
+ behavioural-shift detection + uncertainty-aware projection + adaptive scheduling into a
closed loop, and nobody uses **assessment to verify the learning signal that drives
planning**. Three specific gaps:

1. No integration of statistical calibration with schedule generation.
2. No closed feedback between behavioural monitoring and schedule replanning.
3. No assessment-verified, uncertainty-aware progress modelling for self-directed learners.

## Framing note (proposed vs built)

To examiners the system is framed as "proposed / in progress." Much of the open-loop app
is in fact already built (in TypeScript), but the assessment subsystem (Pillar B), the
Python research/comparison pipeline, and the closing of the loop are **genuinely unbuilt**
— so the "in progress" framing is substantially honest. The app is the evaluation
platform; the algorithms are the research deliverables.

## See also

- [phases-and-reviews.md](./phases-and-reviews.md) — how the work splits across Phase I and II.
- [pillars-and-algorithms.md](./pillars-and-algorithms.md) — the algorithms inside each pillar.
