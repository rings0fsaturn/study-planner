# IEEE Conference Paper Authoring (Title, Authors, Sections)

Source of truth: [`IEEEtran_HOWTO.pdf`](../../college/mydeliverables/3rd-Review/journal/IEEEtran_HOWTO.pdf)
and [`IEEEtran.cls`](../../college/mydeliverables/3rd-Review/journal/IEEEtran.cls). See
[`ieee-conference-class-setup.md`](./ieee-conference-class-setup.md) for class options and
the conference-mode command lockouts referenced below.

## Problem

Author-block macros (`\IEEEauthorblockN`, `\IEEEauthorblockA`, `\and`) only produce real
multi-column layout in `conference`/`peerreviewca`/`transmag` mode — in any other mode they
silently degrade to plain text with no warning. Section/heading/appendix conventions also
differ from both the plain `report`-class dissertation and from `IEEEtran` journal mode, so
copying patterns from either is likely to be wrong here.

## Rule

### Title

No math, special symbols, or footnote marks in the title (or the abstract — see below).
Capitalize normally except minor words (a, an, and, as, at, but, by, for, in, nor, of, on,
or, the, to, up) unless first/last word.

### Author block

`\and` is **only valid inside `\author{...}` in conference/peerreviewca/transmag mode** —
in any other mode it prints a warning and does nothing.

**≤3 affiliations** — one `\IEEEauthorblockN`/`\IEEEauthorblockA` pair per author,
separated by `\and` (matches the template's 6-author block):

```latex
\author{\IEEEauthorblockN{1\textsuperscript{st} Given Name Surname}
\IEEEauthorblockA{\textit{dept. name} \\ \textit{organization}\\ City, Country \\ email}
\and
\IEEEauthorblockN{2\textsuperscript{nd} Given Name Surname}
\IEEEauthorblockA{...}}
```

**>3 affiliations, or too wide to fit** — "long format": `\IEEEauthorrefmark{n}`
superscripts after each name, with one shared `\IEEEauthorblockA` per unique affiliation
instead of one per author:

```latex
\IEEEauthorblockN{Name One\IEEEauthorrefmark{1}, Name Two\IEEEauthorrefmark{2}}
\IEEEauthorblockA{\IEEEauthorrefmark{1}Dept A, Org A\\ ...}
\IEEEauthorblockA{\IEEEauthorrefmark{2}Dept B, Org B\\ ...}
```

Do not use `\footnotemark[]` in place of `\IEEEauthorrefmark{}` inside `\author` — the
footnote symbol machinery is turned off there. `\IEEEauthorrefmark` reports zero vertical
height to LaTeX, so cramped interline spacing can make it collide with the line above.

Names are listed left-to-right then down to the next line — this is the citation order
used by indexing services. Don't list authors in columns or group them by affiliation.
Keep affiliations succinct (don't split into sub-departments of the same organization).

### Abstract

No math, special symbols, footnotes, or citations in the abstract, even if defined
elsewhere in the paper.

```latex
\begin{abstract}
...
\end{abstract}
```

### Keywords

```latex
\begin{IEEEkeywords}
term one, term two, term three
\end{IEEEkeywords}
```

No math or special symbols. Prefer terms from the official IEEE keyword list
(available by emailing keywords@ieee.org) or the IEEE Computer Society list at
computer.org/mc/keywords.

### Sections and numbering

Non-`compsoc` conference mode numbers sections with upper-case Roman numerals, subsections
with upper-case letters, subsubsections with Arabic numerals, and paragraphs with
lower-case letters (`\paragraph` depth is disabled for technotes/compsoc-conference unless
restored via `\setcounter{secnumdepth}{4}`).

- `\section*{Acknowledgment}` — singular, American spelling (no "e" after the "g"). IEEE
  Computer Society papers use the plural "Acknowledgments" instead — check the venue.
- Don't hand-write `\section*{References}` if the bibliography is produced via
  `thebibliography`/`\bibliography` — IEEE's mechanisms auto-generate an unnumbered
  "REFERENCES" heading.
- `\markboth{}{}` has no effect in conference mode (no running headers) — don't bother
  setting it.

### Appendices

- **Single appendix**: `\appendix[Optional Title]`. After this, plain `\section{...}` is
  meaningless (produces a warning) — refer to "the Appendix," not "Appendix A."
- **Multiple appendices**: `\appendices`, then one `\section{...}` per appendix as usual.
  Numbered A, B, C... by default, or with Roman numerals under the `romanappendices` class
  option.

### Common mistakes (from the HOWTO's own mistakes list)

- Placing a `\label` before its `\caption` — see
  [`ieee-conference-figures-tables-citations.md`](./ieee-conference-figures-tables-citations.md).
- Altering default fonts, spacing, margins, or column style — see
  [`ieee-conference-class-setup.md`](./ieee-conference-class-setup.md).
- Using bitmapped graphics for line art, or manually formatting references instead of using
  `thebibliography`/the IEEEtran BibTeX style — see
  [`ieee-conference-figures-tables-citations.md`](./ieee-conference-figures-tables-citations.md).
- Using `eqnarray` — see [`ieee-conference-equations.md`](./ieee-conference-equations.md).
- Common English usage pitfalls specific to IEEE house style: "data" is plural; write
  "et al." with no period after "et"; don't use "essentially" to mean "approximately"; the
  prefix "non" joins its word without a hyphen; use `\mu_{0}$` (proper subscript zero), not
  a lowercase "o".

## Pattern Checklist

- [ ] Title and abstract contain no math, symbols, or footnotes
- [ ] Author block uses `\IEEEauthorblockN`/`\IEEEauthorblockA`/`\and` (≤3 affiliations) or
      the `\IEEEauthorrefmark` long form (>3 affiliations)
- [ ] `\and` only appears inside `\author{...}`
- [ ] `\IEEEkeywords` block present, no math/symbols
- [ ] `\section*{Acknowledgment}` is singular
- [ ] No hand-written `\section*{References}` alongside `thebibliography`
- [ ] Single appendix uses `\appendix[Title]`; multiple use `\appendices` + `\section{}`

## When to Apply

Authoring or editing the title, author block, abstract, keywords, section structure, or
appendices of the IEEE conference paper in
`college/mydeliverables/3rd-Review/journal/`.
