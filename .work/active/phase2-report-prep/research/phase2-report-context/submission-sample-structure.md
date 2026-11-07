---
title: Phase-2 report submission rules and sample structure
purpose: Give report implementers the exact submission, structural, and formatting constraints Phase-2 must follow.
question: What structure and formatting must Phase-2 follow?
status: complete
author: Stream A
last_updated: 2026-10-14
---

## Question

What structure and formatting must the Phase-2 dissertation follow.
Scope is submission gates plus sample structure only.
LaTeX preamble analysis and toolchain builds belong to Streams B/C and are out of scope here.
All `college/` sources were read only; nothing under `college/` was created, edited, or compiled.

## TL;DR

Follow the sample PDF as the structural template, but overwrite its stale identity block with the guideline values.
The report needs at least 40 body pages, one-sided printing, justified text, a light-cream hard binding, one hard copy to Great Learning HQ, and a softcopy in Olympus.
The journal deliverable is a separate single-column IEEE softcopy and must not leak into the dissertation format.
The guideline contradicts itself on the front-page duration, and the sample carries 2021 CSE metadata that must not be copied.

| Binding constraint | Value to use | Source |
|---|---|---|
| Subject code | `UE20CS972` for Phase-2 | `college/mydeliverables/Phase-2-report/MTech project report submission guideline.html:266` |
| Degree name | `Master of Technology in Data Science and Artifical Intelligence` (sic, confirm spelling) | `MTech project report submission guideline.html:287` |
| Page floor | At least 40 pages excluding first page, Certificate, Declaration | `MTech project report submission guideline.html:285` |
| Print | One side only, justified text | `MTech project report submission guideline.html:293`, `:296` |
| Plagiarism cap | 15 or below, approved by mentor and coordinator | `MTech project report submission guideline.html:305` |
| Binding color | Light cream, NOT yellowish | `MTech project report submission guideline.html:312` |
| Hard copies | 1 copy to Anurag Sah, Great Learning HQ, HSR Layout Bengaluru | `MTech project report submission guideline.html:327`, `:332` |
| Journal format | Softcopy, single column, IEEE format | `college/mydeliverables/Phase-2-report/INFO.txt:8-10` |
| Report softcopy | Submitted in Olympus; hardcopy sent separately | `INFO.txt:12-13` |

## Methodology

Read the guideline HTML end to end through the Read tool.
Read the 58-page sample PDF through the Read tool in render order.
Read all 13 lines of `INFO.txt`.
Glanced at both cover images without editing anything.
Ran read-only `pdfinfo` and `pdffonts` against the sample PDF for page geometry and font evidence.
PDF page numbers below (`PDF pN`) use rendered-file order: front matter is PDF pp 1-10, body page N is PDF p(N+10), verified by footer numbering against the 58-page `pdfinfo` total.

```text
college/mydeliverables/Phase-2-report/
  INFO.txt                                        # 13 lines, signatories + deliverable split
  MTech project report submission guideline.html  # 357 lines, hard-copy gates
  phase-2-sample-to-follow.pdf                    # 58 pages, Letter, Word-authored
  frontpage-sample.jpeg                           # bound-cover photo, read-only glance
  frontpage-color.png                             # cream swatch, read-only glance
```

## Findings

### Guideline hard-copy submission gates for Phase-2 ESA eligibility

Hard-copy submission is a pre-requisite for sitting in the Phase-2 ESA Review (`MTech project report submission guideline.html:272`).
The same gate is restated in the notes list (`MTech project report submission guideline.html:346`).
Results are declared only after all deliverables and reviews finish (`MTech project report submission guideline.html:347`).
Internal reviews of both phases plus Phase-1 ESA must be complete, with guide/mentor confirming all marks are entered (`MTech project report submission guideline.html:283`).
The Olympus-shared sample template must be strictly followed before binding (`MTech project report submission guideline.html:284`).
Exactly 1 hard copy goes by post to Anurag Sah at Great Learning HQ, F1 and F2, H207, HSR Layout, Bengaluru 560102 (`MTech project report submission guideline.html:327`, `:332`).
A location link is provided alongside the postal address (`MTech project report submission guideline.html:335`).

### Guideline front-page identity block for the current cohort

Subject code is `UE20CS972` for Phase-2 (`MTech project report submission guideline.html:266`).
Degree name must read `Master of Technology in Data Science and Artifical Intelligence`, preserving the source spelling until confirmed (`MTech project report submission guideline.html:287`).
Front-page duration is stated as `May 2026 to Oct 2026` (`MTech project report submission guideline.html:290`).
The closing note instead states `July 2025 - December 2025`, which directly conflicts with the May-Oct 2026 value (`MTech project report submission guideline.html:349`).
The Olympus front-page image is reference only; teams must substitute their own subject code, guide name, and duration (`MTech project report submission guideline.html:322`).

### Guideline page-count floor and print-shop rules

The report must be at least 40 pages excluding the first page, Certificate, and Declaration (`MTech project report submission guideline.html:285`).
Content is printed on only one side of the page (`MTech project report submission guideline.html:293`).
Body text must be evenly distributed between margins using `Justify` (`MTech project report submission guideline.html:296`).
The mentor's digital (scanned) signature belongs on the Certificate page; GL-faculty mentors sign physically later instead (`MTech project report submission guideline.html:299`).
The student's digital signature belongs on the Declaration page (`MTech project report submission guideline.html:302`).
Plagiarism must be 15 or below, checked via `pesu.eclib@pes.edu` with Anurag Sah in CC, and the final report needs mentor plus coordinator approval (`MTech project report submission guideline.html:305`).
Binding uses a light cream cover, explicitly not yellowish (`MTech project report submission guideline.html:312`).
The guideline states no page size, margins, fonts, line spacing, bibliography style, or caption rules; formatting authority therefore falls back to the sample template (`MTech project report submission guideline.html:282-307` as the complete checklist).

### Sample front-matter sequence from cover to figure list

PDF p1 is the cover: PES University crest, `Dissertation on`, quoted title, partial-fulfilment line, degree, department, faculty, university, establishment Act line, and address block.
PDF p2 is the `CERTIFICATE` page with title, student name and SRN, course code, program, period, corrections-incorporated clause, two External Viva examiner lines, and signature lines for Guide, Chairperson, and Dean of Faculty.
PDF p3 is the `DECLARATION` page with guide attribution, partial-fulfilment clause, not-submitted-elsewhere clause, and SRN plus name sign-off.
PDF p4 is the `ACKNOWLEDGEMENT` page thanking guide, coordinators, Chairperson, Dean, Chancellor, Pro Chancellor, Vice-Chancellor, family, and friends.
PDF p5 is the `ABSTRACT` page: one running prose paragraph with no Keywords line observed.
PDF pp 6-7 hold `TABLE OF CONTENTS` with chapter number, title, and start page columns.
PDF p8 holds `LIST OF TABLES` with table number, title, and page columns.
PDF pp 9-10 hold `LIST OF FIGURES` with figure number, title, and page columns.
Every PDF page also carries a personal-use watermark with an email handle; that watermark is a distribution artifact and must not be reproduced.

### Sample chapter order and seven-chapter TOC hierarchy

Chapter 1 `INTRODUCTION` starts body p1 (PDF p11) with sections 1.1 Background, 1.2 Problem Statement, 1.3 Ransomware, 1.4 Proposed Solution (PDF p6).
Body text further subdivides 1.3 into 1.3.1 Infection Sources, 1.3.2 Types, and 1.3.3 Lifecycle, a third level the TOC itself does not list (PDF pp 17-19).
Chapter 2 `LITERATURE SURVEY` starts body p11 (PDF p21) with 2.1 Machine Learning, 2.2 Deep Learning, 2.3 NLP, 2.4 Summary (PDF p6).
The body heading for section 2.1 is mislabeled `1.1 Machine Learning Approach`; do not copy that numbering (PDF p21).
Chapter 3 starts body p18 (PDF p28); the TOC calls it `SYSTEM REQUIREMENT SPECIFICATION` while the body heading reads `PROJECT REQUIREMENTS SPECIFICATION` (PDF p6, PDF p28).
Chapter 3 nests 3.1 Introduction with 3.1.1 Project Scope, 3.2 Perspective with 3.2.1-3.2.3, then 3.3 Functional, 3.4 Non-Functional, and 3.5 System Environment with 3.5.1 Hardware and 3.5.2 Software (PDF pp 28-33).
Chapter 4 `PROPOSED METHODOLOGY` starts body p24 (PDF p34) with 4.1 System Architecture and 4.2 System Design split into 4.2.1 Pre-processing, 4.2.2 Feature Generation, 4.2.3 Model Fitting Evaluation, 4.2.4 Summary (PDF p7).
Chapter 5 starts body p29 (PDF p39); the TOC says `IMPLEMENTATION DETAILS` while the body heading adds `AND PSEUDOCODE`, with 5.1 Software Tools and 5.2 Modules (PDF p7, PDF p39).
Chapter 6 `RESULTS AND DISCUSSION` starts body p32 (PDF p42) and runs 6.1 Datasets through 6.9 Discussion, the longest chapter at 12 body pages (PDF p7, PDF pp 42-53).
Chapter 7 `CONCLUSION AND FUTURE WORK` occupies body p44 (PDF p54), a single page (PDF p7).
`BIBLIOGRAPHY` starts body p45 (PDF p55) and runs to body p48 (PDF p58), so references occupy 4 pages (PDF p7).

### Sample table and figure inventories with page anchors

The List of Tables names five tables: 2.4 summary of approaches (p17), 3.1 Hardware Requirements (p22), 3.2 Software Requirements (p23), 5.1 Software Tools (p29), 6.1 Classification Metrics (p42) (PDF p8).
The List of Figures names twenty entries: 1.1 (p02), 1.2 (p03), 1.3 (p04), 1.4 (p06), 4.1 (p25), 4.2 (p26), 4.3 (p27), 4.4 (p28), 5.2 (p31), 6.1 (p32), 6.2 (p33), 6.3 (p33), 6.4 (p34), 6.5 (p35), 6.6 (p36), 6.7 (p37), 6.8 (p38), 6.9 (p39), 6.10 (p40), and 6.11 on the overflow page (p41) (PDF pp 9-10).
Figure numbering skips 5.1 with no explanation; the first Chapter-5 figure is labeled 5.2 (PDF p9, PDF p41).
Body pages carry a running header with the dissertation short title and a footer rule with `Dept. of CSE` plus period and body page number (PDF pp 21-58).

### Sample reference style and appendix absence

The closing section is headed `References`, not `Bibliography`, despite the TOC calling it `BIBLIOGRAPHY` (PDF p55, PDF p7).
Entries are numbered `[1]` through `[33]` in citation order with mixed web, paper, and proceedings formats plus raw URLs (PDF pp 55-58).
The style is numeric-bracket and IEEE-flavored but not IEEEtran-formatted: no venue abbreviations, no `thebibliography` environment, consistent with a Word document rather than LaTeX (PDF pp 55-58).
There is no appendix anywhere: the TOC ends at `BIBLIOGRAPHY`, and no appendix pages follow the references (PDF p7, PDF p58).
Do not invent an appendix unless a coordinator explicitly requires one.

### Sample caption placement convention in reading order

Figure captions read as standalone `Figure N: Title` lines inside the figure block, after the in-text reference and before the resuming paragraph (PDF pp 12-13 for Figure 1.1).
Table captions read as `Table N: Title` lines immediately before the tabular rows in text order, observed for Tables 2.4, 3.1, 3.2, 5.1, and 6.1 (PDF pp 27, 32-33, 39, 52).
Table 6.1 is the exception that proves the check: its caption line runs directly into the following paragraph text, so caption spacing needs a visual pass (PDF p52).
Pixel-exact above/below placement cannot be proven from text-order extraction alone; treat this as a working convention pending visual confirmation.

### Sample page geometry and Word-authored font evidence

`pdfinfo` reports 58 pages at `612 x 792 pts (letter)`, produced by `pdf-lib`, CreationDate 2026-09-20, which matches a watermarked re-export rather than the 2021 original.
`pdffonts` shows body text in `TimesNewRomanPSMT` with `ArialMT`/`Arial-BoldMT` headings and `Helvetica`/`SymbolMT` supplements; no Computer Modern or other TeX fonts appear.
The font stack plus Letter geometry means the sample is MS-Word-authored, so there is no 12pt `report`-class or 1-inch-margin evidence to inherit.
Any LaTeX replica must therefore approximate, not inherit, the sample metrics: Times-like serif body, Arial Bold headings, Letter paper, single-sided.

```text
Pages:           58
Page size:       612 x 792 pts (letter)
Body font:       TimesNewRomanPSMT (+ Bold)
Heading font:    ArialMT / Arial-BoldMT
TeX fonts:       none detected
```

### Cover-layout and binding-color references from image glance

The bound-cover photo shows a dark rectangular frame border containing, top to bottom: PES crest, `Dissertation on`, quoted title, partial-fulfilment line, `Master of Technology`, `in`, specialization, subject code plus `Project Phase - 2`, `Submitted by` with name and SRN, `Under the guidance of` with guide name, duration line, then department, faculty, university, Act, and address lines (`college/mydeliverables/Phase-2-report/frontpage-sample.jpeg`).
The photographed 2022 precedent uses specialization `Data Science and Machine Learning` and duration `March - May 2022`; both must be replaced with current-cohort values, not copied (`frontpage-sample.jpeg`).
The color reference PNG is a flat light-cream solid swatch with no text, confirming the guideline's cream-not-yellow binding rule (`college/mydeliverables/Phase-2-report/frontpage-color.png`, `MTech project report submission guideline.html:312`).

### INFO-txt signatory roster and deliverable split

Chairperson is Dr. Sandesh B J (`college/mydeliverables/Phase-2-report/INFO.txt:1`).
Dean of Faculty is Dr. Keshavan B K (`INFO.txt:2`).
Chancellor is Prof. Jawahar Doreswamy (`INFO.txt:3`).
Vice Chancellor is Dr. Suryaprasad J (`INFO.txt:4`).
Guide designation follows the guide's current designation; a faculty title is not compulsory (`INFO.txt:5`).
The journal deliverable is a softcopy in single-column IEEE format (`INFO.txt:8-10`).
The report deliverable is a softcopy in Olympus plus a sent hardcopy (`INFO.txt:12-13`).

### Conflict register across sample, guideline, and INFO-txt

| # | Conflict | Evidence | Resolution |
|---|---|---|---|
| C1 | Front-page duration contradicts itself | `May 2026 to Oct 2026` at `MTech project report submission guideline.html:290` vs `July 2025 - December 2025` at `:349` | Escalate to program office; default to `:290` until answered |
| C2 | Sample identity block is stale | Sample uses `UE19CS651`, CSE degree, `Jan-May 2021` (PDF pp 1-2) vs required `UE20CS972`, DSAI degree (guideline `:266`, `:287`) | Overwrite every identity field; copy structure only |
| C3 | Journal vs dissertation formats must not mix | Single-column IEEE journal (`INFO.txt:8-10`) vs Word-style dissertation template (guideline `:284`) | Two deliverables, two formats |
| C4 | Degree-name spelling suspect | `Artifical` in guideline `:287` | Confirm spelling before printing |
| C5 | Chancellor title drift | Sample thanks Chancellor M. R. Doreswamy plus Pro Chancellor Jawahar Doreswamy (PDF p4) vs INFO-txt naming Prof. Jawahar Doreswamy as Chancellor (`INFO.txt:3`) | Use current INFO-txt roster on Certificate |
| C6 | Sample numbering bugs | Body `1.1` under Chapter 2 (PDF p21); TOC/body title drift in Chapters 3 and 5 (PDF pp 6-7, pp 28, 39); skipped Figure 5.1 (PDF p9) | Fix numbering in the new report |
| C7 | No appendix precedent | TOC ends at `BIBLIOGRAPHY` (PDF p7); guideline never mentions appendices | Omit appendix unless requested |

## Recommendation

Use the sample's front-matter order and seven-chapter spine verbatim, replace all identity fields with guideline values, and target the 40-page floor with single-sided Letter pages.
Keep figure captions with their figure blocks and table captions directly above their tables, matching the sample's reading order.
Produce the journal as a separate single-column IEEE softcopy; never restyle the dissertation to look like the journal.
Resolve conflicts C1 (duration) and C4 (`Artifical` spelling) with the program office before binding, because both are baked into print.
Treat the sample's fonts as Word evidence (Times body, Arial headings) and let Streams B/C set the closest LaTeX equivalent rather than claiming false parity here.

## References

- `college/mydeliverables/Phase-2-report/MTech project report submission guideline.html` - 357-line Olympus guideline; sole authority for codes, duration, page floor, print, signature, plagiarism, binding, and postal rules.
- `college/mydeliverables/Phase-2-report/phase-2-sample-to-follow.pdf` - 58-page ransomware-detection dissertation; structural template for front matter, chapters, lists, captions, and references.
- `college/mydeliverables/Phase-2-report/INFO.txt` - 13-line roster and deliverable split: signatories, guide-designation rule, IEEE journal softcopy, Olympus plus hardcopy report.
- `college/mydeliverables/Phase-2-report/frontpage-sample.jpeg` - bound-cover layout precedent (2022 DSML instance); layout reference only.
- `college/mydeliverables/Phase-2-report/frontpage-color.png` - cream binding-color swatch; visual confirmation of the cream-not-yellow rule.
- [Phase-1 report sources](../../../../../college/mydeliverables/Phase-2-report/phase1-report/) - sibling directory for cross-phase structural comparison, not examined by this stream.
