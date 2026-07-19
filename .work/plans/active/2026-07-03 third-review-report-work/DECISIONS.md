# 3rd-Review Report — decisions log

> **Status:** active design discussion (grilling, in progress). Living document — **append every
> new decision here as we make it.** Not yet an implementation plan; this is the decision log the
> eventual `PLAN.md` (+ `VERIFICATION.md`) will be built from.
> **Started:** 2026-07-03 · **Owner:** Rohit (design) + Cowork (planner)
> **Scope:** the M.Tech Phase-1 (Pillar-A) dissertation report — a full end-to-end rewrite.
> **Source material:** `research/01-app-architecture-and-data-flow.md`, `research/02-research-to-app-mapping.md`,
> `research/03-research-to-literature-mapping.md`, `research/04-application-evolution-trace.md`;
> current report `college/mydeliverables/1st-Review/report/main.tex`; generated results under
> `college/mydeliverables/1st-Review/report/generated/` and `research/results/*`.

## Legend

`✅` locked (agreed) · `🟡` proposed / awaiting confirmation · `☐` open (not yet discussed/resolved) · `🛑` blocked

---

## 1. Why this work exists

- We are approaching **end of Phase 1** and need a **complete, end-to-end** dissertation report for
  the 3rd review. The existing `1st-Review/report/main.tex` is written in "Phase-1 open-loop,
  *expected/directional* outcomes" mode with empty Implementation/Results/Conclusion chapters, and
  is **stale**: (a) real Holm-corrected comparison results now exist, and (b) "the major refactor"
  (evolution era 6) **retired constraint-based scheduling** for a booking model, so parts of the
  written abstract/Ch2/Ch4 now contradict the built system.
- Goal: rewrite the report grounded in **current research + current app reality**, in the
  conventional forward academic narrative, scoped to **Pillar A only**.

## 2. Ground-truth facts the report must respect (verified in research docs)

- **Pillar A is what's built; Pillar B is not.** No assessment/quiz/knowledge-tracing surface exists
  anywhere in `apps/app/src` (doc 02 §2). KT-bench is a standalone benchmark with zero app integration.
- **Execution split (for the architecture diagram):** Bayesian + `enriched_shrink`/dual-prior
  calibration and CUSUM change detection run **server-side in the Python intelligence service**
  (`POST /v1/calibration`); GP burn-up/projection (incl. the `COLD_START_N=5` composite) and the
  booking/roadmap engine run **client-side in TypeScript**. Supabase is the data hub. `/v1/progress`
  and `/v1/calibration/prompt-detail` are **dead endpoints** (doc 01 §3).
- **Promotions from research → production:** `enriched_shrink`/dual-prior calibration (Python), and
  the `gp_plus_analytic` cold-start ETA composite (`projectFinish.ts`, promoted one day after
  validation). **Still unpromoted:** split-conformal GP-interval correction. **Shipped but untuned:**
  production CUSUM is single-arm/generic-factor, not the dual-arm MAD-robust winner (doc 02 §1).
- **Scheduling was retired by explicit design decision** (D1/§5c of the material-session-decoupling
  plan), not neglected — packed-slot day-by-day assignment → blank bookings + material-at-session-start.
- **The app is open-loop.** Change detection surfaces a human-in-the-loop recalibration *prompt*; the
  app never auto-replans. Closed-loop automation is Phase-II.
- **Base paper (Pillar A):** `islam2024` — predict-then-**optimize** (ANN + DP scheduling).

## 3. Locked decisions ✅

### D1 — Fresh rewrite; keep structure, replace content ✅
Treat this as a fresh report: **keep the existing 7-chapter LaTeX skeleton/conventions**, but rewrite
**all content** grounded in the current research (docs 01–04) and the real generated results. Ignore
the stale prose of the current `main.tex`.

### D2 — Forward academic narrative ✅
Present the conventional forward order: **problem statement → literature → chosen approach → build →
results**, even though the real order was app-first-then-research. This is *narrative ordering only* —
every model, dataset, and result reported is real; **nothing is fabricated.**

### D3 — Report the real, measured results (not "expected/directional") ✅
Chapters 4–6 present actual measured comparison results with the real figures/tables. Include
research-level honesty (honest nulls, the `enriched_shrink` discovery, known gaps) as a **strength**,
forward-framed. *(Extended by D7 — evolution is now a first-class thread, not a one-liner.)*

### D4 — Phase-1 report = Pillar A only ✅
Scope the whole report to **Pillar A** (adaptive pace modelling & scheduling). Consequences:
- Literature survey trims to Pillar-A themes (Bayesian/pace calibration, change detection, GP
  projection, scheduling, SRL). The ~27 Pillar-B citations compress into **Future Work** motivation.
- Datasets narrow to the **synthetic ground-truth generator (+ OULAD-calibrated regime)**; public KT
  datasets (NIPS2020/Eedi, ACcoding/POJ) are Phase-2.
- Results = Pillar-A comparisons only. **KT-bench AUC/ECE tables/figures are excluded** (Phase-2).
- Future Work carries the entire Phase-2 / Pillar-B vision (assessment-based verification + closing
  the loop).

### D5 — Scheduling: report it, frame retirement as a research-informed design decision ✅
Keep scheduling as an evaluated Pillar-A component and report the comparison (`dp_capacity` won on
deadline drift). Frame the outcome forward: constraint-based packing was evaluated, found brittle
(boundary/tie artifacts) and rigid against adaptive replanning → the delivered system adopts a
**capacity-based booking model**. Give the two smaller divergences the same forward treatment: the
**tuned dual-arm CUSUM** and **split-conformal interval correction** are reported as *validated
follow-ups*; the app ships the core detector/projector today.

### D6 — Results presentation: best deployable model per component; oracle = baseline; pre & post refactor ✅
- Rank the **deployable** candidate methods per component; the **oracle** appears only as a
  **reference baseline/ceiling row**, never the "winner." **Do NOT `\input` the generated winner
  `.tex` verbatim** (they crown the oracle) — regenerate curated deployable-method comparison tables
  from `research/results/*.json`.
- Report each component on **both regimes**: **pre-refactor** (initial synthetic regime) and
  **post-refactor** (revised booking/decoupled regime), showing the selected models **transfer**
  across the design change. Framed in the forward narrative as "initial" vs "revised (capacity-based)
  synthetic regimes" (robustness check, not code-churn).
- Scheduling has **pre-refactor results only** (retired before the revised regime) — consistent with
  D5.
- Best deployable per component: calibration → `enriched_shrink`/dual-prior; detection → best per
  shift type (CSD / CUSUM family); projection → GP + cold-start composite; scheduling → `dp_capacity`.

### D7 — Evolution as a first-class, research-informed design-refinement thread ✅
Make the refactor **visible** (extends D3's "honesty as strength"), presented forward as a design
refinement: base paper (`islam2024`, predict-then-optimize) → evaluate constraint packing → identify
limitations for adaptive self-directed use → re-research on a revised (decoupled) regime → adopt
capacity-based booking → re-validate that the selected calibration/detection/projection models
transfer. The real `/onboarding/3?new=1` tie-slot bug is framed as a **design limitation** ("boundary
artifacts in the packing formulation"), not "we shipped a bug."
- **Locked shape (Q6):** a **named "System Design & Evolution" section inside the Methodology chapter**
  (Ch4) — prominent, but **not** a standalone chapter (keeps the center of gravity on the Pillar-A
  research). Anchored by **two architecture diagrams** — "initial design" (predict-then-optimize,
  packed-slot, old `Slot` datatype) vs "revised design" (capacity-based booking, honest 3-tier
  client/server split, new `Booking` datatypes) — and reinforced by the pre/post-refactor results in
  Ch6. Closed loop drawn **dashed** as Phase-II; Pillar-B excluded from the main diagram.

### D8 — App implementation evidence: annotated screenshots in Ch5 ✅
Include an app-implementation section in Implementation (Ch5) with **annotated screenshots** of the
key Pillar-A surfaces as *implementation evidence* (not a user manual): onboarding → booking plan;
session runtime (timer); Home dashboard (calibration multiplier + streak + GP projection); Week
burn-up chart; Replan levers; **Roadmap calendar page**; **Roadmaps lifecycle dashboard**. ~6–7
figures. Screenshots captured from the running app — the plan tasks the coding agent / Rohit to
capture them (planner is read-only on code). A live Review-3 demo is **referenced if present, not
depended upon**.

### D9 — Empirical basis of Pillar-A results: synthetic ground-truth only (real N=1 → Phase-II) ✅
Phase-1 Pillar-A results rest on the **synthetic ground-truth comparison** (OULAD-calibrated for
realism) as primary evidence, with the **deployed working app as an existence proof** that the
selected models shipped. **Real N=1 longitudinal validation** (Rohit's own logged sessions,
open-loop vs closed-loop) is **Phase-II** — no real usage data is reported in this Phase-1 report.

### D10 — Length target: ~60 pages, start to finish ✅
Aim for a **complete ~60-page** report. Rough chapter proportion: Intro 4–5 · Literature Survey 12–15 ·
Requirements 2–3 · Methodology (incl. System Design & Evolution + 2 diagrams) 12–14 · Implementation
(incl. datasets + ~6–7 screenshots) 10–12 · Results & Discussion 8–10 · Conclusion & Future Work 3–4 ·
References. Length comes from substantive research/methodology/results, **not padding** (per D11's
anti-AI-tell rules).

### D11 — Prose voice: draft to `college/mydeliverables/REPORT_WRITING_GUIDE.md` ✅
All body prose follows the guide's **"Report-D" human-researcher register**:
- Chapter-opening **roadmap paragraphs** that name section numbers explicitly ("Section 2.1 covers …").
- The **4-beat literature-review formula**: attribution + artifact name → mechanism (no adjectives) →
  quantitative result (named metric + number) → limitation/gap. Never skip the number or the gap.
- **Honest results pattern**: state the number → one specific adjective → explain the mechanism → tie
  to a named factor. Report nulls/poor numbers plainly (fits D3/D5).
- One **hedge-with-a-reason** per claim; third-person, passive-leaning body; specific numbers always.
- **Avoid the AI tells** the guide lists (no "It is important to note," no triadic-adjective padding,
  no stacked "Moreover/Furthermore," **no em-dashes as punctuation** — use "-"), and the weak-student
  tells (subject-verb slips, verbatim cross-section repetition, inconsistent capitalization).
- Companion for figures: `college/mydeliverables/TIKZ_DIAGRAM_GUIDE.md`. References numbered **in order
  of first citation** (matches the existing `thebibliography`).

### D12 — Modular LaTeX layout ✅
`main.tex` holds the preamble, front matter, and bibliography; **each chapter is its own file under
`3rd-Review/report/chapters/NN-name.tex`**, pulled in with `\input`. Rationale: isolated per-chapter
edits/reviews and readable diffs for a ~60-page report. `\input` (not `\include`) — simpler, and
`\chapter` already starts a new page in the `report` class. The build copies `chapters/` into
`/tmp/texbuild3` before compiling.

### D13 — Illustrations: canonical formulas + schematic figures ✅
Enrich chapters (starting with Ch2) with (a) **canonical, attributed formulas** - Bayesian conjugate
pace update, CUSUM recursion, GP predictive mean/variance + RBF kernel, predict-then-optimize DP
recurrence - and (b) **original TikZ/pgfplots schematic figures** (prior$\to$posterior, CUSUM chart, GP
burn-up band, predict-then-optimize pipeline, SRL loop). Data-like figures are captioned
"schematic / illustrative, not measured" so they are never confused with Ch6's real results (D6).
Paper figures are **not copied** (copyright); concepts are redrawn. Adds legitimate rigour and pages.
Preamble gains `amsmath`, `amssymb`, `tikz`, `pgfplots` (+ `fillbetween`). Every figure is
visually verified by rasterizing the compiled PDF (per TIKZ_DIAGRAM_GUIDE).

## 4. Proposed / awaiting confirmation 🟡

— none open. (D7 resolved 2026-07-03 and moved to §3.)

## 5. Assumed defaults (proceeding unless corrected) 🟡

- **A1** — Build the 3rd-review report as a **new `college/mydeliverables/3rd-Review/report/`**
  directory evolved from the 1st-review `main.tex`; preserve the submitted 1st-review artifact intact.
- **A2** — Title page stays framed as **"Project Phase - 1"** (this is the Phase-1 culmination report).
- **A3** — Keep the **hand-maintained `thebibliography`** block (no `.bib`/biber), per
  `.claude/rules/latex-report-build.md`.
- **A4** — Architecture diagrams are **standalone-TikZ vector PDFs**, per
  `.claude/rules/flow-diagram-tikz-gen.md` and `college/mydeliverables/TIKZ_DIAGRAM_GUIDE.md`.

## 6. Open questions ☐

- **OQ-1 (Q6):** ✅ resolved — dedicated "System Design & Evolution" section in Methodology (see D7).
- **OQ-2:** ✅ resolved — yes, ~6–7 annotated screenshots incl. Roadmap calendar + Roadmaps dashboard (see D8).
- **OQ-3:** ✅ resolved — synthetic ground-truth only for Phase-1; real N=1 → Phase-II (see D9).
- **OQ-4:** ✅ resolved — target ~60 pages start to finish (see D10).
- **OQ-5 (figure grounding, build-time):** confirm each generated figure's regime (frozen vs
  decoupled) via its `*_provenance.txt`; regenerate curated tables from `research/results/*.json`.

## 7. Meta / housekeeping

- **Tracker drift found:** the project system-prompt names `MASTER_TRACKER.md` at the repo root as the
  index, but that file **does not exist**; the live index is **`.work/STATUS.md`**. Oriented via
  `STATUS.md`. Flag for correction (out of scope for this task).
- **Env / build workflow (verified 2026-07-03):** the sandbox has a full TeX Live
  (`/usr/share/texlive`; `latexmk`/`pdflatex`/`xelatex`); the existing `main.tex` compiles clean
  (29pp, 0 undefined refs). **Editing** is via the file tools (host-backed; overwrite works).
  **Compiling** must happen in a **sandbox-local `/tmp` build dir** (copy sources in → `latexmk`),
  **never in the mounted repo** — the bash mount is **create-only** (no delete/overwrite from the
  sandbox), so in-place builds would strand undeletable `.aux/.log/.pdf` artifacts. Deliver the
  compiled PDF via `present_files`.
- Companion working memory: [`SCRATCHPAD.md`](./SCRATCHPAD.md).
