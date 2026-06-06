# Standard LaTeX Packages for Technical Academic Reports

This reference covers the most commonly needed packages. Include only what the document uses — avoid loading packages speculatively.

---

## Page Layout

| Package | Usage | Key Options |
|---------|-------|-------------|
| `geometry` | Page margins and paper size | `\usepackage[margin=1in, a4paper]{geometry}` |
| `fancyhdr` | Custom headers and footers | `\usepackage{fancyhdr}` then `\pagestyle{fancy}` |
| `setspace` | Line spacing | `\usepackage{setspace}`, use `\onehalfspacing` or `\doublespacing` |
| `multicol` | Multi-column layout | `\begin{multicols}{2}...\end{multicols}` |
| `pdflscape` | Landscape pages within portrait document | `\begin{landscape}...\end{landscape}` |

---

## Typography & Fonts

| Package | Usage | Notes |
|---------|-------|-------|
| `inputenc` | UTF-8 source encoding | `\usepackage[utf8]{inputenc}` — omit with xelatex |
| `fontenc` | Output font encoding | `\usepackage[T1]{fontenc}` — omit with xelatex |
| `babel` | Language support, hyphenation | `\usepackage[english]{babel}` |
| `microtype` | Microtypography — better line breaking | `\usepackage{microtype}` — add always |
| `lmodern` | Latin Modern fonts (improved default) | `\usepackage{lmodern}` |
| `times` | Times New Roman font | Some journals require this |
| `fontspec` | System font access | xelatex/lualatex only; replaces inputenc/fontenc |

---

## Mathematics

| Package | Usage | Key Commands |
|---------|-------|--------------|
| `amsmath` | Advanced math environments | `equation`, `align`, `gather`, `multline` |
| `amssymb` | Extended math symbols | `\mathbb{R}`, `\mathcal{L}`, etc. |
| `amsthm` | Theorem/proof environments | `\newtheorem{theorem}{Theorem}` |
| `mathtools` | Extensions to amsmath | `\coloneqq`, matrix enhancements |
| `bm` | Bold math symbols | `\bm{\alpha}` |
| `siunitx` | Units and numbers | `\SI{9.8}{\metre\per\second\squared}` |

---

## Graphics & Figures

| Package | Usage | Notes |
|---------|-------|-------|
| `graphicx` | Include images | `\includegraphics[width=\linewidth]{fig.pdf}` |
| `float` | Force figure placement | Use `[H]` specifier — use sparingly |
| `subcaption` | Sub-figures (a), (b), etc. | `\begin{subfigure}{0.5\textwidth}...\end{subfigure}` |
| `wrapfig` | Text wrapping around figures | `\begin{wrapfigure}{r}{0.4\textwidth}` |
| `caption` | Customise caption format | `\usepackage[font=small,labelfont=bf]{caption}` |
| `pgfplots` | Data plots in LaTeX | Integrates with TikZ; great for function plots |

### Accepted image formats (pdflatex)
- `.pdf` — best for vector graphics (diagrams, plots)
- `.png` — best for screenshots, raster graphics
- `.jpg` / `.jpeg` — photos only; avoid for diagrams

---

## Tables

| Package | Usage | Key Feature |
|---------|-------|-------------|
| `booktabs` | Professional table rules | `\toprule`, `\midrule`, `\bottomrule` |
| `multirow` | Cells spanning multiple rows | `\multirow{2}{*}{text}` |
| `array` | Extended column types | Custom column specifiers |
| `longtable` | Tables spanning multiple pages | Replaces `tabular` for long tables |
| `tabularx` | Tables with auto-width columns | `X` column type stretches to fill width |
| `colortbl` | Coloured table cells/rows | `\rowcolor{gray!20}` |

### Column type quick reference
```
l   left-aligned
c   centre-aligned  
r   right-aligned
p{3cm}  fixed-width, top-aligned
m{3cm}  fixed-width, middle-aligned (needs array)
X       stretch to fill (needs tabularx)
```

---

## Code Listings

| Package | Usage | Notes |
|---------|-------|-------|
| `listings` | Code with syntax highlighting | Highly configurable; see example below |
| `minted` | Code via Pygments | Better highlighting; needs `--shell-escape` flag |
| `verbatim` | Raw verbatim text | Simple, no highlighting |
| `algorithm2e` | Algorithm pseudocode | `\begin{algorithm}...\end{algorithm}` |
| `algpseudocode` | Alternative pseudocode | Pairs with `algorithmicx` |

### listings configuration example
```latex
\usepackage{listings}
\usepackage{xcolor}

\lstdefinestyle{mystyle}{
    backgroundcolor=\color{gray!10},
    basicstyle=\ttfamily\footnotesize,
    keywordstyle=\color{blue}\bfseries,
    commentstyle=\color{green!50!black}\itshape,
    stringstyle=\color{red!70!black},
    numberstyle=\tiny\color{gray},
    numbers=left,
    numbersep=8pt,
    breaklines=true,
    frame=single,
    rulecolor=\color{gray!40},
    captionpos=b,
    tabsize=4
}
\lstset{style=mystyle}

% Usage:
\begin{lstlisting}[language=Python, caption={My function}]
def hello():
    print("Hello, world!")
\end{lstlisting}
```

---

## TikZ & Diagrams

| Package | Usage | Key Libraries |
|---------|-------|---------------|
| `tikz` | Vector graphics | Core package |
| `pgf` | Lower-level graphics | Usually loaded via tikz |
| `tikz-uml` | UML diagrams | Optional, for software docs |

### Essential TikZ libraries
```latex
\usepackage{tikz}
\usetikzlibrary{
    positioning,        % node positioning (right of=, below of=)
    arrows.meta,        % modern arrow tips
    shapes.geometric,   % diamond, ellipse, etc.
    calc,               % coordinate calculations
    fit,                % bounding box fitting
    backgrounds,        % background rectangles
    decorations.pathmorphing  % wavy/curved lines
}
```

See `tikz-patterns.md` for ready-to-use diagram templates.

---

## Cross-References & Hyperlinks

| Package | Usage | Key Options |
|---------|-------|-------------|
| `hyperref` | Clickable links, PDF bookmarks | Load last in preamble |
| `cleveref` | Smart references (`\cref`) | `\cref{fig:arch}` → "Figure 2" |
| `nameref` | Reference by name | `\nameref{sec:method}` |

### Recommended hyperref setup
```latex
\usepackage[
    colorlinks=true,
    linkcolor=blue,
    citecolor={green!50!black},
    urlcolor=purple,
    pdfauthor={Author Name},
    pdftitle={Document Title},
    pdfsubject={Subject},
    pdfkeywords={keyword1, keyword2}
]{hyperref}
```

Always load `hyperref` as the last package in the preamble (except `cleveref`, which goes after).

---

## Lists & Enumeration

| Package | Usage | Example |
|---------|-------|---------|
| `enumitem` | Customise lists | `\begin{itemize}[noitemsep, topsep=0pt]` |

```latex
% Compact list
\begin{itemize}[noitemsep, leftmargin=*]
    \item First item
    \item Second item
\end{itemize}

% Custom numbering
\begin{enumerate}[label=\textbf{R\arabic*.}]
    \item Requirement one
\end{enumerate}
```

---

## Colours

```latex
\usepackage[dvipsnames, svgnames, table]{xcolor}

% Named colours available: NavyBlue, ForestGreen, BrickRed, etc.
% Define custom:
\definecolor{traceblue}{RGB}{0, 82, 155}
\definecolor{lightgray}{gray}{0.95}
```

---

## Miscellaneous Utility

| Package | Usage |
|---------|-------|
| `lipsum` | Placeholder text for layout testing: `\lipsum[1-3]` |
| `todonotes` | Inline TODO notes: `\todo{check this}` |
| `pdfpages` | Include external PDFs: `\includepdf[pages=-]{file.pdf}` |
| `appendix` | Appendix formatting: `\begin{appendices}` |
| `glossaries` | Acronyms and glossary |
| `url` | Typeset URLs without hyperref |

---

## Package Load Order (Important)

Load packages in this general order to avoid conflicts:

1. Font encoding (`inputenc`, `fontenc`, `lmodern`)
2. Language (`babel`)
3. Page layout (`geometry`, `fancyhdr`)
4. Math (`amsmath`, `amssymb`, `amsthm`)
5. Graphics (`graphicx`, `float`, `subcaption`)
6. Tables (`booktabs`, `multirow`, `longtable`, `tabularx`)
7. TikZ (`tikz` + libraries)
8. Code (`listings`, `algorithm2e`)
9. Colours (`xcolor`)
10. Bibliography (`biblatex`)
11. Enumeration (`enumitem`)
12. Microtypography (`microtype`)
13. **Hyperlinks last** (`hyperref`, then `cleveref`)
