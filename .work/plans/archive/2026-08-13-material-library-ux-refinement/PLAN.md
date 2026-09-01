# PLAN — 2026-08-13 Material Library UX refinement (wayfinder #33 follow-up)

## Context

- Wayfinder ticket **#33 Prototype: Material Library and Attachment UX** (Phase 2 map #4) was built and closed 2026-08-12 with grilling rounds Q1–Q8 settled.
- On 2026-08-13 the HITL grilling continued through Q9–Q22 and every open interaction decision is now locked.
- This plan refines the throwaway prototype to match, records the decisions in `.work/`, the wayfinder map (GitHub #4 + local mirror), and the prototype issue #33, then verifies.

## Locked decisions (2026-08-13)

| # | Decision |
|---|---|
| Q1 | Library layout = card grid |
| Q2 | Practice-this = primary but compact on ready materials |
| Q3 | Status inline only when not ready |
| Q4 | Picker = bottom sheet (mobile) / side panel (desktop) |
| Q5 | Stale = warning badge + manual Regenerate dependent questions |
| Q6 | Referenced delete = allowed with strong warning |
| Q7 | Archived hidden in pickers |
| Q8 | Create = single screen with source-type cards |
| Q9 | Responsive hybrid density: compact desktop cards, spacious mobile single-column |
| Q10 | Card content priority = title → source/time meta → actionable status → usage |
| Q11 | Empty state = context-aware (first-material vs filtered-out) |
| Q12 | Detail entry = hybrid: card/title opens detail + explicit View action |
| Q13 | Detail = readiness-led; primary action by state (Practice/Retry); usage + destructive lower |
| Q14 | Mobile picker = persistent footer with selected count + Continue |
| Q15 | Practice-this config = dedicated page |
| Q16 | Card actions = primary + overflow menu (archive/replace/delete) |
| Q17 | Picker readiness = non-ready disabled in assessment/practice pickers |
| Q18 | Non-ready material open = detail (not dead-end) |
| Q19 | Archive/restore = library filter + detail restore |
| Q20 | Replace keep-ID = inline replacement mode on detail |
| Q21 | Delete warning = permanent source removal first, then affected list |
| Q22 | Planning boundary = contentless materials stay attachable for roadmap planning; ready-only for generation pickers |

## Scope

- `apps/app/src/prototype/material-library/MaterialLibraryPrototype.tsx` — apply decisions, drop losing layout variants and variant-choice UI, keep URL-driven `?view=` states.
- `apps/app/src/prototype/material-library/material-library.css` — canonical grid, overflow menu, picker sheet, responsive density.
- `.work/plans/active/2026-08-13-material-library-ux-refinement/PLAN.md` + `VERIFICATION.md`.
- `.work/STATUS.md` — active row + `last_updated`.
- `.work/active/map` — local wayfinder mirror: material library decision row + ticket refs.
- GitHub: map issue #4 decision line + prototype issue #33 follow-up comment.

## Non-goals

- No production Material Library implementation (GitHub ticket #36 owns that; #33 unblocks it).
- No edits to unrelated working-tree changes (`App.tsx`, `RoadmapCalendar.tsx`, etc.).
- No commit unless the user asks.

## Verification

- `pnpm --filter app typecheck` and `pnpm --filter app lint` clean.
- Browser render checks (desktop + mobile): library, detail, processing, failed/retry, archive/restore, stale, delete confirm, picker sheet, Practice-this.
- Keyboard + accessible labels on cards, menus, picker rows.
- Zero console errors.
