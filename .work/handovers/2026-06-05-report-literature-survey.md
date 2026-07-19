---
date: 2026-06-05
mode: mid-task
slug: report-literature-survey
topic: M.Tech Phase-1 report — expand Literature Survey + edit main.tex
---

## TL;DR
Building the M.Tech Phase-1 **report** (LaTeX) for "Adaptive Study Planning for
Self-Directed Learners". `main.tex` compiles cleanly (**25 pages**). The Literature
Survey chapter currently has ~27 papers with a full taxonomy; the **next task is to
expand it to ~48 papers (21 Pillar A + 27 Pillar B)** using the already-extracted
candidate set (`pillar-candidates.md`), with mixed depth, then recompile. This survey is
**final for the whole dissertation** (no separate Phase-2 lit review), so make it thorough.
First read `reference_latex-toolchain.md` (memory) for how to compile.

## Goal / why
- Produce the Review-1 dissertation report from the PES template, filling our drafted
  sections. Review 1 is ~this weekend.
- The user found the current Literature Survey **too minimal** and wants it expanded to
  the depth of the sample reports (`college/sampleReports/Sample-Project-Phase-1-Report.pdf`
  has a ~9-page survey, ~30 papers, taxonomy + per-paper paragraphs + a pros/cons table).
- **This lit survey is the FINAL one** — it carries through Phase 2. Be comprehensive and
  balanced, not minimal. User said "give your best."

## Key references
| Path | Why it matters |
|---|---|
| `college/mydeliverables/1st-Review/report/main.tex` | THE report. Edit this. `report` class, manual `thebibliography` (no biber), `secnumdepth=3`. |
| `college/mydeliverables/1st-Review/report/main.pdf` | Current build (25 pp), for reference. |
| `college/mydeliverables/zero/literatures/pillar-candidates.md` | **The 48 curated candidates (21 A + 27 B) WITH ABSTRACTS, grouped by cluster.** Write the expanded survey from this — no re-fetch needed. |
| `college/mydeliverables/zero/literatures/evaluated_papers.json` | Pillar A eval (104 papers); has stored abstracts/scores/authors. |
| `college/mydeliverables/zero/literatures/evaluated_papers_pillarB.json` | Pillar B eval (158 papers); stored abstracts. Source for more papers / exact DOIs+authors. |
| `college/mydeliverables/zero/literatures/pillarB-selected.md` | Curated Pillar B picks + arXiv recoveries, ★ anchors marked. |
| `college/sampleReports/Sample-Project-Phase-1-Report.pdf` | **Structure to emulate** (pp 11-19 = Literature Survey). |
| `~/.claude/projects/-Users-rsaji-projects-1-college-study-planner-web/memory/reference_latex-toolchain.md` | How to compile (TinyTeX path, PATH export, latexmk, tlmgr, venv). READ FIRST. |
| `../plans/archive/2026-06-04-review1-prep-deferrals.md` | Running deferral/decision log for the whole Review-1 effort. |
| `design/architecture.md` | The architecture diagram (Mermaid). |

## What I learned (current report state)
- `main.tex` already filled: Title block (admin `% TODO`s), Abstract, Introduction
  (problem/objectives/scope/org), **Literature Survey (taxonomy in place)**, SRS,
  Proposed Methodology (architecture text + algorithms + 2 expected-outcomes booktabs
  tables), bibliography (~27 `\bibitem`). Implementation/Results/Conclusion are stubs (Phase 2).
- **Literature Survey taxonomy already in main.tex** (keep this structure, expand within it):
  - `\section{Existing Systems}`
    - `\subsection{Pillar A: Adaptive Pace Modelling and Scheduling}` → subsubsections:
      Bayesian Calibration / Behavioural-Change Detection / Gaussian Processes /
      Adaptive Scheduling / Self-Regulated-Learning Analytics
    - `\subsection{Pillar B: Assessment Generation, Knowledge Tracing, and Verification}` →
      Knowledge Tracing & Cold-Start / Automatic Question Generation / Concept Extraction /
      Automated Grading / Assessment Integrity & Gaming / Retention & Review Scheduling
    - `\subsection{Summary of Approaches}` + comparison table `tab:litsummary`
  - `\section{Limitations of Existing Systems}` (enumerated gaps)
  - `\section{Proposed Solution}` (two-pillar verified closed loop)
- **Pool available** (from eval JSONs): Pillar A 22 STRONG / 51 STRONG+GOOD (2024+);
  Pillar B 55 STRONG / 98 STRONG+GOOD (2024+). Plenty to draw from.
- Toolchain: **TinyTeX** at `/Users/rsaji/Library/TinyTeX/bin/universal-darwin` (TeX Live
  2026). venv at `.venv` has `pygments` + `pypdf`. PDF text extraction uses pypdf
  (poppler/pdftoppm NOT installed, so Read-tool PDF rendering fails — use pypdf).

## The next task (concrete)
Expand `\chapter{Literature Survey}` in `main.tex` from ~27 to ~48 papers:
1. Use `pillar-candidates.md` (21 A + 27 B, grouped by cluster, abstracts included).
2. **Mixed depth** like the sample: base/anchor papers (Islam `islam2024`, CLST `clst2024`,
   + the strongest 2-3 per subsection) get a full paragraph (method, data, result,
   limitation); the rest get tight 1-2 sentence grouped mentions within their subsection.
3. Keep balance — don't let Pillar B (more strong papers) swamp Pillar A.
4. Add a `\bibitem{key}` for every new paper; keep keys consistent with existing scheme.
5. Update the `tab:litsummary` comparison table if new approach families appear.
6. Recompile and verify (commands below).

## Dead ends / gotchas (IMPORTANT — saves you pain)
- **`pillar-candidates.md` is raw top-by-score and contains DOMAIN-MISMATCHED matches** —
  drop or replace these (they matched on keywords, not relevance):
  - "Performance prediction ... of **screw compressors** using GPR" (engineering, not edu)
  - "X-BCD ... **Smart Home** behavioral change detection" (not education)
  - "Using **Anki** ... medical students" landed under *assessment_integrity* (it's retention)
  - "Region-Enhanced Text Localization", "K-Means weekly engagement", generic GNN papers —
    weak fit; use judgement, prefer clearly on-topic education papers.
- **Bibliography DOIs/venues in current `main.tex` were hand-written and some are
  approximate** — VERIFY each against `pillar-candidates.md` / the JSONs before final.
  Exact DOIs live in the candidate file (e.g. islam=10.1109/iccit64611.2024.11021881,
  saqr=10.1145/3785022.3785050, perezsuay=10.1109/rita.2024.3465035, zanellati=10.1109/tlt.2023.3348690).
- **Bash tool resets cwd + env between calls** — use absolute paths and re-`export PATH`
  for TinyTeX every compile call.
- **Do NOT use `curl|sh` TinyTeX installer** — blocked by classifier and unneeded (TeX installed).
- `build.log` shows first-pass "undefined citation" warnings — ignore; check `main.log`.
- Architecture figure is a **commented placeholder** in Proposed Methodology (so it builds).
  Needs TikZ conversion OR Mermaid→`system_architecture.png` export, then uncomment.

## Open questions
1. Final paper count — decided ~48, but after pruning spurious candidates expect ~40-45.
   Confirm with user if dropping below ~40.
2. Title: keep short "Adaptive Study Planning for Self-Directed Learners" or add subtitle
   (e.g. "A Verified Closed-Loop Approach")? Unresolved.
3. Architecture figure: TikZ (self-contained, recommended) vs PNG export? Unresolved.
4. Admin placeholders (reg-no, guide name, department, semester dates) — user to supply.

## Decisions locked (do not relitigate)
- Two pillars: A) closed-loop adaptation (Bayesian→CUSUM→GP→constraint scheduling),
  B) assessment-based verification (LLM concept-tagged item-gen + cold-start concept-level KT).
- Base papers: Pillar A = Islam 2024 (predict-then-optimize); Pillar B = CLST cold-start KT.
- Phase I = open-loop + research assessment options; Phase II = close loop + build assessment (novelty).
- Architecture: single Python FastAPI "Intelligence Service" (Docker/Colima) for all heavy ML;
  local-first TS client; Supabase hub. (`design/architecture.md`)
- Expected outcomes: named metrics + directional hypotheses; KT-AUC ~0.70-0.82 only cited range.

## Verification commands
```bash
export PATH="/Users/rsaji/Library/TinyTeX/bin/universal-darwin:$PATH"
cd /Users/rsaji/projects/1/college/study-planner-web/college/mydeliverables/1st-Review/report
latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex
grep -c "Citation.*undefined" main.log    # must be 0
grep -i "Output written" main.log         # page count
# inspect a chapter's text (no poppler; use pypdf):
/Users/rsaji/projects/1/college/study-planner-web/.venv/bin/python -c "from pypdf import PdfReader;print(PdfReader('main.pdf').pages[12].extract_text())"
```

## Next action
Open `main.tex` Literature Survey chapter and `pillar-candidates.md` side by side; expand
each subsubsection to mixed-depth coverage of its (pruned) candidates, adding `\bibitem`s,
then recompile and confirm 0 undefined citations.

## User context
- Wants the survey **comprehensive and balanced** ("final", "don't limit to ~30", "give your best").
- Prefers studying the sample reports' structure and matching their depth/sectioning.
- Cares about **clarity** (e.g., demanded a clean, well-structured architecture diagram).
- Strategy framing: app is presented to examiners as "proposed/in-progress" though much is
  built; the assessment pillar IS genuinely unbuilt (honest forward progress).
- Outstanding sibling tasks (TaskList): #3 architecture-diagram variant (in_progress),
  #5 Review-1 slide deck (pending).
