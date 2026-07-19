---
title: Report Writing Guide — Human Researcher Voice
purpose: Vocabulary, sentence-formation, and structural patterns extracted from real PES M.Tech dissertation reports, so an agent drafting this project's review/dissertation prose sounds like a grounded human researcher rather than AI-generated text
applies_to: college/mydeliverables/ (review reports, dissertation chapters, literature survey prose)
audience: writing agents, the author reviewing agent output
status: current
last_updated: 2026-07-03
related:
  - college/mydeliverables/TIKZ_DIAGRAM_GUIDE.md
  - .claude/rules/latex-report-build.md
---

## When to use this guide

Read this before drafting or rewriting any prose paragraph that will appear in a PES
M.Tech report/review deliverable under `college/mydeliverables/` — literature survey
entries, chapter intros/summaries, results discussion, conclusions, abstracts. Also read
it before revising an agent-drafted section that "reads like AI" — most of the fixes
below are mechanical, findable substitutions, not vague style advice.

## When NOT to use this guide

Doesn't apply to: front-matter boilerplate (certificate/declaration/acknowledgement —
fixed institutional templates; copy their shape straight from the source PDFs), table
and figure captions (terse label conventions, not prose), bibliography entries
(citation-style formatting, not voice), code comments, commit messages, or `.work/`
planning docs (those follow this repo's own working-notes conventions, not academic
register).

## Source reports analyzed

Two real PES University M.Tech dissertations, submitted under the same program this
project is written for, extracted via `pdfplumber` from `college/sampleReports/`:

- **"Hybrid System for Ransomware Detection using ML and NLP"** (Monica Sneha,
  PES2PG19CS003, 2021) — competent but shows the *rough edges* of typical student prose:
  grammar slips, verbatim repetition of the same paragraph across sections, a few
  purple/dramatic phrases. Referred to below as **Report R**.
- **"Digital Borders: Animal Tracking through Re-identification"** (Prashanth C Ravoor,
  PES1201802670, 2019) — markedly stronger academic voice, publication-quality
  literature survey, honest reporting of poor results. Referred to below as **Report D**
  — treat this as the quality bar.

A third file, the blank official LaTeX template
(`PES Mtech Project report Sample (Latex)).zip`), supplied the chapter skeleton below but
no usable prose (placeholder text only).

**Verdict up front:** emulate Report D's voice and rigor. Report R's *structure* is fine
(same chapter skeleton, same literature-review shape) — but avoid its grammar and
repetition habits, flagged explicitly under "Signs of weak student prose" below.

## Chapter-level skeleton

Both reports (and the blank template) share this chapter order. Reuse it as-is for any
PES dissertation/review deliverable in this repo:

1. Introduction (Background → Problem Statement → domain primer → Proposed Solution)
2. Literature Survey (grouped by technique/approach, closing with a pros/cons summary
   table)
3. System/Project Requirements Specification (Scope, Perspective, Functional/
   Non-Functional requirements as numbered IDs, Assumptions/Constraints,
   hardware/software environment tables)
4. Proposed Methodology (Architecture → per-subsystem Design, each subsystem gets its
   own figure)
5. Implementation Details (tools/libraries table, module-by-module description)
6. Results and Discussion (datasets → metrics defined → results per experiment →
   Discussion that interprets, doesn't just restate)
7. Conclusion and Future Work
8. References (numbered, in order of first citation — not alphabetical)

Every chapter opens with a **roadmap paragraph** (below) and most close with a
**Summary** subsection that restates what was covered and points forward.

## The chapter-opening roadmap paragraph

Every chapter in Report D opens with two to four sentences stating what the chapter
covers and pointing to its own subsections by number. This is the single most consistent
structural device across both reports.

Worked pattern, paraphrased from Report D's Literature Survey opening:

> "The literature survey presented here is split broadly into multiple sections —
> section 2.1 explores a few of the recent advances in [X], followed by section 2.2,
> which describes studies focused on [Y]. Section 2.3 describes common techniques used
> for [Z]. [...]"

Apply the same shape when opening a chapter of this project's own report, e.g. its
Literature Survey:

> "This chapter surveys the techniques this project draws on. Section 2.1 covers
> Bayesian knowledge tracing and pace-calibration models for self-directed learners.
> Section 2.2 reviews change-point detection methods applicable to behavioural-shift
> detection. Section 2.3 surveys constraint-based schedule generation. Section 2.4
> summarizes the gaps this project addresses."

Rule: name the section numbers explicitly ("Section 2.1"), not vague pointers ("the next
section"), and state the topic alongside the number, not the number alone.

## The literature-review paragraph formula

This is the highest-value pattern extracted. Every literature-review paragraph in both
reports — dozens of them — follows the same four-beat shape:

1. **Attribution + verb + artifact name** — "Author et al. [N] proposes/offers/
   describes/introduces [Method or System Name]"
2. **Mechanism, in one or two sentences** — what the method actually does, technically,
   with no adjectives
3. **Quantitative result** — a specific number with its metric name ("achieves a
   detection rate of 97.1%", "obtains an mAP of 78.6% on PASCAL VOC 2007")
4. **Limitation, gap, or notable exception** — one sentence, often opening with
   "However,", "The limitation of...", "but...", or "except for..."

Worked example, verbatim from Report D §2.2:

> "Rhode et al. [19] proposes a dynamic detection technique that exposes a malicious
> executable within 5 seconds of its execution. This is achieved by the use of a 5
> seconds snapshot of the malware behavioural data and Recurrent neural networks. The
> model is capable of detection within 5s with 94% accuracy and an accuracy of 89% for
> unseen malware within 1 second of execution. The authors intend to further expand the
> model using non-windows executables sample [...]"

Applied to this project's own domain — constructed here to show the formula
transferring, not lifted from either source report:

> "Corbett and Anderson [N] introduce Bayesian Knowledge Tracing, a hidden Markov model
> that estimates a learner's latent mastery of a skill from a binary sequence of
> correct/incorrect responses. The model updates a per-skill mastery probability after
> each observed response using four fitted parameters — prior knowledge, learning rate,
> guess, and slip. BKT has since become the standard baseline for knowledge-tracing
> benchmarks, but it assumes a single skill per item and cannot represent multi-skill
> dependencies, which motivated later deep-learning variants such as DKT."

Attribution-verb bank — rotate these; don't reuse the same verb in adjacent paragraphs:
*proposes, offers, illustrates, describes, presents, introduces, recommends,
demonstrates, evaluates, addresses, studies, reports, discusses*.

Never write a literature paragraph that skips beat 3 (the number) or beat 4 (the
limitation) — both source reports include both in every single entry. A paragraph that
only summarizes what a paper did, with no metric and no gap, reads as padding, not
survey.

## Hedging and honest-uncertainty vocabulary

Real researchers do not overclaim. Both reports, and especially Report D, hedge
constantly and specifically — the hedge is always attached to a *reason*, never used as
a verbal tic. Phrase bank, pulled from the source text:

| Phrase | Used when |
|---|---|
| "It is to be noted that..." | flagging a result that needs interpretation before the reader over-reads it |
| "This indicates that..." | drawing one specific inference from one specific number |
| "Alternatively, it is also possible that..." | offering a second, non-exclusive explanation for a result |
| "The most notable [statistic/result] here is..." | pointing at the one number worth dwelling on, not all of them |
| "This can be reconfirmed from Figure X, where..." | backing an inference with a named, specific piece of evidence |
| "in theory... but in practice..." | contrasting expected vs. observed behavior |
| "is likely to / tends to / could potentially" | describing behavior under conditions not directly tested |
| "To the best of my knowledge, this is the first..." | staking a novelty claim — always immediately followed by naming the closest prior work |

Anti-pattern: hedging with no attached reason ("this may vary"), or stacking hedges
until the sentence says nothing ("it is possible that this could potentially in some
cases lead to..."). One hedge per claim, tied to a concrete cause.

## Reporting results honestly, including bad ones

Report D's strongest trait: it reports poor results plainly and explains the mechanism
behind them, without spin. Verbatim:

> "The results show a fair accuracy for the elephant dataset, but it is poor for the
> remainder of the datasets. [...] It is to be noted that the model has not been trained
> over any specific dataset [...]. As a result, the detection accuracy is fairly low."

> "The most notable statistic here is the accuracy for elephants – it's around 5%, which
> is extremely poor. The main reasons for this low score include the diversity of the
> dataset."

> "There is clearly lot of room for improvement here. The low accuracy rates can be
> attributed to the following factors: a) [...] b) [...] c) [...]"

Pattern: **state the number → judge it in one specific adjective ("fair", "poor",
"extremely poor") → immediately explain the mechanism behind the number → tie the
explanation to a specific, named factor in the data or method.** Never present a bad
number without the next sentence explaining why, and never soften a bad number with
vague qualifiers ("suboptimal", "there is room for growth") in place of the actual
adjective and reason.

When listing multiple candidate reasons for a result, use a lettered list (a, b, c...)
inline in prose — both reports do this — rather than a bulleted list with headers.

## Vocabulary and phrase bank

**Chapter/section framing**, opening or closing a section: "This chapter describes/
presents/discusses...", "In this section, we discuss...", "The remainder of this
section...", "This section briefly summarizes...", "As previously discussed in section
X..."

**Transitions actually used** — contrast, not stacked connectives: "However,", "While
X..., Y", "Though/Although X, Y", "Unlike X,", "In contrast,", "Apart from X,", "On the
other hand,"

Note what's absent from both reports: no "Moreover," "Furthermore," and "Additionally,"
stacked across successive sentences. Each paragraph uses at most one contrast
connective; most sentences connect with no connective at all, relying on ordering.

**Metric-reporting syntax** — always name the metric and the dataset, never just "high
accuracy": "achieves a detection rate of 97.1%", "obtains an mAP of 78.6% on PASCAL VOC
2007", "with a false positive rate of 1%", "achieved an accuracy of nearly 92%, but the
accuracy drops to around 75% when..."

**Limitation framing:** "The limitation of this approach is...", "This approach is
limited if...", "remains an open concern", "could be further expanded to...", "The
authors intend to..."

**Self-positioning against related work** — for framing this project's own contribution:
"To the best of my knowledge, this is the first...", "The closest such system is
described in [N], where...", "No system has tried to include [X] as part of its goal."

## Register and voice rules

- **Third person, passive-leaning register for the technical body.** "The proposed
  system uses...", "This chapter presents...", "It is necessary to..." First person
  ("I", "we") is reserved for the Acknowledgement section and rare framing statements
  like "To the best of my knowledge." Don't write "We built X" in a methodology chapter;
  write "The system implements X" or "X was implemented using..."
- **Tense discipline:** past tense for what was actually done ("was implemented", "was
  trained", "achieved an accuracy of..."); present tense for general/atemporal
  statements about how a technique works ("SVMs are a popular class of learning
  systems"); future tense only for explicitly deferred work ("will be attempted in the
  next phase").
- **Numbers are always specific.** Never "high accuracy" or "significant improvement"
  alone — always follow with the number, or don't make the claim. Percentages to one or
  two decimals when the source gives them (99.92%, not "about 100%").
- **Every figure/table reference is numeric and explicit** — "as shown in Table 6-4",
  "Figure 4.1 illustrates..." — never "as we showed above" or "the figure below" without
  a number.
- **Cross-references use section numbers**, not vague pointers: "As described in
  4.3.1," not "as mentioned earlier."

## Signs of AI-generated prose to avoid

None of these appear in either source report — they are the actual tells that make
agent-drafted prose read as synthetic rather than human-researcher:

- Opening a paragraph with "It is important to note that..." as a reflexive crutch.
  Contrast with the source reports' specific, situational "It is to be noted that...
  [X]", which always attaches to one concrete number or claim and is never used as a
  generic opener.
- Triadic adjective padding: "efficient, effective, and reliable", "robust, scalable,
  and maintainable" — neither report ever stacks three adjectives; they use one specific
  adjective plus a number.
- Stacked connectives: "Moreover, furthermore, additionally" appearing in consecutive
  sentences.
- Generic hedge stacking with no attached cause ("this may potentially vary depending on
  various factors").
- Claims of high performance with no number attached.
- Em dashes used as a substitute for commas or periods — use a plain dash "-" instead,
  and prefer the source reports' actual habit of short declarative sentences over
  dash-joined clauses.
- Every section restating the same transition ("In this section, we will explore...") —
  the source reports vary their chapter-opening phrasing chapter to chapter.
- Abstract overclaiming: neither abstract in the source reports says "revolutionary" or
  "novel state-of-the-art" — Report R's abstract states the mechanism and the goal
  plainly ("The proposed hybrid system intends to detect ransomware using...").

## Signs of weak student prose to avoid

Report R is a legitimate, passing dissertation, but these specific habits are worth
deliberately avoiding even though they occur in a real submitted report:

- **Subject-verb disagreement in list-heavy sentences.** "the sample size,
  false-positive rate, the CPU requirements **are** all important factors" reads
  awkwardly once a long compound subject loses agreement — keep such enumerations short
  or restructure as "Sample size, false-positive rate, and CPU requirements are all
  important factors."
- **Verbatim repetition across sections.** Report R repeats the *exact same paragraph*
  about false-positive rates in both its Problem Statement and its Non-Functional
  Requirements section. If content genuinely belongs in two places, restate it with
  different emphasis or cross-reference instead: "see §1.2 for the general case; this
  section quantifies it as a non-functional requirement."
- **Pluralizing uncountable/technical nouns inconsistently.** "ransomwares", "malwares",
  "loses" (for "losses") — pick the standard technical term and its correct plural once,
  and use it consistently.
- **Dramatic or purple phrasing in a technical register.** "Ransomware is also a
  psychological play", "mortifying", "instil fear of the consequences" — vivid language
  is fine in a Background/motivation section in small doses, but Report D's Background
  section (also emotionally loaded material — human-wildlife conflict) stays clinical:
  "such transgressions of wild animals are discovered only after the first few
  casualties" states the stakes without adjectival flourish.
- **Inconsistent capitalization of common technical terms.** "Machine Learning" and
  "machine learning" alternate within the same paragraph. Pick one convention — this
  project should lowercase common-noun usage ("machine learning techniques") and
  capitalize only proper model/system names — and hold it throughout.

## Worked example: before and after

**Before** — a generic AI-drafted results paragraph; do not write like this:

> "The proposed system demonstrates robust and efficient performance across various
> datasets. The calibration model achieves excellent accuracy, showcasing its potential
> for real-world deployment. Furthermore, the results indicate significant improvements
> over baseline approaches, highlighting the effectiveness of the proposed
> methodology."

**After** — rewritten in the extracted voice, Report-D style:

> "The calibration model achieves a mean absolute error of 0.8 hours/week against the
> synthetic ground-truth pace, against 2.1 hours/week for the fixed-rate baseline. It is
> to be noted that this gap narrows considerably in the first two weeks of a plan, when
> too few sessions have been logged for the Bayesian update to move far from its prior —
> the model effectively falls back to the baseline's assumption until roughly six
> sessions have accumulated. This is consistent with the literature on cold-start
> behaviour in Bayesian pace models (§2.1), and suggests that a future revision could
> shorten this window with an informative prior seeded from onboarding data rather than
> a flat one."

What changed: every unsupported adjective ("robust", "excellent", "significant") was
replaced with a number and a named baseline for comparison; "Furthermore" was cut
entirely; the one hedge ("It is to be noted that") is attached to a specific mechanism,
not a general disclaimer; the paragraph ends by pointing at a concrete, named
future-work item instead of a vague "shows potential."

## See also

- [`TIKZ_DIAGRAM_GUIDE.md`](./TIKZ_DIAGRAM_GUIDE.md) — companion guide for producing the
  report's architecture/flow figures
- `.claude/rules/latex-report-build.md` — TinyTeX toolchain for compiling the report this
  guide's prose feeds into
- `college/sampleReports/` — the two source PDFs this guide was extracted from, plus the
  blank official LaTeX template
