---
title: Docker lifecycle launcher and runtime documentation refresh
status: implemented and verified (2026-08-09)
created: 2026-08-09
owner: implementer
tags: [APP, INFRA]
---

# Docker Lifecycle Launcher + Runtime Docs Refresh

## Problem

1. The containerized stack works but the only documented launch path is the long
   `docker compose --env-file apps/app/.env.local up --build -d` command.
2. Root and service READMEs under-explain the product and the Docker runtime.
3. Active rules and instructions still assume the retired Colima/Lima runtime
   (rule `51-docker-colima`, `services/intelligence/README.md` troubleshooting,
   `design/architecture.md`).

## Decisions

- **D-01** New root `./docker-app` launcher, separate from `./full-app` (which
  stays the local Vite/Astro/uvicorn process manager).
- **D-02** The launcher only resolves the env file and delegates to
  `docker compose`; no reimplementation of Compose behavior.
- **D-03** Env-file resolution order: explicit `--env-file PATH`, else
  `apps/app/.env.local`, else `.env`, else a clear setup error.
- **D-04** Rule `51-docker-colima.agents.md` renamed to
  `51-docker-runtime.agents.md` and rewritten Docker-only.
- **D-05** Historical `.work/` plans, handovers, and dated research records keep
  their historically accurate Colima mentions (scrubbing them is a separate
  decision, OQ-01).

## Implementation

### Phase 1 — launcher (`docker-app`)

Root executable `docker-app` (bash, `set -euo pipefail`, LF via `.gitattributes`):

- Commands: `start` (`up --build -d`), `stop` (`down`), `restart` (`down` then
  `up --build -d`), `status` (`ps`), `logs` (`logs -f`, or forwarded args when
  given), `config`, `help`.
- Options: `--env-file PATH`, `--project-name NAME`, `-h/--help`; remaining
  args after the command forward to Compose.
- Clear errors for missing Docker, missing Compose plugin, missing env file,
  unknown options/commands.

### Phase 2 — documentation

- `README.md` rewritten: product description, architecture table, Docker
  quick start (`cp docker/.env.example .env` + `./docker-app start`), launcher
  command table, URL table, health checks, rebuild notes, env-var table,
  local-development section, repository layout.
- `services/intelligence/README.md`: Docker section simplified to the
  launcher; Colima/Lima/SSH-forward/macOS troubleshooting removed; generic
  in-container checks kept.
- `docker/.env.example` comments now reference `./docker-app start`.

### Phase 3 — active instructions

- `.agents/rules/51-docker-colima.agents.md` → `51-docker-runtime.agents.md`
  (git mv), rewritten Docker-only (`./docker-app` as the lifecycle interface,
  `docker compose` fallback, safe inspection, public images, no credentials).
- `.agents/rules/README.agents.md` index row updated.
- `AGENTS.md`: added `./docker-app` block to Common Commands.
- `.work/STATUS.md`: launch command replaced with `./docker-app start`; this
  task recorded as a new Active row.
- `design/architecture.md`: `Docker/Colima` → `Docker` in the live diagram.
- `research/kt-bench/README.md`: rule reference updated to the renamed file.

### Phase 4 — live verification

See `VERIFICATION.md`. Full lifecycle exercised with the launcher only.

## Out of scope

- Supabase local stack, production deploy/TLS, E2E in Docker, replacing
  `./full-app`, application code changes.
- Rewriting archived/historical `.work/` documents (OQ-01).

## Open questions

### OQ-01: Historical Colima references

Archived plans, handovers, and dated research docs still mention Colima.
Resolve only if a literal repository-wide zero-match scan is ever required.
Owner: user.
