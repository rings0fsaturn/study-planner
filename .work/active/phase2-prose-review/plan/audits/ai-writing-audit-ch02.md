# AI Writing Pattern Audit

## 1. Scope

- Material reviewed: `college/mydeliverables/Phase-2-report/phase2-report/chapters/02-literature-survey.tex`, all 102 lines, 1,681 words by `ste_check.py`.
- Coverage: the full chapter, including the opening roadmap (lines 2-4), Sections 2.1 to 2.6, the BKT equation, Figure `fig:closed-loop`, and Table `tab:litphase2`.
- Context reviewed: `phase2-report/main.tex` (bibliography and chapter order), `chapters/01-introduction.tex`, `chapters/03-requirements.tex`, `chapters/04-methodology.tex`, `chapters/06-results.tex`, `college/mydeliverables/REPORT_WRITING_GUIDE.md`, and the live evidence under `research/doc/2026-10-22-*`.
- Genre/discipline: M.Tech dissertation literature survey, Data Science and Artificial Intelligence, applied system-building report.
- Limitations: external sources were not opened in full. The `itemgen2024` abstract was checked; `zanellati2024` full text was inaccessible (HTTP 403). Every other external claim is marked "needs verification." No external detector report, drafts, or version history was supplied. The compiled PDF was not inspected for rendered layout.
- Linter context: `ste_check.py` reports 1 STE fail-tier row (line 16, a 7-sentence paragraph), 0 humanizer fail-tier rows, and 6 total rows. The humanizer pass is real: the chapter has no em or en dashes in body prose, no bold emphasis in body prose, no stacked connectives, and no bare `robust`.
- Confidence in this report means confidence that the stated textual pattern is present, not confidence that AI generated the text.

## 2. Executive assessment

The chapter is cleaner than Chapter 1 on the deterministic STE lint. It avoids the usual punctuation and formatting tells, and the humanizer lint passes with zero fail-tier rows. The findings below are therefore mostly structural and evidentiary, not surface "AI tells."

The dominant structural pattern is a repeated project pivot. Most literature paragraphs in Sections 2.1, 2.2, and 2.4 turn to "this project," and the turn is often announced with the same formula: "Against this," "By contrast," "The project therefore," "The limitation." The chapter uses "project" 25 times in 102 lines, including 10 possessives. This makes the survey read as a design justification rather than an analysis of the sources, and it blurs differences between the cited works.

The dominant scholarly pattern is incomplete entries. Eight of the eleven cited works lack a quantified result or numeric scope, and five lack an explicit limitation or gap; Mai substitutes a project-side cold-start constraint for the source's gap. Section 2.5 anticipates this by saying scope may replace a number, but the substitution is not applied consistently, and the same section overclaims that every metric is traceable to Phase I or live code.

The highest-risk claims are project-side: an "informative stance from onboarding data" that neither Chapter 4 nor Chapter 6 describes, a "drives difficulty" claim against an advisory chip, and a "per-problem family label" where the implementation and the rest of the chapter use skill tags. The summary table adds two more category errors: Chen under knowledge tracing and `islam2024` under grading. These are fixable with targeted edits and questions to the author; they do not require a wholesale rewrite.

The project numbers agree with Chapters 3 and 6, with two presentation drifts: 0.867/0.004 here against 0.8667/0.0044 there, and an unnamed AUC baseline. All eleven citation keys resolve in `main.tex`, all three labels resolve, and there is no citation-key or cross-reference breakage.

These observations do not establish whether the text was written by a human, AI, or a combination.

## 3. Findings table

| ID | Location | Exact excerpt | Observable pattern | Why it merits review | Plausible non-AI explanation | Confidence | Priority | Recommended action |
|---|---|---|---|---|---|---|---|---|
| F-01 | `02-literature-survey.tex:16`, `:18`, `:20`, `:23`, `:31`, `:36`, `:42`, `:49` | "Against this, the project's own bake-off" (16); "The project therefore keeps the Bayesian updater" (20); "The limitation this answers is single-signal grading treated as final." (42) | Formulaic project pivot in all four sections: "Against this" twice, "By contrast" once, "The project therefore" three times, "The limitation" twice | The project response is announced rather than derived; the same rhythm recurs, so differences between sources blur | The report guide mandates a limitation/gap beat and self-positioning; a single-author project report naturally returns to the project | High | Medium | Vary the pivots; move some project responses to 2.6; make each pivot carry a new analytical point |
| F-02 | `02-literature-survey.tex:16`, `:29`, `:38`, `:53`, `:102` | "That is parity rather than a win." (16); "It does not use the tag to steer practice." (29); "the copy never alters the grade" (53) | A short declarative closer ends most paragraphs, often restating the design or the gap | The drumbeat is noticeable, and some closers add no new fact (humanizer §2, a writing-quality issue only) | The 4-beat formula requires a limitation sentence; short declaratives are the report's house style | High | Medium | Merge redundant closers into the preceding sentence; keep only closers that add a consequence |
| F-03 | `02-literature-survey.tex:16`, `:18`, `:23`, `:25`, `:29`, `:34`, `:47`, `:51` | "It checks them with deterministic quality control." (25); "A rubric is intended to make the judgment repeatable across answers." (34) | Eight of eleven entries lack a quantified result or numeric scope; five lack an explicit limitation or gap, and Mai substitutes a project-side cold-start constraint for the source's gap | The entries read as summaries rather than surveys; the evidence base is thin for the claims built on them | Some sources lack a reusable number; Section 2.5 says scope may substitute | High | High | Add the source's metric or stated scope where available; add one limitation sentence per entry; never invent numbers |
| F-04 | `02-literature-survey.tex:78` | "This keeps every metric in the chapter traceable to the Phase~I report or to live code reality, with no invented numbers." | Overclaim: the chapter contains paper-side numbers (312 adults, 0.73 accuracy, 25 studies) that are traceable to their citations, not to Phase I or live code | A methodology paragraph misdescribes its own evidence and weakens trust in the rest of 2.5 | The author may mean "every project metric"; the sentence compresses two categories | High | High | "Every project metric is traceable to the Phase I report or to live code; paper-side numbers are cited where the source states one." |
| F-05 | `02-literature-survey.tex:76-78` | "One representative work was kept per sub-theme" (76); "the Phase~I knowledge-tracing trio" (76); "No new hundred-scale screening ran for this chapter, and none is claimed." (78) | The selection rule is unverifiable: 2.1, 2.2, and 2.4 each carry three works, and the sub-themes are never named (the count inconsistency is Medium confidence; the mislabel and repetition are High). The Phase I trio is mislabelled. The no-sweep disclaimer is repeated | A reader cannot reproduce the sample; the method reads as a justification rather than a procedure | Sub-themes may be finer than sections; the same trio is now used for knowledge tracing; the disclaimer is honest | High | Medium | Name the sub-themes or say "one to three representative works per sub-theme"; call it the "Phase I Bayesian learner-modelling trio"; state the chaining procedure once and drop the repeated disclaimer |
| F-06 | `02-literature-survey.tex:20` | "The project therefore keeps the Bayesian updater with an informative stance from onboarding data." | No onboarding-derived prior is described in Chapter 4 or Chapter 6; Chapter 6 line 104 reports the fixed prior 0.15; the BKT implementation uses fixed `p_init=0.15` | An unsupported design claim; the reader cannot tell what the informative stance is or where it comes from | The author may describe an intended design, or the mastery snapshot passed to generation rather than the BKT prior | High | High | Describe the actual mechanism if it exists; otherwise revise to "fixed prior" or "warm start from the mastery snapshot." Verify before editing |
| F-07 | `02-literature-survey.tex:20` | "The mastery estimate then drives difficulty instead of a fixed sequence." | Chapter 4 says the chip "maps the estimate to a difficulty recommendation"; Chapter 6 says "The adaptive chip stays uncalibrated-advisory." "Drives" is stronger than "recommends" | Cross-chapter strength-of-claim drift; a reader may think difficulty adaptation is validated | The chip does use mastery to choose a recommended band; "drives" is shorthand | High | High | "The mastery estimate then feeds an advisory difficulty recommendation." |
| F-08 | `02-literature-survey.tex:31` | "This project therefore carries a per-problem family label from generation into the run." | The mastery model groups by `skillTag`; the chapter uses "family" for objective/written/coding; the preceding sentence says the mastery model needs the KC tag | The wrong term for the signal; a reader cannot tell whether the family label or the skill tag drives mastery | "Family label" may be shorthand for the item's metadata; the author may mean the skill tag | High | High | "carries the per-problem skill tags from generation into grading and mastery" (verify against the flow) |
| F-09 | `02-literature-survey.tex:51` | "This matches the project's own replay result. After the fix the synthetic histories convert 4 out of 4 verdict-triggered replans." | The cited study is about gaming the system; the project metric is verdict-to-replan conversion. These are different phenomena | Claim-evidence misalignment; the result does not test whether help-seeking was gamed | Both concern whether learner behavior is genuine; the author sees a conceptual link | High | High | State what the study supports and what the project measured; drop "matches" |
| F-10 | `02-literature-survey.tex:36` | "By contrast, the project's live matrix grades written runs 4 out of 4 with real rubric grades" | The preceding sentence describes the `llmgrade2024` method; 4/4 is a deployment check, not a grading-accuracy result. "By contrast" implies a like-for-like comparison | Paper-side and project-side evidence are different categories; the contrast is apples-to-oranges | The author wants to show the project implements the surveyed method; "by contrast" is a loose transition | High | Medium | "The project's deployment check is separate: written runs graded 4 of 4..." and state what the check does and does not show |
| F-11 | `02-literature-survey.tex:92-95` | "Knowledge tracing~\cite{chen2024,zanellati2024,mai2025} & Per-skill mastery from short histories, interpretable, calibrated" (92); "Grading~\cite{llmgrade2024,islam2024} and sandbox execution" (94) | Chen is not a knowledge-tracing model (the body says it targets teacher example choice); `islam2024` is prediction/scheduling, not grading; "hidden-test authority" has no citation; "feedback the learner reads" overreads Uzun's engagement finding | The summary table misattributes findings and blurs cited-work strengths with project design claims | The table synthesizes by project need, not by source claim | High | High | Label the columns "Surveyed work: strengths" and "Gap for this design"; remove Chen and `islam2024` from those rows or qualify them; add a sandbox source or mark it implementation-only |
| F-12 | `02-literature-survey.tex:71`, `:40`, `:53` | "Each stage is surveyed in Sections~2.1 to~2.4." (71) | The sandbox arm in 2.3 and the feedback-copy paragraph in 2.4 have no cited work; the caption overstates coverage | Figure/caption alignment; a reader expects a cited basis for each stage | The stages are discussed as design decisions; "surveyed" may mean "motivated" | High | Medium | Add sources for sandboxed autograding and feedback copy, or change the caption to "Each stage is motivated in Sections 2.1 to 2.4" and state the implementation-only status |
| F-13 | `02-literature-survey.tex:16`, `:23` | "an AUC of 0.888 against 0.889 for the baseline" (16); "a groundedness of 0.867 with a near-duplicate rate of 0.004" (23) | The AUC baseline is unnamed; Chapter 3 and Chapter 6 use 0.8667/0.0044, while Chapter 2 and Chapter 4 use 0.867/0.004 | The reader cannot name the comparator; cross-chapter precision drift looks like a disagreement even though the values agree | The baseline is obvious internally; rounding to three decimals is a style choice | High | Medium | Name the baseline at first use; harmonize to 0.8667/0.0044 or state the rounding convention once |
| F-14 | `02-literature-survey.tex:38`, `:51` | "objective runs 2 out of 2 and reviews 4 out of 4" (38); "Before the fix every case held." (51) | "reviews" is unlabeled (Chapter 6 separates written runs 4/4 from review 4/4); "every case" drops the 4/4 count and the confidence range | Ambiguous check labels; the before/after claim loses its scope | Internal shorthand; the details are in Chapter 6 | High | Medium | "The review queue passes 4 of 4"; "Before the fix, all four cases held at confidence 0.18 to 0.34." |
| F-15 | `02-literature-survey.tex:16-20` | "consistently outperform either pure Bayesian Knowledge Tracing or pure deep learning" (16); "That is parity rather than a win." (16); "The project therefore keeps the Bayesian updater with an informative stance from onboarding data." (20) | The chapter reports that hybrids outperform BKT, then reports parity, then keeps BKT without stating the selection criterion | A non sequitur; the reader cannot tell why parity justifies the simpler model | The criterion may be in Section 4.2.3; the chapter assumes it | High | High | Add one sentence stating the criterion (simplicity/interpretability/parity) or point to Section 4.2.3 |
| F-16 | `02-literature-survey.tex:9-14` | `P_{\text{correct}}(L_n)` (11); `P(L_n) = P_{\text{obs}}(L_n) + (1-P_{\text{obs}}(L_n))T` (11); "The subscript names the observation just seen." (14) | `P_correct` and `P_obs` appear to denote the same posterior; the text says the subscript names the observation, but the labels differ | Notation ambiguity in an equation that Chapters 4 to 6 reference | Standard BKT notation; `P_obs` may be shorthand for `P_correct` | High | Medium | Align the symbol or define both; check the Chapter 4-6 references before editing. Do not change the equation's mathematics |
| F-17 | `02-literature-survey.tex:16` | "Zanellati et al.~\cite{zanellati2024} review hybrid knowledge-tracing models in a taxonomy of approaches that combine Bayesian posteriors with machine learning." | `ste_check.py` flags STE-6.6, the only fail-tier row in the chapter: the paragraph has 7 sentences | It packs the paper summary, the project result, and the gap into one block; the pivot is hard to see | The 4-beat formula encourages one paragraph per entry; the author combined the project contrast with it | High | Medium | Split before "Against this" (paper summary, then project result and gap); never drop a fact |

## 4. Sentence-level review

| ID | Location | Original sentence or short excerpt | Issue category | Diagnosis | Suggested revision or question for the author | Rationale |
|---|---|---|---|---|---|---|
| S1 | `02-literature-survey.tex:11`, `:14` | `P_{\text{correct}}(L_n)` and `P_{\text{obs}}(L_n)`; "The subscript names the observation just seen." | Notation / technical clarity | The equation uses two labels for what appears to be the same posterior, and the text describes a subscript convention the equation does not follow | Ask: "Are `P_correct` and `P_obs` the same quantity? If so, use one symbol in both expressions and in the text; if not, define both." Do not change the mathematics | The equation is referenced in Chapters 4 to 6, so an ambiguous symbol propagates |
| S2 | `02-literature-survey.tex:23` | "The paper evaluates generation per subject but does not record chunk-level provenance. It does not record which chunk each question came from, so a wrong question cannot be traced back to its source." | Semantic redundancy | The second sentence restates the first with more words | Merge: "The paper evaluates generation per subject but does not record which chunk each question came from, so a wrong question cannot be traced back to its source." | Removes repetition without losing the claim |
| S3 | `02-literature-survey.tex:29` | "The study stops at the tag. It does not use the tag to steer practice." | Semantic redundancy | "Stops at the tag" already implies no downstream use; the next sentence repeats it | "The tag makes per-skill histories possible, but the study does not use it to steer practice." | One sentence carries both the mechanism and the gap |
| S4 | `02-literature-survey.tex:34` | "A rubric is intended to make the judgment repeatable across answers." | Generic / unattributed claim; missing evidence | A general statement about rubrics, not a finding from `llmgrade2024`; the paragraph has no result and no gap | Replace with the study's actual result or scope, or cut it; ask the author for the source's metric | The sentence could fit any grading paper; it does not advance the survey |
| S5 | `02-literature-survey.tex:38` | "Prediction does not substitute for grading." | Empty contrast (humanizer §1, writing quality only) | No cited work claims prediction substitutes for grading; the negative half names a position no one holds | Cut, or state the positive relation: "Prediction informs scheduling; it does not produce the grade the loop records." | The contrast stages a distinction instead of arguing one |
| S6 | `02-literature-survey.tex:45` | "The measurement side is well covered." | Generic filler | An evaluative claim with no scope; the next sentence supplies the 25-study scope | Cut, or merge: "Alhazbi et al. review 25 empirical studies..." | The sentence adds no information and delays the evidence |
| S7 | `02-literature-survey.tex:51` | "analyses self-regulated learning protocols" | Spelling consistency | The task-local convention is American spelling; the verb should be "analyzes" | "analyzes" | Matches "behavioral," "modeling," and the rest of the chapter |
| S8 | `02-literature-survey.tex:16` | "pins its Bayesian variant" and "The cut is the Chapter~4 bake-off" | Informal jargon | "Pins" and "cut" are internal shorthand; "cut" is not defined | "reports its Bayesian variant ... at an AUC of..." and "The comparison is the Chapter 4 bake-off..." | Academic register; removes an undefined term without changing the result |
| S9 | `02-literature-survey.tex:23` | "The work on automatic item generation reports fluency first and traceability second." | Unsupported generalization | The characterization covers a literature but cites one prompting study; the paper's abstract focuses on question and answer quality, not a fluency-versus-traceability trade-off | "The prompting study cited here reports item quality but not chunk-level provenance." Ask the author to confirm the source's focus | Avoids attributing a field-wide framing to one paper |
| S10 | `02-literature-survey.tex:16` | "The surveyed hybrids address correctness prediction on large logs." | Unsupported scope | "Large logs" is not defined or cited; the review's datasets are not described in the chapter | "address correctness prediction on response logs," or add the scope from the review | Removes an unearned scope claim |
| S11 | `02-literature-survey.tex:2` | "This chapter surveys the techniques this phase uses." | Template opener (guide-required) | Generic but acceptable; the report guide mandates a roadmap paragraph | Optional: "This chapter surveys the four technique families the closed loop depends on." | Ties the roadmap to the chapter's thesis without changing its shape |
| S12 | `02-literature-survey.tex:78` | "The project's own harness or live number appears beside it, labeled as the project's." | Overstatement | Several paper entries have no project counterpart (`lecturequiz2026`, `kctag2024`, `llmgrade2024`, `uzun2025`, `gaming2026`), so "beside it" is not true for every case | "Where the project has a comparable number, it appears beside the paper's and is labeled as the project's." | Describes the actual practice |

## 5. Chapter-level pattern map

| Section | Recurring pattern families | Isolated or repeated | Strongest examples and locations | Highest-value revision |
|---|---|---|---|---|
| Opening roadmap | Four-plus-two-sentence section map; generic first sentence | Isolated; genre-required | `02-literature-survey.tex:2-4` | No defect. Optional: name the four technique families instead of "the techniques this phase uses" |
| 2.1 Knowledge Tracing | Paper summary, equation, project contrast, design decision; 7-sentence Zanellati paragraph; repeated "therefore" and "limitation" | Repeated across the section: Chen, Zanellati, and Mai each turn to the project, then a project-only paragraph | `:16`, `:18`, `:20` | Add the BKT selection criterion after parity; fix the unsupported prior and the "drives difficulty" claim; name the AUC baseline |
| 2.2 Item Generation and KC Tagging | Alternating paper and project paragraphs; project implementation detail; repeated "this project" | Repeated across `:23-31` | `:23`, `:27`, `:31` | Fix "family label" to "skill tags"; add the source's scope; trim the practice-run detail; the retrieval metric at `:27` is a strong example of split-labeled project evidence |
| 2.3 LLM and Sandbox Grading | Project-dominant section; only two cited works; the sandbox arm has no citation; paper/project contrast | Repeated in `:36-42`; the thinnest literature section | `:36`, `:38`, `:40` | Add a sandbox or autograding source; separate the deployment check from the literature; fix the straw-man contrast and the "reviews" label |
| 2.4 Socratic Guidance and Feedback | Paper plus project guide/result; feedback copy has no literature; gaming and replan conversion are conflated | Repeated in `:47-53` | `:47`, `:51`, `:53` | Separate gaming from replan conversion; add a feedback source or scope the copy as implementation-only; the linter's `gated` flags at `:47` and `:102` are judge passes because the lock is named at `:49` |
| 2.5 Methodology for Sourcing | Defensive methodology; overclaim; vague selection rule | Isolated to `:76-78` | `:76`, `:78` | Rewrite the three load-bearing sentences: the selection rule, the no-sweep disclaimer, and the metric-traceability claim |
| 2.6 Summary of Approaches | Thesis restatement; summary table; three-gap list | Isolated to `:81-102`; the three-gap list is substantive, not a forced triad | `:81`, `:100`, `:102` | Fix the table attributions; soften "answers all three" to "addresses all three" |
| Figure and table | Concept figure plus summary table; captions align with the visuals | Isolated | `:71`, `:86-95` | Label the table columns "Surveyed work: strengths" and "Gap for this design"; add sources for the sandbox and feedback rows; change "surveyed" to "motivated" if the stages remain implementation-only |

Pattern-family notes:

- The strongest family is the project pivot, not the 4-beat shape. The 4-beat shape is the report guide's requirement; the chapter's deviations from it are the issue.
- The second family is missing evidence in literature entries (F-03): eight entries lack a number or numeric scope, five lack a gap, and Mai substitutes a project-side constraint for the source's gap.
- The third family is project-side claim inflation (F-06 to F-08): a prior, a difficulty effect, and a signal name that the results chapter or code do not support as written.
- Empty contrasts: one clear case (S5). "That is parity rather than a win" at `:16` carries new information and should stay.
- Forced triads: none in prose. The table's parallel three-item cells are a table design choice, not a prose triad. The three-gap list at `:100` is substantive.
- Repeated closers: present (F-02), concentrated at paragraph ends.
- Dashes, bold body prose, and stacked connectives: none. The humanizer lint passes. The line 90 bold is a table header and is conventional.
- The linter's one STE fail is line 16 (7 sentences); the natural split is before "Against this."
- Section transitions are a strength: each section opens with a content-bearing topic sentence, not template prose. See `:7`, `:22`, `:33`, `:44`, `:75`, and `:81`.
- Table-cell prose passes the local rule: the cells use commas rather than semicolons, and the parallel three-item cells are a table design choice, not a prose triad.
- No fresh-sweep claim is made. Section 2.5 explicitly says no new screening ran, which is honest. The problem is the metric-traceability overclaim later in the paragraph, not a claim of a new sweep.

## 6. Academic integrity and evidence checks

Citation integrity:

- All eleven keys used in Chapter 2 resolve in `main.tex` (`main.tex:158-179`): `chen2024`, `zanellati2024`, `mai2025`, `itemgen2024`, `lecturequiz2026`, `kctag2024`, `llmgrade2024`, `islam2024`, `alhazbi2024`, `uzun2025`, `gaming2026`.
- There are no present-but-uncited bibliography entries and no cited-but-missing keys. The first-citation order matches the bibliography order.
- No placeholder, TODO, TBD, "insert," or "verify" residue appears in the chapter.
- Five bibliography entries lack author names (`main.tex:169`, `:171`, `:173`, `:175`, `:179`): `itemgen2024`, `lecturequiz2026`, `kctag2024`, `llmgrade2024`, `gaming2026`. The chapter compensates with generic descriptors ("The lecture-to-quiz study," "The automated tagging study"). This is a metadata completeness issue, not a key mismatch; it needs completion in a bibliography pass that respects the G1 verbatim rule.

External source accuracy:

| Claim | Location | Status |
|---|---|---|
| Chen: two experiments, 312 adults | `:7` | Needs verification; the source was not opened for this audit |
| Zanellati: hybrids "consistently outperform" pure BKT or deep learning | `:16` | Needs verification; the full text was inaccessible (403). The strong word "consistently" is the main risk |
| Mai: "calibrated" estimates; "without giving up accuracy on their evaluation" | `:18` | Needs verification; the chapter gives no number |
| `itemgen2024`: evaluates generation per subject; does not record chunk-level provenance | `:23` | Abstract checked: the paper studies question and answer quality across STEM subjects with GPT-3.5 and GPT-4 prompting and does not mention chunk-level provenance. The negative provenance claim still needs full-text verification |
| Remaining seven sources (`lecturequiz2026`, `kctag2024`, `llmgrade2024`, `islam2024`, `alhazbi2024`, `uzun2025`, `gaming2026`) | `:25-51` | Needs verification; none was opened for this audit |

Project number consistency:

| Number | Chapter 2 | Chapter 3 / Chapter 6 | Status |
|---|---|---|---|
| Groundedness | 0.867 (`:23`) | 0.8667 (Chapter 3 NFR-7; Chapter 6 line 34) | Same value; precision drift |
| Near-duplicate rate | 0.004 (`:23`) | 0.0044 (Chapter 6 line 34) | Same value; precision drift |
| Recall at 3 / MRR | 0.90 / 0.797 (`:27`) | 0.90 / 0.797 (Chapter 3 NFR-9; Chapter 6 line 7 and table) | Matches; the `hybrid_rerank` and 754-chunk labels are present |
| AUC | 0.888 against 0.889 (`:16`) | 0.888 against 0.889 (Chapter 6 line 57; Chapter 4 line 52) | Matches; the baseline is unnamed |
| Written / objective / coding | 4/4, 2/2, 3/3 (`:36`, `:38`, `:40`) | 4/4, 2/2, 3/3 (Chapter 6 line 77) | Matches; "reviews" is ambiguous |
| Replay | 4/4, 32 days (`:51`) | 4/4, 32 days (Chapter 6 line 82; Chapter 4 line 71) | Matches; the pre-fix scope is dropped |

Paper/project separation is generally strong. "The project's own bake-off" (`:16`), "the project's own generation harness" (`:23`), and "The project's retrieval arm" (`:27`) label project numbers. The exceptions are F-09 ("matches"), F-10 ("By contrast"), F-11 (the table), and F-14 ("reviews").

Cross-reference integrity:

- `eq:bkt-update` resolves to `02-literature-survey.tex:12`; it is referenced in Chapter 4 (lines 9, 21), Chapter 5 (lines 61, 64), Chapter 6 (line 57), and Chapter 7 (line 13).
- `fig:closed-loop` resolves to `02-literature-survey.tex:72`; it is referenced in Chapter 2 (line 102) and Chapter 4 (lines 5, 124, 128).
- `tab:litphase2` resolves to `02-literature-survey.tex:87`; it is referenced at line 81.
- Section references 4.3, 6.1, 6.2, 6.3, and Chapter 4 resolve to the intended sections. No broken label or section reference was found.

Claim-evidence checks:

- F-04: Section 2.5 says every metric is traceable to Phase I or live code, but the chapter contains paper-side numbers (312 adults, 0.73, 25 studies) that are traceable only to their citations.
- F-06: "informative stance from onboarding data" is not described in Chapter 4 or Chapter 6. Chapter 6 line 104 reports the fixed prior 0.15, and the BKT implementation uses `p_init=0.15` (`packages/py-progress/src/py_progress/mastery.py:39-42`). Verify whether an onboarding path exists before changing the claim.
- F-07: Chapter 4 calls the chip a "difficulty recommendation" (line 21); Chapter 6 calls it "uncalibrated-advisory" (line 57). "Drives" overstates both.
- F-08: The mastery endpoint groups observations by `(materialId, skillTag)` (`services/intelligence/app/routers/mastery.py`), and generation emits `skillTags` (`services/intelligence/app/generation/prompts.py:75`). A "family label" is the objective/written/coding family, not the KC signal.
- F-09: The `gaming2026` entry is about gaming the system; the 4/4 replay result is about `suggest_replan` to replan conversion. The chapter does not measure gaming.
- F-11: The table lists Chen under knowledge tracing although the body says Chen targets teacher example choice; it lists `islam2024` under grading although the body calls it prediction-then-optimize.
- F-15: The chapter reports that hybrids outperform BKT, then parity, then keeps BKT. The selection criterion is not stated.
- F-16: The equation uses `P_correct` and `P_obs` for what appears to be the same posterior. This is a notation question, not a claim that the mathematics is wrong.

Terminology and spelling:

- "family label" versus `skillTag`: F-08.
- "drives difficulty" versus "difficulty recommendation" / "uncalibrated-advisory": F-07.
- "informative stance" is undefined: F-06.
- "reviews 4 out of 4" is unlabeled: F-14.
- "analyses" is the one British verb spelling in an otherwise American-spelling chapter: S7.
- `AUC` (`:16`), `KC` (the 2.2 heading at `:22`), and `LLM` (the 2.3 heading at `:33`) are not defined at first use in the chapter. The task-local convention asks for a definition at first use, then the bare abbreviation.
- The stable project terms are used consistently: "schedule regeneration" (`:102`), "feedback copy" (`:53`), "authoritative arm" (`:42`), and "self-directed learner" (`:18`).
- "behavioral" and "modeling" are American; the chapter is otherwise internally consistent.

Questions for the author:

- Does onboarding data actually set the BKT prior? If so, where is that path described?
- Is the mastery chip advisory, or does it drive difficulty? Which term should the report use?
- Does the implementation carry a family label or a skill tag into mastery?
- What is the 0.889 baseline at the Chapter 4 bake-off cut?
- Is `islam2024` intended as a grading source or a scheduling source?
- Does `itemgen2024` state that it does not record chunk provenance? Does `zanellati2024` say "consistently outperform"?
- What are the sub-themes in Section 2.5, and how many works were kept per sub-theme?
- Is the feedback-copy endpoint surveyed from a source, or is it implementation-only?

## 7. Prioritized action list

1. Fix before submission:
- Correct F-04 (the "every metric" overclaim in 2.5).
- Verify and revise F-06 (onboarding prior) and F-07 ("drives difficulty").
- Correct F-08 ("family label" to "skill tags").
- Correct F-11 (the summary table's Chen and `islam2024` attributions, and the uncited sandbox strength).
- Add the missing limitations for the five entries in F-03 that have no gap.
- Add the BKT selection criterion after the parity result (F-15).

2. Improve scholarly argument:
- Rewrite the Section 2.5 selection method: name the sub-themes, fix "Phase I knowledge-tracing trio," and state the chaining procedure once (F-05).
- Separate gaming from replan conversion at `:51` (F-09).
- Separate the deployment check from the literature at `:36` (F-10).
- Add a sandbox or autograding source and a feedback source, or change the figure caption to "motivated" and label those stages implementation-only (F-12).
- Name the AUC baseline and harmonize the 0.8667/0.0044 precision (F-13).

3. Improve style and reduce redundancy:
- Vary the project pivots and reduce the 25 "project" tokens (F-01).
- Merge the redundant closers (F-02).
- Split the 7-sentence paragraph before "Against this" (F-17).
- Merge the repeated provenance sentence at `:23` and the repeated tag sentence at `:29` (S2, S3).
- Label the "reviews" check and restore the pre-fix count and confidence range (F-14).

4. Optional polish:
- Cut the straw-man contrast "Prediction does not substitute for grading" (S5).
- Cut "The measurement side is well covered" (S6).
- Change "analyses" to "analyzes" (S7).
- Replace "pins" and "cut" with "reports" and "comparison" (S8).
- Define `AUC`, `KC`, and `LLM` at first use.
- Consider a more specific roadmap opener (S11); the current one is guide-compliant, so this is optional.

## 8. Overall conclusion

The chapter is not dominated by surface AI-style tells. It avoids the usual punctuation, formatting, and connective habits, and the humanizer lint passes. Its dominant pattern is a repeated project pivot and a project-first framing, reinforced by short closers and a high negation density. The main scholarly risk is not repetition but claim-evidence alignment: the chapter asserts a prior, a difficulty effect, a signal name, and a gaming match that the results chapter or the code do not support as written. The 4-beat survey is uneven: eight of eleven entries lack a number or numeric scope, five lack a gap, and the summary table misattributes two sources. Section 2.5 is honest about not running a new sweep but overclaims metric traceability.

All keys and references resolve, and there is no placeholder residue. The defects are concentrated and fixable; the chapter does not need a wholesale rewrite. The highest-value work is to correct the project-side claims and the table, then add the missing source evidence.

This audit is a qualitative review of observable textual patterns, not a validated AI detector. It cannot establish authorship, intent, or misconduct, and no detector score or probability is reported.

Writing-review priority (optional rubric): **3 - major issue affecting argument, evidence, consistency, or submission readiness.** The score reflects the unsupported prior and difficulty claims (F-06, F-07), the signal-name mismatch (F-08), the missing 4-beat evidence (F-03), the table attributions (F-11), and the Section 2.5 overclaim (F-04). It is not an AI-likelihood score and should not be added to any other score.

## 9. Fix-plan resolution (2026-10-23)

| Finding | Plan row | Status |
|---|---|---|
| F-01 | C2-02, C2-15, C2-18 | partially resolved: several pivots varied, the formulaic family is reduced but not gone |
| F-02 | none | open: short declarative closers remain |
| F-03 | none | open: several literature entries still lack a quantified result or gap |
| F-04 | C2-25 | resolved: project metrics separated from paper-side numbers |
| F-05 | C2-23, C2-24 | partially resolved: selection count and label fixed, the chaining procedure still runs once |
| F-06 | C2-07 | resolved by Q-07: fixed prior 0.15 |
| F-07 | C2-08 | resolved: advisory difficulty recommendation |
| F-08 | C2-14 | resolved by Q-08: skill tags |
| F-09 | C2-21 | resolved by Q-09: gaming and replay separated |
| F-10 | C2-15 | resolved: deployment check separated |
| F-11 | C2-27 to C2-30 | resolved by Q-11: table attributions and note fixed |
| F-12 | C2-22 | resolved: caption says motivated and names implementation-only stages |
| F-13 | C2-01, C2-09, X-01 | resolved by Q-05: baseline named, precision harmonized |
| F-14 | C2-16 | resolved: review queue labelled |
| F-15 | C2-04, X-06 | resolved by Q-06: parity criterion stated |
| F-16 | C2-31 | open by Q-12: notation needs the author |
| F-17 | C2-05 | resolved: paragraph split |
| S2, S3, S5, S6, S7, S8, S9, S10, S12 | C2-10, C2-13, C2-17, C2-19, C2-20/C2-21, C2-02, C2-11, C2-01, C2-26 | resolved |
| S4 | none | open: the generic rubric sentence remains |
| S11 | none | retained by choice (guide-compliant roadmap opener) |

Open: Q-12 equation notation; external full-text verification of `zanellati2024`, `itemgen2024`, and the remaining sources.
