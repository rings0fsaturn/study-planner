# VERIFICATION — Docker Lifecycle Launcher + Runtime Docs Refresh

Plan: [`PLAN.md`](PLAN.md)

## Acceptance checklist

### Launcher (`docker-app`)

- [x] `bash -n docker-app` passes; script is executable.
- [x] `./docker-app help` lists start/stop/restart/status/logs/config/help.
- [x] `--env-file` resolution works: explicit path used; missing path fails with a clear message.
- [x] `./docker-app config` resolves the compose configuration (env file found from `apps/app/.env.local`).
- [x] `./docker-app start` builds both images and starts both containers healthy.
- [x] `./docker-app status` shows both containers with healthy status.
- [x] `./docker-app logs --tail=5` prints stack logs; `./docker-app logs intelligence --tail=3` prints service logs (extra args forwarded).
- [x] `./docker-app restart` stops, rebuilds, and restarts the stack.
- [x] `./docker-app stop` removes containers and the network; `status` is then empty.
- [x] `full-app` untouched (no Docker logic mixed into the local dev manager).

### Endpoints (Docker mode)

- [x] `http://localhost:8080/` → 200 (marketing site).
- [x] `http://localhost:8080/study/sign-in` → 200 (app shell).
- [x] `http://localhost:8080/study/roadmaps` → 200 (deep SPA route).
- [x] `http://localhost:8000/health` → 200 `{"status":"ok"}`.
- [x] `/api/v1/` proxy reaches the service: `POST /api/v1/calibration` through nginx returns `401 {"detail":"missing bearer token"}`, identical to the direct `:8000/v1/calibration` response.

### Docs and rules

- [x] Root README documents product, Docker quick start, launcher commands, URLs, env vars, local dev.
- [x] `services/intelligence/README.md` uses the launcher; no Colima/Lima/SSH-forward content remains.
- [x] `docker/.env.example` comments reference `./docker-app start`.
- [x] Rule file renamed to `51-docker-runtime.agents.md`, rewritten Docker-only; index row updated.
- [x] `AGENTS.md`, `.work/STATUS.md`, `design/architecture.md`, `research/kt-bench/README.md` updated.
- [x] Active instruction/architecture files contain no Colima/Lima/Limactl references (grep-verified); only historical `.work/` and research records retain them (OQ-01).

### No regressions

- [x] `git diff --check` clean.
- [x] Untracked `bundleimportguide.txt` untouched.

## Log

- **2026-08-09** Implemented all four phases. Live docker verification used only
  `./docker-app`: `config` OK, `start` built `web` + `intelligence` from public
  images and reached both containers healthy, `status` healthy, `logs` (stack
  and per-service, args forwarded) printed uvicorn/nginx output, `restart`
  recreated the stack healthy, `stop` removed containers and network.
  Endpoints: `/` 200, `/study/sign-in` 200, `/study/roadmaps` 200, `/health`
  200 `{"status":"ok"}`; proxy verified — `POST /api/v1/calibration` via nginx
  returned the service's `401 {"detail":"missing bearer token"}`, byte-identical
  to the direct service call.
  One plan drift: the plan example `./docker-app logs --no-follow` used a flag
  removed in Docker Compose v5 (`unknown flag: --no-follow`); removed the flag
  from the script help and README — `./docker-app logs` follows, and passing a
  service name (or `--tail=...`) prints without following.
  Next: commit the change set (or an independent reviewer pass per repo convention).
