# Session prompt — Chapter 5 grill + draft (generated 2026-10-20 via prompt-optimizer; unused yet)

Continue the Phase-2 report in a new session: grill Chapter 5 (Implementation Details), then draft it.

First read, in order:
- .work/active/phase2-report/AGENTS.md (task-local protocol, constraints, build recipe, gotchas; note the anchor-derivation and code-first-drafting rules added 2026-10-20)
- .work/STATUS.md (find the phase2-report row)
- .work/active/phase2-report/state.md (single live Next at the top)
- .work/active/phase2-report/plan/GRILL.md (Q1-Q26 + G1 all RESOLVED; never re-open them)
- .work/active/phase2-report/plan/CHAPTERS.md (pinned 5.1 Development Environment, 5.2 Datasets and Their Sources, 5.3 Model and Service Implementation, 5.4 Evaluation Metrics and Reproducibility, 5.5 The Phase-2 Application)
- college/mydeliverables/Phase-2-report/phase1-report/chapters/05-implementation.tex (Phase-1 Ch5 shape to mirror: tools table, synthetic-plus-OULAD datasets, TS-plus-Python parity with a code listing, metrics and reproducibility, application walkthrough with subsections)

Chapters 1-4 are done and need no rework: 01-introduction.tex, 02-literature-survey.tex, 03-requirements.tex, and 04-methodology.tex drafted, /tmp smoke green (31 pages, Letter, 0 errors, 0 undefined), review main.pdf beside main.tex. Bibliography in main.tex holds the 11 Ch2 entries in first-citation order (including islam2024, cited by Ch4); append new keys only if Ch5 cites them.

Grill me on Chapter 5 following the grill-me skill: exactly one question at a time, each with your recommendation and why, waiting for my answer. Check deployment and code reality (compose files, `.env.example`, live service code, test suites) before recommending on any environment, dataset, parity, or application question. Record every question and answer in plan/GRILL.md (Q27 onward), plus state.md and SCRATCHPAD.md, as we go. After the grill resolves, draft chapters/05-implementation.tex using ste-writing (STE-flavored, manual checklist) plus humanizer file-mode.

Likely grill territory (do not batch; ask one at a time): the 5.1 tools-table delta over Phase-I (generation and grading dependencies, Jev client, Piston, sidecar, what stays identical); the 5.2 dataset roster (harness golds, the 754-chunk corpus, the four synthetic archetypes, what stays out of the report); the 5.3 parity story (which engines keep TypeScript-plus-Python parity, what runs service-only, which shipped listing to show); what 5.4 claims about metrics and reproducibility (fail-closed gates, request-id join, evidence files a reader can re-run); how 5.5 walks the Phase-2 application (which screens earn subsections, one surface per subsection, no FR or NFR restatement).

Constraints in force:
- Body prose only for STE-flavored + humanizer; boilerplate, code, identifiers, tables, captions/labels, bibliography stay verbatim
- Ground claims in phase1-report/ plus live code reality; do not invent numbers, models, or pipeline stages
- Keep the BKT equation where Ch2 put it; reference, never restate (same for Ch4 figures and tables: extend or reuse, never duplicate)
- Code listings show shipped code verbatim with correct labels and captions; keep listings short
- Build in /tmp only; refresh the beside-main.tex PDF from green builds, copying main.pdf only

Do not:
- Re-open settled questions (Q1-Q26 + G1)
- Batch multiple grill questions in one message
- Edit files under college/ beyond chapters/05-implementation.tex (and bibliography appends) until asked
