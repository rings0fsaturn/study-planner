---
name: ai-writing-pattern-audit
description: Audit academic chapters and sentences for patterns that may resemble AI-generated or AI-assisted writing, using transparent, evidence-based heuristics informed by academic AI-detection tools. Also identify academic-writing quality problems, citation issues, and template artifacts. Never claim to prove authorship or fabricate detector scores.
---

# AI Writing Pattern Audit

## Purpose

Review academic manuscripts at document, chapter, paragraph, and sentence level for observable patterns sometimes associated with AI-generated or AI-assisted prose. Produce a traceable audit that helps the author improve clarity, specificity, originality, evidence, and scholarly voice.

This is a qualitative audit inspired by public descriptions of academic AI-writing detection approaches and known limitations of such tools. It is **not** Turnitin, GPTZero, Copyleaks, or a substitute for running those services. Do not claim to reproduce their models, scores, thresholds, or proprietary methods.

## Core rules

1. **Do not infer authorship from style alone.** A pattern can occur in human-written, AI-assisted, translated, edited, or template-based writing.
2. **Never invent AI probabilities, detector percentages, or false precision.** Use qualitative confidence only for the strength of the observed pattern, not for the probability that AI wrote it.
3. **Quote evidence.** Every finding must include a short exact excerpt and a location: chapter/section, page if available, paragraph, or sentence number.
4. **Separate observation from interpretation.** State what is visible first, then why it might merit review.
5. **Include plausible alternatives.** For example: discipline conventions, journal templates, non-native English editing, concise technical style, repeated terminology, or a human author's preferred style.
6. **Do not “humanize” text to evade detectors.** Recommend substantive revisions that improve reasoning, specificity, evidence, and authorial ownership.
7. **Do not treat a detector flag as proof of misconduct.** If an external detector report is supplied, record its result as an external signal, not as ground truth.
8. **Preserve technical meaning.** Do not change equations, results, claims, terminology, citations, or reported values without explicit evidence and permission.
9. **Distinguish AI-style indicators from ordinary writing defects.** Weak evidence, unsupported claims, repetition, bad citations, and template residue matter even if they say nothing about authorship.
10. **Be transparent about limits.** If the input is only a sentence or a short excerpt, say that the sample is too small for a meaningful document-level assessment.

## Supported inputs

- A full manuscript, PDF, DOCX, Markdown file, or plain text.
- One chapter or section.
- A list of sentences or paragraphs.
- Optional: author-provided earlier drafts, tracked changes, notes, source references, or external detector reports.
- Optional: target journal, discipline, citation style, and the author's own writing sample for comparison.

If a file is attached, inspect its actual contents before making claims. If text extraction is incomplete or tables/figures are relevant, report that limitation and inspect the relevant pages visually when tools permit. Do not fill missing content from guesswork.

## Audit workflow

### Stage 1 — Establish scope and context

1. Identify the document title (if available), genre, discipline, chapter/section structure, and sample size.
2. State whether the review covers the full document, selected chapters, or an excerpt.
3. If an author writing sample or earlier draft is supplied, compare cautiously against it. Do not assume one short sample defines the author's entire style.
4. Separate the main prose from references, tables, equations, code, boilerplate, questionnaires, and publisher templates. These may need different treatment.
5. If the input is too short for meaningful pattern analysis, limit the conclusion to local writing observations.

### Stage 2 — Run the pattern audit

Inspect the categories below. Do not require every category to appear, and do not treat any one category as decisive.

#### A. Predictability and variation
Look for:
- Repeated sentence lengths and syntactic shapes across a section.
- A long run of similarly structured declarative sentences.
- Highly uniform paragraph rhythm or transitions.
- Formulaic openings and conclusions repeated across sections.

Record exact examples and note that formal academic writing naturally uses conventions and may be uniform.

#### B. Repeated language and semantic redundancy
Look for:
- Repeated claims expressed with slightly different wording.
- Recurrent contrast formulas such as “X is not Y” or “not A, but B.”
- Repeated “this demonstrates/highlights/underscores” constructions.
- The same contribution, limitation, or caveat restated in the abstract, introduction, results, and conclusion without adding new information.
- Repeated clusters of project-specific phrases that do not develop the argument.

Distinguish useful technical consistency from unnecessary repetition.

#### C. Generic academic phrasing
Look for:
- Broad claims that could fit many papers with minimal change.
- Vague phrases such as “plays a crucial role,” “offers valuable insights,” or “further research is needed” without a specific object or rationale.
- Claims about novelty, significance, robustness, scalability, or effectiveness without a defined comparison or evidence.
- Conclusions that merely repeat the introduction.

Do not flag a phrase solely because it is common; explain whether the surrounding claim lacks specificity.

#### D. Over-regularized argument structure
Look for:
- Literature-review paragraphs that all follow the same template: study → result → limitation → proposed solution.
- Repeated lists of three points where the third point adds little.
- Uniformly polished transitions that conceal missing logical steps.
- A section that sounds fluent but does not explain why evidence supports the conclusion.
- Repeated “problem–solution–benefit” sequences with little discipline-specific analysis.

A conventional structure may be appropriate. Flag only when the regularity reduces analytical depth or causes repetition.

#### E. Specificity, ownership, and technical grounding
Check whether the prose connects claims to:
- Concrete research questions, data, methods, constraints, assumptions, or observed results.
- A clearly stated reason for a design or methodological choice.
- Alternative explanations, negative results, trade-offs, and limitations.
- Specific sources that actually support the adjacent claim.
- The author's interpretation of results rather than a generic summary.

Do not assume that technical detail proves human authorship. Treat it as evidence of specificity, not authorship.

#### F. Citation and reference integrity
Flag items requiring verification:
- Placeholder references, “verify citation,” “add source,” or similar editorial notes.
- In-text citations with no matching bibliography entry, or bibliography entries never cited, when the document structure allows checking.
- Claims that appear to need a citation but have none.
- References with incomplete metadata, inconsistent years, suspiciously generic titles, or malformed DOI/URL fields.
- Citations that do not obviously support the claim as written.

Do not claim a citation is fabricated or inaccurate unless it has been checked against a reliable source. If web or reference verification is unavailable, label it “needs verification.”

#### G. Template and editing residue
Look for:
- “Insert text here,” “brief acknowledgments go here,” author/affiliation placeholders, publisher instructions, reviewer comments, TODOs, or unresolved tracked-change notes.
- Repeated headings or duplicated paragraphs.
- Inconsistent terminology, tense, capitalization, notation, or citation style.
- Abrupt shifts in voice or terminology that may indicate compilation from different sources.

These are document-quality findings, not evidence that AI wrote the text.

#### H. Claim–evidence alignment
For each important claim, ask:
- What evidence in the manuscript supports it?
- Is the claim stronger than the reported result?
- Are limitations, sample size, evaluation conditions, and uncertainty described?
- Does the conclusion generalize beyond the study's actual scope?
- Are null results and failed configurations reported accurately and consistently?

Flag overclaiming independently of any AI-style assessment.

#### I. Local sentence-level signals
For each sentence that merits review, consider:
- Does it add a distinct claim or merely restate the previous sentence?
- Is the subject concrete and the verb informative?
- Are abstract nouns hiding who did what or what was measured?
- Are contrastive or evaluative phrases doing analytical work?
- Is the sentence unusually generic relative to its surrounding technical detail?
- Does the sentence make a factual claim that requires a source?

A single sentence cannot reliably establish authorship. Sentence flags are for editing and closer contextual review only.

### Stage 3 — Compare patterns across levels

1. **Sentence level:** identify local repetition, vagueness, unsupported claims, and awkward constructions.
2. **Paragraph level:** check whether sentences build a coherent argument or repeat one point.
3. **Chapter level:** identify repeated templates, uneven specificity, missing transitions, and claims that recur without development.
4. **Document level:** check consistency between abstract, aims, methods, results, discussion, and conclusion.
5. Report whether a pattern is isolated or recurs across multiple independent sections. Repeated occurrences of the same copied phrase count as one pattern family, not many independent pieces of evidence.

### Stage 4 — Recommend revisions

Prioritize revisions that improve the scholarship:
- Replace generic assertions with the exact finding, method, constraint, or implication.
- Remove redundant claims while preserving necessary signposting.
- Explain the rationale behind choices and how alternatives were evaluated.
- Tie each interpretive statement to data or a cited source.
- Add specific limitations and plausible alternative explanations where appropriate.
- Verify references and remove template residue.
- Vary sentence structure only when it improves clarity; do not introduce artificial variation.
- Preserve technical terms and the author's intended meaning.
- Ask the author for missing facts instead of inventing them.

When useful, provide a **minimal edit** and a **substantive revision**. Explain what changed and why. Do not rewrite the entire chapter by default if a targeted audit was requested.

## Required output format

Use this structure unless the user requests a different format.

# AI Writing Pattern Audit

## 1. Scope
- Material reviewed:
- Coverage:
- Genre/discipline (if known):
- Limitations of the supplied material:

## 2. Executive assessment
Summarize the strongest observable patterns and the main writing-quality risks. Use careful wording such as:
- “Several passages show repeated, template-like phrasing.”
- “The excerpt contains too little text for a reliable document-level assessment.”
- “These observations do not establish whether the text was written by a human, AI, or a combination.”

Do **not** provide a binary “AI-written / human-written” verdict.

## 3. Findings table
For each finding, include:
- ID
- Location
- Exact excerpt (keep it short)
- Observable pattern
- Why it merits review
- Plausible non-AI explanation
- Confidence in the observation: Low / Medium / High
- Priority: Low / Medium / High
- Recommended action

“Confidence” means confidence that the stated textual pattern is present, **not** confidence that AI generated it.

## 4. Sentence-level review
Use a table with:
- Sentence ID/location
- Original sentence or short excerpt
- Issue category
- Diagnosis
- Suggested revision or question for the author
- Rationale

Only include sentences where a concrete issue can be described. Do not label a sentence “AI-generated.”

## 5. Chapter-level pattern map
For each chapter/section, report:
- Recurring pattern families
- Whether the pattern is isolated or repeated
- Strongest examples and locations
- Chapter-specific writing issues
- Highest-value revision

## 6. Academic integrity and evidence checks
List citation, factual, methodological, and claim–evidence issues separately from stylistic observations. Mark unverified items clearly.

## 7. Prioritized action list
Group actions into:
1. Fix before submission
2. Improve scholarly argument
3. Improve style and reduce redundancy
4. Optional polish

## 8. Overall conclusion
Describe the observable writing patterns and their distribution. Explicitly state that the audit is a qualitative review, not a validated AI detector, and cannot establish authorship or misconduct.

## Scoring rubric (optional; never an AI probability)

If the user asks for a score, score **writing-review priority**, not likelihood of AI authorship:
- 0 — No concrete issue observed in the supplied sample.
- 1 — Minor local issue.
- 2 — Repeated issue affecting readability or specificity.
- 3 — Major issue affecting argument, evidence, consistency, or submission readiness.

Do not add these scores together into an “AI score.” A numerical total can falsely imply validated measurement.

## Working with external detector reports

If the user supplies Turnitin, GPTZero, Copyleaks, or another detector report:
1. Record the tool name, date (if shown), scope, and exact reported result.
2. Do not convert one tool's result into a universal probability of AI authorship.
3. Compare highlighted passages with the actual manuscript and inspect context.
4. Explain that tools may disagree and can produce false positives and false negatives.
5. Recommend review of drafts, notes, version history, source records, and the author's ability to explain their methods and claims when authorship process genuinely needs to be established.
6. Do not attempt to reverse-engineer hidden detector thresholds or promise to lower a detector score.

## Safety and fairness checks

- Do not use English fluency, formality, non-native phrasing, discipline-specific terminology, or concise technical prose as standalone evidence of AI use.
- Do not infer the author's identity, language background, intent, or academic misconduct.
- Do not recommend random synonym substitutions, deliberate errors, awkward wording, or “humanizer” tools to evade detection.
- Do not present stylistic impressions as forensic evidence.
- Keep the review constructive, specific, and reproducible.

## Quick commands

Interpret requests as follows:
- **“Audit this document”** — run the full workflow.
- **“Audit Chapter 2”** — review the chapter in context, including links to earlier/later sections if supplied.
- **“Audit sentence by sentence”** — enumerate sentences and review only those with concrete findings; preserve the original order.
- **“Compare these drafts”** — identify substantive changes, repeated wording, new unsupported claims, and changes in specificity; do not infer authorship from revision alone.
- **“Check references”** — audit citation-to-reference consistency and verify sources when tools are available.
- **“Re-audit after revisions”** — compare against the previous audit if available, mark resolved/partially resolved/unresolved findings, and identify newly introduced issues.

## Public references informing this workflow

These references inform the limitations and review principles; they do not imply that this skill reproduces any product's proprietary detector.

- Turnitin, “Using the AI Writing Report”: https://guides.turnitin.com/hc/en-us/articles/22774058814093-Using-the-AI-Writing-Report
- GPTZero, “What are the limitations of GPTZero's AI classifier?”: https://support.gptzero.me/articles/1787085022-what-are-the-limitations-of-gptzero-s-ai-classifier
- Liang et al. / PeerJ Computer Science (2025), “The accuracy-bias trade-offs in AI text detection tools and their impact on fairness in scholarly publication”: https://pmc.ncbi.nlm.nih.gov/articles/PMC12453642/
- Russell, Karpinska, and Iyyer (ACL 2025), “People who frequently use ChatGPT for writing tasks are accurate and robust detectors of AI-generated text”: https://aclanthology.org/2025.acl-long.267/
