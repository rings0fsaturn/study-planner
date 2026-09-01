# VERIFICATION — Dockerize Full App + Internal Infra Dependency Removal

Plan: [`PLAN.md`](PLAN.md)

## Acceptance checklist

### Docker configuration

- [x] `docker compose config` resolves both services (`web`, `intelligence`) with no `secrets` block and public base images.
- [x] `services/intelligence/Dockerfile` and the submission copy use `python:3.12-slim` / `ghcr.io/astral-sh/uv:0.11.19` and no CA mount.
- [x] `docker/frontend.Dockerfile` builds app + marketing via `pnpm build` with `--frozen-lockfile` and build-time env args.
- [x] `docker/nginx.conf` serves `/` (marketing), `/study/*` SPA fallback, and proxies `/api/v1/*` to `intelligence:8000/v1/*`.
- [x] `.dockerignore` excludes `.env`, `.env.local`, `.env.*.local` plus heavy dirs.
- [x] Root `package.json` pins `packageManager: pnpm@10.33.2`.

### Live docker verification

- [x] Images pull and build from public registries on this host (network permitting).
- [x] `docker compose up --build -d` starts both containers healthy.
- [x] `http://localhost:8080/` returns the marketing site.
- [x] `http://localhost:8080/study/sign-in` returns the app shell.
- [x] `http://localhost:8000/health` returns 200.
- [x] nginx proxy forwards `/api/v1/` to the service (verified: an unauthenticated POST returns 401 from the service)
- [x] Deep SPA route `/study/roadmaps` returns 200; built assets served; bundle inlines `VITE_INTELLIGENCE_URL=/api` (no localhost fallback, no secrets baked in).

### Internal infra scrub

- [x] Repository scan for internal mirror/registry/CA strings reports only the preserved content:
  - `capture-screenshots.mjs` (a YouTube video title — content of the captured video),
  - `filter-guide.txt` (pattern-replacement guide that must match the string).
- [x] Runtime files (compose, Dockerfiles, READMEs, rules 50/51/52) are clean.
- [x] Historical `.work/` plans/handovers and 3rd-Review submission copies are clean.

### No regressions

- [x] Frontend typecheck / lint unchanged (no TypeScript touched). (app `tsc && vite build` and the astro build ran clean inside the container)
- [x] Existing local workflows (`pnpm dev:full`, `./full-app`) unaffected (no launcher or runtime code touched).

## Log

- **2026-08-09** Implemented and verified live. `docker compose build` produced both images
  from public registries (app `tsc && vite build` + astro build clean in-container); stack booted
  healthy; marketing `/` 200, app `/study/sign-in` 200, deep route `/study/roadmaps` 200,
  `/health` 200, `/api/v1/` proxy reached the service (401 unauthenticated). Bundle check:
  `VITE_INTELLIGENCE_URL=/api` inlined, no secrets in layers. Stack stopped after verification
  (`docker compose down`). Journal note: plan folder renamed on 2026-08-09 to keep the task slug
  free of the scrubbed term; run command for the user is
  `docker compose --env-file apps/app/.env.local up --build -d`.
  Next: commit the change set (or an independent reviewer pass per repo convention).
