# Springer sample pattern – Sample1 + Sample2
_Source: `college/mydeliverables/phase2-journal/Springer-Sample1.pdf` (11pp, steering-wheel DRL survey) + `Springer-Sample2.pdf` (11pp, EV smart-dashboard SoC study)._
_Read 2026-10-20 by PDF text extraction; both are PES University AIML papers from the Darapaneni group, so they are the house model for our journal draft._

## Shared front matter (both samples)
- Title line first, then author block with numeric affiliation superscripts.
- Affiliations list department, organization, street, city, postcode, state, country.
- Corresponding author(s) marked with `*` and email(s) on a `*Corresponding author(s). E-mail(s):` line.
- Contributing-author emails follow on a `Contributing authors:` line.
- Sample1 adds an `\equalcont`-style equal-contribution note (`*` on three authors); Sample2 has none.
- Unstructured abstract of roughly 180-200 words, no subheadings, no equations, no citations.
- `Keywords:` line with 5-6 terms including acronym expansions (Sample2 defines SoC/SoH/Li-ion/LiB/LSTM/SoE right in the keywords).
- Both typeset single-column with numbered sections (`1 Introduction`, `2 ...`, ... `5 References`).

## Shared body spine (IMRaD variant both follow)
- `1 Introduction`: no subheadings, historical narrative from field origins to the paper's scope, ends by stating what the paper does.
- `2 Literature Review`: dense, citation-heavy survey of prior methods with a per-method limitation note that motivates the paper's choice.
- `3 Materials And Methods`: numbered subsections (`3.1 Data Collection`, `3.2 Data Preparation`, `3.3 Data Exploration`, `3.4 Data Visualization` in Sample2; `3.1 Dataset and Environment`, `3.2 Core Algorithms` in Sample1).
- Results live inside section 3 subsections (per-model actual-vs-prediction plots) and/or a dedicated `4 Results` / `4 Discussion And Conclusion` section.
- `5 Conclusions` / `4 Discussion And Conclusion`: restates findings, names the winning method with its metric, lists limitations and numbered future-scope extensions.
- `References`: numbered bracket style (`[1]`, `[2]`, ...), Sample1 has 11 entries, Sample2 has 26.

## Sample1-specific moves (survey + comparison paper)
- Section 2 heading is all-caps (`2 LITERATURE REVIEW:`) with a trailing colon; body partly recaps section 1, which the template permits as acceptable Abstract/Introduction overlap.
- Section 3.2 explains four algorithms as a bullet list, with the first (Q-learning) carrying a numbered display equation plus a per-symbol legend paragraph (`Q(s,a): ...`, `r: ...`, `gamma: ...`, `alpha: ...`).
- Section 4 gives one bullet-subsection per algorithm, each pointing at one result figure (Fig 1-4) and the public code repo.
- Section 5 closes with comparison figures (Fig 5 moving-average table, Fig 6 graph), a ranked algorithm list, a fixed-episode honesty note (`episodes fixed at 150, computationally heavy`), and three combination-strategy bullets (model / technique / output combination).
- Code availability is a GitHub link inline in Conclusions, not a formal section.

## Sample2-specific moves (systems + experiment paper)
- Every claim about data carries a concrete number: 13269 rows, 44 features, 5 days of Li-ion data, temperatures 0/10/25/40 deg, 26 epochs to best accuracy.
- Data sources are a numbered list with what each source is and why it was chosen (Calce for temperature coverage, Mendeley for size), each with a citation.
- Cleaning steps are explicit and justified with a domain reason (dropped >80%-null columns after expert consult, IQR outlier removal, get-dummies encoding, skew note `mean < median < mode`).
- Figures are small and many (Fig 1 dashboard through Fig 11 loss line graph), each referenced in text as `fig N` / `graph N` before it appears.
- The verdict table is minimal (Table 1: 3 models x RMSE/MAE, LSTM 4.0595/0.8450 wins) and the text states the selection decision outright (`Hence, we selected LSTM ... for display of SoC`).
- Observations are a `as part of data exploration some of our observations are` bullet list of qualitative findings (voltage/current shape, unlock-state drain, temperature effect).

## Pattern to reuse for our draft
- Keep the 5-section IMRaD spine (Introduction, Literature Review, Materials And Methods, Results/Discussion, Conclusion, References), not the template `.tex` demo order.
- Front matter must carry the `*` corresponding-author line, the contributing-authors line, an unstructured ~200-word abstract, and acronym-expanding keywords.
- Methods must name datasets with row/feature counts, enumerate cleaning steps with reasons, and fix experiment budgets honestly (episodes, epochs, temperatures).
- Results must pair every figure/table with an in-text pointer and close with a verdict table plus an explicit selection statement.
- Conclusions must restate the winner with its metric, admit limits (compute budget, scope), and list concrete future extensions.
