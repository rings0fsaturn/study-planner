# sn-article-template structure
_Source: `college/mydeliverables/phase2-journal/sn-article-template/` read 2026-10-20 (`sn-article.tex` 632 lines in full, `sn-bibliography.bib` 163 lines in full, `sn-jnl.cls` options block lines 58-118, compiled `sn-article.pdf` 12pp skimmed, `fig.eps`/`empty.eps` file-typed, `bst/` listed, `user-manual.pdf` not read)._

## Bundle inventory
- `sn-jnl.cls` is the class file (v0.1, 2019-11-18, 1809 lines, LPPL-maintained, generated from `classes.dtx`).
- `sn-article.tex` is the single-file manuscript skeleton and doubles as the usage manual (every construct shows source via `verbatim` right next to its rendered output).
- `sn-bibliography.bib` holds 13 exemplar entries covering article, article-with-DOI, book, incollection, edited book, inproceedings, conference paper (misc), dataset (misc + figshare DOI), preprint (misc + arXiv URL), arXiv-eprint article, software (softmisc + ascl), and collaboration article.
- `bst/` ships 7 reference styles: `sn-basic`, `sn-mathphys`, `sn-vancouver`, `sn-chicago`, `sn-aps`, `sn-nature`, `sn-apacite`.
- `fig.eps` is a real DSC-3.0 Level-1 EPS figure; `empty.eps` is a Level-2 placeholder of the same kind.
- `sn-article.pdf` (12pp) is the compiled demo output and the visual reference for the finished look.
- `user-manual.pdf` is the detailed technical manual; not needed for drafting, consult only on build trouble.

## Document-class line (the one decision that fixes everything)
- Active line is `\documentclass[sn-mathphys,Numbered]{sn-jnl}` (Math and Physical Sciences, numbered citations).
- All alternatives sit commented on lines 14-40: `referee` (double line spacing), `lineno` (margin line numbers), `pdflatex`/`xelatex`, `sn-nature`, `sn-basic`, `sn-aps`, `sn-vancouver`+Numbered, `sn-apa`, `sn-chicago`, `default`, `default,iicol` (double column).
- `Numbered` vs `NameDate` toggles numbered vs author-year referencing for the four styles that support both (`sn-basic`, `sn-vancouver`, `sn-chicago`, `sn-mathphys`).
- Layout default is single column; `iicol` switches to double column, which then requires `table*`/`figure*` spanning and `sidewaystable(*)` for rotated tables.
- Both samples render single-column numbered, consistent with `sn-mathphys,Numbered` (or `sn-basic`+Numbered); keep this line for our draft unless the target journal names another style.

## Preamble (lines 42-92, keep as-is plus only what we need)
- Standard loads: `graphicx`, `multirow`, `amsmath/amssymb/amsfonts`, `amsthm`, `mathrsfs`, `appendix` (with `title`), `xcolor`, `textcomp`, `manyfoot`, `booktabs`, `algorithm`, `algorithmicx`, `algpseudocode`, `listings`.
- Theorem styles are pre-declared: `thmstyleone` (bold head + italic body: theorem, proposition), `thmstyletwo` (roman head + italic body: example, remark), `thmstylethree` (bold head + roman body: definition), plus a `proof` environment with open-square QED.
- Add packages only under the `<additional latex packages if required>` marker; our TikZ flow figures will need `\usepackage{tikz}` + `\usetikzlibrary{...}` there (rule 61 standalone recipe applies at draft time).

## Front matter commands (lines 94-148)
- `\title[short]{long}` takes a running-head short title plus the full title.
- Authors use decomposed name macros (`\pfx`, `\fnm`, `\spfx`, `\sur`, `\sfx`, `\tanm`, `\dgr`) inside `\author*[affil-nos]{...}\email{...}`; the starred form marks the corresponding author.
- `\equalcont{...}` adds the equal-contribution dagger note Sample1 uses.
- `\affil*[n]{\orgdiv{...}, \orgname{...}, \orgaddress{\street{...}, \city{...}, \postcode{...}, \state{...}, \country{...}}}` builds the affiliation block both samples show.
- `\abstract{...}` is unstructured by default; a structured Purpose/Methods/Results/Conclusion variant sits commented on lines 134-140.
- `\keywords{...}`, optional `\pacs[JEL/MSC]{...}`, then `\maketitle` closes front matter.
- Our draft needs no new front-matter machinery: fill these macros with our title, authors, abstract, and keywords.

## Body skeleton and which parts we keep
- `Introduction` (label `sec1`): must have no subheadings per the template comment; some Abstract overlap is explicitly acceptable.
- Demo-only sections to delete for our draft: `Results` filler (sec2), the three-level head demo (sec3), `Equations`/`Tables`/`Figures`/`Algorithms`/`Cross referencing`/`theorem environments` how-tos (sec4-sec10).
- Keep the constructs, drop the demo text: `equation`/`align` (with `\nonumber` on all but the last line and `\label` only there), `booktabs` tables with `\footnotetext`/`\footnotemark` footnotes, `figure` with `\includegraphics` + `\caption\label`, `algorithm`+`algorithmic`, `lstlisting`/`verbatim` listings, `\ref` cross-references with `\label` inside or just below `\caption`.
- Image rule: EPS files for `latex` builds, `pdf/jpg/png` for `pdflatex`; one input file per image; avoid subfigures.
- `Methods` (sec11) allows topical subheadings and ships a mandatory ethics boilerplate (approval / accordance / informed-consent enumerate plus Nature/Springer/BMC policy URLs) that we keep only if human or animal data is reported.
- `Discussion` and `Conclusion` are interchangeable and not both mandatory; some journals want `Results and Discussion` + `Conclusion`, so check target guidance.
- Natbib is wired in: `\cite` gives `[1]` in numbered mode (or `Jones et al. (1990)` in author-year), `\citep` gives the parenthesised form; both samples use plain numbered `\cite`-style brackets.

## Back matter order (lines 543-631, fixed sequence)
- `\backmatter`, then `\bmhead{Supplementary information}`, then `\bmhead{Acknowledgments}` (brief, grants optional).
- Unnumbered `Declarations` section with exactly 8 bullets (Funding; Conflict/Competing interests; Ethics approval; Consent to participate; Consent for publication; Availability of data and materials; Code availability; Authors' contributions), writing `Not applicable` for irrelevant ones.
- Editorial-policy URL flush-left block (Springer / Nature Portfolio / Scientific Reports / BMC).
- `appendices` environment for supplementary sections, figures, tables, equations.
- `\bibliography{sn-bibliography}` (Nature Portfolio eJP submissions must paste the `.bbl` content inline instead and drop the `\bibliography` line).
- Submission rule from the header comment: one `.tex` file only, no `\input{...}`; figures and extra files attach separately.

## Sample-to-template mapping (why the samples look the way they do)
- Both samples' front matter is exactly the `\title` + `\author*`/`\author` + `\affil` + `\abstract` + `\keywords` + `\maketitle` pipeline.
- Both samples' numbered-bracket references match `sn-mathphys,Numbered` (or equivalent numbered style) rendered through natbib.
- The samples ignore the demo section order and follow the template's own permission to omit irrelevant sections and let journal guidance take precedence; our draft does the same with the 5-section IMRaD spine from `springer-sample-pattern.md`.
- Sample tables/figures follow the template's `booktabs` + `\caption\label` + `\ref` conventions; Sample2's many small figures obey the one-file-per-image rule.

## Next-session draft checklist
- Confirm the target journal and its reference style; switch the `\documentclass` line only if it names one.
- Create the draft as a single `.tex` file (copy `sn-article.tex`, strip demo sections, keep preamble + front-matter + back-matter shells).
- Fill front matter, then draft the 5 IMRaD sections per `springer-sample-pattern.md`, adding `\usepackage{tikz}` for architecture/loop figures.
- Build in `/tmp` only per rule 60 (`latexmk -pdf` runs the bibtex passes), refresh the beside-source review PDF from green builds, never commit aux/log noise.
- Ground every number in live code or frozen evidence (retrieval r@k/MRR, BKT AUC, generation counts, cost/latency); mark estimates as estimates.
