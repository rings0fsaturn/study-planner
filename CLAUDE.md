# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Application test Credentials
Can be found in `.work/specs/test-login-cred.txt`

# Study Tracker Web

A mobile-first responsive web app for self-directed learners, plus a Python "intelligence" tier and an M.Tech dissertation. Three deployable surfaces:

- **Astro marketing site** — `studytracker.app/*`
- **Vite/React 19 SPA** — `studytracker.app/study/*` (the app; served via `vercel.json` rewrite `/study/*` → React app)
- **FastAPI Intelligence Service** — Pillar-A adaptation engines (calibration/progress/roadmap) over HTTP on `:8000`, JWT-verified against Supabase

**PRD:** [`.work/specs/prd/PRD-study-tracker-web.md`](.work/specs/prd/PRD-study-tracker-web.md) | **Issues:** [`.work/specs/issues/`](.work/specs/issues/) | **Status index:** [`.work/STATUS.md`](.work/STATUS.md) (read first)

## Tech Stack

**JS/TS:** pnpm 10 (Node ≥20, `fnm use 22`), Astro 4, Vite 5, React 19, TypeScript 5.4, Supabase (auth + DB + storage), Dexie (IndexedDB), date-fns 4, Playwright, Vitest + fast-check, Vercel, Marginalia design system.

**Python:** uv workspace, Python 3.12, FastAPI + uvicorn, PyJWT, numpy, pytest, ruff. Research tier adds pyBKT and KT-bench models.

## Monorepo layout

Two overlapping workspaces share one repo:

- **pnpm workspace** (`pnpm-workspace.yaml`) — `apps/*` + `packages/*` (the TS/JS side).
- **uv workspace** (`pyproject.toml`) — `packages/py-progress`, `packages/py-roadmap-engine`, `services/intelligence`, `research/comparison` (the Python side).

The TS packages `@study-tracker/progress` and `@study-tracker/roadmap-engine` are **pure client-side engines**; `py-progress` / `py-roadmap-engine` are their **Python mirrors** exposed to the app over HTTP via the Intelligence Service. Keep the two implementations behaviorally aligned when changing either.

## Commands

```bash
# Shell setup (Node + pnpm on PATH)
export FNM_PATH="$HOME/.local/share/fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env --shell bash)" && fnm use 22
export PNPM_HOME="$HOME/.local/share/pnpm" && export PATH="$PNPM_HOME:$PATH"

# --- Frontend (JS/TS) ---
pnpm dev:full                          # Intelligence Service + Vite app (recommended); waits for :8000/health then boots :5173/study/
pnpm dev                               # Both frontends only (Astro :4321 + Vite :5173), no Python service
pnpm dev:app                           # Vite only → http://localhost:5173/study/
pnpm dev:marketing                     # Astro only → http://localhost:4321
pnpm dev:intelligence                  # FastAPI service only (uvicorn, :8000)
pnpm build                             # Build both frontends (build:app / build:marketing for one)
pnpm lint && pnpm typecheck            # Lint + typecheck all pnpm packages

# --- Unit tests (Vitest) ---
pnpm --filter @study-tracker/app test          # app tests
pnpm --filter @study-tracker/roadmap-engine test
pnpm --filter @study-tracker/progress test
pnpm --filter @study-tracker/app test -- <path/to/file.test.ts>   # single file
pnpm --filter @study-tracker/app test:watch    # watch mode

# --- E2E (Playwright) — always pass -c ---
pnpm test:e2e                          # all suites
pnpm exec playwright test -c e2e/playwright.config.ts <spec> --project=app   # single spec

# --- Python (uv) ---
uv run pytest                          # all Python tests (packages + service + research)
uv run pytest packages/py-progress/tests            # one package
uv run --package intelligence uvicorn app.main:app --reload --port 8000   # service directly
uv run ruff check .                    # lint (E, F, I, UP)

# --- Research comparison / KT-bench (Makefile) ---
make dataset                           # generate synthetic dataset
make compare                           # calibration comparison (also compare-detection/-projection/-scheduling)
make figs                              # regenerate all comparison figures
make kt                                # KT-bench training/coldstart/calibrate pipeline
make all                               # dataset → all comparisons → figures
```

### Intelligence Service auth

`/v1/*` endpoints verify Supabase access JWTs. `pnpm dev:intelligence` / `dev:full` require **`SUPABASE_JWT_SECRET`** (the Supabase project JWT secret — *not* the anon/publishable or service-role key) plus `SUPABASE_URL`, set in the shell or `services/intelligence/.env`. For projects on asymmetric signing keys (ES256/RS256), `SUPABASE_URL` is used to fetch the JWKS. See [`README.md`](README.md) and [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Directory Map

| Path | Purpose |
|---|---|
| `apps/marketing/` | Astro marketing site; `vercel.json` rewrites `/study/*` → React app |
| `apps/app/src/auth/` | Auth deep module (AuthGate with DI), AuthProvider, ProtectedRoute |
| `apps/app/src/events/` | EventStore (Dexie per-user DB, v3 schema); `ProgressEngine.ts` (deprecated) |
| `apps/app/src/progress/` | Progress hooks (`useCalibration`, `useProgress`, `usePromptDetail`, `mapEvents`) |
| `apps/app/src/roadmap/` | Roadmap calendar UI, booking/edit/replan flows, lifecycle, draft, progress |
| `apps/app/src/session/` | Study-session runtime: SessionLifecycle, Pomodoro, YouTube player adapter, notifications, chime |
| `apps/app/src/onboarding/` | 4-step onboarding wizard with IndexedDB draft persistence |
| `apps/app/src/sync/` | Cloud sync engine (write-ahead queue, snapshots, restore) |
| `apps/app/src/lib/` | Supabase client, `intelligenceClient` (typed fetch to the service), DurabilityHooks, useMatchMedia |
| `apps/app/src/dev/` | Dev-only seeding (DevSeeder, seedTestData) |
| `apps/app/src/components/` | AppShell, NavBar, SyncIndicator, Field, Button, Card, Tag |
| `apps/app/src/pages/` | SignIn, SignUp, Home, Log, Week, Roadmap, Roadmaps, Settings |
| `apps/app/supabase/migrations/` | SQL migrations (events table, storage buckets) |
| `packages/design-tokens/` | CSS tokens, component classes, reset/typography (Marginalia) |
| `packages/progress/` | Pure TS progress engine — Bayesian calibration, GP regression, streak, burn-up |
| `packages/roadmap-engine/` | Pure TS roadmap generation algorithm (no framework deps; Vitest + fast-check) |
| `packages/py-progress/` | Python mirror of the progress engine (Bayesian calibration, CUSUM, GP projection); ships `openapi.yaml` |
| `packages/py-roadmap-engine/` | Python mirror of the roadmap engine |
| `services/intelligence/` | FastAPI service (`app/main.py`, routers `calibration`/`progress`/`roadmap`, JWT security, rate limiting) |
| `research/` | Research knowledge base — `comparison/` (research-comparison uv pkg), `kt-bench/`, `datasets/`, `results/`, `doc/` |
| `college/mydeliverables/` | LaTeX M.Tech dissertation and review deliverables |
| `e2e/` | Playwright: smoke, session-log, sync, onboarding, roadmap-booking-live specs |

## Routing

`BrowserRouter basename="/study"` — **never** include `/study` in `to`/`navigate` values (see `react-router-v7-basename` rule). Vite `base: '/study/'`.

Provider nesting: `AuthProvider → EventStoreRouter → SyncRouter → AppRoutes`.

App routes wrapped in `ProtectedRoute + RequireOnboarding`. Onboarding routes wrapped in `ProtectedRoute + OnboardingGate`.

## Rules — `.claude/rules/*.md` (canonical)

The hard-won gotchas live in **`.claude/rules/*.md`** (canonical). Two mirrors exist and must stay 1:1 in sync when a rule changes:

- Claude Code reads `CLAUDE.md` + `.claude/rules/<name>.md`.
- Codex reads `AGENTS.md` + `.agents/rules/<name>.agents.md`.
- **`.cursor/rules/*.mdc` and `.opencode/` are legacy/dead — do not edit or trust them.**

Read the relevant rule before changing that area, and cite it by name in plans.

| Rule | Topic / Prevents |
|---|---|
| `auth-architecture` | Auth module, DI pattern, routes |
| `auth-testing-fakes` | Brittle Supabase mocks (use hand-written fakes) |
| `auth-init-timeout` | React hanging on slow auth (500ms timeout) |
| `eventstore-architecture` | Dexie schema (v3), tables, event shape |
| `eventstore-per-user-db` | Cross-account data bleed (per-user DB isolation) |
| `dexie-schema-migration` | Data loss on schema changes |
| `dexie-test-setup` | Dexie test failures (fake-indexeddb, unique DB names) |
| `sync-architecture` | Write-ahead queue, snapshots, browser lifecycle, retry |
| `sync-provider-testing` | Lifecycle hook test failures (prototype spies, manual dispatch) |
| `onboarding-architecture` | 4-step wizard, state persistence, completion events |
| `roadmap-engine` | Roadmap generation API, types, role inference |
| `supabase-schema` | Events table, RLS policies, storage buckets |
| `fetch-typed-error-normalization` | Typed fetch errors leaking as raw `AbortError`/`TypeError`; jsdom `DOMException` masking the bug |
| `css-workspace-packages` | CSS imports failing to resolve |
| `form-design-spacing` | Collapsed form field groups (design-token spacing) |
| `astro-selectors` | Playwright strict-mode violations vs Astro dev toolbar |
| `react-router-v7-basename` | Double `/study` basename prefixes |
| `playwright-config` | E2E config issues (`webServer` at top level, always `-c`) |
| `pnpm-build-registry` | Corepack 403/DNS on public npm (use `COREPACK_NPM_REGISTRY`) |
| `docker-colima-setup` | Docker/Colima builds, corporate registry + CA, port forwarding |
| `latex-report-build` | "latexmk not found"; TinyTeX PATH for the dissertation |
| `flow-diagram-tikz-gen` | Building vector-PDF architecture diagrams via standalone TikZ |
| `ieee-conference-class-setup` | Wrong `IEEEtran` class options; conference-mode command lockouts |
| `ieee-conference-authoring` | Author-block/section formatting mistakes in IEEE conference mode |
| `ieee-conference-equations` | `eqnarray` misuse; `subequations` equation-counter skips |
| `ieee-conference-figures-tables-citations` | Label-before-caption; wrong caption placement; uncompressed citations |

## Environment Variables

`apps/app/.env.local` (template `apps/app/.env.example`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_INTELLIGENCE_URL` (defaults to `http://localhost:8000`), optional `VITE_INITIAL_RESTORE_TIMEOUT_MS` (defaults to `8000`). E2E hermetic specs also read `SUPABASE_SERVICE_ROLE_KEY`.

`services/intelligence/.env`: `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, optional `CORS_ORIGINS`.

## E2E test

E2E **can** be run by the agent in this environment. Boot the Vite app dev server (`pnpm --filter @study-tracker/app dev` → http://localhost:5173/study/, needs `COREPACK_NPM_REGISTRY=https://registry.npmjs.org`); Supabase env is in `apps/app/.env.local` and Chromium is installed. Run with `pnpm exec playwright test -c e2e/playwright.config.ts <spec> --project=app`.

- Hermetic specs create throwaway users via `SUPABASE_SERVICE_ROLE_KEY` (auto-skip if unset).
- The real-login spec `e2e/roadmap-booking-live.spec.ts` signs in with a dev account (`E2E_LIVE_EMAIL`/`E2E_LIVE_PASSWORD`), seeds locally, and abandons its roadmap to stay tidy.

Author E2E for new UI flows and run them to verify before marking a phase done.

## Related Docs

[`README.md`](README.md) | [`DEPLOYMENT.md`](DEPLOYMENT.md) | [`design/marginalia.html`](design/marginalia.html) | [`design/algo/ROADMAP_ENGINE_GUIDE.md`](design/algo/ROADMAP_ENGINE_GUIDE.md) | [`design/2026-04-29-onboarding-ui-ux-guide.md`](design/2026-04-29-onboarding-ui-ux-guide.md)

## Codebase Index Maintenance

Memory contains a codebase index (module files tracking source files). At session start, check for staleness:

1. Read `index-metadata.md` from memory for the last-indexed commit hash
2. Run: `git diff --name-only <hash>..HEAD -- 'apps/' 'packages/' 'services/' 'e2e/'`
3. If output is non-empty, invoke `/update-index` to update affected module indexes
4. If the metadata file is missing, invoke `/update-index --full` for a full rescan

<!-- ============================================================= -->
<!-- BEGIN .work/ working-directory guide (mirror of AGENTS.md)     -->
<!-- ============================================================= -->

## The `.work/` working directory  ·  read `.work/STATUS.md` first

The project's planning/specs/working-memory live in **`.work/`** at the repo root. Full
human map: [`.work/README.md`](.work/README.md) — folder map, the planner/developer/verifier
flow, and the ceremony dial (trivial/normal/complex).

**`.work/` is committed to git on purpose — do not break that.** It used to be lost when
git's `git clean -fdx` deleted ignored/untracked files; `.work/` is now **tracked**, so
`git clean` can't touch it. **Never add `.work/` to `.gitignore`, and never run
`git clean -fdx` at the repo root.** Cleanup after finishing a task is a **manual** step
(see `.work/README.md`).

<!-- END .work/ working-directory guide -->
