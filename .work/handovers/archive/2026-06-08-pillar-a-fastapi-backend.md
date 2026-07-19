---
title: Pillar A FastAPI Backend — Session Handover
purpose: Preserve grill-session decisions and implementation entry point for porting Pillar A TS engines to Python
audience: agents
mode: transition
status: ready-to-implement
last_updated: 2026-06-08
related:
  - ../plans/2026-06-08-pillar-a-fastapi-backend.md
  - ../design/architecture.md
  - ../college/scope/asOfReview1/architecture.md
  - ../packages/progress/
  - ../packages/roadmap-engine/
---

# Pillar A FastAPI Backend — Handover

**Mode:** transition (plan agreed, zero implementation started)

## TL;DR

Grill session mapped Pillar A (Bayesian → CUSUM → GP → constraint scheduler) from existing TS packages to a planned **Python FastAPI Intelligence Service**. All decisions are locked; full implementation plan written. **No code written yet.** Next session: open [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md) and implement **Phase 1** (uv workspace + FastAPI `/health` skeleton).

## Goal / why

Build a **backend-only** Python port of Pillar A to match the thesis architecture diagram (`college/mydeliverables/1st-Review/deck/assets/architecture_horizontal.png`): Intelligence Service (Python · FastAPI) owns heavy ML; client stays local-first TS.

**Constraints the user set:**
- Rewrite Pillar A from TS → Python as single source of truth (evaluated code = shipped code)
- **Do not wire the React client** in this slice
- **Do not remove** existing `packages/progress` or `packages/roadmap-engine` until a later client-wiring slice
- Faithful numerical parity with existing Vitest suites before any client migration

## Key references

| Path | Why it matters |
|---|---|
| [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md) | **Canonical runbook** — 6 phases, verification commands, decisions D-01–D-10 |
| [`packages/progress/src/`](../../../packages/progress/src/) | TS source for calibration, CUSUM, Kalman, GP, progress (~1.6k LOC) |
| [`packages/roadmap-engine/src/roadmap-engine.ts`](../../../packages/roadmap-engine/src/roadmap-engine.ts) | TS source for constraint-based scheduler (~940 LOC) |
| [`packages/progress/src/config.ts`](../../../packages/progress/src/config.ts) | Hyperparameters to copy verbatim into Python |
| [`design/algo/ROADMAP_ENGINE_GUIDE.md`](../../../design/algo/ROADMAP_ENGINE_GUIDE.md) | 16 design decisions for scheduler edge cases |
| [`design/architecture.md`](../../../design/architecture.md) | Three-tier target: `/research` → FastAPI → client |
| [`apps/app/src/progress/mapEvents.ts`](../../../apps/app/src/progress/mapEvents.ts) | How client maps Dexie events today (future API wiring, not this slice) |

## What I learned

### Pillar A = two TS packages, four pipeline stages

| Stage | TS package | Modules |
|---|---|---|
| Pace Calibration | `packages/progress` | `bayesian.ts`, `calibration.ts` |
| Change Detection | `packages/progress` | `cusum.ts`, `trend.ts`, `kalman.ts` |
| Progress Projection | `packages/progress` | `gp.ts`, `progress.ts` |
| Schedule Generator | `packages/roadmap-engine` | `roadmap-engine.ts` |

### Current data flow (today — no backend)

Intelligence runs **100% in the browser**. Hooks call `eventStore.getAll()` on **Dexie**, map via `mapEvents.ts`, then call TS functions. **Supabase is sync-only** (flush/restore via `SyncEngine`) — never read at compute time.

### Future client ↔ API (deferred, but decided)

**Client-push + local cache** beats service-pull-from-Supabase:
1. Client maps Dexie events → POST JSON to FastAPI
2. Cache `CalibrationState` / `ProgressSnapshot` / `RoadmapOutput` in new `intelligence_cache` Dexie table
3. UI reads cache offline; background refresh when online

### Agent gotchas (not obvious from plan alone)

| Gotcha | Detail |
|---|---|
| **Two `RoadmapInput` types** | `progress.RoadmapInput` = slots-based (for `/v1/progress`). `roadmap-engine.RoadmapInput` = materials/hours/days (for `/v1/roadmap/*`). Same name, different schemas. |
| **HTTP JSON naming** | Use **camelCase** in API bodies to match TS/client (`exceptionalTags`, not `exceptional_tags`). |
| **`computeProgress` ignores calibration** | TS accepts `_calibration` but doesn't use it — port as-is for parity. |
| **Phase 2 is the riskiest design work** | Vitest → JSON golden fixture export script is underspecified in the plan; agent must invent the dump mechanism. |
| **Phases 3 & 4 parallelizable** | Both depend only on Phase 2, not each other. |

## Decisions made (grill session 2026-06-08)

| ID | Decision | Rejected |
|---|---|---|
| D-01 | Backend-only: Python + FastAPI + parity tests; no client changes | Full vertical slice with React hooks |
| D-02 | Faithful NumPy port; hand-rolled GP Cholesky; same constants as `config.ts` | Rewrite with scipy/GPy now |
| D-03 | uv workspace: `packages/py-progress/`, `packages/py-roadmap-engine/`, `services/intelligence/` | Monolithic service folder only |
| D-04 | Mirror TS public API — separate REST endpoints per function | Single pipeline endpoint only |
| D-05 | Stateless v1 — JSON in request body; no Supabase in service | Service reads `public.events` |
| D-06 | Full parity: ~71 progress + ~31 roadmap unit tests; 10 canonical roadmap snapshots | Minimal hand-picked fixtures |
| D-07 | No auth on endpoints in v1 | API key / JWT from day one |
| D-08 | Keep TS packages until client migration | Delete TS engines after port |
| D-09 | Swappable backends later (`gp/numpy.py` vs `gp/gpy.py`) | Hard-code GPy |
| D-10 | Port `streak.ts` for full `computeProgress` parity | Slim API excluding display fields |

**Defaults (no further user input needed):** Python 3.12, uv, NumPy, FastAPI, Pydantic v2, pytest, httpx, ruff, float tolerance `1e-6`, CORS `localhost:5173`, Docker/Colima port 8000.

## Plan / phases

Full runbook: [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md)

| Phase | Status | Goal |
|---|---|---|
| 1 | ☐ Not started | uv workspace + FastAPI `/health` |
| 2 | ☐ Not started | Vitest fixture export → `tests/fixtures/pillar-a/` |
| 3 | ☐ Not started | Port `packages/py-progress` |
| 4 | ☐ Not started | Port `packages/py-roadmap-engine` |
| 5 | ☐ Not started | FastAPI routers + integration tests |
| 6 | ☐ Not started | Docker/Colima + README |

## Predicted files to touch

```
pyproject.toml                          # uv workspace root (NEW)
packages/py-progress/**                 # NEW
packages/py-roadmap-engine/**           # NEW
services/intelligence/**                # NEW FastAPI app
scripts/export-vitest-fixtures.mjs      # NEW (Phase 2)
tests/fixtures/pillar-a/**              # NEW golden JSON
docker-compose.yml                      # NEW (Phase 6)
```

**Do not touch:** `apps/app/**`, `packages/progress/**`, `packages/roadmap-engine/**` (TS stays until client slice).

## Acceptance criteria

- All pytest parity tests green against Vitest golden fixtures
- `pnpm --filter progress test` and `pnpm --filter roadmap-engine test` still pass (TS untouched)
- FastAPI endpoints mirror TS public API (`/v1/calibration`, `/v1/progress`, `/v1/roadmap/generate`, etc.)
- `GET /health` returns 200; service runs in Docker/Colima
- No React client changes

## Test strategy

1. Phase 2: export inputs + expected outputs from Vitest to JSON (`{name}.input.json`, `{name}.expected.json`)
2. Phases 3–4: parametrized pytest loading golden files; float tolerance `1e-6`
3. Phase 4: port fast-check property tests (determinism, foundation/practice phase invariants)
4. Phase 5: `httpx.AsyncClient` integration tests on HTTP layer

## Open questions & assumptions

| Item | Status |
|---|---|
| Fixture export script design | **Assumed** agent will build in Phase 2 — no spec beyond file naming |
| `uv` installed on dev machine | **Assumed** — not documented in `CLAUDE.md` yet |
| CI job for pytest | **Deferred** — optional, not blocking |
| `addMaterialToRoadmap` / `removeMaterialFromRoadmap` HTTP endpoints | **Assumed** deferred — plan lists generate/regenerate only; add if full API parity wanted |

## Dead ends

| Approach | Why ruled out |
|---|---|
| Service-pull from Supabase in v1 | Couples service to Supabase schema; breaks offline testability; client-push + cache is the agreed future pattern |
| scipy/GPy rewrite now | Numerical drift vs Vitest oracle; research winners swap in later via D-09 |
| Full vertical slice (client + backend same PR) | User chose backend-only (D-01); client wiring is lower-risk once API frozen |
| `/research` tier before service | Deferred; service port is independent |
| Hand-porting test cases without fixture export | User chose full parity (D-06); export script is the intended path |

## Next action

> Implement **Phase 1** of [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md): create uv workspace root, scaffold `packages/py-progress`, `packages/py-roadmap-engine`, `services/intelligence`, and verify `GET /health` returns 200.

**Suggested new-session prompt:**

```
Read 2026-06-08-pillar-a-fastapi-backend.md and ../../plans/active/2026-06-08-pillar-a-fastapi-backend.md.
Implement Phase 1 only. TS source in packages/progress and packages/roadmap-engine is the port spec.
Do not wire the React client.
```

## User context

- M.Tech thesis project: **Pillar A** (adaptation) + **Pillar B** (verification, Phase II, out of scope)
- Architecture diagram is the north star; this work was explicitly deferred from Review 1 prep (`../../plans/archive/2026-06-04-review1-prep-deferrals.md`) until now
- User ran `/grill-me` to plan before building; all scope questions resolved
- User will paste this handover directly to a fresh agent — plan doc is the implementation runbook, this doc is the decision context the plan doesn't fully carry
- E2E tests cannot be run in this environment (env issues) — write tests, don't try to run Playwright

## FastAPI endpoints (target)

| Endpoint | TS equivalent |
|---|---|
| `GET /health` | — |
| `POST /v1/calibration` | `computeCalibration` |
| `POST /v1/calibration/prompt-detail` | `getPromptDetail` |
| `POST /v1/progress` | `computeProgress` |
| `POST /v1/roadmap/generate` | `generateRoadmap` |
| `POST /v1/roadmap/regenerate` | `regenerateRoadmap` |

## Verification commands (after Phase 1)

```bash
export FNM_PATH="$HOME/.local/share/fnm" && export PATH="$FNM_PATH:$PATH" && eval "$(fnm env --shell bash)" && fnm use 22
export PNPM_HOME="$HOME/.local/share/pnpm" && export PATH="$PNPM_HOME:$PATH"

uv sync
uv run --package intelligence pytest services/intelligence/tests/test_health.py -q
curl -s http://localhost:8000/health
```
