# Adaptive Study Planner - Phase 1 ESA Code

This directory contains the source files needed to install and run the Study Tracker application and reproduce the Phase 1 research workflows.
The copy was prepared from source revision `8a2ef385cb072c55e5797896a50b2edcec35de5a`.
It is intentionally smaller than the development repository.

## Included

- `apps/app` contains the React and Vite study application served under `/study`.
- `apps/marketing` contains the Astro marketing site.
- `packages/design-tokens` contains the shared visual tokens and CSS.
- `packages/progress` contains the TypeScript progress, calibration, detection, and projection logic.
- `packages/roadmap-engine` contains the TypeScript roadmap and booking engine.
- `packages/py-progress` contains the Python counterpart of the progress engine.
- `packages/py-roadmap-engine` contains the Python counterpart of the roadmap engine.
- `services/intelligence` contains the FastAPI Intelligence Service.
- `apps/app/supabase` contains the database migration and materials metadata Edge Function source.
- `scripts` and `full-app` contain the local application launchers.
- `research` contains the Phase 1 research code, documentation for every executable research script, and the uncompressed datasets used for the reported 3,600-learner evaluation.
- `college/scope` contains the two pre-registration contracts whose content hashes identify generated dataset lineages.

Tests, browser automation, build output, dependency folders, virtual environments, caches, generated research results, local environment files, and dataset ZIP archives are excluded.
No credentials or secrets are included.

## Prerequisites

- Node.js 20 or newer.
- pnpm 10.
- Python 3.12 or newer.
- `uv` for Python dependency management.
- A Supabase project for authentication and synchronized application data.

Install pnpm through Corepack if it is not already available:

```bash
corepack enable
corepack prepare pnpm@10 --activate
```

Install `uv` by following the installer instructions at `https://docs.astral.sh/uv/getting-started/installation/`.

## Install Dependencies

Run all commands in this README from this `code` directory.

```bash
pnpm install --frozen-lockfile
uv sync --package intelligence
```

Install the complete Python workspace when both the application and research scripts are required:

```bash
uv sync --all-packages
```

Using `--all-packages` keeps the Intelligence Service and research dependencies in the same shared environment.

## Configure Supabase

The React application requires a real Supabase URL and publishable key even for local development.
The Intelligence Service requires the project URL and JWT secret.

Create the frontend environment file:

```bash
cp apps/app/.env.example apps/app/.env.local
```

Replace the placeholders in `apps/app/.env.local`:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
VITE_INTELLIGENCE_URL=http://127.0.0.1:8000
```

Create the service environment file:

```bash
cp services/intelligence/.env.example services/intelligence/.env
```

Replace the placeholders in `services/intelligence/.env`:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_JWT_SECRET=YOUR_PROJECT_JWT_SECRET
CORS_ORIGINS=http://localhost:5173
```

Use the JWT secret from the Supabase project API settings.
Do not place the JWT secret or service-role key in the frontend environment file.

Run `apps/app/supabase/migrations/003_events_table.sql` in the Supabase SQL editor.
The migration creates the synchronized event table, row-level security policies, and private snapshot bucket.

For local email flows, configure the Supabase Auth site URL and allowed redirect URLs to include:

```text
http://localhost:5173/study/auth-confirmed
http://localhost:5173/study/reset-password
```

The materials metadata Edge Function is optional for basic application use.
Its source is under `apps/app/supabase/functions/materials-metadata` and it requires a `YOUTUBE_API_KEY` secret when deployed.

## Run the Application

On macOS or Linux, start the Intelligence Service and React app together:

```bash
./full-app start full
```

Open the study application at:

```text
http://localhost:5173/study/sign-in
```

Check the service health endpoint at:

```text
http://127.0.0.1:8000/health
```

Stop the managed processes with:

```bash
./full-app stop full
```

Start the Intelligence Service, React app, and marketing site together with:

```bash
./full-app start all
```

The marketing site is then available at `http://localhost:4321/`.

## Run Components Separately

Use separate terminals when the managed launcher is unavailable, including on Windows.

Start the Intelligence Service:

```bash
pnpm dev:intelligence
```

Start the React application:

```bash
pnpm dev:app
```

Start the marketing site when required:

```bash
pnpm dev:marketing
```

## Verify the Installation

Build both frontend applications:

```bash
pnpm build
```

Verify the Python application imports:

```bash
uv run --package intelligence python -c "from app.main import app; print(app.title)"
```

The original automated test suites are intentionally not included in this minimum source package.

## Research

Read [`research/README.md`](research/README.md) before running research commands.
It identifies every executable research script, its purpose, expected input, output location, and supported command.

## Troubleshooting

If the app reports missing Supabase variables, confirm that `apps/app/.env.local` exists and contains real values rather than placeholders.
If the Intelligence Service refuses to start, confirm that `services/intelligence/.env` contains `SUPABASE_JWT_SECRET`.
If port 8000, 5173, or 4321 is occupied, stop the owning process or run the affected component on a different port.
If Corepack cannot reach the package registry, configure the registry for the local environment rather than disabling TLS verification.
