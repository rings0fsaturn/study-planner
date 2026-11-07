# Fix Plan - AI Writing Pattern Audit, Chapters 1 to 3

_Task: phase2-prose-review - Status: applied 2026-10-23; awaiting build and PDF verification - Date: 2026-10-23_

_Scope: `college/mydeliverables/Phase-2-report/phase2-report/chapters/01-introduction.tex`, `02-literature-survey.tex`, `03-requirements.tex`._

_Audits: `plan/audits/ai-writing-audit-ch01.md`, `plan/audits/ai-writing-audit-ch02.md`, `plan/audits/ai-writing-audit-ch03.md`._

## 1. How to use this plan

This plan consolidates the three chapter audits into one ordered fix list.
It separates mechanical edits from author decisions.
It never treats a stylistic pattern as proof of AI authorship.
It does not rewrite the chapters wholesale.
Every edit must preserve the technical meaning and every cited number.
Every proposed replacement is a proposal, not an invented fact.
Rows marked "Q-nn" are blocked until the author answers the matching question in Section 5.

## 2. Baseline

The current deterministic lint is the starting point.

| Chapter | STE | Humanizer | Main risk |
|---|---|---|---|
| Ch01 Introduction | FAIL, 13 fail-tier hits | PASS, 0 fail-tier hits | Four Phase-I recap claims stronger than the Phase-I evidence |
| Ch02 Literature Survey | FAIL, 1 fail-tier hit (`:16`, 7 sentences) | PASS, 0 fail-tier hits | Project-side claims and a summary table that misattribute sources |
| Ch03 Requirements | PASS, 0 fail-tier hits | PASS, 0 fail-tier hits | One written-arm attribution error, one delivery-status contradiction, several untestable requirements |

The audits agree that the chapters are not dominated by surface AI-style tells.
The dominant problems are claim-evidence alignment, source attribution, cross-reference drift, and requirement precision.
The writing-review priority for all three chapters is 3 on the audit rubric.
That score means major issues affecting argument, evidence, consistency, or submission readiness.
It is not an AI-likelihood score.

## 3. Consolidated fix batches

The batches run in dependency order.
Batch 0 is preparation.
Batch 1 fixes truth and attribution in Chapter 1.
Batch 2 fixes Chapter 2 claims and source evidence.
Batch 3 fixes Chapter 3 attribution and requirement quality.
Batch 4 fixes cross-chapter consistency that the three chapter audits exposed.
Batch 5 is verification.
Batch 6 is the record update.

Do not run Batch 4 before the author answers Q-13 and Q-14.
Do not run any author-blocked row before its question is answered.

### Batch 0 - Pre-flight

1. Run `git status --short` and confirm no parallel session has edited the three chapters since the audits.
2. Re-run `python3 .work/active/phase2-prose-review/ste_check.py` on each chapter and save the output beside this plan.
3. Copy the three current chapter files to a scratch folder under this task if a before/after diff is needed.
4. Confirm the bibliography keys still resolve against `main.tex`.
5. Read the three audit reports once more before editing.
6. Do not touch `main.pdf`, `active/phase2-report/*`, or research evidence files from this task.

Acceptance: the baseline lint matches Section 2, and the checkout is clean for these three files.

### Batch 1 - Chapter 1 truth and attribution

File: `chapters/01-introduction.tex`.

| ID | Line | Current text | Fix | Evidence or guard | Priority | Blocked by |
|---|---|---|---|---|---|---|
| C1-01 | `:5` | "with a calibrated uncertainty band" | "with an uncertainty band" | Phase I `06-results.tex:70` reports 0.183 to 0.494 coverage against a nominal 0.95; `:108` says the conformal correction is unshipped. | P0 | none |
| C1-02 | `:5` | "It flagged genuine shifts in pace" | "It flagged candidate shifts in pace for learner confirmation" | Phase I `06-results.tex:57` reports CUSUM false-alarm rates of 0.312 and 0.296; `:67` says a detected shift raises a recalibration prompt. | P0 | none |
| C1-03 | `:5` | "The calibrated pace beat the fixed-rate baseline only after enough sessions had accumulated to move the posterior (see the Phase-I evaluation)." | "The enriched-shrinkage calibrator beat the moving-average baseline on prospective error, including the short-history band (see the Phase-I evaluation)." | Phase I `06-results.tex:17-20` shows enriched-shrinkage at 0.049 against 0.094 on the short band. | P0 | Q-01 |
| C1-04 | `:5` | "with hierarchical Bayesian calibration~\cite{chen2024}" | "with a Bayesian model that used hierarchical priors~\cite{chen2024} and a context-aware shrinkage calibrator" | Phase I `06-results.tex:25` selects enriched-shrinkage and calls hierarchical Bayesian the incumbent; `02-literature-survey.tex:7` says Chen supplies prior structure, not the updater. | P0 | Q-01 |
| C1-05 | `:5` | "true study pace" | "study pace" | The estimator does not recover the latent pace exactly. | P3 | none |
| C1-06 | `:5` | "The comparison reported its nulls honestly." | Delete the sentence. | The next sentence names the change-detection null; the calibration sentence carries the positive result. | P2 | none |
| C1-07 | `:5` | 15-sentence paragraph | Split after "Phase~I of this project built an open-loop adaptive planner for this learner." and after "Each component was compared against baselines on a synthetic dataset with known ground truth." | STE 6.6; the resulting paragraphs hold 4, 5, and 6 sentences. | P2 | none |
| C1-08 | `:8` | "Existing tools leave the same gap open from the other side." | "Existing tools cover the time side of the gap, not the understanding side." | S3; removes an unclear metaphor. | P3 | none |
| C1-09 | `:8` | "Time-tracking applications record hours without judging understanding~\cite{alhazbi2024}." | "Learning-analytics measures of self-regulated learning lean on time-management traces~\cite{alhazbi2024}, so logged time is measured while understanding is not." | Ch02 `:45` says Alhazbi reviews 25 studies and most validated indicators relate to time management. | P0 | Q-02 |
| C1-10 | `:8` | "The static generators surveyed here do not revise the plan against grade evidence~\cite{islam2024}." | "The prediction-then-optimize study surveyed here uses predicted grades for scheduling, not graded evidence from the learner's own answers~\cite{islam2024}." | Ch02 `:38` calls the study prediction-then-optimize and reports 0.73 grade-prediction accuracy. | P0 | Q-02 |
| C1-11 | `:8` | "The missing piece is assessment-based verification of genuine learning." | "The missing piece in the Phase~I system is assessment-based verification of genuine learning." | Scopes a field-wide-sounding claim to the project. | P1 | none |
| C1-12 | `:8` | "Grades then drive the decision to stay the course or to replan." | "Grades update mastery, and the mastery verdict drives the decision to stay the course or to replan." | Ch04 `:9` says grades steer mastery, mastery and posture steer the verdict, and the verdict steers the plan. | P1 | none |
| C1-13 | `:8` | 13-sentence paragraph | Split after "Existing tools leave the same gap open from the other side." and after "Grades then drive the decision to stay the course or to replan." | STE 6.6; the resulting paragraphs hold 4, 4, and 5 sentences. | P2 | none |
| C1-14 | `:13` | "so every question stays traceable to the material it tests" | "grounding and recorded citations keep every question traceable to the material it tests" | Ch04 `:15` separates family alternation from grounding and recorded citations. | P1 | none |
| C1-15 | `:15` | The 29-word grading sentence | Split after "authored answers." | STE 6.3; keeps all three grading modes. | P2 | none |
| C1-16 | `:17` | The 32-word mastery sentence | Split at "and"; change "adapts the difficulty" to "uses the estimate to recommend the difficulty". | STE 6.3; Ch04 `:21` calls it a difficulty recommendation; Ch06 `:57` calls the chip uncalibrated-advisory. | P2 | none |
| C1-17 | `:19` | "The coach answers questions through a ladder of Nudge, Hint, Targeted explanation, and Reveal. The reveal gate enforces this: the final step stays locked until the learner confirms." | "The final step stays locked until the learner confirms, so guidance never gives the answer before the learner works." | Removes a restatement and keeps the gating rationale. | P3 | none |
| C1-18 | `:21` | "Return advisory feedback copy on each graded attempt." | "Return advisory feedback copy on updated results." | Ch03 `:62` says "on updated results only"; Ch04 `:24` says "for updated entries". | P0 | none |
| C1-19 | `:23` | "Starting practice therefore stays fast even on slow networks." | "Cache-first loading and lazy resolution keep starting practice responsive on slow networks." | Hedges an unmeasured performance claim. | P3 | none |
| C1-20 | `:25` | "learner posture" and "with its identity attached" | "schedule posture" and "with its verdict pair attached" | Ch04 `:7` says "schedule posture"; Ch05 `:214` and Ch06 `:82` say "verdict pair". | P1 | Q-03 |
| C1-21 | `:25` | "(see Sections~4.3 and 6.3)" | "(see Sections~4.2.5 and 6.3)" | Ch04 `:26-27` places `LOOP_APPROVE_AT = 0.7` in Section 4.2.5; Section 4.3 is Comparison Methodology. | P0 | none |
| C1-22 | `:29` | "Each part was compared offline against baselines and realized in the application." | "Each part was compared offline against baselines, and the selected models were realized in the application." | Phase I `06-results.tex:130` and `04-methodology.tex:49` say the evaluated schedule allocator was deliberately not shipped. | P0 | none |
| C1-23 | `:29` | "The synthetic archetypes replace the longitudinal real-learner study a single semester cannot supply." | "The synthetic archetypes replace the longitudinal real-learner study planned in Phase~I; a real single-learner study remains future work." | Phase I `01-introduction.tex:27` promised the study; Phase I `06-results.tex:135` defers it. | P0 | Q-04 |
| C1-24 | `:32` | 7-sentence organization paragraph | Split after "Section~4.5."; shorten the Chapter 2 and Chapter 4 sentences. | STE 6.3 and 6.6; keep every section pointer. | P2 | none |
| C1-25 | `:2`, `:8`, `:32` | "sets out" (`:2`, `:32`), "draws on" (`:32`), "feeds a verdict on the plan back into" (`:8`) | "describes", "uses", "sends a verdict on the plan to" | Task-local phrasal-verb list. | P3 | none |

Chapter 1 acceptance: the four Phase-I recap overclaims are gone, the two citation stretches are narrowed, the 4.3 pointer is corrected, and the two long paragraphs are split.
Do not change the Phase-I numbers or add a new number without a Phase-I or live-code source.

### Batch 2 - Chapter 2 claims, evidence, and table

File: `chapters/02-literature-survey.tex`.

| ID | Line | Current text | Fix | Evidence or guard | Priority | Blocked by |
|---|---|---|---|---|---|---|
| C2-01 | `:16` | "pins its Bayesian variant, called bkt-v1, at an AUC of 0.888 against 0.889 for the baseline" | "reports its Bayesian variant, called bkt-v1, at an AUC of 0.888 against 0.889 for the running-proportion baseline" | Ch06 `:57` names running-proportion; `services/intelligence/scripts/eval_harness.py:333` scores bkt-v1 against that baseline. | P1 | Q-05 |
| C2-02 | `:16` | "The cut is the Chapter~4 bake-off" | "The comparison is the Chapter~4 bake-off" | S8; removes internal shorthand. | P3 | none |
| C2-03 | `:16` | "at an AUC of 0.888" | "at an area under the curve (AUC) of 0.888" | Abbreviation defined at first use. | P3 | none |
| C2-04 | `:16` | "That is parity rather than a win." | Keep the sentence and add: "The project kept the simpler, per-skill updater at parity because the loop needs an interpretable mastery estimate more than a small ranking gain (see Section~4.2.3)." | Ch04 `:21` records the parity selection; the criterion is not stated. | P1 | Q-06 |
| C2-05 | `:16` | 7-sentence Zanellati paragraph | Split before "Against this." | STE 6.6; the paper summary and the project contrast become separate paragraphs. | P2 | none |
| C2-06 | `:18` | "The calibrated pace work in Phase~I already showed the pattern: a Bayesian estimate beats a fixed-rate baseline only after enough sessions accumulate." | "Phase~I found that a calibrated pace estimator can win on short session histories, but mastery tracing has a harder cold start because it needs graded responses, not session logs." | Phase I `06-results.tex:17-20`; same false claim as C1-03. | P0 | Q-01 |
| C2-07 | `:20` | "The project therefore keeps the Bayesian updater with an informative stance from onboarding data." | "The project therefore keeps the Bayesian updater with the fixed prior set by the bake-off." | Ch06 `:57` fixes `p_init` at 0.15; `packages/py-progress/src/py_progress/mastery.py:39-42` uses 0.15. | P0 | Q-07 |
| C2-08 | `:20` | "The mastery estimate then drives difficulty instead of a fixed sequence." | "The mastery estimate then feeds an advisory difficulty recommendation instead of a fixed sequence." | Ch04 `:21`; Ch06 `:57` says the chip stays uncalibrated-advisory. | P0 | none |
| C2-09 | `:23` | "a groundedness of 0.867 with a near-duplicate rate of 0.004" | "a groundedness of 0.8667 with a near-duplicate rate of 0.0044" | Ch03 `:76` and Ch06 `:34` use 0.8667 and 0.0044. | P2 | none |
| C2-10 | `:23` | "The paper evaluates generation per subject but does not record chunk-level provenance. It does not record which chunk each question came from, so a wrong question cannot be traced back to its source." | "The paper evaluates generation per subject but does not record which chunk each question came from, so a wrong question cannot be traced back to its source." | S2; removes a repeated sentence. | P3 | none |
| C2-11 | `:23` | "The work on automatic item generation reports fluency first and traceability second." | "The prompting study cited here reports item quality but not chunk-level provenance." | S9; the cited study is one prompting study, not the whole literature. | P1 | Q-02 |
| C2-12 | `:27` | "against a hybrid baseline of 0.80 and 0.720" | Keep, and keep the "ACCA 754-chunk split" and "n=30" labels in the same paragraph. | Ch06 `:7`; task rule 11 on corpus-split labels. | P3 | none |
| C2-13 | `:29` | "The study stops at the tag. It does not use the tag to steer practice." | "The tag makes per-skill histories possible, but the study does not use it to steer practice." | S3; merges a redundant pair. | P3 | none |
| C2-14 | `:31` | "carries a per-problem family label from generation into the run" | "carries the per-problem skill tags from generation into the run" | `services/intelligence/app/routers/mastery.py:29` groups by `(materialId, skillTag)`; generation emits `skillTags`. | P0 | Q-08 |
| C2-15 | `:36` | "By contrast, the project's live matrix grades written runs 4 out of 4 with real rubric grades (deployment check, see Section~6.2)." | "The project's deployment check is separate: written runs graded 4 of 4 with real rubric grades (see Section~6.2)." | Ch06 `:77`; the 4/4 is a deployment check, not a grading-accuracy comparison. | P1 | none |
| C2-16 | `:38` | "objective runs 2 out of 2 and reviews 4 out of 4" | "objective runs 2 of 2 and the review queue passes 4 of 4" | Ch06 `:77` separates written runs from review. | P2 | none |
| C2-17 | `:38` | "Prediction does not substitute for grading." | Optional: "Prediction informs scheduling; it does not produce the grade the loop records." | S5; the negative half currently names a position no cited work holds. | P3 | none |
| C2-18 | `:42` | "The limitation this answers is single-signal grading treated as final." | "The gap this design answers is single-signal grading treated as final." | F-01; reduces the repeated "limitation" pivot. | P3 | none |
| C2-19 | `:47` | "The measurement side is well covered." | Delete, and start the paragraph with "Alhazbi et al.~\cite{alhazbi2024} review 25 empirical studies..." | S6; the scope sentence already carries the point. | P3 | none |
| C2-20 | `:51` | "analyses" | "analyzes" | American spelling rule; already resolved if C2-21 is applied first. | P2 | none |
| C2-21 | `:51` | "This matches the project's own replay result. After the fix the synthetic histories convert 4 out of 4 verdict-triggered replans. The material-scoped span is 32 days (post-fix replay at gate 0.7, see Section~6.3). Before the fix every case held." | "The study analyzes how help-seeking can be gamed. The project's replay measures a different outcome: after the fix, the synthetic histories convert 4 of 4 verdict-triggered replans, against 4 of 4 holds before the fix (post-fix replay at gate 0.7; see Section~6.3). The material-scoped span is 32 days." | Ch06 `:82`; the gaming study and replan conversion are different outcomes. | P0 | Q-09 |
| C2-22 | `:71` | "Each stage is surveyed in Sections~2.1 to~2.4." | "Each stage is motivated in Sections~2.1 to~2.4; the sandbox and feedback-copy stages are implementation-only." | F-12; the sandbox and feedback copy have no cited work. | P1 | none |
| C2-23 | `:76` | "One representative work was kept per sub-theme" | "One to three representative works were kept per sub-theme" | Sections 2.1, 2.2, and 2.4 each carry three works. | P1 | none |
| C2-24 | `:76` | "the Phase~I knowledge-tracing trio" | "the Phase~I Bayesian learner-modelling sources" | The Phase I literature survey contains Chen, Zanellati, Zambrano, and Mai; the count and label are not exact. | P1 | Q-10 |
| C2-25 | `:78` | "This keeps every metric in the chapter traceable to the Phase~I report or to live code reality, with no invented numbers." | "This keeps every project metric traceable to the Phase~I report or to live code; paper-side numbers are cited where the source states one." | F-04; the chapter contains paper-side numbers such as 312 adults, 0.73, and 25 studies. | P0 | none |
| C2-26 | `:78` | "The project's own harness or live number appears beside it, labeled as the project's." | "Where the project has a comparable number, it appears beside the paper's and is labeled as the project's." | S12; several paper entries have no project counterpart. | P3 | none |
| C2-27 | `:90-95` | Table header "Strengths" and "Limitations for this project" | "Strengths or design basis" and "Gap this design addresses" | F-11; the table mixes surveyed strengths with implementation choices. | P0 | Q-11 |
| C2-28 | `:92` | "Knowledge tracing~\cite{chen2024,zanellati2024,mai2025}" | "Knowledge tracing~\cite{zanellati2024,mai2025}" | Chen targets teacher example choice, not knowledge tracing; the body says so at `:7`. | P0 | Q-11 |
| C2-29 | `:94` | "Grading~\cite{llmgrade2024,islam2024} and sandbox execution" | "Rubric grading~\cite{llmgrade2024} and implementation-only sandbox execution" | `islam2024` is prediction and scheduling, not grading; the sandbox has no cited source. | P0 | Q-11 |
| C2-30 | `:92-95` | No table note | Add after the table: "Sandbox execution is implementation-only; the table claims no surveyed source for it." | F-11; keeps the table honest. | P0 | Q-11 |
| C2-31 | `:11`, `:14` | `P_{\text{correct}}(L_n)` and `P_{\text{obs}}(L_n)` | Ask whether they are the same posterior; if yes, use one symbol; if not, define both. Do not change the mathematics. | F-16; the equation is referenced in Chapters 4 to 6. | P1 | Q-12 |
| C2-32 | `:22` | "Automatic Item Generation and KC Tagging" | "Automatic Item Generation and Knowledge-Component (KC) Tagging", or define KC in the first body sentence. | Abbreviation at first use. | P3 | none |
| C2-33 | `:33` | "LLM and Sandbox Grading" | "Large Language Model (LLM) and Sandbox Grading", or define LLM in the first body sentence. | Abbreviation at first use. | P3 | none |

Chapter 2 acceptance: the project-side prior, difficulty, signal-name, gaming-match, and metric-traceability claims are corrected; the table no longer misattributes Chen or `islam2024`; Section 2.5 describes its actual selection rule; the 7-sentence paragraph is split.
Do not invent a paper metric to fill a missing 4-beat entry.
Use Q-02, Q-05, and Q-09 to decide whether a source supports the claim before adding evidence.

### Batch 3 - Chapter 3 attribution and requirement quality

File: `chapters/03-requirements.tex`.

| ID | Line | Current text | Fix | Evidence or guard | Priority | Blocked by |
|---|---|---|---|---|---|---|
| C3-01 | `:59` | "rubric grading with Jev-1.13 applies to written items" | "rubric grading with the OpenRouter rubric model applies to written items; Jev-1.13 is an advisory shadow and the loop-verdict judge" | `grading/worker.py:65` sets `DEFAULT_MODEL = "deepseek/deepseek-v4-flash-0731"`; `worker.py:382` calls `_jev_shadow_rubric` after the grade; `.env.example:53-57` says Jev is advisory and never touches the server grade. | P0 | Q-13 |
| C3-02 | `:59` | "Each arm is tested separately." | Delete from FR-10; Ch06 carries the live verification. | F-11; requirements should not carry test evidence. | P2 | none |
| C3-03 | `:37` | "OpenRouter generation provider plus Jev-1.13 judgment client for the written arm" | Split the row: "OpenRouter generation and rubric-grading provider (DeepSeek V4 Flash in the shipped configuration); Jev-1.13 advisory judgment client" | Ch05 `:27-29`; same attribution as C3-01. | P0 | Q-13 |
| C3-04 | `:53` | "The system shall detect a shift in the learner's pace" | Do not edit until Q-14. If the detector ships, keep FR-4 and fix Ch06/Ch07. If the posture is unshipped, qualify FR-4. | Phase I `06-results.tex:60` says the delivered system ships the single-arm CUSUM; Ch04 `:47` says it still prompts recalibration; Ch06 `:111` and Ch07 `:5,19` call it unshipped. | P0 | Q-14 |
| C3-05 | `:64` | "(see Section~4.3)" | "(see Section~4.1; replay evidence in Section~6.3)" | Ch04 `:7` in Section 4.1 carries the hold rule; Section 4.3 is Comparison Methodology. | P0 | none |
| C3-06 | `:75` | "with exact match" | "with numeric equality to a tight tolerance" | Ch05 `:59` says tight tolerance; `packages/py-roadmap-engine/tests/test_fixtures.py:15` sets `TOLERANCE = 1e-6`. | P0 | Q-15 |
| C3-07 | `:76` | "on its gold set (26 of 30 judged, see Section~6.1)" | "on a 30-question judged sample (26 answerable, see Section~6.1)" | Ch06 `:34` reports 0.8667 with 26 of 30 judged answerable and separates it from gold support 0.7803. | P1 | Q-16 |
| C3-08 | `:76` | "Every generated question shall carry its recorded chunk citations. The harness reports groundedness of 0.8667..." | Keep the citation obligation in FR-9, and make NFR-7 a threshold: "The judged groundedness of generated questions shall be at least 0.8667 on the 30-question sample (see Section~6.1)." | F-11; removes duplication and moves the result into a quality bar. | P1 | Q-17 |
| C3-09 | `:74` | "within 8~s per attempt with at most two retries, and projection runs locally in milliseconds" | "within 8~s per attempt, with at most two retries; the worst case is three attempts. Projection runs locally without a network call." | `apps/app/src/lib/intelligenceClient.ts:5-6` sets an 8 s timeout and two retries; "milliseconds" is not a testable threshold. | P1 | none |
| C3-10 | `:16-18` | The "Requirement" column mixes minimums and project-machine facts | Split into "Minimum requirement" and "Project machine" columns, or move the project-machine facts to a table note. | F6; line `:6` already says the card and image sizes describe the project machine. | P1 | Q-18 |
| C3-11 | `:18` | "At least 60~GB free for the full image set (GPU sidecar image measured at 49.5~GB, base images at about 2.3~GB)" | "At least 60~GB free for the container images (GPU sidecar 49.5~GB, Piston 1.42~GB, product images about 1.7~GB); build cache and volumes need more (about 74~GB on the project machine)." | `docker image ls` shows 49.5 GB sidecar, 1.42 GB Piston, and 790 MB + 790 MB + 81.8 MB product images; rule 54 records about 74 GB with build cache. | P1 | Q-18 |
| C3-12 | `:26` | "keeps the three Phase-I tiers" | "keeps the Phase-I tiers" | F8; Phase I `03-requirements.tex:25` defines the tiers, but the Phase-II table lists seven rows. | P2 | none |
| C3-13 | `:37` | The long intelligence-service cell | Split into "Intelligence service and worker" and "Model providers" rows; use "guidance" consistently. | F9; the cell mixes languages, endpoints, providers, and packaging. | P2 | none |
| C3-14 | `:2` | The copied Phase-I opening | "This chapter specifies the requirements of the full system. Sections~3.1 and~3.2 state the hardware and software environment. Section~3.3 lists FR-1 to FR-15, and Section~3.4 lists NFR-1 to NFR-9. FR-9 to FR-15 and NFR-7 to NFR-9 cover the Phase-II additions." | F10; names the Phase-II delta and removes "as numbered items". | P2 | none |
| C3-15 | `:60` | "recommend the next difficulty from that estimate" | "provide an advisory difficulty recommendation from that estimate. The recommendation is not calibrated (see Section~6.1)." | Ch06 `:57` says difficulty calibration is unmeasured and the chip is uncalibrated-advisory. | P1 | Q-19 |
| C3-16 | `:78` | "The floor follows the \texttt{hybrid\_rerank} arm" | "The floor is set from the \texttt{hybrid\_rerank} arm" | F13; "follows" does not say whether the floor is copied, bounded, or derived. | P2 | Q-20 |
| C3-17 | `:6` | "so the workstation carries one" | "so the workstation includes a discrete graphics processor." | S2; removes the vague antecedent. | P3 | none |
| C3-18 | `:17` | "project machine uses more with the GPU sidecar loaded" | Move to the table note or state the measured RAM. | S4; "more" is not testable. | P2 | Q-18 |
| C3-19 | `:18` | "local browser data stays small" | "local browser data stays under the per-user quota", or state a measured bound. | S5; "small" is not testable. | P2 | Q-18 |
| C3-20 | `:20` | "Any device with a modern web browser" | "Any device with a current browser that supports IndexedDB and ES2022" | S6; "modern" has no testable floor. | P3 | none |
| C3-21 | `:26` | "The Python intelligence service plus its worker now hosts" | "The Python intelligence service and its worker now host" | S7; subject-verb agreement. | P3 | none |
| C3-22 | `:59` | "Deterministic marking" | "Deterministic grading" | S10; one name for one operation. | P2 | none |
| C3-23 | `:64` | "Logged hours alone do not trigger a replan" | Keep the contrast and retarget the pointer per C3-05. | S11; the negative half carries real scope information. | P0 | none |
| C3-24 | `:48`, `:68` | "Phase-I" | "Phase~I" | Terminology consistency with the rest of the report. | P3 | none |

Chapter 3 acceptance: the written arm is attributed to the model that actually grades, Jev is described as advisory unless Q-13 says otherwise, the CUSUM delivery status is resolved, NFR-6 matches the parity harness, and the hardware table separates minimums from the project machine.
Do not silently change a requirement to match a chapter that may itself be wrong.

### Batch 4 - Cross-chapter consistency

These files are outside the three reviewed chapters but the audits found contradictions that a Chapter 1 to 3 fix alone cannot close.
Run X-02 and X-03 only after Q-14 and Q-13 are answered; X-01, X-04, X-05, and X-06 can run independently.

| ID | File and line | Issue | Fix | Priority |
|---|---|---|---|---|
| X-01 | `04-methodology.tex:52`, `06-results.tex:34`, `06-results.tex:57` | 0.867 and 0.004 in Ch02 and Ch04 versus 0.8667 and 0.0044 in Ch03 and Ch06; the AUC baseline is unnamed | Use 0.8667 and 0.0044 throughout, and name the running-proportion baseline at first use. | P2 |
| X-02 | `06-results.tex:111`, `07-conclusion.tex:5`, `07-conclusion.tex:19` | The single-arm CUSUM is called validated but unshipped, while Phase I `06-results.tex:60` and Ch04 `:47` say it ships | Resolve with Q-14. Likely fix: remove the CUSUM from the unshipped list and keep only the split-conformal correction. | P0 |
| X-03 | `05-implementation.tex:27-29` | The provider table names Jev as the judgment client but not the rubric-grading model | Add a "Rubric-grading model" row with `deepseek/deepseek-v4-flash-0731` (`GRADING_MODEL`); keep Jev on the advisory and loop-verdict paths. | P0 |
| X-04 | `main.tex:129`, `05-implementation.tex:61`, `05-implementation.tex:122` | "realised" British spelling versus the American spelling rule | Change to "realized" in a separate copy-edit pass. | P2 |
| X-05 | `main.tex:169`, `:171`, `:173`, `:175`, `:179` | Five bibliography entries lack author names | Complete the metadata under the G1 verbatim rule; do not guess an author. | P1 |
| X-06 | `04-methodology.tex:21` | The BKT selection criterion is implied but not stated | Optionally add the parity and interpretability criterion that Chapter 2 will point to. | P2 |
| X-07 | `01-introduction.tex:25`, `03-requirements.tex:64` | The stale Section 4.3 pointer appears in two chapters | Covered by C1-21 and C3-05; grep all chapters for `Section~4.3` after the edits. | P0 |

## 4. Recommended execution order

1. Answer Q-01, Q-02, Q-03, Q-04, Q-05, Q-06, Q-07, Q-08, Q-09, Q-10, Q-13, Q-14, Q-15, Q-16, Q-17, Q-18, Q-19, and Q-20 before editing the rows they block.
2. Apply Batch 1 P0 rows, then run the Chapter 1 lint.
3. Apply Batch 1 P1 and P2 rows, then re-run the Chapter 1 lint.
4. Apply Batch 2 P0 rows, then the Chapter 2 lint.
5. Apply Batch 2 P1 and P2 rows, then the Chapter 2 lint.
6. Apply Batch 3 P0 rows, then the Chapter 3 lint.
7. Apply Batch 3 P1 and P2 rows, then the Chapter 3 lint.
8. Apply Batch 4 after Q-13 and Q-14, then run the cross-chapter grep set.
9. Apply the P3 style rows last, in one small pass per chapter.
10. Run the full verification in Section 6.

Stop after any batch that introduces a new lint fail and fix it before moving on.

## 5. Author decision queue

These questions cannot be settled from the files alone.
Do not invent an answer.
Record the answer in this plan or in `state.md` when received.

| ID | Question | Why it blocks | Blocks |
|---|---|---|---|
| Q-01 | Which Phase-I baseline and metric support the "only after enough sessions" claim? Phase I `06-results.tex:17-20` shows the selected enriched-shrinkage calibrator ahead of moving average at every band, including short history. | The claim contradicts the table. | C1-03, C2-06 |
| Q-02 | Do `islam2024` and `alhazbi2024` support the claims at Ch01 `:8`? `islam2024` is a prediction-then-optimize study, and `alhazbi2024` is a review of self-regulated-learning measures. | Both citations support narrower claims than the sentences make. | C1-09, C1-10, C2-11 |
| Q-03 | Does the loop endpoint read "learner posture" or "schedule posture"? Is the attached object an "identity" or a "verdict pair"? | The rest of the report uses "schedule posture" and "verdict pair". | C1-20 |
| Q-04 | What constraint prevented the real-learner longitudinal study promised in Phase I? | Chapter 1 asserts a reason ("a single semester cannot supply") that the report does not support. | C1-23 |
| Q-05 | Is the 0.889 baseline the running-proportion baseline? | The baseline is unnamed in Ch02 and Ch04. | C2-01, C2-09 |
| Q-06 | Why keep BKT at parity with the baseline? Is the criterion simplicity, interpretability, per-skill updating, or a cross-reference to Section 4.2.3? | The chapter reports that hybrids outperform BKT, then keeps BKT without a stated rule. | C2-04, C2-30 |
| Q-07 | Is there an onboarding-derived BKT prior? Code and Ch06 say the prior is fixed at 0.15. | "Informative stance from onboarding data" has no described mechanism. | C2-07 |
| Q-08 | Does mastery group by skill tags or family labels? Code groups by `(materialId, skillTag)`. | "Family label" names the objective, written, or coding family, not the mastery signal. | C2-14 |
| Q-09 | Does the `gaming2026` study measure the same outcome as the replay? | The study is about help-seeking; the replay is about verdict-to-replan conversion. | C2-21 |
| Q-10 | What are the Phase-I knowledge-tracing sources referred to as a "trio"? Is the count correct? | Phase I cites Chen, Zanellati, Zambrano, and Mai. | C2-24 |
| Q-11 | Should Chen and `islam2024` stay in the summary table? | Chen is prior structure, not knowledge tracing; `islam2024` is prediction and scheduling, not grading. | C2-27 to C2-30 |
| Q-12 | Are `P_correct` and `P_obs` the same posterior in Equation `eq:bkt-update`? | The equation uses two labels for what appears to be one quantity. | C2-31 |
| Q-13 | Is Jev-1.13 the authoritative written grader or an advisory shadow? | Code, `.env.example`, and Ch05 place Jev on the advisory and loop-verdict paths, not the authoritative written grade. | C3-01, C3-03, X-03 |
| Q-14 | Is the single-arm CUSUM shipped or unshipped? | Phase I and Ch04 say shipped; Ch06 and Ch07 say unshipped. | C3-04, X-02 |
| Q-15 | Does the parity harness use exact equality or a tolerance? | Ch05 says tight tolerance; the roadmap test uses 1e-6. | C3-06 |
| Q-16 | Are the 30 judged groundedness rows the gold set? | Ch06 separates groundedness from gold support. | C3-07 |
| Q-17 | Is 0.8667 a threshold or the measured value? | A floor set at the measured value has no margin. | C3-08 |
| Q-18 | What is the measured project-machine RAM? What images are in the 2.3 GB aggregate? Should build cache count toward 60 GB? | The hardware table mixes minimums and project-machine facts and the aggregates are not traceable. | C3-10, C3-11, C3-18, C3-19 |
| Q-19 | Is the difficulty recommendation advisory or binding? | Ch06 says the chip is uncalibrated-advisory. | C3-15 |
| Q-20 | Is the retrieval floor a minimum with headroom or a restatement of the measured arm? | The floor equals the measured values. | C3-16 |

### Answers recorded 2026-10-23

| ID | Answer or default | Basis |
|---|---|---|
| Q-01 | No Phase-I result supports the "only after enough sessions" claim. The selected enriched-shrinkage calibrator beats moving average on prospective error in every band, including short history (0.049 against 0.094). Apply C1-03 and C2-06. | Phase I `06-results.tex:13-20`, Table `tab:res-cal-ctx`. |
| Q-02 | Both sources support narrower claims than Chapter 1 makes. Apply the narrowed wording that matches Chapter 2, and leave full-text verification of the external papers to the author. | Ch02 `:45`, `:38`; audit F8, F9. |
| Q-03 | The endpoint reads the code-computed `schedule posture`, and the carried object is the `verdict pair` (`verdictId` plus `decidedAt`). Apply C1-20. | `services/intelligence/app/routers/loop.py:137-198`; `apps/app/src/assessments/types.ts:130-144`; `apps/app/src/roadmap/feedback/useLoopDecision.ts:41-49`. |
| Q-04 | State the Phase-I plan and its deferral; do not invent a cause. Apply C1-23. | Phase I `01-introduction.tex:27`, `06-results.tex:135`. |
| Q-05 | The 0.889 baseline is the running-proportion baseline. Apply C2-01. | `services/intelligence/scripts/eval_harness.py:333`; Ch06 `:57-59`. |
| Q-06 | The tie went to the simpler, per-skill updater because the loop needs an estimate the learner can inspect. Apply C2-04 and X-06. | Ch04 `:21`; Ch06 `:57`. |
| Q-07 | The BKT prior is fixed at 0.15, with no onboarding path. Apply C2-07. | `packages/py-progress/src/py_progress/mastery.py:39-42`; Ch06 `:104`. |
| Q-08 | Mastery groups by `(materialId, skillTag)`, and generation emits `skillTags`. Apply C2-14. | `services/intelligence/app/routers/mastery.py:29-45`. |
| Q-09 | The gaming study and the replay measure different outcomes. Apply C2-21. | Ch02 `:51`; Ch06 `:82`. |
| Q-10 | Phase I cites four learner-modelling sources (Chen, Zanellati, Zambrano, Mai), not a trio. Apply C2-24. | Phase I `02-literature-survey.tex:5,30`. |
| Q-11 | Remove Chen from the knowledge-tracing row and `islam2024` from the grading row; add the implementation-only table note. Apply C2-27 to C2-30. | Ch02 `:7`, `:38`; audit F-11. |
| Q-12 | Open. Equation notation needs the author; do not change the mathematics. | Plan guardrail 8. |
| Q-13 | Jev is the advisory shadow and loop-verdict judge, not the authoritative written grader. The written arm uses `deepseek/deepseek-v4-flash-0731`. Apply C3-01, C3-03, X-03. | `services/intelligence/app/grading/worker.py:65,382`; `services/intelligence/.env.example:53-57`; Ch05 `:27-29`. |
| Q-14 | The single-arm CUSUM ships and prompts recalibration; only the split-conformal correction is unshipped. Keep FR-4 and apply X-02. | Phase I `06-results.tex:60`; Ch04 `:47`; `packages/py-progress/src/py_progress/cusum.py`. |
| Q-15 | The parity harness uses `math.isclose` with a 1e-6 tolerance for floats, not exact equality. Apply C3-06. | `packages/py-roadmap-engine/tests/test_fixtures.py:15,63`; `packages/py-progress/tests/test_fixtures.py:30,308`. |
| Q-16 | The 30 judged groundedness rows are a judged answer sample, not the gold set. Apply C3-07. | Ch06 `:34`. |
| Q-17 | Default the NFR-7 bar to the measured 0.8667 on the 30-question judged sample; headroom remains an author choice. Apply C3-08. | Ch06 `:34`; plan C3-08. |
| Q-18 | Measured project-machine RAM is 19~GB. Images are 49.5~GB sidecar, 1.42~GB Piston, and about 1.7~GB product images; build cache and volumes take the total to about 74~GB. Apply C3-10, C3-11, C3-18, C3-19. | `free -g`; `docker image ls`; rule 54. |
| Q-19 | The difficulty recommendation is advisory and uncalibrated. Apply C3-15. | Ch06 `:57`. |
| Q-20 | Default to "is set from the `hybrid_rerank` arm"; headroom remains an author choice. Apply C3-16. | Ch06 `:21`; `research/doc/2026-10-22-reranked-754.md`. |

Still open: Q-12 (equation notation) and X-05 (bibliography author metadata).
Q-02 external full-text verification and the Q-17/Q-20 headroom choices stay with the author.

## 6. Verification protocol

1. Run `python3 .work/active/phase2-prose-review/ste_check.py college/mydeliverables/Phase-2-report/phase2-report/chapters/01-introduction.tex` after each Chapter 1 batch.
2. Run the same command on `02-literature-survey.tex` and `03-requirements.tex`.
3. Target: Ch01 and Ch02 reach zero fail-tier hits or every remaining hit is documented with a reason.
4. Ch03 must stay at STE PASS and Humanizer PASS.
5. Humanizer must stay PASS on all three chapters.
6. Run `rg -n "Section~4\\.3|Sections~4\\.3" chapters/01-introduction.tex chapters/03-requirements.tex chapters/04-methodology.tex chapters/06-results.tex` and confirm no stale gate pointer remains.
7. Run `rg -n "learner posture|identity attached|family label|informative stance|Jev-1.13 applies|exact match|every metric|gold set"` on the three chapters and confirm each hit is either removed or intentionally retained.
8. Run `rg -n "analyses|realised|organisation|behaviour"` on the three chapters and fix remaining British spellings.
9. Run `rg -o "\\\\cite\\{[^}]+\\}"` on the three chapters and compare every key with `main.tex`.
10. Run `rg -n "\\\\ref\\{|\\\\label\\{"` and confirm every reference still resolves.
11. Ask the build task to run `latexmk` from `college/mydeliverables/Phase-2-report/phase2-report/`.
12. Inspect the compiled PDF for overfull boxes, split tables, caption alignment, and page breaks.
13. Run `git diff -- chapters/01-introduction.tex chapters/02-literature-survey.tex chapters/03-requirements.tex` and check that no fact, number, citation, equation, or requirement ID was dropped.
14. Record the resolved and unresolved audit IDs in the three audit reports.
15. Update `state.md`, `SCRATCHPAD.md`, and the `phase2-prose-review` row in `.work/STATUS.md`.

## 7. Definition of done

The P0 and P1 rows are applied or explicitly deferred with an author answer.
The P2 rows are applied or waived with a stated reason.
The P3 rows are optional polish.
The three chapters preserve every technical claim, number, citation, equation, and requirement ID.
No new claim is stronger than its evidence.
No new number is invented.
No stale Section 4.3 pointer remains.
No unexplained British spelling remains.
The lint result is no worse than the baseline, and Chapter 3 stays PASS/PASS.
The build task confirms a green build and the visual check passes.
The audit reports mark each finding as resolved, partially resolved, or unresolved.

## 8. Guardrails

Do not claim that any passage was or was not written by AI.
Do not use a detector score, a probability, or a "humanizer" rewrite.
Do not change equations or mathematical notation without the author.
Do not edit the bibliography under the G1 verbatim rule without explicit permission.
Do not edit `main.pdf`, `active/phase2-report/*`, or research evidence files from this task.
Do not rewrite a whole chapter to fix a local claim.
Do not drop a fact to satisfy a sentence-length cap.
Do not rename a stable project term in one chapter without grepping all chapters.
Do not stage or commit files unless the user asks.
Parallel sessions share this checkout, so run `git status --short` before every edit batch.

## 9. Audit traceability

| Audit report | Findings carried into this plan | Plan batches |
|---|---|---|
| `ai-writing-audit-ch01.md` | F1-F21 and S1-S12 | Batch 1, plus X-01 and X-02 |
| `ai-writing-audit-ch02.md` | F-01 to F-17 and S1-S12 | Batch 2, plus X-01 and X-05 |
| `ai-writing-audit-ch03.md` | F1-F14 and S1-S13 | Batch 3, plus X-02 and X-03 |

The audit reports remain the evidence record.
This plan is the execution record.
If a proposed replacement in this plan conflicts with the audit's recommended action, the audit's evidence and the author's answer win.

## 10. Next action

The plan is applied; see Section 11 and `state.md`.
Next: the `phase2-report` task runs `latexmk` and inspects the PDF.
The author still owns Q-12 (equation notation), X-05 (bibliography authors), the Q-02 external full-text check, and the Q-17/Q-20 headroom choices.

## 11. Execution record 2026-10-23

- Batch 0 passed: the three chapters were last modified before the audits, the baseline lint matched Section 2, and every citation key resolved against `main.tex`.
- The author queue is answered in Section 5 from live code, Phase-I prose, and current evidence. Q-12 (equation notation) and X-05 (bibliography author metadata) remain open.
- Batches 1 to 3 applied every row except C2-31, which stays blocked by Q-12. Q-02 claims were narrowed to the wording Chapter 2 already supports; external full-text verification remains with the author.
- Batch 4 applied X-01, X-02, X-03, X-04, and X-06. X-05 remains open, and X-07 was verified by grep.
- Final lint: Ch01 STE PASS and Humanizer PASS; Ch02 STE PASS and Humanizer PASS; Ch03 STE PASS and Humanizer PASS.
- Cross-chapter checks: no stale gate pointer to Section 4.3 remains, no banned term survives on the three chapters, all `\cite` keys resolve, all `\ref` targets resolve, and every chapter has balanced braces and environments.
- Ch07 now passes both linters. Ch04, Ch05, and Ch06 keep pre-existing STE debt outside this plan's three-chapter scope (7, 14, and 14 fail-tier hits respectively); none of the residual hits sits on a line this plan changed.
- Build and PDF inspection stay with the `phase2-report` task. This task did not run `latexmk` and did not touch `main.pdf`.
