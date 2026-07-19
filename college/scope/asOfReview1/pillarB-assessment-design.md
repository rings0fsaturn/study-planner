---
title: Pillar B — Assessment Design (as of Review 1)
purpose: Document the decided assessment-style architecture, the one-pattern-schema model, exam-aware design, what is under user research, and what was rejected
audience: candidate (Rohit Saji), future agents implementing or reporting on Pillar B
status: approved
last_updated: 2026-06-06
related:
  - ./pillars-and-algorithms.md
  - ./pykt-and-knowledge-tracing.md
  - ./phases-and-reviews.md
---

## Assessment design overview

Pillar B generates, delivers, and grades assessments from the learner's own ingested
material, then feeds the resulting mastery signal back into Pillar A's calibration loop.

The design separates two concerns:

- **Assessment style** (how the assessment is structured) — decided; under user control.
- **Assessment parameters** (which exam templates, how many items, timing, thresholds) — under primary user research.

The pipeline is always:

```
ingest material → LLM item generation (concept-tagged) → deliver assessment → auto-grade → cold-start KT → mastery signal
```

## User-selectable assessment style — Tier 1 and Tier 2

The learner chooses how their assessment is structured. Two committed tiers:

### Tier 1 — presets

Two built-in presets. No configuration required.

| Preset | Description |
|---|---|
| **Generic** | Untimed, mixed concept-question format, default item count, simple pass threshold |
| **Exam-realistic** | Timed; mirrors the learner's declared target exam — section structure, item-type mix, marks per item, negative-marking scheme |

"Exam-realistic" is the key design: because a timed, exam-patterned test is harder to
game than a casual quiz, it strengthens the anti-cheating argument (Pillar B's founding
motivation) while also being the more useful product for exam-prep learners.

### Tier 2 — build-your-own pattern

The learner composes a custom assessment pattern from a **fixed gradable palette**:

| Palette element | Scope |
|---|---|
| Sections | Named sections (e.g. Quantitative, Verbal, Coding) |
| Item types | MCQ · multi-select · numeric/fill-in · short-answer · coding |
| Marks per item | Configurable per section |
| Negative marking | Per-section flag + deduction value |
| Total time | Per-section or overall timer |

The **palette constraint is essential**: item types are limited to those that can be
auto-graded (no essays, hand-drawn diagrams, or viva). This keeps the grading pipeline
bounded regardless of how the pattern is customised.

### Tier 3 — rejected

Dynamic inference from a past paper (NLP / PDF → pattern spec) was considered and
**explicitly rejected** as out of scope for both phases. The two-tier palette approach
covers the same user need without the reliability risk.

## One pattern schema underlies both tiers

Both Tier 1 and Tier 2 share the same internal representation:

```
pattern = {
  sections: [
    { name, item_types, item_count, marks_per_item, negative_marking, time_seconds }
  ],
  total_time_seconds,
  pass_threshold
}
```

Tier 1 presets are just named, pre-filled instances of this schema. Tier 2 lets the
learner author an instance interactively. This means the generation, grading, and KT
pipelines never need to know which tier the learner chose — they always receive the same
schema.

## Exam-aware design — what "Exam-realistic" means

When the learner declares a target exam (e.g. GATE, GRE, a university end-semester,
a certification), the Tier-1 "Exam-realistic" preset:

1. Loads the stored pattern template for that exam.
2. Generates items whose type mix, section order, and marks match the real exam pattern.
3. Enforces the timer and section transitions at delivery.
4. Applies the real exam's negative-marking scheme when computing the score.

If no target exam is declared, Generic is the fallback.

## Assessment parameters — under primary user research

The following are **not yet decided** — they depend on which target exams real learners
declare, and are being gathered via primary user research (ongoing as of 2026-06-06):

| Parameter | Status |
|---|---|
| Exam-pattern template library (which target exams; their exact structure) | Under user research |
| Item counts per section per exam | Under user research |
| Timing per section per exam | Under user research |
| Difficulty mix (item difficulty distribution per exam) | Under user research |
| Pass / mastery thresholds | Under user research |

**For Review 1:** this is framed as a Phase-I requirements activity. The design (Tier 1 + Tier 2, one schema) is decided; the parameters are intentionally open, driven by evidence from real users. Build is Phase II.

## Two modalities and their datasets

The gradable palette supports two modalities, aligned to the guide's original directive:

| Modality | Grading | Public dataset |
|---|---|---|
| Theory (MCQ / short-answer) | Auto-graded MCQ; LLM rubric-grading for short-answer | Eedi / NeurIPS 2020 MCQ |
| Coding | Programmatic test-case execution; LLM consistency check for edge cases | POJ programming exercises |

Both datasets are available via **pyKT**. The honest-vs-faker overlay (synthetic) is
generated on top of these for the cheating-detection evaluation.

## Knowledge tracing and mastery signal

- **Model:** concept-level cold-start KT (base paper: CLST 2024 — aligns a generative LLM as a student knowledge tracer, arXiv:2406.10296).
- **Why concept-level:** items are LLM-generated and unique per learner; standard item-level KT requires a shared fixed bank answered by many learners, which does not apply here.
- **Why cold-start:** a single learner starts with no interaction history; the CLST approach mitigates the cold-start problem that disables most standard KT models.
- **Offline baselines:** DKT, BKT, AKT, UKT (via pyKT) as AUC comparators. Production uses BKT/Deep-IRT (interpretable).
- **Concept extraction:** LLM tags each generated item with a knowledge component (KC). This bridge connects the generated item to the KT model's concept graph.

## LLM cost controls

LLM calls are the main operating cost of Pillar B. Two controls are committed:

- **Caching:** identical prompts (same material + same concept) reuse cached item outputs.
- **Batching:** items generated in batch per session rather than one API call per item.

Further cost controls (cheaper models for routine items, routing logic) are deferred to
Phase-II implementation.

## See also

- [pillars-and-algorithms.md](./pillars-and-algorithms.md) — high-level Pillar B component table.
- [pykt-and-knowledge-tracing.md](./pykt-and-knowledge-tracing.md) — KT models, datasets, and the cold-start problem in depth.
- [decisions-log.md](./decisions-log.md) — decisions #20–22 (2026-06-06) that locked this design.
