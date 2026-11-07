# State - phase2-prose-review
_Spec: .work/specs/phase2-prose-review-ste-humanizer.md · Plan: active/phase2-prose-review/plan/ · STATUS row: phase2-prose-review · Status: active, Ch04-Ch07 fix plan applied, five author items open · Updated: 2026-10-23_

## Current state & next
- The Chapter 1 to 3 fix plan was executed 2026-10-23: the author queue is answered from evidence where possible, and Batches 1 to 4 are applied.
- Final lint for that pass: Ch01, Ch02, and Ch03 all read STE PASS and Humanizer PASS. Ch07 also reads PASS/PASS after the CUSUM correction.
- The Chapter 4 to 7 AI-writing-pattern audits are complete: four subagent reports follow the skill's eight-section format and quote verified `file:line` excerpts.
- A consolidated Chapter 4 to 7 fix plan is written at `plan/2026-10-23-ai-writing-pattern-fix-plan-ch04-ch07.md`, with P0 to P3 batches, a 21-question author queue, and a verification protocol. All unblocked rows are applied; the plan carries the author answers and execution record.
- Baseline lint at the Ch04-Ch07 audit: Ch04 STE FAIL 7 / Humanizer PASS; Ch05 STE FAIL 14 / Humanizer FAIL 1; Ch06 STE FAIL 14 / Humanizer FAIL 5; Ch07 PASS/PASS.
- Next: hand the build to `phase2-report` for `latexmk` and PDF inspection.
- Ch04-Ch07 fix plan executed 2026-10-23: Q-01 to Q-20 answered from evidence, Batches 1-5 applied, final lint Ch04/Ch05/Ch06/Ch07 all STE PASS and Humanizer PASS.
- Grill 2026-10-23 resolved the remaining five: Batch 6 thesis propagation, `gaming2026` authors, Figure 5.5 retitle, Table 6.3 caption, C4-24 caption, Ch04:52 label; re-verified Ch01/Ch03/Ch04/Ch05/Ch06/Ch07 all PASS/PASS. Untouched: `true study pace` and `realized` in the abstract.
- Build verification stays with the `phase2-report` task (this task never runs `latexmk` and never touches `main.pdf`).

## Done so far
- Opened 2026-10-22: task folder plus spec plus AGENTS.md with Ch01 retro learnings.
- Ch01 line-by-line review delivered as file:line findings with minimal fixes.
- Ch02 line-by-line review delivered 2026-10-22; fixes applied 2026-10-23 to `college/mydeliverables/Phase-2-report/phase2-report/chapters/02-literature-survey.tex` (word spans plus paragraph splits plus table commas, no fact dropped).
- `ste_check.py` built 2026-10-23 (35 tests green at creation, 36 after the Ch03 golden, ruff clean): caught a `labelled` British spelling the Ch02 hand lint missed (fixed in the chapter); Ch02 re-verified PASS/PASS. The pre-fix Ch01 golden pinned 13 over-length (hand count 14 superseded by the deterministic recipe), and the post-fix golden now pins Ch01-Ch03 PASS/PASS. The Ch03 pre-review run matched the `03-review.md` watch list (`stand in for`, `realised`, `Behavioural/behaviourally`, table `;`, 2 over-length).
- AI-writing-pattern audit run 2026-10-23 via three chapter subagents; each report follows the skill's eight-section format and quotes verified `file:line` excerpts.
- Consolidated 292-line fix plan written 2026-10-23 with P0-P3 batches, cross-chapter fixes, a 20-question author queue, and a verification protocol.
- Baseline lint at audit time: Ch01 STE FAIL 13 / Humanizer PASS; Ch02 STE FAIL 1 / Humanizer PASS; Ch03 STE PASS / Humanizer PASS.
- Fix plan executed 2026-10-23: Ch01-Ch03 rewritten for the P0-P3 rows, the table corrected, the written arm attributed to the OpenRouter rubric model, the CUSUM delivery status fixed in Ch06/Ch07, and precision/spelling harmonized in Ch04, Ch05, and main.tex.
- Final lint 2026-10-23: Ch01 PASS/PASS, Ch02 PASS/PASS, Ch03 PASS/PASS; Ch07 PASS/PASS. Citation keys, reference targets, braces, and environments all check clean.
- AI-writing-pattern audit run 2026-10-23 for Ch04-Ch07 via four chapter subagents; each report follows the skill's eight-section format, separates style from evidence findings, and offers no authorship verdict.
- Ch04-Ch07 audit findings were spot-verified against the chapter bytes and the evidence: `feedback-v1` vs `feedback-v2`, Dexie versions 6 and 7, the 0.733 plain arm, the 0.888/0.889 bake-off cut, the 0.5349 fresh coding pull, the pyBKT ECE 0.2716, the per-user sufficiency gap, the gate 1.0-would-clear-0.9 caveat, the 87.849 s and 101.406 s timing split, the dip-window 1.0 prior evidence, and the 4 by 6 adherence table.
- Consolidated Chapter 4 to 7 fix plan written 2026-10-23 with 21 author questions, a do-not-change list, and a verification protocol; no chapter edit applied.

## Flow trace
1. Ch01 source is `college/mydeliverables/Phase-2-report/phase2-report/chapters/01-introduction.tex:1-32`.
2. Authorities are ste-writing flavored plus humanizer v3.1.0 plus REPORT_WRITING_GUIDE.md.
3. Ch01 ground truth came from full-line Read plus script word counts, not subagent counts.

## Files affected
- .work/specs/phase2-prose-review-ste-humanizer.md - review contract - new.
- .work/active/phase2-prose-review/AGENTS.md - running notes with retro - new.
- .work/active/phase2-prose-review/prompts/02-review.md - Ch02 prompt - new.
- .work/active/phase2-prose-review/prompts/03-review.md - Ch02 retro applied plus prompt-optimizer pass - new.
- .work/active/phase2-prose-review/ste_check.py - deterministic lint (normalizer, splitter, 18-check catalog, CLI) - new.
- .work/active/phase2-prose-review/test_ste_check.py - 36 tests (micro-cases, regressions, Ch01-Ch03 post-fix goldens) - updated after the fix pass.
- .work/active/phase2-prose-review/plan/audits/ai-writing-audit-ch01.md - Ch01 AI-writing-pattern audit - new.
- .work/active/phase2-prose-review/plan/audits/ai-writing-audit-ch02.md - Ch02 AI-writing-pattern audit - new.
- .work/active/phase2-prose-review/plan/audits/ai-writing-audit-ch03.md - Ch03 AI-writing-pattern audit - new.
- .work/active/phase2-prose-review/plan/audits/ai-writing-audit-ch04.md - Ch04 audit, 23 findings - new.
- .work/active/phase2-prose-review/plan/audits/ai-writing-audit-ch05.md - Ch05 audit, 21 findings plus 16 sentence rows - new.
- .work/active/phase2-prose-review/plan/audits/ai-writing-audit-ch06.md - Ch06 audit, 21 findings - new.
- .work/active/phase2-prose-review/plan/audits/ai-writing-audit-ch07.md - Ch07 audit, 24 findings - new.
- .work/active/phase2-prose-review/plan/2026-10-23-ai-writing-pattern-fix-plan.md - consolidated P0-P3 fix plan for Ch01-Ch03 - new.
- .work/active/phase2-prose-review/plan/2026-10-23-ai-writing-pattern-fix-plan-ch04-ch07.md - consolidated P0-P3 fix plan for Ch04-Ch07 - new, not applied.
- college/mydeliverables/Phase-2-report/phase2-report/chapters/02-literature-survey.tex - Ch02 fixes applied (American spellings, `uses`/`gives`, simple present, single hyphen, paragraph splits, table commas).
- college/mydeliverables/Phase-2-report/phase2-report/chapters/01-introduction.tex - AI-pattern fix plan applied (recap claims, citations, pointers, paragraph splits, phrasal verbs).
- college/mydeliverables/Phase-2-report/phase2-report/chapters/03-requirements.tex - AI-pattern fix plan applied (written-arm attribution, CUSUM status, NFR precision, hardware table, software rows).
- college/mydeliverables/Phase-2-report/phase2-report/chapters/04-methodology.tex - X-01 precision/baseline, X-06 BKT criterion, CUSUM sentence split.
- college/mydeliverables/Phase-2-report/phase2-report/chapters/05-implementation.tex - X-03 rubric-grading row, X-04 spelling.
- college/mydeliverables/Phase-2-report/phase2-report/chapters/06-results.tex - X-02 CUSUM correction, X-04 spelling.
- college/mydeliverables/Phase-2-report/phase2-report/chapters/07-conclusion.tex - X-02 CUSUM correction, X-04 spelling.
- college/mydeliverables/Phase-2-report/phase2-report/main.tex - X-04 American spelling in the abstract.
- .work/active/phase2-prose-review/plan/audits/*.md - resolution status appended to all three audits.
- .work/active/phase2-prose-review/plan/2026-10-23-ai-writing-pattern-fix-plan.md - author answers and execution record appended.

## Pitfalls & rules
- Must read the full chapter file before counting; previews truncate past 500 chars and merge sentences.
- Must run `ste_check.py` for all counts; it strips LaTeX commands and `~` before counting so `\item` and `\textbf` never inflate word counts.
- Must not touch build outputs (`main.pdf`) or `active/phase2-report/*` from this task; parallel sessions share the checkout.

## Decisions in force
- Decided lint-first judge-second because two parallel counters in Ch01 disagreed and cost a manual recount (2026-10-22).
- Decided flavored bar with guide register winning on passive because strict passive bans contradict the dissertation voice (2026-10-22).
- Decided `ste_check.py` is the single counter (2026-10-23): hand counts disagreed twice (Ch01 parallel counters, Ch01 14 vs deterministic 13); every chapter pass lints with the script and pins movement in its golden tests.

## Open
- Q-12 equation notation: `P_{\text{correct}}` and `P_{\text{obs}}` appear to name one posterior in `eq:bkt-update`; the author must confirm before the equation changes.
- X-05 bibliography metadata: five entries at `main.tex:169-179` still lack author names; the G1 verbatim rule blocks a guess.
- Q-02 external full-text verification of `islam2024` and `alhazbi2024` still belongs to the author.
- Q-17 and Q-20 used the measured values as defaults; decide whether the NFR-7 groundedness bar and NFR-9 retrieval floor need headroom.
 - Ch04-Ch07 author queue fully resolved via grill 2026-10-23; only `true study pace` and `realized` in the abstract were never put to the grill.
- Ch04-Ch06 retain the STE and Humanizer debt recorded in the Chapter 4 to 7 plan; Ch07 is clean.
- Build and PDF inspection have not run yet; they belong to `phase2-report`.
