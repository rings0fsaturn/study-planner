---
title: Pillar A FastAPI Backend — Phases 1–2 Complete
purpose: Hand off implemented scaffold + golden fixtures to the next agent session for Python porting (Phases 3–6)
audience: agents
mode: transition
status: phases-1-2-complete
last_updated: 2026-06-08
related:
  - ./2026-06-08-pillar-a-fastapi-backend.md
  - ../plans/2026-06-08-pillar-a-fastapi-backend.md
  - ../packages/progress/
  - ../packages/roadmap-engine/
  - ../tests/fixtures/pillar-a/
---

# Pillar A FastAPI Backend — Phases 1–2 Complete

**Mode:** transition (scaffold + fixtures done; Python port not started)

Continues from [`2026-06-08-pillar-a-fastapi-backend.md`](2026-06-08-pillar-a-fastapi-backend.md) (grill-session decisions). That doc still holds D-01–D-10 and architectural context — **do not re-read the grill session**; read this doc for implementation state.

## TL;DR

**Phases 1 and 2 are done (uncommitted).** uv workspace + FastAPI `/health` skeleton exist; 72 progress + 27 roadmap golden JSON fixtures exported from Vitest. **No Python algorithm code yet** — `py-progress` and `py-roadmap-engine` are empty scaffolds. TS packages untouched; React client not wired. **Next session: implement Phase 3** — port `packages/py-progress` bottom-up against golden fixtures.

## Goal / why

Backend-only Python port of Pillar A (Bayesian → CUSUM → GP → constraint scheduler) as the thesis architecture's Intelligence Service. User constraints still in force:

- Faithful NumPy port; Vitest golden JSON is the regression oracle
- **Do not wire the React client**
- **Do not delete** `packages/progress` or `packages/roadmap-engine` until a later slice
- TS source in those packages is the port spec

## Key references

| Path | Why it matters |
|---|---|
| [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md) | **Canonical runbook** — phase steps, verification commands, status markers |
| [`packages/progress/src/`](../../../packages/progress/src/) | TS port spec — calibration, CUSUM, Kalman, GP, progress |
| [`packages/roadmap-engine/src/roadmap-engine.ts`](../../../packages/roadmap-engine/src/roadmap-engine.ts) | TS port spec — constraint scheduler (~940 LOC) |
| [`packages/progress/src/config.ts`](../../../packages/progress/src/config.ts) | Hyperparameters — copy verbatim into `py_progress/config.py` |
| [`tests/fixtures/pillar-a/`](../../../tests/fixtures/pillar-a/) | Golden JSON for pytest parity (Phase 3–4) |
| [`scripts/export-vitest-fixtures.mjs`](../../../scripts/export-vitest-fixtures.mjs) | Regenerate fixtures after TS changes |
| [`scripts/fixture-export/progress-cases.ts`](../../../scripts/fixture-export/progress-cases.ts) | 72 progress case definitions |
| [`scripts/fixture-export/roadmap-cases.ts`](../../../scripts/fixture-export/roadmap-cases.ts) | 27 roadmap case definitions |

## What was implemented

### Phase 1 — uv workspace + FastAPI skeleton ✅

| Artifact | Purpose |
|---|---|
| `pyproject.toml` | uv workspace root; shared pytest/ruff config |
| `uv.lock` | Lockfile (generated; commit with code) |
| `packages/py-progress/` | Empty package scaffold (`numpy` dep) |
| `packages/py-roadmap-engine/` | Empty package scaffold |
| `services/intelligence/app/main.py` | FastAPI + CORS `localhost:5173` + `GET /health` |
| `services/intelligence/tests/test_health.py` | Health endpoint test (1 passed) |
| `services/intelligence/README.md` | Run instructions |
| `.gitignore` | Added Python/uv entries |

### Phase 2 — Golden fixture export ✅

| Artifact | Purpose |
|---|---|
| `scripts/export-vitest-fixtures.mjs` | Entry point: `node scripts/export-vitest-fixtures.mjs` |
| `scripts/fixture-export/` | Case definitions + `export-all.ts` |
| `packages/progress/vitest.fixture-export.config.ts` | Vitest config (must live under `packages/progress` for module resolution) |
| `tests/fixtures/pillar-a/progress/` | 72 cases × 2 files = 144 JSON files |
| `tests/fixtures/pillar-a/roadmap/` | 27 cases × 2 files = 54 JSON files |

**Fixture format** (each case):

```
{name}.input.json    → { "fn": "<functionName>", ...args }
{name}.expected.json → full TS function output (oracle)
```

**Coverage notes:**

- 72 progress cases = all 72 Vitest `it()` blocks across 8 test files
- 27 roadmap cases = all unit + snapshot tests; **excludes 3 fast-check property tests** (determinism, foundation-not-in-last-third, practice-not-in-first-third) — Phase 4 reimplements those natively in pytest
- 10 canonical roadmap snapshots included (`snapshot-canonical-8-week-ddia`, `snapshot-n1-emergency-cram`, etc.)

### Agent gotchas discovered during implementation

| Gotcha | Detail |
|---|---|
| **Vitest config location** | Config in `scripts/fixture-export/` fails module resolution. Use `packages/progress/vitest.fixture-export.config.ts` and run vitest with `cwd: packages/progress`. |
| **`pnpm` / corepack** | `pnpm --filter` may 403 on this machine. Export script calls `packages/progress/node_modules/.bin/vitest` directly. |
| **`uv` not on PATH** | Installed to `~/.local/bin/uv` during Phase 1. Add to PATH or use full path. |
| **`uv sync` vs `--all-packages`** | Plain `uv sync` only installs root dev deps; `uv run --package intelligence` auto-installs workspace packages. |
| **Python 3.14 used** | Satisfies `>=3.12`. Pin with `.python-version` if 3.12 required for thesis reproducibility. |
| **Duplicate roadmap fixtures** | 9 `generateRoadmap` canonical unit tests share identical input/output — intentional 1:1 Vitest mapping. |
| **CUSUM stable-signal test** | Original Vitest uses `Math.random()`; fixture uses `mulberry32(99)` for determinism. |

## Decisions made (unchanged from grill session)

See prior handover for D-01–D-10. No new decisions this session.

## Plan / phases — status

Full runbook: [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md)

| Phase | Status | Goal |
|---|---|---|
| 1 | ✅ Complete | uv workspace + FastAPI `/health` |
| 2 | ✅ Complete | Vitest fixture export → `tests/fixtures/pillar-a/` |
| 3 | ☐ **Next** | Port `packages/py-progress` |
| 4 | ☐ Not started | Port `packages/py-roadmap-engine` (parallelizable after Phase 2) |
| 5 | ☐ Not started | FastAPI routers + integration tests |
| 6 | ☐ Not started | Docker/Colima + README |

### Phase 3 — what to build next

**Goal:** All progress parity tests green.

**Bottom-up port order** (from plan):

1. `packages/py-progress/src/py_progress/types.py` — dataclasses matching `packages/progress/src/types.ts`
2. `config.py` — copy constants from `config.ts`
3. `bayesian.py` → `cusum.py` → `kalman.py` → `trend.py` → `gp.py` → `streak.py`
4. `calibration.py` — `compute_calibration()`, `get_prompt_detail()`
5. `progress.py` — `compute_progress()`
6. `packages/py-progress/tests/` — parametrized pytest loading `tests/fixtures/pillar-a/progress/*.input.json`

**Verification:**

```bash
export PATH="$HOME/.local/bin:$PATH"
uv run --package py-progress pytest packages/py-progress/tests -q
pnpm --filter progress exec vitest run   # TS still passes
```

**Fixture routing:** Each `*.input.json` has `"fn"` key — map to Python function. Deserialize `exceptionalIds` arrays to `set` where needed. Float tolerance `1e-6`.

### Phase 4 — roadmap engine (can run parallel to Phase 3)

1. `constants.py` from `packages/roadmap-engine/src/constants.ts`
2. `engine.py` — port `roadmap-engine.ts` (~940 LOC)
3. API: `generate_roadmap`, `infer_role`, `add_material_to_roadmap`, `remove_material_from_roadmap`, `regenerate_roadmap`
4. pytest against `tests/fixtures/pillar-a/roadmap/` + native property tests for the 3 fast-check cases

### Phase 5 — HTTP layer

Pydantic schemas + routers (`/v1/calibration`, `/v1/progress`, `/v1/roadmap/*`) + httpx integration tests.

### Phase 6 — Docker

`Dockerfile`, `docker-compose.yml`, curl examples in README.

## Predicted files to touch (Phases 3–6)

```
packages/py-progress/src/py_progress/*.py     # NEW — algorithm modules
packages/py-progress/tests/                   # NEW — parametrized parity tests
packages/py-roadmap-engine/src/py_roadmap_engine/*.py
packages/py-roadmap-engine/tests/
services/intelligence/app/routers/
services/intelligence/app/schemas/
services/intelligence/tests/                  # integration tests
services/intelligence/Dockerfile
docker-compose.yml
```

**Do not touch:** `apps/app/**`, `packages/progress/**`, `packages/roadmap-engine/**` (unless regenerating fixtures).

## Acceptance criteria (overall plan)

- All pytest parity tests green against golden fixtures
- `pnpm --filter progress test` and `pnpm --filter roadmap-engine test` still pass
- FastAPI endpoints mirror TS public API
- `GET /health` returns 200; service runs in Docker
- No React client changes

## Verification commands

```bash
# Python workspace
export PATH="$HOME/.local/bin:$PATH"
uv sync
uv run --package intelligence pytest services/intelligence/tests/test_health.py -q

# Regenerate golden fixtures
node scripts/export-vitest-fixtures.mjs

# Fixture counts
ls tests/fixtures/pillar-a/progress/*.input.json | wc -l   # 72
ls tests/fixtures/pillar-a/roadmap/*.input.json | wc -l    # 27

# TS still green
cd packages/progress && node_modules/.bin/vitest run        # 72 passed
cd packages/roadmap-engine && node_modules/.bin/vitest run  # 30 passed
```

## In-flight state

- **All Phase 1–2 work is uncommitted** (user did not request commits)
- Last commit on branch: `38dcc59` — unrelated sync fix
- Plan file `../../plans/active/2026-06-08-pillar-a-fastapi-backend.md` updated: Phases 1–2 marked `✅ Complete` (no commit sha)

## Open questions & assumptions

| Item | Status |
|---|---|
| Commit Phase 1–2 work | **Assumed** user will commit when ready — not done this session |
| Python 3.12 vs 3.14 | **Assumed** 3.14 OK; pin if thesis requires 3.12 |
| CI job for pytest | **Deferred** per plan |
| `addMaterial` / `removeMaterial` HTTP endpoints | **Deferred** to Phase 5 unless full API parity wanted |

## Dead ends

| Approach | Why ruled out |
|---|---|
| Vitest config in `scripts/fixture-export/` | Module resolution fails — moved to `packages/progress/` |
| `pnpm --filter` for fixture export | Corepack 403 on this machine — direct vitest binary instead |
| Hand-porting test cases without fixture registry | Plan chose explicit case definitions mirroring each `it()` block |

## Next action

> Open [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md) and implement **Phase 3**: port `packages/py-progress` bottom-up (`types.py` → `config.py` → engines → `calibration.py` / `progress.py`) with parametrized pytest against `tests/fixtures/pillar-a/progress/`.

**Suggested new-session prompt:**

```
Read 2026-06-08-pillar-a-phases-1-2-complete.md and ../../plans/active/2026-06-08-pillar-a-fastapi-backend.md.
Implement Phase 3 only. TS source in packages/progress is the port spec; golden fixtures in tests/fixtures/pillar-a/progress/.
Do not wire the React client.
```

## User context

- M.Tech thesis: Pillar A backend port; client wiring deferred
- User will paste this handover to a fresh agent — plan doc is the implementation runbook, this doc is current state
- E2E tests cannot be run in this environment — write tests, don't try to run Playwright
- User asked for handover after completing Phases 1–2; may want Phase 3 next or Phase 3+4 in parallel
