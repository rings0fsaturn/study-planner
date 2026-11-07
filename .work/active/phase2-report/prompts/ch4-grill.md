# Session prompt — Chapter 4 grill + draft (generated 2026-10-20 via prompt-optimizer; unused yet)

Continue the Phase-2 report in a new session: grill Chapter 4 (Proposed Methodology), then draft it.

First read, in order:
- .work/active/phase2-report/AGENTS.md (task-local protocol, constraints, build recipe, gotchas; note the same-file edit and deployment-reality rules added 2026-10-20)
- .work/STATUS.md (find the phase2-report row)
- .work/active/phase2-report/state.md (single live Next at the top)
- .work/active/phase2-report/plan/GRILL.md (Q1-Q21 + G1 all RESOLVED; never re-open them)
- .work/active/phase2-report/plan/CHAPTERS.md (pinned 4.1 Closed Learning Loop, 4.2 Candidate Models and Selected Approach, 4.3 Comparison Methodology, 4.4 System Design and Evolution, 4.5 System Architecture)
- college/mydeliverables/Phase-2-report/phase1-report/chapters/04-methodology.tex (Phase-1 Ch4 shape to mirror: loop definition, candidate-vs-selected with honest nulls, comparison method, evolution narrative, architecture figure)

Chapters 1-3 are done and need no rework: 01-introduction.tex, 02-literature-survey.tex, and 03-requirements.tex drafted, /tmp smoke green (26 pages, Letter, 0 errors, 0 undefined), review main.pdf beside main.tex. Bibliography in main.tex holds the 11 Ch2 entries in first-citation order; append new keys only if Ch4 cites them.

Grill me on Chapter 4 following the grill-me skill: exactly one question at a time, each with your recommendation and why, waiting for my answer. Check deployment and code reality (compose files, `.env.example`, live service code) before recommending on any architecture or pipeline question. Record every question and answer in plan/GRILL.md (Q22 onward), plus state.md and SCRATCHPAD.md, as we go. After the grill resolves, draft chapters/04-methodology.tex using ste-writing (STE-flavored, manual checklist) plus humanizer file-mode.

Likely grill territory (do not batch; ask one at a time): the closed-loop definition in 4.1 (loop endpoint, hook, feedback-v2, verdict-to-replan path); which candidates 4.2 compares and which nulls stay honest; what 4.3 claims about synthetic ground truth and held-out evaluation; how 4.4 narrates Phase-I to Phase-II evolution without repeating Ch1/Ch3; whether 4.5 needs a new architecture figure or extends Ch2 Fig 2.1 (never duplicate Fig 2.1 silently).

Constraints in force:
- Body prose only for STE-flavored + humanizer; boilerplate, code, identifiers, tables, captions/labels, bibliography stay verbatim
- Ground claims in phase1-report/ plus live code reality; do not invent numbers, models, or pipeline stages
- Keep the BKT equation where Ch2 put it; do not restate it in Ch4
- Build in /tmp only; refresh the beside-main.tex PDF from green builds, copying main.pdf only

Do not:
- Re-open settled questions (Q1-Q21 + G1)
- Batch multiple grill questions in one message
- Edit files under college/ beyond chapters/04-methodology.tex (and bibliography appends) until asked
