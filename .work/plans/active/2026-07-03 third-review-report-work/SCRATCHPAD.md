# Scratchpad — third-review-report-work (report drafting)
_Plan: PLAN.md (checklist) · Log: DECISIONS.md (decisions) + VERIFICATION.md (acceptance) · Updated: 2026-07-03T23:20_

## Now
**Drafting underway; report is modular (D12).** Layout: `main.tex` (front matter + bib) + `chapters/
NN-name.tex` via `\input`. **Ch1 Introduction = DONE (Rohit drafted it)**; **Ch2 Literature Survey =
DONE** (Pillar-A, 4-beat voice, model-sourcing methodology, summary table, 21-entry Pillar-A bib).
Ch2 now **illustrated (D13)**: 5 canonical formulas + 5 schematic TikZ/pgfplots figures
(prior$\to$posterior, CUSUM chart, GP burn-up band, predict-then-optimize pipeline, SRL loop), each
visually verified by rasterizing. **Ch3 Requirements = DONE** (hardware/software tables + numbered
FR/NFR grounded in the real stack). **Ch4 Methodology = DONE** (5 sections: adaptive loop; candidates
+ enriched-shrinkage eqn 4.1; comparison methodology; System Design & Evolution with both architecture
diagrams; architecture + client/server split). Illustrations: Fig 4.1 loop + Fig 4.2 pipeline (inline
TikZ), Fig 4.3 arch_initial + Fig 4.4 arch_revised (standalone vector) — all visually verified. Full
report compiles clean: **32pp, 0 undefined**; delivered `report_ch1-4.pdf`. **Ch5 Implementation = DONE**
(dev-env table, datasets+OULAD table, model-impl table + CUSUM code listing, metrics/reproducibility,
app section with **7 screenshot placeholders** keyed to `screenshots/app_*.png`). 38pp, 0 undefined.
Screenshot-capture prompt written and handed to Rohit for a Playwright agent — see
`screenshot-capture-prompt.md`. **Ch6 Results = DONE** (4 component sections + discussion; curated
deployable-method tables built from `research/results/*.json`, frozen + decoupled; oracle=ceiling;
Fig 6.1 coverage bar chart; honest framing: calibration null + prospective enriched win, detection
robust null, projection conformal gap, scheduling dp_capacity win but retired). **Ch4 detection
corrected** to the real candidate set (CUSUM/CSD/EWMA/Page-Hinkley/BOCPD/ADWIN; robust null) — the
earlier "dual-arm" claim was not in the results JSON. **Ch7 = DONE** (Phase-II Pillar-B vision; +9
Pillar-B refs cited in Ch7 only). **ALL 7 CHAPTERS DRAFTED.** Full report: **43pp, 0 undefined, 0
overfull**; delivered `report_full_ch1-7.pdf`. **SCREENSHOTS LANDED** — all 7 captured by Rohit's Playwright agent and
inserted (Figs 5.1–5.7), sized with width+height caps + keepaspectratio; render clean. **Report is now
COMPLETE end-to-end: 44pp, 0 undefined, 0 overfull; delivered `report_full_v2.pdf`.** Remaining
(optional): page count 44 vs ~60 target (expand if wanted); final verification/polish pass; the
figure-provenance flag (Open).
NOTE: TaskList reset to empty mid-session; SCRATCHPAD is the durable tracker; task list rebuilt.

## Alignment
On track. Big scope refinements from Rohit this session: (1) Pillar-A only, Pillar-B → Phase 2; (2)
forward narrative despite real app-first order; (3) evolution/refactor should be **first-class** (this
revised the earlier "keep it to one line" recommendation — captured as D7 extending D3).

## Open
- **Provenance mismatch (flag for Rohit):** pre-generated figures in `1st-Review/report/generated/`
  carry dataset hash `e716cd12dddc` (n3600); the Ch6 numbers come from `research/results/*.json`
  (`21c2cdabfa91` frozen n5400 / `9e6d48db2da8` decoupled n5400 / `3b404c903563` scheduling n3600).
  Ch6 tables were built from the JSON and the stale figures were NOT reused. Regenerate figures from the
  same run if they must be canonical.
- **Page count:** 43pp vs ~60pp target (D10). Screenshots keep it ~43pp; expanding needs more prose/
  figures per chapter — decide with Rohit.
- **Screenshots:** ✅ done — 7 captured + inserted (Figs 5.1–5.7); build copies `screenshots/`.

## Blockers
— none.

## Deferrals
- Pillar-B (assessment/KT) entirely → Phase-2 report (D4). KT datasets + KT-bench results excluded from
  this report body. Trigger to revisit: Phase-2 kickoff.
- Build-time figure grounding (regime provenance, regenerate curated tables from `research/results/*.json`)
  → deferred to plan/implementation. Trigger: writing the Results chapter (OQ-5).

## Checklist
- [x] Read research docs 01–04 + scratchpads
- [x] Load latex-doc-gen skill + latex-build/tikz rules
- [x] Read current main.tex + generated results tables
- [x] Orient via STATUS.md (MASTER_TRACKER.md absent)
- [x] Lock D1–D6 via grill
- [x] Create DECISIONS.md + SCRATCHPAD.md
- [x] Resolve Q6 → D7 locked (dedicated Methodology "System Design & Evolution" section)
- [x] Resolve OQ-2 → D8 locked (app screenshots incl. Roadmap pages)
- [x] Resolve OQ-3 → D9 locked (synthetic-only; real N=1 → Phase-II)
- [x] Confirm OQ-4 → D10 (~60pp); adopt REPORT_WRITING_GUIDE voice → D11
- [x] Verify env can edit + compile .tex (compile ✅ 29pp; edit ✅; build in /tmp)
- [x] Greenlit → wrote PLAN.md + VERIFICATION.md (checklist linked to decisions)
- [x] Scaffold 3rd-Review/report + skeleton compile (17pp, 0 undefined)
- [x] Ch1 Introduction (Rohit-drafted; preserved in chapters/01-introduction.tex)
- [x] Ch2 Literature Survey (Pillar-A + model-sourcing + summary table + 21-entry bib + 5 figs/eqns, D13)
- [x] Ch3 System Requirements (hardware/software tables + numbered FR/NFR) — 26pp, 0 undefined
- [x] Ch4 Methodology + 2 architecture diagrams + 2 inline figs — 32pp
- [x] Ch5 Implementation (3 tables + CUSUM code listing + 7 screenshot placeholders) — 38pp, 0 undefined
- [x] Ch6 Results & Discussion (4 curated tables from JSON + coverage chart + discussion) — 43pp
- [x] Ch7 Conclusion & Future Work (+9 Pillar-B refs, Ch7-only)
- [x] Ch4 detection corrected to real candidates (robust null) for Ch4<->Ch6 consistency
- [x] Screenshots captured (Rohit's Playwright agent) + inserted (Figs 5.1–5.7); screenshots/ copied into build; renders clean
- [x] Session handover written: `.work/handovers/2026-07-04-3rd-review-report-expansion-polish.md` (build workflow, gotchas, expansion map, extracted results numbers, git state) — next session = expansion + polish
- [ ] Page count 44 vs ~60 target — expand if wanted (next session)
- [ ] Final verification/polish pass + deliver (next session)
- [ ] Build-dependent handoffs (screenshots + result tables) · [ ] Final compile ~60pp + deliver

## In-flight edits
- `DECISIONS.md` (through D12), `PLAN.md`, `VERIFICATION.md`, `SCRATCHPAD.md` — current.
- Report is modular: `3rd-Review/report/main.tex` (front matter + bib) + `chapters/01…07-*.tex`.
  Ch1, Ch2 drafted; Ch3–Ch7 are `% TODO (Phase N)` stubs. Assets: `pes_logo.png`; PDFs: `main.pdf`
  (skeleton), `main_ch1-2.pdf` (current).
- Build dir `/tmp/texbuild3` (report), `/tmp/diagbuild` (standalone diagrams). Copy chapters/ + arch_*.pdf into build each time.
- `arch_initial.tex/.pdf` + `arch_revised.tex/.pdf` in report dir (gotcha logged: never name a TikZ style `out` — collides with built-in key).
- Ch4 done (methodology + 2 arch diagrams). Ch5 done (impl + listings + placeholders). Preamble now also
  loads `listings` + a `\screenshotplaceholder` macro.
- PENDING screenshots: `screenshots/app_{onboarding_plan,session,home,week,replan,roadmap,roadmaps}.png`
  — captured by Playwright agent (prompt: `screenshot-capture-prompt.md`); then swap the 7
  `\screenshotplaceholder` calls in `chapters/05-implementation.tex` for `\includegraphics` and add
  `cp -r "$NEW/screenshots" "$B"/` to the build.

## Decisions in force
Full detail + rationale in [`DECISIONS.md`](./DECISIONS.md). One-liners:
- **D1** fresh rewrite, keep 7-chapter structure, replace content from current research.
- **D2** forward narrative (problem→lit→approach→build→results); real order was reverse; no fabrication.
- **D3** report real measured results; honesty-as-strength.
- **D4** **Pillar-A only**; Pillar-B → Phase-2 (lit trimmed, KT datasets/results out, → Future Work).
- **D5** scheduling reported but retirement framed as research-informed design decision; tuned CUSUM +
  conformal = validated follow-ups.
- **D6** best deployable model per component; oracle = baseline/ceiling (not winner); regenerate curated
  tables (don't `\input` winner `.tex`); report **pre & post refactor** regimes; scheduling pre-only.
- **D7 ✅** evolution as first-class research-informed design-refinement thread — dedicated "System
  Design & Evolution" section in Methodology + two architecture diagrams (initial packed-slot vs
  revised booking).
- **D8 ✅** app implementation evidence in Ch5 — ~6–7 annotated screenshots (onboarding/booking,
  session runtime, Home, Week burn-up, Replan, **Roadmap calendar**, **Roadmaps dashboard**);
  captured from running app; demo referenced if present.
- **D9 ✅** Pillar-A results basis = synthetic ground-truth (OULAD-calibrated) only + app as
  existence proof; real N=1 longitudinal → Phase-II.
- **D10 ✅** length target ~60 pages, un-padded; chapter proportions noted in DECISIONS.md.
- **D11 ✅** prose voice per REPORT_WRITING_GUIDE.md (Report-D register: roadmap paragraphs, 4-beat
  lit-review formula, honest-results pattern, hedge-with-reason, no AI tells / em-dashes).
- **Env/build ✅** compile in /tmp (mount create-only); edit via file tools; deliver PDF via present_files.
- **D12 ✅** modular LaTeX: main.tex (front matter + bib) + chapters/NN-name.tex via `\input`.
- **D13 ✅** illustrations: canonical formulas + schematic TikZ figures (captioned illustrative); redraw, don't copy papers.
- **Assumed:** A1 new `3rd-Review/report/` dir from 1st-review; A2 keep "Phase - 1" title; A3 keep
  `thebibliography`; A4 standalone-TikZ vector diagrams.

## Resolved (recent)
- Ch6 Results drafted from real research/results JSON (subagent-extracted); Ch4 detection reconciled to
  the actual candidate set (robust null); Ch7 + Pillar-B refs added. All 7 chapters drafted; 43pp/0 undefined/0 overfull.
- BUG (Rohit): Listing 5.1 split across a page and Table 5.3 (float) landed mid-listing → wrapped the
  listing in a `\linewidth` minipage (unbreakable) + pinned Table 5.3 with `[H]` right after. Fixed,
  verified. GOTCHAS: long `lstlisting`s can page-break and an adjacent float can interleave — wrap code
  in a minipage and use `[H]` (float pkg) for the following table; and `float=H` is NOT a valid listings
  placement (caused a "Missing }" fatal).
- Ch5 Implementation drafted (3 tables + CUSUM listing + 7 screenshot placeholders); 38pp/0 undefined; screenshot prompt handed off.
- Fig 4.1/4.2 overran the right margin (5-box rows ~20cm > ~16.5cm textwidth) → wrapped each inline
  tikzpicture in `\resizebox{\linewidth}{!}{...}` → now fit exactly, verified by re-render. GOTCHA:
  wide inline TikZ rows must be resized to `\linewidth` (applies to future chapters too).
- Ch4 Methodology drafted + 2 architecture diagrams built/verified + 2 inline figs; 32pp/0 undefined.
- Ch3 Requirements drafted (tables + FR/NFR); compiles 26pp/0 undefined.
- Ch2 illustrated (D13): 5 formulas + 5 schematic figures, visually verified; 24pp.
- Ch1 (Rohit) + Ch2 (Pillar-A survey) drafted; modularized (D12); compiles 22pp/0 undefined.
- Greenlit execution → PLAN.md + VERIFICATION.md written; scaffold compiles (17pp). Drafting started.
- Env check → sandbox compiles LaTeX (29pp real build, 0 undefined); edit via file tools; build in /tmp.
- OQ-4 length → ~60pp (D10 ✅); prose guide adopted (D11 ✅).
- OQ-3 empirical basis → synthetic ground-truth only for Phase-1; real N=1 → Phase-II (D9 ✅).
- OQ-2 app visuals → ~6–7 screenshots incl. Roadmap calendar + Roadmaps dashboard (D8 ✅).
- Q6 evolution prominence → dedicated "System Design & Evolution" section in Methodology, not a chapter (D7 ✅).
- Results "oracle wins" trap → oracle demoted to baseline; report best deployable + pre/post refactor (D6).
- Scope of "system" question → Pillar-A only settles it (D4).
- Honesty-level question → forward narrative + honest research findings + first-class evolution (D2/D3/D7).
