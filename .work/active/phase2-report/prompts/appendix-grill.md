# Session prompt — Appendix A grill + draft (generated 2026-10-23; unused yet)

Continue the Phase-2 report in a new session: grill Appendix A (Supplementary Tables and Figures), then draft it.

First read, in order:
- .work/active/phase2-report/AGENTS.md (task-local protocol, constraints, build recipe with the export-PATH hardening, Overfull log-gate, STE/humanizer checklist with the ref-placeholder count fix, and the one-edit precedent; note the appendix shell and the Ch7 export-PATH lesson)
- .work/STATUS.md (find the phase2-report row)
- .work/active/phase2-report/state.md (single live Next at the top)
- .work/active/phase2-report/plan/GRILL.md (Q1-Q53 + G1 all RESOLVED; never re-open them)
- .work/active/phase2-report/plan/CHAPTERS.md (appendix shell per Q7a)
- college/mydeliverables/Phase-2-report/phase2-report/chapters/06-results.tex (the appendix pointers: 24-row emission plus per-user decidedAt values in 6.4, endpoint and DDIA blocks in 6.1, dip gradient in 6.4)
- college/mydeliverables/Phase-2-report/phase2-report/chapters/07-conclusion.tex (the appendix pointers Ch7 restates: full 24-row emission, reproducibility-base line)
- college/mydeliverables/Phase-2-report/phase2-report/chapters/appendix.tex (current 4-line shell: collects Ch6 items, repeats in-text numbers)
- research/doc/2026-10-22-synth-extract-emission.json plus .md (24-row adherence emission and 12 mastery rows source)
- research/doc/2026-10-22-ddia-questions.json plus research/doc/2026-10-22-second-corpus-ddia.json plus .md (DDIA 30Q list source)
- research/doc/2026-10-22-endpoint-retrieval.json plus .md plus research/doc/2026-10-22-reranked-754.json plus .md (endpoint JSON pointers and harness arms source)

Chapters 1-7 are done and need no rework: 01 through 07 drafted, /tmp smoke green (44 pages, Letter, 0 errors, 0 undefined), review main.pdf beside main.tex refreshed with pp41-42 raster-checked. Bibliography in main.tex holds the 11 Ch2 entries in first-citation order (including islam2024, cited by Ch4 and Ch7, and gaming2026, cited by Ch7); append new keys only if Appendix cites them (it should not: tables and figures carry no citations).

Grill Appendix A following the grill-me skill: exactly one question at a time, each with your recommendation and why, waiting for my answer. Ground every number in the versioned JSON and md evidence files above; never invent numbers. Record every question and answer in plan/GRILL.md (Q54 onward), plus state.md, SCRATCHPAD.md, and the STATUS row in the same turn. After the grill resolves, draft chapters/appendix.tex using ste-writing (STE-flavored, manual checklist: sentence length, one Table opener per section, hyphens before nouns only, one hedge per claim, max 2 passes, ref-placeholder count) plus humanizer file-mode.

Likely grill territory (do not batch; ask one at a time): the appendix table roster (full 24-row adherence emission, per-user decidedAt values, DDIA 30Q list, endpoint JSON pointers: full tables versus pointers); the numbering shape (repeat in-text numbers per the shell, no new analysis); the float budget (tables only, no new TikZ figure); the cross-reference direction (Ch6 and Ch7 point at the appendix, appendix points back by number); the page-budget guard (40-page floor already cleared at 44pp, keep the appendix tight).

Constraints in force:
- Body prose only for STE-flavored + humanizer; boilerplate, code, identifiers, tables, captions/labels, bibliography stay verbatim (table numbers verbatim from evidence, no rounding drift)
- Ground claims in the versioned evidence files plus live code reality; do not invent numbers, models, or pipeline stages
- Keep the BKT equation where Ch2 put it; reference, never restate (same for Ch4/Ch6 figures and tables: the appendix repeats numbers by reference, adds no analysis, duplicates no figure)
- Build in /tmp only with the tool workdir set to the /tmp dir and TinyTeX on PATH via export (never bare env); gate the log (zero `^!`, zero undefined, no Overfull on the drafted appendix); refresh the beside-main.tex PDF from green builds, copying main.pdf only via absolute path

Do not:
- Re-open settled questions (Q1-Q53 + G1)
- Batch multiple grill questions in one message
- Batch two edits to the same file in one turn (one GRILL.md edit per turn; a blanket go-ahead records in ONE edit)
- Edit files under college/ beyond chapters/appendix.tex (and bibliography appends) until asked
