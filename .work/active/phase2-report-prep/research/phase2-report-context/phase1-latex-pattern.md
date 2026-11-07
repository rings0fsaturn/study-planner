---
title: Phase-1 LaTeX preamble and chapter patterns for Phase-2 reuse
purpose: Reusable LaTeX preamble/pattern checklist for Phase-2 report writing
question: What exact documentclass, packages, macros, chapter, float, citation, voice, and diagram patterns does the Phase-1 report use that Phase-2 should copy?
status: complete
last_updated: 2026-10-14
---

## Question

What exact LaTeX preamble, chapter, float, citation, voice, and diagram patterns does the Phase-1 report (`college/mydeliverables/Phase-2-report/phase1-report/`) establish that the Phase-2 report should reuse, and where does Phase-1 practice conflict with its own guides?

## TL;DR

- Copy the `report` + 12pt + A4/1in preamble verbatim as the Phase-2 starting point (`main.tex:1`, `main.tex:25`).
- Keep `thebibliography{99}` ordered by first Ch2 citation, Pillar-A then Pillar-B (`main.tex:111-113`, `main.tex:157`).
- Keep one-file-per-chapter `\input{chapters/0X-...}` order 01-07 (`main.tex:101-107`).
- Keep the roadmap-paragraph opener in every chapter and the 4-beat lit-review paragraph (`01-introduction.tex:2`, `REPORT_WRITING_GUIDE.md:99-112`).
- Keep caption-above-tables, caption-below-figures, `\label` after `\caption`, `fig:`/`tab:`/`eq:`/`lst:` keys (`02-literature-survey.tex:26-27`, `03-requirements.tex:9-11`).
- Keep inline pgfplots schematics for Ch2/6 and external vector-PDF `\includegraphics` for architecture (`02-literature-survey.tex:16-28`, `04-methodology.tex:116`).
- Architecture diagrams for Phase-2 follow the standalone-TikZ recipe and raster-inspect loop (`TIKZ_DIAGRAM_GUIDE.md:84-96`, `TIKZ_DIAGRAM_GUIDE.md:34-57`).
- Six conflicts flagged under `### Conflicts-phase1-practice-vs-guide-expectations`; read before copying blindly.

## Methodology

- Read-only sweep of the `college/` tree; no files created, edited, or compiled there and no `latexmk` runs.
- Read `college/mydeliverables/Phase-2-report/phase1-report/main.tex` in full (177 lines) plus all 7 files under `college/mydeliverables/Phase-2-report/phase1-report/chapters/`.
- Read `college/mydeliverables/Phase-2-report/phase1-report/REPORT_WRITING_GUIDE.md` (328 lines) and `college/mydeliverables/Phase-2-report/phase1-report/TIKZ_DIAGRAM_GUIDE.md` (175 lines).
- Listed `college/mydeliverables/Phase-2-report/phase1-report/` and `college/mydeliverables/Phase-2-report/phase1-report/screenshots/` for reuse inventory only; no PDFs opened.
- Every factual claim below cites `path:line`; line numbers refer to the file as read on 2026-10-14.

## Findings

### Preamble-documentclass-package-geometry-checklist

Copy-paste starter distilled from `college/mydeliverables/Phase-2-report/phase1-report/main.tex:1-26`:

```latex
\documentclass[12pt]{report}                                   % main.tex:1
\usepackage[utf8]{inputenc}                                    % main.tex:2
\usepackage[T1]{fontenc}                                       % main.tex:3
\usepackage{graphicx}                                          % main.tex:4
\usepackage{booktabs}                                          % main.tex:5
\usepackage{array}                                             % main.tex:6
\usepackage{enumitem}                                          % main.tex:7
\usepackage{float}                                             % main.tex:8
\usepackage{caption}                                           % main.tex:9
\usepackage{subcaption}                                        % main.tex:10
\usepackage{amsmath}                                           % main.tex:11
\usepackage{amssymb}                                           % main.tex:12
\usepackage{tikz}                                              % main.tex:13
\usetikzlibrary{arrows.meta, positioning, calc}                % main.tex:14
\usepackage{pgfplots}                                          % main.tex:15
\pgfplotsset{compat=1.18}                                      % main.tex:16
\usepgfplotslibrary{fillbetween}                               % main.tex:17
\usepackage{listings}                                          % main.tex:18
\lstset{basicstyle=\ttfamily\footnotesize, breaklines=true,   % main.tex:19-20
  frame=single, showstringspaces=false, columns=fullflexible,
  keepspaces=true, aboveskip=6pt, belowskip=4pt}
\usepackage{hyperref}                                          % main.tex:23
\usepackage{geometry}                                          % main.tex:24
\geometry{a4paper, margin=1in}                                 % main.tex:25
\setcounter{secnumdepth}{3}                                    % main.tex:26
```

| Item | Phase-1 value | Source |
|---|---|---|
| Document class | `report`, option `12pt`, no `twoside`/`twocolumn` | `main.tex:1` |
| Paper and margins | A4, 1in via `geometry` | `main.tex:25` |
| Section numbering depth | `secnumdepth=3` (numbers `subsubsection`, e.g. 2.1.1) | `main.tex:26` |
| TikZ libraries | `arrows.meta, positioning, calc` | `main.tex:14` |
| pgfplots version | `compat=1.18` plus `fillbetween` library | `main.tex:15-17` |
| Listings defaults | footnote tt, breaklines, single frame, no string spaces, fullflexible columns | `main.tex:19-20` |
| Hyperlink support | `hyperref` loaded after listings/macro, before geometry | `main.tex:23` |

### Custom-macro-screenshotplaceholder-listings-defaults

```latex
% Placeholder box for app screenshots pending capture (D8). #1 = height, #2 = label. % main.tex:21
\newcommand{\screenshotplaceholder}[2]{\fbox{\begin{minipage}[c][#1][c]{0.82\linewidth}\centering\itshape\footnotesize Screenshot placeholder\\[3pt]#2\end{minipage}}} % main.tex:22
```

| Macro or setting | Behaviour | Source |
|---|---|---|
| `\screenshotplaceholder{height}{label}` | Framed 0.82-linewidth minipage, italic footnote placeholder text | `main.tex:21-22` |
| Only custom macro | No other `\newcommand`/`\newenvironment` in preamble | `main.tex:1-26` |
| Listings environment | `lstlisting` with `language=`, `caption={}`, `label={lst:...}` keys | `05-implementation.tex:59` |
| Listings wrapping | Long listings wrapped in `\noindent\begin{minipage}{\linewidth}` | `05-implementation.tex:58-69` |

### Front-matter-title-certificate-abstract-TOC-order

```latex
\begin{document}                  % main.tex:36
% title page -> Certificate -> Declaration -> Acknowledgement -> Abstract
% -> \tableofcontents -> \listoffigures -> \listoftables -> chapters -> thebibliography
```

| Block | Shape | Source |
|---|---|---|
| Title page | Centered PESU logo 5cm, Dissertation title, M.Tech Data Science and AI, UE20CS971 Phase-1, author PES2PGE24DS201, guide, May-October 2026, university address | `main.tex:38-63` |
| Certificate | Unnumbered `\section*{Certificate}`, bonafide-work text, guide signature flushright, `\newpage` after | `main.tex:67-76` |
| Declaration | Unnumbered `\section*{Declaration}`, Phase-1 authorship text, `\newpage` after | `main.tex:78-81` |
| Acknowledgement | Unnumbered `\section*{Acknowledgement}`, guide/coordinator/department/family thanks | `main.tex:83-84` |
| Abstract | Unnumbered `\section*{Abstract}`, forward Pillar-A narrative, honest-scope comment D2/D3/D4/D11 | `main.tex:88-90` |
| TOC/LOF/LOT | `\tableofcontents`, `\listoffigures`, `\listoftables`, each followed by `\newpage` | `main.tex:93-98` |
| Modular-layout comment | Front matter + bibliography live in main; chapters editable under `chapters/`; voice/figure/build pointers D1-D12 | `main.tex:28-34` |

### Chapter-include-order-one-file-per-chapter

```latex
\input{chapters/01-introduction}      % main.tex:101
\input{chapters/02-literature-survey} % main.tex:102
\input{chapters/03-requirements}      % main.tex:103
\input{chapters/04-methodology}       % main.tex:104
\input{chapters/05-implementation}    % main.tex:105
\input{chapters/06-results}           % main.tex:106
\input{chapters/07-conclusion}        % main.tex:107
```

| Convention | Detail | Source |
|---|---|---|
| File-per-chapter | Exactly one `.tex` file per numbered chapter, `01` through `07` | `chapters/:01-07` listing |
| Chapter command | Each file opens with `\chapter{...}` and never sets its own preamble | `01-introduction.tex:1`, `02-literature-survey.tex:1`, `03-requirements.tex:1`, `04-methodology.tex:1`, `05-implementation.tex:1`, `06-results.tex:1`, `07-conclusion.tex:1` |
| No `\include` | Includes use `\input`, no `\includeonly` or per-chapter `\begin{document}` | `main.tex:101-107` |

### Bibliography-thebibliography-ordering-rule

```latex
\begin{thebibliography}{99}              % main.tex:111
% Pillar-A bibliography, ordered by first citation in Ch2 (D4/D11). % main.tex:112
\bibitem{chen2024} Chen, et al., ...    % main.tex:115
% --- Pillar-B references (Phase II; cited in Chapter 7 Future Work only) --- % main.tex:157
\bibitem{clst2024} ...                  % main.tex:158
\end{thebibliography}                   % main.tex:176
```

| Rule | Detail | Source |
|---|---|---|
| Mechanism | Manual `thebibliography{99}` in main, no BibTeX/`.bib`/`\bibliography` | `main.tex:111-176` |
| Ordering | Pillar-A entries ordered by first citation in Ch2 | `main.tex:112` |
| Pillar split | 21 Pillar-A keys (`chen2024` to `butt2025`) then 9 Pillar-B keys (`clst2024` to `spaced2025`) | `main.tex:115-156`, `main.tex:157-174` |
| Pillar-B scope | Pillar-B keys cited in Ch7 Future Work only | `main.tex:113`, `07-conclusion.tex:14` |
| Completion note | Bibliography kept in main, completed in Phase 2 per D4/D11 | `main.tex:110` |

### File-per-chapter-roadmap-section-depth-habits

| Habit | Phase-1 shape | Source |
|---|---|---|
| Roadmap opener | Every chapter's first paragraph is `This chapter ... Section~X.Y ...` with explicit numbers and topics | `01-introduction.tex:2`, `02-literature-survey.tex:2`, `03-requirements.tex:2`, `04-methodology.tex:2`, `05-implementation.tex:2`, `06-results.tex:2`, `07-conclusion.tex:2` |
| Deepest depth used | `\subsection` (e.g. `5.5.1` plan creation through `5.5.5` data architecture); no `\subsubsection` in corpus | `05-implementation.tex:98`, `05-implementation.tex:169` |
| Numbering capacity | `secnumdepth=3` allows `subsubsection` numbering but corpus never exercises it | `main.tex:26` |
| Enumerate style | Objectives use `\begin{enumerate}[noitemsep]`; FR/NFR use `[label=\textbf{FR-\arabic*},noitemsep,leftmargin=*]` | `01-introduction.tex:15`, `03-requirements.tex:46`, `03-requirements.tex:59` |
| Summary habit | Only Ch2 closes with a `Summary of Approaches` section plus gap-to-project bridge paragraph | `02-literature-survey.tex:144-167` |
| No-summary habit | Ch1 ends on `Organization of the Report`; Ch3 on NFRs; Ch4 on architecture; Ch5 on data architecture; Ch6 on discussion; Ch7 on future work | `01-introduction.tex:29-30`, `03-requirements.tex:57-66`, `04-methodology.tex:132-133`, `05-implementation.tex:169-172`, `06-results.tex:132-135`, `07-conclusion.tex:16-18` |

### Label-ref-caption-float-placement-conventions

```latex
\caption{...}          % caption BEFORE label in every figure/table
\label{fig:name}       % main.tex pattern, e.g. 02-literature-survey.tex:26-27
Figure~\ref{fig:name}  % prose reference with non-breaking tilde
Equation~\eqref{eq:bayes-update} % equation reference form
```

| Convention | Detail | Source |
|---|---|---|
| Label prefixes | `fig:`, `tab:`, `eq:`, `lst:` used consistently | `02-literature-survey.tex:12`, `02-literature-survey.tex:27`, `02-literature-survey.tex:151`, `05-implementation.tex:59` |
| Caption then label | `\caption` immediately precedes `\label` in figures and tables | `02-literature-survey.tex:26-27`, `03-requirements.tex:9-10`, `04-methodology.tex:54-55` |
| Figure placement | Tables put `\caption` above `\begin{tabular}`; figures put `\caption` below graphic/`tikzpicture` | `03-requirements.tex:9-12`, `02-literature-survey.tex:16-27` |
| Float specifiers | `figure[htbp]` and `table[htbp]` everywhere except one `table[H]` for packages table | `02-literature-survey.tex:16`, `05-implementation.tex:71` |
| Math labels | Equations labelled inside `equation` env (`eq:bayes-update`, `eq:cusum`, `eq:gp-pred`, `eq:gp-kernel`, `eq:dp`, `eq:enriched`) | `02-literature-survey.tex:8-13`, `04-methodology.tex:36-40` |
| Table rules | `booktabs` `\toprule`/`\midrule`/`\bottomrule`, `p{...}` columns, `\footnotesize` + `\centering`, `\cmidrule` for grouped headers | `02-literature-survey.tex:149-162`, `06-results.tex:51-64` |
| Cross-ref style | `Section~`, `Chapter~`, `Figure~`, `Table~` with tilde; equations via `\eqref` | `01-introduction.tex:2`, `02-literature-survey.tex:14`, `05-implementation.tex:56` |

### Citation-bibitem-cite-key-commands

| Command | Usage | Source |
|---|---|---|
| `\bibitem{chen2024}` | Lowercase-author-year keys, some with suffix (`chenyao2025`, `boca2024`, `clst2024`) | `main.tex:115`, `main.tex:133`, `main.tex:158` |
| `Author et al.~\cite{key}` | Standard lit-review attribution with tilde | `02-literature-survey.tex:5`, `02-literature-survey.tex:30` |
| Multi-key cite | Comma-separated groups (`\cite{chen2024,zanellati2024,...}`) in tables and bridges | `02-literature-survey.tex:156`, `07-conclusion.tex:9` |
| Base-paper cite | Predict-then-optimize base paper cited as `\cite{islam2024}` at architecture claims | `02-literature-survey.tex:96`, `04-methodology.tex:112` |
| Pillar-B cite | Future-work-only keys (`gaming2026`, `itemgen2024`, `kctag2024`, `clst2024`, `spaced2025`) | `07-conclusion.tex:14` |

### Environment-inventory-preamble-vs-actual-use

| Environment or package | Preamble load | Actual chapter use |
|---|---|---|
| `figure[htbp]`, `\includegraphics`, `tikzpicture` + `axis` | `graphicx`, `tikz`, `pgfplots` | Inline schematics in Ch2/4/6; external `arch_initial.pdf` / `arch_revised.pdf` in Ch4 |
| Sources | `main.tex:4`, `main.tex:13-17` | `02-literature-survey.tex:16-28`, `04-methodology.tex:116`, `04-methodology.tex:127` |
| `table[htbp]`, `tabular` `p{}`, `booktabs` | `booktabs`, `array` | Hardware, software, datasets, tools, candidates, metrics, results tables |
| Sources | `main.tex:5-6` | `03-requirements.tex:7-22`, `05-implementation.tex:7-29`, `06-results.tex:7-23` |
| `lstlisting` | `listings` + `\lstset` | Single shipped CUSUM listing | 
| Sources | `main.tex:18-20` | `05-implementation.tex:58-69` |
| `enumerate` + `enumitem` | `enumitem` | Objectives, FR-/NFR- series | 
| Sources | `main.tex:7` | `01-introduction.tex:15-22`, `03-requirements.tex:46-55` |
| `equation`, `minipage`, `center`, `flushright` | `amsmath`, `amssymb` | Bayes/CUSUM/GP/DP equations; listing wrapper; title/certificate blocks | 
| Sources | `main.tex:11-12` | `02-literature-survey.tex:8-13`, `05-implementation.tex:58`, `main.tex:38-74` |
| `subcaption` / `subfigure` | Loaded in preamble | No `\begin{subfigure}` in any of the 7 chapter files; candidate for removal | 
| Sources | `main.tex:10` | Absent across `01`-`07` chapter reads |

### Sibling-artifact-reuse-inventory-no-PDF-opened

| Artifact | Reuse note | Source |
|---|---|---|
| `arch_initial.tex` + `arch_initial.pdf` | TikZ source plus compiled vector for Fig initial predict-then-optimize design | `phase1-report/` dir listing; `\includegraphics[width=0.66\textwidth]{arch_initial.pdf}` in `04-methodology.tex:116` |
| `arch_revised.tex` + `arch_revised.pdf` | TikZ source plus compiled vector for Fig revised capacity-booking architecture | `phase1-report/` dir listing; `\includegraphics[width=0.74\textwidth]{arch_revised.pdf}` in `04-methodology.tex:127` |
| `screenshots/` 7 PNGs | `app_onboarding_plan`, `app_session`, `app_home`, `app_week`, `app_replan`, `app_roadmap`, `app_roadmaps`; every Ch5 screenshot claims capture from running app | `screenshots/` dir listing; `05-implementation.tex:96`, `05-implementation.tex:105-165` |
| `PESU-new-logo.png` + `pes_logo.png` | Title page uses `PESU-new-logo.png` at 5cm width; `pes_logo.png` is spare | `phase1-report/` dir listing; `main.tex:39` |
| `main.pdf`, `report_latest.pdf`, `main.lof`, `main.lot` | Prior build outputs and float lists; do not treat as sources | `phase1-report/` dir listing |
| `REPORT_WRITING_GUIDE.md`, `TIKZ_DIAGRAM_GUIDE.md` | Voice and diagram guides carried into Phase-2 (see next two sections) | `phase1-report/` dir listing |

### Voice-rules-roadmap-lit-review-hedging-honesty

| Rule family | Carry-over rule | Source |
|---|---|---|
| Chapter skeleton | Intro, Lit Survey grouped by technique with pros/cons table, Requirements with numbered FR/NFR, Methodology, Implementation, Results with Discussion, Conclusion and Future Work, References in first-cite order | `REPORT_WRITING_GUIDE.md:52-69` |
| Roadmap paragraph | Open every chapter with 2-4 sentences naming `Section X.Y` numbers plus topics, never vague pointers | `REPORT_WRITING_GUIDE.md:74-97` |
| Lit-review 4-beat | Attribution + verb + artifact; mechanism in 1-2 bare sentences; quantitative result with metric name; limitation/gap with However/limitation/but | `REPORT_WRITING_GUIDE.md:99-112` |
| Attribution verbs | Rotate proposes, offers, illustrates, describes, presents, introduces, recommends, demonstrates, evaluates, addresses, studies, reports, discusses | `REPORT_WRITING_GUIDE.md:133-135` |
| Never skip beats | Every lit entry needs beat 3 (number) and beat 4 (limitation); number-less summary reads as padding | `REPORT_WRITING_GUIDE.md:137-140` |
| Hedging bank | It is to be noted that; This indicates that; Alternatively it is also possible that; The most notable result here is; reconfirmed from Figure X; in theory but in practice; likely/tends to; To the best of my knowledge + closest prior work | `REPORT_WRITING_GUIDE.md:142-157` |
| Honesty rule | State number, judge with one adjective (fair/poor/extremely poor), explain mechanism, tie to named factor; lettered a/b/c lists for multiple causes | `REPORT_WRITING_GUIDE.md:163-187` |
| Register | Third-person passive-leaning body; first person only in Acknowledgement and rare To-the-best-of-my-knowledge framing | `REPORT_WRITING_GUIDE.md:217-223` |
| Tense discipline | Past for done, present for atemporal technique claims, future only for deferred work | `REPORT_WRITING_GUIDE.md:224-228` |
| Numbers rule | Never high accuracy alone; metric + dataset + value (97.1%, mAP 78.6% on PASCAL VOC 2007) | `REPORT_WRITING_GUIDE.md:229-231`, `REPORT_WRITING_GUIDE.md:204-207` |
| Explicit refs | Numeric Figure/Table refs and section-number cross-refs, never above/below/earlier | `REPORT_WRITING_GUIDE.md:232-236` |
| AI tells to avoid | No reflexive It-is-important-to-note-that; no triadic adjective stacks; no Moreover/Furthermore chains; no causeless hedges; no numberless performance claims; plain dash, short declaratives | `REPORT_WRITING_GUIDE.md:238-262` |

### Diagram-rules-standalone-TikZ-vector-workflow

| Rule | Detail | Source |
|---|---|---|
| Standalone over Mermaid/PNG | Standalone TikZ to tight-bbox vector PDF that drops into `\includegraphics`; Mermaid CLI needs puppeteer and PNG mismatches fonts | `TIKZ_DIAGRAM_GUIDE.md:11-17` |
| Structural recipe | `standalone[border=12pt]` class, sans font, node/container/edge/title layering: nodes, background `fit` containers, edges, opaque container titles last | `TIKZ_DIAGRAM_GUIDE.md:82-96` |
| Style vocabulary | `box/proc/phase2/hub/actor/ext/flow/flowbi/dflow/loop/lbl` with rounded corners, 0.8-0.9pt strokes, Latex arrowheads, white-bg labels | `TIKZ_DIAGRAM_GUIDE.md:98-113` |
| Coordinate discipline | Absolute `at (x,y)` grid for non-trivial diagrams; parallel pipelines as side-by-side columns; generous row/column gaps as edge lanes | `TIKZ_DIAGRAM_GUIDE.md:59-80` |
| Routing discipline | Exit the anchor facing the destination; orthogonal waypoints; returns in dedicated left lanes or centre gap; rotated lane labels; `fill=white` on every edge label | `TIKZ_DIAGRAM_GUIDE.md:115-121`, `TIKZ_DIAGRAM_GUIDE.md:123-148` |
| Compile-inspect loop | Edit, compile, rasterize, Read the PNG, fix; expect 3-6 passes; never approve source alone | `TIKZ_DIAGRAM_GUIDE.md:34-57` |
| Wiring into report | Tall diagrams as `[p]`-page figures at `width=0.8-0.85\textwidth`, `.pdf` vector, caption explains solid vs dashed and Phase I vs II, `Figure~\ref` in prose | `TIKZ_DIAGRAM_GUIDE.md:150-164` |
| Cleanup checklist | Standalone class, planned grid, background `fit`, sensible anchors, no box crossings, inspected raster, vector include, temp PNG/aux removed | `TIKZ_DIAGRAM_GUIDE.md:166-175` |

### Conflicts-phase1-practice-vs-guide-expectations

| # | Conflict | Evidence | Phase-2 handling |
|---|---|---|---|
| C1 | Guide wants most chapters to close with a Summary subsection; Phase-1 has only one Summary section (Ch2) and bare endings elsewhere | `REPORT_WRITING_GUIDE.md:71-72` vs `02-literature-survey.tex:144`, `01-introduction.tex:29-30`, `04-methodology.tex:132-133` | RESOLVED 2026-10-14: Ch2-only; guide amended so only the Lit Survey closes with a Summary |
| C2 | Guide lit formula shows bracket-number `[N]` prose but Phase-1 renders named `\bibitem` keys with `Author et al.~\cite{key}` | `REPORT_WRITING_GUIDE.md:104-120` vs `main.tex:115-156`, `02-literature-survey.tex:5` | Keep named keys; the 4-beat structure transfers, the `[N]` literal does not |
| C3 | Guide ordering rule says references in first-cite order, but Pillar-B block is grouped out of order (Ch7-only) | `REPORT_WRITING_GUIDE.md:69` vs `main.tex:112-113`, `main.tex:157-174` | Keep the Pillar-A/B split deliberately; note it in the methods comment so reviewers read it as intent |
| C4 | TIKZ guide prescribes standalone `.tex` to vector `.pdf`, but Ch2/6 schematics are inline `tikzpicture` while only Ch4 arch figures use external PDFs | `TIKZ_DIAGRAM_GUIDE.md:84-96` vs `02-literature-survey.tex:16-28`, `04-methodology.tex:116`, `04-methodology.tex:127` | Keep the split: standalone + `\includegraphics` for architecture, inline pgfplots acceptable for small schematics |
| C5 | TIKZ toolchain paths are macOS-only (`Library/TinyTeX`, `sips`) and stale for this WSL/Linux host | `TIKZ_DIAGRAM_GUIDE.md:19-28`, `TIKZ_DIAGRAM_GUIDE.md:36-41` | Do not copy PATH/`sips` verbatim; Stream C owns the Linux build and preview commands |
| C6 | `subcaption` is loaded but no `subfigure` appears in any chapter | `main.tex:10` vs absent across `01`-`07` chapter reads | Drop `subcaption` or justify with a planned Phase-2 multi-panel figure |

## Recommendation

- Start Phase-2 `main.tex` from the `### Preamble-documentclass-package-geometry-checklist` block, minus `subcaption` unless a multi-panel figure is planned (`main.tex:10` vs C6).
- Preserve the front-matter order, one-file-per-chapter `\input` order, caption/label/cite habits, and `thebibliography{99}` Pillar-A/B split exactly as checklisted above.
- Write every chapter opener as a roadmap paragraph and every lit entry in the 4-beat shape with rotated attribution verbs, hedges tied to reasons, and honest null reporting per `### Voice-rules-roadmap-lit-review-hedging-honesty`.
- Build architecture figures standalone to vector PDF with the anchor/routing/title-last rules and the raster-inspect loop; keep small pgfplots schematics inline per `### Diagram-rules-standalone-TikZ-vector-workflow` and C4.
- Resolve C1 (per-chapter Summary or not) and the stale macOS toolchain (C5) with Streams A/C before drafting; do not invent a second preamble, bibliography, or float style.

## References

- `college/mydeliverables/Phase-2-report/phase1-report/main.tex:1-177` - documentclass, preamble, front matter, chapter includes, thebibliography source of truth.
- `college/mydeliverables/Phase-2-report/phase1-report/chapters/01-introduction.tex:1-30` - roadmap opener, objectives enumerate, scope and organization habits.
- `college/mydeliverables/Phase-2-report/phase1-report/chapters/02-literature-survey.tex:1-167` - equations, inline pgfplots figures, lit table, 4-beat entries, summary-table habit.
- `college/mydeliverables/Phase-2-report/phase1-report/chapters/03-requirements.tex:1-66` - hardware/software tables, FR-/NFR- enumerate, caption-above-table habit.
- `college/mydeliverables/Phase-2-report/phase1-report/chapters/04-methodology.tex:1-135` - loop/pipeline TikZ, candidate/metrics tables, arch PDF includes, design-evolution narrative.
- `college/mydeliverables/Phase-2-report/phase1-report/chapters/05-implementation.tex:1-172` - tools/datasets/packages tables, CUSUM listing in minipage, screenshot figure series, subsection depth.
- `college/mydeliverables/Phase-2-report/phase1-report/chapters/06-results.tex:1-135` - results tables, ybar coverage figure, honest-null discussion prose.
- `college/mydeliverables/Phase-2-report/phase1-report/chapters/07-conclusion.tex:1-18` - conclusion plus Pillar-B future-work cites.
- `college/mydeliverables/Phase-2-report/phase1-report/REPORT_WRITING_GUIDE.md:1-328` - skeleton, roadmap, 4-beat formula, hedging/honesty/voice rules.
- `college/mydeliverables/Phase-2-report/phase1-report/TIKZ_DIAGRAM_GUIDE.md:1-175` - standalone recipe, layout/routing rules, inspect loop, wiring checklist.
- `college/mydeliverables/Phase-2-report/phase1-report/` dir listing - `arch_initial.tex`, `arch_revised.tex`, `PESU-new-logo.png`, `main.pdf` reuse inventory.
- `college/mydeliverables/Phase-2-report/phase1-report/screenshots/` dir listing - 7 app PNG filenames for Ch5 reuse.
