# Adaptive Study Planning - Code Submission

This folder contains the source code needed to run the Study Tracker full application for the Phase-1 third review.
It includes the Astro marketing site, the React study app, the FastAPI Intelligence Service, shared TypeScript packages, shared Python packages, tests, fixtures, and runtime scripts.

## What Is Included

- `apps/marketing` - Astro marketing site.
- `apps/app` - Vite React app served under `/study`.
- `apps/app/supabase` - Supabase migration and Edge Function source files.
- `packages/design-tokens` - shared CSS design tokens.
- `packages/progress` - TypeScript progress and calibration package.
- `packages/roadmap-engine` - TypeScript roadmap engine package.
- `packages/py-progress` - Python progress and calibration package.
- `packages/py-roadmap-engine` - Python roadmap engine package.
- `services/intelligence` - FastAPI Intelligence Service.
- `scripts` and `full-app` - local full-stack lifecycle scripts.
- `e2e` and `tests/fixtures` - browser tests and parity fixtures.
- Root workspace files such as `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `pyproject.toml`, and `uv.lock`.

Generated files and local machine state are intentionally excluded.
This includes `node_modules`, `dist`, Python caches, `.env`, `.env.local`, `.git`, virtual environments, and review/report artifacts.

## Prerequisites

- Node.js 20 or newer.
- pnpm 10.
- Python 3.12 or newer.
- `uv` for Python dependency management.
- A Supabase project if you want to sign in and use authenticated app flows.

Install pnpm with Corepack:

```bash
corepack enable
corepack prepare pnpm@10 --activate
```

Install `uv` from the official installer:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Setup

Run these commands from this `code-submit` directory:

```bash
pnpm install
uv sync
```

Create the React app environment file:

```bash
cp apps/app/.env.example apps/app/.env.local
```

Edit `apps/app/.env.local`:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon-or-publishable-key>
VITE_INTELLIGENCE_URL=http://127.0.0.1:8000
```

Create the Intelligence Service environment file:

```bash
cp services/intelligence/.env.example services/intelligence/.env
```

Edit `services/intelligence/.env`:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_JWT_SECRET=<project-jwt-secret>
CORS_ORIGINS=http://localhost:5173
```

Use the Supabase project JWT secret from Supabase Dashboard -> Settings -> API.
Do not put the service role key in frontend environment files.

## Run The Full App

Start the Intelligence Service and React app together:

```bash
./full-app start full
```

Open the app:

```text
http://localhost:5173/study/sign-in
```

Check the service health endpoint:

```text
http://127.0.0.1:8000/health
```

Stop the full app:

```bash
./full-app stop full
```

Start marketing, app, and service together:

```bash
./full-app start all
```

The marketing site runs at:

```text
http://localhost:4321/
```

## Alternative Commands

Run only the React app:

```bash
pnpm dev:app
```

Run only the marketing site:

```bash
pnpm dev:marketing
```

Run only the Intelligence Service:

```bash
pnpm dev:intelligence
```

Run the Intelligence Service with Docker Compose:

```bash
SUPABASE_URL=https://<project>.supabase.co SUPABASE_JWT_SECRET=<project-jwt-secret> docker compose up --build
```

## Build And Test

Build both frontend apps:

```bash
pnpm build
```

Run TypeScript checks:

```bash
pnpm typecheck
```

Run lint checks:

```bash
pnpm lint
```

Run unit tests for the React app:

```bash
pnpm --filter @study-tracker/app test
```

Run Playwright E2E tests:

```bash
pnpm exec playwright test -c e2e/playwright.config.ts --project=app --reporter=list
```

## Supabase Notes

The React app requires Supabase URL and publishable key values for authentication.
The Intelligence Service requires `SUPABASE_URL` and `SUPABASE_JWT_SECRET` to verify authenticated `/v1/*` requests.
The app can render public pages without these credentials, but sign-in and protected study flows need a configured Supabase project.

Apply the local schema migration from:

```text
apps/app/supabase/migrations/003_events_table.sql
```

The materials metadata Edge Function source is in:

```text
apps/app/supabase/functions/materials-metadata
```

## Troubleshooting

If a port is already in use, inspect it before restarting services:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:4321 -sTCP:LISTEN
```

If Corepack cannot download pnpm, install pnpm directly:

```bash
npm install -g pnpm@10
```

If the React app starts but authenticated service calls fail, check that `services/intelligence/.env` contains the correct Supabase project URL and JWT secret.
If `pnpm dev:app` is used alone, calibration and progress APIs will not work because the Python service is not running.
