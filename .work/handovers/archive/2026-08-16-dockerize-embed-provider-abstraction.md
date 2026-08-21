# Handover - 2026-08-16 Dockerized Qwen embedder + provider-abstract ingestion

## Entry point

- **Branch:** `phase2/issue-37`. The work described below is **committed**:
  `f08c47c` (feat: dockerized Qwen3 GPU embedder + provider-abstraction
  ingestion) and `7e15ef8` (docs: rules refresh for restored WSL tooling and
  sidecars), preceded on the branch by the retrieval/telemetry baseline
  `f467f76`, `344798e`, `441bcd5`, `57253f8`.
- **Plan:** `.work/plans/active/2026-08-16-dockerize-embed/PLAN.md`
- **Running log:** same folder, `VERIFICATION.md` (all phases verified; migration pushed; rule 36 fixed).
- **Rules to read before touching anything:** `54-embedder-gpu-container.agents.md`
  (embedding contract + GPU ops), `36-supabase-live-stack.agents.md`
  (just rewritten: token location + npx CLI flow), `41-roadmap-engine.agents.md` is
  irrelevant here; `53-wsl-dev-runtime.agents.md` (stale Vite / env loading) matters if
  you touch the app.
- **Open item this session leaves for you:** live re-embed E2E (section at the bottom).

## What this session did

### Docker embedder sidecar now reproduces the frozen research baseline

`services/embedder/` (untracked, from the earlier containerization session) was
upgraded in `app/main.py` v0.2.0 to match the 2026-08-15 retrieval-quality baseline
exactly:

- Matryoshka truncation to `EMBEDDING_DIMENSIONS` (default 768 = `halfvec(768)`),
  L2 renormalization after truncation (`normalize_embeddings`).
- `is_query` flag on `/embed`; Qwen's own prompts resolved from model config.
  **Qwen3-Embedding exposes only `query`** - passages embed with NO prompt,
  matching the bakeoff exactly (do not "fix" this to `document`).
- fp32 only; int8/ONNX and title prefixes are rejected by research - do not add them.
- `EMBEDDING_BATCH_SIZE` (default 64) env-tunable; `/health` reports `dimensions`.
- Compose passes `EMBEDDING_DIMENSIONS`/`EMBEDDING_BATCH_SIZE` through.

Verified live: `cuda:0` `AMD Radeon RX 9070 XT`, dims 768, normalized vectors.
**Parity gate passed** (`scripts/embedding_bakeoff.py --models sidecar` on material
`80c8b138-b544-4095-8dc0-1c390ac70da2`): r@1 0.70 / r@3 0.83 / r@5 0.90 / MRR 0.790
(frozen baseline 0.788). **Throughput 4,297 chunks/min on GPU vs 80 on CPU (54x).**
Cache: `services/intelligence/.dev/bakeoff/sidecar-vectors-*.npy`.

### Ingestion embedding provider is now pluggable

- New `services/intelligence/app/ingestion/embeddings_sidecar.py` - `SidecarEmbedder`
  (`provider_name = "qwen-sidecar"`), mirrors the Gemini adapter contract
  (same error codes, zero-vector→None, 2 full-jitter retries, observer).
- `app/worker_main.py` selects via `EMBEDDING_PROVIDER` env: `gemini` (default) |
  `sidecar` (`EMBEDDER_URL`, default `http://localhost:8200`). Sidecar mode
  disables the TPM limiter (local GPU has no quota) - `TokenRateLimiter` already
  no-ops at `max_tokens_per_minute <= 0`.
- `worker.py`: telemetry no longer uses `isinstance(GeminiEmbedder)` (attaches via
  optional `observer` slot; `telemetry_model` per adapter), writes
  `materials.embedding_provider` at embed start, and refuses provider mixing
  (terminal `validation_failed`).
- 19 new tests (16 sidecar client + 3 worker). Suite: **248 passed, 5 pre-existing
  `test_v1_integration.py` golden-fixture failures (unchanged baseline)**; ruff clean
  on touched files (the one remaining ruff error is pre-existing, `test_v1_integration.py:103`).

### Migration 017 PUSHED and live-probed

- `apps/app/supabase/migrations/017_material_embedding_provider.sql`:
  `materials.embedding_provider TEXT` + CHECK (`gemini` | `qwen-sidecar`).
- Applied to the dev project `kabpmbhlvfbrhtbxjaua` (an interrupted first push had
  actually completed; dry-run now reports "Remote database is up to date.").
- Live probe via PostgREST: `select=embedding_provider` → HTTP 200, `NULL` on all
  legacy rows. (Probe helper: service-role key from `services/intelligence/.env`.)

### Operator script

`services/intelligence/scripts/reembed_materials.py` - nulls chunk vectors, resets
`skipped`, tags the target provider, creates a fresh attempt (max+1) job, enqueues
`material_embed`. Refuses non-ready materials and same-provider no-ops; `--yes` for batch.

### Rules / docs updated

- `54-embedder-gpu-container.agents.md` - embedding contract (768/truncation/prompts),
  env vars, health fields, throughput, worker wiring (`EMBEDDING_PROVIDER=sidecar`).
- `36-supabase-live-stack.agents.md` - rewritten CLI section: **CLI is NOT at
  `~/.local/bin/supabase` anymore**; fetch via `npx --yes supabase@latest` from
  `apps/app/`; the personal access token is **`SUPABASE_ACCESS_TOKEN` in the
  gitignored `services/intelligence/.env`**; login persists via
  `npx supabase login --token "$TOKEN"` (the env var alone is ignored by remote
  commands); pushes look stuck due to schema-diff + flaky egress (rule 52) - read
  `--debug` before assuming failure.
- `.work/STATUS.md` - new Active row; `.work/plans/active/2026-08-16-dockerize-embed/`
  now has `PLAN.md` + `VERIFICATION.md`.

## Runtime state

- Embedder container RUNNING and healthy: `embedder-embedder-1` on host port 8200.
  Rebuild/restart per rule 54 (`docker compose -f services/embedder/docker-compose.yml`).
  Start it with `HF_TOKEN` exported from `.env.git.local`; first model load
  re-downloads into the container layer (~1.2 GB) if the container was recreated.
- Root `.venv` (Python 3.14) is the test venv: `uv sync --all-packages --group dev` at
  repo root, plus manual `pip install -e packages/py-progress -e packages/py-roadmap-engine
  -e services/intelligence` and `pyjwt[crypto]` were needed to restore the suite
  (pre-existing host state - do not assume `uv run pytest` alone works).
  Run tests as `.venv/bin/python -m pytest services/intelligence/tests -q`.
- `.env` files carry real secrets; gitignored. `services/intelligence/.env` now also
  has `SUPABASE_ACCESS_TOKEN` (added by the user this session).

## Open item for the next session - live re-embed E2E

**✅ DONE 2026-08-17** — closed by plan
[`.work/plans/active/2026-08-17-sidecar-embed-live-e2e/PLAN.md`](../plans/active/2026-08-17-sidecar-embed-live-e2e/PLAN.md).
The full sequence was run live against the hosted dev project with a sidecar-mode
worker (`EMBEDDING_PROVIDER=sidecar`): preflight → batch-size sweep (9 configs,
operating point `EMBEDDING_BATCH_SIZE=128` + HTTP batch 16, 4,381 warm chunks/min)
→ small legacy re-embed (`07d62b7e-…`, now `qwen-sidecar`, 0 NULL) → 572-page PDF
ingestion (754 chunks, `ready`, `qwen-sidecar`, 0 NULL) → non-destructive mixing
guard probe (`validation_failed`, non-retryable, synthetic rows deleted; no Gemini
called). Evidence: `.work/plans/active/2026-08-17-sidecar-embed-live-e2e/evidence/`
(`20260817-100010` sweep, `20260817-101448` reembed, `20260817-102814` pdf,
`20260817-103034` guard probe). VERIFICATION:
`.work/plans/active/2026-08-17-sidecar-embed-live-e2e/VERIFICATION.md`.

Original instructions (superseded by the runner, kept for reference):

1. Start an ingestion worker in sidecar mode against the live project:
   `cd services/intelligence && EMBEDDING_PROVIDER=sidecar EMBEDDER_URL=http://localhost:8200
   .venv/bin/python -m app.worker_main` (needs `SUPABASE_URL` +
   `SUPABASE_SERVICE_ROLE_KEY` from `.env`; `GEMINI_API_KEY` not required in sidecar mode).
2. Re-embed one ready material, e.g. `07d62b7e-181d-43e8-853e-5d5f4a9f71e8` or
   `dafe94d4-a148-45c1-9c59-237635e9f7dd` (both `ready`, provider `NULL`):
   `scripts/reembed_materials.py --material <id> --provider qwen-sidecar --yes`.
3. Watch the worker log: guard passes, NULL-scan re-embeds all chunks, publish flips
   to `ready`. Then verify: `SELECT id, ingestion_state, embedding_provider,
   chunk_count FROM materials WHERE id = '<id>'` and
   `SELECT count(*) FROM content_chunks WHERE material_id='<id>' AND embedding IS NULL`
   → expect 0.
4. Negative check: while the worker runs in sidecar mode, confirm a *second* attempt
   with a mismatched provider is refused - e.g. temporarily run
   `reembed_materials.py --provider gemini` on the same material after step 3 and
   expect the guard to fail the job with `validation_failed` (or simulate via the
   worker test `test_embed_refuses_to_mix_providers_on_one_material`).

Watch: pgmq visibility semantics (rule 36), the embedder container stays up (rule 54),
and don't re-embed the ACCA corpus material (`80c8b138-...`) unless you want to
re-measure parity - its vectors are the frozen research baseline.

## Gotchas carried over

- Vite on `/mnt/d` does not hot-reload (rule 53): restart the managed runtime before
  browser verification of any app change.
- `pkill -f` patterns can match the killing shell; use character classes or explicit PIDs.
- `gh` calls need the bounded-retry recipe (rule 52); Supabase CLI npx calls can stall
  on egress the same way.
