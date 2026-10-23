# AI Writing Pattern Audit

_Audit date: 2026-10-23 · Manuscript: `college/mydeliverables/phase2-journal/journal-draft.tex` · Reference list: `college/mydeliverables/phase2-journal/journal-refs.bib` · Working record, not part of the submission._

## 1. Scope

Material reviewed: the full 465-line Springer manuscript `journal-draft.tex`, including abstract, Introduction, Literature Review, Materials and Methods, Results and Discussion, Conclusion, back matter, and Appendix A.
Coverage: all body prose.
Captions, labels, tables, TikZ and pgfplots code, Declarations boilerplate, and the bibliography were read for consistency but not restyled, per the prose spec.
Genre and discipline: computer-science education-technology manuscript, single-column `sn-mathphys,Numbered` class.
Limitations of the supplied material: the review has no author writing sample, earlier draft, or external detector report.
The review therefore describes observable patterns only and cannot establish authorship.
The manuscript was audited after the STE and humanizer passes, so this record also captures defects those passes found and fixed.

## 2. Executive assessment

The prose is specific and evidence-anchored: nearly every claim names a corpus, a metric, a gate, or a file.
The strongest observable patterns are structural rather than lexical.
The Literature Review uses a deliberate four-beat template (source, mechanism, metric, gap), which reads as regular because it is regular by design.
Technical terms repeat on purpose (`exact verdict pair`, `fail-closed`, `advisory`), and the repetition supports auditability rather than padding.
The earlier draft-level defects were factual and referential, not stylistic: one contradictory sentence about pre-fix conversions, one ambiguous use of "baseline", and one undefined piece of jargon.
All three are now corrected in the `.tex`.
The remaining writing-quality risks are low and mostly consist of dense enumeration in the abstract and in the evidence appendix.
This audit is a qualitative review. It does not establish whether the text was written by a human, AI, or a combination.

## 3. Findings table

| ID | Location | Exact excerpt | Observable pattern | Why it merits review | Plausible non-AI explanation | Confidence | Priority | Recommended action |
|---|---|---|---|---|---|---|---|---|
| A1 | Abstract | "ties the baseline rank" (pre-fix) | Ambiguous referent | The manuscript uses "baseline" for two different comparators: the bake-off baseline (0.889 AUC) and the live running proportion (0.7368 AUC). | Editing shorthand while the comparator changed during drafting. | High | High | **Resolved**: now "ties the running-proportion baseline". |
| A2 | Literature Review, guidance | "converts 4 of 4 ... after the fix and converts 4 of 4 before it" (pre-fix) | Claim contradicts results | Results and Appendix say the pre-fix replay produced 4 of 4 holds, not conversions. | The sentence compressed "converts after / holds before" into one predicate. | High | High | **Resolved**: now "against 4 of 4 holds before it". |
| A3 | Results, knowledge tracing | "Thesis-safe result shows parity." (pre-fix) | Undefined jargon and telegraphic style | "Thesis-safe" is a project-internal label with no meaning to a reviewer, and the sentence has no verb subject that names the comparison. | Internal shorthand carried over from the project plan. | High | High | **Resolved**: now "The result supports parity." |
| A4 | Introduction | "The conclusion states the best system with its metric" (pre-fix) | Overclaim | No competing systems are evaluated, so "best" is not supported by the evidence. | Results does select one system, and "best" slipped in as emphasis. | Medium | Medium | **Resolved**: now "the selected system". |
| A5 | Methods, tool stack | "Fixed budgets appear here as the honesty note." (pre-fix) | Project jargon | "Honesty note" is internal framing; a reviewer expects the budgets themselves. | The phrase names the drafting habit rather than the content. | Medium | Medium | **Resolved**: now "We state the fixed budgets here." |
| A6 | Methods, scope | "We state the same limit in the Introduction and repeat it here" (pre-fix) | Writing about the document | The sentence narrates the drafting decision instead of stating the limit. | The author wanted to signal that the repetition was intentional. | Medium | Medium | **Resolved**: removed; the paragraph now ends on the scope claim. |
| A7 | Literature Review | "Each entry names the source, its mechanism, its metric, and the gap it leaves." | Over-regularized structure | Every literature paragraph follows the same four beats, which can flatten analytical depth. | The four-beat form is the report-writing convention this work was drafted to follow, and the sentence announces it so the reader expects it. | High | Medium | **Accepted as deliberate**: preserve the template; the paragraphs still carry distinct mechanisms and gaps. |
| A8 | Results, verdicts | "exact verdict pair" appears five times across Results, Methods, and Appendix | Repeated stock phrase | Repetition can read as template fill. | It is the precise name of a stored audit artifact, and consistency prevents a reader from confusing it with a paraphrase. | High | Low | **Accepted**: keep one name for one thing (STE 1.11). |
| A9 | Results, architecture figures | "Figure~\ref{fig:architecture} shows ... Figure~\ref{fig:closed-loop} shows ..." | Figure tour | The paragraph lists figures rather than advancing an argument. | Figure callouts are conventional in a results section and each sentence adds a distinct referent. | Medium | Low | **Accepted**: keep; the paragraph is short and each callout is required. |
| A10 | Results, rejected arms | "Ablation honesty" (pre-fix heading) | Evaluative heading | The heading praises the section instead of naming its content. | The section reports deliberate rejections, and "honesty" was a project value label. | High | Medium | **Resolved**: heading is now "Rejected arms and thresholds". |
| A11 | Abstract | "zero console errors across objectives, rubrics, coding grades, guides, practice runs, feedback copy, mastery reads, and ingestion" | Dense enumeration | Eight items in one sentence slow the reader and blur the claim. | The list is the exact deployment-check matrix, and compressing it would lose scope. | Medium | Low | **Accepted**: the sentence is factual and the length stays under the 25-word cap. |

## 4. Sentence-level review

| Location | Original or short excerpt | Issue | Diagnosis | Suggested revision or question | Rationale |
|---|---|---|---|---|---|
| Lit, tracing | "The control module on top is this project's step." | Vague predication | "Step" does not name what the project adds. | "This project adds the control module on top." | Names the actor and the action. **Applied.** |
| Lit, tracing | "The planner needs that join, because a mastery estimate that never changes the plan is a dashboard, not a controller." | Not-X-but-Y contrast | The negative half is rhetorical. | "cannot steer it." | Keeps the causal claim without the aphorism. **Applied.** |
| Lit, generation | "even though mixing would look cheaper on paper" | Arguing with no one | No one in the text proposes mixing formats. | Remove the clause. | The remaining sentence still explains the one-family contract. **Applied.** |
| Lit, grading | "A coding item with no derivable input-output contract cannot be graded in the sandbox, so the arm refuses the material instead of grading prose in its place." | Over 25 words | One sentence carries a condition and a consequence. | Split after "sandbox". | Meets the descriptive sentence cap. **Applied.** |
| Methods, tracing | "The guide ladder guides learners from nudge to hint..." | Repeated root | "Guide ladder guides" is a tautology. | "moves learners from..." | Restores a plain verb. **Applied.** |
| Methods, verdict | "JEV scores." | Fragment | The sentence has no object. | "JEV scores each decision." | Supplies the missing object. **Applied.** |
| Results, retrieval | "Fusion alone does not move r@1 ... so the lexical arm adds recall depth without changing the first hit." | Over 30 words | Two claims in one sentence. | Split into a finding and its reading. | Improves scanability at no cost to facts. **Applied.** |
| Results, generation | "Three readings follow." | Staged opener | The list that follows has four points, not three. | Delete. | Removes a false count and a run-up. **Applied.** |
| Results, verdicts | "The change from low to high shows the intended trend." | Closer | It repeats the preceding result. | Delete. | The gradient sentence already carries the point. **Applied.** |
| Results, rejected arms | "Rejected arms follow." / "Each rejection shows the limits of the loop." | Staged opener and closer | Both bracket the section with no content. | Delete both. | The list states the rejections directly. **Applied.** |
| Conclusion | 26-word sentence joining three metrics to 4 of 4 replans | Over 25 words | The subject controls three clauses. | Split before "It yields". | Meets the cap and keeps every number. **Applied.** |

## 5. Chapter-level pattern map

| Section | Recurring pattern families | Isolated or repeated | Strongest examples | Section-specific issues | Highest-value revision |
|---|---|---|---|---|---|
| Abstract | Short declaratives; metric-per-sentence; one dense deployment list | Repeated | "A server grades each family with its own arm." | The run list in the last paragraph is dense. | None required; keep the factual density. |
| Introduction | Roadmap sentences; rule-based scope | Isolated | "Three rules set the scope." | The old roadmap described the paper instead of its content; rewritten. | Already applied. |
| Literature Review | Four-beat entries; "X supplies Y" parallels | Repeated by design | "Chen et al. supply prior structure over learners." | The regularity is structural, not lexical. | Preserve the template; no further change. |
| Materials and Methods | Declarative stage descriptions; budget lists | Repeated | "We run reranked-754 on 30 questions times 3 arms." | A few sentences were telegraphic or tautological; fixed. | Already applied. |
| Results and Discussion | Long analytical sentences followed by short readings | Repeated | Retrieval and BKT discussion paragraphs. | Several sentences exceeded the 25-word cap; split. | Already applied. |
| Conclusion | Scope statement plus numbered steps | Isolated | "It yields 4 of 4 measured replans." | None after the split. | Already applied. |
| Appendix A | One dense evidence paragraph with paths | Isolated | "Table~\ref{tab:verdict} ... map to ..." | One sentence exceeded the cap; split. | Already applied. |

## 6. Academic integrity and evidence checks

Citation consistency: all 24 cite keys resolve to entries in `journal-refs.bib`, and no bibliography entry is uncited (both directions checked programmatically).
No placeholder authors, "and others" strings, or verify-pass comments remain; Phase 1 closed those.
Template residue: the rendered publisher instruction was removed in Phase 1; no TODO, placeholder, reviewer note, or inserted-text marker remains.
Number grounding: every headline value matches the frozen evidence or the draft tables.
The retrieval values 0.60/0.67/0.80/0.90/0.720/0.797 match `2026-10-22-reranked-754` and `tab:retrieval`.
The BKT values 0.785/0.7397/0.7368 and ECE 0.057/0.1401/0.2679 match `tab:bkt` and the live harness.
The generation values 0.9611/0.9133/0.7803/0.0044/0.8667/0.5349 match `tab:generation` and the harness summary.
The verdict values 0.28-0.35, 0.61-0.69, and 1.0 match `tab:verdict`, `fig:verdictdip`, and the dip replay.
The probe budget of 395 calls, 13 arms, 0.099 dollars, p50 3973 ms, and p95 10547 ms match the content brief and probe summary.
Claim-evidence alignment: the single-learner and synthetic-validation limit appears in the abstract, Methods, and Conclusion without softening.
Difficulty calibration is reported as unmeasured in Methods, Results, and the Ablation section.
The adherence result is confined to one caveated sentence and the appendix, as decided in D-04.
Overclaim removed: "best system" became "selected system" because no system comparison supports a superlative.
Unverified items: none flagged. The audit ran without web reference verification; the bibliography was verified separately in Phase 1.
The abstract is 188 words, inside the 180-200 target.

## 7. Prioritized action list

### 1. Fix before submission

| Action | Status |
|---|---|
| Name the live comparator explicitly in the abstract (A1) | Done |
| Correct the pre-fix conversion claim to 4 of 4 holds (A2) | Done |
| Replace "Thesis-safe result" with a plain predicate (A3) | Done |
| Replace "best system" with "selected system" (A4) | Done |
| Remove "honesty note" jargon (A5) | Done |
| Cut the meta sentence about repeating the scope limit (A6) | Done |
| Rename "Ablation honesty" (A10) | Done |

Zero open `Fix before submission` items remain.

### 2. Improve scholarly argument

No open items.
The four-beat Literature Review is deliberate (A7), and every comparative claim names its mechanism and gap.
The limitations paragraph states what the design cannot support, not merely that limitations exist.

### 3. Improve style and reduce redundancy

No open items beyond the accepted repetition of technical names (A8).
The Results discussion paragraphs already pair each number with a reading, and the abstract keeps one fact per sentence except the deployment list (A11).

### 4. Optional polish

Consider shortening the abstract's deployment-check list to the four highest-signal runs if a venue imposes a tighter abstract limit.
Consider merging the one-paragraph Appendix A into a table if the venue accepts appendix tables, which would improve scanability without changing any value.

## 8. Overall conclusion

The manuscript shows a small number of concrete writing defects and no evidence of template-generated filler.
The defects were referential and structural: an ambiguous baseline label, a contradictory pre-fix conversion sentence, an undefined internal label, one overclaim, and several staged or tautological sentences.
All are corrected in the current `.tex`, and the corrected text keeps every reported value, scope qualifier, and citation.
The remaining regularity is the deliberate four-beat Literature Review and the consistent reuse of audit terms, both of which support the paper's checkability claim.
This audit is a qualitative review, not a validated AI detector.
It cannot establish authorship or misconduct, and it makes no claim about how the text was produced.
