# AI Writing Pattern Audit

## 1. Scope

- **Material reviewed:** `college/mydeliverables/Phase-2-report/phase2-report/chapters/05-implementation.tex`, all 237 lines (about 1,565 words of prose, three tables, one listing, five flow figures, five screenshots), read in full from the current working tree.
- **Coverage:** Full chapter: opening roadmap, 5.1 development environment, 5.2 datasets, 5.3 model and service implementation, 5.4 reproducibility, 5.5 and all five subsections. Context read: `main.tex`, `03-requirements.tex`, `04-methodology.tex`, `06-results.tex`, `REPORT_WRITING_GUIDE.md`, Phase-I `05-implementation.tex`, `research/doc/2026-10-22-reranked-754.md`, `research/doc/2026-10-22-endpoint-retrieval.md`, and the live packages and services named in the chapter.
- **Genre/discipline:** M.Tech dissertation, implementation chapter, computer science and data science. Line numbers are current working-tree bytes, not `HEAD`.
- **Limitations of the supplied material:** The chapter is descriptive and figure-heavy, so the sample is small for document-level prose-pattern inference. No external detector report was supplied, and none is reproduced. No AI/human verdict is offered.
- **Verification note:** Every excerpt below was re-read from the file with `sed -n` before writing. The lint command was `python3 .work/active/phase2-prose-review/ste_check.py college/mydeliverables/Phase-2-report/phase2-report/chapters/05-implementation.tex`. Current result: STE FAIL 14 fail-tier hits, Humanizer FAIL 1 fail-tier hit, plus judge/info rows. The lint is supporting evidence only; each finding below stands on its own.
- **Confidence:** Confidence means confidence that the stated textual pattern is present, not confidence about who wrote the text.

## 2. Executive assessment

The chapter is technically specific and mostly free of the usual synthetic-prose markers. It has no inflated significance claims, no "plays a crucial role" vocabulary, no forced triads (the three-part reproducibility list is three real facts, not padding), no em dashes in body prose, no placeholder residue, and no repeated paragraphs. The BKT listing matches the shipped filter exactly. The model identifiers, ports, and editor stack check out against live code. These observations do not establish whether the text was written by a human, an AI, or a combination.

The main risks are not vocabulary. They cluster in four places. First, Table 5.1 says "last six rows" but has seven Phase-II rows, and the prose names only five of the seven. Second, the 5.5 section uses a uniform per-capability template: one 8-9 sentence paragraph, one flow figure, one screenshot, and a figure-pointer closer, repeated five times. Third, the chapter drifts on names and objects: "Phase-2" beside "Phase-II", "Phase-I" beside the report's "Phase~I", "attempt" for an assessment, and "Targeted guidance" beside the fixed "Targeted explanation". Fourth, the reproducibility paragraph labels traceability and opt-in gating as reproducibility, and claims a reader can re-run both legs "from versioned files" when the offline harness also needs Supabase, the sidecar, and a paid judge.

The chapter is close to submission-ready. The High findings are localized and fixable without rewriting the argument.

## 3. Findings table

### 3.1 Stylistic findings

| ID | Location | Exact excerpt | Observable pattern | Why it merits review | Plausible non-AI explanation | Confidence | Priority | Recommended action |
|---|---|---|---|---|---|---|---|---|
| S1 | `05-implementation.tex:125-215` | "Figure~\ref{fig:appflow1} shows the flow at this first stage." | Every 5.5 subsection is one paragraph, one flow figure, one screenshot, and a figure-pointer closer; the same rhythm repeats five times. Figure 5.1 is a single box with no edge. | The template gives equal space to unequal material: materials ingestion gets the same treatment as the closed loop. The first "flow" is not a flow. | A deliberate per-capability template, plus the guide's per-subsystem figure convention and the Phase-I screenshot habit. | High | Medium | Keep one cumulative flow figure, or give each stage a real intra-stage diagram. Cut the single-node Figure 5.1. Vary the closers. |
| S2 | `05-implementation.tex:126,146,168,191,215` | "A material enters through the create page. The source grid offers plain text, PDF upload, and web article side by side." | Each 5.5 subsection is one paragraph of 8-9 sentences (STE 6.6 fail). | Long single paragraphs bury the guarantee or boundary that matters in each subsection. | The author compressed a feature checklist into one block per capability. | High | Medium | Split at the natural pivots: 126 after "a retry action."; 146 after "across calls."; 168 after "no client result enters the record."; 191 after "observation."; 215 after "never alters a grade." Keep every fact. |
| S3 | `05-implementation.tex:2` | "Section~5.4 states the metrics and the steps taken for reproducibility." | The roadmap promises that 5.4 states the metrics; 5.4:118 says the metrics are defined in Chapter 4 and only reproducibility is recorded. The paragraph is six sentences with five parallel "Section~5.x" sentences, near-verbatim from Phase-I `05-implementation.tex:2`. | It sets a false expectation in the first paragraph and reads as a reused scaffold. | The guide requires a roadmap paragraph, and the Phase-I chapter supplied the shape. | High | Low-Medium | Use three or four sentences. Change 5.4 to "records how the metrics are kept reproducible." Keep the section pointers. |
| S4 | `05-implementation.tex:5,62,112` | "That keeps the evaluated code and the shipped code identical." | The same guarantee appears three times: line 5 states the outcome, line 62 gives the import mechanism and repeats the outcome, line 112 says the harness imports the production engines. | Repetition without new information; the reader gets the point at line 5 and again at line 62. | Phase-I continuity, plus a deliberate split between chapter framing and implementation detail. | High | Medium | Keep the mechanism at line 62, delete the outcome at line 5 or cross-reference it, and trim the table row to "imports the production engines". |
| S5 | `05-implementation.tex:123` | "The working application realizes the selected models. This section presents that application in full." | Generic chapter framing plus an overclaim. The next sentences say the Phase-I substrate is unchanged, and the section covers only the five Phase-II additions. The same paragraph also says "A flow diagram builds up across the subsections", which describes the document rather than the system. | "In full" is not true: onboarding, session runtime, progress views, and the local-first data layer are named and then skipped. The flow-diagram sentence is document-facing filler. | The sentence is a compressed carry-over from the abstract and Phase-I `05-implementation.tex:96`. | High | Medium | "This section presents the Phase-II additions; the Phase-I screens are unchanged." Drop "in full" and cut the flow-diagram sentence. |
| S6 | `05-implementation.tex:118,123` | "instead of redefining them" / "nothing here restates them" | Two defensive meta-claims in one chapter; Ch04:98 uses the same move ("Nothing here restates either"). | The chapter tells the reader what it will not do, then does restate guarantees ("The server grade stays final", "the copy never alters a grade"). The disclaimer adds no content and repeats across chapters. | The author wanted to prevent duplication. | High | Low | Delete both disclaimers; keep the section cross-references. |
| S7 | `05-implementation.tex:2,122,5` | "the delivered Phase-2 application" / "\section{The Phase-2 Application}" / "the Phase-I repository shape" | Three naming conventions in one chapter: "Phase-II", "Phase-2", "Phase-I". The rest of the report uses "Phase~I" and "Phase~II". | The heading and TOC show "Phase-2" while the chapter prose mostly says "Phase-II". "Phase-I" is the only hyphen form in the report. | A late find/replace and a reused Phase-I scaffold. | High | Medium | Use "Phase~II" and "Phase~I" throughout, including the heading, or define one convention and hold it. |
| S8 | `05-implementation.tex:146,191,215` | "every attempt with its family and status" / "Targeted guidance" / "hands its verdict pair" | Term drift for the same objects: assessment vs attempt, "Targeted explanation" vs "Targeted guidance", "carries ... forward" vs "hands ... to". | The assessment library lists assessments, not learner attempts. Ch03:65 and Ch04:24 fix the ladder stage as "Targeted explanation". Ch04:7 uses "carries the verdict pair forward". | Paraphrase during compression. | High | Medium | Use "every assessment", "Targeted explanation", and "passes its verdict pair to the replan screen". |
| S9 | `05-implementation.tex:33,62,120,168,215` | "never grades" / "never re-implements" / "never fabricate a score" | A cluster of absolute negations: five "never" in body prose, plus "no client result", "no copies", "nothing", and "only". | Some are contractual and worth keeping (server authority, no hidden tests). Others are rhetorical and make the prose sound like a guarantee sheet. | Security and grading contracts genuinely need absolutes. | High | Low | Keep the contractual absolutes. Cut the rhetorical ones: "reports each state honestly", "a failed run ends there", and the repeated "never" where a plain statement works. |

### 3.2 Evidence and citation findings

| ID | Location | Exact excerpt | Observable pattern | Why it merits review | Plausible non-AI explanation | Confidence | Priority | Recommended action |
|---|---|---|---|---|---|---|---|---|
| E1 | `05-implementation.tex:5` and `:10` | "The last six rows add the Phase-II generation, judgment, grading, embedding, and editor dependencies." | The table has 11 Phase-I rows and 7 Phase-II rows, not 6. The list names five concerns and omits the feedback-copy model (line 29) and the code-execution sandbox (line 31). The caption repeats "last six". | A visible table/prose mismatch in the first section, and the omitted rows are central Phase-II components used later in 5.5.3 and 5.5.5. | A row was added after the sentence and caption were written. | High | High | "The last seven rows add the Phase-II generation, grading, feedback, judgment, sandbox, embedding, and editor concerns." Fix the caption too, with author approval because captions are held verbatim. |
| E2 | `05-implementation.tex:146` | "The assessment library lists every attempt with its family and status." | The object is wrong. The library lists assessments; an attempt is a learner answer. `AssessmentLibrary.tsx` renders `assessmentRows`, and `assessmentMeta` shows family, date, and question count. | It confuses two durable objects and weakens the traceability of the 5.5.3 review flow. | "Attempt" is used loosely for a generation run. | High | High | "The assessment library lists every assessment with its family and status." If the intent is runs, say "every generation run". |
| E3 | `05-implementation.tex:228` | "the verdict closes the loop onto the replan." | The figure is a linear chain: Materials -> Generation -> Taking/review -> Practice/guide -> Feedback/loop. There is no replan node and no back edge to the plan. Line 215 says "completes the chain", not "closes the loop". | A caption claims a loop the graphic does not draw, in the chapter whose subject is the closed loop. | The concept is carried by Ch04's closed-loop figure; the caption describes the concept rather than the drawing. | High | High | Add a replan node and a back edge to the plan, or retitle the caption "the verdict completes the chain". |
| E4 | `05-implementation.tex:123` | "This section presents that application in full." | Overclaim. The section presents five Phase-II additions; onboarding, the session runtime, progress views, and the local-first data layer are named as unchanged and not shown. | "In full" invites a reader to expect the whole application and then delivers only the Phase-II delta. | "In full" may mean "the Phase-II part in full". | High | Medium-High | "This section presents the Phase-II additions; the Phase-I screens are unchanged." |
| E5 | `05-implementation.tex:39` | "A single learner's real log cannot supply a known ground truth." | Unsupported universal. Ch01:39 says a real single-learner study "remains future work"; Ch06:102 uses synthetic histories with "known posture". A real log can supply ground truth for observed sessions and adherence; it cannot supply planted latent mastery and pace. | The comparison design needs a scope statement, not an impossibility claim. As written, it overstates what real logs can and cannot do. | Shorthand for "the comparison's planted properties need synthetic data". | High | Medium | "A single learner's real log does not supply a known ground truth for latent mastery and pace, so the Chapter 6 comparison runs on fixed artifacts." |
| E6 | `05-implementation.tex:120` | "Three facts carry the reproducibility claim. First, every gate fails closed by default." | Category mismatch. The harness "stays inert unless the caller passes `--activate`" is opt-in, not fail-closed. Request-ID tracing is traceability, not reproducibility. Only the third fact is re-runnability. "Every gate" is broader than the three examples. | The paragraph is the chapter's whole reproducibility argument. Mislabeling the properties weakens it. | The author grouped auditability, safety, and reproducibility as one claim. | High | Medium-High | "Three properties support the reproducibility claim." Separate the opt-in harness, the fail-closed loop and grading gates, and request-ID traceability. Scope "every gate" to "the evaluation and decision gates". |
| E7 | `05-implementation.tex:120` | "a reader can re-run both legs from versioned files." | Overclaim. The offline harness fetches chunks from Supabase (`eval_harness.py:611-660`), calls a paid judge (`:686-736`), and needs the sidecar; the golds are three separate files. The longitudinal leg's generator and replay evidence are not named by path. | Files alone do not re-run either leg. The claim hides credentials, services, and model access, which is the substance of reproducibility. | "Versioned files" means the pinned inputs, not the only requirement. | High | High | Name the full input set, the required services and credentials, and the replay paths. Say "from versioned inputs and the documented services". |
| E8 | `05-implementation.tex:123` | "This section follows the five Phase-II capabilities in order." | Partition mismatch. Table 4.1 has five stages (generation, grading, mastery, guidance/feedback, verdict). The chapter's five subsections add materials/ingestion and fold mastery into 5.5.4. Ch03 has seven Phase-II FRs and three NFRs. 5.5.1 has no Phase-II FR behind it. | A reader who tracks Table 4.1 to 5.5 will not find a mastery subsection, and cannot tell what the five are. The next sentence says the requirements sit in 3.3 and 3.4, which is not true for 5.5.1. | "Capabilities" is a UI grouping, not the Table 4.1 stages. | High | Medium | Name the five explicitly and map them to Table 4.1 and FR-9 to FR-15, or use the Table 4.1 stage names. |
| E9 | `05-implementation.tex:52` | "In-repository gold files: \texttt{eval\_golds.json} with probe, written, and coding sets; ACCA text at 754 chunks..." | Source conflation. The gold files are in-repo; the ACCA text is the hosted material that `eval_harness.py` fetches by `materialId`. The cell gives no edition, publisher, or year. | A reader cannot tell what is a file and what is a hosted corpus, or which ACCA text was used. The 754/768 figures are verifiable, but the provenance is not. | "Source" is being used for both the gold files and the corpus. | Medium-High | Medium | Split the cell. Name the gold files as in-repo, and identify the ACCA APM text by edition and the hosted material. |
| E10 | `05-implementation.tex:41,52` | "The Open University dataset calibrates the Phase-I generator only" | External dataset and textbook named without a citation. The chapter has no `\cite` commands. | OULAD and the ACCA text are third-party sources. A dissertation reader cannot check the version or edition from the chapter. | Implementation chapters often omit dataset citations. | High | Medium | Add an OULAD citation or version note and an ACCA source note. If the venue does not require tool citations, a dataset note is enough. Exact edition and version need verification. |
| E11 | `05-implementation.tex:60` | "asserts numeric equality to a tight tolerance." | Unquantified tolerance. The parity tests set `TOLERANCE = 1e-6` in both `py-progress` and `py-roadmap-engine`. | "Tight" is not reproducible, and the constant is available. | The author did not want to pin a harness constant in prose. | High | Low-Medium | "within a 1e-6 relative and absolute tolerance." |
| E12 | `05-implementation.tex:126` | "The library card reports each state honestly until the material reads ready." | Overbroad state claim plus an evaluative adverb. The next sentences say a ready card replaces the badge with a practice action, so the card does not report every state with a badge. | The sentence contradicts its own next two sentences, and "honestly" is not a testable property. | "Honestly" means the card never shows a false ready state. | High | Low-Medium | "The library card shows the material's current state until it is ready." |

## 4. Sentence-level review

| ID / location | Original sentence or short excerpt | Issue category | Diagnosis | Suggested revision or question | Rationale |
|---|---|---|---|---|---|
| SL1 `:2` | "Section~5.4 states the metrics and the steps taken for reproducibility." | Internal promise vs body | 5.4 explicitly defers the metrics to Chapter 4. | "Section~5.4 records how the metrics are kept reproducible." | Removes a promise the section does not keep. |
| SL2 `:5` | "The last six rows add the Phase-II generation, judgment, grading, embedding, and editor dependencies." | Factual count | Seven Phase-II rows; the list names five and omits feedback and sandbox. | "The last seven rows add the Phase-II generation, grading, feedback, judgment, sandbox, embedding, and editor concerns." | Matches the table and names all seven. |
| SL3 `:39` | "A single learner's real log cannot supply a known ground truth." | Unsupported universal | The report's own scope says a real study is future work, not impossible. | "A single learner's real log does not supply a known ground truth for latent mastery and pace in this design." | Keeps the methodological reason and drops the impossibility. |
| SL4 `:60` | "The algorithms stay implemented once in behavior and twice in code where the client must render them." | Clarity / opaque construction | "Implemented once in behavior" is hard to parse, and "render" is the wrong verb for computing an engine. | "Each algorithm has one behavioral definition. The client and service hold separate implementations only where the client must compute a view locally." | States the same design in plain terms. |
| SL5 `:60` | "asserts numeric equality to a tight tolerance." | Vague quantity | The tolerance is `1e-6`. | "within a 1e-6 relative and absolute tolerance." | Makes the parity check reproducible. |
| SL6 `:123` | "The working application realizes the selected models. This section presents that application in full." | Generic framing / overclaim | The sentence could open any implementation chapter; "in full" is false for the five-subsection section. | "The application realizes the selected models. This section presents the Phase-II additions; the Phase-I screens are unchanged." | Specific to this chapter and accurate. |
| SL7 `:123` | "This section follows the five Phase-II capabilities in order." | Undefined count | The five subsections are not the five stages of Table 4.1, and 5.5.1 has no Phase-II FR. | Ask: which five? Name them and map them to Table 4.1 and FR-9 to FR-15, or use the Table 4.1 stage names. | Removes a traceability gap. |
| SL8 `:126` | "The library card reports each state honestly until the material reads ready." | Internal contradiction / evaluative adverb | The ready card has no status badge, so the card does not report every state. | "The library card shows the material's current state until it is ready." | Accurate and testable. |
| SL9 `:146` | "The assessment library lists every attempt with its family and status." | Object error | The library lists assessments; attempts are learner answers. | "The assessment library lists every assessment with its family and status." | Uses the project's object names. |
| SL10 `:146` | "Only a run still marked generating retries in place, and a failed run ends there." | Ambiguity | "Ends there" can mean the run terminates or the retry path ends. The intended rule is that a failed run stays failed. | "Only a run still marked generating retries in place. A failed run stays failed." | States the terminal rule plainly. |
| SL11 `:191` | "It streams Nudge, Hint, and Targeted guidance..." | Term drift | Ch03 and Ch04 fix the stage as "Targeted explanation". | "It streams Nudge, Hint, and Targeted explanation..." | One name for one ladder stage. |
| SL12 `:191` | "shows the current estimate with its difficulty recommendation." | Missing caveat | Ch03:64 and Ch06:57 say the recommendation is advisory and uncalibrated. | "shows the current mastery estimate and its advisory, uncalibrated difficulty recommendation (Section 6.1)." | Preserves the limitation every other chapter states. |
| SL13 `:215` | "The ledger reads cold, updated, stale, or rebuilding from the cached mastery and the latest copy." | Grammar / unclear derivation | A ledger does not "read ... from" inputs; it derives a state. | "The ledger shows one of four states, cold, updated, stale, or rebuilding, derived from the cached mastery and the latest copy." | Makes the four states and their source explicit. |
| SL14 `:215` | "Only \texttt{suggest\_replan} hands its verdict pair to the replan screen." | Phrasal verb / term drift | Ch04:7 uses "carries the verdict pair forward". | "Only \texttt{suggest\_replan} passes its verdict pair to the replan screen." | Removes the phrasal verb and aligns with Ch04. |
| SL15 `:120` | "Three facts carry the reproducibility claim." | Category mismatch | Two of the three are safety and traceability; only the third is re-runnability. | "Three properties support the reproducibility claim." Then split into three paragraphs. | Names the claim accurately. |
| SL16 `:120` | "unless the caller passes \texttt{--activate}" | LaTeX rendering | The `--` byte pair triggers the lint and, under T1 fonts, can render as an en dash plus "activate". The safe source form is the literal pair. | `\texttt{-{}-activate}` | Preserves the literal CLI flag. Verify in the built PDF; no build was run for this audit. |

## 5. Chapter-level pattern map

**Pattern family A: inherited Phase-I scaffold.** The roadmap at line 2, the workspace paragraph at line 5, the client/service split at line 60, and the parity paragraph are close paraphrases of Phase-I `05-implementation.tex:2,5,54,56`. The reuse is transparent and legitimate in a two-phase report. The strongest example is line 2, which also carries the false 5.4 promise and the "Phase-2" drift. The highest-value revision is a three-sentence Phase-II-specific roadmap, not a wholesale rewrite.

**Pattern family B: per-capability template in 5.5.** All five subsections follow one paragraph, one flow figure, one screenshot, and a figure-pointer closer. This is the chapter's most visible regularity. The strongest examples are lines 126, 146, 168, 191, and 215. It matters because the first figure is a single box, the five diagrams duplicate prose, and the uniform space flattens the difference between ingestion and the closed loop. The highest-value revision is one cumulative flow figure plus real intra-stage diagrams only where a stage has more than one step.

**Pattern family C: repeated "evaluated = shipped" guarantee.** Lines 5, 62, and 112 state the same relationship. Line 62 adds the import mechanism; lines 5 and 112 only restate the outcome. The repetition is inherited from Phase I, where the claim appears at lines 5 and 56. Keep one statement and one cross-reference.

**Pattern family D: defensive meta-prose.** Lines 118 and 123 tell the reader what the chapter will not redefine or restate, and Ch04:98 uses the same move. The pattern is repeated across chapters and reads as template residue. The highest-value revision is to delete the disclaimers and keep the cross-references.

**Pattern family E: naming and object drift.** "Phase-2" vs "Phase-II" vs "Phase-I"; "attempt" vs "assessment"; "Targeted guidance" vs "Targeted explanation"; "hands ... to" vs "carries ... forward"; "PDF upload" vs the UI's "PDF document". This is the widest pattern family and the cheapest to fix. The heading at line 122 and the object error at line 146 are the visible cases.

**Pattern family F: trivial cumulative figures.** Figures 5.1 to 5.5 add one node at a time. Figure 5.1 is a single node, Figure 5.2 has two nodes and one edge, and the final figure is a linear five-node chain. The series is announced at line 123 as a build-up, but the result spends five floats on a diagram that one float could carry. The highest-value revision is one cumulative figure with all five stages and a back edge to the plan.

**Pattern family G: absolute guarantee language.** Five "never" in body prose plus "no client result", "no copies", "nothing", and "only". Most are contractual and should stay. The rhetorical ones ("reports each state honestly", "a failed run ends there") are the ones to cut. This family is low priority.

**Chapter-specific issues.** The chapter has no closing summary; the last sentence is a figure pointer. A two-sentence close that names the five additions and points to Chapter 6 would give the 5.5 build-up a destination. The 5.5.1 subsection is not one of the Table 4.1 stages and has no Phase-II FR behind it. The table caption and prose disagree on the Phase-II row count.

**Highest-value chapter revision.** Fix E1, E2, and E3 before any prose polish. Then split the 5.5 paragraphs (S2) and consolidate the flow figures (S1). Those four changes remove most of the chapter's readability and consistency risk.

## 6. Academic integrity and evidence checks

### Citation and reference integrity

- The chapter contains no `\cite` commands. There are no dangling citation keys and no bibliography mismatch.
- OULAD and the ACCA APM text are external sources named without a citation, edition, or version. A dataset note is the minimum. Exact edition and version need verification.
- The model identifiers, ports, and libraries are named without citations. This is common in an implementation table, but the venue's expectation needs verification.
- No placeholder, TODO, "verify citation", tracked-change note, or repeated paragraph was found.
- All `\ref` keys resolve: `tab:tools`, `tab:datasets`, `tab:packages`, `lst:bktforward`, `fig:appflow1` to `fig:appflow5`, `fig:appshot1` to `fig:appshot5`. `eq:bkt-update` is defined in Ch02:12. `fig:architecture` is defined in Ch04:125. `tab:phase2-metrics` is defined in Ch04:79.

### Factual and identifier verification

| Claim | Location | Evidence checked | Status |
|---|---|---|---|
| First eleven rows are the Phase-I stack unchanged | `:5` | Programmatic comparison with Phase-I `05-implementation.tex:16-26`; the header plus 11 data rows match exactly. | Verified. Do not change this count. |
| "The last six rows" | `:5`, `:10` | Rows 16-33: 11 Phase-I plus 7 Phase-II. | Incorrect. Seven Phase-II rows. |
| Prose list of Phase-II rows | `:5` | Rows 27-33: generation, rubric grading, feedback copy, judgment, sandbox, embedding, editor. Prose names five. | Incomplete. Feedback copy and sandbox omitted. |
| BKT listing matches the shipped filter | `:65-93` | `packages/py-progress/src/py_progress/mastery.py:83-117` matches the listing line for line, including defaults 0.15/0.1/0.05/0.2. | Verified. Do not change the listing. |
| Generation model, temperature, reasoning, timeout | `:27` | `services/intelligence/app/generation/factory.py:37-38` (0.3, off); `openrouter_client.py:92-93` (0.3, off, 30000 ms); `DEFAULT_MODEL`. | Verified. |
| Rubric-grading model and `GRADING_MODEL` | `:28` | `services/intelligence/app/worker_main.py:174`. | Verified. |
| Feedback model and `FEEDBACK_MODEL` | `:29` | `services/intelligence/app/routers/feedback.py:44,56`. "Reasoning effort low" is in the gitignored `.env` and required by `e2e/feedback-copy-live.spec.ts:30`; the tracked default is "off". | Model verified. "Low" is operator-env dependent, so the claim is not reproducible from tracked files. |
| Jev-1.13 and `OPENROUTER_JEV_API_KEY` | `:30` | `services/intelligence/app/jev/client.py:22,93`. | Verified. |
| Piston profile and port 2000 | `:31` | `docker-compose.yml:123-134` (image, `profiles: ["sandbox"]`, port 2000). | Verified. |
| Sidecar port 8200 and separate compose project | `:32` | `services/embedder/docker-compose.yml:44`. | Verified. |
| CodeMirror and Pyodide | `:33` | `apps/app/package.json` lists `@codemirror/*` and `pyodide ^0.27.8`; `advisoryRunner.ts` labels the check advisory. | Verified. |
| `eval_golds.json` carries folds and attempt gate | `:41` | JSON keys `folds`, `attemptGateK: 5`, and `corpus` with 754 chunks and 768 dimensions. | Verified. |
| Source cell combines in-repo golds with the hosted ACCA corpus | `:52` | `eval_harness.py:611-660` fetches chunks from Supabase by `materialId`; the text is not a repo file. | Ambiguous. The gold files are in-repo; the corpus is hosted. The cell does not say which is which. |
| Assessment library lists attempts | `:146` | `AssessmentLibrary.tsx` renders `assessmentRows`; `assessmentMeta` shows family, date, count; `StateTag` shows state. | Incorrect. It lists assessments. |
| Figure 5.5 closes the loop | `:228` | TikZ lines 221-226: M -> G -> T -> P -> F, no back edge and no replan node. | Incorrect as drawn. The prose at `:215` says "completes the chain". |

### Methodological and claim-evidence checks

- **Reproducibility (E6, E7).** The paragraph conflates opt-in activation, fail-closed decisions, traceability, and re-runnability. The offline harness needs Supabase, the sidecar, and a paid judge; the longitudinal leg's paths are unnamed. State the full input set and the services, or soften "from versioned files".
- **Identity claim (S4).** "Identical" and "a result about the shipped code" are stronger than the evidence. The harness imports the same engine modules, but it does not exercise the service wrapper or deployment configuration. Say "the same engine code" and name the shared path.
- **"Every gate fails closed" (E6).** The three examples support three gate families. The generation server gate rejects invalid input rather than failing closed. Scope the universal.
- **"In full" (E4).** The section presents five Phase-II additions, not the whole application. The Phase-I data layer is not described.
- **"Five Phase-II capabilities" (E8).** The count matches the five subsections, not Table 4.1's five stages and not the seven Phase-II FRs. 5.5.1 has no Phase-II FR behind it.
- **"Cannot supply a known ground truth" (E5).** The report's own scope statement says a real single-learner study is future work, not impossible. Scope the claim to latent mastery and pace.
- **Difficulty recommendation (SL12).** Ch03:64 says the recommendation is not calibrated and Ch06:57 calls the chip "uncalibrated-advisory". Ch05 drops the caveat. Add it.
- **Tolerance (E11).** The parity tests use `1e-6`, not an unnamed "tight" value. Naming it improves reproducibility without changing the design.

### Verified claims that should not be changed

- The first eleven table rows are identical to Phase I. The claim is true.
- The BKT listing is the shipped filter, not a simplified sketch. Every line matches `py_progress/mastery.py`.
- The model identifiers, `GRADING_MODEL`, `FEEDBACK_MODEL`, `OPENROUTER_JEV_API_KEY`, port 2000, port 8200, CodeMirror, and Pyodide all match live code.
- `eval_golds.json` carries the folds and `attemptGateK`, and the corpus is 754 chunks at 768 dimensions.
- The feedback ledger has exactly four states: cold, updated, stale, rebuilding. The LLM copy runs for `updated` only; the static fallback covers the other three.
- Only `suggest_replan` passes the verdict pair to the replan screen; `Keep` writes nothing; a confirmed replan mirrors the pair onto `RoadmapReplanned` and preserves plan identity.
- Practice runs resolve questions lazily and store no question copies; pause is leave-and-return; neither finish nor abandon invents an observation.
- The server grade is final and hidden tests, reference solutions, and authored accepted values never reach the browser.

## 7. Prioritized action list

**1. Fix before submission**

- Correct the Phase-II row count and the omitted rows in the prose and caption (E1). This is the most visible factual error.
- Replace "attempt" with "assessment" in the library sentence (E2).
- Make Figure 5.5 match its caption, or retitle the caption to "completes the chain" (E3).
- Rewrite the reproducibility paragraph so it names the services, credentials, and replay paths (E6, E7).
- Replace "in full" with the Phase-II delta (E4).
- Fix the "Phase-2" heading and the "Phase-I" spelling (S7).
- Fix `\texttt{--activate}` to `\texttt{-{}-activate}` (SL16).
- Identify the ACCA text and OULAD by edition/version and add a dataset note (E9, E10). Exact edition needs verification.

**2. Improve scholarly argument**

- Scope "cannot supply a known ground truth" to latent mastery and pace (E5).
- Map the five subsections to Table 4.1 and FR-9 to FR-15, or rename the grouping (E8).
- Add the advisory/uncalibrated caveat to the difficulty recommendation (SL12).
- Name the 1e-6 parity tolerance (E11).
- Add a two-sentence chapter close that names the five additions and points to Chapter 6.

**3. Improve style and reduce redundancy**

- Split the five 5.5 paragraphs at the pivots in S2.
- Consolidate the five flow figures or cut the single-node Figure 5.1 (S1).
- Delete the repeated "evaluated = shipped" outcome at line 5 and the table-row restatement at line 112 (S4).
- Delete the "nothing here restates" and "instead of redefining" disclaimers (S6).
- Vary the figure-pointer closers and the "A material/The source grid/The pipeline" openings only where clarity improves (see pattern family B in Section 5).

**4. Optional polish**

- Replace the table-cell semicolons at lines 32, 52, 53, 54, and 106 with periods or commas. Line 54 should be split into two rows, not just repunctuated.
- Replace "reports each state honestly" with "shows the current state" (E12).
- Replace "a failed run ends there" with "a failed run stays failed" (SL10).
- Replace "hands its verdict pair" with "passes its verdict pair" (SL14).
- Remove "builds up" from line 123 if the sentence is kept (phrasal verb).

## 8. Overall conclusion

The chapter's prose is specific, technical, and largely free of the vocabulary and inflation patterns that usually trigger AI-writing review. It does not claim novelty, significance, or robustness without evidence. It does not use forced triads, empty contrasts, or decorative emphasis. The BKT listing and the model table are grounded in live code, and most of the implementation claims check out.

The observable problems are different in kind. They are a small set of factual mismatches (table row count, assessment vs attempt, loop figure), a uniform 5.5 template, naming drift, and a reproducibility paragraph that overstates what files alone can do. These are writing-quality and evidence-alignment issues. They matter for submission readiness, not for authorship.

This audit is a qualitative review. It is not Turnitin, GPTZero, Copyleaks, or any validated AI detector, and it cannot establish authorship or misconduct. The findings identify patterns and claim-evidence gaps for the author to resolve.

## 9. Writing-review priority

**2 / 3.** This is a writing-review priority, not an AI-likelihood score and not a probability that AI wrote the chapter. A 2 means repeated issues affect readability, specificity, or consistency. The chapter would drop to 1 after the High findings (E1, E2, E3, E7) and the paragraph splits are fixed. The score is not additive and should not be read as a measurement.

## 10. Resolution (2026-10-23)

All P0, P1, and P2 rows applied from evidence-backed author defaults (Q-06, Q-08, Q-09, Q-10 answered in the plan record; Q-11 keeps the five figures).
Table 5.1 now counts seven Phase-II rows and names all seven concerns; the library lists assessments; reproducibility names versioned inputs plus Supabase, sidecar, and judge access; `Phase~I`/`Phase~II`, `GPU inference sidecar`, `Targeted explanation`, `PDF document`, and `bkt-v1` are consistent; all five 5.5 paragraphs are split; the chapter closes with a two-sentence summary.
Final lint: STE PASS, Humanizer PASS.
Grill follow-up: C5-03 approved as retitle and applied (`the verdict completes the chain`; no geometry change). Nothing open in this chapter.
