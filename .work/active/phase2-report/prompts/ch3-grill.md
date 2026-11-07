# Session prompt — Chapter 3 grill + draft (generated 2026-10-20 via prompt-optimizer; unused yet)

Continue the Phase-2 report in a new session: grill Chapter 3 (System Requirements Specification), then draft it.

First read, in order:
- .work/active/phase2-report/AGENTS.md (task-local protocol, constraints, build recipe, gotchas)
- .work/STATUS.md (find the phase2-report row)
- .work/active/phase2-report/state.md
- .work/active/phase2-report/plan/GRILL.md (Q1-Q16 + G1 all RESOLVED; never re-open them)
- .work/active/phase2-report/plan/CHAPTERS.md (pinned 3.1 Hardware, 3.2 Software, 3.3 Functional, 3.4 Non-Functional Requirements)
- college/mydeliverables/Phase-2-report/phase1-report/chapters/03-requirements.tex (Phase-1 Ch3 shape to mirror: scope, perspective, numbered functional/non-functional IDs, assumptions/constraints, hardware/software tables)

Chapters 1-2 are done and need no rework: 01-introduction.tex and 02-literature-survey.tex drafted, /tmp smoke green (23 pages, Letter, 0 errors, 0 undefined), review main.pdf beside main.tex. Bibliography in main.tex holds the 11 Ch2 entries in first-citation order; append new keys only if Ch3 cites them.

Grill me on Chapter 3 following the grill-me skill: exactly one question at a time, each with your recommendation and why, waiting for my answer. Record every question and answer in plan/GRILL.md (Q17 onward), plus state.md and SCRATCHPAD.md, as we go. After the grill resolves, draft chapters/03-requirements.tex using ste-writing (STE-flavored, manual checklist) plus humanizer file-mode.

Constraints in force:
- Body prose only for STE-flavored + humanizer; boilerplate, code, identifiers, tables, captions/labels, bibliography stay verbatim
- Numbered requirement IDs; every functional requirement traceable to a shipped Phase-II capability; non-functionals measurable where the live matrix measured them
- Ground claims in phase1-report/ plus live code reality; do not invent numbers or hardware
- Build in /tmp only; refresh the beside-main.tex PDF from green builds, copying main.pdf only

Do not:
- Re-open settled questions (Q1-Q16 + G1)
- Batch multiple grill questions in one message
- Edit files under college/ beyond chapters/03-requirements.tex (and bibliography appends) until asked
