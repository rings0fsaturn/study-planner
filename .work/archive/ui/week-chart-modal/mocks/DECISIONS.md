# UI Decisions - interactive Week chart modal

## Handoff summary

- **Screen:** The burn-up chart on `/study/week`, opened from the existing "Hours studied vs plan" card.
- **Baseline mode:** A - refine the existing Week layout.
- **Final working mock:** [`final.html`](./final.html) will be created after the decision tree is resolved.
- **Baseline mock:** [`baseline.html`](./baseline.html)
- **Status:** In progress - 4 decisions made, with viewport-fit behavior, clickable checkpoint summaries, and readable chart axes confirmed as settled requirements.
- **Next step:** Confirm the corrected date anchors in [`baseline.html`](./baseline.html), then continue to the projection-layer controls.
- **Fidelity correction:** On 2026-07-18, the mock chart was rebuilt against the live `BurnUpChart.tsx` geometry and the supplied screenshot after the user rejected the first approximation.

Settled before grilling:

- The existing Week page remains the context around the chart.
- Clicking the burn-up chart opens a modal.
- The modal preserves the current planned, actual, confidence, today, and deficit meanings.
- The visual language remains Marginalia.

Open branches not yet decided:

- Projection-layer controls.
- Close, focus, keyboard, and reduced-motion behavior.

---

## Decisions

### Decision 01 - modal purpose

- **Date:** 2026-07-18
- **Question:** What job should the opened chart modal help the learner do?
- **Applies to baseline state:** Initial `/study/week` baseline with click-to-modal settled.
- **Mock:** [`decisions/decision-01-modal-purpose.html`](./decisions/decision-01-modal-purpose.html)
- **Variations considered:**
  - **A - Magnify only:** Enlarge the current chart without introducing new analysis.
  - **B - Inspect the trajectory:** Select dates to compare actual, planned, gap, and logged sessions.
  - **C - Progress lab:** Explore time ranges and model layers, test a pace scenario, and enter replanning from the modal.
- **Chosen:** **C - Progress lab**
- **Why:** The user found the richer workspace interesting and explicitly asked to proceed with a functional version.
  A was rejected as too limited for an interactive modal.
  B's date-inspection value remains useful and can be incorporated into C without reducing the modal to inspection alone.
- **Folded into baseline:** yes

### Baseline fidelity correction

- **Date:** 2026-07-18
- **Trigger:** The user rejected the mock graph because it did not resemble the original Week chart closely enough.
- **Correction:** Every active mock now preserves the original 9h 30m scale, full 63-day domain, compressed first eight days, planned staircase, actual and projected lines, confidence and behind fills, Today marker, future shading, Marginalia palette, and chart-card header, verdict, and legend.
- **Scenario behavior:** The default graph opens unchanged.
  The moss scenario is absent until the pace slider moves away from zero.
- **Decision impact:** Decision 01 remains C - Progress Lab.
  Decision 02 remains open at the time of this correction.

### Decision 02 - workspace organization

- **Date:** 2026-07-18
- **Question:** How should chart exploration and pace simulation share the Progress Lab modal?
- **Applies to baseline state:** Progress Lab with the corrected original burn-up chart and optional exploration tools.
- **Mock:** [`decisions/decision-02-workspace-organization.html`](./decisions/decision-02-workspace-organization.html)
- **Variations considered:**
  - **A - Always-on rail:** Keep model layers, pace scenario, result, and replan action visible beside the chart.
  - **B - Task tabs:** Separate trajectory inspection and pace simulation into two task-focused panels.
  - **C - Chart-first drawer:** Give the chart maximum space and reveal the workbench from a collapsible drawer.
- **Chosen:** **A - Always-on rail**
- **Why:** The user said A was good after reviewing the corrected functional comparison.
  It keeps the relationship between chart changes and controls immediately visible without introducing another navigation layer.
- **Folded into baseline:** yes

### Decision 03 - chart discoverability

- **Date:** 2026-07-18
- **Question:** How should the Week chart signal that it opens Progress Lab?
- **Applies to baseline state:** Progress Lab with the corrected burn-up chart and the selected always-on control rail.
- **Mock:** [`decisions/decision-03-chart-discoverability.html`](./decisions/decision-03-chart-discoverability.html)
- **Variations considered:**
  - **A - Hover cue:** Lift the whole card and reveal an "Open Progress Lab" cue on pointer hover or keyboard focus.
  - **B - Header icon:** Keep a persistent expand icon beside the day count.
  - **C - Footer action:** Add a dedicated action row below the existing verdict and legend.
- **Chosen:** **A - Hover cue**
- **Why:** The user preferred the quiet affordance that preserves the original card at rest.
  Keyboard focus receives the same cue and elevation as pointer hover.
- **Folded into baseline:** yes

### Settled responsive requirement - viewport-fit modal

- **Date:** 2026-07-18
- **Requirement:** The complete Progress Lab must fit within the current viewport without modal or document scrolling.
- **Desktop behavior:** The selected always-on rail remains beside a chart that expands or contracts to the remaining modal height.
- **Compact behavior:** The control rail moves below the chart as a dense two-column control deck.
  The chart receives the remaining flexible height and scales its SVG without cropping.
- **Short-viewport behavior:** Header, range bar, rail spacing, explanatory copy, and result presentation become denser while all controls and the chart remain visible.
- **Folded into baseline:** yes

### Settled interaction requirement - clickable checkpoints

- **Date:** 2026-07-18
- **Requirement:** Every actual-progress dot is an interactive checkpoint rather than a decorative chart mark.
- **Pointer behavior:** Clicking a dot selects it, adds a visible selection ring, and opens a compact summary in the unused future-chart area.
- **Keyboard behavior:** Each dot is focusable and activates with Enter or Space.
- **Summary content:** Date, cumulative actual time, cumulative planned time, gap, and a one-sentence interpretation of what changed.
- **Responsive behavior:** The summary scales down inside the chart on compact screens without changing the no-scroll modal contract.
- **Folded into baseline:** yes

### Bug correction - modal interaction scope and clipped action

- **Date:** 2026-07-18
- **Trigger:** The user reported that the Week card's magnifying cursor leaked into the modal, the chart dots did nothing, and the scenario action appeared clipped.
- **Correction:** The zoom cursor and hover elevation are now scoped only to the Week-page chart opener.
  The modal chart uses a normal cursor except for clickable checkpoint targets.
  The compact breakpoint now activates for short viewports up to 720px high, and the scenario action remains inside its section with verified bottom clearance.

### Decision 04 - range navigation

- **Date:** 2026-07-18
- **Question:** How should the learner change the visible time window without making Progress Lab feel busy?
- **Applies to baseline state:** Corrected original chart, selected always-on rail, viewport-fit modal, and clickable checkpoint summaries.
- **Mock:** [`decisions/decision-04-range-navigation.html`](./decisions/decision-04-range-navigation.html)
- **Variations to choose from:**
  - **A - Fixed presets:** Full plan, 30 days, and This week are always one tap away.
  - **B - Timeline scrubber:** A continuous horizon control allows an arbitrary visible end date.
  - **C - Zoom stepper:** Plus and minus controls move among week, month, and full-plan scales.
- **Recommendation:** **A - Fixed presets.**
  It preserves the quiet Marginalia character, is immediately understandable, remains compact on narrow screens, and covers the useful planning windows without exposing chart mechanics.
- **Functional checks:** Each variation changes the chart domain and date labels.
  All six checkpoint dots remain pointer and keyboard accessible.
  Browser checks passed at 1440x900, 1024x600, and 390x844 with zero document, modal, chart-body, or rail overflow.
- **Chosen:** **A - Fixed presets**
- **Why:** The user said A was fine after reviewing the functional comparison.
  Fixed presets preserve the full-plan context while giving direct access to a 30-day view and a detailed This week view.
- **Folded into baseline:** yes

### Bug correction - observed-period X-axis anchors

- **Date:** 2026-07-18
- **Trigger:** After choosing Decision 04 A, the user reported that the X axis showed only distant future dates, so the actual-progress points had no clear date reference.
- **Reproduction:** The full-plan mock exposed only `Jul 01` and `Aug 01` while all six observed points occurred between `Jun 07` and `Jun 15`.
- **Correction:** Every observed point now has an aligned X-axis tick.
  Wide charts label the observed dates as `Jun 07`, `09`, `11`, `13`, `14`, and `15`, with the crowded `14` label staggered onto a second row in the full-plan view.
  Observed ticks use the rust accent and darker text to visually connect them to the rust actual-progress line.
- **Compact behavior:** Full-plan and 30-day views retain labelled `Jun 07` and `Jun 15` anchors plus rust minor ticks for the intermediate observations.
  The This week preset expands the observed period and labels every checkpoint date.
- **Y-axis behavior:** The existing cumulative-hour ticks from `0m` through `9h 30m` remain visible in every range.
- **Interaction correction:** Non-interactive SVG paths no longer intercept pointer events, so the Jun 15 checkpoint remains clickable through the Today marker.
- **Verification:** Browser checks passed for full-plan, 30-day, and This week ranges at 1440x900, the short 1024x600 viewport, and the 390x844 phone viewport.
  Automated geometry checks found no X-axis label collisions in the full-plan desktop view, and the modal, body, and rail reported zero internal overflow.
- **Folded into baseline:** yes
