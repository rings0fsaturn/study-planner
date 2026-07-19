---
title: pyKT and Knowledge Tracing
purpose: Document what pyKT is, its datasets and models, the concept-level/cold-start adaptation, and how KT is used in research vs production
audience: candidate, future agents
status: approved
last_updated: 2026-06-05
---

## What pyKT is

`pyKT` (pykt-toolkit) is a **research/benchmark harness** for knowledge tracing
(Python/PyTorch, conda, wandb sweeps, 5-fold mean±std AUC) — not a production library. It
bundles many KT datasets with standardized preprocessing and implements ~30 KT models, so
it solves "where do I get the data AND how do I compare fairly" in one move. It lives in
`/research` and runs offline; it never runs inside the app.

Typical workflow:

```
pip install -U pykt-toolkit
python data_preprocess.py --dataset_name=ednet     # or nips2020 (Eedi), poj
python wandb_dkt_train.py / wandb_akt_train.py ...  # train each model
python wandb_predict.py                             # AUC, 5-fold
```

## Datasets bundled in pyKT (relevant ones)

| Dataset | Domain | Relevance |
|---|---|---|
| NIPS34 / Eedi | Math, **multiple-choice** | Matches the theory (MCQ) assessment modality |
| POJ | **Programming exercises** | Matches the coding assessment modality |
| ASSISTments 2009/12/15/17 | Math | Classic KT benchmark |
| EdNet | English (TOEIC) | Largest (~131M interactions) |
| Algebra2005 / Bridge2006 | Math (KDD Cup 2010) | Classic |

Eedi (MCQ) and POJ (coding) are the chosen public benchmarks because they match the
project's two assessment modalities.

## pyKT models and which fit this project

pyKT spans deep-sequential (DKT, DKT-Forget), memory networks (DKVMN, Deep-IRT),
attention/transformer (SAKT, SAINT, AKT, simpleKT, UKT), graph (GKT), and others. For
this project's identity (classical, interpretable, uncertainty-aware, small-data):

| Model | Why relevant |
|---|---|
| Deep-IRT | Interpretable — outputs an ability/mastery estimate (the verification signal) |
| UKT (2025) | Uncertainty-aware KT — mirrors the project's GP uncertainty philosophy |
| DKT-Forget / forgetting-aware variants | Match the retention/forgetting angle |
| csKT / cold-start KT | Match single-learner cold-start |
| DKT / simpleKT | Mandatory simple baselines |
| AKT | Strong interpretable transformer benchmark |

**No pure Bayesian model is in pyKT.** Classic **BKT** is brought via the separate
`pyBKT` library as the Bayesian/interpretable anchor.

## The concept-level / generated-item adaptation (the crux)

Standard KT assumes a **fixed item bank** answered by **many learners** (that is how it
learns item difficulty). This project has **LLM-generated, per-learner, often-unique
items** and **one learner** — which breaks item-level KT. The fix:

- Model at the **concept (knowledge-component) level**, not the item level. Each generated
  item is tagged with a concept; mastery is tracked per concept, so novel items are fine
  as long as they are concept-tagged.
- BKT is natively concept-level → fits better than item-level deep KT here.
- Framed up, this is a Phase-II novelty: *knowledge tracing over LLM-generated,
  concept-tagged items in a single-learner setting* — distinct from the fixed-bank,
  many-learner KT in every pyKT paper.

## How KT is used: research vs production

- **Phase I (research, offline):** run pyKT on Eedi/POJ to produce the model-comparison
  table (a "Model Comparison" deliverable). No app changes. pyKT models serve as **AUC
  baselines**.
- **Phase II (production):** deploy the *winning / chosen* model's inference via the
  FastAPI intelligence service. Decision: choose the production model on **data-fit and
  novelty** (concept-level, interpretable BKT/Deep-IRT), not on deployability — the
  Dockerised FastAPI service can serve a deep model too if it wins. Deep pyKT models stay
  as offline baselines; an interpretable/Bayesian model stays central to the product.

## Data flow at inference (Phase II)

```
LLM generates quiz item from material + tags it with a CONCEPT
  → learner answers → response logged {question, concept, correct, timestamp}
  → KT inference → per-concept mastery (+ uncertainty)
  → (1) verification/honest signal  (2) feeds calibration (closes the loop)
```

## See also

- [pillars-and-algorithms.md](./pillars-and-algorithms.md) — Pillar B components.
- [architecture.md](./architecture.md) — where KT inference runs (FastAPI service).
- [datasets.md](./datasets.md) — Eedi/POJ details.
