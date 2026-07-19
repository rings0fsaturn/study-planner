# UI Decisions — Desktop layout redesign (study-planner-web app)

<!--
  grill-me-with-mocks session. The app's screens are mobile-first single
  columns rendered in a desktop viewport; goal is to make deliberate use of
  horizontal space on large screens WITHOUT losing the editorial "Marginalia"
  feel. Append one entry per decision in dependency order.
-->

## Handoff summary

- **Screen(s):** The whole authenticated app — Home, Session (setup), Log, Week, Roadmaps (list), Roadmap (detail). Week and the Roadmap detail already use width well; Home / Session / Log are the mobile-column offenders.
- **Baseline mode:** A — refine known layouts (screens exist; reproduced from the running app + real design tokens).
- **Final working mock:** [`final.html`](./final.html) _(built once decisions land)_
- **Baseline mock:** [`baseline.html`](./baseline.html) — current Home at desktop width (the before-picture).
- **Design tokens:** real Marginalia tokens from `packages/design-tokens/src/tokens.css` (container widths: narrow 640 / default 880 / wide 1240).
- **Status:** in progress — Decision 01 locked (A, top-nav bento); Decision 02 (draggable/resizable dashboard) in flight.
- **Next step:** implementation plan → `.work/plans/active/<slug>/` once decisions complete.

Open branches not yet decided:

- Home dashboard customization: drag + resize + persistence + reset + mobile fallback (Decision 02 — in flight).
- Session-setup two-column layout.
- Log form on desktop (center card vs modal vs two-column).
- Roadmaps-list density.
- Responsive breakpoints (where each desktop layout collapses back to the mobile column).
- Library choice for grid (react-grid-layout vs dnd-grid vs gridstack) + React 19 compat verification.

---

## Decisions

### Decision 01 — Desktop shell frame

- **Date:** 2026-07-18
- **Question:** On large screens, how should the app use horizontal width, and what is the navigation model? This governs every page, so it is decided first.
- **Applies to baseline state:** initial baseline (current Home, 640px column).
- **Mock:** [`decisions/decision-01-desktop-shell.html`](./decisions/decision-01-desktop-shell.html)
- **Variations considered:**
  - **A —** Keep the top nav; replace the 640px column with a symmetric **bento dashboard** (~1200px) where all cards tile as equal-weight tiles. Lowest-risk evolution; mirrors nothing new architecturally (top nav stays).
  - **B —** Move nav into a persistent **left sidebar** app-shell; content goes truly wide. Most "product app" feel (Linear/Todoist), gives every page maximum room, but adds chrome and fights the calm editorial brand; larger refactor (NavBar → sidebar).
  - **C —** Keep the top nav; **primary working column + sticky right "this week" context rail** (~1160px). Asymmetric: the up-next hero and recent-activity list own the stage; secondary glance stats (streak, this-week, projected finish) live in a sticky rail. Preserves editorial calm while killing the dead margins.
- **Chosen:** **A** (top nav + symmetric bento dashboard, ~1200px).
- **Why:** User picked A and wants to push it further into a *user-customizable* dashboard (see Decision 02). Rejected B (left sidebar) — unneeded chrome for a 5-destination app. Rejected C (fixed primary+rail) — the equal-weight bento tiles are the right substrate for drag/resize customization, whereas C's fixed hierarchy fights per-user rearrangement. My original recommendation was C, overridden by the customization goal, which A serves better.
- **Folded into baseline:** yes (baseline Home → top-nav bento grid)

### Decision 02 — Make the Home dashboard user-customizable (drag + resize)

- **Date:** 2026-07-18
- **Question:** Should Home's bento cards be a *fixed* layout, or user-draggable + resizable within the grid, with the arrangement persisted per user? If customizable, which library, and what are the persistence / mobile / reset rules?
- **Applies to baseline state:** after Decision 01 (top-nav bento).
- **Mock:** [`decisions/decision-02-draggable-dashboard.html`](./decisions/decision-02-draggable-dashboard.html) — LIVE prototype (gridstack.js): drag by the grip, resize from edges, layout persists to localStorage, "Reset layout" restores default.
- **Variations considered:**
  - **A —** Fixed bento (Decision 01 as-is) — no customization.
  - **B —** Drag-to-reorder only (dnd-kit style) — cards swap positions, sizes fixed. Simpler, no resize.
  - **C —** Full drag + resize + persist (react-grid-layout / gridstack style) — user moves AND resizes tiles; layout saved per user; "Reset to default". **← what the user asked for; shown live in the mock.**
- **Library options (React 19):**
  - `react-grid-layout` — most mature for this exact use case; React 19 peer-dep friction → pin known-good version or use the `react-grid-layout-19` fork.
  - `dnd-grid` / snapgrid — modern RGL-style alternatives built on dnd-kit; better React ergonomics.
  - `gridstack.js` — framework-agnostic (no React-version risk), React wrapper available; used for the prototype because it runs standalone in one HTML file.
- **Chosen:** **C** — full drag + resize + per-user persistence.
- **Why:** User confirmed the live prototype feels right and said "move on." Rejected A (fixed) and B (reorder-only) — the whole point is a dashboard the user shapes, which needs resize, not just reordering.
- **Resolved sub-decisions (this turn):**
  - **Scope:** customization is **desktop + tablet only**. **Mobile falls back to the current fixed mobile layout** (single-column stack, drag/resize disabled). → drives Decision 03's breakpoint.
  - **Content must be size-responsive:** each card's *internal* layout adapts to the card's current size (container queries), so resizing never leaves broken/empty internals. → Decision 03.
  - **Grid rules:** per-widget min/max sizes + vertical compaction so there are no awkward gaps. → Decision 03.
- **Still open:**
  - Persistence store: `HomeLayoutChanged` event in per-user Dexie synced to Supabase (recommended) vs a Settings record.
  - Edit affordance: always-live via grip handle (prototype default) vs an explicit "Edit layout" toggle. Leaning always-live since dragging requires grabbing the grip; revisit if accidental moves show up.
  - Accessibility: keyboard reordering + reduced-motion.
  - Library: react-grid-layout vs dnd-grid vs gridstack-react (React 19 verify).
- **Folded into baseline:** yes (Home = customizable bento)

### Decision 03 — Grid rules + size-responsive card internals + breakpoint fallback

- **Date:** 2026-07-18
- **Question:** What are the concrete grid rules (min/max per card, compaction) that prevent awkward gaps, how does each card's *content* reflow to its size, and where does customization stop and the mobile layout take over?
- **Applies to baseline state:** after Decision 02 (customizable bento).
- **Mock:** [`decisions/decision-03-grid-rules-responsive.html`](./decisions/decision-03-grid-rules-responsive.html) — LIVE: resize cards to watch internals reflow (recent activity 2-col↔1-col, stats condense, streak shrinks); "Tidy up" compacts out gaps; narrow the browser < 768px to see the mobile fallback (single static stack).
- **Grid rules encoded:**
  - 12-column grid, `float:false` (cards pack upward → no vertical gaps).
  - Per-card min/max: up-next `min 4×2, max h4`; streak `min 3×2, max h3`; stat `min 2×1, max 6×2`; recent `min 4×2`. Stops cards being resized into broken proportions.
  - "Tidy up" control runs compaction; "Reset layout" restores default.
- **Content responsiveness (container queries per card):**
  - Recent activity: 2-column list when the card is wide, 1-column when narrow; trims rows when short.
  - Stat cards: big display number when roomy; condense label+value when small.
  - Streak: box size scales; day letters hide when very narrow.
  - Up-next: full meta + button when tall; condensed when short.
- **Breakpoint fallback:**
  - ≥ 768px (tablet + desktop): full 12-col drag/resize customization.
  - < 768px (mobile): collapse to single column, `setStatic(true)` (drag/resize off) → the current mobile stack.
- **Chosen:** _pending — user reviewing the live prototype_
- **Folded into baseline:** not yet
