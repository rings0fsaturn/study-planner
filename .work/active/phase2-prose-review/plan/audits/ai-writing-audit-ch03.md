# AI Writing Pattern Audit

## 1. Scope

- **Material reviewed:** `college/mydeliverables/Phase-2-report/phase2-report/chapters/03-requirements.tex`, all 79 lines (about 1,000 words of prose plus two tables), with context from `main.tex`, `01-introduction.tex`, `02-literature-survey.tex`, `04-methodology.tex`, `05-implementation.tex`, `06-results.tex`, `07-conclusion.tex`, `REPORT_WRITING_GUIDE.md`, and the Phase-I `03-requirements.tex`.
- **Coverage:** Full chapter: opening, Section 3.1 hardware table, Section 3.2 software table, FR-1 to FR-15, NFR-1 to NFR-9, every cross-reference, and every project number and identifier. Line numbers are current working-tree bytes, not `HEAD`.
- **Genre/discipline:** M.Tech dissertation, systems requirements chapter, computer science and data science. The chapter is mostly enumerated requirements and tables, so the sample is small for document-level prose-pattern inference.
- **Limitations of the supplied material:** There is little free-running argument. Most sentences are "shall" statements or table cells, which are convention-bound. This audit therefore concentrates on requirement quality, traceability, and cross-chapter consistency rather than on authorship. No external detector report was supplied, and none is reproduced.
- **Verification note:** Every excerpt below was re-read from the current file with `sed -n` before writing. The Piston image string is quoted exactly as `ghcr.io/engineer-man/piston`; the prior `engineer/man` variant is not in the file. The local lint command was `python3 .work/active/phase2-prose-review/ste_check.py college/mydeliverables/Phase-2-report/phase2-report/chapters/03-requirements.tex`.
- **Confidence:** Confidence means confidence that the stated textual pattern is present, not confidence about who wrote the text.

## 2. Executive assessment

The chapter is surface-clean. It contains no em or en dashes, no TODO or placeholder residue, no repeated paragraphs, and no unresolved `\ref` keys. The local `ste_check.py` run reports STE PASS and Humanizer PASS with zero fail-tier hits; the only judge-tier item is `gated` at line 61, which names the reveal lock in the same sentence. The NFR bold labels and table headers are conventional requirement formatting, not decorative emphasis.

The main risks are content-level, not stylistic. One requirement appears to misattribute the authoritative written rubric grade to Jev-1.13, while Ch04, Ch05, and the grading code place Jev on the advisory shadow and loop-verdict paths. One requirement assumes a shipped change detector, while Ch06 and Ch07 call the single-arm CUSUM posture unshipped and Ch04 says it still prompts recalibration. One NFR claims exact cross-language match, while Ch05 claims equality within a tight tolerance. Several requirements mix a minimum requirement with project-machine detail, and several acceptance phrases ("modern web browser", "milliseconds", "uses more", "full image set") are not testable as written.

The chapter opening is a near-verbatim reuse of the Phase-I requirements opening. That is a plausible authorial choice in a two-phase dissertation, and it explains the formulaic roadmap. It is template inheritance, not evidence about authorship. The same applies to FR-1 to FR-8, which are carried from Phase I with only the American spelling change in FR-6. The chapter says so explicitly at line 48, so the reuse is transparent.

These observations do not establish whether the text was written by a human, an AI, or a combination. They identify writing-quality and evidence-alignment issues only.

## 3. Findings table

| ID | Location | Exact excerpt | Observable pattern | Why it merits review | Plausible non-AI explanation | Confidence | Priority | Recommended action |
|---|---|---|---|---|---|---|---|---|
| F1 | `03-requirements.tex:59` | "rubric grading with Jev-1.13 applies to written items" | Attributes the authoritative written rubric grade to Jev-1.13. | Ch04:18 says written answers go to "a rubric-judged model arm"; Ch05:27 names `deepseek/deepseek-v4-flash-0731` as the generation provider, Ch05:29 names Jev as a judgment client, and Ch05:61 ties Jev to the loop verdict. Code says the written arm uses "the shared OpenRouter adapter" (`services/intelligence/app/grading/rubric_grader.py:90`) and calls Jev only as a shadow in the grading path (`services/intelligence/app/grading/worker.py:382`), with the flag path described as "Advisory only - the server grade" (`services/intelligence/.env.example:54-55`; the comment continues "is never touched"). | A late edit may have conflated the advisory Jev review path with the authoritative grader. | High | High | Verify the intended attribution. If Jev is advisory, rewrite FR-10 and the table row to say the rubric arm is the OpenRouter model and Jev is the shadow or loop-verdict client. Do not change the grade design without the author. |
| F2 | `03-requirements.tex:53` | "The system shall detect a shift in the learner's pace" | FR-4 assumes a shipped change detector. | Ch06:111 and Ch07:5,19 call "the single-arm CUSUM posture" unshipped, while Ch04:47 says "the single-arm CUSUM still prompts recalibration." The report does not say whether the detector or only a specific posture is unshipped. | The terms "CUSUM" and "single-arm CUSUM posture" may name different things. | Medium | High | Resolve the naming and delivery status before submission. State the shipped detector in FR-4, or align Ch06 and Ch07. Do not silently change the requirement. |
| F3 | `03-requirements.tex:75` | "replay the same fixtures in TypeScript and Python with exact match" | Claims exact cross-language equality. | Ch05:59 says the Python test "asserts numeric equality to a tight tolerance." Exact match and tolerance are different acceptance criteria. | "Exact match" may mean behavioural equivalence rather than bitwise equality. | High | High | Align the wording with the harness, or verify that the harness uses exact equality. |
| F4 | `03-requirements.tex:76` | "groundedness of 0.8667 on its gold set (26 of 30 judged, see Section~6.1)" | Conflates the groundedness judge sample with the gold set. | Ch06:34 distinguishes groundedness at 0.8667 (26 of 30 judged answerable) from gold support at 0.7803, and lists the gold counts as 30 objective, 6 written, and 4 coding. The phrase "on its gold set" is not used there. | Shorthand for the harness gold file that supplies the judged rows. | Medium | Medium | Confirm whether the 30 judged rows are the gold questions. If not, say "on a 30-question judged sample". |
| F5 | `03-requirements.tex:74` | "within 8~s per attempt with at most two retries" and "projection runs locally in milliseconds" | Ambiguous and untestable responsiveness bounds. | `apps/app/src/lib/intelligenceClient.ts:5-6` sets an 8 s timeout per attempt and two retries, so the worst case is three 8 s attempts. "Milliseconds" is a unit, not a threshold, and Ch06 reports no projection latency. | The requirement was written directly from the client constants. | High | Medium | State whether 8 s is per attempt or total. Give projection a measured bound, or cross-reference the measurement. |
| F6 | `03-requirements.tex:16-18` | "Processor & x86-64 CPU with a discrete GPU, project machine runs an AMD Radeon RX~9070~XT" | The "Requirement" column mixes minimum requirements with project-machine detail, and the cells use comma splices. | Line 6 says the card and image sizes "describe the project machine, not minimum models," but the table still places the model under "Requirement". The memory and storage cells repeat the pattern. | One table was used for both the minimum environment and the test machine. | High | Medium | Split into "Minimum requirement" and "Project machine" columns, or move the model names into a table note. |
| F7 | `03-requirements.tex:18` | "At least 60~GB free for the full image set (GPU sidecar image measured at 49.5~GB, base images at about 2.3~GB)" | Undefined aggregate with a tight margin. | The 49.5 GB figure is confirmed live (`embedder-embedder:latest 49.5GB` in `docker image ls`). The 2.3 GB aggregate is not a defined set, and Piston alone is 1.42 GB. The project rule records about 74 GB for the ROCm image plus build cache (`.agents/rules/54-gpu-inference-sidecar.agents.md`), so the 60 GB requirement needs a scope statement. | The author measured image sizes only and excluded build cache. | Medium | Medium | Define the image set, state whether build cache and volumes count, and verify the 2.3 GB aggregate. |
| F8 | `03-requirements.tex:26` | "The system keeps the three Phase-I tiers and adds the GPU inference sidecar plus the code-execution sandbox." | "Three Phase-I tiers" is undefined and inconsistent with the Phase-I definition. | Phase-I `03-requirements.tex:25` defines the three tiers as the browser client, the Python service, and the offline research pipeline, with Supabase separate. The Phase-II table lists seven rows, including Supabase and tooling. The count is not recoverable. | The author may mean client, service, and Supabase. | High | Medium | Name the three tiers explicitly, or drop the count and say "keeps the Phase-I tiers". |
| F9 | `03-requirements.tex:37` | "Python~3.12, FastAPI, Uvicorn, NumPy, PyJWT, generation, grading, mastery, guide, and feedback endpoints, OpenRouter generation provider plus Jev-1.13 judgment client for the written arm, packaged with Docker" | Run-on table cell mixing languages, endpoint categories, providers, and packaging. Also uses "guide" where line 26 uses "guidance". | A technology table should be scannable. This cell is a compressed paragraph, and the Jev clause carries the F1 attribution problem. | The cell was used as a summary of the service tier. | High | Medium | Split the row or reduce it to technology names; move endpoint roles to prose; align "guide" and "guidance". |
| F10 | `03-requirements.tex:2` | "This chapter specifies the requirements of the full system. Section~3.1 states the hardware environment. Section~3.2 states the software environment. Section~3.3 lists the functional requirements as numbered items, and Section~3.4 lists the non-functional requirements." | Formulaic roadmap, near-verbatim from Phase-I `03-requirements.tex:2`. | The Phase-I sentence is identical except for "Phase-I system" to "full system". "As numbered items" is meta. The opening does not frame the Phase-II delta, which is the new sidecar, sandbox, and FR-9 to FR-15. | The author reused their own prior chapter scaffold. | High | Low | Replace the first sentence with a Phase-II-specific framing and name the new requirement ranges. Keep the section pointers. |
| F11 | `03-requirements.tex:59` and `:76` | "Each arm is tested separately." and "Every generated question shall carry its recorded chunk citations." | Test evidence inside requirements, plus duplication between FR-9 and NFR-7. | FR-9 says each question carries "its recorded chunk citations"; NFR-7 repeats the same citation obligation. The second sentence of NFR-7 is a result, not an obligation. | The author wanted each requirement traceable to its evidence. | High | Medium | Keep the obligation in FR-9 and the quality threshold in NFR-7, move test evidence to Ch06, and remove the duplicated citation clause or make NFR-7 a distinct quality bar. |
| F12 | `03-requirements.tex:60` | "The system shall estimate mastery per skill" and "recommend the next difficulty from that estimate" | Capability requirement with no quality bar. | Ch06:57 says "Difficulty calibration is recorded as unmeasured" and "The adaptive chip stays uncalibrated-advisory." The chapter has no NFR for difficulty calibration, so the recommendation is required but unconstrained. | The advisory status is intentional and left to Ch06. | Medium | Medium | Qualify FR-11 as advisory, or add an NFR with an acceptance criterion; cross-reference Ch06:57. |
| F13 | `03-requirements.tex:78` | "The floor follows the \texttt{hybrid\_rerank} arm (n=30, see Section~6.1)." | Vague relation, and the floor equals the measured values. | The 0.67, 0.90, and 0.797 figures are the measured hybrid_rerank values in Ch06:21 and `research/doc/2026-10-22-reranked-754.md`. A floor at the measured point has no margin. "Follows" does not say whether it is set from, matches, or is bounded by the arm. | The floor was defined from the measured result. | Medium | Low | Say "is set from" or "matches" and state whether headroom is required. |
| F14 | `03-requirements.tex:64` | "Logged hours alone do not trigger a replan (see Section~4.3)." | Stale cross-reference. | Ch04:49 is "Comparison Methodology". The trigger rule is Ch04:7 in Section 4.1: the router keeps thin evidence, low confidence, and the middle band on `hold`, and only `suggest_replan` proceeds. The same stale pointer appears in Ch01:25 ("see Sections~4.3 and 6.3"). | A section renumbering left the old target behind. | High | Medium | Retarget to Section 4.1, with Section 6.3 for the replay evidence, and fix Ch01:25 in the same pass. Also confirm that "assessment evidence" includes mastery and posture, as Ch01:25 describes. |

## 4. Sentence-level review

| ID / location | Original sentence or short excerpt | Issue category | Diagnosis | Suggested revision or question | Rationale |
|---|---|---|---|---|---|
| S1 `03-requirements.tex:2` | "Section~3.3 lists the functional requirements as numbered items" | Document-facing meta prose | The sentence describes the page rather than the system. It is part of a copied roadmap. | "Section~3.3 states the functional requirements; Section~3.4 states the non-functional requirements." | Removes the meta phrase while keeping the guide-required section pointers. |
| S2 `03-requirements.tex:6` | "so the workstation carries one" | Vague antecedent | "One" refers to a graphics processor, but the nearest noun is "workstation". The clause is colloquial for a requirements chapter. | "so the workstation includes a discrete graphics processor." | Makes the requirement explicit. |
| S3 `03-requirements.tex:16` | "x86-64 CPU with a discrete GPU, project machine runs an AMD Radeon RX~9070~XT" | Comma splice; mixed levels | Two independent statements are joined by a comma, and a project-machine fact sits under "Requirement". | "x86-64 CPU with a discrete GPU; the project machine uses an AMD Radeon RX~9070~XT." | Fixes the splice and separates the minimum from the test machine. |
| S4 `03-requirements.tex:17` | "8~GB RAM or higher, project machine uses more with the GPU sidecar loaded" | Vague quantity; comma splice | "Uses more" gives no usable requirement. | Ask: what is the measured project-machine RAM? State it in a separate note or column. | A requirement should be testable. |
| S5 `03-requirements.tex:18` | "local browser data stays small" | Vague quantity | "Small" has no bound. | "Local browser data stays under the per-user quota" or give a measured figure. | Makes the storage claim testable. |
| S6 `03-requirements.tex:20` | "Any device with a modern web browser" | Untestable acceptance term | "Modern" has no version or feature floor. | Name the minimum browser versions or required features, such as IndexedDB and ES2022. | A client-device requirement should be checkable. |
| S7 `03-requirements.tex:26` | "The Python intelligence service plus its worker now hosts" | Subject-verb agreement | The compound subject takes "host", not "hosts". | "The Python intelligence service and its worker now host..." | Corrects the grammar without changing meaning. |
| S8 `03-requirements.tex:37` | The full "Intelligence service and worker" cell | Run-on cell; terminology drift | The cell mixes languages, endpoints, provider, client, and packaging; it says "guide" while line 26 says "guidance". | Split the row or shorten the cell to technology names; use "guidance" consistently. | Improves scanability and removes a synonym drift. |
| S9 `03-requirements.tex:55` | "The system shall regenerate the schedule from the learner's realized capacity" | Term stability | Ch01 and Ch02 use the fixed noun "schedule regeneration"; this item uses the verb form. The meaning is correct. | No change required unless "schedule regeneration" is meant as a fixed label; then use it once in FR-6. | Keeps the project term stable without forcing awkward prose. |
| S10 `03-requirements.tex:59` | "Deterministic marking applies to objective items, rubric grading with Jev-1.13 applies to written items" | Terminology drift | "Marking" and "grading" are used for the same operation in one sentence. Ch01 and Ch02 use "grade". | "Deterministic grading applies to objective items..." | One name for one operation. |
| S11 `03-requirements.tex:64` | "Logged hours alone do not trigger a replan" | Negative scope statement | The contrast is meaningful because it distinguishes Phase II from the Phase-I pace prompt, but the pointer is wrong. | Keep the contrast; retarget the cross-reference to Section 4.1. | The negative half carries information and passes the empty-contrast check. |
| S12 `03-requirements.tex:74` | "within 8~s per attempt with at most two retries" | Ambiguous bound | The sentence permits three attempts, each with an 8 s timeout. | "within 8~s per attempt, with at most two retries" is accurate but needs a total-budget sentence. | Prevents a reader from treating 8 s as the worst-case wait. |
| S13 `03-requirements.tex:78` | "The floor follows the hybrid_rerank arm" | Vague relation | "Follows" does not say whether the floor is copied from, bounded by, or derived from the arm. | "The floor is set from the hybrid_rerank arm..." | States the relationship. |

## 5. Chapter-level pattern map

**Pattern family A: inherited chapter scaffold.**
The opening at line 2 is a near-verbatim copy of Phase-I `03-requirements.tex:2`, and FR-1 to FR-8 are carried with one spelling change. The FR and NFR introductions at lines 48 and 68 are also parallel templates. This is repeated across the chapter, but it is transparent and legitimate in a two-phase report. The strongest example is line 2; the highest-value revision is a Phase-II-specific first sentence, not a wholesale rewrite.
All 15 FRs begin with "The system shall", and all 9 NFRs use "shall" in their obligation sentences. That uniformity is the genre convention, not a defect by itself; the audit does not treat it as a style problem.

**Pattern family B: requirement and evidence mixed together.**
FR-10 ends with "Each arm is tested separately"; NFR-7 reports groundedness; NFR-9 reports the arm and n=30. These are results, not obligations. The pattern is repeated in three items. It matters because it blurs the functional/non-functional boundary and makes the chapter depend on Ch06 for its own acceptance criteria. The highest-value revision is to keep obligations in Chapter 3 and move measurements to Chapter 6, with a cross-reference.

**Pattern family C: compressed table prose.**
Both tables use cells as compressed paragraphs. The hardware table mixes minimums and project-machine facts; the software table has a seven-clause cell at line 37. This is repeated across both tables. The hardware table is the higher priority because it affects what a reader would treat as a minimum.

**Pattern family D: cross-reference drift.**
FR-15 points to Section 4.3 for a rule that lives in Section 4.1. Ch01:25 repeats the same pointer. The pattern is repeated across two chapters, which suggests a section renumbering rather than a one-off typo. The highest-value revision is to retarget both.

**Pattern family E: vague acceptance language.**
"Modern web browser" (line 20), "milliseconds" (line 74), "uses more" (line 17), and "full image set" (line 18) are not testable as written. "Tens to hundreds" (line 6) is descriptive context rather than an acceptance criterion. The pattern is repeated in four requirement or table spots. The highest-value revision is to replace each with a bound or a measured value, or to move it to prose as context.

**Pattern family F: terminology micro-drift.**
"Marking" and "grading" in FR-10, "guide" and "guidance" between line 26 and line 37, and "Phase-I" versus the report's usual "Phase~I" are minor but repeated. These are copy-editing issues, not argument issues.

**Transitions and voice.** No abrupt voice shift was observed. The chapter stays in third person, and the only register change is the meta note at line 6, which explains why the hardware table names the project machine. The formulaic part is the opening roadmap, not the section transitions.

**Highest-value chapter revision:** resolve F1, F2, and F3 before any stylistic pass. They affect what the requirements claim the system does. The hardware table split (F6/F7) is the next most useful structural fix.

## 6. Academic integrity and evidence checks

### Citation and reference integrity

- The chapter contains no `\cite` commands, so there are no dangling citation keys to check against `main.tex`. Its quantitative claims point to Section 6.1 rather than to a bibliography entry. That is acceptable for a requirements chapter, but it means the chapter has no independent source trail for the groundedness and retrieval numbers.
- `Jev-1.13`, `Piston`, and `ghcr.io/engineer-man/piston` are named without a bibliography entry. If the venue expects a citation for an external model or sandbox, this needs verification. Do not invent one.
- No placeholder, TODO, "verify citation", or editorial note was found.
- No repeated paragraphs were found within the chapter. The opening is copied from the Phase-I chapter, which is a cross-document repetition rather than an in-chapter duplicate.

### Number and identifier verification

| Claim | Location | Evidence checked | Status |
|---|---|---|---|
| Groundedness 0.8667, 26 of 30 judged | `03-requirements.tex:76` | `06-results.tex:34`: "Groundedness reads 0.8667 (26 of 30 judged answerable)". Ch02:23 and Ch04:52 use 0.867. | Verified, with a harmless precision difference. The "gold set" wording is unresolved (F4). |
| Retrieval 0.67, 0.90, 0.797 on 754 chunks, n=30 | `03-requirements.tex:78` | `06-results.tex:12,18-21`; `research/doc/2026-10-22-reranked-754.md:4-14`. | Verified. The "floor" margin is a requirements question, not a number error (F13). |
| 8 s and two retries | `03-requirements.tex:74` | `apps/app/src/lib/intelligenceClient.ts:5-6` (`TIMEOUT_MS = 8000`, `MAX_RETRIES = 2`); line 48 loops through three attempts. | Verified as per-attempt behaviour. The wording is ambiguous about the total budget (F5). |
| 49.5 GB sidecar image | `03-requirements.tex:18` | `docker image ls`: `embedder-embedder:latest 49.5GB`. | Verified live. |
| Base images about 2.3 GB | `03-requirements.tex:18` | `docker image ls` shows product images at 790 MB + 790 MB + 81.8 MB (about 1.66 GB), and Piston at 1.42 GB. | Not traceable to a defined aggregate. Needs verification. |
| 60 GB free | `03-requirements.tex:18` | 49.5 + 2.3 = 51.8 GB; adding Piston gives about 53.2 GB. The project rule records about 74 GB for the ROCm image plus build cache. | Needs a scope statement: images only, or images plus build cache and volumes. |
| Port 2000 and Piston image | `03-requirements.tex:40` | `docker-compose.yml:123` (`image: ghcr.io/engineer-man/piston`), `:127` (`PORT: 2000`), `:134` (published port). | Verified. |
| Jev-1.13 | `03-requirements.tex:37, 59` | `services/intelligence/.env.example:32` (`JEV_MODEL=jev-1.13`), `services/intelligence/app/jev/client.py:22`. | Verified as a model identifier. The written-arm attribution is unresolved (F1). |
| bkt-v1 | `03-requirements.tex:60` | `packages/progress/src/mastery.ts:13` (`MODEL_VERSION = 'bkt-v1'`). | Verified. |
| hybrid_rerank | `03-requirements.tex:78` | `research/doc/2026-10-22-reranked-754.md:14`. | Verified. |
| jev_review_flags | `03-requirements.tex:38` | `apps/app/supabase/migrations/033_jev_review_flags.sql:31`. | Verified. |

### Cross-reference checks

- `Section~1.4` at line 3: Ch01 Section 1.4 is "Scope of the Project" and does say the synthetic archetypes replace the longitudinal real-learner study. Correct.
- `Section~6.1` at lines 76 and 78: Ch06 Section 6.1 is "Generation Quality" and contains both the groundedness and retrieval tables. Correct.
- `Section~4.3` at line 64: Ch04 Section 4.3 is "Comparison Methodology", not the verdict trigger. The rule is in Section 4.1. Incorrect target (F14).
- `Section~4.3` also appears in Ch01:25 for the same verdict gate. The repeated stale pointer suggests a section renumbering. Fix both.
- Table labels `tab:hardware` and `tab:software` exist and are referenced correctly. No dangling `\ref` keys.

### Claim-evidence and terminology checks

- **FR-4:** The functional requirement is supported by Ch01:5, but the delivery status of the single-arm CUSUM posture is disputed by Ch04:47 against Ch06:111 and Ch07:5,19. Needs author resolution (F2).
- **FR-10:** The Jev attribution conflicts with Ch04:18, Ch05:27-29, and the grading code. Needs verification (F1).
- **FR-11:** The recommendation is required, but Ch06:57 reports difficulty calibration as unmeasured and the chip as uncalibrated-advisory. The chapter has no NFR for this quality. Needs a qualification or an NFR (F12).
- **NFR-6:** "Exact match" conflicts with Ch05:59 "tight tolerance". Needs alignment (F3).
- **NFR-7:** The groundedness sentence mixes a result into a requirement and may mislabel the judge sample as the gold set. Needs splitting and verification (F4, F11).
- **NFR-9:** The floor is set at the measured values, so it has no margin. Needs a requirements decision (F13).
- **Terminology that is stable:** `authoritative arm`, `feedback copy`, and `self-directed learner` are used consistently with Ch01 and Ch02. `server-side arm` does not appear; the earlier drift has been fixed. `schedule regeneration` appears only as the verb "regenerate the schedule" in FR-6; that is acceptable unless the noun is meant as a fixed label.
- **Terminology that drifts:** "marking" versus "grading" in FR-10; "guide" versus "guidance" between line 26 and line 37; "Phase-I" in lines 26, 48, and 68 versus the report's usual `Phase~I`. These are copy-editing findings, not evidence problems.
- **External accuracy:** Jev's role, the CUSUM delivery status, the 2.3 GB aggregate, and the "gold set" label are marked "needs verification" or "needs author resolution". No external source was checked for Jev or Piston documentation; do not treat those names as citation-checked.

## 7. Prioritized action list

### 1. Fix before submission

1. Verify and correct the Jev-1.13 written-arm attribution in FR-10 and the software table (F1).
2. Resolve whether the single-arm CUSUM posture is shipped; align FR-4, Ch04:47, Ch06:111, and Ch07:5,19 (F2).
3. Align "exact match" in NFR-6 with "tight tolerance" in Ch05:59 (F3).
4. Retarget the FR-15 cross-reference from Section 4.3 to Section 4.1, and fix the same pointer in Ch01:25 (F14).
5. Verify the "gold set" label for groundedness and the 2.3 GB base-image aggregate (F4, F7).
6. Define the hardware storage scope: images only, or images plus build cache and volumes (F7).

### 2. Improve scholarly argument

1. Add an acceptance criterion or an advisory qualifier for difficulty recommendation (F12).
2. Decide whether the retrieval floor needs headroom above the measured values (F13).
3. Separate obligations from test evidence in FR-10, NFR-7, and NFR-9 (F11).
4. Clarify whether "assessment evidence" in FR-15 includes mastery and posture, as Ch01:25 says (line 64).
5. Resolve the "three Phase-I tiers" count against the Phase-I definition (F8).

### 3. Improve style and reduce redundancy

1. Replace the copied opening with a Phase-II-specific first sentence (F10).
2. Split the hardware table into minimum and project-machine columns (F6).
3. Shorten the software table cells and align "guide" with "guidance" (F9).
4. Make the responsiveness and projection bounds testable (F5).
5. Align "marking" with "grading" and `Phase-I` with `Phase~I`.

### 4. Optional polish

1. Add a short summary subsection if the chapter's genre expects one; the chapter currently ends after NFR-9.
2. Name a minimum browser version or feature set for the client device.
3. Use one precision for groundedness across Ch02, Ch03, Ch04, and Ch06 (0.867 or 0.8667).
4. If "schedule regeneration" is a fixed project term, use the noun once in FR-6.

## 8. Overall conclusion

The chapter shows a small set of repeated, template-like patterns: an inherited chapter scaffold, parallel FR and NFR introductions, compressed table cells, and several requirements that carry their own test evidence. These patterns are consistent with a two-phase dissertation that reuses its own Phase-I structure. They are not, by themselves, evidence about authorship.

The more important issues are traceability and technical precision. One requirement appears to misattribute the authoritative written grade to an advisory client. One requirement assumes a detector whose delivery status the report disputes. One NFR claims exact cross-language equality where the implementation chapter claims a tolerance. Several acceptance phrases are not testable. These are scholarly and engineering findings, not stylistic tells.

The chapter is otherwise clean at the surface: no dashes, no placeholders, no duplicated paragraphs within the chapter, no dangling references, and no humanizer hard fails. The humanizer-relevant contrasts and lists that do appear carry real information. "Rather than a single date" distinguishes a band from a point estimate; the three grading families are real; the four-step ladder is real; the NFR bold labels are conventional requirement labels. No forced triad or empty contrast was found.

**Writing-review priority: 3 (major issue affecting evidence, consistency, or submission readiness).** This score is driven by F1, F2, F3, and the hardware storage scope. It is a writing-review priority, not an AI probability. The audit is a qualitative review, not a validated detector, and it cannot establish authorship or misconduct. Every excerpt was checked against the current file bytes, and every number marked "needs verification" should be confirmed by the author before submission.

## 9. Fix-plan resolution (2026-10-23)

| Finding | Plan row | Status |
|---|---|---|
| F1 | C3-01, C3-03, X-03 | resolved by Q-13: written arm uses the OpenRouter rubric model, Jev is advisory |
| F2 | C3-04, X-02 | resolved by Q-14: single-arm CUSUM ships, FR-4 kept, Ch06/Ch07 corrected |
| F3 | C3-06 | resolved by Q-15: numeric equality to a tight tolerance |
| F4 | C3-07 | resolved by Q-16: 30-question judged sample, not the gold set |
| F5 | C3-09 | resolved: per-attempt bound and local projection stated |
| F6, F7 | C3-10, C3-11, C3-18 | resolved by Q-18: minimum table plus project-machine note |
| F8 | C3-12 | resolved: "three" dropped |
| F9 | C3-13 | resolved: service and model-provider rows split |
| F10 | C3-14 | resolved: Phase-II delta named |
| F11 | C3-02, C3-08 | resolved: test evidence removed, NFR-7 is a quality bar |
| F12 | C3-15 | resolved by Q-19: advisory and uncalibrated |
| F13 | C3-16 | resolved by Q-20 default: "is set from"; headroom deferred |
| F14 | C3-05, C3-23 | resolved: pointer now 4.1 plus 6.3 evidence |
| S1 to S8, S10, S12, S13 | C3-14, C3-17, table split, C3-18, C3-19, C3-20, C3-21, C3-13, C3-22, C3-09, C3-16 | resolved |
| S9, S11 | none | retained (correct verb form and informative contrast) |

Open: Q-17 headroom above 0.8667; Q-20 margin above the measured retrieval floor; X-05 bibliography author metadata.
