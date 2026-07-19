# PLAN — 3rd-Review (Phase-1, Pillar-A) dissertation report

> **Type:** report-drafting plan (checklist). **Owner/executor:** Cowork drafts the `.tex` directly
> (the dissertation under `college/mydeliverables/**` is Cowork's writable surface). **Started:** 2026-07-03.
> **Canonical decision log:** [`DECISIONS.md`](./DECISIONS.md) (D1–D11) — *this plan does not restate
> rationale; each checklist item cites the D-number that governs it.* **Working memory:**
> [`SCRATCHPAD.md`](./SCRATCHPAD.md). **Acceptance criteria:** [`VERIFICATION.md`](./VERIFICATION.md).
> **Source material:** `research/01…04-*.md`; generated results in `research/results/*` and
> `college/mydeliverables/1st-Review/report/generated/`; prose voice `REPORT_WRITING_GUIDE.md` (D11);
> figures `TIKZ_DIAGRAM_GUIDE.md`.

## Operating manual (read before executing)

- **Output location:** new `college/mydeliverables/3rd-Review/report/` (D1/A1); the submitted
  `1st-Review/report/` stays untouched. Title stays "Project Phase - 1" (A2).
- **Build workflow (verified 2026-07-03):** edit `.tex` via the file tools (host-backed; overwrite
  works). **Compile only in a sandbox-local `/tmp/texbuild` dir** — the repo mount is create-only, so
  never build in-place. Deliver `.tex` + PDF via `present_files` at each milestone. Keep `/tmp/texbuild`
  persistent across the session.
- **Division of labour:** Cowork writes all prose, LaTeX, tables, and the TikZ diagrams. **Two
  artifacts need a running app / pipeline** and are handed off (Phase 10): app **screenshots** and the
  **regenerated curated result tables** (from `research/results/*.json`). Cowork inserts labelled
  placeholders for these so the report compiles and the native side/coding agent fills them.
- **Step 0 (native side):** commit `DECISIONS.md`, `SCRATCHPAD.md`, `PLAN.md`, `VERIFICATION.md` and
  the report scaffold before further work, so later diffs are meaningful (Cowork cannot commit).
- **Review discipline:** each phase is checked against its `VERIFICATION.md` criteria; a phase is not
  done until its box is ticked there. Compile after every chapter — a chapter that breaks the build is
  not done.

## Global guardrails (apply to every phase)

- [ ] **Pillar-A only** in the body; Pillar-B appears **only** in Ch7 Future Work (D4).
- [ ] **Forward narrative** (problem → literature → approach → build → results) — no changelog voice (D2).
- [ ] **Real, honest results**; oracle is a **baseline/ceiling**, never the "winner" (D3/D6).
- [ ] **Prose voice per D11** — roadmap paragraphs, 4-beat lit formula, honest-results pattern,
      hedge-with-reason, no AI tells, **no em-dashes as punctuation** (use "-").
- [ ] Every figure/table has `\caption` + `\label` + a numbered in-text `\ref`/`\cref`.
- [ ] Build stays clean (0 undefined refs) after each phase.

## Phases (checklist)

### Phase 0 — Scaffold + skeleton compile ☐  *(Decisions: D1, A1, A2, build workflow · Accept: VERIFICATION §P0)*
- [ ] Create `3rd-Review/report/main.tex` (preamble + front matter + Pillar-A abstract + 7 chapter stubs).
- [ ] Copy assets (`pes_logo.png`) into the report dir and `/tmp/texbuild`.
- [ ] Compile skeleton clean in `/tmp/texbuild` (0 undefined). Deliver skeleton `.tex` + PDF.

### Phase 1 — Ch1 Introduction ☐  *(D2, D4 · Accept: VERIFICATION §P1)*
- [ ] Problem statement (self-directed learners), motivation, objectives (Pillar-A), scope (Phase I
      open-loop; Phase II teased), report organization (roadmap naming section numbers).

### Phase 2 — Ch2 Literature Survey (Pillar-A) + model-sourcing ☐  *(D4, D11 · Accept: VERIFICATION §P2)*
- [ ] §2.1 Pillar-A themes: pace/Bayesian calibration, change detection, GP projection, scheduling, SRL
      — every entry uses the 4-beat formula (attribution+artifact → mechanism → number → gap).
- [ ] §2.x model-sourcing methodology (DOI candidates → scoring → curation) from `research/03-*`.
- [ ] Summary-of-approaches table (Pillar-A rows only); limitations; proposed-solution framing.
- [ ] Complete the Pillar-A `thebibliography` (order of first citation); Pillar-B refs deferred to Ch7.

### Phase 3 — Ch3 System Requirements ☐  *(D1 · Accept: VERIFICATION §P3)*
- [ ] Hardware/software (current stack: React/Vite/Dexie client; Python/FastAPI intelligence service;
      Supabase); functional + non-functional requirements as numbered IDs.

### Phase 4 — Ch4 Proposed Methodology + System Design & Evolution ☐  *(D5, D7 · Accept: VERIFICATION §P4)*
- [ ] Candidate models per component (calibration/detection/projection/scheduling) and the selected approach.
- [ ] Comparison methodology: synthetic ground-truth generator, OULAD-calibrated regime, held-out
      archetype splits, bootstrap CIs, Holm/BH correction (from `research/02-*`).
- [ ] **Dedicated "System Design & Evolution" section** (D7): predict-then-optimize base (`islam2024`)
      → constraint-packing limitation → re-research on revised regime → capacity-based booking; anchored
      by the two diagrams (Phase 5). Reference both diagrams by number.
- [ ] System-architecture prose describing the revised design + honest client/server execution split.

### Phase 5 — Two TikZ architecture diagrams ☐  *(D7, TIKZ_DIAGRAM_GUIDE · Accept: VERIFICATION §P5)*
- [ ] `fig-arch-initial` (predict-then-optimize, packed-slot, old `Slot` datatype).
- [ ] `fig-arch-revised` (capacity-based booking, 3-tier honest client/server split; closed loop
      **dashed** = Phase-II; Pillar-B excluded). Rasterize + eyeball each per the guide (3–6 passes).

### Phase 6 — Ch5 Implementation ☐  *(D8, D9 · Accept: VERIFICATION §P6)*
- [ ] Dev environment + tools/libraries table.
- [ ] Datasets & sources: synthetic generator (+ OULAD-calibrated realism), ground-truth structure (D9).
- [ ] Model implementation (shipped engines + research harness); evaluation metrics defined.
- [ ] App build section with **~6–7 annotated screenshot placeholders** (onboarding→booking, session
      runtime, Home, Week burn-up, Replan, **Roadmap calendar**, **Roadmaps dashboard**) (D8).

### Phase 7 — Ch6 Results & Discussion ☐  *(D6, D9 · Accept: VERIFICATION §P7)*
- [ ] Curated **deployable-method** comparison tables per component; oracle as baseline/ceiling row.
- [ ] **Pre- vs post-refactor** regime columns; state models transfer; scheduling pre-refactor only.
- [ ] Discussion in the honest-results pattern (number → adjective → mechanism → named factor); tuned
      CUSUM + conformal framed as validated follow-ups.

### Phase 8 — Ch7 Conclusion & Future Work ☐  *(D4, D9 · Accept: VERIFICATION §P8)*
- [ ] Phase-1 conclusions; Phase II = close the loop + Pillar-B assessment-based verification + real
      N=1 longitudinal validation. Pillar-B literature cited here (only).

### Phase 9 — Build-dependent handoffs ☐  *(D6, D8 · Accept: VERIFICATION §P9)*
- [ ] Spec (for native side / coding agent): capture the ~6–7 screenshots from the running app;
      regenerate curated result tables from `research/results/*.json` (decoupled + frozen regimes).
- [ ] Replace placeholders once artifacts land.

### Phase 10 — Final compile + quality gate + deliver ☐  *(D10, D11 · Accept: VERIFICATION §P10)*
- [ ] Full compile clean; **~60 pages**; 0 undefined refs; all cross-refs resolve.
- [ ] Voice pass per D11 (grep for AI tells / em-dashes); Pillar-B absent from body; oracle-as-baseline
      confirmed; both diagrams + pre/post tables present.
- [ ] Deliver final `.tex` bundle + PDF via `present_files`.
