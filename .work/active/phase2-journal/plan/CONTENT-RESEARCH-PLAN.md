# Phase2 Journal - Content Research Plan (session 2026-10-22)

_Objective: gather every grounded fact, number, and artifact the journal draft needs, mapped onto the 5-section IMRaD spine from `research/springer-sample-pattern.md`, using the single-`.tex` shell rules from `research/sn-template-structure.md`._
_Status: research only. No `.tex` draft, no code edits in this checkout._

## 0. Ground already established (prior session 2026-10-20)

- Structure pattern: `research/springer-sample-pattern.md` (IMRaD spine, front-matter rules, verdict-table + explicit-selection close).
- Template shell: `research/sn-template-structure.md` (`\documentclass[sn-mathphys,Numbered]{sn-jnl}`, single column, natbib numbered, fixed back-matter order, build in /tmp only).
- Open items carried forward: target journal + reference style unconfirmed (default `sn-mathphys,Numbered`); `user-manual.pdf` unread (consult on build trouble only).

## 1. Content streams (each becomes one evidence agent)

1. **Report miner** - extract paper-ready narrative from the Phase-2 dissertation draft (`college/mydeliverables/Phase-2-report/phase2-report/chapters/01-05*.tex` + `main.tex` bibliography): problem, objectives, methods, results numbers, conclusions. Output: section-by-section content brief with `file:line` refs.
2. **Retrieval + ranking evidence** - grounded numbers only: hybrid BM25+dense r@1/r@3/MRR, Qwen3-Reranker deltas, corpus identity (572-page PDF, 754 chunks baseline), sidecar parity + throughput, scoped-retrieval contract. Sources: `research/doc/` retrieval program notes, `eval_golds.json`, `services/intelligence/app/routers/retrieval.py`, `app/rerank.py`, live code. Output: numbers table, each with provenance.
3. **Knowledge-tracing + generation evidence** - BKT (`bkt-v1`) AUC vs baseline, eval-harness metric families (groundedness, near-dup, coding derivable), generation contract (one family per call, N calls per run), grading authorities (`judge0`/Piston, `llm_rubric`, `objective`), JEV slice-4 flags + cutoff/margin prior, repair/resample hardening. Output: numbers table + contract bullets.
4. **Closed-loop + system inventory** - suggest_replan → RoadmapReplanned conversions (post-fix 4/4 + 4/4), `days_span` fix, hook 37/37 + feedback 77/77, full-journey live matrix (phase2-wayfinder exit), plus system inventory for Methods figures (routes, services, engines, worker). Sources: `active/synthetic-users-seeding`, `active/closed-loop-hold-analysis`, `archive/phase2-wayfinder`, compose files. Output: loop-evidence table + figure list for Methods.

## 2. Guardrails for every agent

- **Read-only in this checkout.** No edits, no commits, no `full-app start`. Scoped unit-test reads are fine; do not start servers (parallel agents must not fight over ports).
- **Any code written goes in a new worktree** (`git worktree add`), never in the live checkout (parallel sessions share it; `git status` already shows unrelated dirty files - leave them alone).
- **No secrets** in output: never print tokens/keys; cite `.env.example` shapes only.
- **Ground every number** in live code or frozen evidence; mark estimates as estimates (draft-checklist rule from prior session).
- **Rules in force at draft time, not now:** rule 60 (build in /tmp only), rule 61 (standalone TikZ recipe for complex figures; simple chains may stay inline per phase2-report precedent). IEEE rules 70-73 do NOT apply to this Springer task.

## 3. Synthesis (orchestrator, after agents return)

- Merge the four returns into `research/journal-content-brief.md`: (a) grounded numbers table, (b) claims ledger with provenance, (c) section-to-evidence map for the 5 IMRaD sections, (d) figure/table shopping list, (e) open gaps needing live runs (flagged, not filled by invention).
- Gaps that need the live stack become a follow-up run list (single `full-app` session, sequential - not parallel).

## 4. Close-out

- SESSION END: distill to `state.md`, refresh STATUS one-liner, reset SCRATCHPAD per work-journal-orchestrator.
- The `.tex` draft itself is next-session work after target-journal confirmation.
