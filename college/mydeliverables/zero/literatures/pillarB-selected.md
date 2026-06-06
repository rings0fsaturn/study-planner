# Pillar B — Selected Papers (Assessment-Based Verification)

Selected 2026-06-05 from `evaluated_papers_pillarB.json` (158 evaluated, 184 submitted).
Filter: 2024+, title-level topical relevance (keyword score alone over-counted generic
"LLM" papers). ★ = anchor (tightest fit to thesis). 🔗 = bridge to Pillar A.

## Theme 1 — Knowledge Tracing / Mastery (the DS core of Pillar B)
- ★ **Personalized Forgetting Mechanism with Concept-Driven Knowledge Tracing** (2026)
  `10.1145/3810940` — concept-driven KT + forgetting = your concept-level KT + retention thesis in one paper.
- **DKVMN&MRI: deep KT based on DKVMN** (2024) `10.1371/journal.pone.0312022` — concrete deep-KT baseline for the model comparison.
- 🔗 **Graph-based KT for Personalized MOOC Path Recommendation** (2025) `10.69987/jacs.2025.51101` — KT mastery feeding path/schedule = the Pillar B → Pillar A bridge.

## Theme 2 — Automatic Question Generation (LLM)
- ★ **Automatic item generation in various STEM subjects using LLMs** (2025) `10.1016/j.caeai.2024.100344` — Comp. & Education: AI; LLM AQG across STEM.
- **Optimizing Automated Question Generation for Educational Assessments** (2025) `10.48084/etasr.10662` — AQG specifically for assessment.
- **Quiz Generation and Chat Interaction with LLMs: Design & Implementation** (2025) `10.23919/softcom66362.2025.11197405` — implementation-shaped, matches your build.

## Theme 3 — Automated Grading / Answer Evaluation
- ★ **Automatic Grading of Short Answers Using LLMs in Software [Education]** (2024) `10.1109/educon60312.2024.10578839` — grading in a **coding** context = your coding-assessment modality.
- **Rubric-Based Automated Short Answer Scoring using LLMs** (2024) `10.1109/scse61872.2024.10550624` — rubric LLM grading (theory side).
- **Automated Assessment in Math Education: Comparative Analysis of LLMs** (2024) `10.5281/zenodo.12729932` — model comparison flavor.

## Theme 4 — Assessment Integrity / Gaming (the guide's core concern)
- ★ **Understanding Gaming the System by Analyzing Self-Regulated Learning** (2026) `10.1145/3785022.3785025` — gaming-the-system + SRL = exactly the "fake session" problem in your SRL framing.
- **Advancing Online Assessment Integrity: Integrated Misconduct Detection** (2024) `10.1109/access.2024.3434608` — assessment-integrity / misconduct detection.

## Theme 5 — Concept / KC Extraction from Content ("ingest material → tag concepts")
- ★ **Automated Generation and Tagging of Knowledge Components from MCQs** (2024) `10.1145/3657604.3662030` — auto-tag KCs on generated MCQs = the exact bridge that lets KT trace mastery over LLM-generated items.
- **Automated Extraction of Domain-Specific Concept Maps using RAG-LLM** (2025) `10.1109/fie63693.2025.11328309` — RAG-LLM concept extraction from material.
- 🔗 **Prerequisite Relation Learning: A Survey and Outlook** (2025) `10.1145/3733593` — prerequisite structure (bridges to role-phased sequencing in Pillar A).

## Theme 6 — Retention / Review Timing ("when to assess")
- ★ **Personalized Language Learning Using Spaced Repetition Scheduling** (2025) `10.1007/978-3-031-98459-4_19` — algorithmic review-interval scheduling.
- **Using Anki: recall and study practices** (2026) `10.1186/s12909-026-09040-x` — empirical spaced-repetition grounding.

## arXiv recoveries (all 26 recovered: 13 via WebFetch, 13 via OpenAlex)

These were the original fetch failures. Several are **better fits than the published
set** — especially for the single-learner / local-LLM / concept-tagging angles.

**★★ Architecture-matching standouts:**
- **Self-hosted Lecture-to-Quiz: Local LLM MCQ Generation** (2026) `arXiv:2603.08729`
  — local-LLM, ingest-lecture → generate MCQ. Matches your FastAPI/Docker + material-ingest design *exactly*.
- **CLST: Cold-Start Mitigation in Knowledge Tracing** (2024) `arXiv:2406.10296`
  & **MAML-KT: Cold-Start in KT via meta-learning** (2026) `arXiv:2603.00137`
  — cold-start KT = your single-learner / few-sessions reality, head-on.

**Strong additions by theme:**
- KT: **Neural-Symbolic Knowledge Tracing** (2026) `arXiv:2604.08263` — interpretable KT (on-brand).
- AQG: **Math MCQ Generation via Human-LLM** (2024) `arXiv:2405.00864`.
- AQG×Retention: **LLM-Generated Retrieval Practice** (2025) `arXiv:2507.05629` — ties generation to spaced retrieval (themes 2+6).
- Grading: **Are LLMs Good Essay Graders?** (2024) `arXiv:2409.13120`; **LLMs as Automated Essay Scorers** (2024) `arXiv:2401.03401`.
- KC-extraction (the concept-tag bridge): **Multimodal extraction of KCs for KT** (2024) `arXiv:2409.20167`;
  **Automate Knowledge Concept Tagging on Math Questions with LLMs** (2024) `arXiv:2403.17281`;
  **Human-AI Q-Matrix Refinement + NeuralCDM** (2026) `arXiv:2604.16398`.

## Notes
- **Excluded as spurious** (keyword false-positives): a *Military Medicine* "self-report"
  paper, an *astrophysical ices* paper (bad DOI), generic "digital era" entries.
- **Combined survey:** ~13 Pillar A + this set → genuine two-pillar coverage.
  For the **Review 1 slide**, show a tight subset (the ★ anchors, ~6-7); keep the
  full set for the report chapter.
