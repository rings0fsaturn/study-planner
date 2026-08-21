# VERIFICATION — Productionize Worker/Embedder Runtime + Wire Sidecar Query-Embedder

Plan: [`PLAN.md`](PLAN.md) · Slug: `2026-08-20-productionize-worker-and-query-embedder` · Branch: `phase2/issue-37`

## Acceptance criteria (pre-filled)

| # | Criterion | Status |
|---|---|---|
| 1 | `docker-compose.yml` `ingestion-worker` widens env passthrough to `EMBEDDING_PROVIDER/EMBEDDER_URL/RERANKER_URL` + all `INGESTION_*` tuning + `INGESTION_LOG_LEVEL`, adds `extra_hosts: host.docker.internal:host-gateway`, `healthcheck`, and `depends_on: intelligence: healthy`. `./docker-app config` parses with default (`gemini`) and sidecar envs. | ✅ |
| 2 | `docker/.env.example` + `services/intelligence/.env.example` document the sidecar vars + recommended operating point (`EMBEDDING_BATCH_SIZE=128` + HTTP 16 → 4,381 warm chunks/min). `services/embedder/docker-compose.yml` default `EMBEDDING_BATCH_SIZE` is `128`. | ✅ |
| 3 | `worker_main.py` shares a graceful shutdown path (`SIGTERM/SIGINT`), logs provider at boot, and delegates provider selection to the shared factory. `scripts/dev-ingestion-worker.mjs` logs provider/health. `docker-app --with-embedder` orchestrates the standalone sidecar and gates on `/health` (768, cuda, loaded). | ✅ |
| 4 | New `app/query_embedder.py` factory reuses `EMBEDDING_PROVIDER` / `EMBEDDER_URL` for both chunk- and query-embed (D-B), exposing `embed_queries(is_query=True)` for sidecar. `test_query_embedder.py` green with `httpx.MockTransport` asserting `is_query` payloads. | ✅ |
| 5 | `scripts/retrieval_probe.py --provider sidecar --hybrid` probes the durable `80c8b138…` (`754 / qwen-sidecar`) in the same embedding space: `MRR ~0.70-0.72` on the 30Q set (not `0.356` cross-space). Gemini path (`--provider gemini`) still works and `--provider gemini` is the only path that requires `GEMINI_API_KEY`. | ✅ |
| 6 | Gated `POST /v1/retrieval/search` (`RETRIEVAL_ENABLED`, `require_user` + owner check) embeds `query` with `is_query=True` (sidecar) / `taskType=retrieval_query` (Gemini), calls `match_content_chunks` (`hybrid` toggles `query_text`, `top_k` capped `1..50` per `016:81`), and optionally chains `RerankerClient.rerank`. `test_retrieval.py` offline green. | ✅ |
| 7 | Service tests: `uv run pytest services/intelligence/tests -q` green except the 5 pre-existing golden-fixture failures; `uv run ruff check` clean on all touched files. | ✅ |
| 8 | `npx --yes supabase@latest db push --dry-run --linked --project-ref kabpmbhlvfbrhtbxjaua` → "Remote database is up to date." (no migration). | ✅ 2026-08-21 live — `apps/app` `Remote database is up to date.` (root CLI needs `apps/app` cwd; 017 is head) |
| 9 | `.work/STATUS.md` follow-up row ("production wiring of rerank …" / "second corpus" if C2 landed) updated; plan folder stays `plans/active/` until final verification. | ✅ 2026-08-21 — `STATUS.md` Done, plan archived to `plans/archive/2026-08-20-productionize-worker-and-query-embedder/` |

## Implementation log

### Phase 0 — Plan doc + status row

- Status: ✅ Complete — in-session 2026-08-20
- Files: `PLAN.md`, `VERIFICATION.md`, `.work/STATUS.md` (Active row added) → `🟡 In progress` (this commit)
- Files: `PLAN.md`, `VERIFICATION.md`, `.work/STATUS.md`
- Prereq: `ls services/intelligence/.env`, `ls e2e/pdf/sample-textbook-572page.pdf`, `supabase db query` for `80c8b…` (see PLAN.md Phase 0 Verification (BEFORE)).
- Notes: created from the approved planning discussion (user: "Go with recommendation and start", 2026-08-20). Recommendations: D-A keeps `services/embedder` separate + `docker-app --with-embedder`, D-B reuses `EMBEDDING_PROVIDER`, D-C ships minimal gated retrieval, D-D pins `128`, D-E adds `full-app` opt-in.

### Phase 1 — Compose productionization

- Status: ✅ Complete — in-session 2026-08-20
- Files: `docker-compose.yml`, `docker/.env.example`, `services/intelligence/.env.example`, `services/embedder/docker-compose.yml`
- Files: `docker-compose.yml`, `docker/.env.example`, `services/intelligence/.env.example`, `services/embedder/docker-compose.yml`, `docker-app` (if flag lands here; else Phase 2)
- Prereq: `grep -n "ingestion-worker" docker-compose.yml`, `grep -n "EMBEDDING_PROVIDER\|EMBEDDER_URL" docker-compose.yml` (expected missing), `./docker-app config`
- Test run: `./docker-app config` parses; worker env passthrough present.
- Notes: —

### Phase 2 — Runtime hardening

- Status: ✅ Complete — in-session 2026-08-20
- Files: `services/intelligence/app/worker_main.py` (SIGTERM/SIGINT + shared_client close), `scripts/dev-ingestion-worker.mjs` (provider log), `docker-app` (--with-embedder)
- Files: `services/intelligence/app/worker_main.py`, `scripts/dev-ingestion-worker.mjs`, `docker-app`, `scripts/full_app.py`
- Prereq: `grep -n "while True" services/intelligence/app/worker_main.py`
- Test run: `uv run pytest services/intelligence/tests -k "worker or telemetry or embed" -q`
- Notes: —

### Phase 3 — Shared query-embedder factory

- Status: ✅ Complete — in-session 2026-08-20
- Files: `services/intelligence/app/query_embedder.py` + `tests/test_query_embedder.py` (5 tests, httpx.MockTransport), `worker_main.py` factory glue
- Files: `services/intelligence/app/query_embedder.py` (new), `services/intelligence/tests/test_query_embedder.py` (new), `services/intelligence/app/worker_main.py` (factory glue)
- Prereq: `grep -n "class SidecarEmbedder" services/intelligence/app/ingestion/embeddings_sidecar.py`
- Test run: `uv run pytest services/intelligence/tests/test_query_embedder.py -q` + ruff
- Notes: —

### Phase 4 — retrieval_probe sidecar wiring + parity on 754

- Status: ✅ Complete — in-session 2026-08-20
- Files: `services/intelligence/scripts/retrieval_probe.py` (--provider sidecar default, is_query:true), `tests/test_retrieval_probe.py` (2 tests)
- Files: `services/intelligence/scripts/retrieval_probe.py`, `services/intelligence/tests/test_retrieval_probe.py`
- Prereq: `grep -n "embed_query\|GEMINI_API_KEY" services/intelligence/scripts/retrieval_probe.py`, `curl -s http://127.0.0.1:8200/health` (optional)
- Test run: `uv run pytest services/intelligence/tests/test_retrieval_probe.py -q` + operator `retrieval_probe.py --provider sidecar --hybrid` (MRR ~0.70-0.72 on `80c8b… / 754`)
- Notes: —

### Phase 5 — Retrieval endpoint `POST /v1/retrieval/search`

- Status: ✅ Complete — in-session 2026-08-20
- Files: `services/intelligence/app/routers/retrieval.py` (gated RETRIEVAL_ENABLED, owner check, hybrid + optional rerank), `app/main.py` include, `tests/test_retrieval.py` (6 tests)
- Files: `services/intelligence/app/routers/retrieval.py` (new), `services/intelligence/app/main.py`, `services/intelligence/tests/test_retrieval.py`
- Prereq: `grep -n "include_router" services/intelligence/app/main.py`
- Test run: `uv run pytest services/intelligence/tests/test_retrieval.py -q` + manual curl against 80c8b…
- Notes: feature-flagged `RETRIEVAL_ENABLED`; owner-scoped `material_id`.

### Cross-cutting checks (run before marking Done)

- `uv run pytest services/intelligence/tests -q`  # 5 pre-existing golden-fixture failures only
- `uv run ruff check services/intelligence/app/query_embedder.py services/intelligence/app/routers/retrieval.py services/intelligence/scripts/retrieval_probe.py`
- `npx --yes supabase@latest db push --dry-run --linked --project-ref kabpmbhlvfbrhtbxjaua  # Remote database is up to date.`
- `git log --oneline --grep="Productionize worker\|query-embedder"`  # phase commits present

### Live container verification — 2026-08-21 (handover `.work/handovers/2026-08-20-productionize-worker-live-docker-test-handover.md`)

**Prereqs:** `docker 29.7.2` + `compose v5.3.1` present, `.env.git.local` HF_TOKEN present, `services/intelligence/.env` + `apps/app/.env.local` have Supabase keys, `e2e/pdf/sample-textbook-572page.pdf` 22 MB, durable corpus `80c8b138-b544-4095-8dc0-1c390ac70da2` verified `ready | qwen-sidecar | 754` and `754 | 754` embedded.

**Step 0 — corpus:** `supabase db query --linked` shows `ready / qwen-sidecar / 754` and `754 | 754` (see evidence below).

**Step 1 — compose:** `apps/app/.env.local` restored with `EMBEDDING_PROVIDER=qwen-sidecar, EMBEDDER_URL=http://host.docker.internal:8200, RERANKER_URL=…, EMBEDDING_BATCH_SIZE=128`; `./docker-app config` shows `qwen-sidecar` (was `gemini` before fix due to precedence `apps/app/.env.local` > `.env`), `grep healthcheck docker-compose.yml` present (worker, intelligence, web), `EMBEDDING_BATCH_SIZE:-128` comment present.

**Step 2 — sidecar + stack (`./docker-app --with-embedder start`):** `docker compose -f services/embedder/docker-compose.yml ps` → `Up (healthy)`; `curl http://127.0.0.1:8200/health` → `status ok, dimensions 768, cuda_available true, device cuda:0, device_name AMD Radeon RX 9070 XT, torch 2.12.0+rocm7.14.0, loaded true, reranker_loaded true`; `curl http://127.0.0.1:8000/health` → `ok`; `./docker-app status` → `ingestion-worker healthy`, `intelligence healthy`, `web healthy`.

**Step 3 — worker log:** `docker compose logs ingestion-worker | grep provider` → `embedding provider: sidecar (http://host.docker.internal:8200)` + `ingestion worker starting against https://kabpmbhlvfbrhtbxjaua.supabase.co` after alias fix (`query_embedder.py:26` + `worker_main.py:42` now accept `qwen-sidecar`; before fix looped `unknown EMBEDDING_PROVIDER: qwen-sidecar` + Restarting).

**Step 4 — probe (parity gate `VERIFICATION #5`):** `.venv/bin/python services/intelligence/scripts/retrieval_probe.py 80c8b138… --hybrid --provider sidecar` → `chunks: 754, Provider: sidecar, Recall@1 0.60 Recall@3 0.73 Recall@5 0.87 MRR 0.703 Mean top similarity 0.658` (was 0.356 cross-space). Control `--provider gemini --hybrid` → `MRR 0.356 Recall@1 0.03` (cross-space collapse). `retrieval_probe.py:171` now normalizes `qwen-sidecar → sidecar` and `rank_with_rpc` always sends `query_text` (None when dense-only) to avoid `PGRST203` overload.

**Step 5 — retrieval endpoint `POST /v1/retrieval/search` (owner `29288e28-d6ff-45c7-b750-ba43f7452409` / `iamrohitsaji@gmail.com`):**
- `hybrid true topK5 "ACCA materiality threshold"` → `200 chunks=5 similarity~0.49 reranked false`
- `hybrid false` → `200 chunks=5` (was `500 KeyError slice(None,5,None)` because hits was `{"code":"PGRST203"}` dict; now `retrieval.py:83-104` sends `query_text: null` and checks `>=300` + `code` dict)
- `rerank true` → `200 chunks=5 reranked true indices=[3,1,27,29,24]` (50-pool)
- Planning gap `"planning gap definition"` hybrid true ordinals `[115,114,12,116,9]` gold `114` rank1; rerank `[0,1,2,6,7]` ordinals `[115,114,12,750,691]`
- No token → `401 missing bearer token`
- Wrong `materialId 000…` → `404 material not found`
- Before fix: `hybrid true` returned `500 search not configured` because `docker-compose.yml:22` `intelligence` lacked `SUPABASE_SERVICE_ROLE_KEY`, `EMBEDDING_PROVIDER`, `EMBEDDER_URL`, `RERANKER_URL`, `extra_hosts`; now added.

**Step 6 — cross-cutting:**
- `.venv/bin/python -m pytest services/intelligence/tests/test_query_embedder.py test_retrieval_probe.py test_retrieval.py -q` → `13 passed` (after `test_retrieval_hybrid_false` now expects `query_text is None`)
- `.venv/bin/python -m pytest services/intelligence/tests -q` → `286 passed, 5 failed` (all 5 are `test_v1_integration.py:83` `afternoon != evening`, pre-existing)
- `ruff check services/intelligence/app/query_embedder.py services/intelligence/app/routers/retrieval.py services/intelligence/scripts/retrieval_probe.py services/intelligence/app/worker_main.py` → `All checks passed!` (fixed `E501` at `retrieval.py:103`)
- `bash -c 'cd apps/app && npx --yes supabase@latest db push --dry-run --linked --project-ref kabpmbhlvfbrhtbxjaua'` → `Remote database is up to date.` (root cwd needs `apps/app`)
- `docker-app config` parses both default and sidecar envs.

**Raw evidence (truncated to 200 chars where needed):**
```
Embedder /health:
{"status":"ok","model":"Qwen/Qwen3-Embedding-0.6B","dimensions":768,"device":"cuda:0","cuda_available":true,"device_name":"AMD Radeon RX 9070 XT","torch_version":"2.12.0+rocm7.14.0","loaded":true,"reranker_model":"Qwen/Qwen3-Reranker-0.6B","reranker_loaded":true}
Intelligence /health:
{"status":"ok"}
Worker log:
INFO:ingestion.worker:embedding provider: sidecar (http://host.docker.internal:8200)
Probe sidecar MRR: 0.703 Recall@1 0.60 Recall@3 0.73 Recall@5 0.87
Probe gemini MRR: 0.356 (cross-space)
Retrieval hybrid true: 200 chunks=5
Retrieval rerank: 200 indices=[3,1,27,29,24]
```
