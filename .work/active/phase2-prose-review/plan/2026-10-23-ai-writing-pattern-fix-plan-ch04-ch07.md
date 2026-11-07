# Fix Plan - AI Writing Pattern Audit, Chapters 4 to 7

_Task: phase2-prose-review - Status: planned, not applied - Date: 2026-10-23_

_Scope: `college/mydeliverables/Phase-2-report/phase2-report/chapters/04-methodology.tex`, `05-implementation.tex`, `06-results.tex`, and `07-conclusion.tex`._

_Audits: `plan/audits/ai-writing-audit-ch04.md`, `plan/audits/ai-writing-audit-ch05.md`, `plan/audits/ai-writing-audit-ch06.md`, and `plan/audits/ai-writing-audit-ch07.md`._

## 1. How to use this plan

This plan consolidates the four chapter audits into one ordered fix list.
It separates mechanical edits from author decisions.
It never treats a stylistic pattern as proof of AI authorship.
It does not rewrite the chapters wholesale.
Every edit must preserve the technical meaning and every cited number.
Every proposed replacement is a proposal, not an invented fact.
Rows marked with a Q number are blocked until the author answers the matching question in Section 5.

The previous plan for Chapters 1 to 3 is `plan/2026-10-23-ai-writing-pattern-fix-plan.md`.
That plan is already applied.
This plan starts from the current working-tree bytes after those fixes.
Do not re-apply the Chapter 1 to 3 rows here.

## 2. Baseline

The deterministic lint is the starting point.
The audits are the substantive review.

| Chapter | STE | Humanizer | Writing-review priority | Main risk |
|---|---|---|---|---|
| Ch04 Methodology | FAIL, 7 fail-tier hits | PASS, 0 fail-tier hits | 3 | Stale table label, mixed evaluation cuts, conversion and adherence conflated, self-referential framing |
| Ch05 Implementation | FAIL, 14 fail-tier hits | FAIL, 1 fail-tier hit | 2 | Table row count wrong, assessment called an attempt, figure caption claims a loop the drawing does not show, reproducibility overclaim, uniform 5.5 template |
| Ch06 Results | FAIL, 14 fail-tier hits | FAIL, 5 fail-tier hits | 3 | Stale 0.0 coding result, omitted anchor ECE, per-user sufficiency not in evidence, gate causation, rubric calibration in the loop section, discussion restatement |
| Ch07 Conclusion | PASS, 0 fail-tier hits | PASS, 0 fail-tier hits | 3 | Conclusion re-reports Ch6, three claim-evidence problems at line 7, vague appendix cross-reference |

The writing-review priority is the audit rubric, not an AI-likelihood score.
It is not additive.
The lint is supporting evidence only.
The audits do not offer an authorship verdict.

## 3. Consolidated fix batches

The batches run in dependency order.
Batch 0 is preparation.
Batch 1 fixes Chapter 4 truth and evidence labels.
Batch 2 fixes Chapter 5 implementation facts and framing.
Batch 3 fixes Chapter 6 results evidence and discussion.
Batch 4 fixes Chapter 7 conclusion claims and structure.
Batch 5 reconciles terminology and repeated phrases across chapters.
Batch 6 handles cross-document residuals exposed by the Chapter 7 audit.
Batch 7 is verification.
Batch 8 is the record update.

Do not run a Q-blocked row before its question is answered.
P0 rows are submission blockers.
P1 rows improve the scholarly argument or require a small rewrite.
P2 rows improve style and reduce redundancy.
P3 rows are optional polish.

### Batch 0 - Pre-flight

1. Run `git status --short` and confirm no parallel session has edited Chapters 4 to 7 since the audits.
2. Re-run `python3 .work/active/phase2-prose-review/ste_check.py` on each of the four chapters and save the output beside this plan.
3. Read the four audit reports once more before editing.
4. Confirm the bibliography keys and cross-reference labels still resolve against `main.tex` and the chapter files.
5. Do not touch `main.pdf`, `active/phase2-report/*`, or research evidence files from this task.
6. Do not run `latexmk` from this task; build verification belongs to `phase2-report`.

Acceptance: the baseline lint matches Section 2, and the checkout state for these four files is known.

### Batch 1 - Chapter 4 methodology truth and evidence

File: `chapters/04-methodology.tex`.

| ID | Line | Current text | Fix | Evidence or guard | Priority | Blocked by |
|---|---|---|---|---|---|---|
| C4-01 | `:41` | `advisory-only \texttt{feedback-v1} copy` | `feedback-v2` or `feedback-v2 with v1 fallback` | Body `:24` and `services/intelligence/app/generation/prompts.py` use `feedback-v2`; the client keeps v1 words only as fallback | P0 | Q-01 |
| C4-02 | `:96` | `Bookings, session logging, and the local-first store did not change.` | `The booking model and session logging did not change. The local store gained Phase II attempt and mastery tables.` | `apps/app/src/events/EventStoreProvider.tsx` versions 6 and 7 add `assessmentAttempts`, `assessmentContentCache`, and `masteryCache` | P0 | none |
| C4-03 | `:52` | `Retrieval recall at 3 is 0.733.` | `The harness's plain retrieval arm reads recall at 3 of 0.733; the selected \texttt{hybrid\_rerank} arm reads 0.90 on the 754 split.` | `research/doc/generation-quality-harness/report.md` reports 0.7333; Ch06 Table `tab:res-retrieval` reports 0.90 | P0 | none |
| C4-04 | `:52` | `The bkt-v1 AUC is 0.888 against 0.889 for the running-proportion baseline.` | `On the separate mastery bake-off, bkt-v1 reads 0.888 against 0.889; the live harness reads 0.7397 against 0.7368.` | Ch06 `:57`; harness report mastery table | P0 | none |
| C4-05 | `:50`, `:67` | `Both legs ran before selection` and `before the approach is selected` | `The offline leg informed per-stage selection; the longitudinal replay validated the assembled loop after the gate fix.` | Post-fix replay date 2026-10-19; Ch06 `:82` treats the replay as validation | P0 | Q-02 |
| C4-06 | `:71` | `the project scores conversion with next-week adherence` | `Conversion is scored by the exact verdict-replan join; next-week adherence is reported separately.` | Post-fix JSON join field; Ch06 `:104` reports adherence 0.000 | P0 | none |
| C4-07 | `:88` | `next-week adherence rebound` | `next-week adherence 0.000 (measured zero, rebound-era caveat); dip-window rebound reported in Section~6.4` | Ch06 `:104`; `research/doc/2026-10-22-dip-window-replay.md` | P0 | none |
| C4-08 | `:47` | `Two honest limits stay on record.` | Drop the count and name the actual limits: coding refusal, difficulty unmeasured, adherence 0.000, and the conformal correction unshipped | Harness gate FAIL on `difficultyMeanAbsBandError`; Ch06 results | P0 | Q-03 |
| C4-09 | `:71` | `Every replan extends the deadline.` | `Each of the four converted replans selected \texttt{extend-deadline}.` | Post-fix JSON `option` field | P1 | none |
| C4-10 | `:71` | `Development histories stay separate from evaluation histories, so a win reflects behavior instead of fitting.` | Name the split and its size, or mark `needs verification`; say `the replay tests the planted posture, not learner behavior` | Post-fix JSON lists four users, not a named split | P1 | Q-04 |
| C4-11 | `:7`, `:27` | `the middle band` | Remove, or name the evidence floor 0.5 and the confidence gate 0.7 | `route_loop_action` checks only evidence and confidence; the middle band survives only in the docstring | P1 | Q-05 |
| C4-12 | `:21` | `The adaptive chip then maps the estimate to a difficulty recommendation.` | Add `advisory and uncalibrated` and cross-reference Section~6.1 | Ch03 FR-11; Ch06 `:57` | P1 | none |
| C4-13 | `:98` | `the capability list it delivers sits in Sections~3.3 and~3.4` | `the requirements sit in Sections~3.3 and~3.4`, or name the functional and non-functional sets separately | Section 3.3 is functional requirements; Section 3.4 is non-functional | P1 | none |
| C4-14 | `:71` | `Confidence reads 1.0 with sufficiency from 0.66 to 0.77.` | `Verdict confidence reads 1.0; the judge's evidence-sufficiency score ranges 0.66 to 0.77.` | Ch06 `:82`; post-fix JSON | P1 | none |
| C4-15 | `:96` | `the synthetic replay proving \texttt{suggest\_replan} converts to a replan` | `the synthetic replay showing that \texttt{suggest\_replan} converted to a verdict-linked replan in all four synthetic histories` | Four-case evidence, not a general proof | P1 | none |
| C4-16 | `:98` | `This section states the path once. ... Nothing here restates either.` | Delete both sentences; keep one cross-reference sentence | Meta prose about the writing, not the method | P2 | none |
| C4-17 | `:128` | `The loop that stayed dashed in Phase~I runs solid here.` | Replace with a technical statement; keep at most one occurrence across Chapters 4 and 6 | The same sentence closes Ch06 `:115` | P2 | none |
| C4-18 | `:103`, `:124` | `folded inside` | Keep one occurrence; vary or drop the other | Also appears in Ch05 `:62` | P2 | none |
| C4-19 | `:39`, `:41`, `:87` | Semicolons in table cells | Replace each semicolon with a comma or period | STE 8.1; table cells count as body prose | P2 | none |
| C4-20 | `:21` | `The tie went to the simpler, per-skill model` | `Among the deep and hybrid candidates, the per-skill updater was the simplest at parity; its estimate is inspectable.` | BKT is not simpler than the running-proportion baseline | P2 | none |
| C4-21 | `:40`, `:52` | `bkt-v1` capitalization | Standardize the project term across Chapters 4 to 7 | X-02 | P3 | none |
| C4-22 | `:103` | `The graphics sidecar` | `The GPU inference sidecar` | Ch03 and Ch05 names | P3 | none |
| C4-23 | `:2` | Five-sentence roadmap | Trim to three or four sentences | Guide prefers 2-4; STE fails only past 6 | P3 | none |
| C4-24 | `:124` | `Supabase hubs the data` | `Supabase acts as the data hub` | Clarity | P3 | none |
| C4-25 | `:87` | `feedback loop 3 of 3` | `feedback copy 3 of 3` | Ch06 names the feedback-copy check | P3 | none |
| C4-26 | `:7` | `The verdict is advisory and gated.` | `The verdict is advisory and passes a code gate`, or move the gate constant and evidence threshold here | `gated` lacks a named lock beside it | P3 | none |
| C4-27 | `:24`, `:73`, `:94`, `:96` | Four over-length sentences | Split at the claim boundaries | STE 6.3; never drop a fact | P2 | none |

Chapter 4 acceptance: the table and body agree on the feedback template, the store claim matches the Dexie schema, the retrieval and AUC metrics carry their arm and cut, conversion and adherence are separate, and the limits paragraph names the real limits.

### Batch 2 - Chapter 5 implementation facts and framing

File: `chapters/05-implementation.tex`.

| ID | Line | Current text | Fix | Evidence or guard | Priority | Blocked by |
|---|---|---|---|---|---|---|
| C5-01 | `:5`, `:10` | `The last six rows add ...` and the caption `the last six add` | `The last seven rows add the Phase-II generation, grading, feedback, judgment, sandbox, embedding, and editor concerns.` Fix the caption only with author approval | Rows 16 to 33 hold 11 Phase-I and 7 Phase-II rows | P0 | Q-06 |
| C5-02 | `:146` | `The assessment library lists every attempt with its family and status.` | `The assessment library lists every assessment with its family and status.` | `AssessmentLibrary.tsx` renders `assessmentRows` and `assessmentMeta` | P0 | none |
| C5-03 | `:228` | `the verdict closes the loop onto the replan` | Add a replan node and a back edge from Feedback to Materials, or retitle `completes the chain` | TikZ lines 221 to 226 draw a linear chain with no back edge | P0 | Q-07 |
| C5-04 | `:120` | `a reader can re-run both legs from versioned files` | Name the full input set, required services, credentials, and replay paths; say `from versioned inputs and the documented services` | `eval_harness.py` reads Supabase, calls a paid judge, and needs the sidecar | P0 | Q-08 |
| C5-05 | `:123` | `This section presents that application in full.` | `This section presents the Phase-II additions; the Phase-I screens are unchanged.` | The section covers five additions, not the whole application | P0 | none |
| C5-06 | `:2`, `:122`, `:5` | `Phase-2`, `Phase-II`, and `Phase-I` in one chapter | Use `Phase~I` and `Phase~II` throughout; heading `The Phase~II Application` | X-01; the rest of the report uses `Phase~I` and `Phase~II` | P0 | none |
| C5-07 | `:123` | `This section follows the five Phase-II capabilities in order.` | Name the five and map them to Table~4.1 or FR-9 to FR-15, or call them `five user-facing additions`; note that 5.5.1 is Phase-I substrate | Table 4.1 has five stages; Ch03 has seven Phase-II FRs; 5.5.1 has no Phase-II FR | P1 | Q-09 |
| C5-08 | `:39` | `A single learner's real log cannot supply a known ground truth.` | `A single learner's real log does not supply a known ground truth for latent mastery and pace in this design.` | The report treats a real study as future work, not impossible | P1 | none |
| C5-09 | `:41`, `:52` | `The Open University dataset` and `ACCA text at 754 chunks` | Add a dataset note with edition or version where known; mark unknown metadata `needs verification` | OULAD and the ACCA text are third-party sources | P1 | Q-10 |
| C5-10 | `:62` | `a result measured offline is a result about the shipped code` | `the offline harness imports the same engine code the service runs`; do not claim the service wrapper or deployment is exercised | The harness imports the engine modules, not the service wrapper | P1 | none |
| C5-11 | `:60` | `asserts numeric equality to a tight tolerance` | `asserts numeric equality within a 1e-6 relative and absolute tolerance` | The parity tests set `TOLERANCE = 1e-6` | P1 | none |
| C5-12 | `:191` | `streams Nudge, Hint, and Targeted guidance` and `with its difficulty recommendation` | `Targeted explanation`; `advisory, uncalibrated difficulty recommendation (Section~6.1)` | Ch03 `:64`; Ch06 `:57` | P1 | none |
| C5-13 | `:146` | `a failed run ends there` | `a failed run stays failed` | The intended terminal rule | P1 | none |
| C5-14 | `:126` | `The library card reports each state honestly until the material reads ready.` | `The library card shows the material's current state until it is ready.` | The ready card has no status badge; `honestly` is not testable | P1 | none |
| C5-15 | `:5`, `:62`, `:112` | The `evaluated code equals shipped code` guarantee appears three times | Keep the mechanism at `:62`; delete the outcome at `:5` or cross-reference it; trim the table row at `:112` | Repetition without new information | P2 | none |
| C5-16 | `:118`, `:123` | `instead of redefining them` and `nothing here restates them` | Delete both disclaimers; keep the cross-references | The same move appears in Ch04 `:98` | P2 | none |
| C5-17 | `:2` | `Section~5.4 states the metrics and the steps taken for reproducibility.` | `Section~5.4 records how the metrics are kept reproducible.` | 5.4 defers the metric definitions to Chapter 4 | P2 | none |
| C5-18 | `:126`, `:146`, `:168`, `:191`, `:215` | Five 8 to 9 sentence paragraphs | Split at the natural pivots: after `a retry action`, `across calls`, `no client result enters the record`, `invents an observation`, and `never alters a grade` | STE 6.6; never drop a fact | P2 | none |
| C5-19 | `:215` | `The ledger reads cold, updated, stale, or rebuilding from the cached mastery and the latest copy.` and `hands its verdict pair` | `The ledger shows one of four states, derived from the cached mastery and the latest copy.` and `passes its verdict pair` | Clarity; Ch04 `:7` uses `carries ... forward` | P2 | none |
| C5-20 | `:120` | `\texttt{--activate}` | `\texttt{-{}-activate}` | The `--` byte pair triggers the en-dash lint | P2 | none |
| C5-21 | `:32`, `:52`, `:53`, `:54`, `:106` | Semicolons in table cells | Replace with a comma or period; split the `OULAD and real logs` cell into two rows | STE 8.1 | P2 | none |
| C5-22 | `:236` | The chapter ends on a figure pointer | Add a two-sentence close that names the five additions and points to Chapter 6 | The chapter has no closing summary | P2 | none |
| C5-23 | `:128-236` | Five cumulative flow figures, the first a single box | Keep for this submission or consolidate into one cumulative figure | Q-11; figure design is an author choice | P3 | Q-11 |
| C5-24 | `:33`, `:62`, `:120`, `:168`, `:215` | A cluster of absolute negations | Keep the contractual absolutes; cut the rhetorical ones | Security and grading contracts need absolutes; the rest read as a guarantee sheet | P3 | none |
| C5-25 | `:123` | `A flow diagram builds up across the subsections` | Remove `builds up` if the sentence is kept | Phrasal verb list | P3 | none |
| C5-26 | `:126` | `plain text, PDF upload, and web article` | Match the UI label `PDF document` | The source grid uses `PDF document` | P3 | none |
| C5-27 | `:60` | `The algorithms stay implemented once in behavior and twice in code` | `Each algorithm has one behavioral definition; the client and service hold separate implementations only where the client must compute a view locally.` | Clarity | P3 | none |

Chapter 5 acceptance: the table row count matches the table, the library sentence names assessments, Figure 5.5 matches its caption, the reproducibility paragraph names real inputs and services, and the Phase naming is consistent.

### Batch 3 - Chapter 6 results evidence and discussion

File: `chapters/06-results.tex`.

| ID | Line | Current text | Fix | Evidence or guard | Priority | Blocked by |
|---|---|---|---|---|---|---|
| C6-01 | `:34` | `derivability on the golds reads 0.0 as the honest terminal` | Label the 0.0 as the #48 pre-top-up result, or drop it; keep the fresh 0.5349 over 43 judged and 3 of 3 gold agreement as current | `report.md:55-56` records the fresh run; `issue-48.../VERIFICATION.md:22` records the old 0.0 run | P0 | Q-12 |
| C6-02 | `:57`, `:71` | `External pyBKT accoding anchor` with note `gate 0.6` | Add `ECE 0.272, not reportable` or drop the anchor | `research/kt-bench/model_registry.json:119-122` marks it `not_reportable_high_ece` with ECE 0.2716 | P0 | none |
| C6-03 | `:93-96`, `:87` | All four rows show `0.66--0.77`; caption claims `Per-user sufficiency ... sit in the versioned JSON` | Move the range to the caption or a note; remove the per-user claim unless values are obtained | Post-fix JSON has one `sufficiency_range`, not per-user values | P0 | Q-13 |
| C6-04 | `:82` | `The gate moved from 0.9 to 0.7.` | Add `The input fix opened these states; confidence 1.0 would also clear the old 0.9 gate.` Separate the gate selection from the conversion result | Post-fix JSON caveat | P0 | none |
| C6-05 | `:82` | `The JEV cutoff and margin prior of 0.6 and 0.10 holds.` and the train/test sentence | Move to 6.1 under grading; `hold` not `holds`; unpack `training favorite` and `test pair` | `report.md:58-62`; `jev-integration/plan/VERIFICATION.md:17,38` | P0 | none |
| C6-06 | `:57`, `:62` | `The reading is parity, not a win.` and the caption | `The reading is parity on ranking and a gain on calibration.` Qualify the caption | Bkt-v1 ECE 0.1401 against 0.2679 is a near-halving; Ch06 `:109` calls it a real improvement | P0 | none |
| C6-07 | `:109` | `The clear wins are four.` | Separate the two comparative gains from the two descriptive results, or define `win` as passing a pre-registered gate | Retrieval is comparative; 0.8667 is absolute; 4 of 4 is synthetic n=4; 88 s is deployment timing | P0 | none |
| C6-08 | `:109-115` | Discussion restates the results in section order | Cut the repeated numbers; add one mechanism or alternative per main result | Guide says the discussion interprets, not just restates | P1 | none |
| C6-09 | `:109`, `:115` | `each with its named cause rather than a softened adjective` and `The limits are stated plainly.` | Delete both; start with the cause or the limit | Meta-commentary about the writing | P1 | none |
| C6-10 | `:109` | `Read together, the results separate into honest nulls, real wins, and validated refinements not yet shipped.` | Rewrite around the Phase-II delta: logged time to graded evidence | Verbatim Phase-I `06-results.tex:133` | P1 | none |
| C6-11 | `:115` | `The loop that stayed dashed in Phase~I runs solid here.` | Cut, or tie it to the 4 of 4 conversion and the figure in one specific sentence | Verbatim Ch04 `:128` | P1 | none |
| C6-12 | `:82` | `The 0.8 setting was falsified by the live 0.79 dip.` | `The 0.8 candidate was rejected after a live suggest\_replan sample at 0.79 fell inside the 0.79-0.85 band.` | Jev router evidence; `dip` collides with the week-3 dip-window | P1 | none |
| C6-13 | `:104`, `:106` | `The product is untouched.` and `Cloud counts sit unchanged` | Say what was recorded and what was not changed; give the recorded counts or drop the clause | The post-fix JSON records replan counts, not a general cloud-count set | P1 | none |
| C6-14 | `:102` | `the full 24-row adherence emission` | `the full 24-value adherence emission` or `per-week adherence for all four users` | The appendix table is 4 users by 6 weeks; X-18 | P1 | none |
| C6-15 | `:34`, `:104`, `:109` | `honest terminal`, `honest nulls`, `measured-zero`, `real wins` | Keep at most one `honest null`; replace the rest with the outcome and its cause | Evaluative labels, not results | P2 | none |
| C6-16 | `:34`, `:57`, `:79`, `:82`, `:104`, `:106`, `:109` | The `reads` frame appears about twelve times | Vary with `measured`, `scored`, `was`, `reached`, or `recorded`; keep `reads` for two or three places | X-15 | P2 | none |
| C6-17 | `:7`, `:57`, `:71`, `:104` | `quantisation`, `canonicalises`, `accoding` | `quantization`, `canonicalizes`; confirm `accoding` or `ACcoding` | American spelling; the research key is `accoding` | P2 | Q-14 |
| C6-18 | `:71`, `:93-96` | `0.602--0.611` and `0.66--0.77` | Use a single hyphen: `0.602-0.611`, `0.66-0.77` | Humanizer 8; table cells count as body prose | P2 | none |
| C6-19 | `:2`, `:34`, `:102`, `:104` | Semicolons in body prose | Replace with a period or comma | STE 8.1 | P2 | none |
| C6-20 | `:82` | `Table~\ref{tab:res-verdict} is the paper's verdict evidence` | `this chapter's verdict evidence` or `the report's verdict evidence` | Genre terminology | P2 | none |
| C6-21 | `:82`, `:109` | `4 of 4` against Ch04 `4 out of 4` | Pick one form across Chapters 4 to 7 | X-13 | P2 | none |
| C6-22 | `:2`, `:7`, `:34`, `:57`, `:77`, `:82`, `:104`, `:106`, `:109` | Nine paragraphs exceed the six-sentence cap | Split at the pivots; add one interpretive sentence per table | STE 6.6; never drop a fact | P2 | none |
| C6-23 | `:82` | `The sweep over 21 cases agreed at 0.857 across 0.5 to 0.7.` | Verify the 21-case count and the 0.857 value against the sweep evidence; delete or clarify if not found | The JEV verification records a 3x3 sweep, not 21 cases | P3 | Q-15 |
| C6-24 | `:5`, `:7` | Evidence files are not named in the results text | Add one table note naming the harness report and the dated `2026-10-22-*` files | Reproducibility trail | P3 | none |
| C6-25 | `:104` | `The 12 mastery rows read after at about 0.1067 throughout` | `read after the replay at about 0.1067 throughout` | Clarity | P3 | none |

Chapter 6 acceptance: every headline number carries its run label, the external anchor's calibration status is visible, per-user claims match the evidence, the gate story separates the input fix from the gate selection, and the discussion adds interpretation.

### Batch 4 - Chapter 7 conclusion claims and structure

File: `chapters/07-conclusion.tex`.

| ID | Line | Current text | Fix | Evidence or guard | Priority | Blocked by |
|---|---|---|---|---|---|---|
| C7-01 | `:7` | `assessment-based verification of genuine learning` | `assessment-based verification of graded evidence` or `assessment-verified planning`; state that learning gain is not measured | Ch06 `:104` says the adherence zero is not a learning result; mastery rows measure scripts | P0 | Q-16 |
| C7-02 | `:7` | `The principal novelty is the verified-learning closed loop` | `The project's main contribution is the verified-learning closed loop`; name the closest prior work and the comparison | No field-first comparison; Ch02 `:85` supports a gap claim, not a novelty proof | P0 | Q-17 |
| C7-03 | `:7` | `extends the predict-then-optimize architecture~\cite{islam2024} from logged time to graded evidence` | `extends the predict-then-optimize idea from predicted grades to graded evidence from the learner's own answers`; attribute the logged-time contrast to Phase I | Ch02 `:42` says `islam2024` predicts grades before scheduling | P0 | none |
| C7-04 | `:7` | `Logged time stays gameable~\cite{gaming2026}, so the plan responds to graded evidence.` | Rewrite the rationale: logged time is self-reported; grades come from a server-authoritative arm; help-seeking can still be gamed; keep the citation for help-seeking only | Ch02 `:55`; the source is about help-seeking gaming, not logged-time gaming | P0 | Q-18 |
| C7-05 | `:17` | `and every replan extends the deadline over a 32-day span` | `and all four synthetic replays extended the deadline over a 32-day span` | Four synthetic archetypes, not a universal | P0 | none |
| C7-06 | `:22` | `Table rows in Appendix~\ref{ch:appendix} remain the reproducibility base for the work below.` | `Section~5.4 records the versioned artifacts that make both legs reproducible. The appendix carries the full adherence and verdict tables.` | Section 5.4 is the reproducibility contract; the appendix does not hold the harness inputs | P0 | none |
| C7-07 | `:15` | `The full-book path reaches ready in about 88~s for the 572-page fixture, with zero console errors.` | `The full-book path moves from created to ready in about 88 s (101 s from upload start) for the 572-page fixture.` Verify or delete the console claim | `2026-10-22-fullbook-e2e-timing.json` gives 87.849 s from created and 101.406 s from start | P0 | Q-19 |
| C7-08 | `:19` | `The dip-window replay holds 4 of 4 at 0.28 to 0.35 in the trough and converts on the rebound eve at 1.0.` | Split: `The dip-window replay holds 4 of 4 at 0.28 to 0.35. The separate Oct-14 rebound-eve run converts at 1.0.` | `2026-10-22-dip-window-replay.md` records holds and cites the prior evidence for the 1.0 conversion | P0 | none |
| C7-09 | `:19` | `The only validated but unshipped refinement is the split-conformal correction.` | Qualify as `the only validated refinement to a shipped component`; acknowledge the DP allocator separately or explain why it is not a counterexample | Phase-I `06-results.tex:130` reports the DP allocator as a genuine win the system does not ship | P0 | none |
| C7-10 | `:19` | `the full 24-row emission` | `the full 24-value adherence table` or `per-week adherence for all four users` | Appendix table is 4 users by 6 weeks; X-18 | P0 | none |
| C7-11 | `:5` | `Evaluation reported honest nulls with the wins` | Name the nulls and wins: `nulls on retrospective recovery error and change detection, and wins on prospective calibration and scheduling` | The labels add self-praise, not information | P1 | none |
| C7-12 | `:9` | `with ranking parity on the dense baseline` | `with the dense and hybrid arms reproducing their recorded baselines` or `with gains over dense on both corpora` | The table shows rerank MRR 0.797 against dense 0.706 | P1 | none |
| C7-13 | `:9` | `Title-prefix indexing shows no gain, and int8 quantisation collapses to 0.10.` | Label the split: `On the retired 788 split, ...`, or omit from the 754 recap | Both rejected arms come from the retired 788-split program | P1 | none |
| C7-14 | `:11` | `The judge scores whether the cited chunk supports the answer, while gold support scores whether the citation contains the gold string.` | Cut or compress to `the two metrics measure different things` | Verbatim Ch06 `:34` | P1 | none |
| C7-15 | `:13` | `The update stays as Equation~\ref{eq:bkt-update} with the shipped filter in Listing~\ref{lst:bktforward}.` | Cut | Equation and listing pointers do not conclude anything | P1 | none |
| C7-16 | `:17` | `Hook checks pass 37 of 37 and feedback checks pass 77 of 77.` | Define the checks, or move them to Chapter 5 or 6 | The reader cannot tell what a hook or feedback check is | P1 | none |
| C7-17 | `:24-30` | Four future-work items | Tie each item to a named Chapter 6 limitation; keep classroom scope as a long-term direction; add the thin met-class and replay caveats if they are open | Ch06 `:115` lists single learner, one difficulty question, and four replay caveats | P1 | Q-20 |
| C7-18 | `:26` | `the static baseline` and `measured learning gain` | Define the fixed-plan baseline and the learning-gain measure, or mark the measure as to be designed | Neither term is defined in Ch06 or Ch01 | P1 | none |
| C7-19 | `:5`, `:19`, `:24` | The conformal correction is stated three times | State it once, at line 19 or line 24 | Redundant restatement | P1 | none |
| C7-20 | `:5` | `It estimated ... and it flagged ... It projected ... and it regenerated ...` | Combine the first two clauses and vary the openings | Predictable sentence rhythm | P2 | none |
| C7-21 | `:9-19` | Six result paragraphs in Chapter 6 order | Keep the exact numbers as anchors; cut the recap by half and add synthesis | The chapter is a compressed Ch06 | P2 | none |
| C7-22 | `:19` | `Capture ran one day before the deadline, so the zero reflects timing.` | `The zero is a capture artifact: the run ended one day before the deadline, so no post-replan sessions could be logged.` | Ch06 says measured zero with a caveat, not a causal result | P2 | none |
| C7-23 | `:22-30` | Four short ordinal paragraphs | Merge into two paragraphs: near-term and longer-term | Optional structure polish | P3 | none |
| C7-24 | `:9`, `:13` | `quantisation`, `Bkt-v1` | `quantization`, `bkt-v1` | X-02 and X-12 | P3 | none |

Chapter 7 acceptance: the contribution claim is scoped to the project, the `islam2024` input is correct, the gameable-time non sequitur is gone, every recap number matches Ch06, the appendix pointer is correct, and the future-work items are tied to real limitations.

### Batch 5 - Cross-chapter reconciliation

Apply these decisions once and then align every occurrence.

| ID | Decision | Canonical form | Affected lines | Action | Priority |
|---|---|---|---|---|---|
| X-01 | Phase naming | `Phase~I` and `Phase~II` | Ch05 `:2`, `:5`, `:122`, `:123`; `main.tex:4`, `:25`, `:35` | Standardize; keep `Phase-2` only in a literal project name if one exists | P1 |
| X-02 | Model name | `bkt-v1` (or `\texttt{bkt-v1}`) | Ch04 `:21`, `:40`, `:52`; Ch05 `:105`, `:107`; Ch06 `:57`, `:69`; Ch07 `:13` | Standardize | P1 |
| X-03 | Feedback template | `feedback-v2` with v1 fallback | Ch04 `:24`, `:41` | Q-01 | P0 |
| X-04 | Sidecar name | `GPU inference sidecar` | Ch04 `:103`; Ch05 `:32`, `:110`; Ch03 if it recurs | Standardize | P2 |
| X-05 | Ladder stage | `Targeted explanation` | Ch05 `:191`; Ch03 `:64`; Ch04 `:24` | Standardize | P2 |
| X-06 | Object names | `assessment` for the library row; `attempt` for a learner answer | Ch05 `:146`; Ch06 wherever the library is named | Standardize | P2 |
| X-07 | Dashed and solid closer | One occurrence | Ch04 `:128`; Ch06 `:115` | Keep one, replace the other | P2 |
| X-08 | `folded inside` | One occurrence | Ch04 `:103`, `:124`; Ch05 `:62` | Keep one | P2 |
| X-09 | Meta prose | Delete | Ch04 `:98`; Ch05 `:118`, `:123`; Ch06 `:109`, `:115`; Ch07 `:22` | Delete the disclaimers | P2 |
| X-10 | Honest labels | At most one `honest null` | Ch06 `:34`, `:104`, `:109`; Ch07 `:5`, `:11`, `:26` | Replace the rest with outcomes | P2 |
| X-11 | Table punctuation | Comma or period; single hyphen | Ch04 `:39`, `:41`, `:87`; Ch05 `:32`, `:52`, `:53`, `:54`, `:106`; Ch06 `:71`, `:93-96` | Fix all cells | P2 |
| X-12 | Spelling | American forms | Ch06 `:7`, `:57`, `:104`; Ch07 `:9`; any `realised`, `analyses`, `labelled` | Fix | P2 |
| X-13 | Numeric style | Pick one form | Ch04 `:71` `4 out of 4`; Ch06 and Ch07 `4 of 4`; `24-row`; `measured-zero` | Standardize | P2 |
| X-14 | `The paper's` | `the report's` or `this chapter's` | Ch06 `:82`; grep the other chapters | Fix | P2 |
| X-15 | `reads` frame | Vary the verb | Ch06 `:34`, `:57`, `:79`, `:82`, `:104`, `:106`, `:109`; Ch07 `:9-17` | Vary | P3 |
| X-16 | Roadmap length | Three or four sentences | Ch04 `:2`; Ch05 `:2`; Ch06 `:2`; Ch07 `:2` | Trim only where a fact is not lost | P3 |
| X-17 | Figure consolidation | Keep or consolidate | Ch05 `:128-236` | Q-11 | P3 |
| X-18 | Adherence count | `24 values` or `4 users by 6 weeks` | Ch06 `:102`; Ch07 `:19`; `appendix.tex:5` | Fix all three | P2 |

### Batch 6 - Cross-document residuals exposed by the Chapter 7 audit

These files sit outside the four-chapter scope.
Apply them only with author approval because they touch the report thesis and the abstract.

| ID | File and line | Current text | Fix | Evidence or guard | Priority | Blocked by |
|---|---|---|---|---|---|---|
| XD-01 | `main.tex:129` | `true study pace`, `calibrated uncertainty band`, `genuine learning`, `realized` | `study pace`; `uncertainty band` or state the under-coverage; `graded evidence`; `implemented` | Phase-I `06-results.tex:70,108`; Ch06 `:104` | P0 | Q-16 |
| XD-02 | `01-introduction.tex:14`, `:37` | `genuine learning` twice | Align with the Chapter 7 decision | Ch06 evidence | P1 | Q-16 |
| XD-03 | `03-requirements.tex:58` | `calibrated uncertainty band` | `uncertainty band`, or state that the interval under-covers past cold start | Phase-I `06-results.tex:70,108` | P1 | Q-16 |
| XD-04 | `01-introduction.tex:7`, `:9`, `:37` | `realized` | `implemented` | American spelling; voice consistency | P3 | none |
| XD-05 | `main.tex:179` | `gaming2026` entry has no authors | Add authors from the source record, or leave for the author | The Ch07 audit flagged the missing metadata; do not invent authors | P2 | Q-21 |
| XD-06 | `02-literature-survey.tex` | Check for `analyses` or other British forms | American form | Prior plan C2-20 may already have fixed this; verify | P3 | none |

### Batch 7 - Verification

1. Re-run `python3 .work/active/phase2-prose-review/ste_check.py` on Chapters 4 to 7.
2. Target `STE PASS` and `Humanizer PASS` on all four chapters.
3. If a long sentence remains, record the line, the word count, and the reason it must stay.
4. Run the term grep for `Phase-2`, `Phase-II`, `Phase-I`, `bkt-v1`, `Bkt-v1`, `feedback-v1`, `feedback-v2`, `quantisation`, `quantization`, `analyses`, `realised`, `realized`, `accoding`, `genuine learning`, `calibrated uncertainty band`, `reads`, and `honest`.
5. Re-check every changed number against its evidence file.
6. Re-check every `\ref` against its label.
7. Ask `phase2-report` to run `latexmk` and inspect the compiled PDF.
8. Inspect the changed pages for overfull boxes, table overflow, Figure 5.5, Table 5.1, and the appendix.
9. Append a resolution table to each of the four audits, matching the Chapter 1 to 3 audits.
10. Do not update `main.pdf` from this task.

### Batch 8 - Record update

1. Update `state.md` with the audit and plan status.
2. Append the session entry to `SCRATCHPAD.md`.
3. Update the `phase2-prose-review` row in `.work/STATUS.md` without rewriting the shared table.
4. Keep the four audits and this plan as the durable record.

## 4. Do not change

- Do not change the BKT listing at `05-implementation.tex:65-93`; it matches the shipped filter line for line.
- Do not change the model identifiers, ports, environment variable names, or the `LOOP_APPROVE_AT = 0.7` and `LOOP_EVIDENCE_SUFFICIENT_MIN = 0.5` values.
- Do not change the verified numbers: 0.8667, 0.7803, 0.9611, 0.9133, 0.0044, 0.061289, 0.5349, 43 judged, 0.7397, 0.1401, 0.7368, 0.2679, 0.785, 0.057, 0.602 to 0.611, 23 observations, 4 of 4, 0.18 to 0.34, 32 days, 572 pages, 23 MB, 88 s from created, and 101 s from upload start.
- Do not change the 754-chunk and 768-dimensional corpus facts.
- Do not invent an ACCA edition, an OULAD version, a per-user sufficiency value, a console-error log, or a closest-prior-work citation.
- Do not rename `bkt-v1`, the feedback templates, or the loop gate constants.
- Do not edit captions, labels, or figure geometry without author approval.
- Preserve the Phase-I DP allocator distinction.
- Preserve the author's technical meaning in every rewrite.

## 5. Author queue

| Q | Question | Evidence at stake | Default if no answer | Blocks |
|---|---|---|---|---|
| Q-01 | Does Table 4.1 mean the delivered `feedback-v2` template, or the v1 fallback words? | `prompts.py` uses `feedback-v2`; the client keeps v1 words as a fallback | `feedback-v2 with v1 fallback` if both are intended, otherwise `feedback-v2` | C4-01 |
| Q-02 | Did the longitudinal replay run before the final selection, or after the gate fix as validation? | Post-fix replay date and Ch06 `:82` | `The offline leg informed selection; the replay validated the assembled loop after the gate fix.` | C4-05 |
| Q-03 | Which limits belong in the Chapter 4 paragraph? | Harness gate FAIL on difficulty; Ch06 adherence 0.000; conformal unshipped | Coding refusal, difficulty unmeasured, adherence 0.000, conformal unshipped | C4-08 |
| Q-04 | Is there a documented development/evaluation split for the synthetic histories? | The post-fix JSON lists four users, not a split | Mark `needs verification`; say `planted posture`, not `behavior` | C4-10 |
| Q-05 | Is the `middle band` a real third router condition? | `route_loop_action` checks only the evidence floor and the confidence gate | Remove it; name the 0.5 evidence floor and the 0.7 confidence gate | C4-11 |
| Q-06 | May the Table 5.1 caption be edited to say `seven`? | Captions are held verbatim in the review contract, but the caption is factually wrong | Yes, change to `seven`; a factual caption fix overrides verbatim for this line | C5-01 |
| Q-07 | Should Figure 5.5 gain a replan back edge, or should the caption say `completes the chain`? | The drawing is a linear five-node chain | Add a back edge from Feedback to Materials; fallback is the retitle | C5-03 |
| Q-08 | Which exact inputs, services, and paths should the reproducibility paragraph name? | `eval_harness.py`, Supabase, the paid judge, the sidecar, and the replay JSON | Use the paths already named in Ch05 and the appendix; add no new path | C5-04 |
| Q-09 | What are the `five Phase-II capabilities`, and how do they map to FR-9 to FR-15? | Table 4.1 has five stages; Ch03 has seven Phase-II FRs; 5.5.1 is Phase-I substrate | Call them `five user-facing additions`; map to FR-9 to FR-15; note 5.5.1 is substrate | C5-07 |
| Q-10 | Which ACCA edition and which OULAD version were used? | The chapter gives no edition or version | Add a dataset note and mark the edition and version `needs verification` | C5-09 |
| Q-11 | Keep the five cumulative flow figures, or consolidate them? | Figure 5.1 is a single box; the series is a linear build-up | Keep them for this submission; do not redesign figures in a prose pass | C5-23 |
| Q-12 | Is the 0.0 coding result the #48 pre-top-up run or the current gold run? | The fresh report gives 0.5349 over 43 judged; the #48 verification gives the 0.0 run | Label the 0.0 as pre-top-up; keep 0.5349 as current | C6-01 |
| Q-13 | Do per-user sufficiency values exist anywhere? | The post-fix JSON has one range, not per-user values | Move the range to the caption or a note; remove the per-user claim | C6-03 |
| Q-14 | Is the dataset label `accoding` or `ACcoding`? | The research key is `accoding`; the tests mention `ACcoding` | Keep `accoding`; add `ACcoding` only if the author confirms the display label | C6-17 |
| Q-15 | Where does the `21 cases` and `0.857` sweep statement come from? | The JEV verification records a 3x3 sweep, not 21 cases | Verify; if not found, delete the sentence | C6-23 |
| Q-16 | Should the report keep `genuine learning` and `calibrated uncertainty band` as thesis terms? | Ch06 measures graded performance, not learning gain; Phase-I coverage under-covers | Ch07 uses `graded evidence`; leave the abstract, Ch01, and Ch03 to the author | C7-01, XD-01 to XD-03 |
| Q-17 | What is the closest prior system for the novelty claim? | Ch02 `:85` says none forms a closed loop but names no closest system | `The project's main contribution`; name `islam2024` as the closest scheduling comparator; make no field-first claim | C7-02 |
| Q-18 | Does `gaming2026` cover logged-time gaming or help-seeking gaming? | Ch02 `:55` says help-seeking gaming | Rewrite around self-report versus server-authoritative grades; keep the citation for help-seeking only | C7-04 |
| Q-19 | Is there a run log for the full-book zero-console claim? | The timing doc and JSON do not record console errors | Delete `zero console errors` from Ch07 unless the log is produced | C7-07 |
| Q-20 | Are the four future-work items the full open list? | Ch06 lists single learner, one difficulty question, and four replay caveats | Tie each item to a Ch06 limitation; keep classroom scope as long-term; add the thin met-class | C7-17 |
| Q-21 | Can the missing bibliography authors be recovered from the source records? | `gaming2026` has no authors in `main.tex` | Leave to the author; do not invent metadata | XD-05 |

## 6. Execution order

1. Batch 0.
2. Answer or default Q-01 to Q-21.
3. Batch 1 P0 rows, then Batch 2 P0, Batch 3 P0, Batch 4 P0.
4. Batch 5 decisions that unblock P1 and P2 rows.
5. Batch 1 to 4 P1 rows.
6. Batch 1 to 4 P2 rows.
7. Batch 5 P2 and P3 rows.
8. Batch 6 only with author approval.
9. Batch 7.
10. Batch 8.

Stop after each chapter and re-run the lint for that chapter.
Do not let a cross-chapter phrase change cascade without re-checking the other chapters.

## 7. Acceptance criteria

- Chapters 4 to 7 read `STE PASS` and `Humanizer PASS`, or every remaining over-length sentence has a recorded reason.
- No P0 row remains open.
- Every changed number is traceable to a named evidence file.
- Every changed claim is either supported or marked `needs verification`.
- No dangling `\ref` or `\cite`.
- No caption, label, or figure geometry changed without author approval.
- The PDF compiles clean through `phase2-report`, with no overfull boxes on the changed pages.
- The four audit reports carry a resolution table.
- The task record is updated.

## 8. What this plan deliberately does not do

- It does not rewrite any chapter wholesale.
- It does not humanize text to evade a detector.
- It does not add new claims, new numbers, or new citations.
- It does not redesign the figures except where a caption and a drawing contradict each other.
- It does not touch `main.pdf`, `active/phase2-report/*`, or research evidence files.
- It does not treat a style pattern as evidence of authorship.

## 9. Execution record (2026-10-23)

Author answers resolved from evidence; no new facts invented.

| Q | Answer applied | Evidence |
|---|---|---|
| Q-01 | Table 4.1 says `feedback-v2 with v1 fallback` | `prompts.py` `FEEDBACK_PROMPT_TEMPLATE_VERSION = "feedback-v2"`; body :24 already says `through the feedback-v2 template with a static fallback` |
| Q-02 | `The offline leg informed per-stage selection; the longitudinal replay validated the assembled loop after the gate fix.` | Post-fix replay dated 2026-10-19; Ch06 :82 treats the replay as validation |
| Q-03 | Four limits: coding refusal, difficulty unmeasured, adherence 0.000, conformal unshipped | Harness gate FAIL on `difficultyMeanAbsBandError`; Ch06 results |
| Q-04 | No split named; `the replay tests the planted posture` | Post-fix JSON lists four users, not a named split |
| Q-05 | `middle band` removed; 0.5 evidence floor and 0.7 confidence gate named | `route_loop_action` checks only `LOOP_EVIDENCE_SUFFICIENT_MIN = 0.5` and `LOOP_APPROVE_AT = 0.7` |
| Q-06 | Caption changed to `seven` | Factual caption fix overrides verbatim for this line; Table 5.1 rows 16-33 hold 11 Phase-I and 7 Phase-II rows |
| Q-07 | Retitle to `the verdict completes the chain`; no geometry change (grilled 2026-10-23: a back edge to Materials would misstate the data flow, since replans mint roadmaps rather than modifying materials) | TikZ lines 221-226 draw a linear chain with no back edge |
| Q-08 | `from versioned inputs and the documented services`; no new paths | Paths already named in Ch05 and the appendix |
| Q-09 | Five user-facing additions named; 5.5.2 maps to FR-9, 5.5.3 to FR-10, 5.5.4 to FR-11/12/14, 5.5.5 to FR-13/15; 5.5.1 is Phase-I substrate | Ch03 FR-9 to FR-15 |
| Q-10 | `(edition needs verification)` and `(version needs verification)` marks | No edition or version in the chapter |
| Q-11 | Figures kept for this submission; no redesign | Author choice; prose pass only |
| Q-12 | 0.0 labeled `pre-top-up run`; 0.5349 over 43 judged current | `report.md:55-56`; `issue-48.../VERIFICATION.md:22` |
| Q-13 | Range moved to the caption as a cross-user range; per-user claim removed | Post-fix JSON has one `sufficiency_range`, not per-user values |
| Q-14 | `accoding` kept | The research key is `accoding` |
| Q-15 | `21 cases / 0.857` sentence deleted | No `21 cases` or `0.857` in any dated evidence or JEV record (the sweep is 3x3) |
| Q-16 | Ch07 uses `graded evidence`; abstract, Ch01, Ch03 left to the author | Ch06 measures graded performance, not learning gain |
| Q-17 | `The project's main contribution`; `islam2024` as the closest scheduling comparator; no field-first claim | Ch02 :85 supports a gap claim, not a novelty proof |
| Q-18 | Self-report vs server-authoritative rewrite; citation kept for help-seeking only | Ch02 :55 scopes the source to help-seeking gaming |
| Q-19 | `zero console errors` deleted from Ch07 | No console-error entry in the full-book timing doc or JSON |
| Q-20 | Items tied to Ch06 limits; classroom kept as long-term; thin met-class added | Ch06 :115 limitations |
| Q-21 | Authors added from three corroborating source records (grilled 2026-10-23): `Zhang, J., et al.` in repo style, LAK26 venue, title corrected to `Analyzing` | ACM reference format, arXiv 2601.04487, and library catalog all confirm Zhang, Borchers, Wang, Kumar, Teffera, McLaren, Baker; DOI 10.1145/3785022.3785025 matches |

Batches applied in order: Batch 0 (baseline matched Section 2; lint output at `plan/lint-baseline-ch04-ch07.txt`; audits re-read; bib keys and labels resolve), Batch 1 (Ch04, all unblocked rows), Batch 2 (Ch05, all except C5-03), Batch 3 (Ch06, all rows), Batch 4 (Ch07, all rows), Batch 5 (X-01 to X-05, X-07 to X-16, X-18; X-06 satisfied via C5-02; X-17 no action).
Batch 6 skipped (author approval required).
Batch 7: final lint Ch04 PASS/PASS, Ch05 PASS/PASS, Ch06 PASS/PASS, Ch07 PASS/PASS.
Term grep clean: no `Phase-I`/`Phase-II` hyphens, no `feedback-v1`, no `Bkt-v1`, no British spellings, no `genuine learning`, no `paper's`, no `out of`, no `24-row`, no `measured-zero`, no `honest` in Ch04-Ch07.
Numbers verified against the do-not-change list; every `\ref` resolves; no caption, label, or figure geometry changed except the Q-06/Q-13 caption fixes recorded above.
`latexmk` and the compiled-PDF inspection stay with `phase2-report`.
Grill follow-up (2026-10-23): the author approved propagating the thesis terms, the `gaming2026` author fill, the Figure 5.5 retitle, the Table 6.3 caption qualification, the C4-24 caption fix, and the remaining Ch04:52 0.0 label (applied per the Q-12 pattern without a further question; revert on request). Applied: abstract `graded evidence` plus bare `uncertainty band`, Ch01 two `genuine learning` swaps, Ch03 FR-5 bare band, `gaming2026` authors plus venue plus `Analyzing`, Figure 5.5 caption `the verdict completes the chain`, Table 6.3 caption `Parity on ranking; calibration nearly halves on live attempts`, Fig 4.2 caption `Supabase acts as the data hub`, Ch04:52 `reads 0.0 on the pre-top-up run`. Re-verified: Ch01/Ch03/Ch04/Ch05/Ch06/Ch07 all STE PASS and Humanizer PASS; no residual `genuine learning` or `calibrated uncertainty band`; bib braces balanced. Still untouched: `true study pace` and `realized` in the abstract (XD-01 leftovers, never put to the grill). `latexmk` and PDF inspection stay with `phase2-report`.
