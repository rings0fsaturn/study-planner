# Handover — 3rd-Review dissertation report: expansion + polish

> **Date:** 2026-07-04 · **Owner:** Rohit (author) + Cowork (planner/drafter) · **Task folder:**
> `.work/plans/active/2026-07-03 third-review-report-work/`
> **State:** All 7 chapters DRAFTED. Report compiles clean — **44 pp, 0 undefined refs, 0 overfull >5pt**.
> 7 real app screenshots inserted. Latest PDF delivered to the outputs folder as `report_full_v2.pdf`.
> **Next session:** (A) expand toward ~60 pp, (B) final polish pass, (C) resolve the figure-provenance flag.

---

## 0. Entry point (do this first, in order)

1. Read **`DECISIONS.md`** (D1–D13) in the task folder — the canonical decision log. Do not re-derive; cite D-numbers.
2. Read **`SCRATCHPAD.md`** (task folder) — live state, gotchas, open items.
3. Skim this handover's §3 (build workflow) and §4 (LaTeX gotchas) — they will save you rebuilds.
4. Do one **confirmation build** (§3) to verify the report still compiles clean before editing.
5. Then start expansion (§5A) and/or polish (§5B).

The report is a fresh **Phase-1, Pillar-A** rewrite (the 1st-Review report is a separate, older artifact — do not edit it). Voice follows `college/mydeliverables/REPORT_WRITING_GUIDE.md` (Report-D register).

---

## 1. What the report is (from DECISIONS.md — quick recap)

- **D1** fresh rewrite, keep 7-chapter structure. **D2** forward narrative (problem→lit→approach→build→results); real order was app-first — narrative ordering only, nothing fabricated. **D3** report real measured results, honesty-as-strength. **D4** **Pillar-A only**; Pillar-B → Phase-2 (appears only in Ch7 Future Work). **D5** scheduling reported but its retirement framed as a research-informed design decision. **D6** best *deployable* model per component; **oracle = baseline/ceiling, never "winner"**; tables built from `research/results/*.json` (NOT the stale `generated/*.tex` winner tables); report **pre- and post-refactor** regimes. **D7** dedicated "System Design & Evolution" section in Ch4 + two architecture diagrams. **D8** ~6–7 app screenshots (done). **D9** synthetic ground-truth only; real N=1 → Phase-II. **D10** **~60-page target** (currently 44). **D11** prose voice per REPORT_WRITING_GUIDE. **D12** modular LaTeX (`main.tex` + `chapters/NN-*.tex` via `\input`). **D13** canonical formulas + schematic figures, captioned "illustrative".

---

## 2. File map

Report dir: `college/mydeliverables/3rd-Review/report/`

| File | What |
|---|---|
| `main.tex` | Preamble + front matter (title/cert/decl/ack/abstract) + TOC/LoF/LoT + `\input{chapters/…}` + `thebibliography` (30 Pillar-A refs + 9 Pillar-B refs cited only in Ch7). |
| `chapters/01-introduction.tex` | Rohit-drafted. Problem, objectives, scope, organization. |
| `chapters/02-literature-survey.tex` | Pillar-A survey (5 themes, 4-beat form) + model-sourcing methodology + summary table + 5 formulas/figures (prior→posterior, CUSUM, GP burn-up, predict-then-optimize, SRL loop). |
| `chapters/03-requirements.tex` | HW/SW tables + numbered FR-1..8 / NFR-1..6. |
| `chapters/04-methodology.tex` | Adaptive loop (Fig 4.1), candidate/selected + enriched-shrinkage eqn (4.1), comparison methodology (Fig 4.2), **System Design & Evolution** (Figs 4.3/4.4), architecture + client/server split. |
| `chapters/05-implementation.tex` | Dev-env table, datasets+OULAD table, model-impl table + CUSUM code listing, metrics/reproducibility, **7 app screenshots** (Figs 5.1–5.7). |
| `chapters/06-results.tex` | 4 component sections + discussion; tables from real JSON; oracle=ceiling; frozen+decoupled; coverage bar chart (Fig 6.1). |
| `chapters/07-conclusion.tex` | Phase-1 conclusions + Phase-II/Pillar-B future work. |
| `arch_initial.tex/.pdf`, `arch_revised.tex/.pdf` | Standalone-TikZ architecture diagrams (vector PDFs, `\includegraphics`-ed by Ch4). Rebuild with `pdflatex arch_*.tex`. |
| `screenshots/app_*.png` | 7 captures (onboarding_plan, session, home, week, replan, roadmap, roadmaps). |
| `pes_logo.png` | Title-page logo. |

Task-folder docs (`.work/plans/active/2026-07-03 third-review-report-work/`): `DECISIONS.md`, `PLAN.md`,
`VERIFICATION.md`, `SCRATCHPAD.md`, `screenshot-capture-prompt.md`, `capture-screenshots.mjs` (Playwright
script from the screenshot agent), and `research/01-…04-*.md` (the grounding research — read these to
expand honestly).

---

## 3. HOW TO EDIT + BUILD (critical — this is the workflow, follow it exactly)

**Editing** — use the file tools (Read/Write/Edit) on the host paths under
`.../college/mydeliverables/3rd-Review/report/`. Overwrite works. **Do NOT edit in the sandbox mount.**

**Compiling** — the repo mount is **create-only** (bash can create but not delete/overwrite files in it),
so **never build in the mounted repo**. Copy the report into a sandbox-local `/tmp` dir and compile there.
Full TeX Live is installed in the sandbox (`latexmk`, `pdflatex`, `pdftoppm` all on PATH). The mount prefix
`/sessions/<session>/mnt/…` is **session-specific** — get your exact path from the "Shell access" section of
your system prompt.

```bash
REPO="/sessions/<your-session>/mnt/study-planner-web"          # from your Shell-access mapping
RD="$REPO/college/mydeliverables/3rd-Review/report"
OUT="/sessions/<your-session>/mnt/outputs"                      # your outputs mount
B=/tmp/reportbuild; rm -rf "$B"; mkdir -p "$B"
cp -R "$RD"/. "$B"/                                             # copies main.tex, chapters/, arch_*.pdf, pes_logo.png, screenshots/
cd "$B"
latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex > build.log 2>&1; echo "exit=$?"
grep -a "Output written on main.pdf" build.log | tail -1        # page count
grep -c -i undefined main.log                                   # must be 0
grep -a "Overfull \\hbox" main.log | grep -oE "\([0-9.]+pt" | tr -d '(pt' | awk '$1>5{c++} END{print c+0}'  # overfull >5pt
cp "$B/main.pdf" "$OUT/report_latest.pdf"                       # deliver (present_files from outputs)
```

**Visual check** (you cannot judge figures/layout from source — rasterize and Read):
```bash
pdftoppm -png -r 115 -f <p1> -l <p2> "$B/main.pdf" "$OUT/pg" >/dev/null 2>&1   # PNGs land in the outputs mount
# then Read $OUT/pg-*.png with the Read tool (the image reader can reach the outputs folder, NOT /tmp)
```
Deliver PDFs/files to Rohit via `present_files` (from the outputs folder).

**Architecture diagrams** live as standalone files; to edit one: edit `arch_*.tex`, then
`pdflatex -interaction=nonstopmode arch_revised.tex` in a /tmp copy, rasterize + eyeball (3–6 passes;
see `college/mydeliverables/TIKZ_DIAGRAM_GUIDE.md`), copy the new `arch_*.pdf` back into the report dir.

---

## 4. LaTeX gotchas log (each of these already cost a rebuild — avoid)

- **Never name a TikZ style `out` or `step`** — they collide with built-in TikZ keys ("`/tikz/out` requires a value"). Use `outbox`, `lstep`, etc.
- **`float=H` is NOT valid for `lstlisting`** — caused a fatal "Missing }". To keep a listing from page-breaking, wrap it in `\begin{minipage}{\linewidth} … \end{minipage}`.
- **A float can interleave into a page-split listing.** Keep the listing in a minipage (above) and pin the following table with `[H]` (the `float` package is loaded). This is how Listing 5.1 / Table 5.3 were fixed.
- **Wide inline TikZ rows** (a row of boxes wider than ~16.5 cm text width) overrun the right margin → wrap the whole `tikzpicture` in `\resizebox{\linewidth}{!}{…}` (see Figs 4.1, 4.2).
- **Colors in chapter TikZ must be xcolor built-ins** (`blue!25`, `orange!12`, `black!45`, …) or defined in `main.tex`. `amber` is defined only in the standalone `arch_*.tex` — it is NOT available in the chapters (this caused "Undefined color `amber`").
- **Screenshots**: `\includegraphics[width=0.85\linewidth, height=0.42\textheight, keepaspectratio]{screenshots/app_X.png}` — caps BOTH dimensions so tall mobile shots and wide desktop shots both fit.
- **Harmless overfull**: one 2.6 pt line in Ch2 §2.3 (GP intro). Ignore; guide treats sub-line overfulls as acceptable.
- **Preamble already loads** (in `main.tex`): inputenc, fontenc, graphicx, booktabs, array, enumitem, float, caption, subcaption, amsmath, amssymb, tikz (+arrows.meta/positioning/calc), pgfplots (compat=1.18, +fillbetween), listings, hyperref, geometry. A `\screenshotplaceholder` macro is defined but now unused (safe to leave/remove). References are a hand-maintained `thebibliography` (no `.bib`/biber — see `.claude/rules/latex-report-build.md`), numbered by first citation.

---

## 5. Next-session work

### A. Expansion 44 → ~60 pp (D10) — must stay honest + grounded (D2/D3); pull facts from `research/01–04` and `research/results/`

Where the room is, and concrete additions:

- **Ch2 (Literature Survey):** deepen each theme's mechanism/gap paragraphs; optionally add papers (more Pillar-A candidates exist in `research/03-*` and the raw DOI lists under `college/mydeliverables/zero/literatures/`). The change-detection literature memo `research/doc/2026-06-20-change-detection-literature-survey.md` (KSWIN/MMD, DDM/HDDM/RDDM, e-detectors) can expand §2.2 — note its refs are NOT yet in the bibliography.
- **Ch4 (Methodology):** expand the comparison-methodology subsection — the 9 learner archetypes, the held-out split rationale, bootstrap-CI and Holm/BH mechanics; expand the enriched-shrinkage feature vector (10 context features: role, time-of-day, day-of-week, deadline proximity, planned progress, recency, …) and the dual-prior ensemble (REALITY/FROZEN priors, leave-one-out weighting) — see `research/01-*` §3.6.
- **Ch5 (Implementation):** most headroom. Expand the dataset section (synthetic-generator parameters; OULAD calibration detail); the golden-fixture parity harness (72 progress + 27 roadmap fixtures, `rel_tol=1e-6`); the EventStore/event model and sync (see `research/01-*` §4).
- **Ch6 (Results):** add more methods to each table (many were extracted — see §6), add per-regime side-by-side, and add 1–2 more figures **built from the JSON numbers** (e.g., detection latency-vs-false-alarm, calibration MAE-by-band) — keep them consistent with the tables (do NOT reuse the stale `generated/` figures; see §5C). Expand the discussion.
- **Ch1/Ch3/Ch7:** modest additions only.

### B. Final polish pass (against VERIFICATION.md global gate)
- Voice per D11/REPORT_WRITING_GUIDE: no em-dashes (use "-"), no AI tells ("It is important to note", triadic adjectives, stacked connectives), 4-beat lit entries, chapter-opening roadmap paragraphs, consistent capitalization ("machine learning" lowercase, proper model names capitalized).
- Cross-refs resolve (0 undefined); every figure/table has caption + label + a numbered in-text reference; bibliography numbered in citation order.
- Consider spawning a **review subagent** for an independent read-through (keeps the raw text out of main context).

### C. Open flags
- **Figure-provenance mismatch:** the pre-generated figures in `1st-Review/report/generated/` were built from dataset hash `e716cd12dddc` (n3600); the Ch6 numbers come from `research/results/*.json` (`21c2cdabfa91` frozen n5400, `9e6d48db2da8` decoupled n5400, `3b404c903563` scheduling n3600). Ch6 was built from the JSON and the stale figures were NOT reused. If any old figure must be canonical, regenerate it from the same run (`make figs` in `research/`). Keep building Ch6 visuals from the JSON.

---

## 6. Results numbers already extracted (so you don't re-read raw JSON in main context)

The Ch6 tables already contain the headline numbers. **The results JSONs are ~80k chars each and blow the token budget if catted directly — delegate extraction to a subagent** (point it at
`research/results/{calibration,calibration_decoupled,detection,detection_decoupled,projection,projection_decoupled,scheduling}/*.json` and ask for a compact table; that is how this session got the numbers). Meta: 200 seeds, held-out archetypes, N=5400 (calibration/detection/projection), N=3600 (scheduling); bootstrap CIs + Holm/BH.

Compact snapshot of what's available (frozen regime unless noted):

- **Calibration — recovery MAE (small/medium/long):** oracle 0/0/0; enriched_shrink 0.049/0.049/0.056; hierarchical_bayes (incumbent) 0.079/0.046/0.026; archetype_soft 0.047/0.048/0.055; sma 0.094/0.100/0.090; ewma 0.115/0.124/0.107; kalman ≈0.14. Enriched−incumbent on **context_pred_mae** (prospective; negative favours enriched): −0.015/−0.026/−0.030, Holm-wins 11/12 (frozen), 12/12 (decoupled). Story: honest null on recovery MAE (structured variants ≈ incumbent; incumbent best at long), real win for enriched on prospective + short histories.
- **Detection — latency / false-alarm (step; drift):** cusum 1.43/0.312; 1.36/0.296. csd 5.16/0.083; 4.10/0.049. page_hinkley 3.03/0.149; 2.39/0.139. ewma 11.95/0.039; 10.68/0.024. bocpd 30.6/0.009; 19.4/0.011. ADWIN never fires. Robust null; CUSUM fastest; shipped (human-confirmed prompt).
- **Projection — coverage frozen / decoupled (nominal 0.95); point MAE days:** short GP 0.438/0.494, conformal 0.969/0.989, MAE 2.15 d; medium GP 0.291/0.277, conformal 0.990/0.988, MAE 9.45 d; long GP 0.187/0.183, conformal 0.937/0.988, MAE 20.2 d (frozen)/39.5 d (decoupled). gp_plus_analytic improves cold-start coverage (e.g. short 0.19→0.44). Conformal fixes coverage, validated but not shipped.
- **Scheduling — deadline drift dp_capacity vs greedy:** anchor 1.73 vs 3.11; +foundation 2.35 vs 3.65; +practice 3.91 vs 5.94; +foundation+practice 8.30 vs 38.98 (Δ −30.93 [−31.70,−30.19]). dp_capacity wins (huge on full mix); retired by design (D5). ortools/CP-SAT upper bound was skipped (not installed).

---

## 7. Git state (read-only note — Cowork cannot commit)

- The whole `college/mydeliverables/3rd-Review/` tree and the task-folder planning docs (`DECISIONS.md`, `PLAN.md`, `VERIFICATION.md`, `SCRATCHPAD.md`, `screenshot-capture-prompt.md`, `capture-screenshots.mjs`) are **untracked/uncommitted**. Also `research/04-*.md` modified and `research/SCRATCHPAD-research-2.md` deleted from a prior session.
- **Native-side Step 0:** commit the report + docs so later diffs are meaningful. **Never run mutating git in Cowork** (`.claude/rules` / project rule: the sandbox can't unlink lock files → bricks the repo).

## 8. Reference docs
- Decisions/plan/verification/scratchpad: task folder (see §2).
- Research grounding: `research/01-app-architecture-and-data-flow.md`, `02-research-to-app-mapping.md`, `03-research-to-literature-mapping.md`, `04-application-evolution-trace.md` (task folder).
- Style: `college/mydeliverables/REPORT_WRITING_GUIDE.md`, `TIKZ_DIAGRAM_GUIDE.md`.
- Build: `.claude/rules/latex-report-build.md`, `.claude/rules/flow-diagram-tikz-gen.md`.
- Status index: `.work/STATUS.md` (dissertation row).
