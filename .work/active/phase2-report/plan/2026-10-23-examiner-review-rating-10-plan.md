# Examiner Review and Rating-10 Plan - Phase 2 Report

_Task: `phase2-report` - Status: planned, not applied - Date: 2026-10-23_

_Scope: `college/mydeliverables/Phase-2-report/phase2-report/` (47-page PDF plus `main.tex`, eight chapter files, and screenshots)._

_Review artifact: `/tmp/phase2-review/main.pdf`, rebuilt from the 09:27 sources on 2026-10-23. The checked-in `main.pdf` is stale (05:27)._

_Companion plan: `active/phase2-prose-review/plan/2026-10-23-ai-writing-pattern-fix-plan-ch04-ch07.md` for chapter-level prose and citation rows._

## 1. Purpose and how to use this plan

This plan records the 2026-10-23 examiner review and turns it into an execution plan.
The review rating is **6.0 / 10**.
The plan is ordered by dependency, not by chapter number.
Artifact truth comes first, then submission compliance, then citation integrity, then evidence integrity, then literature and design depth, then prose and layout.

Do not start with prose polish.
The P0 rows change what the report claims and what the submission package contains.
The companion prose plan already owns many line-level chapter edits.
Apply its P0 rows before the Batch 6 prose rows here and do not duplicate them.
This plan is the master index; the companion plan is the detailed edit list for chapter prose.

## 2. Artifact state

The checked-in `main.pdf` is from 05:27 and the chapter sources are from 09:27.
The two differ in content.
The PDF still says "genuine learning" in the abstract while the source says "graded evidence".
The PDF lacks the latest Chapter 1 citation wording and Chapter 6 discussion edits.

The fresh build is 47 pages, Letter, with 0 errors, 0 undefined references, 3 overfull boxes, and 76 underfull boxes.
The overfull boxes are Chapter 1 lines 21-22 (1.9 pt), Chapter 2 line 26 (the Section 2.2 heading, 19.1 pt), and Chapter 7 lines 7-8 (7.9 pt).
The project build gate requires 0 overfull boxes.

The 47 pages clear the 40-page floor after excluding the cover, certificate, and declaration.
The substantive body is about 10,000 words across Chapters 1 to 7.
The two sample reports are 13,205 and 20,256 words with 32 and 62 references.
This report has 11 references.

## 3. Rating and scorecard

Overall: **6.0 / 10** with high confidence.
A fair range is 5.5 to 6.5 depending on how much the committee weights the working system against the research contribution.

| Dimension | Score /10 | Judgment |
|---|---:|---|
| Problem and scope | 8 | Clear, specific, and well-motivated; the scope is explicit |
| Literature and citations | 4 | 11 references against 32 and 62 in the samples; citation misrepresentations; foundational methods uncited |
| Methodology and design | 6 | Sensible architecture, but no per-subsystem design, data model, API contracts, prompts, or statistical plan |
| Implementation depth | 6 | A real working system, but reproducibility is asserted rather than delivered |
| Results and evidence | 5 | Honest caveats coexist with pooled numbers, missing denominators, pseudo-replication, and an undisclosed gate failure |
| Analysis and validity | 4 | No confidence intervals, significance tests, error analysis, or threats-to-validity section |
| Writing and structure | 6 | Clear and organized, but repetitive, staccato, and sometimes reads like an engineering changelog |
| Figures, tables, and layout | 5 | Useful evidence, but five near-identical flow figures, tiny screenshots, colored link boxes, and an overfull heading |
| Submission compliance | 5 | Page floor met; signatures missing, PDF stale, declaration incomplete, running header absent |

## 4. Findings ledger

Priority meanings:
**P0** is a submission blocker or a claim that the evidence cannot support.
**P1** is required for a distinction-level report.
**P2** is polish or optional strengthening.

| ID | Area | Finding and evidence | Priority | Batch |
|---|---|---|---|---|
| R-01 | Artifact | The checked-in PDF is stale against the sources; the fresh build is 47 pages with 3 overfull boxes. | P0 | 0, 1 |
| R-02 | Compliance | The certificate lacks the mentor's scanned signature and the declaration lacks the candidate's signature, name, USN, date, and originality statement; guideline lines 299-302 require the signatures. | P0 | 1 |
| R-03 | Citations | [10] says engagement is associated with course performance, but Uzun et al. report that engagement did not significantly affect performance; [3] has the wrong title and target, the actual paper is "Predict Students' Performance and Optimize Preparatory Leave" (ICCIT 2024, pp. 728-733, DOI 10.1109/iccit64611.2024.11021881); [1] is used for pace calibration but models adaptive teaching; [4] overstates "consistently outperform"; [2] and [9] need verification; [6]-[9] lack authors; [7] is an unlabeled preprint. | P0 | 2 |
| R-04 | Groundedness | The 0.8667 rate is 26/30 judgments over only six distinct question keys (S:1 to S:6) repeated across tiers; the generation model and the groundedness judge are both `deepseek/deepseek-v4-flash-0731`, and self-judging is not disclosed. | P0 | 3 |
| R-05 | Generation arm | The headline n=180 is the six-tier S-layer sweep, not the delivered reasoning-off arm; the S:off arm is 29/30 schema, 0.724 gold support, p95 10.5 s, and $0.00561. The harness report says FAIL because `difficultyMeanAbsBandError` is unmeasured, and Chapter 6 does not state the gate failed. | P0 | 3 |
| R-06 | Coding rate | The 0.5349 is 23/43 judged attempts; the full set is 62 attempts with 20 `code_not_derivable` and 19 `failed_other`, so the full 23/62 rate is 0.371, below the 0.5 gate. | P0 | 3 |
| R-07 | Loop evidence | The 4/4 conversion is a synthetic replay whose scripts answer about 90% wrong in every archetype; all four rows show the same confidence and sufficiency, and week 5 adherence 0.000 is unobserved, not a measured zero. No fixed-plan control exists. | P0 | 3 |
| R-08 | Tables and timing | Table 6.1 omits the plain RPC arm quoted in the text (0.60/0.73/0.87/0.703); the 88 s wall is created-to-ready, not upload-to-ready (ready is at 101 s). | P0 | 3 |
| R-09 | Definitions | AC1-AC4, S-layer, ECE, ACCA, DDIA, OULAD, posture, sufficiency, verdict pair, dip-window, met-class, top-up, and gate fix are used without definitions. | P0 | 1 |
| R-10 | Framing | The abstract and conclusion say the loop is "validated" and the 4/4 conversion is a "comparative gain"; the evidence supports integration validation on synthetic schedule archetypes, not learning gain. | P0 | 3 |
| R-11 | Build and layout | The fresh build has three overfull boxes; `hyperref` draws colored boxes around every citation and cross-reference; Table 5.1 says "last seven" but has six Phase-II rows; "Docker via Colima" is wrong for the WSL2/Docker Desktop host; Figure 5.6 shows a `CITATION_UNVERIFIED` error and a failed score. | P0 | 1, 6 |
| R-12 | Literature | The survey has 11 references and no foundational BKT, CUSUM, Gaussian-process, or conformal citations; it ignores intelligent tutoring systems, adaptive practice, spaced repetition, LLM-as-judge validity, and psychometrics; Section 2.5 admits no systematic search. | P1 | 4 |
| R-13 | Novelty | The "verified-learning closed loop" is the defining architecture of intelligent tutoring systems; the report defines novelty against a strawman and does not name the closest prior work. | P1 | 4 |
| R-14 | Design depth | Chapter 4 is about five pages with two diagrams; it lacks per-subsystem sequence diagrams or state machines, a data model and event schema, an API contract table, a hyperparameter table, and prompts or rubrics. | P1 | 5 |
| R-15 | Statistical rigor | Chapter 6 has no confidence intervals, paired tests, effect sizes, or multiple-comparison correction; NFR-7 and NFR-9 are set to observed point estimates; the loop gate moved from 0.9 to 0.7 after a single 0.79 sample; the Jev test met-class has 2 pairs. | P1 | 3 |
| R-16 | Analysis gaps | There is no per-family generation quality, error taxonomy, qualitative example set, reliability diagram, latency or cost table, or full-denominator table. | P1 | 3 |
| R-17 | Validity, ethics, security, usability | There is no threats-to-validity section, no privacy analysis of learner material sent to OpenRouter, no Piston sandbox security analysis, no model-drift discussion, and no usability evidence. | P1 | 3, 5 |
| R-18 | Reproducibility | The report gives no exact commands, prompts, judge rubric, seeds, fold hashes, chunking and top-k parameters, or evaluation timeout; the probe used 180 s while Table 5.1 says 30 s. | P1 | 5 |
| R-19 | Requirements structure | Chapter 3 lacks the sample's Project Scope, Product Perspective, Assumptions, Dependencies and Constraints, and Operating Environment sections; NFR-7 and NFR-9 are post-hoc. | P1 | 5 |
| R-20 | Prose | "The project" appears 32 times and "honest" 10 times; results and conclusion read like a changelog; spelling and precision are mixed; the 6.3 calibration passage is cryptic. | P1 | 6 |
| R-21 | Figures and tables | Figures 5.1, 5.3, 5.5, 5.7, and 5.9 are five near-identical box chains; screenshots are 1280x900 scaled to about 388 pt and are too small for print; Figure 4.2 is a sparse three-box diagram; Tables 2.1, 5.1, and A.3 have awkward hyphenation and word rivers. | P1 | 6 |
| R-22 | Front matter and format | Body pages lack the running header and footer rule used by the sample; the bibliography is not in the Table of Contents; there is no abbreviations page; the appendix title says "and Figures" but contains only tables; the declaration is incomplete. | P2 | 1, 6 |
| R-23 | Title | "Adaptive Study Planning for Self-Directed Learners" is broad; consider "Assessment-Verified Adaptive Study Planning for Self-Directed Learners" if the closed loop is the contribution. | P2 | 6 |
| R-24 | Efficacy ceiling | If a real-learner study remains out of scope, the report should state that efficacy on learning gain is deferred and that the contribution is system plus component evaluation. | P0 | 3 |

## 5. Execution batches

### Batch 0 - Pre-flight and artifact truth

1. Run `git status --short` and preserve unrelated parallel-session changes.
2. Copy the report directory to a fresh `/tmp/phase2-review-YYYYMMDD` directory.
3. Build with TinyTeX on PATH and `latexmk -pdf -interaction=nonstopmode -halt-on-error -g main.tex` from the `/tmp` directory.
4. Record page count, errors, undefined references, overfull boxes, and underfull boxes.
5. Extract the fresh text and diff it against the checked-in PDF text; list every content difference.
6. Confirm the source, not the stale PDF, is the review baseline.

Acceptance: the build reproduces 47 pages, 0 errors, 0 undefined references, and 3 overfull boxes, and the stale-PDF differences are recorded.

### Batch 1 - Submission compliance and obvious defects

1. Add the mentor's scanned signature to the certificate.
2. Add the candidate's signature, name, USN, date, and originality statement to the declaration.
3. Set `\usepackage[hidelinks]{hyperref}` or a single muted `colorlinks` scheme.
4. Shorten the Section 2.2 heading to "Automatic Item Generation and KC Tagging" and define KC in the first sentence.
5. Fix the Chapter 1 and Chapter 7 overfull lines.
6. Fix Table 5.1: the table has 6 Phase-II rows, so change "last seven" to "last six" or add the missing grading row; replace "Docker via Colima" with "Docker Desktop on WSL2" or "Docker Compose". The companion plan's C5-01 says the opposite; verify the row count before applying it.
7. Add a one-page "Definitions and Abbreviations" section covering the terms in R-09.
8. Rebuild and replace `main.pdf`; verify the fresh PDF matches the sources.

Acceptance: 0 overfull boxes, no colored link boxes, both signatures present, the declaration is complete, and every load-bearing term is defined.

### Batch 2 - Citation integrity and bibliography

1. Fix [10] to say that high-SRL students engaged more but engagement did not significantly improve course performance.
2. Replace [3] with the correct title, venue, pages, and DOI, and describe it as preparatory-leave scheduling, not a general study schedule.
3. Replace or rephrase the [1] pace-calibration claim; keep [1] as adaptive-teaching background in Section 2.1.
4. Soften [4] from "consistently outperform" to the review's actual conclusion.
5. Verify [2] and [9] against their sources and correct the claims.
6. Add authors to [6], [7], [8], and [9]; add volume, issue, pages, and venue to every entry; label [7] as an unrefereed arXiv preprint.
7. Add a citation-claim map in the appendix or plan: claim, source, page or quote, and status.
8. Apply the companion prose plan's Chapter 7 rows for `islam2024` and `gaming2026`.

Acceptance: every citation has complete metadata, every attached claim matches the source, and no unsupported comparative claim remains.

### Batch 3 - Evidence integrity and statistical rigor

1. Headline the delivered S:off arm (n=30) and move the six-tier sweep to an ablation table.
2. Report groundedness over the six distinct questions with a cluster-robust interval, disclose self-judging, and either rerun 30 distinct questions with an independent judge or add a human audit.
3. Report the harness verdict as FAIL and name the breached `difficultyMeanAbsBandError` gate; either lower or remove the gate before the run or label the leg "not passed."
4. Report the full coding denominator (62 attempts; 23 derivable, 20 refusals, 19 failed_other) and the full telemetry denominator (361 requests; 281 ok, 37 partial, 35 malformed, 8 provider errors).
5. Mark week 5 "not observed"; remove it from aggregates; rerun after the extension week or drop the rebound metric.
6. Make Table 6.4 per-user or collapse it to one row with a note; add the plain RPC row to Table 6.1; split the timing into created-to-ready (88 s) and upload-to-ready (101 s).
7. Add paired bootstrap or McNemar tests for retrieval, Wilson or Clopper-Pearson intervals for rates, bootstrap intervals for AUC and ECE, a reliability diagram, and a multiplicity plan.
8. Set NFR-7 and NFR-9 prospectively with headroom, or label them "observed targets."
9. Reframe "validated" as "integration validation on synthetic schedule archetypes"; add a fixed-plan control or state that no efficacy control exists.
10. Move the no-learning-gain caveat into the abstract and add a Threats to Validity subsection.
11. Add an ethics and security paragraph covering learner data sent to OpenRouter, retention, Piston isolation, hidden-test leakage, prompt injection, and the absence of a usability study.

Acceptance: every headline number has a denominator, an uncertainty interval, and an evidence status; no "validated" claim lacks a control; the abstract and conclusion match the evidence.

### Batch 4 - Literature and novelty

1. Run a documented search across Scopus, IEEE, ACM, and Google Scholar; record queries, dates, inclusion and exclusion rules, and screening counts.
2. Expand the survey to 35-50 references.
3. Add Corbett and Anderson 1995 for BKT, Page 1954 for CUSUM, Rasmussen and Williams 2006 for Gaussian processes, and Vovk or Angelopoulos for conformal prediction.
4. Add intelligent tutoring systems, adaptive practice, and spaced repetition: VanLehn 2011, Koedinger and Aleven, Settles and Meeder 2016, and Cepeda et al. 2006.
5. Add LLM-as-judge validity and psychometrics or IRT.
6. Rewrite every Chapter 2 entry in the four-beat shape with the source's own metric and limitation; move project metrics to Chapter 6.
7. Rewrite Section 2.5 as a search protocol and rewrite Sections 2.6 and 7.1 around the specific combination, not a field-wide gap.
8. Name the closest ITS or adaptive-practice work and narrow the novelty claim.

Acceptance: 35-50 references; every literature entry has a paper-side metric and a limitation; every claim has a matching citation; the novelty claim names the closest prior work.

### Batch 5 - Design and reproducibility depth

1. Add per-subsystem design for generation, the three grading arms, the BKT update, the guide ladder and reveal gate, feedback copy, and the verdict router.
2. Add a sequence diagram or state machine for each subsystem.
3. Add the event and data model: Phase II event types, payloads, Dexie schema, sync boundary, and RLS.
4. Add an API table with endpoint, method, auth, request and response, and errors.
5. Add a hyperparameter table with chunk size and overlap, embedding dimension, top-k, temperature, max tokens, timeouts, retries, concurrency, and repair policy.
6. Add prompts and the judge rubric in an appendix, plus exact reproduction commands for both legs.
7. Add a testing table with unit, integration, and E2E counts, coverage, and CI status.
8. Add a Piston security paragraph covering isolation, resource limits, network egress, and hidden-test handling.
9. Add the missing Chapter 3 sections: Project Scope, Product Perspective, Assumptions, Dependencies and Constraints, and Operating Environment.
10. Add a usability limitation and, if feasible, an expert heuristic review or a 3-5 learner pilot.

Acceptance: a reader can redraw the system and rerun both legs from the report alone; every FR maps to a design element and a test or result.

### Batch 6 - Prose, figures, and layout

1. Apply the companion prose plan's remaining P0, P1, and P2 rows.
2. Rewrite Sections 6.2-6.4 and 7.1 in past-tense research prose; delete CI and test tallies and changelog phrases.
3. Cut repetition; reduce "the project," "honest," and the "reads, sits, lands" register; vary sentence openings.
4. Standardize spelling (`realised`/`realized`, `behaviour`/`behavior`, `summarise`/`summarize`) and number precision (`0.867`/`0.8667`, `0.004`/`0.0044`).
5. Merge the five flow figures into one final flow figure.
6. Crop and enlarge the screenshots; replace Figure 5.6 with a clean graded attempt.
7. Add a proper architecture diagram with protocols, data stores, and the judge placement.
8. Fix table typography with `tabularx` or ragged-right columns and short labels.
9. Add a 6.6 Summary subsection and a 7.3 Limitations subsection.
10. Add the running header and footer rule, the Table of Contents bibliography entry, and optional keywords.
11. Fix the appendix title to "Supplementary Tables" or add the missing figures.
12. Update the title if the author chooses R-23.

Acceptance: the prose reads as a dissertation, not a changelog; no undefined terms remain; figures are legible at print size; no overfull boxes remain; the layout is clean.

### Batch 7 - Verification and re-review

1. Rebuild from source in `/tmp` and run the full checklist in Section 7.
2. Have a fresh examiner review the new PDF, not the old one.
3. Re-rate against the same rubric and record the new score in `state.md`.
4. Update the STATUS row and this plan's change log.

Acceptance: all P0 and P1 rows are closed; the report's claims match its evidence; a fresh reviewer can verify the headline results without repository access.

## 6. Author decisions needed

| ID | Decision | Recommendation | Blocks |
|---|---|---|---|
| D-01 | Provide the mentor scan and candidate signature. | Do this first; it is a hard submission blocker. | Batch 1 |
| D-02 | Add a real-learner study or reframe the contribution. | Reframe as system plus component evaluation and defer efficacy; add a small pilot only if a term-length study is feasible. | Batch 3, R-24 |
| D-03 | Rerun groundedness with 30 distinct questions and an independent judge or human audit. | Do it; the current 26/30 is six questions repeated. If budget forbids, report the six-question cluster honestly. | Batch 3, R-04 |
| D-04 | Expand the literature to 35-50 references with a documented search. | Do it; this is the largest single rating lever. | Batch 4, R-12 |
| D-05 | Add a usability pilot or expert heuristic review. | At minimum add an expert heuristic review; 3-5 learners if feasible. | Batch 5, R-17 |
| D-06 | Change the title. | Keep the current title if both phases remain in scope; otherwise use the assessment-verified title. | Batch 6, R-23 |
| D-07 | Set NFR-7 and NFR-9 with headroom. | Set them below the observed values, or label them "observed targets." | Batch 3, R-15 |
| D-08 | Include the Jev calibration table. | Include train and test agreement, the selected cutoff and margin, and the two-pair met-class caveat. | Batch 3, R-15 |
| D-09 | Add the 6.6 Summary and 7.3 Limitations. | Yes; both improve structure and the page layout. | Batch 6 |
| D-10 | Decide whether the synthetic replay is sufficient without a fixed-plan control. | If no control is added, scope the claim to integration validation and say so in the abstract. | Batch 3, R-10 |

## 7. Verification protocol

Run the copy commands from the repository root.
Run the build commands in the fresh `/tmp` copy, never in the repository directory.

```bash
TEXBIN="$(ls -d "$HOME"/.TinyTeX/bin/* 2>/dev/null | head -1)"
export PATH="$TEXBIN:$PATH"
rm -rf /tmp/phase2-final
mkdir -p /tmp/phase2-final
cp -a "college/mydeliverables/Phase-2-report/phase2-report/." /tmp/phase2-final/
cd /tmp/phase2-final
latexmk -pdf -interaction=nonstopmode -halt-on-error -g main.tex
```

Run each gate separately; a zero-match `grep` exits 1 and would kill a chained command.

```bash
grep -c '^! ' main.log
grep -ci 'undefined' main.log
grep -ci 'Overfull' main.log
pdfinfo main.pdf | grep Pages
```

Required results:
- 0 errors.
- 0 undefined references.
- 0 overfull boxes.
- Page count does not fall below 47 unless content is intentionally removed.
- The PDF text matches the source text.
- Both signatures are visible on pages 2 and 3.
- No colored hyperref boxes.
- Every table has a denominator and every headline claim matches its table.
- Every citation has authors, venue, year, and DOI or URL.
- [7] is labeled as an unrefereed preprint.
- The abstract states the evidence status and does not claim learning gain.

Then run a fresh examiner review with the same rubric and record the new rating.
Do not reuse the 2026-10-23 review as the final verdict.

## 8. Rating trajectory

| Milestone | Realistic rating |
|---|---:|
| Current fresh source | 6.0 |
| After Batch 1 (compliance and obvious defects) | 6.5 |
| After Batch 3 (evidence integrity and statistical rigor) | 7.5 |
| After Batch 4 (literature and novelty) | 8.5 |
| After Batch 5 (design and reproducibility depth) | 9.0 |
| After Batch 6 (prose, figures, layout) | 9.5 |
| After Batch 7 with strengthened evidence | 10.0 |
| After Batch 7 if the real-learner study remains out of scope | 8.5-9.0, with the efficacy claim explicitly deferred |

## 9. Ownership and cross-references

`phase2-report` owns the build, the PDF, the evidence reconciliation, and the final submission.
`phase2-prose-review` owns the detailed chapter prose and citation edits in its plan.
Apply that plan's P0 rows before Batch 6 and do not duplicate them here.
Do not edit `college/mydeliverables/Phase-2-report/phase1-report/`.
Do not invent a number, citation, dataset edition, per-user sufficiency value, or console-error log.
Do not run `latexmk` outside `/tmp`.
Do not change the pinned seven-chapter split or the front-matter style without author approval.

Evidence references:
- `research/doc/generation-quality-harness/report.md` for the gate verdict and objective metrics.
- `research/doc/generation-quality-harness/live.json` for the six distinct groundedness keys.
- `research/doc/generation-quality-harness/summary.json` for the S-layer, coding, and telemetry denominators.
- `.work/active/jev-integration/plan/evidence/jev_calibration_report_v1.json` for the Jev train and test splits.
- `research/doc/2026-10-22-synth-extract-emission.md` for the per-archetype grade scripts and mastery rows.
- `research/doc/2026-10-22-dip-window-replay.md` for the dip-window replay.
- `college/mydeliverables/Phase-2-report/MTech project report submission guideline.html` lines 285-302 for the page floor and signatures.

## 10. Citation-claim map (Batch 2, verified 2026-10-23)

Each row ties a report claim to its source record. Publisher records checked: Wiley (chen, alhazbi), IEEE Xplore (islam, llmgrade), ACM DL (kctag, gaming per companion Q-21), ScienceDirect (itemgen), Springer (uzun), IEEE TLT vol. 17 (zanellati via citing record).

| # | Report claim | Source record | Page, quote, or identifier | Status |
|---|---|---|---|---|
| 1 | Ch1: pace-model priors follow Chen | Chen et al., Cogn Sci 48(7):e13477, doi:10.1111/cogs.13477 | Hierarchical Bayesian pedagogy; two experiments, N=312 adults | Verified; claim reworded to prior-structure only |
| 2 | Ch1/Ch2: SRL measures lean on time-management traces; 25 studies | Alhazbi et al., JCAL 40(4):1658-1674, doi:10.1111/jcal.12982 | PRISMA, 25 articles 2015-2022; most indicators relate to time management | Verified; no claim change |
| 3 | Ch1/Ch2: predict-then-optimize for preparatory leave | Islam et al., Proc. 27th ICCIT, IEEE, pp. 728-733, doi:10.1109/iccit64611.2024.11021881 | IEEE Xplore: optimal preparatory-leave schedule in a two-stage predict-then-optimize framework | Verified; title, venue, pages, DOI fixed; 0.73 dropped as unverified |
| 4 | Ch2: hybrid-model taxonomy | Zanellati et al., IEEE TLT 17:1021-1036 | Taxonomy across knowledge-source and representation dimensions | Verified; `consistently outperform` removed |
| 5 | Ch2: per-subject item quality | Chan et al., Comput. Educ.: AI 8:100344, doi:10.1016/j.caeai.2024.100344 | Systematic study of conceptual understanding and QA-pair quality across STEM | Verified; authors added |
| 6 | Ch2: local generation plus deterministic QC | Shintani, arXiv:2603.08729 [cs.CY] | Local LLM, QC gates, 15-run case study | Verified; labeled unrefereed preprint |
| 7 | Ch2: KC tags from MCQs | Moore et al., Proc. L@S '24, doi:10.1145/3657604.3662030 | GPT-4 tags; 56% Chemistry and 35% e-learning match; evaluators prefer LLM tags | Verified; authors and venue added |
| 8 | Ch2: LLM short-answer grading in SE courses | Ta and Chai, Proc. EDUCON 2024, pp. 1-10, doi:10.1109/educon60312.2024.10578839 | Embedding plus completion LLM approaches on SE short answers | Verified; authors and venue added; `rubric` unattributed |
| 9 | Ch2: engagement versus performance | Uzun et al., IJETHE 22:17, doi:10.1186/s41239-025-00515-3 | Active engagement differs by SRL (U=136, p=0.034); no performance effect (U=135, p=0.748) | Verified; claim corrected |
| 10 | Ch2/Ch7: help-seeking gaming only | Zhang et al., Proc. LAK, ACM, doi:10.1145/3785022.3785025 | Think-aloud protocols separate genuine attempts from answer-extraction | Per companion Q-21; citation kept for help-seeking only |
| 11 | Ch7 islam2024 and gaming2026 rows | Companion C7-03 and C7-04 | `predict-then-optimize idea from predicted grades`; self-report versus server-authoritative rationale | Already applied; verified present |

## 11. Change log

- 2026-10-23: Created from the examiner review of the fresh 47-page build; rating 6.0/10; P0 and P1 batches defined; author decisions D-01 to D-10 recorded.
- 2026-10-23: Batch 0 verified (fresh /tmp build 47pp, 0 errors, 0 undefined, 3 overfull, 76 underfull; stale-PDF diff recorded: abstract, Ch1/Ch6 wording, `last six` vs `last seven`). Batch 1 actionable items applied: `hidelinks`, Sec 2.2 heading shortened with KC defined in the first sentence, Ch1/Ch7 overfull lines reworded, `Docker via Colima` replaced with `Docker Desktop on WSL2 (Compose)`, Definitions and Abbreviations page added (R-09). Rebuild in /tmp: 48pp, 0 errors, 0 undefined, 0 overfull; `main.pdf` refreshed beside `main.tex`. Verified Table 5.1 has 7 Phase-II rows, so `last seven` stands and the companion C5-01 opposite is rejected. Blocked on D-01: mentor/candidate signatures and declaration originality statement still missing.
- 2026-10-23: Batch 2 applied: all 11 bibliography entries carry verified authors, venues, volumes, pages, DOIs ([7] labeled unrefereed preprint); [10], [3], [1], [4] claims corrected; unverified 0.73 dropped; citation-claim map added as Section 10; companion C7-03/C7-04 confirmed already present.
- 2026-10-23: Batch 3 applied: S:off arm headlined (verified 29/30, 21/29, p95 10.5 s, $0.00561), sweep demoted to ablation context; groundedness reframed over six question clusters with Wilson CI and self-judge disclosure (code-grounded: eval_golds.json judge model equals generation default); harness verdict stated as FAIL with breached gate named; coding full denominator 23/62 = 0.371 stated as not clearing the gate; telemetry 361 denominator added; week 5 marked not observed in Ch6/Ch7/appendix (n.o. cells); plain RPC row added to Table 6.1; Wilson CIs plus endpoint McNemar (p=0.546/0.131, descriptive) added; NFR-7/NFR-9 set with headroom; abstract carries the no-learning-gain caveat; new Section 6.6 Threats to Validity plus ethics/security paragraph; no-fixed-plan-control stated in Ch6/Ch7/abstract. Decisions: D-02 reframe (no learner study in scope), D-03 honest cluster (no rerun budget), D-07 headroom floors, D-10 integration-validation scope. Partial: no reliability diagram (no binned data in evidence); no AUC/ECE intervals (point estimates only). Rebuild: 50pp, 0/0/0; main.pdf refreshed.
- 2026-10-23: Batch 4 applied: Ch2 expanded 11 to 29 references with verified metadata (foundations Corbett/Page/Rasmussen/Vovk; ITS Bloom/Anderson/VanLehn/Koedinger; spacing Cepeda/Settles/Roediger/Dunlosky; judge Zheng/Kasneci; psychometrics Niculescu/Embretson; feedback Hattie/Shute; ICAP Chi; DKT Piech); ITS block plus assistance dilemma plus closest-prior narrowing added to 2.4; retrieval-practice rationale plus judge-validity block added to 2.3; calibration/IRT/spacing/estimation-heritage blocks added to 2.1; 2.5 rewritten as documented verification protocol (2026-10-23 sweep, ~20 queries, inclusion rules); 2.6 and 7.1 rewritten around the narrowed Cognitive-Tutor-line combination; summary table extended. Partial: 29 not 35-50 (needs author database screening per D-04); Scopus/IEEE full screening deferred. Rebuild: 53pp, 0/0/0; main.pdf refreshed.
- 2026-10-23: Batch 5 applied: Ch4 4.2 subsections carry interface contracts (inputs, outputs, failure terminals; BKT params; guide ladder state machine Fig 4.1; verdict router Fig 4.2); event/data table plus Dexie v7 plus user-scoped sync added to 4.5; Ch5 API table (8 routes, token auth, typed errors), hyperparameter table (chunk 400/30, dim 768, top-k 5/50, temp 0.3, timeout 30 s, 4096 tokens, 1 repair, K=5, BKT params, gates 0.5/0.7), testing table (976 backend, 65 app files, 33 e2e specs, no CI, no coverage), Piston paragraph; Ch3 3.5-3.7 Product Perspective, Assumptions/Dependencies/Constraints, Operating Environment; appendix A.4 prompts plus reproduction commands; 7.2 usability gate. Partial: no expert review or pilot (stated as future gate); coverage unmeasured. Rebuild: 57pp, 0/0/0; main.pdf refreshed.
- 2026-10-23: Batch 6 applied: all 8 files STE PASS + Humanizer PASS (split long sentences, cut semicolons, short-range hyphens, `-{}-` code flags); test tallies moved from Ch6/Ch7 to the Ch5 testing table; five flow figures merged into one final flow figure; architecture diagram gained protocol edge labels; Table 2.1 ragged-right; 6.7 Summary and 7.3 Limitations added (1.5 org updated); running header/footer rule, TOC bibliography entry, keywords, appendix title fixed; title kept per D-06. Partial: Figure 5.6 still shows the CITATION_UNVERIFIED error state (needs live re-capture); screenshots not cropped/enlarged.
- 2026-10-23: Batch 7 verification: clean-room /tmp rebuild 57pp, 0 errors, 0 undefined, 0 overfull; full STE+Humanizer PASS on all chapters; no em/en dashes; main.pdf refreshed beside main.tex. Fresh self-review (not independent) against the same rubric: problem 8, literature 7, methodology 8, implementation 8, results 8, analysis 7, writing 8, figures 7, compliance 7. Overall 7.5/10 (range 7.0-8.0). Rating-10 gaps remaining: D-01 signatures, Fig 5.6 re-capture, 29 to 35-50 refs with DB screening, reliability diagram, AUC/ECE intervals, independent judge rerun, real-learner study.
