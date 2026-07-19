---
name: latex-doc-gen
description: >
  Generate professional, compilable LaTeX documents for technical academic reports. Use this skill
  whenever the user has a .tex template and/or sample PDFs and wants to produce a new LaTeX document
  from content in the conversation. Trigger on any of these signals: the user provides a .tex file
  or PDF and asks to write a report, paper, or document; the user asks to "generate LaTeX", "write
  a chapter", "create a report in LaTeX", or "produce a .tex file"; the user mentions building a
  document from a template. This skill is self-contained — it works without any project-specific
  files and is suitable for use on any machine with LaTeX installed.
---

# LaTeX Document Generator

## Overview

This skill guides you through generating a professional, compilable LaTeX document for a technical
academic report. The workflow is iterative:

1. **Analyse** — read the user's template `.tex` and sample PDFs
2. **Skeleton** — produce the preamble + section stubs
3. **Fill** — write each section as content is discussed in context
4. **Finalise** — add bibliography, table of contents, cross-references, and run a quality check

The user and agent discuss content in the conversation; the skill writes the LaTeX. Never generate
content you don't have — ask the user for any section content that hasn't been discussed.

---

## Reference Files

Read these as needed during generation:

| File | When to read |
|------|-------------|
| `references/preamble-template.md` | Before writing any preamble or document skeleton |
| `references/packages.md` | When choosing or explaining packages |
| `references/installation.md` | When the user asks about installing LaTeX or compiling |
| `references/tikz-patterns.md` | Before writing any TikZ diagram |
| `references/bibliography.md` | Before setting up bibliography or writing `.bib` entries |

---

## Step 1: Analyse the Template and Samples

Before writing any LaTeX, read and extract the following from the user's provided files.

### From the template `.tex` file

Read the file and extract:

- **Document class** — `\documentclass[options]{class}` — preserve exactly
- **All packages** — every `\usepackage{...}` call, with options
- **Custom colours** — `\definecolor` blocks
- **Custom commands** — `\newcommand`, `\renewcommand`, `\DeclareMathOperator`
- **Custom listing styles** — `\lstdefinestyle`, `\lstset`
- **Section structure** — list of `\section`, `\subsection`, `\subsubsection` used
- **Environments** — which of: `figure`, `table`, `lstlisting`, `tikzpicture`, `equation`, `align`, `algorithm` appear
- **Bibliography setup** — `biblatex` vs `natbib`, style name, `.bib` filename
- **Hyperref settings** — link colours, PDF metadata fields

Report your findings to the user as a brief summary before proceeding:
> "I can see the template uses `article` class with 10pt/A4, IEEE bibliography style, TikZ for diagrams, and `listings` for code. I'll preserve these settings in the generated document."

### From the sample PDFs

PDFs are visual references — extract style conventions:

- **Page layout** — single/double column, approximate margin widths
- **Heading style** — numbered or unnumbered, font weight
- **Figure style** — placement (top/bottom/inline), caption format, whether figures are numbered per-section
- **Table style** — `booktabs` rules vs standard grid, header formatting
- **Code block style** — background colour, font size, frame style
- **Colour scheme** — accent colours used in headings, boxes, or diagrams
- **Abstract/intro structure** — length and formatting conventions

If you cannot read a PDF directly, ask the user to describe the key visual conventions or paste any sections they want replicated.

---

## Step 2: Generate the Document Skeleton

Read `references/preamble-template.md` first.

Produce a complete skeleton `.tex` file with:

1. **Preamble** — built from the user's template, merged with the base preamble. Preserve all user-defined settings; add standard packages only if missing.
2. **Title block** — `\title`, `\author`, `\date`, `\maketitle`, `\begin{abstract}...\end{abstract}`, `\tableofcontents`
3. **Section stubs** — one `\section{...}` for each major section the document will contain, with a `% TODO: content` placeholder
4. **Bibliography call** — `\printbibliography` at the end, `\end{document}`

Output the full skeleton as a code block so the user can copy it directly.

Then confirm the section structure before proceeding:
> "Here's the skeleton. The sections I've stubbed are: Introduction, Background, Methodology, Results, Discussion, Conclusion. Does this match your planned structure?"

---

## Step 3: Fill Sections

Write one section at a time, in sequence, using content from the conversation.

### Writing each section

- Use `\section{}`, `\subsection{}`, `\subsubsection{}` hierarchy consistently
- Write prose in full LaTeX sentences — no markdown, no pseudo-LaTeX
- For equations, use `\begin{equation}...\end{equation}` for numbered, `\[...\]` for unnumbered
- For lists, use `\begin{itemize}[noitemsep]` or `\begin{enumerate}` (with `enumitem`)
- For emphasis: `\textbf{}` for bold, `\textit{}` for italic — not `\emph{}` unless the template uses it
- Cross-reference figures/tables with `\cref{label}` (not "Figure 3" — let LaTeX number it)
- Add citations as you go: `\cite{key}` using the style the template specifies

### Figures

**TikZ diagrams** (flowcharts, block diagrams, architecture): read `references/tikz-patterns.md` and adapt the closest matching pattern. Always include `\label{fig:...}` and `\caption{...}`.

**Data/plot figures**: insert a placeholder:
```latex
\begin{figure}[htbp]
\centering
\includegraphics[width=0.85\linewidth]{figures/PLACEHOLDER.pdf}
\caption{Description of what this figure shows.}
\label{fig:placeholder}
\end{figure}
% NOTE: Replace PLACEHOLDER.pdf with the actual figure file
```

Tell the user: "This figure needs a `.pdf` or `.png` file in the `figures/` directory — generate it with your plotting tool (matplotlib, R, etc.) and drop it in."

### Tables

Use `booktabs` style — never use `\hline` for interior rules:
```latex
\begin{table}[htbp]
\centering
\caption{Caption goes above the table.}
\label{tab:results}
\begin{tabular}{llr}
\toprule
\textbf{Column A} & \textbf{Column B} & \textbf{Value} \\
\midrule
Row 1 & Description & 0.92 \\
Row 2 & Description & 0.87 \\
\bottomrule
\end{tabular}
\end{table}
```

### Code listings

```latex
\begin{lstlisting}[language=Python, caption={Short description.}, label={lst:example}]
def my_function(x):
    return x * 2
\end{lstlisting}
```

Use the style already defined in the preamble. If the template defines custom styles (e.g., `\lstset{style=mystyle}`), use those.

---

## Step 4: Finalise the Document

Once all sections are written, perform a final pass:

### Cross-references check
- Every `\label{...}` has a corresponding `\ref{}` or `\cref{}` somewhere in the document
- No `\ref{fig:...}` points to a label that doesn't exist
- `\cref{}` (from `cleveref`) automatically writes "Figure", "Table", "Section" — prefer it over `\ref{}`

### Bibliography
Read `references/bibliography.md`. Ensure:
- `references.bib` contains an entry for every `\cite{key}` in the document
- The `\addbibresource{}` path matches the actual `.bib` filename
- `\printbibliography` is placed immediately before `\end{document}`

If the user hasn't provided `.bib` entries, produce placeholder entries:
```bibtex
@article{PLACEHOLDER2024,
    author  = {Author, First},
    title   = {Title of the Paper},
    journal = {Journal Name},
    year    = {2024}
}
% NOTE: Replace with the actual reference details
```

### Overfull \hbox warnings (common)
If the user reports these during compilation, apply targeted fixes:
```latex
% Option 1: Allow slightly looser spacing in the paragraph
\begin{sloppypar}
...offending paragraph...
\end{sloppypar}

% Option 2: Suggest a manual line break
some long text\linebreak
continues here

% Option 3: Reduce a long URL / code string
\url{https://...} → \url{https://...} with \sloppy
```

Do not add `\sloppy` globally — it degrades typography throughout the document.

### Final output
Deliver the complete, compilable `.tex` file as a single code block. Follow with the compilation instructions (see below).

---

## Compilation Instructions (Always Include)

After delivering the `.tex` file, always provide:

```
To compile this document:

1. Ensure LaTeX is installed on your machine.
   → See references/installation.md for platform-specific instructions.

2. Place all files in one directory:
   main.tex         ← your document
   references.bib   ← bibliography entries
   figures/         ← any image files (PDF/PNG)

3. Compile (full sequence with bibliography):
   pdflatex main.tex
   biber main
   pdflatex main.tex
   pdflatex main.tex

   Or with latexmk (recommended — handles order automatically):
   latexmk -pdf main.tex

4. Required packages are loaded from your LaTeX installation automatically.
   If any package is missing:
   - macOS:   sudo tlmgr install <package-name>
   - Windows: open MiKTeX Console → Packages → search and install
   - Linux:   sudo apt-get install texlive-<collection>
```

---

## Quality Checklist

Before declaring the document complete, verify:

- [ ] Document compiles without errors (warnings about overfull boxes are acceptable)
- [ ] All `\section` levels use consistent numbering
- [ ] All figures have `\caption{}` and `\label{fig:...}`
- [ ] All tables have `\caption{}` (above the table) and `\label{tab:...}`
- [ ] All code listings have `\caption{}` and `\label{lst:...}`
- [ ] Every cross-reference resolves (no `??` in output)
- [ ] Bibliography compiles — no `[?]` citations
- [ ] No markdown syntax (`**bold**`, `# heading`) in the `.tex` output
- [ ] Preamble matches the user's original template settings

---

## Key Conventions

- **Comments**: add a `%` comment only for non-obvious blocks (complex TikZ, tricky table setup). Keep the file clean.
- **Label naming**: `fig:short-name`, `tab:short-name`, `lst:short-name`, `sec:short-name`, `eq:short-name`
- **Spacing**: use `~` (non-breaking space) before `\cite`, `\ref`, `\cref`: `as shown in~\cref{fig:arch}`
- **Dashes**: `--` for en-dash (ranges: pages 5--10), `---` for em-dash (parenthetical — like this)
- **Quotes**: use `` `single' `` and ` ``double'' ` (backtick-open, apostrophe-close) — not "straight quotes"
- **Percent sign**: `\%` — naked `%` starts a comment
- **Ampersand in text**: `\&` — naked `&` is a table column separator