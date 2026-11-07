# AI Writing Pattern Audit

## 1. Scope

- Material reviewed: `college/mydeliverables/Phase-2-report/phase2-report/chapters/01-introduction.tex`, all 32 lines, 1,011 words by `ste_check.py`.
- Coverage: the full chapter (opening roadmap, Sections 1.1 to 1.5, all seven objectives). The Phase I recap was checked against `phase1-report/chapters/01-introduction.tex`, `04-methodology.tex`, and `06-results.tex`.
- Context reviewed: `phase2-report/main.tex` (abstract, bibliography, chapter order), `college/mydeliverables/REPORT_WRITING_GUIDE.md`, `chapters/02-literature-survey.tex`, and `chapters/03-requirements.tex`.
- Genre/discipline: M.Tech dissertation introduction, Data Science and Artificial Intelligence, applied system-building report.
- Limitations of the supplied material: external sources (`chen2024`, `alhazbi2024`, `islam2024`) were not opened, so their external accuracy is marked "needs verification". No external detector report, drafts, or version history was supplied. The compiled PDF was not inspected for rendered layout. The Phase I check covers three Phase I chapters, not the whole Phase I report.

## 2. Executive assessment

The chapter is coherent and often technically specific, but its Phase I recap contains four independent statements that are stronger than the Phase I evidence: a "calibrated" uncertainty band, "genuine" pace shifts, a fixed-rate win that appears "only after enough sessions", and "each part" being "realized in the application".
Those are claim-evidence problems, not style preferences, and they matter because the Phase I results chapter reports an under-covering interval, a CUSUM false-alarm rate near 0.30, a short-history win for the selected calibrator, and a deliberately unshipped schedule allocator.
Section 1.2 adds two citation-claim stretches, and Section 1.3 contains one wrong cross-reference and one frequency inconsistency.
The prose has two very long paragraphs (15 and 13 sentences) with runs of short "It ..." declaratives; this is a readability and rhythm pattern, not authorship evidence.
All three citation keys resolve, no placeholder or TODO residue is present, and the chapter map is accurate except for the `4.3` gate reference.
These observations do not establish whether the text was written by a human, AI, or a combination.

## 3. Findings table

Confidence in this table means confidence that the stated textual pattern is present, not confidence that AI generated it.

| ID | Location | Exact excerpt | Observable pattern | Why it merits review | Plausible non-AI explanation | Confidence | Priority | Recommended action |
|---|---|---|---|---|---|---|---|---|
| F1 | `01-introduction.tex:5` | "with a calibrated uncertainty band" | Asserts the delivered projection was calibrated. | Phase I `06-results.tex:70` reports raw GP coverage of 0.183 to 0.494 across both regimes against a nominal 0.95. Phase I `06-results.tex:108` says the conformal correction was validated but not shipped, so the delivered interval under-covers past cold start. | A recap compressing the Phase I objective ("calibrated band") into an achievement. | High | High | Delete "calibrated", or state the under-coverage and the unshipped correction. |
| F2 | `01-introduction.tex:5` | "It flagged genuine shifts in pace" | "Genuine" asserts detector precision. | Phase I `06-results.tex:57` reports CUSUM false-alarm rates of 0.312 (step) and 0.296 (drift). Phase I `06-results.tex:67` says a detected shift raises a recalibration prompt, not an automatic replan. | Shorthand for "detected shifts", or a reference to the human-confirmed design. | High | High | "Candidate shifts", or "pace shifts for learner confirmation". |
| F3 | `01-introduction.tex:5` | "beat the fixed-rate baseline only after enough sessions had accumulated to move the posterior" | A generic Bayesian cold-start story presented as a Phase I finding; repeated in `02-literature-survey.tex:18`. | Phase I `06-results.tex:17-20` shows enriched-shrinkage at 0.049 against moving average at 0.094 on the short band, 0.049 against 0.100 medium, and 0.056 against 0.090 long. Phase I `04-methodology.tex:40` says the shrinkage model behaves sensibly with few sessions. | Reasoning from Bayesian behavior rather than the results table; the author may have a different baseline or metric in mind. | High | High | Restate the actual Phase I result, or delete the clause; reconcile `02-literature-survey.tex:18`. |
| F4 | `01-introduction.tex:5` | "with hierarchical Bayesian calibration~\cite{chen2024}" | Names the incumbent as the estimator and drops the selected enriched-shrinkage model. | Phase I `06-results.tex:25` says the enriched-shrinkage calibrator was selected; Phase I `06-results.tex:5` calls hierarchical Bayesian the incumbent. Phase II `02-literature-survey.tex:7` says Chen supplies prior structure, not the updater. | Phase I's own objective phrase was "hierarchical Bayesian calibration with a context-aware shrinkage model"; the recap inherits the compression. | High | Medium | Name enriched-shrinkage, or say "Bayesian calibration with a shrinkage model"; keep `chen2024` for prior structure. |
| F5 | `01-introduction.tex:5` | "The comparison reported its nulls honestly." | Self-evaluative meta-claim. | It tells the reader what to conclude, and the specific nulls follow immediately; it also sits beside the overclaims in F1 to F3. | Phase I's own "honest nulls" voice and the writing guide's emphasis on honest reporting. | High | Medium | Delete it, or replace it with "Two results were nulls:" and the specifics. |
| F6 | `01-introduction.tex:5` | 15-sentence paragraph | One paragraph carries the whole Phase I recap, with a run of "It flagged / It projected / It regenerated / The comparison used / The comparison reported". | STE-6.6 flags the paragraph. The linter's 25-word row on this line is a quote-boundary artifact caused by the period inside ``date.''``, not a separate defect. | A compact recap with deliberate parallelism. | High | Medium | Split after sentence 4 and after sentence 9 into paragraphs of four, five, and six sentences. |
| F7 | `01-introduction.tex:8` | "It generates grounded assessments from the learner's own materials." | First of four consecutive "It ..." openings in a 13-sentence paragraph: generates, grades, tracks, feeds. | STE-6.6 flags the paragraph; the four parallel sentences are harder to scan than a list. | The four components are a real parallel list; anaphora may be deliberate emphasis. | High | Medium | Split the problem statement from the Phase II response; convert the four "It" sentences into one list or vary the subjects. |
| F8 | `01-introduction.tex:8` | "The static generators surveyed here do not revise the plan against grade evidence~\cite{islam2024}." | Mislabels the cited study as a static generator. | `02-literature-survey.tex:38` calls `islam2024` a "prediction-then-optimize study" that reports 0.73 grade-prediction accuracy before scheduling. That is a different category from a static generator. | Shorthand for the scheduled or prediction tools surveyed; a compression of two categories. | High | Medium | "The prediction-then-optimize study surveyed in Section 2.3 does not revise the plan against grade evidence", or cite an actual static-generator source. External accuracy needs verification. |
| F9 | `01-introduction.tex:8` | "Time-tracking applications record hours without judging understanding~\cite{alhazbi2024}." | Citation stretch. | `02-literature-survey.tex:45` uses Alhazbi as a review of 25 self-regulated-learning studies, with most validated indicators tied to time management. It supports a measurement-indicator claim, not a claim about the capabilities of time-tracking applications. | The review's time-management finding is being used as proxy evidence for a tool gap. | Medium | Medium | Soften to "Learning-analytics measures of self-regulated learning lean on time-management traces~\cite{alhazbi2024}", or find a tool-specific source. External accuracy needs verification. |
| F10 | `01-introduction.tex:8` | "The missing piece is assessment-based verification of genuine learning." | Field-wide gap or novelty claim with no citation and no scoped referent. | "Missing" could mean in Phase I or in the literature. `02-literature-survey.tex:100-102` does the gap analysis. As written, the sentence implies no existing tool performs this verification. | Shorthand for the project's gap; the author knows the intended scope. | High | Medium | "The missing piece in the Phase I system is...", or "The gap this project addresses is..." with a cross-reference to Section 2.6. |
| F11 | `01-introduction.tex:8` | "Grades then drive the decision to stay the course or to replan." | Compression that skips mastery and the verdict gate. | `04-methodology.tex:9` says grades steer mastery, mastery and posture steer the verdict, and the verdict steers the plan. The sentence makes grades the direct cause. | A one-sentence summary of a multi-stage loop. | High | Medium | "Grades update mastery, and the mastery verdict drives...", or add "through mastery". |
| F12 | `01-introduction.tex:19` | "The reveal gate enforces this: the final step stays locked until the learner confirms." | Restates the item lead and repeats the ladder names. | The lead already says "a Socratic ladder and a gated reveal"; the explanation adds only the confirmation step. The rationale for gating is in `02-literature-survey.tex:49`. | Self-contained objective items help skimming. | High | Low | Replace the restatement with the rationale, or keep only the confirmation-step detail. |
| F13 | `01-introduction.tex:21` | "on each graded attempt" against "for entries whose grades changed" | Frequency inconsistency within one objective. | `03-requirements.tex:62` says "on updated results only"; `04-methodology.tex:24` says "for updated entries"; `05-implementation.tex:61` describes the same feedback-copy endpoint. The lead overstates the frequency. | "Each graded attempt" is shorthand for the attempt flow; the qualifier follows. | High | Medium | "Return advisory feedback copy on updated results." |
| F14 | `01-introduction.tex:13` | "A mixed run alternates the family per call, so every question stays traceable to the material it tests." | Non sequitur: alternation is offered as the cause of traceability. | Traceability comes from grounding and recorded citations. `04-methodology.tex:15` separates the two design choices. | Loose "so" connecting two co-designed features. | High | Medium | "A mixed run alternates the family per call; grounding and recorded citations keep every question traceable..." |
| F15 | `01-introduction.tex:25` | "(see Sections~4.3 and 6.3)" | One of the two cross-references is wrong. | `04-methodology.tex:49` is Section 4.3, "Comparison Methodology". The gate constant `LOOP_APPROVE_AT` is in Section 4.2.5, "Loop Verdict" (`04-methodology.tex:26-27`). Section 6.3, "Closed-Loop Decision", is correct. | Section renumbering during the modular split; 4.3 may have been the loop section in an earlier draft. | High | High | "Sections~4.2.5 and 6.3". |
| F16 | `01-introduction.tex:25` | "learner posture" and "with its identity attached" | Terminology drift and undefined terms. | `04-methodology.tex:7` says the endpoint reads "the schedule posture". `05-implementation.tex:40` and `06-results.tex:102` use "posture" for the synthetic archetype's known behavior. `04-methodology.tex:7` and `06-results.tex:82` call the carried object a "verdict pair", not an "identity". | "Learner posture" may be a deliberate third input; "identity" is shorthand for the verdict pair's identifiers. | High | Medium | Align to "schedule posture", or define "learner posture"; say "with its verdict pair attached". Verify the endpoint's actual inputs. |
| F17 | `01-introduction.tex:29` | "Each part was compared offline against baselines and realized in the application." | Recap overclaim. | Phase I `06-results.tex:130` calls the dynamic-programming allocator "the one component result the delivered system does not act on". Phase I `04-methodology.tex:49` says "The delivered system does not use it." The shipped scheduler is the capacity-based booking model. | "Each part" may mean each component family, with the selected model realized; the sentence compresses the distinction. | High | High | "Each part was compared offline against baselines, and the selected models were realized; the schedule-generation comparison informed the capacity-based redesign rather than shipping the evaluated allocator." |
| F18 | `01-introduction.tex:29` | "The synthetic archetypes replace the longitudinal real-learner study a single semester cannot supply." | Unsupported causal claim and a silent scope change. | Phase I `01-introduction.tex:27` promised Phase II "will also validate the system longitudinally on a single learner's real logged sessions"; Phase I `06-results.tex:135` defers it. A semester can supply five weeks of logs, so the stated reason is not self-evident. | A pragmatic scope decision under time constraints; the author may have a real reason such as recruitment, ethics, or device access that is not stated. | High | Medium | State the actual constraint and acknowledge the change from the Phase I plan. The reason needs verification. |
| F19 | `01-introduction.tex:32` | 7-sentence organization paragraph with subsection enumeration | Roadmap over-compliance; duplicates the opening maps of Chapters 2 and 3 at finer grain. | `02-literature-survey.tex:2-4` and `03-requirements.tex:2` already map their own sections. Section 1.5 repeats those maps and runs past the STE six-sentence cap. | The writing guide requires a roadmap in every chapter and the PES template asks for an organization section; the author over-complied. | High | Medium | Trim to chapter-level topics, drop the subsection enumeration, and split the Chapter 4 sentence. |
| F20 | `01-introduction.tex:2`, `:8`, `:32` | "sets out" (lines 2 and 32); "draws on" (line 32); "feeds a verdict on the plan back into" (line 8) | Four banned phrasal verbs from the task-local reviewer list. | The list is a local register convention, not an authorship signal. | Common academic phrasal verbs; the author's voice. | High | Low | "describes", "uses", "sends to". |
| F21 | `01-introduction.tex:23` | "Starting practice therefore stays fast even on slow networks." | Unsupported performance claim. | No measurement or cross-reference supports the network claim; "therefore" infers performance from cache-first loading and lazy resolution. The live matrix in Section 6.2 is a deployment check, not a latency benchmark. | A design rationale, plausible but unmeasured. | High | Low | Hedge it ("is designed to stay responsive"), or cite the actual check. |

## 4. Sentence-level review

| ID | Location | Original sentence or short excerpt | Issue category | Diagnosis | Suggested revision or question for the author | Rationale |
|---|---|---|---|---|---|---|
| S1 | `01-introduction.tex:5` | "The system estimated true study pace from session history" | Precision | "True" asserts that the estimator recovers the latent pace exactly; Phase I reports recovery error. | "The system estimated study pace from session history", or "the latent pace". | Keeps the modeling claim without implying zero error. |
| S2 | `01-introduction.tex:5` | "What the open-loop system never checked was whether the logged hours produced learning." | Rhetorical cleft | The cleft is effective but stylized and closes the paragraph on a flourish. | Keep it if the emphasis is wanted; otherwise "The open-loop system never checked whether logged hours produced learning." | The plain form is shorter and equally clear. |
| S3 | `01-introduction.tex:8` | "Existing tools leave the same gap open from the other side." | Vague metaphor | "From the other side" has no clear referent; the next two sentences do the actual work. | "Existing tools cover the time side of the gap, not the understanding side", or delete the sentence. | Removes a metaphor that delays the examples. |
| S4 | `01-introduction.tex:15` | "Objective questions grade deterministically against authored answers, written answers grade against a rubric applied by a language model, and coding answers execute in a sandboxed runner with hidden tests." | Long sentence (29 words) | Three grading modes are packed into one sentence; the middle clause is hard to parse on first read. | "Objective questions grade deterministically against authored answers. Written answers grade against a rubric applied by a language model, and coding answers execute in a sandboxed runner with hidden tests." | Splits the triad without dropping a mode. |
| S5 | `01-introduction.tex:17` | "A Bayesian model updates a per-skill mastery probability from the graded response history, and the practice system adapts the difficulty of upcoming problems to the estimate instead of serving a fixed sequence." | Long sentence (32 words) | Two distinct mechanisms, mastery update and difficulty steering, share one sentence. | Split at "and": "A Bayesian model updates a per-skill mastery probability from the graded response history. The practice system then adapts the difficulty of upcoming problems to the estimate instead of serving a fixed sequence." | Makes the causal chain easier to follow. |
| S6 | `01-introduction.tex:19` | "The coach answers questions through a ladder of Nudge, Hint, Targeted explanation, and Reveal." | Repetition | The lead already names the Socratic ladder and the gated reveal. | Keep the confirmation-step detail and cut the repeated ladder names, or replace this sentence with the reason the ladder is gated. | Removes a restatement while preserving the objective. |
| S7 | `01-introduction.tex:21` | "Return advisory feedback copy on each graded attempt." | Claim precision | The next sentence limits feedback to entries "whose grades changed". | "Return advisory feedback copy on updated results." | Matches `03-requirements.tex:62` and `04-methodology.tex:24`. |
| S8 | `01-introduction.tex:25` | "A loop endpoint reads mastery, learner posture, and grade evidence." | Terminology | "Learner posture" is undefined and differs from "schedule posture" in Section 4.1. | "A loop endpoint reads mastery, the schedule posture, and grade evidence." Question: is "learner posture" a distinct input? | Aligns the objective with the methodology chapter. |
| S9 | `01-introduction.tex:25` | "with its identity attached" | Undefined term | Section 4.1 and Section 6.3 call the carried object a "verdict pair". | "with its verdict pair attached". | Uses the term the rest of the report uses. |
| S10 | `01-introduction.tex:29` | "Each part was compared offline against baselines and realized in the application." | Claim-evidence | Phase I evaluated a schedule allocator that it deliberately did not ship. | "Each part was compared offline against baselines, and the selected models were realized in the application." | Separates evaluation from delivery without dropping the Phase I work. |
| S11 | `01-introduction.tex:32` | "The remainder of the report is organized as follows." | Template opening | The sentence is a standard roadmap formula and is acceptable in this genre. | Keep it; the issue is the length and granularity that follow, not this sentence. | Distinguishes a genre convention from a defect. |
| S12 | `01-introduction.tex:32` | "Chapter~7 concludes in Section~7.1 and sets out future work in Section~7.2." | Register | "Sets out" is on the task-local banned phrasal list. | "Chapter~7 concludes in Section~7.1 and describes future work in Section~7.2." | Removes the banned phrasal verb. |

## 5. Chapter-level pattern map

| Section | Recurring pattern families | Isolated or repeated | Strongest examples and locations | Chapter-specific writing issues | Highest-value revision |
|---|---|---|---|---|---|
| Opening roadmap | Six-sentence section map; template opening. | Isolated; genre-required. | `01-introduction.tex:2`. | "Sets out" is banned; "the shape of the work that follows" is vague. The paragraph is exactly at the six-sentence cap, so it passes the STE rule. | Change "sets out" to "describes"; keep the six-sentence map. |
| 1.1 Background | Phase I recap inflation; parallel short declaratives; self-evaluative null claim; fifteen-sentence paragraph. | Repeated across 1.1, 1.2, and 1.4. | `01-introduction.tex:5` (F1 to F6). | The recap upgrades the Phase I results and compresses the selected calibrator into the incumbent. | Correct F1, F2, F3, and F4; split the paragraph. |
| 1.2 Problem Statement | Four consecutive "It" openings; hidden list; citation stretches; vague metaphor; field-wide gap claim. | Repeated from 1.1's parallel style; the citation issues are local to this section. | `01-introduction.tex:8` (F7 to F11). | The four "It" openings are here, not in Section 1.3. The "missing piece" sentence reads as a literature-wide novelty claim. | Split the paragraph; scope the gap claim; fix the two citations. |
| 1.3 Objectives | Regular "lead plus explanation" template; some items restate the lead; one frequency inconsistency; one wrong cross-reference; one non sequitur. | Isolated to this section, though the template repeats across all seven items. | `01-introduction.tex:13`, `:19`, `:21`, `:25` (F12 to F16). | The objective list is structurally sound. The defects are local: item 1's causal "so", item 4's restatement, item 5's frequency, and item 7's cross-reference and terms. | Fix item 5 and item 7 first; trim item 4. |
| 1.4 Scope | Recap overclaim; silent scope change; bold phase labels. | Repeated from 1.1's recap pattern. | `01-introduction.tex:29` (F17, F18). | "Each part ... realized" and the semester justification are the two substantive issues. | Qualify the recap; state the real constraint behind the synthetic study. |
| 1.5 Organization | Seven-sentence roadmap; subsection enumeration; banned phrasal verbs. | Repeated from the chapter-opening maps of Chapters 2 and 3, at finer grain. | `01-introduction.tex:32` (F19, F20). | The opening roadmap and Section 1.5 do not duplicate each other, but Section 1.5 duplicates the section maps that Chapters 2 and 3 already provide. | Trim to chapter-level topics and split the long Chapter 4 sentence. |

Pattern-family notes:
- The strongest family is recap inflation, not sentence rhythm. Four independent statements in Sections 1.1 and 1.4 exceed the Phase I evidence.
- The second family is paragraph-level list-in-prose: Section 1.1 has 15 sentences, Section 1.2 has 13, and both use runs of short declaratives with repeated subjects.
- The third family is citation compression: two citations in Section 1.2 support narrower claims than the sentences make.
- Empty contrasts were not found. The negative halves in "says nothing about understanding" and "never checked" carry new information.
- Forced triads were not found. The lists are four or five real items, and "multi-user, institutional, and instructor-mediated" is a real scope triad.
- No repeated closers were found. The one rhetorical cleft at the end of Section 1.1 is a single local choice.
- The machine lint reports 13 STE fail rows and 0 humanizer fail rows. The humanizer "gated" row is a judge row and passes because the same sentence names the lock ("stays locked until the learner confirms"). The `\textbf{Phase~I}` row is classified as info (identifier bold), not a hard fail.

## 6. Academic integrity and evidence checks

Citation integrity:
- The three keys used in Chapter 1 (`chen2024`, `alhazbi2024`, `islam2024`) all resolve in `main.tex`.
- The bibliography order matches first citation order: Chen, Alhazbi, Islam.
- No placeholder, TODO, TBD, "insert", or "verify" residue appears in the chapter.
- External accuracy of all three sources is "needs verification"; none was opened for this audit.

Cross-reference integrity:
- `4.3` in `01-introduction.tex:25` is wrong for the loop gate. Section 4.3 is "Comparison Methodology"; the gate is in Section 4.2.5, "Loop Verdict".
- `6.3` is correct: Section 6.3 is "Closed-Loop Decision".
- The chapter-level ranges in Section 1.5 are correct: Chapter 2 has 2.1 to 2.6, Chapter 3 has 3.1 to 3.4, Chapter 4 has 4.1 to 4.5, Chapter 5 has 5.1 to 5.5, Chapter 6 has 6.1 to 6.5, and Chapter 7 has 7.1 to 7.2.
- Chapter 1 uses hard-coded section numbers rather than `\ref`. That matches the writing guide but makes the `4.3` error easy to introduce and easy to miss.

Repeated text:
- No duplicated paragraph was found.
- The exact phrase "assessment-based verification of genuine learning" appears in `01-introduction.tex:8`, `01-introduction.tex:29`, and `main.tex:129`. Thesis restatement is conventional, but the Section 1.4 occurrence could be varied.
- The open-loop and closed-loop metaphor recurs across the chapter and the abstract. It is the organizing metaphor, so it is not flagged as a defect.

Phase I claim-evidence checks:
- Projection: `01-introduction.tex:5` says "calibrated uncertainty band". Phase I `06-results.tex:70` reports coverage of 0.183 to 0.494 across both regimes against a nominal 0.95, and `06-results.tex:108` says the conformal correction is validated but unshipped. The recap is stronger than the evidence.
- Change detection: `01-introduction.tex:5` says "genuine shifts". Phase I `06-results.tex:57` reports false-alarm rates of 0.312 and 0.296, and `06-results.tex:67` describes a human-confirmed prompt. The recap is stronger than the evidence.
- Calibration: `01-introduction.tex:5` says the fixed-rate baseline was beaten "only after enough sessions". Phase I `06-results.tex:17-20` shows the selected calibrator ahead of the moving average at every band, including the short band. The recap contradicts the table.
- Model naming: `01-introduction.tex:5` says "hierarchical Bayesian calibration". Phase I `06-results.tex:25` selects enriched-shrinkage and calls hierarchical Bayesian the incumbent. The recap drops the selected model.
- Schedule delivery: `01-introduction.tex:29` says "each part ... realized in the application". Phase I `06-results.tex:130` and `04-methodology.tex:49` say the evaluated dynamic-programming allocator was deliberately not shipped. The recap overclaims.
- Scope: `01-introduction.tex:29` replaces the Phase I promise of a real-learner longitudinal study. Phase I `01-introduction.tex:27` and `06-results.tex:135` promised or deferred that study. The change is not acknowledged. The stated reason ("a single semester cannot supply") needs verification.

Number and terminology checks:
- The only new threshold value in Chapter 1 is the gate of `0.7`, which matches `04-methodology.tex:27` and `06-results.tex:82`.
- "Four synthetic learner archetypes over five weeks" matches the four archetypes in Chapters 4 to 6. The 32-day material-scoped span in `06-results.tex:82` is shorter than five weeks, so the "five weeks" history length should be confirmed against the generator. Mark needs verification.
- The four stable project terms are used consistently: "schedule regeneration" (Chapter 1 lines 8, 25, 29; Chapter 2 line 102), "feedback copy" (line 21; Chapter 2 line 53; Chapter 3 line 62), "authoritative arm" (lines 8 and 15; Chapter 2 line 42; Chapter 3 line 59), and "self-directed learner" (lines 5 and 29; Chapter 3 line 3).
- "Posture" is polysemous: "schedule posture" in Chapter 4, "known posture" for archetypes in Chapters 5 and 6, and "learner posture" in Chapter 1. This is a terminology drift finding, not a factual error.
- Spelling is mixed at document level: Chapter 1 uses "realized", while `main.tex:129`, `05-implementation.tex:61`, and `05-implementation.tex:122` use "realised", and Chapter 2 uses "analyses" at line 51. Chapter 1 is internally consistent; the document is not. The task-local rule requires American spelling, so the other files should be corrected in a separate pass.

Questions for the author:
- On which metric and baseline did the Phase I calibrator beat a fixed-rate method only after enough sessions? If none, should the clause be dropped?
- Was the delivered projection calibrated after the cold-start threshold, or was the conformal correction unshipped?
- What was the actual constraint that prevented a real-learner longitudinal study?
- Does the loop endpoint read "learner posture" or "schedule posture"?
- What is the "identity" attached to a replan verdict?
- Is `islam2024` the intended source for "static generators"?
- Does `alhazbi2024` support the time-tracking claim, or only the time-management-indicator claim?

## 7. Prioritized action list

1. Fix before submission:
- Correct F1 (calibrated band), F2 (genuine shifts), F3 (fixed-rate cold-start claim), and F17 (each part realized).
- Correct F15 (4.3 to 4.2.5).
- Correct F13 (feedback on updated results only).
- Verify and fix F8 and F9 (citation-claim alignment for `islam2024` and `alhazbi2024`).
- Add a sentence acknowledging the scope change in F18, or state the real constraint.

2. Improve scholarly argument:
- Fix F4 (name enriched-shrinkage; keep `chen2024` for prior structure).
- Delete or replace F5 (the "nulls honestly" meta-claim).
- Scope F10 ("missing piece") to the Phase I system or to the project's gap analysis.
- Add the mastery and verdict step in F11.
- Define or align "posture" and replace "identity" with "verdict pair" in F16.
- Confirm the five-week history length against the 32-day material-scoped span.

3. Improve style and reduce redundancy:
- Split the 15-sentence and 13-sentence paragraphs (F6, F7).
- Replace the causal "so" in F14.
- Trim the restatement in F12.
- Trim the subsection enumeration in F19.
- Replace the banned phrasal verbs in F20.
- Hedge or support the network-speed claim in F21.

4. Optional polish:
- Replace "true study pace" with "study pace" or "latent pace".
- Replace "self-reported session logs" with "learner-logged session records" if the in-app timer matters.
- Keep or cut the rhetorical cleft at the end of Section 1.1.
- Decide whether the repeated thesis phrase "assessment-based verification of genuine learning" needs a third occurrence in Section 1.4.
- Decide whether `\textbf{Phase~I}` and `\textbf{Phase~II}` are identifier bold (keep) or emphasis (remove). The linter classifies them as info.

## 8. Overall conclusion

The chapter's dominant pattern is compression: a Phase I recap, a problem statement, and seven objectives are packed into a small space, and the compression produces both the long paragraphs and the overclaims.
The overclaims are concentrated in four places and are independently verifiable against the Phase I report, so they are the highest-value revision target.
The citation stretches and the wrong cross-reference are local and cheap to fix.
The sentence-rhythm pattern is real but localized to Sections 1.1 and 1.2; it does not justify a wholesale rewrite.
The chapter has no placeholder residue, all three citation keys resolve, and the four stable project terms are used consistently.
This audit is a qualitative review of observable textual patterns, not a validated AI detector. It cannot establish authorship, intent, or misconduct, and no detector score or probability is reported.

Writing-review priority (optional rubric): **3 - major issue affecting argument, evidence, consistency, or submission readiness.** The score reflects the four Phase I recap overclaims and the two citation-claim stretches. It is not an AI-likelihood score and should not be added to any other score.

## 9. Fix-plan resolution (2026-10-23)

| Finding | Plan row | Status |
|---|---|---|
| F1 | C1-01 | resolved: "calibrated" removed |
| F2 | C1-02 | resolved: "candidate shifts for learner confirmation" |
| F3 | C1-03 | resolved: Phase-I short-history win stated |
| F4 | C1-04 | resolved: hierarchical priors plus shrinkage calibrator |
| F5 | C1-06 | resolved: sentence deleted |
| F6, F7 | C1-07, C1-13 | resolved: paragraphs split |
| F8, F9, F10, F11 | C1-10, C1-09, C1-11, C1-12 | resolved: claims narrowed and scoped |
| F12 | C1-17 | resolved: restatement removed |
| F13 | C1-18 | resolved: "on updated results" |
| F14 | C1-14 | resolved: non sequitur removed |
| F15 | C1-21 | resolved: pointer now 4.2.5 |
| F16 | C1-20 | resolved by Q-03: schedule posture and verdict pair |
| F17 | C1-22 | resolved: evaluated allocator separated from shipped models |
| F18 | C1-23 | resolved by Q-04: Phase-I plan and deferral stated, no cause invented |
| F19 | C1-24 | resolved: roadmap split, every pointer kept |
| F20 | C1-25 | resolved: banned phrasal verbs replaced |
| F21 | C1-19 | resolved: network claim hedged |
| S1, S3, S4, S5, S6, S7, S8, S9, S10, S12 | C1-05, C1-08, C1-15, C1-16, C1-17, C1-18, C1-20, C1-22, C1-25 | resolved |
| S2, S11 | none | retained by choice (rhetorical cleft and genre roadmap opener) |

Open: external full-text verification of `islam2024` and `alhazbi2024` (Q-02); confirm the "five weeks" history length against the generator.
