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

## Run with Docker Compose

From the repository root:

```bash
docker compose up --build -d
```

The service listens on `http://127.0.0.1:8000`. Stop it with:

```bash
docker compose down
```

Set `SUPABASE_URL` (and `SUPABASE_JWT_SECRET` for HS256-signed projects) in
the shell or in a root `.env` file before building.

The Dockerfile uses public base images (`python:3.12-slim`,
`ghcr.io/astral-sh/uv`). Hosts that must pull from an internal mirror can
override the build args:

```bash
PYTHON_IMAGE=<mirror>/library/python:3.12-slim UV_IMAGE=<mirror>/astral/uv:0.11.19 \
  docker compose up --build -d
```

## Docker / Colima Troubleshooting

Baseline checks — start with Docker, not Colima; Colima status can be less useful than the
Docker daemon state:

```bash
docker info              # Context: colima
docker ps --format '{{.Names}} {{.Ports}}'
colima status
```

Don't stop/restart Colima just because a command is confusing — unrelated containers may be
running (e.g. `wiremock-simulator` on port `9999`; never kill its SSH forward).

### Missing Compose / Buildx plugins

If `docker compose version` or `docker buildx version` fail, install the Homebrew plugin
packages and point Docker at them:

```bash
brew install docker-compose docker-buildx
```

```json
// ~/.docker/config.json
{
  "cliPluginsExtraDirs": [
    "/opt/homebrew/lib/docker/cli-plugins"
  ]
}
```

Verify with `docker info` — the `Plugins:` section should list `buildx` and `compose`.

### Host curl can't reach a published port

`docker port` can show `0.0.0.0:8000->8000/tcp` while macOS localhost still refuses the
connection. Verify from inside the container, then the Lima VM, before changing app code:

```bash
docker compose exec -T intelligence python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5).read().decode())"

env LIMA_HOME=/Users/rsaji/.colima/_lima limactl shell colima ss -ltnp
env LIMA_HOME=/Users/rsaji/.colima/_lima limactl shell colima curl -sS http://127.0.0.1:8000/health
```

If the service works in the container and VM but not from macOS, open a temporary SSH
forward for verification, then remove only that forward:

```bash
ssh -F /Users/rsaji/.colima/ssh_config -N -L 127.0.0.1:8000:127.0.0.1:8000 colima
# ... verify with curl, then ...
ssh -F /Users/rsaji/.colima/ssh_config -O cancel -L 127.0.0.1:8000:127.0.0.1:8000 colima
```

Do not kill the existing `9999` SSH forward — it belongs to the WireMock simulator.

### Standard verification flow

```bash
docker compose config
docker compose up --build -d
docker compose ps
curl -sS http://127.0.0.1:8000/health
docker compose down
```

If host curl cannot connect, use the port-forwarding checks above before touching service
code.

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

## Test

```bash
uv run --package intelligence pytest services/intelligence/tests -q
```
