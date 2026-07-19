# Screenshot capture task — Study Tracker app (for dissertation Ch5)

**Goal:** Capture 7 screenshots of the running Study Tracker web app and save them as PNGs into
`college/mydeliverables/3rd-Review/report/screenshots/` using the **exact filenames** below. These are
figures for the M.Tech dissertation's Implementation chapter. **Do not modify any app/source/config code.**

## Setup (follow the repo rules)
- Repo root: `/Users/rsaji/projects/1/college-mtech/study-planner-web`.
- Boot the full app: `./full-app start full` — starts the FastAPI intelligence service at
  `http://127.0.0.1:8000` and the Vite app at `http://localhost:5173/study/`. See
  `.claude/rules/playwright-full-app-lifecycle.md`. If pnpm/corepack complains about the registry, use
  `COREPACK_NPM_REGISTRY=https://registry.npmjs.org`.
- Verify before browsing: `curl -i http://127.0.0.1:8000/health` and `curl -i http://localhost:5173/study/sign-in`.
- Sign in with the dev account in `.work/specs/test-login-cred.txt`. That account has a seeded **"Tests"
  roadmap** with logged sessions — use it so dashboards show real data. **Do not abandon or complete it.**
  If any view looks empty, populate data with the dev seeder (`window.__seed()` / DevSeeder) before capturing.
- Router basename is `/study` (all routes are under `/study/...`). Chromium is installed; use
  `pnpm exec playwright ... -c e2e/playwright.config.ts --project=app` conventions or a standalone script.

## Capture settings
- Viewport **1280×800**, `deviceScaleFactor: 2` (crisp text). If a screen is clearly mobile-first and
  reads better narrow, a **430×932** viewport is fine for that one screen — pick the cleaner result.
- Capture the **viewport** (above the fold); use full-page only if key content is cut off.
- **Wait for content to finish loading** (calibration/projection and charts load asynchronously) before
  the shot. Hide any dev toolbar/overlay. Capture **app content only** (no browser chrome).

## Screens (exact output filenames)
1. `app_onboarding_plan.png` — onboarding plan preview (`/study/onboarding/3/preview`): the generated
   booking plan/calendar after entering a deadline, weekly hours, and ≥1 material. (If re-running
   onboarding on the seeded account is impractical, use the "plan next roadmap" entry from `/study/roadmaps`.)
2. `app_session.png` — session runtime (`/study/session`): an **active** study session with the
   timer/Pomodoro UI. The pre-session material picker is an acceptable fallback.
3. `app_home.png` — Home dashboard (`/study/home`): up-next card, streak, stat tiles (pace multiplier +
   projection), recent activity, with data present.
4. `app_week.png` — Week view (`/study/week`): verdict banner, stat tiles, the daily-minutes chart and
   the burn-up chart.
5. `app_replan.png` — Replan (`/study/replan`): the adjust-plan levers (extend deadline / hours-per-day
   + study days / shorten-drop materials) and the projected finish.
6. `app_roadmap.png` — Roadmap calendar (`/study/roadmap`): the month-grid calendar with bookings for
   the active roadmap.
7. `app_roadmaps.png` — Roadmaps dashboard (`/study/roadmaps`): active roadmap hero, any draft, and history.

## Definition of done
- All 7 PNGs exist in `college/mydeliverables/3rd-Review/report/screenshots/` with the exact names above.
- Each shows populated, representative data (no empty states), readable text, app content only.
- Report which (if any) could not be captured and why.
- The seeded "Tests" roadmap is left intact.
