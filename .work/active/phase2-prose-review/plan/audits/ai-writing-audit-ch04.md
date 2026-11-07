# AI Writing Pattern Audit

## 1. Scope

- **Material reviewed:** `college/mydeliverables/Phase-2-report/phase2-report/chapters/04-methodology.tex`, all 128 lines, including the chapter prose, the two comparison tables, and the two TikZ figures. Context read in full or in the cited ranges: `main.tex` (abstract and bibliography), `01-introduction.tex`, `02-literature-survey.tex`, `03-requirements.tex`, `05-implementation.tex`, `06-results.tex`, `07-conclusion.tex`, `REPORT_WRITING_GUIDE.md`, Phase-I `04-methodology.tex` and `06-results.tex`.
- **Evidence checked:** `research/doc/generation-quality-harness/report.md`, `research/doc/2026-10-22-reranked-754.md`, `research/doc/2026-10-22-endpoint-retrieval.md`, `research/doc/2026-10-22-synth-extract-emission.md`, its JSON, and `.work/active/synthetic-users-seeding/plan/evidence/synthetic-users-results-2026-10-19-postfix.json`.
- **Live-code checks:** `services/intelligence/app/generation/prompts.py` (`feedback-v2`), `services/intelligence/app/routers/feedback.py`, `services/intelligence/app/jev/questions.py` (`LOOP_APPROVE_AT`, `route_loop_action`), `services/intelligence/app/routers/loop.py`, and `apps/app/src/events/EventStoreProvider.tsx` (Dexie versions 6 and 7).
- **Coverage:** Full chapter. Every excerpt below was re-read from the current working-tree bytes with line numbers. The local lint command was `python3 .work/active/phase2-prose-review/ste_check.py college/mydeliverables/Phase-2-report/phase2-report/chapters/04-methodology.tex`. Current result: STE FAIL, 7 fail-tier hits, with flags at lines 24, 39, 41, 52, 73, 87, 94, and 96; Humanizer PASS with judge-tier `gated` notes at lines 7, 27, and 41.
- **Genre/discipline:** M.Tech dissertation methodology, computer science and data science. The chapter is mostly technical prose, two tables, and two diagrams, so the sample is adequate for chapter-level pattern review but not for a document-level authorship claim.
- **Limitations:** Review only. No chapter or build file was edited. No external detector report was supplied, and none is reproduced. Confidence below means confidence that the stated textual pattern is present, not confidence about who wrote the text.

## 2. Executive assessment

The chapter is technically specific and mostly well grounded. It names routes, constants, tables, evaluation artifacts, and evidence counts. It does not read as generic filler. The strongest writing is in Sections 4.2.1, 4.2.2, and 4.2.5, where each design choice is paired with a concrete mechanism or gate.

The main risks are consistency and evidence labeling, not vague prose. The chapter contains several stale or mismatched claims: the table says `feedback-v1` while the body and live code say `feedback-v2`; the chapter says the local-first store did not change while Dexie versions 6 and 7 add Phase II tables; the offline leg reports 0.733 recall and 0.888/0.889 AUC without naming the retrieval arm or the AUC cut, where 0.733 is a baseline below the selected 0.90 and 0.888/0.889 belongs to a different cut than the harness's 0.7397/0.7368. The "two honest limits" paragraph lists more than two claims and omits the difficulty null that the harness gate actually fails on. The "middle band" phrase is not present in the loop router.

A second pattern family is template-like framing: "states the path once", "Nothing here restates either", "The loop that stayed dashed in Phase I runs solid here", and "folded inside" recur within this chapter or across Chapters 4, 5, and 6. These are editing habits, not evidence about authorship. The chapter also has four over-length sentences and three table cells with semicolons.

These observations do not establish whether the text was written by a human, an AI, or a combination. They identify writing-quality, consistency, and evidence-alignment issues only.

## 3. Findings table

`E-` IDs are evidence, consistency, or claim-evidence findings. `S-` IDs are stylistic findings. Confidence is confidence that the pattern is present.

| ID | Location | Exact excerpt | Observable pattern | Why it merits review | Plausible non-AI explanation | Confidence | Priority | Recommended action |
|---|---|---|---|---|---|---|---|---|
| E-01 | `04-methodology.tex:41` | `advisory-only \texttt{feedback-v1} copy` | Table version label contradicts the body. | Line 24 says `feedback-v2`; `FEEDBACK_PROMPT_TEMPLATE_VERSION` is `"feedback-v2"` in `prompts.py`, and the feedback router imports that constant. The table's "Selected (delivered)" column names `feedback-v1`. The client comment says a null verdict keeps the v1 words, so the fallback wording may be intentional, but the delivered template is v2. | The table may have been drafted before the v2 migration and not refreshed, or it may refer to the fallback words. | High | High | Change the table to `feedback-v2`, or say `feedback-v2 with v1 fallback` if the fallback is the intended referent; grep all chapters for `feedback-v1`. |
| E-02 | `04-methodology.tex:96` | `Bookings, session logging, and the local-first store did not change.` | Blanket no-change claim contradicted by the local schema. | `EventStoreProvider.tsx` version 6 adds `assessmentAttempts` and `assessmentContentCache`; version 7 adds `masteryCache`. The booking model and session logging are unchanged, but the store is not. | "Store" may mean the event log and booking substrate, not the Dexie schema. | High | High | Say the booking model and session logging did not change; state that the store gained Phase II attempt and mastery tables. |
| E-03 | `04-methodology.tex:52` | `Retrieval recall at 3 is 0.733.` | Unlabeled baseline metric; conflicts with the selected retrieval arm. | Chapter 3 NFR-9 and Chapter 6 Table `tab:res-retrieval` report recall at 3 of 0.90 for `hybrid_rerank` on the 754 split. The harness report gives 0.7333 for its retrieval row. The chapter does not name the arm or the split. | The number may be the plain retrieval arm behind generation, copied from the harness summary. | High | High | Label the arm and split: "the harness's plain retrieval arm reads 0.733; the selected `hybrid_rerank` arm reads 0.90." If the selected value is intended, use 0.90. |
| E-04 | `04-methodology.tex:52` | `The bkt-v1 AUC is 0.888 against 0.889 for the running-proportion baseline.` | Metric from a different evaluation cut placed under "the generation-quality harness". | The harness report lists bkt-v1 at 0.7397 and running-proportion at 0.7368. The 0.888/0.889 pair is the separate bake-off pair repeated in Chapter 2 and Chapter 6. "Running-proportion baseline" therefore names two different values on two cuts. | Two offline artifacts were compressed into one paragraph during drafting. | High | High | Name the bake-off cut and sample, and distinguish 0.888/0.889 from the live-harness 0.7397/0.7368. |
| E-05 | `04-methodology.tex:50, :67` | `Both legs ran before selection` and `before the approach is selected` | Timeline claim conflicts with the post-fix replay and Section 4.4. | Chapter 6 dates the replay after the gate fix and calls it validation. Section 4.4 says the third move closed the loop after implementation. If "selection" means the final gate choice, say so; as written, the reader sees selection before comparison and validation before selection. | The methodology may describe the intended evaluation order rather than the development chronology. | High | High | "The offline leg informed selection; the longitudinal replay validated the selected loop after the gate fix." Or define "selection" explicitly. |
| E-06 | `04-methodology.tex:71` | `the project scores conversion with next-week adherence` | Metric conflation. | Conversion is scored by the exact `verdictId`/`verdictDecidedAt` join to `RoadmapReplanned`. Next-week adherence is a separate outcome and reads 0.000 for all four. The sentence implies adherence measures conversion. | Shorthand for two outcomes measured in the same replay. | High | High | "Conversion is scored by the exact verdict-replan join; next-week adherence is reported separately at 0.000 with its caveat." |
| E-07 | `04-methodology.tex:88` | `next-week adherence rebound` | Table claims a rebound that the results do not report. | Chapter 6 reports next-week adherence at 0.000 for all four, with no sessions after the replan. The rebound belongs to the separate dip-window replay, not to next-week adherence. | The row may compress the adherence null and the dip-window result. | High | High | "Verdict-to-replan conversion (4 of 4 post-fix); next-week adherence 0.000 (measured zero, rebound-era caveat)." Put the dip-window rebound in its own row or sentence. |
| E-08 | `04-methodology.tex:47` | `Two honest limits stay on record.` | Count and scope mismatch; omission of the difficulty null. | The paragraph then lists coding refusal, Phase I continuity, CUSUM, and the conformal correction. The harness gate actually fails on `difficultyMeanAbsBandError` unmeasured, and Chapter 6 reports difficulty calibration unmeasured and next-week adherence 0.000. "Two" is not borne out, and the paragraph omits the two clearest nulls. | The caveat block may have been written before the difficulty and adherence results were finalized. | High | High | Drop the count. Name the actual limits: coding coverage, difficulty unmeasured, next-week adherence 0.000, and the conformal correction unshipped. Separate continuity from limitation. |
| E-09 | `04-methodology.tex:96` | `the synthetic replay proving \texttt{suggest\_replan} converts to a replan` | Overclaim from four synthetic cases. | Four of four is evidence, not proof. Chapter 6 presents the same result with caveats. | "Proving" used informally. | High | Medium | "showing that `suggest_replan` converted to a verdict-linked replan in all four synthetic histories." |
| E-10 | `04-methodology.tex:71` | `Every replan extends the deadline.` | Scope overreach. | The four verdict-linked replans all select `extend-deadline`; the post-fix evidence also notes scripted replans, and the chapter tests no general rule. "Every replan" is broader than the evidence. | Shorthand for the four table rows. | High | Medium | "Each of the four converted replans selected `extend-deadline`." |
| E-11 | `04-methodology.tex:71` | `Development histories stay separate from evaluation histories, so a win reflects behavior instead of fitting.` | Unverified split plus behavior overclaim. | The dated replay artifact lists four users, not a named development/evaluation split. The histories are seeded scripts, and the conversion follows planted posture, not general learner behavior. | Methodological boilerplate carried from Phase I. | Medium | Medium | Name the split and its size, or mark "needs verification." Say the replay tests the planted posture, not "behavior." |
| E-12 | `04-methodology.tex:7, :27` | `the middle band` | Stale router terminology. | `route_loop_action` holds when evidence is below 0.5 or confidence is below 0.7. There is no separate middle-band branch in the current loop router; the phrase appears to survive from the suitability router. | Old two-threshold vocabulary retained after the loop gate changed. | High | Medium | Remove "middle band." If a band is intended, name both thresholds; otherwise say "confidence below 0.7." |
| E-13 | `04-methodology.tex:21` | `The adaptive chip then maps the estimate to a difficulty recommendation.` | Missing caveat. | Chapter 3 FR-11 says the recommendation is advisory and not calibrated; Chapter 6 says the chip stays uncalibrated-advisory. The methodology presents the chip without that limit. | The caveat may have been deferred to the results chapter. | High | Medium | Add "advisory and uncalibrated" and cross-reference Section 6.1. |
| E-14 | `04-methodology.tex:71` | `Confidence reads 1.0` | Ambiguous statistic. | This is the Jev verdict confidence, not a statistical confidence interval. "Sufficiency" is also a judge score and is undefined in this chapter. | Project shorthand. | High | Low | "Verdict confidence reads 1.0; the judge's evidence-sufficiency score ranges 0.66 to 0.77." |
| E-15 | `04-methodology.tex:98` | `the capability list it delivers sits in Sections~3.3 and~3.4` | Cross-reference content mismatch. | Section 3.3 is the functional requirements (capabilities); Section 3.4 is the non-functional requirements (qualities). "Capability list" mislabels 3.4. | Shorthand for "requirements." | High | Low | "the requirements sit in Sections 3.3 and 3.4," or name the functional and non-functional sets separately. |
| S-01 | `04-methodology.tex:7` | `The verdict is advisory and gated.` | Bare `gated` at first use. | The gate constant appears only at line 27, and the evidence threshold is never named. The sentence asks the reader to accept a control claim before the control is specified. The lint rule keeps `gated` only with a named metric or lock beside it. | The next sentences describe the hold rule, so the term is not empty. | High | Low | "The verdict is advisory and passes a code gate." Or move the gate constant and evidence threshold into this paragraph. |
| S-02 | `04-methodology.tex:98` | `This section states the path once.` and `Nothing here restates either.` | Meta-commentary and defensive claim. | The sentences describe the writing rather than the method. "Nothing here restates either" is unverifiable and invites the reader to check for repetition. | The author is trying to avoid duplication across chapters. | High | Medium | Delete both sentences. Keep one cross-reference: "Section 1.2 states the problem; Sections 3.3 and 3.4 state the requirements." |
| S-03 | `04-methodology.tex:128` | `The loop that stayed dashed in Phase~I runs solid here.` | Repeated rhetorical closer. | The same sentence closes Chapter 6. The architecture figure still has a dashed sidecar arrow, so "solid" also invites a visual mismatch. | Deliberate continuity motif. | High | Medium | Replace with a specific claim about the implemented loop; keep at most one occurrence across the report. |
| S-04 | `04-methodology.tex:103, :124` | `folded inside` | Repeated project phrase. | Two occurrences here and one in Chapter 5. It is vivid but not a technical term. | Preferred author phrase. | High | Low | "runs as a hosted-API client inside the service" once; vary or drop the other occurrences. |
| S-05 | `04-methodology.tex:39, :41, :87` | `Server-authoritative arm per family; hidden tests never reach the browser` | Semicolons in table cells. | The same semicolon pattern appears in `Gated ladder with locked reveal; advisory-only \texttt{feedback-v1} copy` at line 41 and `Live pass counts (guide 2 of 2, feedback loop 3 of 3); copy never alters the grade` at line 87. The local lint flags STE 8.1 at all three lines. Table cells read as body prose. | Compact table style. | High | Low | Replace each semicolon with a comma or period. |
| S-06 | `04-methodology.tex:21` | `The tie went to the simpler, per-skill model` | Ambiguous comparison. | The preceding sentence compares the Bayesian variant with the running-proportion baseline. BKT is not simpler than that baseline; "simpler" only makes sense against the deep and hybrid candidates. | Shorthand. | High | Medium | "Among the deep and hybrid candidates, the per-skill updater was the simplest at parity; its estimate is inspectable." |
| S-07 | `04-methodology.tex:40, :52`; `06-results.tex:57`; `07-conclusion.tex:13` | `bkt-v1`; `Bkt-v1` | Model-name capitalization and formatting drift. | Chapter 4 uses plain lowercase; Chapters 6 and 7 capitalize at sentence start; Chapter 3 uses `\texttt{bkt-v1}`. | Sentence-initial capitalization and formatting drift. | High | Low | Use one form throughout, preferably `\texttt{bkt-v1}` or lowercase `bkt-v1`. |
| S-08 | `04-methodology.tex:103` | `The graphics sidecar` | Terminology drift. | Chapter 3 calls it the "GPU inference sidecar"; Chapter 5 calls it the "Embedding sidecar" and the "embedding and rerank sidecar." `graphics sidecar` is a third name in a chapter that otherwise uses precise tier names. | Natural variation. | High | Low | Use "GPU inference sidecar" consistently. |

## 4. Sentence-level review

| ID / location | Original sentence or short excerpt | Issue category | Diagnosis | Suggested revision or question | Rationale |
|---|---|---|---|---|---|
| L1 `04-methodology.tex:24` | `Feedback copy stays advisory in the same way: a server endpoint drafts learner-facing text for updated entries through the \texttt{feedback-v2} template with a static fallback, and the copy never alters the grade.` | Long sentence; vague comparison | The sentence runs past the 25-word cap, and "in the same way" does not say whether feedback is gated like guidance or merely advisory. | "Feedback copy is also advisory. A server endpoint drafts learner-facing text for updated entries through the `feedback-v2` template, with a static fallback. The copy never alters the grade." | Splits the claim, removes the ambiguous comparison, and keeps the version and fallback. |
| L2 `04-methodology.tex:50, :67` | `Both legs ran before selection` / `before the approach is selected` | Timeline and claim-evidence | The post-fix replay is dated after the gate fix and is described as validation. The sentence presents it as pre-selection. | Ask: did the offline leg inform per-stage selection and the replay validate the assembled loop? If so, write that; otherwise name the selection point. | Removes the contradiction without inventing a chronology. |
| L3 `04-methodology.tex:52` | `Retrieval recall at 3 is 0.733.` | Metric labeling | The number is unlabeled and conflicts with the selected 0.90 in Chapters 3 and 6. | "The harness's plain retrieval arm reads r@3 0.733; the selected `hybrid_rerank` arm reads 0.90 on the 754 split." | Preserves the baseline number while naming the selected value. |
| L4 `04-methodology.tex:52` | `The bkt-v1 AUC is 0.888 against 0.889 for the running-proportion baseline.` | Metric labeling | The pair belongs to the separate bake-off cut, not the generation-quality harness. The baseline name covers two different values. | "On the separate mastery bake-off, bkt-v1 reads 0.888 against 0.889; the live harness reads 0.7397 against 0.7368." | Keeps both results and removes the population ambiguity. |
| L5 `04-methodology.tex:71` | `Each run ends in a loop verdict joined to its replan, and the project scores conversion with next-week adherence.` | Metric conflation | Holds do not join a replan, and adherence is not the conversion metric. | "Each run ends in a loop verdict. A `suggest_replan` verdict is converted when its exact pair joins a `RoadmapReplanned`; next-week adherence is reported separately." | Separates verdict production, conversion, and adherence. |
| L6 `04-methodology.tex:71` | `Every replan extends the deadline.` | Scope overreach | Only the four verdict-linked replans are shown to select `extend-deadline`. | "Each of the four converted replans selected `extend-deadline`." | Matches the evidence table. |
| L7 `04-methodology.tex:71` | `Development histories stay separate from evaluation histories, so a win reflects behavior instead of fitting.` | Claim-evidence | The split is not named in the dated artifact, and the histories are scripted. | "Development histories are separate from evaluation histories [name the split]; the replay tests the planted posture rather than learner behavior." | Preserves the methodological intent while removing the overclaim. |
| L8 `04-methodology.tex:88` | `next-week adherence rebound` | Evidence mismatch | Chapter 6 reports 0.000, not a rebound. | "next-week adherence 0.000 (measured zero, rebound-era caveat)" | Aligns the table with the result. |
| L9 `04-methodology.tex:96` | `Bookings, session logging, and the local-first store did not change.` | Factual consistency | The Dexie schema gained Phase II tables. | "The booking model and session logging did not change; the store added Phase II attempt and mastery tables." | Preserves the intended continuity claim and fixes the scope. |
| L10 `04-methodology.tex:96` | `the synthetic replay proving \texttt{suggest\_replan} converts to a replan` | Overclaim | Four synthetic cases do not prove a general conversion rule. | "the synthetic replay showing that `suggest_replan` converted to a verdict-linked replan in all four histories" | Keeps the result and drops "proving." |
| L11 `04-methodology.tex:98` | `This section states the path once.` | Meta prose | The closing sentence, `Nothing here restates either.`, makes the same move. Both describe the writing rather than the design. | Delete both; keep "Section 1.2 states the problem; Sections 3.3 and 3.4 state the requirements." | Removes self-referential commentary. |
| L12 `04-methodology.tex:128` | `The loop that stayed dashed in Phase~I runs solid here.` | Rhetorical closer | The metaphor is repeated in Chapter 6 and does not add a technical claim. | "The closed loop is implemented; Figure 4.2 shows where each stage runs." | Replaces the motif with the figure's actual content. |
| L13 `04-methodology.tex:7` | `The verdict is advisory and gated.` | Evaluative shorthand | `gated` has no named gate beside it; the constant arrives at line 27. | "The verdict is advisory and passes a code gate." Or move `LOOP_APPROVE_AT` and the evidence threshold here. | Keeps the control claim but names it. |
| L14 `04-methodology.tex:21` | `The tie went to the simpler, per-skill model because the loop needs an estimate the learner can inspect.` | Logic and clarity | "Simpler" is ambiguous against the running-proportion baseline; the inspectability rationale is the real reason. | "Among the deep and hybrid candidates, the per-skill updater was the simplest at parity; its estimate is inspectable, so the project kept it as bkt-v1." | Preserves the choice and removes the false simplicity comparison. |

## 5. Chapter-level pattern map

| Pattern family | Distribution | Strongest examples | Writing issue | Highest-value revision |
|---|---|---|---|---|
| Stale or unlabeled evidence | Repeated in the two tables and the offline-leg paragraph | `feedback-v1` at line 41; `0.733` and `0.888/0.889` at line 52; `rebound` at line 88 | The chapter's numbers come from different evaluation artifacts and cuts, but the prose presents them as one coherent result set. | Reconcile every table and paragraph value with Chapter 6 and the dated artifacts; label every metric with arm, split, and population. |
| Meta and rhetorical framing | Repeated at lines 47, 96, 98, and 128 | `Two honest limits`; `proving`; `states the path once`; `Nothing here restates either`; `runs solid here` | The prose comments on its own honesty, economy, or continuity instead of stating the method. | Delete the meta claims; keep the cross-references and the technical result. |
| Repeated project phrases | Cross-chapter | `folded inside` in 4.5 (twice) and Chapter 5; `dashed/solid` in 4.5 and Chapter 6; `reads` for metrics in 4.3 and Chapter 6 | A small set of vivid phrases carries too much of the explanation. | Keep one occurrence of each, define it once, and use plain technical verbs elsewhere. |
| Formulaic subsection template | Sections 4.2.1 to 4.2.5 | Most subsections run candidates, a rejected option, a selected shape, and a rationale; 4.2.2 and 4.2.4 are thinner on candidates | The uniformity is appropriate for a methodology chapter, but the rationale is thinner where the caveats are missing. | Keep the structure; add the missing advisory and calibration limits in 4.2.3 and the difficulty null in 4.2. |
| Table and body divergence | Two tables | `feedback-v1`; `feedback loop 3 of 3`; `next-week adherence rebound`; `the baseline` | The tables were updated at different times from the body and results. | Make the tables a single reconciliation pass with Chapter 6. |
| Over-length sentences and table punctuation | Lines 24, 73, 94, 96; table cells 39, 41, 87 | The feedback sentence, the live-matrix sentence, the Phase-I design sentence, the third-move sentence | Long sentences compress two or three claims; semicolons in cells hide the same compression. | Split at the claim boundaries; use commas or periods in table cells. |

The chapter's transitions are otherwise conventional and clear. The opening roadmap is five sentences, above the guide's 2-4 preference but within the six-sentence cap; the lint records this as a guide note, not a hard fail. The strongest single revision is to reconcile the evidence labels in Section 4.3, because those errors affect what the chapter claims was measured.

## 6. Academic integrity and evidence checks

### Verified against live code or dated evidence

| Claim | Location | Evidence checked | Status |
|---|---|---|---|
| `feedback-v2` is the delivered template | Body line 24; table line 41 | `FEEDBACK_PROMPT_TEMPLATE_VERSION = "feedback-v2"` in `services/intelligence/app/generation/prompts.py`; `routers/feedback.py` imports it | Body verified; table contradicts it. |
| Jev `jev-1.13` through a hosted API | Line 27 | `JEV_MODEL_DEFAULT = "jev-1.13"` in `services/intelligence/app/jev/client.py`; `.env.example` | Verified. |
| `LOOP_APPROVE_AT` is 0.7 | Line 27 | `services/intelligence/app/jev/questions.py:32` | Verified. |
| `Keep` writes no event | Line 7 | Feedback section tests and the advisory-never-writes contract | Verified by the project evidence. |
| `RoadmapReplanned` mirrors the verdict pair | Lines 7, 96 | `verdictId`/`verdictDecidedAt` mirror in the closed-loop follow-up; post-fix JSON | Verified. |
| 4 of 4 conversions, confidence 1.0, sufficiency 0.66-0.77, 32-day span | Line 71 | `synthetic-users-results-2026-10-19-postfix.json`; `2026-10-22-synth-extract-emission.md`; Chapter 6 | Verified. |
| Groundedness 0.8667, near-duplicate 0.0044 | Line 52 | `research/doc/generation-quality-harness/report.md:27,42` | Verified. |
| Coding derivability 0.0 on the golds | Line 52 | Chapter 6 Table `tab:res-generation` | Verified in the chapter table. The harness report's coding block gives live derivability 0.5349 and gold agreement 1.0, not the 0.0 gold result. |
| Live 2 of 2, 4 of 4, 3 of 3 | Line 73 | Chapter 6 live-verification section, lines 76-79 | Verified. |
| Three fold hashes at K=5 | Line 52 | `services/intelligence/scripts/eval_golds.json`: three folds, `attemptGateK` 5 | Verified. |

### Mismatches and unresolved claims

- **`feedback-v1`:** the table is stale or ambiguous. The delivered template is v2; v1 survives only as fallback words. The table should say which is meant.
- **Local-first store unchanged:** contradicted by Dexie versions 6 and 7. The intended claim is probably "the booking model and session logging did not change."
- **Retrieval 0.733:** matches the harness's plain retrieval row, not the selected `hybrid_rerank` 0.90 in Chapter 3 and Chapter 6. The chapter needs the arm and split label.
- **AUC 0.888/0.889:** the pair appears in Chapter 2 and Chapter 6 as the separate bake-off, while the generation-quality harness reports 0.7397/0.7368. The chapter places the pair under the harness paragraph. This is a population-label error, not a fabricated number.
- **Both legs before selection:** the post-fix replay is dated 2026-10-19 and is described as validation after the gate fix. If "selection" means the final 0.7 gate, say so; otherwise the sentence conflicts with Section 4.4 and Chapter 6.
- **Conversion scored with next-week adherence:** conversion is the exact verdict-replan join. Adherence is a separate outcome and reads 0.000.
- **Next-week adherence rebound:** the measured value is 0.000. The rebound is a dip-window result, not an adherence result.
- **Middle band:** the current `route_loop_action` has an evidence gate at 0.5 and a confidence gate at 0.7, with no middle-band branch. The phrase is stale.
- **Every replan extends the deadline:** the four verdict-linked replans select `extend-deadline`; the claim is not tested for all replans, and the post-fix evidence notes scripted replans.
- **Development/evaluation split:** the claim is not named or sized in the dated artifact. Needs verification.
- **"Behavior" in the synthetic replay:** the histories are seeded scripts, and the conversion follows planted posture. The chapter should say "planted posture," not "behavior."
- **`feedback loop 3 of 3`:** Chapter 6 calls this the feedback-copy check. The table label is ambiguous.

### Citation and reference integrity

- The chapter cites `islam2024` once, at line 94. The key exists in `main.tex` and the entry supports the predict-then-optimize starting point. No dangling citation key was found.
- No placeholder, TODO, "verify citation," or editorial note was found.
- The chapter names the Bayesian mastery updater, CUSUM, projection, and split-conformal correction without direct citations. Chapter 2 covers BKT and hybrid tracing; the change-detection, projection, and conformal methods rely on the Phase-I report. If the venue expects a source for each named method, add cross-references or citations. This is a "needs verification" item, not a claim that a citation is missing or fabricated.
- `Jev-1.13` and Piston are named without bibliography entries. They are implementation dependencies, not literature claims; verify the venue's policy before adding references.
- The retired 788-split headline is mentioned in Chapter 6 but not in Chapter 4. No inconsistency was found in this chapter.

## 7. Prioritized action list

### 1. Fix before submission

1. Change `feedback-v1` to `feedback-v2` in Table 4.1, or write `feedback-v2 with v1 fallback` if that is the intended referent (E-01).
2. Narrow "the local-first store did not change" to the booking model and session logging, and mention the new Dexie tables (E-02).
3. Label or correct the retrieval 0.733 value: plain arm versus selected `hybrid_rerank` 0.90 (E-03).
4. Label the 0.888/0.889 pair as the separate bake-off cut and distinguish it from 0.7397/0.7368 (E-04).
5. Reconcile the "both legs ran before selection" timeline with the post-fix replay and Section 4.4 (E-05).
6. Separate conversion from next-week adherence in the text and in Table 4.2 (E-06, E-07).
7. Replace "next-week adherence rebound" with the measured 0.000 and put the dip-window rebound elsewhere (E-07).

### 2. Improve scholarly argument

1. Rewrite the "two honest limits" paragraph around the actual limits, including difficulty unmeasured and adherence 0.000 (E-08).
2. Replace "proving" with "showing" and scope the claim to the four synthetic histories (E-09).
3. Scope "every replan" to the four converted replans (E-10).
4. Name the development/evaluation split or mark it "needs verification"; replace "behavior" with "planted posture" (E-11).
5. Remove or define "middle band"; name the evidence threshold if it is intended (E-12).
6. Add the advisory and uncalibrated status of the difficulty chip (E-13).
7. Define "confidence" and "sufficiency" as judge outputs, not statistical confidence (E-14).
8. Fix the Section 3.3/3.4 "capability list" label (E-15).

### 3. Improve style and reduce redundancy

1. Replace the bare `gated` at line 7 with a named gate (S-01).
2. Delete "This section states the path once" and "Nothing here restates either"; keep one cross-reference sentence (S-02).
3. Keep one "dashed/solid" closing sentence across Chapters 4 and 6, or replace both with a technical statement (S-03).
4. Reduce `folded inside` to one occurrence (S-04).
5. Replace table-cell semicolons with commas or periods (S-05).
6. Rewrite the "simpler" comparison so it names the candidate set (S-06).
7. Standardize `bkt-v1` and "GPU inference sidecar" (S-07, S-08).

### 4. Optional polish

1. Compress the five-sentence roadmap to three or four sentences and vary "states."
2. Replace "Supabase hubs the data" with "Supabase acts as the data hub."
3. Make Table 4.2 rows parallel: either all metric definitions or all values.
4. Rename "feedback loop 3 of 3" to "feedback copy 3 of 3."
5. Replace "Jev \texttt{jev-1.13}" in Table 4.1 with "the Jev judge" and keep the model id in the body, or with "Jev (\texttt{jev-1.13})".

## 8. Overall conclusion

The chapter's dominant patterns are not generic academic filler. They are a cluster of stale labels, mixed evaluation artifacts, and self-referential framing. The technical prose is specific enough that the main risk is a reader trusting a number or a version label that no longer matches the delivered system. The strongest examples are the `feedback-v1` table entry, the unchanged-store claim, the unlabeled 0.733 and 0.888/0.889 metrics, the conversion/adherence conflation, and the "two honest limits" paragraph.

The stylistic patterns are secondary: repeated meta-commentary, the dashed/solid motif, `folded inside`, table semicolons, and four over-length sentences. They are easy to fix once the evidence labels are reconciled.

This is a qualitative review, not a validated AI detector. It cannot establish authorship or misconduct, and it should not be used as an AI-likelihood score. The findings are reproducible from the cited file bytes, the named chapters, and the dated evidence.

## 9. Writing-review priority

**3 - major issue affecting argument, evidence, consistency, or submission readiness.**

This is a writing-review priority under the skill's 0-3 rubric. It is not an AI-likelihood score and should not be combined with any other number to produce one.

## 10. Resolution (2026-10-23)

All P0 and P1 rows applied from evidence-backed author defaults (Q-01 to Q-05 answered in the plan record).
Table 4.1 now says `feedback-v2 with v1 fallback`; the store claim matches Dexie versions 6 and 7; retrieval 0.733 and bake-off 0.888/0.889 carry their arm and cut; conversion and adherence are separate; the limits paragraph names coding refusal, difficulty unmeasured, adherence 0.000, and the conformal correction.
The `middle band` is gone; the 0.5 evidence floor and 0.7 confidence gate are named.
Final lint: STE PASS, Humanizer PASS.
Grill follow-up: C4-24 approved and applied (`Supabase acts as the data hub`); C4:52 now reads `0.0 on the pre-top-up run` per the Q-12 pattern. Nothing open in this chapter.
