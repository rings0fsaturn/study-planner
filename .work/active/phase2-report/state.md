# State – phase2-report
_Spec: college/mydeliverables/Phase-2-report/ (guideline + sample + phase1-report/) · Plan: .work/active/phase2-report/plan/ (CHAPTERS.md, GRILL.md, 2026-10-23-examiner-review-rating-10-plan.md) · STATUS row: phase2-report · Status: active · Updated: 2026-10-23_

## Current state & next
- Batch 0 + Batch 1 (actionable) done 2026-10-23: /tmp rebuild 48pp, 0 errors, 0 undefined, 0 overfull (was 47pp/3 overfull); `main.pdf` refreshed; hidelinks, Sec 2.2 heading + KC definition, Ch1/Ch7 overfull rewording, Docker Desktop on WSL2 line, Definitions page (R-09) applied; Table 5.1 `last seven` verified correct against 7 rows (companion C5-01 opposite rejected).
- Batch 2 done 2026-10-23: all 11 bibliography entries carry verified authors, venues, volumes, pages, DOIs ([7] labeled unrefereed preprint); [10], [3], [1], [4] claims corrected; unverified 0.73 dropped; citation-claim map in plan Section 10; /tmp rebuild 49pp, 0 errors, 0 undefined, 0 overfull; `main.pdf` refreshed; bib + Ch1/Ch2 pages raster-checked.
- Batch 3 done 2026-10-23: S:off headline, self-judge disclosure, harness FAIL, coding 23/62 = 0.371, telemetry 361, week-5 n.o., RPC row, Wilson + McNemar, NFR headroom, abstract caveat, new 6.6 Threats + ethics; /tmp 50pp 0/0/0; `main.pdf` refreshed; D-02/D-03/D-07/D-10 resolved as reframe/honest-cluster.
- Batch 4 done 2026-10-23: Ch2 11 to 29 refs (all verified), ITS/spacing/judge/IRT/feedback blocks, 2.5 protocol, 2.6 + 7.1 narrowed novelty; /tmp 53pp 0/0/0; `main.pdf` refreshed. Partial: 29 not 35-50 (D-04 needs author DB screening).
- Batch 5 done 2026-10-23: Ch4 interfaces + Figs 4.1/4.2 + events table, Ch5 API/hyperparam/testing tables + Piston, Ch3 3.5-3.7, appendix A.4, 7.2 usability gate; /tmp 57pp 0/0/0; `main.pdf` refreshed. Partial: no expert review/pilot, no coverage.
- Batch 6 done 2026-10-23: all files STE+H PASS; tallies to testing table; flow figures merged; arch protocols; 6.7/7.3; headers/TOC/keywords; title kept (D-06). Partial: Fig 5.6 needs live re-capture; screenshots uncropped.
- Batch 7 done 2026-10-23: clean-room /tmp rebuild 57pp, 0/0/0; full lint PASS; `main.pdf` refreshed. Fresh self-review (not independent): problem 8, literature 7, methodology 8, implementation 8, results 8, analysis 7, writing 8, figures 7, compliance 7. Overall 7.5/10 (7.0-8.0).
- Open (need author): D-01 signatures + declaration; Fig 5.6 re-capture; 29 to 35-50 refs with DB screening; reliability diagram; AUC/ECE intervals; independent judge; real-learner study.

## Done so far
- 2026-10-23: Examiner review of all 47 pages, fresh build, figure/table inspection, and evidence cross-checks; rating 6.0/10; action plan documented at `plan/2026-10-23-examiner-review-rating-10-plan.md`.
- 2026-10-20 to 2026-10-23: Ch2-Ch7 plus Appendix A drafted and committed as `1a89d44`; 47pp green at the time; five flow figures and five screenshots added; prose-review Ch01-Ch07 passes applied, with remaining author items tracked in the companion plan.
- OPEN 2026-10-20: created `active/phase2-report/{plan,prompts,research}` + STATUS Active row.
- 2026-10-20: pinned 7-chapter split in `plan/CHAPTERS.md` (1.1-1.5 through 7.1-7.2 + References + Appendix).
- 2026-10-20: vendored humanizer skill v3.1.0 (MIT) into `.agents/skills/humanizer/SKILL.md` for direct reference, source line appended.
- 2026-10-20: scaffolded `college/.../phase2-report/` (main.tex + 8 chapter files + logo); drafted 01-introduction per Q1-Q7; /tmp smoke green (20 pages, Letter, Times/Helvetica, 0 errors, empty-bib warning only); committed as `a910270`.

## Flow trace
1. Entry: `STATUS.md` row `phase2-report` -> `state.md` (this file) -> `plan/GRILL.md` -> `plan/CHAPTERS.md` -> `plan/2026-10-23-examiner-review-rating-10-plan.md` -> `SCRATCHPAD.md`.
2. Prep research lives at `active/phase2-report-prep/research/phase2-report-context/` (index + 3 streams); scaffold approved 2026-10-20 and written to `college/.../phase2-report/`.
3. Report spec: sample 7-chapter spine + guideline gates; Phase-1 preamble/voice/float habits carry over with Q6 Letter/Times switch.

## Files affected
- .work/active/phase2-report/plan/2026-10-23-examiner-review-rating-10-plan.md – examiner review findings and rating-10 execution plan – new.
- .work/active/phase2-report/state.md – bootstrapped; updated with the examiner review state.
- .work/active/phase2-report/SCRATCHPAD.md – seeded; examiner review session entry appended.
- .work/STATUS.md – Active row added; phase2-report row updated to the review state.
- .work/active/phase2-report/plan/GRILL.md – Q1-Q7 + G1 all asked and resolved.
- .work/active/phase2-report/plan/CHAPTERS.md – agreed 7-chapter split (1.1-1.5 through 7.1-7.2 + References + Appendix).
- .agents/skills/humanizer/SKILL.md – vendored from upstream URL (MIT v3.1.0) + source line; refer as `humanizer` skill.
- college/mydeliverables/Phase-2-report/phase2-report/ – main.tex (Letter/Times/titlesec preamble, Phase-2 front matter, 7 inputs + appendix + thebibliography), chapters/01..07 + appendix (all drafted; reviewer PDF stale), PESU-new-logo.png.

## Pitfalls & rules
- Must follow rule 60: build in `/tmp` only; refresh the beside-`main.tex` review PDF from each green build (copy `main.pdf` only, never aux/log), check `git status -- college/`.
- Host TinyTeX needed `tlmgr install rsfs` 2026-10-20: mathptmx requests rsfs10 for math minus (fatal without it); full TeX Live already ships it.
- Must follow REPORT_WRITING_GUIDE.md: roadmap paragraph per chapter, 4-beat lit entries, Ch2-only Summary, numeric refs.
- Must not mix IEEE journal format into the dissertation.
- Must not write secrets into `.work/` or report sources.
- Must rebuild `main.pdf` from source before submission; the checked-in PDF is stale (05:27) against the 09:27 chapters, and the source is the review baseline.
- Must add the mentor signature to the certificate and the candidate signature plus originality statement to the declaration; guideline lines 299-302 make both hard submission blockers.
- Must keep the build gate at 0 overfull; the fresh build has 3 overfull boxes (Ch1 lines 21-22, Ch2 line 26 heading, Ch7 lines 7-8).
- Must not duplicate the chapter-level prose edits already tracked in `active/phase2-prose-review/plan/2026-10-23-ai-writing-pattern-fix-plan-ch04-ch07.md`; apply its P0 rows before Batch 6.

## Decisions in force
- Decided STE-flavored plus humanizer apply to body prose only; boilerplate, code, identifiers, captions/labels, bibliography stay verbatim (2026-10-20).
- Decided the review PDF lives beside main.tex and is refreshed from each green /tmp build (2026-10-20); this overrides the prep-phase no-PDF-in-repo habit.
- Decided to use humanizer skill (blader/humanizer v3.1.0) alongside STE for body prose (2026-10-20).
- Decided Phase-II objectives as the 7-item list, each with short explanatory prose (2026-10-20).
- Decided Ch1 as 1.1 Background, 1.2 Problem Statement, 1.3 Objectives, 1.4 Scope, 1.5 Organization with 1-paragraph Phase-I recap (2026-10-20).
- Decided full dissertation, not Phase-II-only delta, because the 40-page floor and sample spine assume a complete report (2026-10-20).
- Decided to ground every claim in `phase1-report/` + live code reality (2026-10-20).
- Carried from prep: May-Oct 2026, `Artificial Intelligence`, Letter + Times/Arial + titlesec, keep subcaption, Ch2-only Summary, appendix shell, INFO.txt roster (2026-10-14).
- Decided the 2026-10-23 examiner review is the submission baseline; P0 compliance and evidence-integrity items close before prose polish (2026-10-23).

## Open
- See `plan/2026-10-23-examiner-review-rating-10-plan.md` Sections 4-6 for the full findings ledger, batches, and author decisions.
- P0 blockers: stale PDF, missing signatures, citation integrity ([3], [10], [1]), groundedness pseudo-replication, pooled S-layer headline, undisclosed harness FAIL, coding denominator, unobserved week 5, undefined terms, and the efficacy overclaim.
- Author decisions D-01 (signatures), D-02 (real-learner scope), D-03 (judge rerun), D-04 (literature expansion) are open.
