# AI-Pattern Revision Checklist for Paper Rewrite

**Paper reviewed:** *Adaptive Study Planning for Self-Directed Learners: Context-Aware Pace Calibration with Change-Point Detection*  
**Purpose of this checklist:** Improve originality, specificity, academic credibility, and authorial voice.  
**Important boundary:** Do **not** use this checklist to hide AI use or chase a “0% AI” detector score. AI detectors are unreliable and cannot certify authorship. Use this as a legitimate revision checklist to make the paper more accurate, transparent, evidence-based, and clearly grounded in your actual work.

---

## How to Use This Checklist

Work through the items in this order:

1. **Factual grounding first:** add missing experimental, implementation, and dataset details.
2. **Evidence second:** add tables, parameter values, exact comparisons, and implementation examples.
3. **Voice third:** replace generic or overly polished claims with precise authorial statements.
4. **Style last:** remove repetition, fix references, tighten wording, and improve section transitions.

For every rewrite, follow this rule:

> Only add details that are true, documented, or directly recoverable from your project files. Do not invent datasets, parameters, logs, screenshots, deployment claims, or experimental settings.

---

# Priority 0: Non-Negotiable Academic Integrity Checks

## [ ] 0.1 Stop aiming for “AI detectability 0”

**Issue:**  
A detector score is not a reliable academic quality measure. Optimizing for detector evasion can lead to weaker writing, fabricated detail, and unethical revision behavior.

**Recommended fix:**  
Rewrite with the goal of making the paper more specific, verifiable, and personally grounded in your actual project work.

**Agent instruction:**  
> Do not rewrite to evade AI detectors. Rewrite to improve academic quality, specificity, evidence, and authorial accountability. Preserve truthful claims only.

**Acceptance check:**  
- [ ] No instruction in the rewrite asks the agent to “humanize,” “bypass,” “evade,” or “reduce AI score.”
- [ ] Every new technical detail is true and traceable to code, experiments, notes, logs, or project decisions.
- [ ] Claims are narrowed when evidence is limited.

---

## [ ] 0.2 Do a claim-by-claim factual audit before rewriting

**Issue:**  
The current paper contains many strong claims: “deployed,” “literature-calibrated,” “large public LMS dataset,” “held-out learner archetypes,” “Holm/Benjamini–Hochberg correction,” “bootstrap confidence intervals,” and “known ground truth.” These may be valid, but they need clear evidence.

**Recommended fix:**  
Create a table outside the paper with each major claim and its evidence source.

**Agent instruction:**  
> Before rewriting, identify every claim that requires evidence. Mark each as Confirmed, Needs Detail, Unsupported, or Should Be Weakened.

**Acceptance check:**  
- [ ] Dataset name is identified.
- [ ] Synthetic generator parameters are documented.
- [ ] Number of seeds, learners, sessions, and archetypes are documented.
- [ ] Statistical corrections are actually implemented and described accurately.
- [ ] Deployment status is described precisely.

---

# Priority 1: Biggest AI-Pattern and Credibility Risks

## [ ] 1.1 Reduce repeated framing across abstract, introduction, discussion, and conclusion

**Issue:**  
The paper repeatedly uses the same framing phrases: “learner’s own session log as evidence,” “human-confirmed recalibration prompt,” “genuine win,” “robust null,” “known ground truth,” “held-out learner archetypes,” and “literature-calibrated synthetic dataset.” Repetition is normal, but here the repeated polished phrasing makes sections feel templated.

**Recommended fix:**  
Give each section a different job:

- **Abstract:** concise problem, method, evaluation, key result.
- **Introduction:** motivation, gap, constraints, contributions.
- **Discussion:** interpretation, trade-offs, unexpected outcomes.
- **Conclusion:** what was learned, what remains unproven, next steps.

**Agent instruction:**  
> Rewrite the conclusion so it does not repeat the abstract. Make it reflective: emphasize what the evaluation revealed, what changed after the redesign, what did not work, and what remains unproven.

**Acceptance check:**  
- [ ] The conclusion does not restate the full method pipeline in the same order as the abstract.
- [ ] The discussion contains interpretation, not only result summary.
- [ ] Repeated phrases are either removed or used only where necessary.
- [ ] The paper sounds like an author reporting a project, not a template summarizing components.

**Example direction:**  
Instead of repeating the whole system stack, write something like:

> The main lesson from the evaluation was that the most useful adaptation signal came from short-history prospective pace prediction, not from retrospective recovery. The schedule-generation experiment also changed the system design: although the dynamic-programming allocator reduced deadline drift, the day-by-day representation made replanning brittle, so the deployed version moved to capacity bookings.

---

## [ ] 1.2 Replace generic contribution language with measurable contributions

**Issue:**  
The contribution list is polished but generic. Phrases such as “a rigorous offline evaluation,” “a deployed application,” and “an open, human-confirmed adaptation loop” sound strong but need measurable anchors.

**Recommended fix:**  
Rewrite each contribution with exact scope, metric, and evidence.

**Agent instruction:**  
> Rewrite the contribution list so every bullet includes a measurable object: model, metric, dataset/simulation size, comparison baseline, or implementation boundary.

**Acceptance check:**  
- [ ] Each contribution says exactly what was built or evaluated.
- [ ] Each contribution avoids vague adjectives like “rigorous,” “robust,” “genuine,” or “deployed” unless supported.
- [ ] The list does not overclaim more contributions than the paper can defend.

**Possible rewrite:**  
> This paper makes three contributions. First, it evaluates a context-aware shrinkage calibrator for short-history pace prediction against moving-average, EWMA, pooled Bayesian, and hierarchical-Bayesian baselines. Second, it connects pace calibration to a human-confirmed adaptation loop using CUSUM-based shift detection and completion-date projection. Third, it reports an offline component evaluation on synthetic learner logs with known ground truth, including both statistically significant improvements and null results.

---

## [ ] 1.3 Add a full Synthetic Data Generator subsection

**Issue:**  
The paper relies heavily on synthetic ground-truth data, but the generator is not described in enough detail. The reader does not know exactly how learners, sessions, archetypes, pace shifts, material types, or ground truth were generated.

**Recommended fix:**  
Add a subsection in Methodology titled **Synthetic Data Generator** or **Offline Evaluation Dataset**.

**Agent instruction:**  
> Add a detailed synthetic-data subsection. Include the public LMS dataset name, what statistics were calibrated from it, which parameters were manually chosen, how learner archetypes were generated, how held-out archetypes were defined, and how ground truth was planted.

**Acceptance check:**  
- [ ] Names the public LMS dataset used for calibration.
- [ ] States the number of learners, sessions/events, seeds, and generated cases.
- [ ] Explains how active minutes, planned minutes, pace ratios, progress, and completion dates are generated.
- [ ] Explains how change points are inserted.
- [ ] Explains what “held-out learner archetypes” means.
- [ ] Explains what the oracle baseline knows.
- [ ] Separates values derived from data from values chosen by the author.

**Recommended table to add:**

| Parameter | Meaning | Value / Distribution | Source | Notes |
|---|---|---:|---|---|
| Daily capacity | Available study minutes per day | TODO | LMS calibration / assumption | TODO |
| Pace multiplier | Learner speed relative to plan | TODO | Synthetic generator | TODO |
| Session noise | Day-to-day variation in pace | TODO | Calibrated / assumed | TODO |
| Change-point probability | Probability of pace shift | TODO | Assumption | TODO |
| Material role | Type of learning item/session | TODO | Project taxonomy | TODO |
| Archetype label | Learner behavior group | TODO | Defined by author | TODO |

**Recommended pseudocode to add:**

```text
For each random seed:
    Sample learner archetype
    Sample learner-level pace and availability parameters
    For each planned study day:
        Sample available capacity
        Sample planned work
        Sample active minutes from learner pace and noise
        Apply any planted pace shift
        Update cumulative progress
    Store planted ground-truth pace, shift time, and completion date
```

---

## [ ] 1.4 Reduce method name-stacking or deepen each method

**Issue:**  
The paper lists many advanced methods: hierarchical Bayesian modeling, context-aware shrinkage, CUSUM, Gaussian processes, split conformal correction, dynamic programming, bootstrap confidence intervals, Holm correction, Benjamini–Hochberg correction, React, Vite, Dexie, IndexedDB, Supabase, FastAPI, and more. This breadth can look AI-generated if each method is not implemented and evaluated in detail.

**Recommended fix:**  
Either narrow the paper around the main research contribution or add enough technical detail to justify each named method.

**Agent instruction:**  
> For every named method, add one concrete implementation detail, one parameter or design choice, and one result or reason for inclusion. Remove methods that are only mentioned for sophistication but not central to the paper.

**Acceptance check:**  
- [ ] Every named method is either used, evaluated, or clearly marked as future work.
- [ ] Hyperparameters are listed for the shrinkage model, CUSUM, GP, and conformal correction.
- [ ] The scheduling method is clearly marked as evaluated but not shipped.
- [ ] The architecture technologies are described only as much as needed.

**Decision rule:**  
- If a method is central, deepen it.
- If a method is peripheral, shorten it.
- If a method is not actually implemented, remove it or move it to future work.

---

## [ ] 1.5 Replace over-polished rhetorical phrases with technical reporting

**Issue:**  
Phrases like “genuine win,” “honest null,” “clearest single finding,” “robust null,” and “the loop this paper closes” sound persuasive but slightly editorial. Repeated use can make the paper feel machine-smoothed.

**Recommended fix:**  
Use direct academic language.

**Agent instruction:**  
> Replace rhetorical phrases with precise technical claims. Use neutral language unless the data directly supports a strong interpretation.

**Phrase replacement checklist:**

- [ ] Replace “genuine win” with “statistically significant improvement” or “measurable improvement.”
- [ ] Replace “honest null” with “no statistically significant difference was observed.”
- [ ] Replace “robust null” with “no tested alternative consistently improved over the baseline.”
- [ ] Replace “clearest single finding” with “the largest observed effect was...”
- [ ] Replace “closing that loop” with “feeding the observed signal back into plan revision.”
- [ ] Replace “the learner, not an automatic policy” with a shorter description of human confirmation.

**Acceptance check:**  
- [ ] Results read as evidence-based reporting, not persuasion.
- [ ] Strong claims are tied to a number, table, figure, or confidence interval.
- [ ] The tone remains confident but not promotional.

---

## [ ] 1.6 Add first-hand design and implementation evidence

**Issue:**  
The architecture section mentions a mid-project redesign from day-by-day packing to capacity-based booking. This is one of the strongest human/authentic parts of the paper, but it needs more concrete detail.

**Recommended fix:**  
Add a short paragraph explaining what failed in the first design, using actual implementation examples.

**Agent instruction:**  
> Expand the design-revision paragraph with concrete examples from the prototype. Explain what boundary cases occurred, why the slot-grid approach was brittle, and how capacity bookings solved the issue.

**Acceptance check:**  
- [ ] Names at least two actual failure cases from the first design.
- [ ] Explains why those failures mattered to user experience or replanning.
- [ ] Explains what changed in the data model after the redesign.
- [ ] Does not overstate the revised system as fully validated if it is not.

**Possible rewrite direction:**  
> In the first prototype, each study item was assigned to a specific calendar day. This made replanning unstable when a learner missed a booking or when a partially completed item crossed a day boundary. A small change in pace could force many item-level assignments to move, even when the learner only needed a new estimate of available study capacity. The revised model stores dated capacity blocks and chooses material at session start, which makes replanning less disruptive.

---

# Priority 2: Evidence, Results, and Method Detail

## [ ] 2.1 Add raw result tables for change detection

**Issue:**  
The change-detection section summarizes six detectors but only gives detailed values for CUSUM. This makes the comparison feel under-documented.

**Recommended fix:**  
Add a compact table for all detector candidates.

**Agent instruction:**  
> Add a detector comparison table showing latency, false-alarm rate, and score for each candidate under step and drift shifts.

**Acceptance check:**  
- [ ] CUSUM, EWMA, critical slowing down, Page–Hinkley, Bayesian online change-point detection, and ADWIN all appear in the table.
- [ ] The table includes mean latency.
- [ ] The table includes false-alarm rate.
- [ ] The table includes the decision score or selection criterion.
- [ ] The text explains why CUSUM was selected despite higher false alarms.

**Recommended table:**

| Detector | Step latency | Step false alarm | Drift latency | Drift false alarm | Selection score | Decision |
|---|---:|---:|---:|---:|---:|---|
| CUSUM | TODO | TODO | TODO | TODO | TODO | Used |
| EWMA chart | TODO | TODO | TODO | TODO | TODO | Not used |
| Critical slowing down | TODO | TODO | TODO | TODO | TODO | Not used |
| Page–Hinkley | TODO | TODO | TODO | TODO | TODO | Not used |
| Bayesian online CPD | TODO | TODO | TODO | TODO | TODO | Not used |
| ADWIN | TODO | TODO | TODO | TODO | TODO | Not used |

---

## [ ] 2.2 Add raw result tables for progress projection

**Issue:**  
The projection section reports that the plain GP under-covers and that split-conformal correction restores coverage to 94–99%, but the full numbers by method and history band are not shown.

**Recommended fix:**  
Add a table comparing projection methods across short, medium, and long history bands.

**Agent instruction:**  
> Add a projection results table with coverage and point error for plain GP, cold-start GP/composite, and GP plus conformal correction.

**Acceptance check:**  
- [ ] Includes coverage by history band.
- [ ] Includes point error by method.
- [ ] States nominal coverage target, e.g., 95%.
- [ ] Clarifies that conformal correction changes interval width but not point estimate.
- [ ] Explains calibration split size and residual definition.

**Recommended table:**

| Projection method | Short coverage | Medium coverage | Long coverage | Point error | Notes |
|---|---:|---:|---:|---:|---|
| Plain GP | TODO | TODO | TODO | TODO | Under-covers |
| Cold-start composite | TODO | TODO | TODO | TODO | Improves early regime |
| GP + conformal | TODO | TODO | TODO | TODO | Restores interval coverage |

---

## [ ] 2.3 Add a pace-calibration ablation study

**Issue:**  
The delivered calibrator is an ensemble of two context-aware shrinkage models, but the paper does not clearly show which component creates the improvement: context features, population prior, shrinkage, or ensemble weighting.

**Recommended fix:**  
Add an ablation table.

**Agent instruction:**  
> Add an ablation table separating the effects of moving average, hierarchical Bayes, context features, population-prior shrinkage, and ensemble weighting.

**Acceptance check:**  
- [ ] Includes the hierarchical-Bayesian baseline.
- [ ] Includes context-only or shrinkage-only variants if available.
- [ ] Includes the final ensemble.
- [ ] Reports prospective prediction error.
- [ ] Reports results by history-length band.

**Recommended table:**

| Model | Context features | Population prior | Ensemble | Short error | Medium error | Long error |
|---|---|---|---|---:|---:|---:|
| Moving average | No | No | No | TODO | TODO | TODO |
| EWMA | No | No | No | TODO | TODO | TODO |
| Hierarchical Bayes | No | Yes | No | TODO | TODO | TODO |
| Context-only model | Yes | No | No | TODO | TODO | TODO |
| Context + shrinkage | Yes | Yes | No | TODO | TODO | TODO |
| Full ensemble | Yes | Yes | Yes | TODO | TODO | TODO |

---

## [ ] 2.4 Clarify retrospective vs prospective pace metrics

**Issue:**  
The paper says retrospective recovery is a null result while prospective context prediction improves. This is important but can confuse readers unless the two metrics are clearly defined.

**Recommended fix:**  
Define both metrics mathematically or operationally before presenting results.

**Agent instruction:**  
> Add definitions for retrospective recovery error and prospective context-prediction error. Explain why the system uses the prospective metric for method selection.

**Acceptance check:**  
- [ ] Retrospective recovery error is defined.
- [ ] Prospective prediction error is defined.
- [ ] The paper explains why prospective error matters more for planning.
- [ ] The null result is stated clearly without sounding like a contradiction.

**Suggested explanation:**  
> Retrospective recovery asks whether the model reconstructs the planted learner pace after observing history. Prospective prediction asks whether the model predicts the next session’s pace under its observed context. The planner depends on the second quantity because it must update future estimates before much learner history exists.

---

## [ ] 2.5 Clarify the Gaussian-process projection setup

**Issue:**  
The GP equation is given, but the paper does not fully specify what the input and output variables are or how the completion date is extracted.

**Recommended fix:**  
Add implementation-level definitions.

**Agent instruction:**  
> Define the GP input variable, target variable, kernel parameters, noise term, fitting procedure, and completion-date extraction rule.

**Acceptance check:**  
- [ ] States whether `x` is calendar day, session index, cumulative active minutes, or another variable.
- [ ] States whether the target is cumulative progress, remaining work, or completion percentage.
- [ ] States how the predicted completion date is obtained from the posterior.
- [ ] States kernel hyperparameters or how they are fitted.
- [ ] States how the cold-start fallback works before five sessions.

---

## [ ] 2.6 Clarify the split-conformal correction

**Issue:**  
The paper says split-conformal correction restores coverage, but it does not specify the calibration procedure.

**Recommended fix:**  
Add a short paragraph describing calibration data, residuals, quantile, and application.

**Agent instruction:**  
> Add the split-conformal correction procedure step by step: split, fit, compute residual scores, choose quantile, widen interval, and evaluate coverage.

**Acceptance check:**  
- [ ] Calibration split size is reported.
- [ ] Residual or conformity score is defined.
- [ ] Quantile level is stated.
- [ ] Explains whether correction is global or per history-length band.
- [ ] Explains that point predictions are unchanged.

---

## [ ] 2.7 Clarify CUSUM direction and limitations

**Issue:**  
The current CUSUM formulation is one-sided. Pace shifts can matter in both directions: the learner may become slower or faster. The paper mentions a future dual-arm variant, but the limitation should be clearer.

**Recommended fix:**  
State exactly which direction the current detector tracks and why. Explain what the dual-arm version would add.

**Agent instruction:**  
> Add a limitation note explaining whether the current CUSUM detects slowdown, speedup, or only positive deviation from the in-control mean. Connect this to the future dual-arm detector.

**Acceptance check:**  
- [ ] Direction of detection is explicit.
- [ ] Slack `k` and threshold `h` are reported.
- [ ] Parameter tuning method is described.
- [ ] The false-alarm trade-off is acknowledged.
- [ ] Future dual-arm CUSUM is motivated by a current limitation.

---

## [ ] 2.8 Clarify active minutes and planned minutes

**Issue:**  
The pace ratio is defined as active minutes divided by planned minutes, but the measurement procedure is not fully described.

**Recommended fix:**  
Add operational definitions.

**Agent instruction:**  
> Define active minutes, planned minutes, paused time, incomplete sessions, outliers, and how session logs are cleaned before modeling.

**Acceptance check:**  
- [ ] Active minutes definition is clear.
- [ ] Planned minutes definition is clear.
- [ ] Pauses or idle time are handled.
- [ ] Outlier sessions are handled or acknowledged.
- [ ] The log transformation `log(at/pt)` is justified.

---

## [ ] 2.9 Clarify schedule-generation result vs shipped behavior

**Issue:**  
The dynamic-programming scheduler performs well in evaluation but is not used in the delivered system. This is a valuable design finding, but it can confuse readers.

**Recommended fix:**  
Make the distinction very explicit.

**Agent instruction:**  
> Rewrite the schedule-generation section so the reader understands that the dynamic-programming allocator was evaluated, produced strong results under the original formulation, but was not shipped because the scheduling representation changed.

**Acceptance check:**  
- [ ] The paper clearly says “evaluated but not adopted.”
- [ ] The reason for non-adoption is design-based, not performance-based.
- [ ] The revised capacity-booking model is described in enough detail.
- [ ] No sentence implies the shipped app uses the retired day-by-day allocator.

---

# Priority 3: References and Source Reliability

## [ ] 3.1 Verify every reference exists and supports the claim

**Issue:**  
Some references are recent, incomplete, or formatted vaguely with “et al.” only. This can look artificially assembled and may weaken credibility.

**Recommended fix:**  
Manually verify every citation.

**Agent instruction:**  
> Audit the reference list. For each citation, verify title, authors, venue, year, DOI or URL, and whether the paper actually supports the sentence that cites it.

**Acceptance check:**  
- [ ] Every reference exists.
- [ ] Every reference is cited accurately.
- [ ] No citation is used only because it sounds related.
- [ ] Full author names or IEEE-compliant shortened format are used consistently.
- [ ] DOI, venue, volume, pages, and year are included where available.

**Reference audit table:**

| Ref. | Claim supported | Verified? | Bibliographic details complete? | Keep / Replace / Remove |
|---|---|---|---|---|
| [1] Islam et al. | Predict-then-optimize scheduling baseline | TODO | TODO | TODO |
| [2] Chen et al. | Hierarchical Bayesian adaptive teaching | TODO | TODO | TODO |
| [3] Zambrano et al. | Bayesian-family learner-model fairness | TODO | TODO | TODO |
| [4] Mai et al. | Transformer-Bayesian hybrid | TODO | TODO | TODO |
| [5] Saqr et al. | Early warning signals | TODO | TODO | TODO |
| [6] Qiao et al. | SPC / CUSUM / EWMA review | TODO | TODO | TODO |
| [7] Perez-Suay et al. | GP on Moodle logs | TODO | TODO | TODO |
| [8] Lin et al. | Scalable GPs for learning curves | TODO | TODO | TODO |
| [9] Alhazbi et al. | SRL analytics review | TODO | TODO | TODO |
| [10] de Barba et al. | SRL analytics rubric | TODO | TODO | TODO |

---

## [ ] 3.2 Fix inconsistent reference formatting

**Issue:**  
The reference list mixes styles. Some entries have DOI details, some do not; some have incomplete author lists; some include venue details while others are vague.

**Recommended fix:**  
Format consistently in IEEE style.

**Agent instruction:**  
> Reformat the bibliography into consistent IEEE style. Do not leave generic entries like “Chen, et al.” unless IEEE rules allow abbreviation after full author threshold.

**Acceptance check:**  
- [ ] Author initials and surnames are formatted consistently.
- [ ] Paper titles use consistent capitalization.
- [ ] Venues are included.
- [ ] Years are included.
- [ ] DOI or URL is included where appropriate.
- [ ] arXiv entries include arXiv identifier.

---

## [ ] 3.3 Avoid overusing very recent citations unless necessary

**Issue:**  
Several references are from 2024–2026. Recent citations can be good, but too many loosely connected recent references can look generated.

**Recommended fix:**  
Keep recent citations only where they directly support the method or gap. Add foundational references where needed.

**Agent instruction:**  
> Check whether each recent citation is necessary. Add foundational sources for CUSUM, Gaussian processes, conformal prediction, Bayesian updating, and self-regulated learning if the current references do not cover them well.

**Acceptance check:**  
- [ ] CUSUM has a foundational or authoritative citation.
- [ ] Gaussian processes have a foundational or authoritative citation.
- [ ] Conformal prediction has a foundational or authoritative citation.
- [ ] Bayesian learner modeling citations are directly relevant.
- [ ] Related work is not just a list of recent papers.

---

# Priority 4: Section-by-Section Rewrite Checklist

## [ ] 4.1 Abstract

**Issue:**  
The abstract is dense and method-heavy. It lists many components before clearly grounding the central problem and main result.

**Recommended fix:**  
Simplify the opening and make the main result more specific.

**Agent instruction:**  
> Rewrite the abstract to follow: problem, gap, proposed system, evaluation setup, most important result, limitation. Avoid listing every method in one long chain.

**Acceptance check:**  
- [ ] First sentence is simple and problem-driven.
- [ ] Abstract does not overuse method names.
- [ ] Main result includes a specific metric or direction of improvement.
- [ ] Synthetic evaluation limitation is mentioned.
- [ ] No phrase sounds promotional.

**Possible abstract opening:**  
> Self-directed study plans often fail because their assumptions are fixed when the plan is created. A learner may plan to study one hour per day, but after only a few sessions the observed pace can differ substantially from the estimate used to build the schedule. This paper studies whether a learner’s own session log can recalibrate that plan before the projected completion date becomes misleading.

---

## [ ] 4.2 Introduction

**Issue:**  
The introduction is clear but could better separate user problem, technical difficulty, and research gap.

**Recommended fix:**  
Use a sharper structure.

**Agent instruction:**  
> Rewrite the introduction using four paragraphs: real learner problem, why static planners fail, why adaptation is technically hard, and what this paper contributes.

**Acceptance check:**  
- [ ] The learner problem is concrete.
- [ ] The technical challenge is sparse and non-stationary evidence.
- [ ] The gap is specific, not broad.
- [ ] Contributions are measurable.
- [ ] The introduction does not preview every result in excessive detail.

---

## [ ] 4.3 Related Work

**Issue:**  
The related work sometimes reads like annotated bibliography entries. It needs more synthesis and clearer connection to the paper’s exact gap.

**Recommended fix:**  
Group work by function and end each group with the remaining gap.

**Agent instruction:**  
> Rewrite related work so it synthesizes the literature instead of summarizing one paper at a time. For each paragraph, explain what prior work enables and what it does not solve for this paper.

**Acceptance check:**  
- [ ] Paragraphs are organized by theme: pace modeling, change detection, projection, scheduling, SRL analytics.
- [ ] Each paragraph ends with a precise gap.
- [ ] Claims about prior work are cited accurately.
- [ ] No citation is used as decoration.
- [ ] The final gap statement is narrower and defensible.

---

## [ ] 4.4 System Architecture

**Issue:**  
The architecture section is one of the strongest sections, but it should be more specific about the local-first app, server role, authentication, data flow, and redesign.

**Recommended fix:**  
Add concrete data-flow and design-revision details.

**Agent instruction:**  
> Add implementation details that show how the system actually works: what is stored locally, what is sent to the server, what the server returns, and what happens when the learner accepts or rejects a recalibration prompt.

**Acceptance check:**  
- [ ] Local IndexedDB events are described clearly.
- [ ] Server-side inputs and outputs are described clearly.
- [ ] Supabase role is specific.
- [ ] Recalibration prompt flow is described.
- [ ] Deployment status is accurate.
- [ ] Phase-II features are not described as delivered.

---

## [ ] 4.5 Methodology

**Issue:**  
The methodology names the models but needs more implementation-level reproducibility.

**Recommended fix:**  
Add parameters, tuning, data splits, and pseudocode.

**Agent instruction:**  
> Rewrite methodology for reproducibility. A reader should be able to understand what data enters each component, what output is produced, what parameters were used, and how model selection was performed.

**Acceptance check:**  
- [ ] Pace calibration includes feature definitions.
- [ ] Ridge and shrinkage strengths are reported.
- [ ] CUSUM parameters are reported.
- [ ] GP input/output and kernel settings are reported.
- [ ] Conformal correction procedure is reported.
- [ ] Synthetic generator is documented.
- [ ] Evaluation split and bootstrap procedure are documented.

---

## [ ] 4.6 Results

**Issue:**  
The results section reports several findings in prose but needs more tables and exact values.

**Recommended fix:**  
Make the section more data-forward.

**Agent instruction:**  
> For each component, present one result table before interpretation. Keep prose focused on what the numbers mean and why the chosen method was selected.

**Acceptance check:**  
- [ ] Calibration table includes baseline and final model.
- [ ] Detection table includes all detectors.
- [ ] Projection table includes coverage and point error.
- [ ] Scheduling table includes candidate methods and drift.
- [ ] Confidence intervals are shown where claims depend on differences.
- [ ] Null results are stated plainly.

---

## [ ] 4.7 Discussion

**Issue:**  
The discussion repeats results instead of deeply interpreting design trade-offs.

**Recommended fix:**  
Focus on what the findings imply.

**Agent instruction:**  
> Rewrite discussion around trade-offs: short-history adaptation, false alarms vs late detection, calibrated uncertainty, and why a high-performing scheduler was not shipped.

**Acceptance check:**  
- [ ] Discusses why prospective pace prediction matters.
- [ ] Discusses why higher CUSUM false alarms are acceptable only because the learner confirms replanning.
- [ ] Discusses why conformal correction is necessary.
- [ ] Discusses why synthetic ground truth is useful but limited.
- [ ] Does not simply repeat the abstract or results.

---

## [ ] 4.8 Conclusion and Future Work

**Issue:**  
The conclusion currently restates the full system and evaluation in a very similar sequence to earlier sections.

**Recommended fix:**  
Make the conclusion shorter, more reflective, and more honest about limitations.

**Agent instruction:**  
> Rewrite the conclusion in three paragraphs: what was built, what was learned from evaluation, and what remains to be validated.

**Acceptance check:**  
- [ ] Does not repeat every method name unless necessary.
- [ ] States that evaluation is synthetic.
- [ ] States that real learner validation remains future work.
- [ ] Separates delivered system from Phase-II plans.
- [ ] Avoids promotional closing language.

---

# Priority 5: Limitations and Honesty

## [ ] 5.1 Make synthetic-data limitation more prominent

**Issue:**  
The paper acknowledges synthetic data, but the limitation should be more visible because all major results depend on synthetic ground truth.

**Recommended fix:**  
Add a dedicated **Limitations** subsection before the conclusion or within Discussion.

**Agent instruction:**  
> Add a limitations subsection that clearly states what the synthetic evaluation can and cannot prove.

**Acceptance check:**  
- [ ] States that synthetic results demonstrate behavior under controlled assumptions.
- [ ] States that synthetic results do not prove effectiveness for real learners.
- [ ] States that real user logs may contain messier behavior.
- [ ] States that learning outcomes are not yet measured.
- [ ] States that logged time is not the same as mastery.

**Suggested limitation wording:**  
> The offline evaluation is useful because planted ground truth makes pace recovery, shift latency, and coverage measurable. However, it does not establish that the system improves learning outcomes for real users. Real learner logs may contain interruptions, multitasking, inaccurate self-reports, and motivational effects that are not fully represented by the generator.

---

## [ ] 5.2 Clarify that logged time is not verified learning

**Issue:**  
The system adapts to time and progress logs, but not necessarily to true understanding. The paper mentions verified mastery as Phase II, but the limitation should be explicit.

**Recommended fix:**  
Add a limitation sentence in Discussion and Future Work.

**Agent instruction:**  
> Add a clear statement that the delivered system adapts to logged study behavior, not verified learning or concept mastery.

**Acceptance check:**  
- [ ] The phrase “logged time is not equivalent to mastery” or equivalent appears.
- [ ] Phase II mastery assessment is clearly future work.
- [ ] The current system’s claims are limited to planning adaptation, not learning effectiveness.

---

## [ ] 5.3 Be direct about false alarms

**Issue:**  
CUSUM has a relatively high false-alarm rate. The paper justifies it because detection triggers a prompt rather than automatic replanning, but this should be treated as a user-experience trade-off.

**Recommended fix:**  
State the risk clearly.

**Agent instruction:**  
> Add a sentence explaining that CUSUM’s speed comes at the cost of more prompts, which could annoy learners if not tuned or rate-limited.

**Acceptance check:**  
- [ ] False-alarm rate is not minimized rhetorically.
- [ ] User burden is acknowledged.
- [ ] Future tuning or prompt throttling is mentioned if planned.

---

## [ ] 5.4 Avoid overclaiming deployment

**Issue:**  
The phrase “deployed, local-first web application” may be too strong if the system is a prototype, local deployment, private demo, or not used by real learners.

**Recommended fix:**  
Use the exact deployment status.

**Agent instruction:**  
> Replace “deployed” with the most accurate description: implemented prototype, local deployment, private hosted app, public web app, or pilot deployment.

**Acceptance check:**  
- [ ] Deployment claim matches reality.
- [ ] If no real users tested it, the paper does not imply real-user validation.
- [ ] Architecture claims are separated from evaluation claims.

---

# Priority 6: Language Cleanup

## [ ] 6.1 Remove template-like transitions

**Issue:**  
Phrases such as “The remainder of this paper is organized as follows” are acceptable but generic. The issue is not the phrase itself; it is the accumulation of formulaic transitions.

**Recommended fix:**  
Keep standard academic transitions only where necessary and shorten them.

**Agent instruction:**  
> Reduce formulaic transition sentences. Keep the paper readable but avoid unnecessary roadmap language.

**Acceptance check:**  
- [ ] Roadmap paragraph is shorter or removed if not required by venue.
- [ ] Section openings are specific to the paper’s content.
- [ ] Transitions do not sound interchangeable with any other paper.

---

## [ ] 6.2 Use simpler sentence structure where dense

**Issue:**  
Several sentences are long and list-heavy, especially in the abstract and conclusion.

**Recommended fix:**  
Break long method lists into shorter sentences.

**Agent instruction:**  
> Split long sentences that list four or more components. Prefer one main claim per sentence.

**Acceptance check:**  
- [ ] Abstract has fewer overloaded sentences.
- [ ] Conclusion has fewer method chains.
- [ ] Each paragraph has a clear topic sentence.
- [ ] Technical detail remains precise.

---

## [ ] 6.3 Replace broad adjectives with exact evidence

**Issue:**  
Words like “rigorous,” “robust,” “genuine,” “trustworthy,” and “clearest” can sound generic unless tied to exact evidence.

**Recommended fix:**  
Use numbers instead of adjectives.

**Agent instruction:**  
> Replace evaluative adjectives with exact metrics where possible.

**Acceptance check:**  
- [ ] “Rigorous evaluation” becomes “evaluation over X seeds / Y learners / Z baselines.”
- [ ] “Robust improvement” becomes “improvement of X with 95% CI [a, b].”
- [ ] “Trustworthy signal” becomes a defined metric or claim.
- [ ] “Genuine null” becomes “no statistically significant difference.”

---

## [ ] 6.4 Vary section voice without becoming informal

**Issue:**  
The current voice is smooth and uniform across all sections. Real academic writing often changes slightly by section: methods are procedural, results are numerical, discussion is interpretive.

**Recommended fix:**  
Let each section’s purpose shape the prose.

**Agent instruction:**  
> Make Methods procedural, Results data-forward, Discussion interpretive, and Conclusion reflective. Do not use the same tone everywhere.

**Acceptance check:**  
- [ ] Methods tells exactly what was done.
- [ ] Results foregrounds numbers.
- [ ] Discussion explains implications.
- [ ] Conclusion states what was learned and what remains open.

---

# Priority 7: Tables, Figures, and Reproducibility Assets

## [ ] 7.1 Add an experiment configuration table

**Issue:**  
The paper mentions 200 seeds and held-out archetypes but does not give a compact experiment configuration summary.

**Recommended fix:**  
Add a table near the comparison methodology.

**Agent instruction:**  
> Add an experiment configuration table that lists seeds, synthetic learners, sessions, archetypes, train/development split, held-out split, bootstrap procedure, and correction method.

**Recommended table:**

| Item | Value |
|---|---:|
| Random seeds | 200 |
| Synthetic learners per seed | TODO |
| Sessions per learner | TODO |
| Learner archetypes | TODO |
| Held-out archetypes | TODO |
| Bootstrap unit | Learner |
| Bootstrap repetitions | TODO |
| Multiple-comparison correction | Holm / Benjamini–Hochberg |
| Oracle baseline | Uses planted ground truth; not deployable |

**Acceptance check:**  
- [ ] Reader can understand evaluation scale quickly.
- [ ] No hidden evaluation assumptions remain.
- [ ] The correction family is clear.

---

## [ ] 7.2 Improve figure captions

**Issue:**  
Figure captions are generally useful but can do more explanatory work, especially Fig. 1 and Fig. 2.

**Recommended fix:**  
Make captions self-contained.

**Agent instruction:**  
> Rewrite figure captions so each explains what the figure shows, what is delivered, what is future work, and what conclusion the reader should draw.

**Acceptance check:**  
- [ ] Fig. 1 clearly distinguishes delivered features from Phase-II features.
- [ ] Fig. 2 states nominal coverage and the main coverage finding.
- [ ] Captions do not repeat excessive method prose.

---

## [ ] 7.3 Add code or reproducibility statement if possible

**Issue:**  
The paper makes detailed experimental claims. A reproducibility statement would increase trust.

**Recommended fix:**  
Add a short statement about availability of code, seeds, synthetic generator, or whether they are private.

**Agent instruction:**  
> Add a reproducibility note. State whether code, synthetic generator settings, random seeds, and evaluation scripts are available or will be released.

**Acceptance check:**  
- [ ] Code availability is stated honestly.
- [ ] Random seeds or seed-generation procedure are documented.
- [ ] Synthetic generator settings are documented.
- [ ] If code is unavailable, the reason is stated briefly.

---

# Priority 8: Concrete Rewrite Prompts for Your Agent

Use these prompts one by one. Do not ask the agent to rewrite the whole paper at once.

## [ ] 8.1 Factual audit prompt

```text
Audit this paper for claims that need evidence. Create a table with columns: Claim, Location, Evidence Needed, Current Evidence in Draft, Action. Do not rewrite yet. Mark unsupported claims that should be weakened or removed.
```

## [ ] 8.2 Synthetic data subsection prompt

```text
Using only the project details I provide, write a Synthetic Data Generator subsection for the Methodology. Include dataset source, calibrated parameters, manually chosen assumptions, learner archetypes, planted ground truth, random seeds, and held-out evaluation setup. Do not invent missing values; leave TODO where I need to fill details.
```

## [ ] 8.3 Results table prompt

```text
Convert the prose results into data-forward results sections. For each component, add a table before interpretation. Use exact numbers I provide. Do not invent values. Keep null results clear and neutral.
```

## [ ] 8.4 Architecture rewrite prompt

```text
Rewrite the System Architecture section to emphasize actual implementation details. Explain the local-first event log, server-side intelligence service, Supabase role, authentication, recalibration prompt flow, and the design revision from item-level day packing to capacity bookings. Use only true implementation details.
```

## [ ] 8.5 Tone cleanup prompt

```text
Revise the paper for precise academic tone. Replace rhetorical phrases such as “genuine win,” “honest null,” “robust null,” and “clearest finding” with neutral technical language. Do not remove important results. Do not make the text bland; make it specific.
```

## [ ] 8.6 Abstract rewrite prompt

```text
Rewrite the abstract in 180–220 words. Structure it as: problem, gap, method, evaluation, key result, limitation. Avoid long chains of method names. Mention synthetic evaluation honestly. Do not overclaim deployment or real-world validation.
```

## [ ] 8.7 Conclusion rewrite prompt

```text
Rewrite the conclusion in three paragraphs: what was built, what the evaluation showed, and what remains future work. Do not repeat the abstract. Clearly separate delivered system features from Phase-II features. Mention that real learner validation remains future work.
```

## [ ] 8.8 Reference audit prompt

```text
Audit the references. Verify that each cited work exists and supports the exact claim made in the paper. Return a table with: reference, claim supported, verification status, missing bibliographic fields, and recommendation to keep, replace, or remove.
```

---

# Priority 9: Final Self-Review Before Sending for Second Review

## [ ] 9.1 Run a “specificity pass”

**Question to ask:**  
Could another paper in another domain use this same sentence with only minor word changes?

**Fix:**  
If yes, add project-specific detail or remove the sentence.

**Checklist:**

- [ ] Abstract has exact scope.
- [ ] Contributions are measurable.
- [ ] Dataset/generator is documented.
- [ ] Results include exact values.
- [ ] Limitations are direct.
- [ ] References are verified.

---

## [ ] 9.2 Run a “truthfulness pass”

**Question to ask:**  
Can I prove this sentence from my code, data, experiment logs, UI, or design notes?

**Fix:**  
If not, weaken, qualify, or remove it.

**Checklist:**

- [ ] “Deployed” is accurate.
- [ ] “Large public LMS dataset” is named and described.
- [ ] “Literature-calibrated” is explained.
- [ ] “Held-out archetypes” are defined.
- [ ] “Known ground truth” is explained.
- [ ] “Phase II” is clearly future work.

---

## [ ] 9.3 Run a “numbers before adjectives” pass

**Question to ask:**  
Am I using adjectives where a number would be better?

**Fix:**  
Replace broad adjectives with values, confidence intervals, or method details.

**Checklist:**

- [ ] Replace “rigorous” with evaluation details.
- [ ] Replace “robust” with cross-regime result details.
- [ ] Replace “genuine” with statistical or design explanation.
- [ ] Replace “trustworthy” with calibrated coverage or uncertainty evidence.

---

## [ ] 9.4 Run a “section purpose” pass

**Question to ask:**  
Does each section do a different job?

**Fix:**  
Remove repeated summary language and move details to the correct section.

**Checklist:**

- [ ] Abstract summarizes.
- [ ] Introduction motivates.
- [ ] Related Work positions.
- [ ] Architecture explains the system.
- [ ] Methodology enables reproduction.
- [ ] Results report numbers.
- [ ] Discussion interprets.
- [ ] Conclusion reflects and limits.

---

# Final Revision Target

Your revised paper should read like this:

> A technically specific report of a real adaptive-study-planning project, with transparent synthetic evaluation, clear implementation boundaries, honest null results, exact result tables, verified references, and enough design detail that the reader can see what you actually built and why the system changed during development.

It should **not** read like this:

> A highly polished survey-style paper that names many advanced methods, repeats the same contribution framing across sections, and makes broad claims without enough implementation, data-generation, or result detail.

---

# Second-Review Readiness Checklist

Before bringing the updated version for second review, confirm:

- [ ] The paper has a new Synthetic Data Generator subsection.
- [ ] The public LMS dataset is named and described.
- [ ] Experiment settings are summarized in a table.
- [ ] Change-detection results include all candidate detectors.
- [ ] Projection results include exact coverage values by method and history band.
- [ ] Calibration includes clearer metric definitions and preferably an ablation.
- [ ] The retired scheduling optimizer is clearly separated from shipped behavior.
- [ ] The architecture section includes concrete implementation and redesign details.
- [ ] Limitations explicitly discuss synthetic data, logged time vs mastery, and real-user validation.
- [ ] References are verified and consistently formatted.
- [ ] The abstract and conclusion no longer repeat the same method chain.
- [ ] Rhetorical phrases have been replaced with neutral technical language.
- [ ] No fabricated details were added during rewriting.
