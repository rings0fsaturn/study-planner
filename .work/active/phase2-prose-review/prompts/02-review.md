# Prompt - Ch02 literature-survey STE + humanizer review

Target: `college/mydeliverables/Phase-2-report/phase2-report/chapters/02-literature-survey.tex` (84 lines, Sections 2.1 to 2.6 plus Fig `fig:closed-loop` plus Table `tab:litphase2` plus Eq `eq:bkt-update`).

## Read first (in order)

1. `.work/active/phase2-prose-review/AGENTS.md` for the lint-first protocol and reviewer rule.
2. `.work/specs/phase2-prose-review-ste-humanizer.md` for the contract.
3. Target chapter in full with Read. Never judge from previews.
4. `.agents/skills/ste-writing/SKILL.md` (flavored), `.agents/skills/humanizer/SKILL.md`, `college/mydeliverables/REPORT_WRITING_GUIDE.md` (4-beat lit shape, honest numbers, guide voice).
5. `college/mydeliverables/Phase-2-report/phase2-report/main.tex` bibliography slice for first-citation order.
6. Live evidence only where the chapter names a project number: bake-off AUC 0.888 vs 0.889, groundedness 0.867, near-dup 0.004, r@3 0.7333, MRR 0.7033, live 4/4, 2/2, 3/3, span 32 days. Grep the gate or harness before calling a number invented.

## Do

1. Lint first: strip LaTeX commands, replace `~` with space, drop citations, then count words per descriptive sentence (fail past 25), sentences per paragraph (fail past 6), and flag: British spellings, present or past perfect, semicolons, contractions, the 7 Ch01 phrasals plus new ones, `quietly` plus bare `robust`, em or en dashes in body, `\textbf` emphasis in body.
2. Judge second, one pass: apply flavored bar from AGENTS.md. Guide passive-leaning body is allowed. `using` stays. `gated` and `robust` stay only with a named lock or metric.
3. Ch02 extras: every lit paragraph needs all 4 beats (attribution plus mechanism plus real metric plus gap). Check Eq `eq:bkt-update` is the single home of the BKT update (Ch04 must point, not restate). Check Fig `fig:closed-loop` is the loop motivator, Table `tab:litphase2` carries strengths plus limitations, sourcing section claims no fresh sweep. Check roadmap paragraph names Sections 2.1 to 2.6 with topics. Check numeric cross-refs (`Section~2.1`, `Figure~\ref`, `Table~\ref`).
4. Never edit the chapter in this pass. Output findings only.

## Return

Table rows as `file:line - rule - excerpt - minimal fix`, grouped under STE, humanizer, guide. Close with two verdict lines: `STE: PASS or FAIL (counts)` and `Humanizer: PASS or FAIL (counts)`. List anything left alone and why in one line.
