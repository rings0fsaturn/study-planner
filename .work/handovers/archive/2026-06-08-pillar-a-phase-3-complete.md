---
title: Pillar A FastAPI Backend — Phase 3 Complete
purpose: Hand off py-progress port to next agent for Phase 4 (roadmap engine) + Phase 5 (FastAPI routers)
audience: agents
mode: transition
status: phase-3-complete
last_updated: 2026-06-08
related:
  - ./2026-06-08-pillar-a-phases-1-2-complete.md
  - ../plans/2026-06-08-pillar-a-fastapi-backend.md
  - ../packages/py-progress/
  - ../packages/roadmap-engine/
  - ../tests/fixtures/pillar-a/
---

# Pillar A FastAPI Backend — Phase 3 Complete

**Mode:** transition (py-progress done; roadmap port + HTTP layer next)

Continues from [`2026-06-08-pillar-a-phases-1-2-complete.md`](2026-06-08-pillar-a-phases-1-2-complete.md) (Phases 1–2) and [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md) (canonical runbook). Grill-session decisions D-01–D-10 live in the plan — do not re-litigate.

## TL;DR

**Phase 3 is done (uncommitted).** Full `packages/py-progress` port — Bayesian → CUSUM → Kalman → GP → calibration → progress — with **72/72 pytest parity tests green** against Vitest golden JSON. TS `packages/progress` untouched and still passes 72 Vitest tests. **Next session: implement Phase 4** (`py-roadmap-engine`, ~940 LOC port + 27 golden fixtures + 3 property tests), **then Phase 5** (Pydantic schemas, FastAPI `/v1/*` routers, httpx integration tests). Do not wire the React client.

## Goal / why

M.Tech thesis: Python is the single source of truth for Pillar A algorithms. Port TS engines to a uv workspace, prove parity via golden fixtures, expose via stateless FastAPI Intelligence Service. Client wiring (`IntelligenceClient`, Dexie cache) is explicitly deferred.

User constraints still in force:

- Faithful port; golden JSON is the regression oracle (`1e-6` float tolerance)
- **Do not wire the React client** (`apps/app/**`)
- **Do not delete** `packages/progress` or `packages/roadmap-engine`
- TS packages are the port spec; hand-port only when fixtures are insufficient

## Key references

| Path | Why it matters |
|---|---|
| [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md) | **Canonical runbook** — phase steps, verification, status markers |
| [`packages/progress/src/`](../../../packages/progress/src/) | TS spec for calibration/progress (already ported) |
| [`packages/py-progress/src/py_progress/`](../../../packages/py-progress/src/py_progress/) | **Completed Python port** — reuse patterns (dates, serialize, test harness) |
| [`packages/roadmap-engine/src/roadmap-engine.ts`](../../../packages/roadmap-engine/src/roadmap-engine.ts) | **Phase 4 port spec** (~940 LOC constraint scheduler) |
| [`packages/roadmap-engine/src/constants.ts`](../../../packages/roadmap-engine/src/constants.ts) | Hyperparameters → `py_roadmap_engine/constants.py` |
| [`tests/fixtures/pillar-a/roadmap/`](../../../tests/fixtures/pillar-a/roadmap/) | 27 golden cases for Phase 4 pytest |
| [`scripts/fixture-export/roadmap-cases.ts`](../../../scripts/fixture-export/roadmap-cases.ts) | Fixture `fn` routing reference |
| [`services/intelligence/app/main.py`](../../../services/intelligence/app/main.py) | Phase 5 starting point — `/health` only today |
| [`packages/py-progress/tests/test_fixtures.py`](../../../packages/py-progress/tests/test_fixtures.py) | **Template** for parametrized golden-fixture parity tests |

## What was implemented (Phase 3)

### Algorithm modules (`packages/py-progress/src/py_progress/`)

| File | TS equivalent |
|---|---|
| `types.py` | `types.ts` |
| `config.py` | `config.ts` |
| `bayesian.py` | `bayesian.ts` |
| `cusum.py` | `cusum.ts` |
| `kalman.py` | `kalman.ts` |
| `trend.py` | `trend.ts` |
| `gp.py` | `gp.ts` (hand-rolled Cholesky GP) |
| `streak.py` | `streak.ts` |
| `calibration.py` | `calibration.ts` |
| `progress.py` | `progress.ts` |
| `dates.py` | JS `new Date('YYYY-MM-DD')` overflow semantics |
| `serialize.py` | dataclass → JSON for test assertions |

### Tests

| File | Coverage |
|---|---|
| `packages/py-progress/tests/conftest.py` | Parametrize 72 cases; sets `TZ=Asia/Kolkata` |
| `packages/py-progress/tests/test_fixtures.py` | Loads `tests/fixtures/pillar-a/progress/*.input.json`, routes by `"fn"`, asserts against `.expected.json` |

### Public Python API (snake_case mirrors TS)

`compute_calibration`, `get_prompt_detail`, `compute_progress`, plus lower-level exports in `__init__.py`.

## What I learned — parity gotchas (carry to Phase 4)

| Gotcha | Detail |
|---|---|
| **Timezone** | `inferTimeOfDay` uses JS `getHours()` (local). Fixtures exported in `Asia/Kolkata`. Set `TZ=Asia/Kolkata` in pytest `conftest.py`. |
| **Date overflow** | TS accepts invalid calendar dates (`2026-01-32` → Feb 1). Use `dates.parse_date_only()` pattern — port equivalent to `py_roadmap_engine/dates.py` or share module. |
| **Fixture `fn` routing** | Each `*.input.json` has `"fn"` key mapping to TS function name. Deserialize `exceptionalIds` → `set`. |
| **CUSUM fixture dispatch** | When `std` absent: low-variance signals use sample mean; abrupt-shift uses input `mean` (1.0) for both reference and std denominator. See `test_fixtures.py` `runCUSUM` branch. |
| **mulberry32** | Needs 32-bit signed `Math.imul` semantics (`ctypes.c_int32`) for deterministic RNG fixtures. |
| **Float tolerance** | `1e-6` rel+abs in `_assert_close`. |

## Plan / phases — status

| Phase | Status | Goal |
|---|---|---|
| 1 | ✅ `4cda8c9` | uv workspace + FastAPI `/health` |
| 2 | ✅ `4cda8c9` | 72 progress + 27 roadmap golden JSON fixtures |
| 3 | ✅ **Complete — uncommitted** | Port `py-progress`; 72 pytest green |
| 4 | ☐ **Next** | Port `py-roadmap-engine` |
| 5 | ☐ After 4 | FastAPI routers + integration tests |
| 6 | ☐ After 5 | Docker + README |

### Phase 4 — port `packages/py-roadmap-engine`

**Goal:** All roadmap parity + property tests green.

**Steps:**

1. `constants.py` ← `packages/roadmap-engine/src/constants.ts`
2. `types.py` ← roadmap-engine types
3. `engine.py` ← `roadmap-engine.ts` (~940 LOC)
4. Public API: `generate_roadmap`, `infer_role`, `add_material_to_roadmap`, `remove_material_from_roadmap`, `regenerate_roadmap`
5. `packages/py-roadmap-engine/tests/test_fixtures.py` — parametrized pytest against `tests/fixtures/pillar-a/roadmap/` (27 cases)
6. **Native property tests** (not in golden JSON — excluded from Vitest export):
   - Determinism: same input → identical output
   - Foundation not in last ⅓ of slots
   - Practice not in first ⅓ for N≥3 materials

**Fixture `fn` values in roadmap/** (27 cases):

`generateRoadmap` (18), `inferRole` (4), `addMaterialToRoadmap` (3), `removeMaterialFromRoadmap` (2), `regenerateRoadmap` (2)

**Verification:**

```bash
export PATH="$HOME/.local/bin:$PATH"
export TZ=Asia/Kolkata
uv run --package py-roadmap-engine pytest packages/py-roadmap-engine/tests -q
cd packages/roadmap-engine && node_modules/.bin/vitest run   # 30 passed
```

**Note:** 9 `generateRoadmap` canonical unit tests share identical I/O — intentional 1:1 Vitest mapping.

### Phase 5 — FastAPI routers + integration tests

**Depends on:** Phases 3 ✅ and 4.

**Goal:** HTTP API mirrors TS public API; integration tests pass.

**Endpoints to implement:**

| Endpoint | TS equivalent |
|---|---|
| `POST /v1/calibration` | `computeCalibration` |
| `POST /v1/calibration/prompt-detail` | `getPromptDetail` |
| `POST /v1/progress` | `computeProgress` |
| `POST /v1/roadmap/generate` | `generateRoadmap` |
| `POST /v1/roadmap/regenerate` | `regenerateRoadmap` |

Deferred unless full parity wanted: `addMaterial` / `removeMaterial` HTTP endpoints (fixtures exist; plan defers to later).

**Steps:**

1. `services/intelligence/app/schemas/` — Pydantic v2 models mirroring TS types
2. `services/intelligence/app/routers/` — `calibration.py`, `progress.py`, `roadmap.py`
3. Wire routers in `main.py` under `/v1/`
4. `services/intelligence/tests/` — `httpx.AsyncClient` POST fixture JSON → assert golden response
5. Add `py-progress` + `py-roadmap-engine` as dependencies of `intelligence` service in `pyproject.toml`

**Verification:**

```bash
uv run --package intelligence pytest services/intelligence/tests -q
```

## Predicted files to touch (Phases 4–5)

```
packages/py-roadmap-engine/src/py_roadmap_engine/constants.py   # NEW
packages/py-roadmap-engine/src/py_roadmap_engine/types.py         # NEW
packages/py-roadmap-engine/src/py_roadmap_engine/engine.py        # NEW (~940 LOC)
packages/py-roadmap-engine/tests/conftest.py                      # NEW
packages/py-roadmap-engine/tests/test_fixtures.py                 # NEW
packages/py-roadmap-engine/tests/test_properties.py               # NEW (3 fast-check reimpls)

services/intelligence/app/schemas/*.py                            # NEW
services/intelligence/app/routers/calibration.py                  # NEW
services/intelligence/app/routers/progress.py                     # NEW
services/intelligence/app/routers/roadmap.py                      # NEW
services/intelligence/app/main.py                                 # wire routers
services/intelligence/pyproject.toml                              # add workspace deps
services/intelligence/tests/test_integration_*.py                 # NEW
```

**Do not touch:** `apps/app/**`, `packages/progress/**`, `packages/roadmap-engine/**` (unless regenerating fixtures).

## Acceptance criteria (Phases 4–5)

- `uv run --package py-roadmap-engine pytest` — 27 golden + 3 property tests green
- `uv run --package intelligence pytest` — health + integration tests green
- `pnpm --filter progress test` and `pnpm --filter roadmap-engine test` still pass
- No React client changes
- FastAPI endpoints accept JSON bodies matching fixture input shape (minus `"fn"` key)

## Verification commands (full stack check)

```bash
export PATH="$HOME/.local/bin:$PATH"
export TZ=Asia/Kolkata

# Phase 3 (already green)
uv run --package py-progress pytest packages/py-progress/tests -q          # 72 passed

# Phase 4 (target)
uv run --package py-roadmap-engine pytest packages/py-roadmap-engine/tests -q

# Phase 5 (target)
uv run --package intelligence pytest services/intelligence/tests -q

# TS oracle still green
cd packages/progress && node_modules/.bin/vitest run                        # 72 passed
cd packages/roadmap-engine && node_modules/.bin/vitest run                # 30 passed

# Regenerate fixtures if TS changes
node scripts/export-vitest-fixtures.mjs
```

## In-flight state

| Item | State |
|---|---|
| **Last commit** | `4cda8c9` — Phases 1–2 (workspace + golden fixtures) |
| **Phase 3 code** | **Uncommitted** — all `packages/py-progress/src/py_progress/*.py` + tests |
| **Plan file** | `../../plans/active/2026-06-08-pillar-a-fastapi-backend.md` updated: Phase 3 `✅ Complete — uncommitted` |
| **`py-roadmap-engine`** | Empty scaffold only (`__init__.py`) |
| **`services/intelligence`** | `/health` + CORS; no `/v1/*` routers yet |

## Dead ends

| Approach | Why ruled out |
|---|---|
| scipy/GPy for GP | D-02: hand-rolled NumPy GP to match TS oracle exactly |
| UTC-only `inferTimeOfDay` | Breaks golden fixtures exported with local `getHours()` |
| Strict `datetime.fromisoformat` for session dates | Breaks `2026-01-32` style dates in regime-shift fixtures |
| `pnpm --filter` for fixture export | Corepack 403 on dev machine — use direct vitest binary |

## Open questions & assumptions

| Item | Status |
|---|---|
| Phase 4 + 5 in one session | **Assumed** user wants both; Phase 5 blocked until Phase 4 green |
| `addMaterial` / `removeMaterial` HTTP | **Deferred** per plan — port engine functions in Phase 4, HTTP optional in Phase 5 |
| Share `dates.py` across packages | **Open** — duplicate in `py_roadmap_engine` or extract shared util |
| Commit Phase 3 before Phase 4 | **Assumed** user may commit when ready — not done this session |
| CI pytest job | **Deferred** per plan |

## Next action

> Read this doc and [`../../plans/active/2026-06-08-pillar-a-fastapi-backend.md`](../../plans/active/2026-06-08-pillar-a-fastapi-backend.md). Implement **Phase 4** first (`packages/py-roadmap-engine` against `tests/fixtures/pillar-a/roadmap/`), then **Phase 5** (Pydantic schemas + FastAPI routers + httpx integration tests). Copy the `py-progress` test-harness pattern. Do not wire the React client.

**Suggested new-session prompt:**

```
Read 2026-06-08-pillar-a-phase-3-complete.md and ../../plans/active/2026-06-08-pillar-a-fastapi-backend.md.
Implement Phase 4 then Phase 5. TS source in packages/roadmap-engine is the port spec;
golden fixtures in tests/fixtures/pillar-a/roadmap/. Do not wire the React client.
```

## User context

- M.Tech thesis Pillar A backend; client wiring deferred to a later slice
- User will paste this handover to a fresh agent for Phase 4 + 5
- E2E / Playwright cannot run in agent environment — write tests, don't run them
- Phases 1–2 committed; Phase 3 complete but uncommitted at handover time
