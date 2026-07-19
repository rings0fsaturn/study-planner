# Base Preamble Template for Technical Academic Reports

This is the recommended starting preamble. Adapt it based on the user's template `.tex` file — add packages their template uses, remove packages their document doesn't need.

---

## Full Preamble

```latex
\documentclass[10pt, a4paper]{article}
% Use {report} for multi-chapter documents with \chapter{} support

% ============================================================
% ENCODING & LANGUAGE
% ============================================================
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[english]{babel}

% ============================================================
% PAGE LAYOUT
% ============================================================
\usepackage[
    top=1in,
    bottom=1in,
    left=1.25in,
    right=1in
]{geometry}

% ============================================================
% TYPOGRAPHY
% ============================================================
\usepackage{microtype}
\setlength{\emergencystretch}{3em}  % prevents overfull hboxes

% ============================================================
% MATHEMATICS
% ============================================================
\usepackage{amsmath}
\usepackage{amssymb}
\usepackage{amsthm}
\usepackage{mathtools}

% Theorem environments (customise as needed)
\newtheorem{theorem}{Theorem}[section]
\newtheorem{definition}[theorem]{Definition}
\newtheorem{lemma}[theorem]{Lemma}
\newtheorem{proposition}[theorem]{Proposition}
\newtheorem{corollary}[theorem]{Corollary}
\theoremstyle{remark}
\newtheorem{remark}{Remark}

% ============================================================
% GRAPHICS & FIGURES
% ============================================================
\usepackage{graphicx}
\usepackage{float}
\usepackage{subcaption}
\usepackage[font=small, labelfont=bf]{caption}
\graphicspath{{figures/}{images/}{../figures/}}  % search paths for images

% ============================================================
% TABLES
% ============================================================
\usepackage{booktabs}
\usepackage{multirow}
\usepackage{array}
\usepackage{longtable}
\usepackage{tabularx}
\newcolumntype{L}[1]{>{\raggedright\arraybackslash}p{#1}}
\newcolumntype{C}[1]{>{\centering\arraybackslash}p{#1}}
\newcolumntype{R}[1]{>{\raggedleft\arraybackslash}p{#1}}

% ============================================================
% TIKZ & DIAGRAMS
% ============================================================
\usepackage{tikz}
\usetikzlibrary{
    positioning,
    arrows.meta,
    shapes.geometric,
    calc,
    fit,
    backgrounds,
    decorations.pathmorphing
}

% ============================================================
% CODE LISTINGS
% ============================================================
\usepackage{listings}
\usepackage{xcolor}

\definecolor{codebg}{gray}{0.96}
\definecolor{codeframe}{gray}{0.80}
\definecolor{codecomment}{rgb}{0.25, 0.5, 0.25}
\definecolor{codestring}{rgb}{0.7, 0.1, 0.1}
\definecolor{codekeyword}{rgb}{0.0, 0.3, 0.7}

\lstdefinestyle{defaultcode}{
    backgroundcolor=\color{codebg},
    basicstyle=\ttfamily\footnotesize,
    keywordstyle=\color{codekeyword}\bfseries,
    commentstyle=\color{codecomment}\itshape,
    stringstyle=\color{codestring},
    numberstyle=\tiny\color{gray},
    numbers=left,
    numbersep=8pt,
    breaklines=true,
    breakatwhitespace=true,
    frame=single,
    rulecolor=\color{codeframe},
    captionpos=b,
    tabsize=4,
    showstringspaces=false,
    keepspaces=true
}
\lstset{style=defaultcode}

% Language-specific overrides (add as needed):
% \lstdefinestyle{python}{language=Python, style=defaultcode, morekeywords={self,True,False,None}}
% \lstdefinestyle{javascript}{language=JavaScript, style=defaultcode}

% ============================================================
% COLOURS
% ============================================================
% xcolor already loaded above; add custom colours here:
% \definecolor{accentblue}{RGB}{0, 82, 155}

% ============================================================
% ENUMERATION
% ============================================================
\usepackage{enumitem}
\setlist{noitemsep, topsep=4pt}  % tighter lists globally

% ============================================================
% BIBLIOGRAPHY (biblatex + biber)
% ============================================================
\usepackage[
    backend=biber,
    style=ieee,        % change to: apa, nature, authoryear, numeric, etc.
    sorting=none,      % citation order; use nyt for author-year
    maxbibnames=6,
    doi=false,
    isbn=false
]{biblatex}
\addbibresource{references.bib}  % your .bib filename here

% ============================================================
% HYPERLINKS (load last — except cleveref)
% ============================================================
\usepackage[
    colorlinks=true,
    linkcolor=blue,
    citecolor={green!50!black},
    urlcolor={purple!80!black},
    pdfauthor={},
    pdftitle={},
    pdfsubject={},
    pdfkeywords={}
]{hyperref}

\usepackage[capitalise, noabbrev]{cleveref}  % \cref{} → "Figure 2", "Section 3"

% ============================================================
% CUSTOM COMMANDS (add document-specific shortcuts here)
% ============================================================
% \newcommand{\eg}{\textit{e.g.},\xspace}
% \newcommand{\ie}{\textit{i.e.},\xspace}
% \newcommand{\etal}{\textit{et al.}\xspace}
% \newcommand{\TODO}[1]{\textcolor{red}{\textbf{TODO: #1}}}
```

---

## Document Class Variants

### `article` — most common for papers and reports
```latex
\documentclass[10pt, a4paper]{article}
% Sections: \section, \subsection, \subsubsection
% No \chapter{} support
```

### `report` — for longer multi-chapter documents
```latex
\documentclass[12pt, a4paper]{report}
% Sections: \chapter, \section, \subsection
% Generates separate title page by default
```

### Common document class options
| Option | Effect |
|--------|--------|
| `10pt` / `11pt` / `12pt` | Base font size |
| `a4paper` / `letterpaper` | Paper size |
| `twocolumn` | Two-column layout |
| `twoside` | Mirror margins for print binding |
| `draft` | Show overfull boxes as black bars |
| `openright` | Chapters start on right pages (report) |

---

## Title Block

```latex
\begin{document}

\title{%
    \textbf{Main Title of the Document}\\[0.5em]
    {\large Subtitle or System Name}
}
\author{%
    Author One\textsuperscript{1} \and
    Author Two\textsuperscript{2}\\[0.5em]
    {\small \textsuperscript{1}Institution One, \textsuperscript{2}Institution Two}
}
\date{\today}  % or a specific date string

\maketitle

\begin{abstract}
    A concise summary of the document (150--250 words for most venues).
    State the problem, method, key results, and conclusion.
\end{abstract}

\tableofcontents
\listoffigures   % remove if not needed
\listoftables    % remove if not needed
\newpage
```

---

## Adapting from the User's Template

When a user provides a `.tex` template, overlay it on this base:

1. **Keep** their `\documentclass` and its options unchanged
2. **Merge** their `\usepackage` calls — add any they have that differ from the base
3. **Keep** their `\definecolor` and `\lstdefinestyle` blocks if present — these define the visual identity
4. **Keep** their custom commands (`\newcommand`) verbatim
5. **Check** their hyperref settings — they may use specific link colours or PDF metadata fields required by their institution
6. **Note** the bibliography style they use — this determines citation format expected by their target venue
