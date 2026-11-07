---
title: Phase-2 report context index
purpose: Entry point for the Phase-2 implementor - required structure, LaTeX checklist, formatting constraints, toolchain status, and open questions
audience: phase-2 report implementor
last_updated: 2026-10-14
---

## Overview

Research-only prep for the Phase-2 dissertation.
Three streams ran in parallel with non-overlapping scopes; this index merges them into the five implementor inputs.
No `.tex` was written, nothing under `college/` was edited, and the toolchain smoke ran in `/tmp` only.

## Files in this folder

- [`submission-sample-structure.md`](./submission-sample-structure.md) - Guideline gates, sample TOC/chapters/captions/references, and the C1-C7 conflict register.
- [`phase1-latex-pattern.md`](./phase1-latex-pattern.md) - Copy-paste preamble block, float/label/cite habits, voice and TikZ rules, C1-C6 practice-vs-guide conflicts.
- [`toolchain-readiness.md`](./toolchain-readiness.md) - TinyTeX verdict NOT-READY, missing-package table, `/tmp` smoke log evidence, `tlmgr` fix.

## Phase-2 required structure

Cover, Certificate, Declaration, Acknowledgement, Abstract, TOC, List of Tables, List of Figures, then Ch 1 Introduction, Ch 2 Literature Survey, Ch 3 Requirements, Ch 4 Methodology, Ch 5 Implementation, Ch 6 Results and Discussion, Ch 7 Conclusion and Future Work, then References `[1]-[33]` style, no appendix.
Details: [`submission-sample-structure.md#sample-chapter-order-and-seven-chapter-toc-hierarchy`](./submission-sample-structure.md#sample-chapter-order-and-seven-chapter-toc-hierarchy).

## LaTeX preamble and environment checklist

Start from `\documentclass[12pt]{report}` + A4/1in `geometry` + `secnumdepth=3`, packages in `main.tex:1-26` order, one-file-per-chapter `\input{chapters/01..07}`, manual `thebibliography{99}` with Pillar-A/B split, `fig:`/`tab:`/`eq:`/`lst:` labels with `\caption`-before-`\label`.
Full block: [`phase1-latex-pattern.md#preamble-documentclass-package-geometry-checklist`](./phase1-latex-pattern.md#preamble-documentclass-package-geometry-checklist).

## Formatting constraints table

| Constraint | Value | Source file |
|---|---|---|
| Body floor | 40+ pages excl. cover/Certificate/Declaration, one-sided, justified | [`submission-sample-structure.md#guideline-page-count-floor-and-print-shop-rules`](./submission-sample-structure.md#guideline-page-count-floor-and-print-shop-rules) |
| Binding/post | Light cream, 1 copy to Great Learning HQ; Olympus softcopy; plagiarism 15 or below | [`submission-sample-structure.md#guideline-hard-copy-submission-gates-for-phase-2-esa-eligibility`](./submission-sample-structure.md#guideline-hard-copy-submission-gates-for-phase-2-esa-eligibility) |
| Captions | Table caption above rows, figure caption in figure block; numeric `Figure N`/`Table N` refs | [`submission-sample-structure.md#sample-caption-placement-convention-in-reading-order`](./submission-sample-structure.md#sample-caption-placement-convention-in-reading-order) |
| Floats/tables | `[htbp]` floats, `booktabs` rules, `p{}` columns | [`phase1-latex-pattern.md#label-ref-caption-float-placement-conventions`](./phase1-latex-pattern.md#label-ref-caption-float-placement-conventions) |
| Citations | Numeric-bracket in citation order; Phase-1 uses named `\cite{key}` + 4-beat lit paragraphs | [`phase1-latex-pattern.md#citation-bibitem-cite-key-commands`](./phase1-latex-pattern.md#citation-bibitem-cite-key-commands) |

## Toolchain status

**NOT-READY**: `latexmk` 4.88 + pdfTeX TL26 + `tlmgr` present at `$HOME/.TinyTeX/bin/x86_64-linux`, but `/tmp` smoke dies at `enumitem.sty` not found with 6 packages missing (`enumitem`, `tikz`, `pgfplots`, `listings`, `caption`, `subcaption`).
Fix needs approval: `tlmgr install enumitem pgf pgfplots listings caption subcaption`, then re-run `/tmp` smoke.
Evidence: [`toolchain-readiness.md#tmp-only-smoke-compile-full-maintex-fails-on-enumitem`](./toolchain-readiness.md#tmp-only-smoke-compile-full-maintex-fails-on-enumitem).

## Open questions and proposed file layout

Open: duration `May-Oct 2026` vs `Jul-Dec 2025`; `Artifical` spelling; `tlmgr` install approval; per-chapter Summary or Ch2-only; drop unused `subcaption`; Letter-vs-A4 and Times-vs-CM approximation; Chancellor roster; no-appendix confirm.
Proposed (not created): `college/mydeliverables/Phase-2-report/phase2-report/main.tex` + `chapters/01..07-*.tex` + `DECISIONS.md`, mirroring `phase1-report/` front-matter order above.

## Where to start

- **Implementor:** read this index, then `submission-sample-structure.md`, then `phase1-latex-pattern.md`, then `toolchain-readiness.md`.
- **Before drafting:** resolve the open questions above and get `tlmgr` approval so the first build is green.
- **Build rule:** `/tmp` copies only, never compile in `college/`, finish with `latexmk -C`.

## See also

- `college/mydeliverables/Phase-2-report/MTech project report submission guideline.html` - sole submission authority (read-only this phase).
- `college/mydeliverables/Phase-2-report/phase1-report/main.tex` - preamble and front-matter source of truth.
- `.agents/rules/60-latex-report-build.agents.md` - TinyTeX + `latexmk` workflow for the build phase.
