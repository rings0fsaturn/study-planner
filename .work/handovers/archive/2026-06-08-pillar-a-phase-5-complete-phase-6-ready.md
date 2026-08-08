---
title: Pillar A FastAPI Backend — Phase 5 Complete, Phase 6 Ready
purpose: Hand off the completed Python roadmap + FastAPI API work so the next agent can start Docker/Colima docs immediately
audience: agents
mode: transition
status: phase-6-ready
last_updated: 2026-06-08
related:
  - ./2026-06-08-pillar-a-fastapi-backend.md
  - ./2026-06-08-pillar-a-phase-3-complete.md
  - ../plans/2026-06-08-pillar-a-fastapi-backend.md
  - ../packages/py-progress/
  - ../packages/py-roadmap-engine/
  - ../services/intelligence/
---

# Pillar A FastAPI Backend — Phase 6 Ready

**Mode:** transition (Phases 4-5 complete; next step is Docker + README)

Continues from [`2026-06-08-pillar-a-phase-3-complete.md`](2026-06-08-pillar-a-phase-3-complete.md) and the canonical runbook [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md). This handover covers only what changed after Phase 3 and what the next agent needs to begin Phase 6 without re-deriving context.

## TL;DR

Phases 4 and 5 are done and committed: Python `py-roadmap-engine` parity is green, and the FastAPI Intelligence Service exposes the planned `/v1/*` endpoints with fixture-backed HTTP integration tests. The plan now shows Phase 6 as the first `☐ Not started` phase. Next session should implement **Phase 6 only**: Dockerfile, root `docker-compose.yml`, and service README curl examples.

## Goal / why

The larger goal is still the Pillar A Python backend migration for the M.Tech thesis architecture: Python is the source of truth for calibration/progress/roadmap algorithms, exposed through a stateless FastAPI service.

User constraints still in force:

- **Do not wire the React client** (`apps/app/**`) in this plan.
- **Do not delete or rewrite** existing TS packages (`packages/progress`, `packages/roadmap-engine`).
- Keep parity against golden fixtures with `1e-6` float tolerance.
- Keep commits scoped; unrelated dirty files are present and should remain unstaged unless explicitly requested.

## Current phase status

| Phase | Status in plan | Commit / note |
|---|---:|---|
| 1 | ✅ Complete | `0d605b5` in plan; workspace + `/health` |
| 2 | ✅ Complete | `0d605b5` in plan; golden fixtures |
| 3 | ✅ Complete | `aebb861`; plan SHA recorded by `96d7370` |
| 4 | ✅ Complete | `3d3c73d`; plan SHA recorded by `6e1500d` |
| 5 | ✅ Complete | `74346f1`; plan SHA recorded by `f5fb36a` |
| 6 | ☐ Not started | Docker + Colima + docs; start here next |

Recent branch log:

```bash
f5fb36a docs: record Phase 5 commit sha in implementation plan
74346f1 Phase 5: Add FastAPI intelligence routers
c2910a7 Phase 5: starting (status: in progress)
6e1500d docs: record Phase 4 commit sha in implementation plan
3d3c73d Phase 4: Port py-roadmap-engine
d109e69 Phase 4: starting (status: in progress)
```

## Key references

| Path | Why it matters |
|---|---|
| [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md) | Canonical phase runbook; Phase 6 status is `☐ Not started` |
| [`services/intelligence/README.md`](../../../services/intelligence/README.md) | Current stub; Phase 6 must expand with Docker/run/curl examples |
| [`services/intelligence/app/main.py`](../../../services/intelligence/app/main.py) | FastAPI app; includes routers under `/v1` and `/health` |
| [`services/intelligence/app/routers/`](../../../services/intelligence/app/routers/) | Current HTTP endpoint implementations |
| [`services/intelligence/app/schemas/`](../../../services/intelligence/app/schemas/) | Pydantic request schemas for progress and roadmap endpoints |
| [`services/intelligence/tests/test_v1_integration.py`](../../../services/intelligence/tests/test_v1_integration.py) | HTTP fixture parity test harness; reuse fixture mapping for README curl examples |
| [`packages/py-roadmap-engine/src/py_roadmap_engine/engine.py`](../../../packages/py-roadmap-engine/src/py_roadmap_engine/engine.py) | Python roadmap scheduler port; public API already green |
| [`tests/fixtures/pillar-a/`](../../../tests/fixtures/pillar-a/) | Golden request/response fixtures for curl examples and tests |
| `pillar-a-fastapi-intelligence-service` (memory flow) | Agent memory flow for Python engines → FastAPI routes |

## What was implemented in Phase 4

Phase 4 commit: `3d3c73d` (`Phase 4: Port py-roadmap-engine`)

| File | Purpose |
|---|---|
| `packages/py-roadmap-engine/src/py_roadmap_engine/constants.py` | Port of TS constants/config |
| `packages/py-roadmap-engine/src/py_roadmap_engine/types.py` | Dataclass types matching roadmap engine output shape |
| `packages/py-roadmap-engine/src/py_roadmap_engine/engine.py` | Python port of TS roadmap scheduler and post-commit operations |
| `packages/py-roadmap-engine/src/py_roadmap_engine/__init__.py` | Public snake_case API exports |
| `packages/py-roadmap-engine/tests/test_fixtures.py` | 27 golden roadmap fixtures |
| `packages/py-roadmap-engine/tests/test_properties.py` | 3 native property tests: determinism, foundation/practice phase invariants |

Public Python API:

```python
from py_roadmap_engine import (
    generate_roadmap,
    infer_role,
    add_material_to_roadmap,
    remove_material_from_roadmap,
    regenerate_roadmap,
)
```

## What was implemented in Phase 5

Phase 5 commit: `74346f1` (`Phase 5: Add FastAPI intelligence routers`)

| Endpoint | Router | Backend function |
|---|---|---|
| `POST /v1/calibration` | `services/intelligence/app/routers/calibration.py` | `py_progress.compute_calibration` |
| `POST /v1/calibration/prompt-detail` | `services/intelligence/app/routers/calibration.py` | `py_progress.get_prompt_detail` |
| `POST /v1/progress` | `services/intelligence/app/routers/progress.py` | `py_progress.compute_progress` |
| `POST /v1/roadmap/generate` | `services/intelligence/app/routers/roadmap.py` | `py_roadmap_engine.generate_roadmap` |
| `POST /v1/roadmap/regenerate` | `services/intelligence/app/routers/roadmap.py` | `py_roadmap_engine.regenerate_roadmap` |

Notes:

- `add_material_to_roadmap` and `remove_material_from_roadmap` are ported in Python but **not exposed as HTTP endpoints** in Phase 5. The plan defers those HTTP routes.
- `services/intelligence/app/serialize.py` preserves TS fixture JSON shape. It omits roadmap `CapacityCheck.suggestedWeeks` only when TS would have `undefined`; do not replace it with broad `exclude_none=True`.
- `services/intelligence/tests/test_v1_integration.py` strips fixture `"fn"` and posts remaining JSON bodies to the ASGI app with `httpx.AsyncClient`.

## Last known good verification

These were green at the end of Phase 5:

```bash
uv run --package py-progress pytest packages/py-progress/tests -q
# 72 passed

uv run --package py-roadmap-engine pytest packages/py-roadmap-engine/tests -q
# 30 passed

uv run --package intelligence pytest services/intelligence/tests -q
# 35 passed

env COREPACK_NPM_REGISTRY=https://registry.npmjs.org pnpm --filter progress test
# 72 passed

env COREPACK_NPM_REGISTRY=https://registry.npmjs.org pnpm --filter roadmap-engine test
# 30 passed
```

Why the env var matters: on this machine plain `pnpm` can fail because Corepack attempts the public npm registry and gets `403`. The repo-local workaround is documented in `.agents/rules/50-pnpm-build-registry.agents.md`; use `COREPACK_NPM_REGISTRY=https://registry.npmjs.org` for pnpm verification.

## In-flight repo state

No Phase 4/5 implementation changes are left uncommitted. Current dirty tree entries pre-existed this handover and should be left alone unless the user says otherwise:

```bash
 M CLAUDE.md
 M apps/marketing/.astro/settings.json
 D college/mydeliverables/1st-Review/deck/~$review1-deck.pptx
 M pnpm-workspace.yaml
?? .claude/hooks/
?? .cursor/
?? project-1.bundle
?? project.bundle
?? rules/
```

`handovers/` is gitignored in this repo, so this handover is an agent context artifact, not a source commit target.

## Phase 6 scope

Phase 6 from the plan:

1. `services/intelligence/Dockerfile` — Python 3.12 slim, uv install
2. `docker-compose.yml` — service on `:8000`, `CORS_ORIGINS` env
3. `services/intelligence/README.md` — build/run, curl examples for each endpoint

Expected verification:

```bash
docker compose up --build -d
curl -s http://localhost:8000/health
curl -s -X POST http://localhost:8000/v1/calibration \
  -H 'Content-Type: application/json' \
  -d @tests/fixtures/pillar-a/progress/compute-calibration-empty.input.json
docker compose down
```

Important correction: the plan currently shows `tests/fixtures/pillar-a/progress/empty-sessions.input.json`, but that file does **not** exist. Use `tests/fixtures/pillar-a/progress/compute-calibration-empty.input.json`. Its extra `"fn"` field is harmless because the Pydantic request models ignore extra fields.

## Suggested Phase 6 implementation shape

Use the plan-implementor workflow:

1. Run Phase 6 prereq verification first:
   ```bash
   uv run --package intelligence pytest services/intelligence/tests -q
   ```
2. Mark Phase 6 `🟡 In progress` in `../../plans/active/2026-06-08-pillar-a-fastapi-backend.md` and commit the plan-only start boundary.
3. Add `services/intelligence/Dockerfile`.
4. Add root `docker-compose.yml`.
5. Expand `services/intelligence/README.md` with:
   - local uv run command
   - Docker Compose build/run commands
   - health curl
   - one curl example per endpoint using existing fixtures
6. Run Docker verification.
7. Mark Phase 6 complete in the plan, commit code + plan, then record final SHA in the plan using the same follow-up docs commit pattern used for Phases 3-5.

Potential Dockerfile direction:

- Build from repo root context so `pyproject.toml`, `uv.lock`, workspace packages, and `services/intelligence` are all visible.
- Install uv in a Python 3.12 slim image.
- Run `uv sync --package intelligence --frozen` if the lock supports it; otherwise use the project’s working uv sync pattern.
- Start with `uv run --package intelligence uvicorn app.main:app --host 0.0.0.0 --port 8000`.

Do not hard-code React/client assumptions. CORS is already set in `main.py` to `http://localhost:5173`.

## Open questions & assumptions

| Item | Status |
|---|---|
| Dockerfile exact uv command | Open; verify against current `uv.lock`/workspace behavior |
| `CORS_ORIGINS` env behavior | Plan asks for env in compose, but app currently hard-codes `http://localhost:5173`; either document as reserved or add small env parsing if necessary |
| Curl examples | Use existing golden fixtures; no need to invent payloads |
| Docker image size | Not a target in this phase; prefer simple reliable build |
| Pushing commits | Not requested yet |

## Dead ends and gotchas

| Gotcha | Reason |
|---|---|
| Global `exclude_none=True` serialization | Breaks legitimate TS `null` values in roadmap slots; only omit absent `suggestedWeeks` |
| Exposing add/remove HTTP routes in Phase 5/6 | Deferred by plan; Python API exists but HTTP route scope is generate/regenerate only |
| Plain `pnpm --filter ... test` | Can fail via Corepack public npm 403; use `COREPACK_NPM_REGISTRY` workaround |
| Plan curl fixture path | `empty-sessions.input.json` is wrong; actual file is `compute-calibration-empty.input.json` |
| Editing `apps/app/**` | Out of scope; React client wiring is explicitly deferred |

## Next action

Open [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md), run the Phase 6 prereq test, mark Phase 6 in progress, and implement Dockerfile + Compose + README curl docs.

## Suggested new-session prompt

```text
Read 2026-06-08-pillar-a-phase-5-complete-phase-6-ready.md and ../../plans/active/2026-06-08-pillar-a-fastapi-backend.md.
Implement Phase 6 only: services/intelligence/Dockerfile, docker-compose.yml, and README curl examples.
Do not wire the React client. Preserve unrelated dirty files.
```

## User context

- User wants the next session agent to start Phase 6 immediately, not rebuild Phase 4/5 context.
- The plan file is the authority for phase order and scope.
- The user values scoped commits and preserving unrelated local noise.
- Browser/client wiring is intentionally deferred; avoid expanding scope into `apps/app`.
