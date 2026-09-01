# Mocks — material/session decoupling redesign

Static, dependency-free HTML mocks that render with the **real** Marginalia
design-system CSS (copied verbatim into `css/`). Purpose: see exactly how each
redesigned screen will look **before** implementation, and keep a faithful
"current state" baseline to compare against.

## Layout

- **`css/`** — verbatim copies of the live stylesheets, so a mock looks identical
  to the running app. Source files (do **not** edit here — re-copy if they change upstream):
  - `tokens.css` ← `packages/design-tokens/src/tokens.css`
  - `global.css` ← `packages/design-tokens/src/global.css`
  - `components.css` ← `packages/design-tokens/src/components.css`
  - `onboarding.css` ← `apps/app/src/onboarding/onboarding.css`
  - `swap.css` ← `apps/app/src/onboarding/components/swap.css`
  - `roadmap.css` ← `apps/app/src/roadmap/roadmap.css`
  - `session.css` ← `apps/app/src/session/session.css`
- **`baseline/`** — frozen snapshots of the screens **as they are today**. These do
  not change; they're the "before" reference so that, post-implementation, the diff
  between current and new is exactly what we mocked here.
- **`proposed/`** — the **evolving** mocks. These start as copies of the baseline and
  get updated as each decision (`D13+` in `../DECISIONS.md`) is locked. This is where
  "see it in realtime" happens.
- **`index.html`** — launcher linking baseline ↔ proposed for each screen.

## Screens

| Screen | Source components | Baseline | Proposed |
|---|---|---|---|
| Onboarding page 3 | `onboarding/steps/Step3Materials.tsx` + `Step3Preview.tsx` | `baseline/onboarding-3.html` | `proposed/onboarding-3.html` |
| Home | `pages/Home.tsx` | `baseline/home.html` | `proposed/home.html` |
| Session | `pages/Session.tsx` + `session/components/*` | `baseline/session.html` | `proposed/session.html` |
| Roadmap | `pages/Roadmap.tsx` + `roadmap/RoadmapCalendar.tsx` | `baseline/roadmap.html` | `proposed/roadmap.html` |

## Conventions

- Pure HTML/CSS; no build step, no JS framework. Minimal vanilla JS only where an
  interaction is essential to judging the design (e.g. the session dial).
- Fonts load from Google Fonts (same `@import` as `global.css`).
- Mocks are a **visual contract** for the eventual `PLAN.md`; they are not wired to
  data and intentionally hard-code representative content.
