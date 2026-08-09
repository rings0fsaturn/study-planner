---
title: Dockerize the full app and remove internal infrastructure dependencies
status: implemented and verified (2026-08-09)
created: 2026-08-09
owner: native side
tags: [APP, INFRA]
---

# Dockerize the Full App + Internal Infra Dependency Removal

## Problem

1. `docker-compose.yml` only ran the Intelligence Service, so the marketing site
   and React app could not run via Docker.
2. Docker and docs depended on internal corporate infrastructure: private
   image-mirror defaults in the compose file and the service Dockerfile, a
   corporate CA build secret (`ca-certificates.crt`), and an internal npm
   registry fallback.

## Implementation

- **`docker-compose.yml`** — now defines `web` and `intelligence`. `web` builds
  the frontend Dockerfile and serves both apps through nginx; `intelligence`
  keeps its port, healthcheck, and env passthrough. No `secrets:` block.
- **`services/intelligence/Dockerfile`** — public base images
  (`python:3.12-slim`, `ghcr.io/astral-sh/uv:0.11.19`) and no CA secret mount.
- **`docker/frontend.Dockerfile`** (new) — multi-stage: pnpm install with
  `--frozen-lockfile`, build-time env args (`SUPABASE_URL`,
  `SUPABASE_PUBLISHABLE_KEY`, `VITE_INTELLIGENCE_URL=/api`,
  `VITE_INITIAL_RESTORE_TIMEOUT_MS`), `pnpm build`, then nginx:alpine serving
  marketing `dist/` at `/` and app `dist/` under `/study/`.
- **`docker/nginx.conf`** (new) — `/study/*` SPA fallback, `/api/v1/*` proxied
  to `intelligence:8000/v1/*` (same origin, no extra CORS needed).
- **`docker/.env.example`** (new) — compose variables; copy to root `.env`, or
  pass an existing env file with `docker compose --env-file apps/app/.env.local`.
- **`.dockerignore`** — excludes `.env*` (secrets never baked into layers) and
  heavy dirs (`college/`, `research/`, `.work/`, `e2e/`, archives).
- **`package.json`** — `packageManager: pnpm@10.33.2`.
- **Docs/rules** — root README, `services/intelligence/README.md`, rule 50
  (public npm default), rule 51 (public registries, operator-local overrides),
  rule 52 (generic CA mention).
- **Repository-wide scrub** — internal mirror/registry/CA references removed
  from historical `.work/` plans/handovers, skills, and the 3rd-Review
  submission copy. Intentionally preserved content: a YouTube video title in
  `capture-screenshots.mjs` (the script screenshots that specific video) and
  `filter-guide.txt` (a pattern-replacement guide whose function is to match
  the string).

## Verification

See `VERIFICATION.md`. Key checks: `docker compose config` parses; images
build from public registries; `web` serves `/` and `/study/sign-in`; `nginx`
proxies `/api/v1/`; `intelligence` `/health` is 200; no internal
mirror/registry/CA strings remain except the preserved content.

## Out of scope

- Local Supabase stack in compose (kept external, as today).
- Production deploy / TLS termination / domain wiring.
- Running E2E suites inside Docker.
