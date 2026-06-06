# Study Tracker Web

A mobile-first responsive web app for self-directed learners. Two Vercel deployments under one apex domain: Astro marketing site (`studytracker.app/*`) + Vite React 19 SPA (`studytracker.app/study/*`).

**PRD:** [`prd/PRD-study-tracker-web.md`](prd/PRD-study-tracker-web.md) | **Issues:** [`issues/`](issues/)

## Tech Stack

pnpm 10, Astro 4, Vite 5, React 19, TypeScript 5.4, Supabase (auth + DB + storage), Dexie (IndexedDB), date-fns 4, Playwright, Vitest, Vercel, Marginalia design system.

## Commands

```bash
export FNM_PATH="$HOME/.local/share/fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env --shell bash)" && fnm use 22
export PNPM_HOME="$HOME/.local/share/pnpm" && export PATH="$PNPM_HOME:$PATH"

pnpm dev                               # Both apps (Astro :4321, Vite :5173)
pnpm dev:app                           # Vite only → http://localhost:5173/study/
pnpm build                             # Both apps
pnpm test:e2e                          # Playwright (4 suites)
pnpm --filter app test                 # Vitest unit tests (app)
pnpm --filter roadmap-engine test       # Vitest unit tests (roadmap-engine)
pnpm --filter progress test             # Vitest unit tests (progress)
pnpm lint && pnpm typecheck            # Lint + typecheck all packages
```

## Directory Map

| Path | Purpose |
|---|---|
| `apps/marketing/` | Astro marketing site; `vercel.json` rewrites `/study/*` → React app |
| `apps/app/src/auth/` | Auth deep module (AuthGate with DI), AuthProvider, ProtectedRoute |
| `apps/app/src/events/` | EventStore (Dexie per-user DB, v3 schema), ProgressEngine (deprecated) |
| `apps/app/src/progress/` | Progress hooks (useCalibrationState, useProgressSnapshot, usePromptDetail) |
| `apps/app/src/onboarding/` | 4-step onboarding wizard with draft persistence |
| `apps/app/src/sync/` | Cloud sync engine (write-ahead queue, snapshots, restore) |
| `apps/app/src/components/` | AppShell, NavBar, SyncIndicator, Field, Button, Card, Tag |
| `apps/app/src/lib/` | Supabase client, useMatchMedia hook |
| `apps/app/src/pages/` | SignIn, SignUp, Home, Log, Week, Roadmap, Roadmaps, Settings |
| `apps/app/supabase/migrations/` | SQL migrations (events table, storage buckets) |
| `packages/design-tokens/` | CSS tokens, component classes, reset/typography |
| `packages/progress/` | Pure progress tracking — Bayesian calibration, GP regression, streak, burn-up |
| `packages/roadmap-engine/` | Pure roadmap generation algorithm (no framework deps) |
| `e2e/` | Playwright: smoke, session-log, sync, onboarding specs |

## Routing

`BrowserRouter basename="/study"` — never include `/study` in `to` props. Vite `base: '/study/'`.

Provider nesting: `AuthProvider → EventStoreRouter → SyncRouter → AppRoutes`.

App routes wrapped in `ProtectedRoute + RequireOnboarding`. Onboarding routes wrapped in `ProtectedRoute + OnboardingGate`.

## Architecture References

Deep-dive docs live in `.claude/rules/`:

| Rule | Topic |
|---|---|
| [`auth-architecture.md`](.claude/rules/auth-architecture.md) | Auth module, DI pattern, routes |
| [`eventstore-architecture.md`](.claude/rules/eventstore-architecture.md) | Dexie schema (v3), tables, event shape, per-user isolation |
| [`onboarding-architecture.md`](.claude/rules/onboarding-architecture.md) | 4-step wizard, state persistence, completion events |
| [`sync-architecture.md`](.claude/rules/sync-architecture.md) | Write-ahead queue, snapshots, browser lifecycle, retry |
| [`roadmap-engine.md`](.claude/rules/roadmap-engine.md) | Roadmap generation API, types, role inference |
| [`supabase-schema.md`](.claude/rules/supabase-schema.md) | Events table, RLS policies, storage buckets |

## Project Rules

| Rule | Prevents |
|---|---|
| [`css-workspace-packages.md`](.claude/rules/css-workspace-packages.md) | CSS imports failing to resolve |
| [`playwright-config.md`](.claude/rules/playwright-config.md) | E2E config issues |
| [`astro-selectors.md`](.claude/rules/astro-selectors.md) | Selector strict mode violations |
| [`react-router-v7-basename.md`](.claude/rules/react-router-v7-basename.md) | Double basename prefixes |
| [`auth-testing-fakes.md`](.claude/rules/auth-testing-fakes.md) | Brittle Supabase mocks |
| [`form-design-spacing.md`](.claude/rules/form-design-spacing.md) | Collapsed form field groups |
| [`auth-init-timeout.md`](.claude/rules/auth-init-timeout.md) | React hanging on slow auth |
| [`eventstore-per-user-db.md`](.claude/rules/eventstore-per-user-db.md) | Cross-account data bleed |
| [`dexie-test-setup.md`](.claude/rules/dexie-test-setup.md) | Dexie test failures |
| [`dexie-schema-migration.md`](.claude/rules/dexie-schema-migration.md) | Data loss on schema changes |
| [`sync-provider-testing.md`](.claude/rules/sync-provider-testing.md) | Lifecycle hook test failures |
| [`latex-report-build.md`](.claude/rules/latex-report-build.md) | "latexmk not found"; broken dissertation builds |

## Environment Variables

`apps/app/.env.local` — template at `.env.example`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Related Docs

[`DEPLOYMENT.md`](DEPLOYMENT.md) | [`design/marginalia.html`](design/marginalia.html) | [`design/algo/ROADMAP_ENGINE_GUIDE.md`](design/algo/ROADMAP_ENGINE_GUIDE.md) | [`design/2026-04-29-onboarding-ui-ux-guide.md`](design/2026-04-29-onboarding-ui-ux-guide.md)

## Codebase Index Maintenance

Memory contains a codebase index (14 module files tracking 162+ source files). At session start, check for staleness:

1. Read `index-metadata.md` from memory for the last-indexed commit hash
2. Run: `git diff --name-only <hash>..HEAD -- 'apps/' 'packages/' 'e2e/'`
3. If output is non-empty, invoke `/update-index` to update affected module indexes
4. If the metadata file is missing, invoke `/update-index --full` for a full rescan

## E2E test

E2E test cannot be performed due to Environment issues, So only write the test dont try to run.