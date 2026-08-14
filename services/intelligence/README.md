# Intelligence Service

FastAPI service exposing Pillar A engines (calibration, progress, roadmap).

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)

## Setup

From the repository root:

```bash
uv sync
```

## Run locally

```bash
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_JWT_SECRET=<project JWT secret> \
  uv run --package intelligence uvicorn app.main:app --reload --port 8000
```

From the repository root, `pnpm dev:intelligence` and `pnpm dev:full` also load
`services/intelligence/.env` before starting uvicorn.

`SUPABASE_JWT_SECRET` must be the Supabase project JWT secret from the dashboard,
not the publishable/anon key or service role key. For Supabase projects using
asymmetric signing keys (`ES256`/`RS256`), `SUPABASE_URL` is also required so the
service can fetch the project's public JWKS verification keys. `pnpm
dev:intelligence` will reuse `SUPABASE_URL` from `apps/app/.env.local` when the
service env file does not set it.

Set `CORS_ORIGINS` to a comma-separated list when the caller is not the default
local Vite app:

```bash
CORS_ORIGINS=http://localhost:5173,https://studytracker.app \
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_JWT_SECRET=<project JWT secret> \
  uv run --package intelligence uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl -s http://127.0.0.1:8000/health
```

For full-stack browser testing, start the Vite app with the intelligence service:

```bash
pnpm dev:full
```

This binds the intelligence service to `127.0.0.1:8000` and starts the app at
`http://localhost:5173/study/`. If the app does not start, first check that port
`8000` is not already occupied by another local dev server:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
```

## Run with Docker

The full stack (marketing site + React app + this service) runs in Docker via
`docker compose`. Use the root launcher from the repository root:

```bash
./docker-app start
```

This builds and starts both containers. The service is on
`http://127.0.0.1:8000`, the web container (marketing site + React app) on
`http://localhost:8080`.

Lifecycle:

```bash
./docker-app status
./docker-app logs intelligence
./docker-app restart
./docker-app stop
```

See the [root README](../../README.md) for env file setup, environment variables,
and troubleshooting.

Set `SUPABASE_URL` (and `SUPABASE_JWT_SECRET` for HS256-signed projects) in the
env file used by compose (`apps/app/.env.local` or `.env`); see
`docker/.env.example` for the full variable list.

The Dockerfile uses public base images (`python:3.12-slim`,
`ghcr.io/astral-sh/uv`). Hosts that must pull from an internal mirror can
override the build args:

```bash
PYTHON_IMAGE=<mirror>/library/python:3.12-slim UV_IMAGE=<mirror>/astral/uv:0.11.19 \
  ./docker-app start
```

## Docker Troubleshooting

Baseline checks — start with the Docker daemon and compose:

```bash
docker info
docker compose version
./docker-app status
./docker-app logs intelligence
curl -sS http://127.0.0.1:8000/health
```

If a published port is unreachable, verify the service inside the container
before touching service code:

```bash
docker compose --env-file apps/app/.env.local exec -T intelligence python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5).read().decode())"
```

If `docker compose version` or `docker buildx version` fail, install the Docker
Compose and Buildx plugins for your Docker installation, then verify with
`docker info` — the `Plugins:` section should list `buildx` and `compose`.

### Standard verification flow

```bash
./docker-app config
./docker-app start
./docker-app status
curl -sS http://127.0.0.1:8000/health
./docker-app stop
```

If host curl cannot connect, use the in-container check above before touching
service code.

## Curl examples

The examples below use the golden fixtures under
`tests/fixtures/pillar-a/`. Fixture request bodies include a `fn` field used by
the parity tests; the API ignores that extra field.

`/v1/*` endpoints require a Supabase access token from the configured project.
Legacy `HS256` tokens are verified with `SUPABASE_JWT_SECRET`; `ES256`/`RS256`
tokens are verified with the public JWKS endpoint under `SUPABASE_URL`:

```bash
AUTH_HEADER="Authorization: Bearer <supabase access token>"
```

Health:

```bash
curl -s http://127.0.0.1:8000/health
```

Calibration:

```bash
curl -s -X POST http://127.0.0.1:8000/v1/calibration \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d @tests/fixtures/pillar-a/progress/compute-calibration-empty.input.json
```

Calibration prompt detail:

```bash
curl -s -X POST http://127.0.0.1:8000/v1/calibration/prompt-detail \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d @tests/fixtures/pillar-a/progress/get-prompt-detail-empty.input.json
```

Progress:

```bash
curl -s -X POST http://127.0.0.1:8000/v1/progress \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d @tests/fixtures/pillar-a/progress/compute-progress-full-snapshot.input.json
```

Roadmap generation:

```bash
curl -s -X POST http://127.0.0.1:8000/v1/roadmap/generate \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d @tests/fixtures/pillar-a/roadmap/generate-roadmap-ddia-600-min.input.json
```

Roadmap regeneration:

```bash
curl -s -X POST http://127.0.0.1:8000/v1/roadmap/regenerate \
  -H 'Content-Type: application/json' \
  -H "$AUTH_HEADER" \
  -d @tests/fixtures/pillar-a/roadmap/regenerate-preserves-pins.input.json
```

## Material ingestion worker (issue #37)

The worker owns deterministic extraction, cleaning, chunking, embedding
calls, and the pgmq stage queues (`material_extract` → `material_embed` →
`material_publish`). It is a separate process from the API and talks to
Supabase with the service role; the API never holds service credentials.

Required env for the worker:

- `SUPABASE_URL` — Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key (runtime env only, never
  committed; the worker is the only process that needs it).
- `GEMINI_API_KEY` — Gemini key for `gemini-embedding-001` embeddings.
  Without it, extraction/chunking still run and the embed stage fails
  materials with a clear `provider_unavailable` error.

Optional tuning: `INGESTION_BATCH_SIZE` (100), `INGESTION_VISIBILITY_SECONDS`
(30), `INGESTION_POLL_INTERVAL_SECONDS` (1), `INGESTION_MAX_DELIVERIES` (3).

Run locally:

```bash
pnpm dev:ingestion-worker
```

Run in Docker: `./docker-app start` starts the `ingestion-worker` service
alongside the API (see `docker/.env.example` for the env keys).

### Material/job API env

The `/v1/materials/*` and `/v1/jobs/*` endpoints resolve Supabase through the
caller's own access token, so the API additionally needs
`SUPABASE_PUBLISHABLE_KEY` (anon key) for those routes.

## Test

```bash
uv run --package intelligence pytest services/intelligence/tests -q
```
