---
title: Handover — Live Docker Test for Productionized Worker + Sidecar Query-Embedder
purpose: Give the next session everything needed to run the live-container verification that the prior session could not (docker was unavailable)
audience: implementers, verifiers
status: active
last_updated: 2026-08-20
related:
  - .work/plans/active/2026-08-20-productionize-worker-and-query-embedder/PLAN.md
  - .work/plans/active/2026-08-20-productionize-worker-and-query-embedder/VERIFICATION.md
  - .work/STATUS.md
applies_to:
  - docker-compose.yml
  - services/embedder/docker-compose.yml
  - services/intelligence/app/query_embedder.py
  - services/intelligence/app/routers/retrieval.py
  - services/intelligence/scripts/retrieval_probe.py
---

## What the last session did

The `2026-08-20-productionize-worker-and-query-embedder` plan was **fully implemented offline** in one session. All 5 vertical slices are code-complete and unit-tested via mocks:

| Phase | What landed | Test gate (offline) |
|---|---|---|
| Phase 0 | Plan + `VERIFICATION.md` + `STATUS.md` active row | doc-only |
| Phase 1 | `docker-compose.yml` `ingestion-worker` widened to `EMBEDDING_PROVIDER/EMBEDDER_URL/RERANKER_URL` + `INGESTION_*` tuning, `extra_hosts`, `healthcheck`, `depends_on: healthy`; `docker/.env.example` + `services/intelligence/.env.example` documented `qwen-sidecar` + `EMBEDDING_BATCH_SIZE=128`; `services/embedder/docker-compose.yml` default `64→128` | `yaml.safe_load` only |
| Phase 2 | `services/intelligence/app/worker_main.py` graceful `SIGTERM/SIGINT` + `shared_client.close()` + factory delegation; `scripts/dev-ingestion-worker.mjs` provider log; `docker-app` `--with-embedder` orchestrator + `/health` wait | `pytest -k worker` pass |
| Phase 3 | New `services/intelligence/app/query_embedder.py` (`get_embedder`/`embed_queries is_query=True`/`embed_chunks is_query=False`) reusing `EMBEDDING_PROVIDER`; `services/intelligence/tests/test_query_embedder.py` (5 tests) | ✅ mock transport |
| Phase 4 | `services/intelligence/scripts/retrieval_probe.py` `--provider {sidecar,gemini}` default `sidecar`, `embed_query_sidecar` (`is_query:true`, `services/intelligence/app/ingestion/embeddings_sidecar.py:116-127`); `services/intelligence/tests/test_retrieval_probe.py` (2 tests) | ✅ mock transport |
| Phase 5 | `services/intelligence/app/routers/retrieval.py` `POST /v1/retrieval/search` gated `RETRIEVAL_ENABLED`, owner check before `service_role` `match_content_chunks` (`016:15-85` hybrid `k=60 wL0.7 pool25`), optional `RerankerClient` (`rerank.py:73-92`); wired at `services/intelligence/app/main.py:8,74`; `services/intelligence/tests/test_retrieval.py` (6 tests) | ✅ `TestClient(app)` mocked |

Full suite in that session: `286 passed / 5 failed` where the 5 are **pre-existing** golden-fixture failures in `services/intelligence/tests/test_v1_integration.py:83` (`progress/get-prompt-detail-breakpoint` `afternoon != evening`), unchanged.

## What was NOT tested live

`docker compose config` could not run — `docker` CLI was absent in the prior WSL distro (`docker could not be found ... activate WSL integration`). Consequently none of these were exercised against real containers:

- `docker-compose.yml:42-76` worker healthcheck and `extra_hosts: host.docker.internal:host-gateway`
- `services/embedder/app/main.py:169-238` `/health` (`dimensions 768`, `cuda_available true`, `loaded && reranker_loaded`), `/embed is_query`, `/rerank`
- `services/intelligence/app/routers/retrieval.py:27-114` against a real Supabase RPC + durable corpus `80c8b138-b544-4095-8dc0-1c390ac70da2` (`754/qwen-sidecar`)
- `scripts/retrieval_probe.py --provider sidecar --hybrid` live MRR (expect `~0.70-0.72`, not the `0.356` cross-space that `retrieval_probe.py:53-72` used to produce on Gemini)

## When to run this handover

Now that the user reports `docker service started` (2026-08-20). The next session should treat this as the **live-container verification pass** before marking criteria 8–9 done in `VERIFICATION.md`.

## Prerequisites for the live session

- `docker` + `docker compose v2` available (`docker compose version`, `docker info`)
- `services/intelligence/.env` present with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (or at least `SUPABASE_PUBLISHABLE_KEY` for the `TestClient` JWT)
- `.env.git.local` present with `HF_TOKEN` (for sidecar model pull) and `GH_TOKEN` if needed
- `e2e/pdf/sample-textbook-572page.pdf` exists (canonical 572p fixture)
- Durable corpus `80c8b138-b544-4095-8dc0-1c390ac70da2` still `ready / qwen-sidecar / 754` — verify with `supabase db query` (see Step 0)
- No `supabase db push` needed — this plan has **no migration**; `db push --dry-run` must stay `Remote database is up to date` (`36-supabase-live-stack.agents.md:26-38`)

## Docker verification procedure

### Step 0: Confirm the durable corpus is still ready

```bash
npx --yes supabase@latest db query --linked --project-ref kabpmbhlvfbrhtbxjaua \
  "select id, ingestion_state, embedding_provider, chunk_count from public.materials where id='80c8b138-b544-4095-8dc0-1c390ac70da2';"
# expect: ready | qwen-sidecar | 754
npx --yes supabase@latest db query --linked --project-ref kabpmbhlvfbrhtbxjaua \
  "select count(*) as chunks, count(*) filter (where embedding is not null) as embedded from public.content_chunks where material_id='80c8b138-b544-4095-8dc0-1c390ac70da2';"
# expect: 754 | 754
```

If the row is `failed` or missing, re-run the corpus restore (`services/intelligence/scripts/corpus_restore.py restore --pdf e2e/pdf/sample-textbook-572page.pdf`) before proceeding — do not change the probe.

### Step 1: Validate compose parsing

```bash
./docker-app config 2>&1 | grep -E "EMBEDDING_PROVIDER|EMBEDDER_URL|RERANKER_URL"  # must show the new env passthrough
grep -c "EMBEDDING_BATCH_SIZE.*128" services/embedder/docker-compose.yml  # 1
grep -A2 "healthcheck" docker-compose.yml | head -n 20  # worker healthcheck present
```

### Step 2: Bring up the sidecar, then the full stack

```bash
# The --with-embedder flag (docker-app:26-55) exports HF_TOKEN and waits on /health.
./docker-app --with-embedder start
./docker-app status
docker compose -f services/embedder/docker-compose.yml ps
curl -s http://127.0.0.1:8200/health | python -m json.tool
# expect: status ok, dimensions 768, cuda_available true, loaded true, reranker_loaded true,
#         device cuda:0, device_name AMD Radeon RX 9070 XT (per 54-gpu-inference-sidecar.agents.md)
curl -s http://127.0.0.1:8200/health; echo
curl -s http://127.0.0.1:8000/health | python -m json.tool  # intelligence
```

If `cuda_available` is false, the `LD_LIBRARY_PATH=/opt/rocm/lib` whole-dir mount or `/dev/dxg` device passthrough is broken (`services/embedder/docker-compose.yml:33-42`, `54:19-34`). Check `docker compose -f services/embedder/docker-compose.yml logs` for `librocdxg` errors before touching code.

### Step 3: Probe the worker through the standalone path

```bash
docker compose logs ingestion-worker --tail 50 | grep -i "embedding provider"
# expect: embedding provider: sidecar (http://host.docker.internal:8200)  (worker_main.py:46)
# If it still says gemini, EMBEDDING_PROVIDER was not exported into the compose env — check apps/app/.env.local vs .env precedence (docker-app:46-61)
```

### Step 4: Live retrieval probe — sidecar query-embed must win

```bash
cd services/intelligence
../../.venv/bin/python scripts/retrieval_probe.py 80c8b138-b544-4095-8dc0-1c390ac70da2 --hybrid --provider sidecar
# expect: Provider: sidecar, MRR ~0.70-0.72 on 754 (NOT 0.356)
# control (should be worse cross-space or require GEMINI_API_KEY):
../../.venv/bin/python scripts/retrieval_probe.py 80c8b138-b544-4095-8dc0-1c390ac70da2 --hybrid --provider gemini || echo "gemini probe needs GEMINI_API_KEY — expected if unset"
```

This is the parity gate for criterion 5 in `VERIFICATION.md`. The delta from `0.356` to `~0.72` is the whole point of `scripts/retrieval_probe.py:84-108` sidecar branch.

### Step 5: Live retrieval endpoint — POST /v1/retrieval/search

```bash
# Mint a JWT for the durable-corpus owner, or reuse the dev login flow.
# Example with HS256 (if SUPABASE_JWT_SECRET is set in services/intelligence/.env):
SUPABASE_JWT_SECRET="$(grep '^SUPABASE_JWT_SECRET=' services/intelligence/.env | cut -d= -f2- | tr -d '\r')"
# Generate a token for user-123 / the actual owner id — see services/intelligence/tests/test_auth.py:27-38 for shape.

curl -s http://127.0.0.1:8000/v1/retrieval/search \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"materialId":"80c8b138-b544-4095-8dc0-1c390ac70da2","query":"ACCA materiality threshold","topK":5,"hybrid":true}' \
  | python -m json.tool
# expect: 200, chunks[0].similarity, chunks length 5

# Hybrid off:
curl -s http://127.0.0.1:8000/v1/retrieval/search \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"materialId":"80c8b138-b544-4095-8dc0-1c390ac70da2","query":"ACCA materiality","topK":5,"hybrid":false}' \
  | python -m json.tool

# Rerank on:
curl -s http://127.0.0.1:8000/v1/retrieval/search \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"materialId":"80c8b138-b544-4095-8dc0-1c390ac70da2","query":"ACCA materiality","topK":5,"hybrid":true,"rerank":true}' \
  | python -m json.tool
# expect: reranked true, indices array, chunks reordered

# Negative: wrong owner should 404 (retrieval.py:76)
# Negative: no token should 401 (security.py:30-39)
curl -s http://127.0.0.1:8000/v1/retrieval/search -H "Content-Type: application/json" \
  -d '{"materialId":"80c8b138-b544-4095-8dc0-1c390ac70da2","query":"x"}' | python -m json.tool
# expect: 401

# Gate off:
RETRIEVAL_ENABLED=false curl -s http://127.0.0.1:8000/v1/retrieval/search -H "Authorization: Bearer $TOKEN" ... # 404
```

### Step 6: Cross-cutting gates (still required)

```bash
.venv/bin/python -m pytest services/intelligence/tests/test_query_embedder.py services/intelligence/tests/test_retrieval_probe.py services/intelligence/tests/test_retrieval.py -q
.venv/bin/python -m pytest services/intelligence/tests -q  # expect 5 pre-existing golden-fixture failures only (test_v1_integration.py:83)
.venv/bin/python -m ruff check services/intelligence/app/query_embedder.py services/intelligence/app/routers/retrieval.py services/intelligence/scripts/retrieval_probe.py
npx --yes supabase@latest db push --dry-run --linked --project-ref kabpmbhlvfbrhtbxjaua  # Remote database is up to date.
```

### Step 7: Record evidence and close the plan

On success, update `.work/plans/active/2026-08-20-productionize-worker-and-query-embedder/VERIFICATION.md` criteria 8–9 to ✅, append the evidence block (health JSON, probe MRR lines, curl outputs truncated to 200 chars), and move the task per `.work/README.md` lifecycle (distill → `plans/archive/` → `STATUS.md` row → Done).

## Troubleshooting

### Symptom: `embedder /health` returns `dimensions 768` but `cuda_available false`

Whole-dir `LD_LIBRARY_PATH=/opt/rocm/lib` mount is missing or `librocdxg.so` symlink not resolved. Check `docker compose -f services/embedder/docker-compose.yml logs | grep -i rocdxg` and `ls /opt/rocm/lib` on host (`54-gpu-inference-sidecar.agents.md:19-34`). Do not add single-file `libhsa-runtime64.so.1` mounts — they break GPU init.

### Symptom: `ingestion-worker` logs `embedding provider: gemini` despite `EMBEDDING_PROVIDER=qwen-sidecar` in `docker/.env.example`

Compose env file precedence is `apps/app/.env.local` over `.env` (`docker-app:46-61`). Export `EMBEDDING_PROVIDER=qwen-sidecar` in the resolved env file or pass `--env-file`.

### Symptom: retrieval probe still MRR 0.356 after switching to `--provider sidecar`

The probe is still hitting Gemini — verify `embed_query_sidecar` path is taken (`scripts/retrieval_probe.py:84-108` logs `Provider: sidecar`). Check `EMBEDDER_URL` — inside Docker it must be `http://host.docker.internal:8200` (via `extra_hosts`), on host `http://localhost:8200` (`docker-compose.yml:42-60` vs `services/intelligence/.env.example`).

### Symptom: `POST /v1/retrieval/search` returns `500 search not configured`

`SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` not set in the `intelligence` container env (`services/intelligence/app/routers/retrieval.py:56-62`). Restart with the right env file.

### Symptom: WSL Vite stale code after editing app source

`53-wsl-dev-runtime.agents.md` — `full-app restart` before browser verification; not live for this handover.

## Files to read on entry

- `.work/plans/active/2026-08-20-productionize-worker-and-query-embedder/PLAN.md` — Decisions D-A…F, architecture diagram, per-phase steps
- `.work/plans/active/2026-08-20-productionize-worker-and-query-embedder/VERIFICATION.md` — acceptance criteria 1–9
- `docker-compose.yml:42-76` — worker widened env + `extra_hosts` + `healthcheck`
- `services/embedder/docker-compose.yml:1-64` — standalone GPU sidecar (rule 54)
- `services/intelligence/app/query_embedder.py:1-68` — shared factory (D-B)
- `services/intelligence/app/routers/retrieval.py:1-114` — gated search endpoint
- `services/intelligence/scripts/retrieval_probe.py:1-120` — default `sidecar` (`--provider`), `is_query:true`

## See also

- `.work/plans/archive/2026-08-19-corpus-restore/PLAN.md:960-965` — durable `754/qwen-sidecar` Decision A
- `.work/plans/archive/2026-08-17-sidecar-embed-live-e2e/PLAN.md:168` — sweep winner `EMBEDDING_BATCH_SIZE=128` + `16`
- `.agents/rules/54-gpu-inference-sidecar.agents.md` — sidecar lifecycle + `HF_TOKEN` + `stop` not `down`
- `.agents/rules/36-supabase-live-stack.agents.md` — `supabase db push --dry-run` + `pgmq` + `halfvec(768)` contract
- `.agents/rules/51-docker-runtime.agents.md` — `docker-app` launcher contract
