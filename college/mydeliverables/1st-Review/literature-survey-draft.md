# Literature Survey (chapter draft — Markdown; LaTeX conversion after approval)

> Structure mirrors the report template: **Existing Systems → Limitations → Proposed
> Solution**. 14 highly-relevant papers (7 per pillar), both **base papers** marked ★.
> Reference numbers [1]–[14] are local to this chapter.

---

This chapter summarises the existing research relevant to the project — adaptive study
planning, learner pace modelling, behavioural-change detection, progress prediction,
and the assessment and knowledge-tracing techniques used to verify genuine learning. It
groups related work under the project's two research pillars, identifies the limitations
that motivate this work, and states the proposed solution.

## Existing Systems

### Pillar A — Learner pace modelling, monitoring, and adaptive scheduling

**★ Islam et al. (2024) [1] — Predict-then-optimize scheduling.** Couples an artificial
neural network for grade prediction (accuracy ≈ 0.73) with dynamic programming for
optimal schedule allocation. Establishes the *predict-then-optimize* architecture this
project adopts and extends. **(Base paper, Pillar A.)**

**Chen et al. (2024) [2] — Hierarchical Bayesian learner modelling.** Two behavioural
experiments (N = 312) show hierarchical priors capture learner variability without
overfitting sparse data — the statistical justification for per-learner pace calibration
from few sessions.

**Saqr et al. (2026) [3] — Critical-slowing-down behavioural monitoring.** Idiographic
analysis of 1.67M practice attempts (9,401 students); 88.2% of disengaging learners
showed detectable critical-slowing-down signals beforehand — evidence that per-learner
behavioural shifts are detectable from trace data.

**Pérez-Suay et al. (2024) [4] — Gaussian-process performance prediction.** GP regression
with an ARD kernel on Moodle logs reaches R = 0.89 for predicting marks and yields
interpretable feature weighting and calibrated uncertainty — the basis for
uncertainty-aware progress projection.

**Pagano et al. (2026) [5] — Adaptive vs. static learning paths.** Controlled study
(2,064 students) showing adaptive paths produce substantial efficiency gains over static
ones — large-scale evidence that adaptation works, and the template for this project's
adaptive-vs-static evaluation design.

**Fabregar & Amorado (2025) [6] — Constraint-based study-plan generation.** A greedy
algorithm with prerequisite-constraint satisfaction generates expert-quality plans in
0.32 s (vs. 30–60 min manually) — prior art for constraint-based, prerequisite-aware
scheduling.

**Alhazbi et al. (2024) [7] — Self-regulated-learning analytics.** PRISMA review of 25
studies finds most SRL trace-indicators relate to time-management skills — grounding the
project's metrics (schedule adherence, regularity) in validated SRL frameworks.

### Pillar B — Assessment generation, knowledge tracing, and verification

**★ CLST: Cold-Start Mitigation in Knowledge Tracing (2024) [8].** Addresses knowledge
tracing when per-learner interaction history is scarce — directly the project's
single-learner, few-sessions setting. **(Base paper, Pillar B.)**

**Concept-Driven Knowledge Tracing with Personalised Forgetting (2026) [9].** Combines
concept-level knowledge tracing with a personalised forgetting mechanism — the closest
prior work to this project's concept-level mastery model with retention awareness.

**Self-hosted Lecture-to-Quiz: Local-LLM MCQ Generation (2026) [10].** Generates
multiple-choice items from lecture material using a locally-hosted LLM — prior art for
the project's ingest-material → generate-assessment pipeline on a self-hosted service.

**Automated Generation and Tagging of Knowledge Components from MCQs (2024) [11].**
Automatically tags knowledge components onto multiple-choice questions — the mechanism
that lets knowledge tracing operate over generated, concept-tagged items.

**Understanding Gaming the System via Self-Regulated Learning (2026) [12].** Detects
"gaming the system" by analysing self-regulated-learning behaviour — motivates *why*
self-reported study data needs verification, in the project's SRL framing.

**Automatic Grading of Short Answers using LLMs (2024) [13].** LLM-based grading of
short answers in a software-education (coding) context — prior art for automated
answer evaluation across the project's theory and coding assessment modalities.

**Personalised Spaced-Repetition Scheduling (2025) [14].** Schedules review at
algorithmically-chosen intervals — informs *when* assessments/reviews should be placed
in the roadmap.

## Limitations of Existing Systems

1. **Techniques exist in isolation.** Calibration, change-detection, projection, and
   scheduling are each studied alone; no system integrates them into one connected loop.
2. **No closed feedback to the schedule.** Behavioural monitoring [3] detects shifts but
   prescribes no corrective replanning; scheduling work [1,6] is static and does not
   adapt to realised pace.
3. **No uncertainty-aware projection for self-directed learners.** GP work [4] is
   cross-sectional; learning-curve projection with calibrated intervals is not applied to
   ongoing self-directed study.
4. **Self-reported study activity is unverified.** No planning system uses assessment to
   confirm that logged study actually produced learning; gaming/self-report validity [12]
   is studied separately from planning.
5. **Knowledge tracing assumes fixed item banks and many learners** [8,9]. It is not
   adapted to LLM-generated, per-learner, concept-tagged items in a single-learner,
   cold-start setting.
6. **Assessment generation and mastery estimation are decoupled** [10,11,13] from the
   learner's plan — generated items are not used to drive calibration or rescheduling.
7. **Evaluations rarely combine controlled ground truth with real benchmarks**, making
   detection accuracy and verification efficacy hard to measure precisely.

## Proposed Solution

This project proposes a **verified closed-loop** adaptive study-planning system for
self-directed learners, organised around two interlocking pillars that together close
the gaps above.

**Pillar A — closed-loop adaptation** extends the predict-then-optimize architecture [1]
into an adaptive loop: hierarchical Bayesian pace calibration [2], CUSUM/critical-slowing
behavioural-shift detection [3], Gaussian-process progress projection with calibrated
uncertainty [4], and constraint-based, prerequisite-aware schedule regeneration [6],
evaluated with the adaptive-vs-static paradigm [5] and SRL-grounded metrics [7].

**Pillar B — assessment-based verification** extends cold-start knowledge tracing [8] to
**concept-level mastery over LLM-generated, concept-tagged items** [9,10,11]: the system
ingests the learner's own material, generates assessments, grades them [13], and traces
genuine mastery — an honest learning signal that guards against unverified self-reported
study [12] and (in Phase II) feeds back into calibration, closing the loop. Review
placement draws on spaced-repetition scheduling [14].

Phase I delivers and evaluates the **open-loop** system; Phase II **closes the loop** and
introduces assessment-based verification as the principal novelty — to the best of the
survey's knowledge, the first study-planning system to integrate learner calibration,
behavioural-shift detection, uncertainty-aware projection, and assessment-grounded
verification for self-directed learners.

---

## References (this chapter)

1. Islam et al. (2024), *Predict Performance & Optimize Schedule*, Proc. ICCIT (IEEE). **[Pillar A base]**
2. Chen et al. (2024), *A Hierarchical Bayesian Model of Adaptive Teaching*, Cognitive Science.
3. Saqr et al. (2026), *Early Warning Signals Before Dropping Out*, Proc. LAK26 (ACM).
4. Pérez-Suay et al. (2024), *Student Performance from Moodle Logs with Gaussian Processes*, IEEE RITA.
5. Pagano et al. (2026), *Efficiency of Adaptive Learning Paths*, Interactive Tech. & Smart Education.
6. Fabregar & Amorado (2025), *Study Plan Recommender (Greedy Algorithm)*, Proc. EECSI (IEEE).
7. Alhazbi et al. (2024), *Using Learning Analytics to Measure SRL*, J. Computer Assisted Learning.
8. CLST: *Cold-Start Mitigation in Knowledge Tracing* (2024), arXiv:2406.10296. **[Pillar B base]**
9. *Concept-Driven Knowledge Tracing with Personalised Forgetting* (2026), doi:10.1145/3810940.
10. *Self-hosted Lecture-to-Quiz: Local-LLM MCQ Generation* (2026), arXiv:2603.08729.
11. *Automated Generation and Tagging of Knowledge Components from MCQs* (2024), doi:10.1145/3657604.3662030.
12. *Understanding Gaming the System by Analysing SRL* (2026), doi:10.1145/3785022.3785025.
13. *Automatic Grading of Short Answers using LLMs* (2024), doi:10.1109/educon60312.2024.10578839.
14. *Personalised Language Learning using Spaced Repetition Scheduling* (2025), doi:10.1007/978-3-031-98459-4_19.

---
*Notes:* Pillar A details are from the vetted zeroth survey; Pillar B descriptions are at
topic/role level (exact metrics to be confirmed from each paper before final write-up —
flagged for verification). Some Pillar B titles are working titles from metadata.
