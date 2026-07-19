# UI Decisions — Progress Lab pace indicators redesign

<!--
  grill-me-with-mocks session. Reframes the Progress Lab "Try a pace" panel and
  the green scenario line so the three different "finish" dates (Planned, GP
  forecast, Pace scenario) are each labelled, discoverable, and the green line
  connects honestly to the GP projection.
-->

## Handoff summary

- **Screen:** Progress Lab modal (`/study/week` → "Open Progress Lab"). The burn-up chart + right-rail "Try a pace" panel. Real components: `apps/app/src/components/ProgressLabModal.tsx`, `BurnUpChart.tsx`, `apps/app/src/roadmap/replan/capacityScenario.ts`.
- **Baseline mode:** A — refine a known layout (the modal already exists; source read and mirrored in the mock).
- **Final working mock:** `final.html` (not built yet)
- **Baseline mock:** [`baseline.html`](./baseline.html) — the current "before" screen, with the three problems flagged inline.
- **Status:** in progress — Decision 01 (agreed) + Decision 02 (chosen: B, narrative). Decision 03 (crosshair coordinate cursor) up next.
- **Next step:** implementation plan under `.work/plans/active/` once mocks are settled. This supersedes the pace/scenario portions of `.work/plans/active/2026-07-18-week-progress-lab/` (Decisions D-06/D-07 there).

### The problem being solved (from the reported bug)

1. Moving the pace slider draws an "awkward" near-vertical green line that is visually disconnected from the GP projection — it starts at the **raw actual** value (~18h) while the GP line at Today sits higher, and it compresses ~37h of gain into ~11 days so it spikes.
2. The green line is not explainable: `pointerEvents="none"`, no scenario checkpoints, no legend entry, no hover.
3. The rail shows a single "Scenario finish" which at **Current pace** is the **capacity-model** finish (`capacityScenario.ts:58`, optimistic — assumes full planned hours every remaining study day), **not** the GP forecast. So the number the user sees (e.g. "Aug 5") disagrees with the model's real forecast without explaining why.

Target: distinguish and label three finishes — **Planned** (follow the slots → deadline), **GP forecast** (your demonstrated pace → realistic date), **Pace scenario** (+N min/day → adjusted date) — and re-model the green as an honest forward projection.

Open branches not yet decided:

- Chart line treatment + green↔GP connection + on-chart finish markers
- Legend discoverability (likely folded into the crosshair readout)

> Note: `baseline.html` is kept as the pristine "before" (the problem statement). Each decision mock rebuilds the full modal with prior winners already folded in, so the accumulating design lives in the decision mocks and, at the end, in `final.html`.

---

## Decisions

### Decision 01 — Re-model the green line as a forward pace projection (agreed in chat)

- **Date:** 2026-07-19
- **Question:** Should the green scenario line keep the current capacity-fill math (interpolate today's actual → full planned total, reached on the capacity finish date), or be re-modelled as an honest forward projection from today's actual at the boosted daily rate?
- **Applies to baseline state:** initial baseline
- **Mock:** decided in words (no visual variations needed); its *rendering* is Decision 03.
- **Options considered:**
  - **A —** Forward pace projection: start at today's actual, add `(hoursPerStudyDay × 60 + slider delta) × demonstrated throughput` per study day until the total is reached; slope = projected pace. **← chosen**
  - **B —** Keep capacity math, only anchor the start to the GP value + add polish.
  - **C —** Discoverability only, leave geometry.
- **Chosen:** **A**
- **Why:** A fixes anchor gap, spike, and meaning together, and it's directly comparable to the GP mean line (both are forward projections from Today). At +0 the projection reflects the demonstrated pace, so it lines up with the GP forecast — which is exactly the "connect green with GP" the user wanted. B leaves the spike; C leaves both the spike and the disconnect. Cost: rewrites `capacityScenario.ts`; Replan shares it, so finish-date parity must be re-verified.
- **Folded into baseline:** pending (baseline still shows the OLD line as the "before"; the new line appears in every decision mock from 02 onward).

### Decision 02 — Prediction / finish panel presentation

- **Date:** 2026-07-19
- **Question:** How should the rail present the three different finish dates — Planned (follow the slots → deadline), GP forecast (demonstrated pace → realistic date), and Pace scenario (+N min/day)?
- **Applies to baseline state:** after Decision 01 (new forward-projection green in chart)
- **Mock:** [`decisions/decision-02-prediction-panel.html`](./decisions/decision-02-prediction-panel.html)
- **Variations considered:**
  - **A —** Three-row finish stack: one row per finish with a swatch matching its chart line, dates right-aligned, bottom row slider-driven.
  - **B —** Plain-language narrative: the same three facts as sentences ("Stick to your slots → Aug 10 … at your pace → ≈ Aug 27, 17 days late … +15 min → Aug 18"). **← chosen**
  - **C —** Finish timeline strip: a mini Aug 1–31 axis with three flags showing the gaps between deadline, forecast, and your pace.
- **Chosen:** **B**
- **Why:** The user chose the narrative for its readability — it states each finish in the user's own terms and makes the "you're tracking late, here's what closes the gap" story explicit, rather than making the reader assemble it from a table. A stays available as the compact form; C's spatial "gap" intuition is a candidate to steal onto the chart (finish markers, Decision 03+). Rejected A/C as the primary because scanning three prose lines is fine at this density and the narrative carries the causal framing better.
- **Folded into baseline:** yes (narrative panel is the fixed rail context in Decision 03's mock).

### Decision 03 — Crosshair coordinate cursor (open)

- **Date:** 2026-07-19
- **Question:** The chart is only interactive at the actual checkpoints and the X-axis is mostly blank. User wants the whole plot interactive: a cursor crosshair projecting to both axes (date on X, hours on Y) plus the value on each line (planned grey, actual/GP red, scenario green) at the hovered date. What exactly renders on hover?
- **Applies to baseline state:** after Decision 02
- **Mock:** [`decisions/decision-03-crosshair-cursor.html`](./decisions/decision-03-crosshair-cursor.html)
- **Variations considered:**
  - **A —** Coordinate crosshair only: vertical + horizontal guide from cursor to both axes, with a live date pill on X and hours pill on Y. No per-line values.
  - **B —** Coordinate crosshair + per-line readout: same guides, plus a dot on each visible line at the hovered date (grey/red/green) and a compact readout box listing each series' value. (matches the request most directly)
  - **C —** Snap-to-date card: vertical guide snaps to the nearest date; a tooltip card lists Planned / Actual-or-GP / Your pace for that exact day (cleanest numbers, but snaps instead of free-following).
- **Chosen:** _pending user pick_
- **Folded into baseline:** pending
