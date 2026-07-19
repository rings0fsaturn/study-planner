---
title: Datasets
purpose: Document the datasets for each pillar, the data status, and why synthetic data is justified
audience: candidate, future agents
status: approved
last_updated: 2026-06-05
---

## Dataset strategy (two tracks)

Each pillar needs different data; the strategy is hybrid so that a real public dataset
anchors credibility while justified synthetic data fills the gaps.

| Pillar | Primary data | Validation / secondary |
|---|---|---|
| A — adaptation | Literature-grounded **synthetic generator** (planned-vs-actual pace, planted regime shifts) | N=1 real app sessions (as they accumulate) |
| B — verification | **Public knowledge-tracing benchmarks** (Eedi MCQ, POJ coding) via pyKT | **Synthetic honest-vs-faker** overlay for cheating detection |

## Pillar A datasets

- **Synthetic study-session generator** (primary, also a stated contribution): a Python
  module that generates thousands of labelled sessions across learner archetypes, with
  **known ground truth** — pace and regime-shift locations are planted, so detection
  latency/accuracy is precisely measurable. See
  [phase1-research-plan.md](./phase1-research-plan.md) for archetypes and the ground-truth model.
- **N=1 real data:** the candidate's own logged app sessions, used for *validation*, not
  as the whole evaluation.

Why synthetic is justified for Pillar A: no public dataset carries
**planned-versus-actual session pace**. OULAD and similar are clickstream/outcome data,
not session-pace. The synthetic generator with controlled ground truth is standard
practice in adaptive-learning research.

## Pillar B datasets

- **Eedi / NeurIPS 2020 Education Challenge** (`nips2020`) — multiple-choice diagnostic
  math, ~1.38M interactions. Matches the project's MCQ (theory) assessment modality.
- **POJ** — programming-exercise responses (~1.0M interactions, 22.9K students). Matches
  the project's **coding** assessment modality.
- Both are bundled (with standardized preprocessing/splits) in **pyKT**. Other classic KT
  sets (ASSISTments, EdNet, Algebra/Bridge KDD Cup 2010) are also available via pyKT.
- **Synthetic honest-vs-faker** overlay: there is no public dataset for "fake study
  session" detection, so this is generated with planted honest/faker labels — the same
  controlled-ground-truth justification as Pillar A.

## Data status as of Review 1 (important)

- **No real session data exists yet.** N=1 validation is *aspirational*, not an asset.
  At Review 1 this is framed honestly: the 30% data-collection layer exists precisely so
  real-session collection can begin now; real-data validation is a later-review (Stage 4)
  deliverable. **Do not claim validation that does not exist.**
- **Action:** start logging real study sessions immediately so Reviews 2/3 have data.

## See also

- [pykt-and-knowledge-tracing.md](./pykt-and-knowledge-tracing.md) — how the public KT datasets are used.
- [phase1-research-plan.md](./phase1-research-plan.md) — the synthetic generator design.
