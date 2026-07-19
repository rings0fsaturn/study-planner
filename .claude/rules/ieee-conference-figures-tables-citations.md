# IEEE Conference Figures, Tables, and Citations

Source of truth: [`IEEEtran_HOWTO.pdf`](../../college/mydeliverables/3rd-Review/journal/IEEEtran_HOWTO.pdf).
See [`ieee-conference-class-setup.md`](./ieee-conference-class-setup.md) for the pdfLaTeX
requirement referenced below.

## Problem

Figure and table captions follow opposite placement conventions, and a `\label` placed
before its `\caption` silently binds to the wrong counter instead of erroring — per the
HOWTO, this is "one of the most frequent mistakes made in LaTeX of all time." The default
citation style also leaves adjacent references uncompressed (`[3], [4], [5]`) unless a
specific package is loaded correctly.

## Rule

### Figures

```latex
\begin{figure}[!t]
\centering
\includegraphics[width=2.5in]{myfigure}
\caption{Simulation results for the network.}
\label{fig_sim}
\end{figure}
```

- `\centering`, not the `center` environment — `center` adds unwanted vertical spacing.
- Caption goes **below** the graphic.
- `\label` must come **after or inside** `\caption`, never before — a label placed before
  the caption command picks up the wrong (e.g. section) counter instead.
- Vector EPS/PDF only for line art, drawings, and graphs; bitmap formats (PNG/TIFF/EPS/PDF,
  JPEG acceptable) are for photos only. pdfLaTeX is required to compile anything other than
  EPS (see [`ieee-conference-class-setup.md`](./ieee-conference-class-setup.md)).
- Place at the top or bottom of a column (`[!t]`), not mid-column — `[h]` placement is
  "usually not used for IEEE work" outside Computer Society conferences specifically.
- Wrap algorithms in a plain `figure` using `algorithmic.sty`/`algorithmicx.sty` — IEEE
  recognizes only two float types, figures and tables. Don't use the floating
  `algorithm`/`algorithm2e` environments.

### Tables

```latex
\begin{table}[!t]
\caption{A Simple Example Table}
\label{table_example}
\centering
\begin{tabular}{c||c}
...
\end{tabular}
\end{table}
```

- Caption goes **above** the table — the opposite convention from figures.
- Default table text size is `\footnotesize`.
- Bump `\renewcommand{\arraystretch}{1.3}` (or similar >1.0) to open up row spacing.
- For table footnotes, don't use a bare `\footnote` (it gets trapped inside the float) —
  use `\footnotemark`/`\footnotetext`, or `threeparttable.sty`.

### Double-column floats (`figure*` / `table*`)

- Span both columns; used only when content genuinely doesn't fit one column.
- Cannot be placed at the bottom of a page (`[!b]`) without the `dblfloatfix` package — a
  known LaTeX2ε kernel limitation.
- Will **never** appear on the page where they're defined in source — place them in the
  `.tex` file before the point they should appear.
- Must never span the gutter between the two columns — packages like `cuted.sty` or
  `midfloat.sty` that do this are explicitly forbidden by IEEE format; "the IEEE does not
  do this."

### Citations

- Batch adjacent references into a single call: `\cite{a,b,c}`, not `\cite{a}\cite{b}\cite{c}`.
- Load `\usepackage{cite}` (already in the template) so adjacent numeric citations
  auto-compress into `[1]--[3]` style instead of printing `[1], [2], [3]`. Under `compsoc`
  mode, IEEE Computer Society sorts but does not compress — use
  `\usepackage[nocompress]{cite}` (cite.sty v4.0+) in that case.
- `\cite[note]{ref}` — if a note is given, cite only one reference in that call; a note on
  a multi-ref `\cite` applies only to the last one.
- Reference the number only: "as shown in [3]", not "Ref. [3]" or "reference [3]" — except
  at the start of a sentence: "Reference [3] was the first...".

### Bibliography

Prefer a manually maintained `thebibliography`/`\bibitem` block (the convention already
used by this repo's dissertation — see
[`latex-report-build.md`](./latex-report-build.md)) over a BibTeX + `.bib` workflow, so the
submission package has no external regeneration dependency:

```latex
\begin{thebibliography}{00}
\bibitem{b1} A. Author, ``Title of paper,'' Journal Name, vol. X, pp. Y--Z, Year.
\end{thebibliography}
```

If a `.bib`-driven workflow is used instead, use the official IEEEtran BibTeX style
(`\bibliographystyle{IEEEtran}`) rather than hand-formatting entries — the HOWTO calls
manual reference formatting "error prone" and explicitly recommends the style file instead.

## Pattern Checklist

- [ ] Every `\label` for a figure/table comes after (or inside) its `\caption`
- [ ] Figure captions below the graphic; table captions above the table
- [ ] Line-art figures are vector EPS/PDF; only photos are bitmap
- [ ] No floating `algorithm`/`algorithm2e` environment — algorithms are wrapped in `figure`
- [ ] No `cuted.sty`/`midfloat.sty` or other mid-column-spanning packages
- [ ] Adjacent citations are batched into one `\cite{...}` call with `cite.sty` loaded
- [ ] Bibliography entries follow `thebibliography`/`\bibitem`, not hand-typed reference text

## When to Apply

Adding or reviewing any figure, table, algorithm block, citation, or bibliography entry in
the IEEE conference paper under `college/mydeliverables/3rd-Review/journal/`.
