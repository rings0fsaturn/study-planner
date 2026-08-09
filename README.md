# Study Tracker Web

Mobile-first study planning app. You plan a roadmap of study materials, book study
sessions, and log your work; the app projects your finish date, calibrates your pace,
and keeps everything synced to your account.

The product has three parts:

| Part | What it is |
|---|---|
| Astro marketing site | Landing site served at `/` |
| React app | The study application, mounted at `/study` |
| Intelligence Service | FastAPI service for pace calibration, finish-date projection, and roadmap intelligence |

Authentication and cloud sync use Supabase (external). The browser keeps events in
IndexedDB and syncs them through the existing sync boundary.

## Run the whole stack with Docker

Docker runs all three parts in two containers: `web` (nginx serving the marketing
site and the app) and `intelligence` (the FastAPI service). The browser reaches the
service through the same origin via nginx, so no extra CORS configuration is needed.

### Prerequisites

- Docker Engine with the Compose plugin (`docker compose version` must work)

### First-time setup

```bash
cp docker/.env.example .env
```

Edit `.env` and set at least `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (see
[Environment variables](#environment-variables)). If you already have a working
`apps/app/.env.local`, you can skip `.env` — the launcher uses it automatically.

### Start, stop, and manage

Use the `./docker-app` launcher for everything:

```bash
./docker-app start      # build (when needed) and start the stack
./docker-app status     # container status
./docker-app logs       # follow logs (Ctrl-C to exit)
./docker-app logs intelligence
./docker-app restart    # stop, rebuild if needed, start again
./docker-app stop       # stop and remove the stack containers
./docker-app config     # validate and print the resolved compose configuration
```

`./docker-app` resolves the env file in this order: an explicit `--env-file PATH`
argument, then `apps/app/.env.local`, then `.env`.

Under the hood the launcher just calls Docker Compose, so the full CLI is still
available:

```bash
docker compose --env-file .env up --build -d
docker compose ps
docker compose down
```

### What you get

| URL | What is served |
|---|---|
| http://localhost:8080/ | Marketing site |
| http://localhost:8080/study/ | Study app |
| http://localhost:8000/health | Intelligence Service health |
| http://localhost:8080/api/v1/* | Intelligence Service API (proxied by nginx) |

`/api/v1/*` requests are proxied from the web container to the intelligence
container, and the app is built with `VITE_INTELLIGENCE_URL=/api`, so the browser
never needs a separate service URL in Docker mode.

### Rebuild after changes

```bash
./docker-app restart
```

`start` and `restart` always build the images (`--build`), so source changes in
`apps/`, `packages/`, or `services/intelligence/` are picked up automatically.

### Health checks

Both containers have healthchecks; `./docker-app status` shows them. Direct checks:

```bash
curl -fsS http://localhost:8000/health   # intelligence
curl -fsS http://localhost:8080/study/sign-in   # app shell
```

## Environment variables

The compose stack reads these from the env file:

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | yes | Supabase project URL. The service fetches JWKS keys from it for `ES256`/`RS256` token verification. |
| `SUPABASE_PUBLISHABLE_KEY` | yes | Supabase publishable (anon) key, baked into the app build. |
| `SUPABASE_JWT_SECRET` | only for HS256 projects | Project JWT secret from the dashboard. Not needed for asymmetric-signing projects. |
| `CORS_ORIGINS` | no | Comma-separated allowed origins for direct service calls (defaults cover localhost). |
| `VITE_INTELLIGENCE_URL` | no | Service URL baked into the app build. Default `/api` (nginx proxy). |
| `VITE_INITIAL_RESTORE_TIMEOUT_MS` | no | Cloud-restore safety timeout. Default `8000`. |
| `WEB_PORT` | no | Host port for the web container. Default `8080`. |
| `INTELLIGENCE_PORT` | no | Host port for the intelligence container. Default `8000`. |

Never commit real credentials. `.dockerignore` excludes `.env*` so secrets never
reach image layers.

## Local development

For iterative frontend work you can run the app and service directly (no Docker):

```bash
pnpm dev:full
```

`pnpm dev:full` starts the Intelligence Service on `http://localhost:8000`, waits
for `/health`, then starts the Vite app on `http://localhost:5173/study/`.
Calibration requires the service to be running.

Alternatives:

```bash
pnpm dev             # both frontends (marketing + app), no service
pnpm dev:app         # React app only
pnpm dev:intelligence  # Intelligence Service only
```

The service verifies Supabase access JWTs on `/v1/*`. Set `SUPABASE_URL` in the
shell or in `services/intelligence/.env` before starting. For HS256-signed
projects, also set `SUPABASE_JWT_SECRET` (from the dashboard, not the anon or
service role key). The React app reads `VITE_INTELLIGENCE_URL` from
`apps/app/.env.local` and defaults to `http://localhost:8000`.

## Repository layout

| Path | Responsibility |
|---|---|
| `apps/marketing/` | Astro marketing site |
| `apps/app/` | Vite + React study app |
| `services/intelligence/` | FastAPI Intelligence Service |
| `packages/design-tokens/` | Shared Marginalia design tokens and primitives |
| `packages/progress/` | TypeScript progress and projection logic |
| `packages/roadmap-engine/` | TypeScript roadmap and booking engine |
| `packages/py-progress/`, `packages/py-roadmap-engine/` | Python engine counterparts |
| `e2e/` | Playwright configuration and browser tests |
| `research/`, `college/`, `.work/` | Research workspace, dissertation deliverables, project state |

See [`design/architecture.md`](design/architecture.md) for the full architecture.
