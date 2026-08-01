# UI Decisions - Progress Lab pace indicators redesign

<!--
  grill-me-with-mocks session. Reframes the Progress Lab "Try a pace" panel and
  the green scenario line so the three different "finish" dates (Planned, GP
  forecast, Pace scenario) are each labelled, discoverable, and the green line
  connects honestly to the GP projection.
-->

## Handoff summary

- **Screen:** Progress Lab modal (`/study/week` → "Open Progress Lab"). The burn-up chart + right-rail "Try a pace" panel. Real components: `apps/app/src/components/ProgressLabModal.tsx`, `BurnUpChart.tsx`, `apps/app/src/roadmap/replan/capacityScenario.ts`.
- **Baseline mode:** A - refine a known layout (the modal already exists; source read and mirrored in the mock).
- **Final working mock:** [`final.html`](./final.html) - Option X (Current pace = forecast, no green line at 0; +N draws the capacity line)
- **Baseline mock:** [`baseline.html`](./baseline.html) - the current "before" screen, with the three problems flagged inline.
- **Status:** complete - Decisions 01-04 + Option X settled; `final.html` built; plan + handoff written.
- **Next step:** implement per [`.work/plans/active/2026-07-19-progress-lab-pace-indicators/PLAN.md`](../../../plans/active/2026-07-19-progress-lab-pace-indicators/PLAN.md) (+ `HANDOFF.md`, `VERIFICATION.md`). Layers on the shipped `2026-07-18-week-progress-lab` modal.

### The problem being solved (from the reported bug)

1. Moving the pace slider draws an "awkward" near-vertical green line that is visually disconnected from the GP projection - it starts at the **raw actual** value (~18h) while the GP line at Today sits higher, and it compresses ~37h of gain into ~11 days so it spikes.
2. The green line is not explainable: `pointerEvents="none"`, no scenario checkpoints, no legend entry, no hover.
3. The rail shows a single "Scenario finish" which at **Current pace** is the **capacity-model** finish (`capacityScenario.ts:58`, optimistic - assumes full planned hours every remaining study day), **not** the GP forecast. So the number the user sees (e.g. "Aug 5") disagrees with the model's real forecast without explaining why.

Target: distinguish and label three finishes - **Planned** (follow the slots → deadline), **GP forecast** (your demonstrated pace → realistic date), **Pace scenario** (+N min/day → adjusted date) - and re-model the green as an honest forward projection.

Open branches not yet decided:

- Chart line treatment + green↔GP connection + on-chart finish markers
- Legend discoverability (likely folded into the crosshair readout)

> Note: `baseline.html` is kept as the pristine "before" (the problem statement). Each decision mock rebuilds the full modal with prior winners already folded in, so the accumulating design lives in the decision mocks and, at the end, in `final.html`.

---

## Decisions

### Decision 01 - Re-model the green line as a forward pace projection (agreed in chat)

- **Date:** 2026-07-19
- **Question:** Should the green scenario line keep the current capacity-fill math (interpolate today's actual → full planned total, reached on the capacity finish date), or be re-modelled as an honest forward projection from today's actual at the boosted daily rate?
- **Applies to baseline state:** initial baseline
- **Mock:** decided in words (no visual variations needed); its *rendering* is Decision 03.
- **Options considered:**
  - **A -** Forward pace projection: start at today's actual, add `(hoursPerStudyDay × 60 + slider delta) × demonstrated throughput` per study day until the total is reached; slope = projected pace. **← chosen**
  - **B -** Keep capacity math, only anchor the start to the GP value + add polish.
  - **C -** Discoverability only, leave geometry.
- **Chosen:** **A**
- **Why:** A fixes anchor gap, spike, and meaning together, and it's directly comparable to the GP mean line (both are forward projections from Today). At +0 the projection reflects the demonstrated pace, so it lines up with the GP forecast - which is exactly the "connect green with GP" the user wanted. B leaves the spike; C leaves both the spike and the disconnect. Cost: rewrites `capacityScenario.ts`; Replan shares it, so finish-date parity must be re-verified.
- **Folded into baseline:** pending (baseline still shows the OLD line as the "before"; the new line appears in every decision mock from 02 onward).

### Decision 02 - Prediction / finish panel presentation

- **Date:** 2026-07-19
- **Question:** How should the rail present the three different finish dates - Planned (follow the slots → deadline), GP forecast (demonstrated pace → realistic date), and Pace scenario (+N min/day)?
- **Applies to baseline state:** after Decision 01 (new forward-projection green in chart)
- **Mock:** [`decisions/decision-02-prediction-panel.html`](./decisions/decision-02-prediction-panel.html)
- **Variations considered:**
  - **A -** Three-row finish stack: one row per finish with a swatch matching its chart line, dates right-aligned, bottom row slider-driven.
  - **B -** Plain-language narrative: the same three facts as sentences ("Stick to your slots → Aug 10 … at your pace → ≈ Aug 27, 17 days late … +15 min → Aug 18"). **← chosen**
  - **C -** Finish timeline strip: a mini Aug 1-31 axis with three flags showing the gaps between deadline, forecast, and your pace.
- **Chosen:** **B**
- **Why:** The user chose the narrative for its readability - it states each finish in the user's own terms and makes the "you're tracking late, here's what closes the gap" story explicit, rather than making the reader assemble it from a table. A stays available as the compact form; C's spatial "gap" intuition is a candidate to steal onto the chart (finish markers, Decision 03+). Rejected A/C as the primary because scanning three prose lines is fine at this density and the narrative carries the causal framing better.
- **Folded into baseline:** yes (narrative panel is the fixed rail context in Decision 03's mock).

### Decision 03 - Crosshair coordinate cursor (open)

- **Date:** 2026-07-19
- **Question:** The chart is only interactive at the actual checkpoints and the X-axis is mostly blank. User wants the whole plot interactive: a cursor crosshair projecting to both axes (date on X, hours on Y) plus the value on each line (planned grey, actual/GP red, scenario green) at the hovered date. What exactly renders on hover?
- **Applies to baseline state:** after Decision 02
- **Mock:** [`decisions/decision-03-crosshair-cursor.html`](./decisions/decision-03-crosshair-cursor.html)
- **Variations considered:**
  - **A -** Coordinate crosshair only: vertical + horizontal guide from cursor to both axes, with a live date pill on X and hours pill on Y. No per-line values.
  - **B -** Coordinate crosshair + per-line readout: same guides, plus a dot on each visible line at the hovered date (grey/red/green) and a compact readout box listing each series' value. (matches the request most directly)
  - **C -** Snap-to-date card: vertical guide snaps to the nearest date; a tooltip card lists Planned / Actual-or-GP / Your pace for that exact day (cleanest numbers, but snaps instead of free-following).
- **Chosen:** **B** - coordinate crosshair + per-line values (grey/red/green dots + a readout box). Matches the request directly; the free hours-pill reads the cursor height, the readout reads each line's value at the hovered date.
- **Folded into baseline:** yes

### Decision 04 - Clear end-date representation

- **Date:** 2026-07-19
- **Question:** Lines ran off the right edge - two finishes (GP forecast and current-pace scenario, ≈ Aug 27) fell *past* the old domain end (Aug 22), so the chart felt "un-ending." How do we show a clear end date?
- **Applies to baseline state:** after Decision 03
- **Mock:** [`decisions/decision-04-end-dates.html`](./decisions/decision-04-end-dates.html)
- **Shared fix (all variations):** extend the full-plan domain to the last finish (~Aug 30) and CLIP each trajectory where it reaches the total (no flat run-off), plus a faint "done zone" tint above the total line.
- **Variations considered:**
  - **A -** Goal line + finish flags: a horizontal "Plan complete · 55h 40m" line with a dated pin where each trajectory lands. **← chosen**
  - **B -** End-cap date chips: each line ends in a coloured date chip, no goal line.
  - **C -** Axis finish markers: dated pennants tying each end down to the X-axis timeline.
- **Chosen:** **A** (open to adding C's axis date-pills as an enhancement).
- **Why:** The literal finish line the trajectories land on answers "un-ending" most directly. B reads as a mere label; C crowds on the right where the finishes cluster. The domain extension to ~Aug 30 was confirmed as an intended change.
- **Folded into baseline:** yes

### Replan-impact review (grounding for the plan)

- **Shared surface:** only `apps/app/src/roadmap/replan/capacityScenario.ts`. Importers: `ProgressLabModal.tsx:13`, `Replan.tsx:24` (+ their tests). Not Home / RoadmapCalendar / session (false hits on generic `.points`).
- **Replan reads only `.finishDate`** - `Replan.tsx:222` (`newFinish`, rendered `:495`) - plus `parsePaceDeltaMinutes` (`:109`, folded into hours `:187`). It never reads `.points`. (`projectFinish` at `Replan.tsx:83` is the GP helper, a different module.)
- **Decisions 02 / 03 / 04 + the GP-forecast readout: zero Replan impact** (chart + rail + `gpCurve` only).
- **Decision 01 (reshape green `.points`): no Replan behavior change**, but shared file → update `capacityScenario.test.ts` point assertions (44-45); keep Replan finish-parity test green (`Replan.test.tsx:184-203`).
- **Fork that WOULD touch Replan** - making +0 / current-pace reflect *demonstrated* pace (so it equals the GP forecast) changes `finishDate` math:
  - **Option X (recommended):** keep `finishDate` math unchanged; source "current pace / forecast" from the GP curve; +N green keeps existing capacity math. Replan untouched (regression-check only). Parity holds by construction (`H·60+δ` folded into hours = same finish).
  - **Option Y:** re-anchor to demonstrated pace. `finishDate` changes → Replan live finish + `Replan.test.tsx:184-203` + `capacityScenario.test.ts:42-43,65` all update.
- **Rationale for X:** Replan is a *commitment* tool ("if I commit to H hours/day I finish here" - capacity is correct); the modal's +0 is a *forecast* ("at my actual pace I'm tracking here" - the GP's job). Keep them distinct rather than forcing one model to do both.
- **Chosen:** **Option X** (user, 2026-07-19) - forecast sourced from `ProgressSnapshot.projection`; `capacityScenario.ts` / `Replan.tsx` untouched; their tests stay green as the proof. Captured as plan decision D-07.
