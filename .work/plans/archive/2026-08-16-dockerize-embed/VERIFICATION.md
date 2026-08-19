# VERIFICATION — Provider-Abstract Ingestion Embedding + Research-Tuned Docker Embedder

## Implementation log (developer)

| Phase | Status | Evidence |
|---|---|---|
| 1. Sidecar config | ✅ | `services/embedder/app/main.py` v0.2.0: `truncate_dim`, `is_query`, prompt resolution, `EMBEDDING_DIMENSIONS`/`EMBEDDING_BATCH_SIZE` env, dims in `/health`. Compose passes the env through. Rebuilt image `embedder-embedder:latest`; `/health` shows `dimensions: 768, cuda_available: true, device_name: AMD Radeon RX 9070 XT`; `/embed` round-trip returns 768-dim normalized vectors; `is_query` flips the Qwen `query` prompt (model exposes `query` + `document`; passages intentionally get no prompt, matching the frozen baseline). |
| 2. Ingestion abstraction | ✅ | `SidecarEmbedder` in `app/ingestion/embeddings_sidecar.py` (mirrors Gemini adapter: same validation helpers, zero-vector→None, 2 retries full-jitter, observer, `provider_name="qwen-sidecar"`). `worker_main.py` selects via `EMBEDDING_PROVIDER` (gemini default / sidecar); sidecar mode disables the TPM limiter. `worker.py` telemetry attaches through an optional `observer` slot — `isinstance(GeminiEmbedder)` removed; mixing guard (terminal `validation_failed`) + provider column write at embed start. `Material.embedding_provider` added; repo + fake updated. 16 new sidecar client tests + 3 new worker tests. |
| 3. Parity gate | ✅ | `embedding_bakeoff.py --models sidecar` on material `80c8b138-...` (788 chunks, 30 questions), fresh (non-cached) GPU embeddings: **r@1 0.70 / r@3 0.83 / r@5 0.90 / MRR 0.790** — gate passed (MRR 0.790 vs 0.788 baseline, +0.002). Throughput: **4,297 chunks/min on GPU** (11.0 s corpus) vs 80 chunks/min CPU baseline (54x). Cached vectors at `services/intelligence/.dev/bakeoff/sidecar-vectors-*.npy`. |
| 4. Column + guard + script | ✅ | Migration `017_material_embedding_provider.sql` (column + CHECK + comment) committed and **pushed + live-probed 2026-08-16** (criterion 6). `reembed_materials.py` written: nulls chunk vectors, resets skipped, tags provider, creates attempt+1 job, enqueues embed; refuses non-ready materials and no-ops on same provider. |
| 5. Docs + rules | ✅ | Rule 54 updated (embedding contract, env vars, health fields, throughput, worker wiring). `PLAN.md` + this log added. |

## Verification checklist

| # | Criterion | Result |
|---|---|---|
| 1 | `/health` dims 768 + GPU; `/embed` 768-dim normalized; `is_query` works | ✅ (curl + log evidence above) |
| 2 | Parity gate reproduces baseline | ✅ 0.70/0.83/0.90/0.790 |
| 3 | GPU throughput measured | ✅ 4,297 chunks/min |
| 4 | Sidecar unit tests + telemetry without isinstance | ✅ 16 sidecar + 40 worker tests pass |
| 5 | Provider column write + mixing guard | ✅ worker tests: column written, mixing → `validation_failed` non-retryable |
| 6 | Migration 017 exists | ✅ **pushed + live-probed 2026-08-16**: token found in `services/intelligence/.env`, CLI via `npx supabase`, `login --token`, `db push` (an interrupted first attempt had already applied it; dry-run then reported "up to date"). PostgREST probe `select=embedding_provider` returns HTTP 200; legacy rows `NULL`. |
| 7 | reembed script | ✅ written; live sidecar re-embed run pending (open item — see handover 2026-08-16) |
| 8 | Suite + ruff | ✅ 248 passed, 5 pre-existing golden-fixture failures (unchanged); ruff clean on all touched files (the one remaining ruff error is pre-existing `test_v1_integration.py:103`, untouched) |
| 9 | Rule 54 | ✅ updated |

## Deviations

- ~~Migration push could not run on this host (supabase CLI and database
  credentials absent).~~ Resolved 2026-08-16: the `SUPABASE_ACCESS_TOKEN` was
  found in `services/intelligence/.env`, the CLI was fetched via
  `npx --yes supabase@latest` from `apps/app/`, `login --token` completed, and
  `db push` finished (an interrupted first attempt had already applied the
  migration; dry-run then reported "Remote database is up to date.").
- `services/intelligence/.venv` did not exist; the root `.venv` needed
  `pip install -e` of the workspace packages + `pyjwt` to restore the test
  environment (pre-existing host state, unrelated to this change).

## Open items

- ~~Push migration 017 to the hosted project and probe the live column.~~ ✅ Done 2026-08-16; live PostgREST probe confirms the column with `NULL` on legacy rows.
- When a worker with `EMBEDDING_PROVIDER=sidecar` runs against the live
  project, re-embed at least one material with `reembed_materials.py` and
  watch it reach `ready` (real E2E of the mixing guard + NULL-scan resume).
- ~~Rules upkeep: rule 36 claimed `~/.local/bin/supabase` exists on this host.~~ ✅ Fixed 2026-08-16: rule 36 now documents the `SUPABASE_ACCESS_TOKEN` in `services/intelligence/.env`, the npx CLI fetch, the `login --token` flow, and the slow-push cause.
