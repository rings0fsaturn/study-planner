# State – phase2-journal
_Spec: college/mydeliverables/phase2-journal/ (Springer-Sample1.pdf + Springer-Sample2.pdf + sn-article-template/) · Plan: .work/active/phase2-journal/plan/ · STATUS row: phase2-journal · Status: active · Updated: 2026-10-22_

## Current state & next
- Content research DONE 2026-10-22: 4-stream read-only sweep (report miner, retrieval, KT+generation, closed-loop+system) synthesized into `research/journal-content-brief.md` (numbers table, claims ledger, section-to-evidence map, figure list, NEEDS-LIVE-RUN gaps).
- Reranked-754 re-run DONE 2026-10-22: hybrid+rerank on durable 754 measured at 0.67/0.90/0.93/0.797 (deltas r@1 +7, r@3 +10, MRR +0.077); evidence `research/doc/2026-10-22-reranked-754.md` + JSON; brief gap 1 closed, 788 headline superseded.
- All 8 remaining gaps CLOSED 2026-10-22, each with plan in `plan/GAP2..GAP9-*` and evidence in `research/doc/`: gap 9 JEV budget APPROVED 15-call cap (memo); gap 2 endpoint retrieval plain 0.60/0.73/0.87/0.703 exact RPC repro, reranked 0.70/0.90/0.93/0.813; gap 6 fresh live harness (`liveSource: live`, coding 0.5349 passes 0.5 gate, BKT 0.7397/0.1401); gap 5 synthExtract emission (24 adherence rows, next-week 0.000 measured, 4/4 verdicts converted) + timestamp-shape seed finding; gap 7 difficulty closed unmeasurable (chip advisory); gap 8 dip replay 4/4 holds with trough-to-rebound gradient, cloud untouched, JEV 7/15 used; gap 3 DDIA second corpus (rerank deltas +16/+17/+0.139); gap 4 full-book ready in ~88 s with cleanup verified.
- Next: v0 draft green 2026-10-22 (tex + beside-source `journal-draft.pdf` refreshed from that green build, 7pp, 0 errors, abstract 184w, style gates pass); standing rule is refresh the beside-source PDF from every green build; next pass fills 22-26 Lit Review entries, draws 3 single-column figures, confirms front-matter TBDs (emails, street, postcode), then grows to 11pp.
- Grill CLOSED 2026-10-23 (9 locked decisions: hold `sn-mathphys,Numbered`; 11pp by writing only; bib verify before prose; 3 TikZ + 3 pgfplots data plots; delete line-390 editorial residue; Not-applicable ethics + Appendix A evidence map; /tmp green bar; STE/humanizer/ai-audit prose gate; advisor sign-off downstream) into `plan/2026-10-23-journal-final-stage.md` (5 phases); Phase 1 (bib verify + residue) unblocked.
- Phases 1-3 COMPLETE 2026-10-23 (bib verified and frozen; `fig:retacc`, `fig:bktauc`, `fig:verdictdip` green; Appendix A per-table evidence map; supplementary set named).
- Phase 4 COMPLETE 2026-10-23: page target reconciled with the human (13pp verified baseline, not the plan's stale 7pp; body already at house-model length and full-author refs add 2.5pp; human chose growth-as-written and accepted the overrun). Lit synthesis, Results discussions, and Methods budget/reproducibility/scope paragraphs added on frozen evidence; green `/tmp` build 15pp, 0 errors, 0 undefined, 0 overfull, abstract 188w; beside-source PDF refreshed.
- Next: Phase 5 triple prose gate (STE, humanizer, ai-writing-pattern-audit last) then final wrap.

## Done so far
- OPEN 2026-10-20: created `active/phase2-journal/{plan,prompts,research}` + STATUS Active row.
- 2026-10-20: extracted Sample1 (steering-wheel DRL survey, 11pp) + Sample2 (EV dashboard SoC, 11pp) patterns via PDF text read.
- 2026-10-20: dissected `sn-article-template` (`sn-article.tex` 632 lines + `sn-bibliography.bib` 163 lines read in full, `sn-jnl.cls` options block, `sn-article.pdf` 12pp skimmed, `bst/` + EPS files listed).
- 2026-10-22: wrote `plan/CONTENT-RESEARCH-PLAN.md` (4-stream plan + read-only guardrails: no edits in checkout, new worktree for any code, no secrets).
- 2026-10-22: ran 4 parallel read-only evidence agents (report miner on Ch01-05 + main.tex bib; retrieval/ranking; KT+generation incl. JEV; closed-loop+system inventory), all returned with file:line provenance.
- 2026-10-22: synthesized returns into `research/journal-content-brief.md`; key conflict recorded (rerank 0.77/0.97/0.858 belongs to retired 788 split, never re-run on durable 754).
- 2026-10-22: planned (`plan/RERANKED-754-PLAN.md`) + ran reranked-754 (sidecar GPU, dry --limit 2 green, full 30Q x 3 arms); dense/hybrid arms reproduce baselines exactly; sidecar stopped after.

## Flow trace
1. Entry: `STATUS.md` row `phase2-journal` -> `state.md` (this file) -> `plan/` -> `SCRATCHPAD.md`.
2. Source bundle lives at `college/mydeliverables/phase2-journal/`: 2 Springer sample PDFs + `sn-article-template/` (sn-jnl.cls, sn-article.tex, sn-bibliography.bib, bst/, fig.eps).
3. Output of this session is research only: pattern + template-structure notes under `active/phase2-journal/research/` for the next session's journal drafting.

## Files affected
- .work/active/phase2-journal/state.md – bootstrapped (this file).
- .work/active/phase2-journal/SCRATCHPAD.md – seeded.
- .work/active/phase2-journal/plan/ – created (empty).
- .work/active/phase2-journal/prompts/ – created (empty).
- .work/active/phase2-journal/research/ – created; holds the 2 notes below.
- .work/STATUS.md – Active row `phase2-journal` added + refreshed.
- .work/active/phase2-journal/research/springer-sample-pattern.md – shared front matter, IMRaD spine, per-sample moves, reuse pattern.
- .work/active/phase2-journal/research/sn-template-structure.md – inventory, class line, preamble, front/body/back matter, sample mapping, draft checklist.
- .work/active/phase2-journal/plan/CONTENT-RESEARCH-PLAN.md - 4-stream content-research plan + guardrails (2026-10-22).
- .work/active/phase2-journal/research/journal-content-brief.md - numbers table, claims ledger, section-to-evidence map, figure list, gaps (2026-10-22; gap 1 closed same day).
- .work/active/phase2-journal/plan/RERANKED-754-PLAN.md - reranked-754 re-run plan + verdict rule (2026-10-22).
- research/doc/2026-10-22-reranked-754.md + .json - coherent 754 table (dense/hybrid/hybrid_rerank) + per-Q ranks + provenance (2026-10-22).
- research/doc/2026-10-22-endpoint-retrieval.md + .json, 2026-10-22-second-corpus-ddia.md + questions + .json, 2026-10-22-synth-extract-emission.md + .json, 2026-10-22-difficulty-baseline.md, 2026-10-22-dip-window-replay.md, 2026-10-22-fullbook-e2e-timing.md + .json - gap evidence (2026-10-22).
- research/doc/generation-quality-harness/summary.json + report.md + live.json - rewritten fresh by live harness run (2026-10-22).
- .work/active/phase2-journal/plan/GAP2..GAP9-*-PLAN.md - one executable plan per remaining live gap (2026-10-22); suggested order 9, 2, 6, 5, 7, 8, 3, 4.
- .work/active/phase2-journal/plan/2026-10-23-journal-final-stage.md - final-stage runbook (2026-10-23 grill, 5 phases, preamble + D-01..D-09 + OQ-01/OQ-02); Phases 1-4 status and notes recorded.
- college/mydeliverables/phase2-journal/journal-draft.tex - Phase 4 prose growth (four Lit synthesis paragraphs, four Results discussions plus adherence caveat, budget/reproducibility/scope paragraphs); 15pp green.
- college/mydeliverables/phase2-journal/journal-draft.pdf - refreshed from the Phase 4 green `/tmp` build (15pp).
- .work/active/phase2-journal/SCRATCHPAD.md + state.md + .work/STATUS.md - Phase 4 progress recorded.

## Pitfalls & rules
- Must follow rule 60: build LaTeX in /tmp only; never commit aux/log noise; review PDF beside main.tex refreshed from green build only (applies next session when drafting starts).
- Must not mix IEEE conference formatting into the Springer journal work.
- Must not write secrets into `.work/` or report sources.

## Decisions in force
- Decided task-id `phase2-journal` because the source bundle directory is `college/mydeliverables/phase2-journal/` (2026-10-20).
- Decided this session produces research notes only, no journal draft (per user instruction).

## Open
- `user-manual.pdf` not read (consult only on build trouble at draft time).
- Target journal + reference style unconfirmed (defaults to `sn-mathphys,Numbered`).
- 8 NEEDS-LIVE-RUN gaps remain in the brief (gap 1 reranked-754 closed 2026-10-22); each has an executable plan in `plan/GAP2..GAP9-*`; run sequentially, never parallel.
- Journal draft itself is next-session work after target-journal confirmation.
