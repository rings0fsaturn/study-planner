# AI Writing Pattern Audit

## 1. Scope

- **Material reviewed:** `college/mydeliverables/Phase-2-report/phase2-report/chapters/07-conclusion.tex`, all 30 lines (about 640 words).
- **Context read in full:** `main.tex` (abstract 128-137, bibliography 158-179), `01-introduction.tex`, `02-literature-survey.tex`, `03-requirements.tex`, `04-methodology.tex`, `05-implementation.tex`, `06-results.tex`, `appendix.tex`, `college/mydeliverables/REPORT_WRITING_GUIDE.md`, Phase-I `06-results.tex`, and the dated evidence files named in the brief.
- **Coverage:** Full chapter at sentence and paragraph level.
  Every number on lines 9-19 was checked against Ch6 and the dated evidence.
  Cross-document checks cover Ch1, Ch3, and the abstract only where they bear on Ch7's claims.
- **Genre/discipline:** M.Tech dissertation conclusion, data science and learning analytics.
  The chapter is short, so the audit is local and comparative rather than a document-level authorship assessment.
- **Limitations:** No external detector report was supplied, and none is reproduced.
  The two external citations were not opened; their scope is marked "needs verification."
  Ch7 is the audit unit; Ch1, Ch3, and the abstract are checked only for consistency.
  Confidence means confidence that the pattern is present, not confidence about who wrote the text.
- **Lint baseline:** `python3 .work/active/phase2-prose-review/ste_check.py college/mydeliverables/Phase-2-report/phase2-report/chapters/07-conclusion.tex` reports STE PASS (0 fail-tier, density 0.16/100w), Humanizer PASS (0 fail-tier), and one guide-xref at line 22.
  This matches the stated baseline and was re-run on the current working tree.

## 2. Executive assessment

The chapter is surface-clean and technically specific, but it is organized as a compressed Ch6 rather than a conclusion.
Six of the eight body paragraphs re-report the Ch6 results in Ch6's section order, and several sentences are near-verbatim from Ch6.
The chapter's own argument is concentrated in three sentences at line 7, and those sentences carry the main claim-evidence problems: "genuine learning," "principal novelty," and a non sequitur from gameable time to trustworthy grades.
The strongest repeated style patterns are the metric-reporting rhythm ("reads," "holds," "stays" plus a number), the evaluative use of "honest," and the three separate statements of the conformal correction's status.
The strongest structural defects are the orphan conformal sentence at line 19 and the vague appendix sentence at line 22.
The future-work section is clear but only partly grounded in Ch6's limitations; classroom scope is new, and the replay caveats and the thin met-class are not carried forward.
These observations do not establish whether the text was written by a human, an AI, or a combination.

## 3. Findings table

Confidence is confidence that the stated textual pattern is present, not confidence about authorship.
Priority reflects writing-review impact.

### 3a. Stylistic findings

| ID | Location | Exact excerpt | Observable pattern | Why it merits review | Plausible non-AI explanation | Confidence | Priority | Recommended action |
|---|---|---|---|---|---|---|---|---|
| S1 | `07-conclusion.tex:5, 11, 26` | `honest nulls` (5); `honest terminal` (11); `honest next step` (26) | Evaluative "honest" used three times as a label | Adds self-praise, not information; "honest nulls" is imported from Ch6:109 | The author is echoing the Ch6 discussion's framing | High | Medium | Replace each with the specific result: "a null on recovery error and change detection," "a refusal, not a failure," "a real single-learner study is the next step." |
| S2 | `07-conclusion.tex:5, 19, 24` | `validated but unshipped` (5); `validated but unshipped refinement` (19); `validated refinement` (24) | The conformal correction's status is stated three times in 30 lines | Redundant restatement; line 5 and line 19 say the same thing, and line 24 says it again | A conclusion may repeat the key deferred item | High | Medium | State it once, at line 19 or line 24; cut the other two. |
| S3 | `07-conclusion.tex:9-17` | `Bkt-v1 reads 0.7397 against 0.7368 for the running proportion over 282 observations, with ECE at 0.1401 against 0.2679.` | Six result paragraphs use the same [metric + verb + number] rhythm, with "reads," "holds," and "stays" dominating | Reads like a table in prose; the chapter follows Ch6's section order (retrieval, generation, tracing, live, loop, synthetic) | Results recaps in engineering reports are conventionally number-dense | High | High | Replace two or three recaps with synthesis claims; keep one table-anchored paragraph per result family. |
| S4 | `07-conclusion.tex:11` | `The judge scores whether the cited chunk supports the answer, while gold support scores whether the citation contains the gold string.` | Verbatim sentence from Ch6:34 | Redundant restatement; the conclusion adds no interpretation | The author copied the clarifying sentence to preserve precision | High | Medium | Cut or compress to "the two metrics measure different things" and use the space for interpretation. |
| S5 | `07-conclusion.tex:19` | `The only validated but unshipped refinement is the split-conformal correction.` | Orphan sentence after the synthetic replay | No transition; repeats line 5 and previews line 24 | The sentence may have been moved from the Phase I paragraph | High | High | Move to line 5 or delete; keep one statement and connect it to future work. |
| S6 | `07-conclusion.tex:13` | `The update stays as Equation~\ref{eq:bkt-update} with the shipped filter in Listing~\ref{lst:bktforward}.` | Implementation pointer in the conclusion | Equation and listing references do not conclude anything | The author may be closing the BKT recap by pointing to the mechanism | High | Low | Cut; the equation and listing belong in Ch2 and Ch5. |
| S7 | `07-conclusion.tex:22-30` | `The first is to ship the validated refinement` | Four short ordinal paragraphs | Uniform rhythm; each item gets one or two sentences and no development | A four-item future-work list is a normal convention | High | Low | Keep the four items but write them as one or two paragraphs with rationale and dependency. |
| S8 | `07-conclusion.tex:17` | `Hook checks pass 37 of 37 and feedback checks pass 77 of 77.` | Unexplained test counts | Mixes code verification with study results; the reader cannot tell what a hook or feedback check is | The author is recording the verification gate | High | Low | Move to Ch5 or Ch6, or define the checks in one clause. |
| S9 | `07-conclusion.tex:9, 13` | `int8 quantisation` (9); `Bkt-v1 reads` (13) | British spelling and sentence-initial capitalization of the project term `bkt-v1` | The task rule says American spelling; the project term is `bkt-v1` | Sentence-initial capitalization is conventional; Ch6 also uses `Bkt-v1` at sentence start | High | Low | Use `quantization`; keep `bkt-v1` unless sentence-initial capitalization is a deliberate style. |

### 3b. Citation and evidence findings

| ID | Location | Exact excerpt | Observable pattern | Why it merits review | Plausible non-AI explanation | Confidence | Priority | Recommended action |
|---|---|---|---|---|---|---|---|---|
| E1 | `07-conclusion.tex:7` | `assessment-based verification of genuine learning` | Learning claim stronger than the evidence | Ch6 measures graded performance, not learning gain; Ch6:104 calls the zero "not a learning result," and the mastery rows measure scripts | The phrase is the project's framing in Ch1 and the abstract, so it may be a term of art | High | High | Replace with "assessment-based verification of graded evidence" or "assessment-verified planning"; define what would count as learning gain and state that it is not measured. |
| E2 | `07-conclusion.tex:7` | `The principal novelty is the verified-learning closed loop` | Novelty claim without closest prior work or comparison | Ch2:80 says the survey used advisor-guided curation with citation chaining, not a fresh database sweep; Ch2:85 says "None forms a closed loop" but names no closest system; "principal" ranks contributions without a basis | The author may mean "the project's main contribution," not a field-first claim | High | High | Scope to "the project's main contribution"; name the closest prior system and the comparison; hedge with "to the best of my knowledge" only if a closest-work check supports it. |
| E3 | `07-conclusion.tex:7` | `from logged time to graded evidence` | Mischaracterizes the cited work | Ch2:42 says `islam2024` uses predicted grades for scheduling, not logged time; the extension is from predicted grades or from Phase I's logged time, not from the cited system's input | The author may be compressing "Phase I logged time to Phase II graded evidence" into the citation | High | Medium | Rewrite: "extends the predict-then-optimize idea from predicted grades to graded evidence from the learner's own answers"; attribute the logged-time contrast to Phase I, not to `islam2024`. |
| E4 | `07-conclusion.tex:7` | `Logged time stays gameable~\cite{gaming2026}, so the plan responds to graded evidence.` | Non sequitur and citation-scope mismatch | Gameability of time does not establish that graded evidence is not gameable; Ch2:55 says help-seeking itself can be gamed and the cited source separates genuine attempts from tutor answer extraction; the source's exact scope needs verification | The author may be using "gameable" loosely to mean "self-reported" | High | High | Rewrite the rationale: logged time is self-reported and cannot evidence understanding; graded responses come from a server-authoritative arm, with the guidance ladder gating the answer, though help-seeking can still be gamed (`gaming2026`). Verify the source's scope before keeping the citation. |
| E5 | `07-conclusion.tex:17` | `every replan extends the deadline` | Universal claim from four synthetic archetypes | The evidence is 4/4 synthetic replays, all `extend-deadline`; "every" reads as a system property | The author is reporting the replay result in shorthand | High | High | "All four synthetic replays extended the deadline" or "each of the four post-fix replays chose extend-deadline." |
| E6 | `07-conclusion.tex:19` | `The only validated but unshipped refinement is the split-conformal correction.` | Absolute "only" | Phase-I Ch6:130 reports the DP allocator as "a genuine win" the system does not act on; it is a validated result not shipped, though not a refinement to a shipped component | The author may be restricting "refinement" to a correction of a shipped component | Medium | Medium | Qualify: "the only validated refinement to a shipped component that remains unshipped"; acknowledge the DP allocator separately or explain why it is not a counterexample. |
| E7 | `07-conclusion.tex:15` | `The full-book path reaches ready in about 88~s for the 572-page fixture, with zero console errors.` | Timing figure mislabelled, and an unverified error claim | The evidence table shows ready at 101 s since upload start; the JSON wall shows 101.406 s from start and 87.849 s from created; the full-book doc records no console-error check | The source doc itself says "Start-to-ready wall: ~88 s," which is internally inconsistent; the canonical ingestion spec asserts zero console/page errors | High | Medium | Say "about 88 s from created to ready (101 s from upload start)"; verify the console-error claim from the run log or delete it. Fix the source doc's wall label. |
| E8 | `07-conclusion.tex:19` | `The dip-window replay holds 4 of 4 at 0.28 to 0.35 in the trough and converts on the rebound eve at 1.0.` | Misattributes the rebound-eve conversion | The dip-window doc records 4 holds and cites the Oct-14 prior evidence for the 1.0 conversion; the dip-window replay itself converted nothing | The author is summarizing the whole gradient in one sentence | High | Medium | "The dip-window replay holds 4 of 4 at 0.28 to 0.35; the separate Oct-14 rebound-eve run converts at 1.0." |
| E9 | `07-conclusion.tex:19` | `Capture ran one day before the deadline, so the zero reflects timing.` | Causal claim stronger than the evidence | Ch6:104 says the zero is a measured zero with a caveat, not a learning result; "reflects timing" infers the cause from the capture date | The capture date makes the timing explanation plausible | Medium | Medium | "The zero is a capture artifact: the run ended one day before the deadline, so no post-replan sessions could be logged." Keep it as a measurement caveat, not a causal finding. |
| E10 | `07-conclusion.tex:19` | `the full 24-row emission` | Miscounts the appendix table | Appendix `tab:app-adherence` has 4 user rows and 6 week columns (24 values); Ch7 calls it 24 rows | The author means 24 adherence values | High | Low | "the full 24-value adherence table" or "per-week adherence for all four users." |
| E11 | `07-conclusion.tex:22` | `Table rows in Appendix~\ref{ch:appendix} remain the reproducibility base for the work below.` | Vague xref, unsupported reproducibility claim, and guide violation | The appendix holds adherence, verdict instants, and the DDIA question table, but not the versioned harness or `eval_golds.json` that Section 5.4 names; the guide requires a numeric `Table~\ref`; the linter flags guide-xref | The author may be pointing to the DDIA gold table as the closest artifact | High | High | Delete or replace with "Section 5.4 records the versioned artifacts that make both legs reproducible. The appendix carries the full adherence and verdict tables." If a table is meant, cite it by number. |
| E12 | `07-conclusion.tex:9` | `Title-prefix indexing shows no gain, and int8 quantisation collapses to 0.10.` | Split label missing or mismatched | Both rejected arms come from the retired 788-split program (2026-08-15), not the coherent 754 split; the paragraph presents them after 754 results | The author is listing all rejected retrieval arms regardless of split | High | Medium | Label the split: "On the retired 788 split, title-prefix indexing showed no gain and int8 quantisation collapsed to 0.10." Or omit from the 754 recap. |
| E13 | `07-conclusion.tex:24-30` | `The fourth is classroom scope` | Future-work item not grounded in Ch6's limitations | Ch6:115 lists single learner/synthetic, one difficulty question, and the four replay caveats; classroom scope is a new extension, and Ch1:39 puts multi-user/institutional settings out of scope; the thin met-class (2 pairs) and training/test contradiction are not addressed | The author is sketching a longer-term direction beyond the thesis | Medium | Medium | Tie each item to a named Ch6 limitation; justify classroom scope as a separate long-term direction or drop it; add the thin met-class or open replay caveats if they are real open items. |
| E14 | `07-conclusion.tex:26` | `the static baseline` and `measured learning gain` | Undefined comparator and outcome | Neither term is defined in Ch6 or Ch1; a future-work item can defer detail, but the conclusion should name the comparator and the measure | The author assumes the Phase-I fixed-plan baseline is known | Medium | Medium | Define "the fixed-plan baseline" and "a pre/post or delayed assessment of learning gain"; name the measure or mark it as to be designed. |
| E15 | `07-conclusion.tex:9` | `with ranking parity on the dense baseline` | Ambiguous and possibly contradictory phrase | The table shows rerank MRR 0.797 against dense 0.706; "parity" is not the claim, though the dense and hybrid arms do reproduce their recorded baselines | The author means the dense arm reproduces its recorded baseline exactly | Medium | Medium | Say "with the dense and hybrid arms reproducing their recorded baselines" or "with gains over dense on both corpora." |

## 4. Sentence-level review

| ID / location | Original sentence or short excerpt | Issue category | Diagnosis | Suggested revision or question | Rationale |
|---|---|---|---|---|---|
| SL1 `07-conclusion.tex:5` | `It estimated pace with Bayesian calibration and enriched shrinkage, and it flagged shifts with CUSUM.` | A, predictable variation | The Phase I recap repeats "It ... and it ..." and then "It projected ... and it regenerated" | Combine the first two clauses: "Phase I combined a Bayesian pace estimate and enriched shrinkage with CUSUM shift detection. It projected completion with a Gaussian process and a cold-start composite. It then regenerated the plan with capacity bookings." | Preserves the facts and breaks the parallel openings. |
| SL2 `07-conclusion.tex:5` | `Evaluation reported honest nulls with the wins` | C, generic evaluative phrasing | "Honest" labels the author's reporting rather than the result; "the wins" is unspecified | "Evaluation reported nulls on retrospective recovery error and change detection, and wins on prospective calibration and scheduling." | Names the nulls and wins; the reader learns what happened. |
| SL3 `07-conclusion.tex:7` | `Phase~II closed the loop with assessment-based verification of genuine learning.` | H, claim-evidence | Ch6 measures graded performance, not learning gain | "Phase II closed the loop with assessment-based verification of graded evidence. Whether that evidence reflects learning gain is not measured here." | Matches the evidence and makes the limit explicit. |
| SL4 `07-conclusion.tex:7` | `The principal novelty is the verified-learning closed loop` | C/H, novelty | "Principal" ranks the contributions; no closest prior work or comparison is named | "The project's main contribution is an assessment-verified planning loop. The closest prior work is [name], which [does X but not Y]." | Turns a field claim into a project claim and gives the reader the comparison. |
| SL5 `07-conclusion.tex:7` | `Logged time stays gameable~\cite{gaming2026}, so the plan responds to graded evidence.` | H/F, logic and citation | Gameability of time does not establish that grades are trustworthy; the cited source is about help-seeking gaming | "Logged time is self-reported and cannot evidence understanding. Graded responses come from a server-authoritative arm, with the guidance ladder gating the answer, though help-seeking can still be gamed (`gaming2026`)." | Replaces the non sequitur with the design rationale and gives the citation its proper scope. |
| SL6 `07-conclusion.tex:9` | `with ranking parity on the dense baseline` | E, specificity | The table shows a gain over dense (0.797 against 0.706), not parity | "with the dense and hybrid arms reproducing their recorded baselines" | Describes what the harness check actually establishes. |
| SL7 `07-conclusion.tex:11` | `The judge scores whether the cited chunk supports the answer, while gold support scores whether the citation contains the gold string.` | B, redundancy | Verbatim from Ch6:34 | Cut; the preceding sentence already says the metrics measure different things. | The conclusion should interpret, not re-explain the metric definitions. |
| SL8 `07-conclusion.tex:11` | `A fresh live pull derives at 0.5349 and passes the 0.5 gate.` | E, specificity | Drops the denominator and the refused materials | "A fresh live pull derives at 0.5349 over 43 judged attempts, passing the 0.5 gate." | The denominator is needed to read a four-decimal rate. |
| SL9 `07-conclusion.tex:13` | `The update stays as Equation~\ref{eq:bkt-update} with the shipped filter in Listing~\ref{lst:bktforward}.` | G, implementation residue | Equation and listing pointers do not belong in a conclusion | Cut. | The mechanism is already established in Ch2 and Ch5. |
| SL10 `07-conclusion.tex:15` | `The full-book path reaches ready in about 88~s for the 572-page fixture, with zero console errors.` | H, evidence | The 88 s figure is created-to-ready; the table reads 101 s from upload start | "The full-book path moves from created to ready in about 88 s (101 s from upload start) for the 572-page fixture." Verify the console claim separately. | Removes the timing ambiguity. |
| SL11 `07-conclusion.tex:17` | `and every replan extends the deadline over a 32-day span` | H, generalization | The evidence is four synthetic archetypes | "and all four synthetic replays extended the deadline over a 32-day span." | Scopes the universal to the sample. |
| SL12 `07-conclusion.tex:17` | `Hook checks pass 37 of 37 and feedback checks pass 77 of 77.` | E, specificity | The reader cannot tell what a hook or feedback check is | "The repository's hook and feedback test suites pass 37 of 37 and 77 of 77." Or move to Ch6. | Gives the counts a referent. |
| SL13 `07-conclusion.tex:19` | `The dip-window replay holds 4 of 4 at 0.28 to 0.35 in the trough and converts on the rebound eve at 1.0.` | H, evidence boundary | The dip-window run produced holds; the 1.0 conversion is prior Oct-14 evidence | Split: "The dip-window replay holds 4 of 4 at 0.28 to 0.35. The separate Oct-14 rebound-eve run converts at 1.0." | Keeps the two runs distinct. |
| SL14 `07-conclusion.tex:19` | `The only validated but unshipped refinement is the split-conformal correction.` | B/H, redundancy and absolute | Orphan sentence; repeats line 5; "only" is contestable | Move to line 5 or delete; qualify as "the only validated refinement to a shipped component." | Removes the non sequitur and the unearned absolute. |
| SL15 `07-conclusion.tex:22` | `Table rows in Appendix~\ref{ch:appendix} remain the reproducibility base for the work below.` | F/G, citation and guide | Vague xref; the appendix is not the reproducibility contract | Replace with "Section 5.4 records the versioned artifacts that make both legs reproducible. The appendix carries the full adherence and verdict tables." | Fixes the linter and states the actual base. |
| SL16 `07-conclusion.tex:26` | `A single learner over one term gives the honest next step beyond synthetic histories.` | C, evaluative filler | "Honest" is the third such label; the sentence adds no design detail | "A single-learner study over one term is the next step beyond synthetic histories." | Removes the self-evaluation while keeping the scope. |

## 5. Chapter-level pattern map

**Pattern family A, results-recap template.**
Lines 9-19 contain six paragraphs with the same shape: a table or metric claim, two or three numbers, and a caveat.
The paragraph order follows Ch6's section order exactly: retrieval, generation, tracing, live verification, loop verdict, synthetic replay.
The pattern is repeated, not isolated.
The strongest example is the tracing paragraph at line 13, which packs four metric pairs into five sentences.
The highest-value revision is to cut the recap by half and keep one table-anchored paragraph per result family.

**Pattern family B, evaluative shorthand.**
"Honest" appears at lines 5, 11, and 26; "validated" or "validated but unshipped" at lines 5, 19, and 24; "real wins" is imported from Ch6:109.
The pattern is repeated and gives the chapter a self-congratulatory register without adding information.
The strongest example is "honest nulls with the wins" at line 5.
The highest-value revision is to replace each label with the named null or win.

**Pattern family C, near-verbatim Ch6 reuse.**
Line 11 reuses Ch6:34 verbatim; line 13 compresses Ch6:57 closely; line 15 compresses Ch6:77; line 17 compresses Ch6:82; line 19 compresses Ch6:102-104.
The pattern is repeated across five paragraphs.
Some recap is conventional in a conclusion, but verbatim sentences and the same paragraph order make the chapter a summary of Ch6 rather than a conclusion on it.
The strongest example is line 11.
The highest-value revision is to keep the numbers, discard the copied explanations, and write new synthesis sentences.

**Pattern family D, ordinal future-work template.**
Lines 22-30 are four short ordinal paragraphs, each opening "The first is ... The second is ..." and so on.
The pattern is repeated four times.
This is readable and conventional, but it leaves no room for rationale, dependency, or feasibility.
The highest-value revision is two paragraphs: one for the two near-term items (conformal, difficulty calibration) and one for the two longer-term items (real-learner validation, classroom scope).

**Pattern family E, transition gaps.**
The synthetic-replay paragraph ends with the conformal sentence at line 19, which has no connection to the replay; the future-work section then opens with the appendix sentence at line 22.
The gap is isolated but high-impact because it is the chapter's only transition into future work.
The highest-value revision is to end Section 7.1 with a synthesis sentence and open Section 7.2 with the actual basis for the four items, not the appendix.

## 6. Academic integrity and evidence checks

### Citation and reference integrity

- `islam2024` exists in `main.tex:162`.
  Ch2:42 says the study uses predicted grades for scheduling, not logged time.
  Ch7:7 says the architecture extends from logged time to graded evidence, which misattributes the input.
  This needs correction, not a new citation.
- `gaming2026` exists in `main.tex:179`.
  Ch2:55 says the study separates genuine attempts from moves that extract answers from the tutor, which is help-seeking gaming, not logged-time gaming.
  Ch7:7 uses it to support the claim that logged time stays gameable and then infers that graded evidence is trustworthy.
  The inference is a non sequitur even if the citation fits; the source's exact scope needs verification.
- The novelty claim at line 7 has no citation or named comparator.
  Ch2:80 says the survey used advisor-guided curation with citation chaining, not a fresh database sweep; Ch2:85 says "None forms a closed loop."
  That supports a gap claim, not a field-first "principal novelty" claim.
- `Table~\ref{tab:res-retrieval}`, `Table~\ref{tab:res-verdict}`, `Equation~\ref{eq:bkt-update}`, `Listing~\ref{lst:bktforward}`, and `Appendix~\ref{ch:appendix}` all resolve to existing labels.
  The appendix xref is the only guide violation.
- The `gaming2026` bibliography entry has no authors (`main.tex:179`).
  This needs verification against the source record.
- No placeholder, TODO, "verify citation," or editorial note was found in the chapter.

### Number verification

Verified against Ch6 and the dated evidence: 0.60 to 0.67, 0.47 to 0.63, 0.077, 0.139, 0.813, 0.8667, 0.7803, 0.9611, 0.9133, 0.5349, 0.5, 0.7397, 0.7368, 282 observations, 0.1401, 0.2679, 0.785, 0.057, 0.602 to 0.611, 23 observations, 2/2, 4/4, 3/3, 4/4 conversion, 1.0 confidence, 0.66 to 0.77 sufficiency, 32 days, 0.18 to 0.34 pre-fix, 0.9/0.7 gate, 37/37, 77/77, 0.000 adherence, 0.28 to 0.35 trough, 1.0 rebound, and 572 pages.

Flagged items:

- `0.10` is the correct value but comes from the retired 788 split (`research/doc/2026-08-15-retrieval-quality-program-results.md:17`), not the 754 split.
  The same paragraph presents it after 754 results with no split label.
- `88 s` is created-to-ready (87.849 s in `2026-10-22-fullbook-e2e-timing.json`).
  The same evidence table shows ready at 101 s from upload start, and the JSON wall shows 101.406 s.
  Ch7 says "reaches ready in about 88 s" without the start point.
- `24-row emission` is 24 values in a 4-row by 6-column table, not 24 rows.
- `zero console errors` is not recorded in the full-book evidence doc or JSON.
  The canonical ingestion spec asserts zero console and page errors (`e2e/material-ingestion-live.spec.ts:50-57, 294`), so the claim is plausible but needs verification from the deleted temporary spec or its log.
- `every replan` is 4/4 synthetic replays, not a universal.
- `only validated but unshipped refinement` is contested by Phase-I Ch6:130, which reports the DP allocator as a genuine win the system does not act on.
- `genuine learning` has no measure in Ch6.
- `principal novelty` has no closest-prior comparison.

### Claim-evidence checks

- Line 7, genuine learning: Ch6:104 says the zero adherence is "not a learning result," and the mastery rows "measure the scripts"; Ch6:57 says difficulty calibration is unmeasured.
  The claim is stronger than the evidence.
- Line 7, principal novelty: no named comparator; the Ch2 gap claim is not a novelty proof.
- Line 7, `islam2024`: mischaracterized input, as above.
- Line 7, `gaming2026`: non sequitur and likely scope mismatch, as above.
- Line 17, every replan: four synthetic archetypes, not a general property.
- Line 19, only: the DP allocator is a validated result not shipped, so the absolute needs a scope.
- Line 19, dip-window: the rebound-eve conversion is prior Oct-14 evidence, not the dip-window replay.
- Line 19, zero reflects timing: Ch6 says measured zero with a caveat, not a causal result.
- Line 22, reproducibility base: Section 5.4 is the reproducibility contract; the appendix holds results and the DDIA gold table.
- Lines 24-30, future work: misses the four replay caveats and the thin met-class; classroom scope is new and contradicts Ch1:39's out-of-scope statement.
- Line 26, static baseline and measured learning gain: both undefined.

### Cross-document consistency

- `main.tex:129` still says "true study pace," "calibrated uncertainty band," "genuine learning," and "realized."
- `01-introduction.tex:14` and `01-introduction.tex:37` still say "genuine learning."
- `01-introduction.tex:7` removed "calibrated" ("with an uncertainty band"), but `03-requirements.tex:58` still says "calibrated uncertainty band."
- Phase-I Ch6:108 says the shipped projection interval is under-covering past the cold-start threshold and the conformal correction is unshipped, so "calibrated uncertainty band" is an overclaim in the abstract and Ch3.
- The brief says Ch1 was revised to remove the calibrated and genuine overclaims.
  The bytes show the revision is incomplete: Ch1 still has "genuine learning" twice and "realized" twice, Ch3 still has "calibrated uncertainty band," and the abstract has all four phrases.
- This is a document-level finding; Ch7's "genuine learning" is consistent with Ch1 and the abstract but inconsistent with Ch6's evidence.

## 7. Prioritized action list

### 1. Fix before submission

- E1: replace "genuine learning" with "graded evidence" or "assessment-verified planning"; define learning gain or state that it is not measured.
- E4: rewrite the gameable-time sentence around the actual design rationale (self-report versus gated, server-authoritative grades), and verify `gaming2026`'s scope.
- E2: scope "principal novelty" to the project and name the closest prior work and comparison.
- E11: delete or replace the appendix reproducibility sentence; fix the guide-xref at line 22.
- E5: scope "every replan" to the four synthetic replays.
- E7: correct the 88 s start point and verify or delete the zero-console claim.

### 2. Improve scholarly argument

- E3: correct the `islam2024` input.
- E6: qualify "only" or acknowledge the DP allocator.
- E8: separate the dip-window holds from the Oct-14 rebound-eve conversion.
- E9: state the zero as a capture artifact, not a causal finding.
- E12: label the 788-split rejected arms or remove them from the 754 recap.
- E13: ground each future-work item in a Ch6 limitation; justify or drop classroom scope.
- E14: define the static baseline and the learning-gain measure.
- E15: replace "ranking parity on the dense baseline" with the harness check the table supports.

### 3. Improve style and reduce redundancy

- S1: replace the three "honest" labels with the named nulls and wins.
- S2: state the conformal status once.
- S3: replace two or three result recaps with synthesis.
- S4: cut the verbatim Ch6 sentence.
- S5: move or delete the orphan conformal sentence.
- S6: cut the equation and listing pointer.
- S8: move or define the hook and feedback test counts.

### 4. Optional polish

- S7: merge the four ordinal future-work paragraphs into two.
- S9: use "quantization" and keep `bkt-v1` stable.
- E10: say "24 adherence values," not "24-row emission."
- Add denominators where they are cheap: 43 judged attempts for 0.5349, 26 of 30 for 0.8667, n=180 for the generation aggregate.

## 8. Overall conclusion

The chapter is surface-clean and most of its numbers are accurate.
Its problems are structural and evidentiary: it re-reports Ch6 instead of concluding, and its three-sentence justification at line 7 claims more than the results support.
The highest-value revision is to cut the recap by half, keep the exact numbers as anchors, and write one synthesis paragraph that says what the loop demonstrates and what it does not.
This is a qualitative review, not a validated AI detector, and it cannot establish authorship or misconduct.

## 9. Writing-review priority

Writing-review priority: 3.
This is not an AI-likelihood score.
It reflects the claim-evidence problems at line 7, the redundant recap, and the guide violation at line 22, all of which affect submission readiness.

## 10. Resolution (2026-10-23)

All P0, P1, and P2 rows applied from evidence-backed author defaults (Q-16 to Q-20 answered in the plan record).
Line 7 now uses `graded evidence`, the project-scoped contribution, predicted-grades input, and the self-report rationale; every replan is scoped to the four synthetic replays; 88 s is created-to-ready with the console claim deleted; the dip-window holds and the Oct-14 conversion are separate runs; future work is tied to Ch06 limits in two paragraphs; `honest` labels and the verbatim Ch06 sentence are gone; the appendix sentence names Section 5.4 and fixes the guide-xref.
Final lint: STE PASS, Humanizer PASS.
Grill follow-up: Batch 6 approved and applied (abstract, Ch01, Ch03 thesis terms; `gaming2026` authors plus venue plus `Analyzing`). Nothing open in this chapter.
