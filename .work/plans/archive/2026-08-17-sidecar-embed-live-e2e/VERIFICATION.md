# VERIFICATION — Live Sidecar Embedding E2E — re-embed, batch tuning, 572-page ingestion

## Implementation log (developer)

| Phase | Status | Evidence |
|---|---|---|
| 1. Runner skeleton | ✅ `ff32452` | `scripts/sidecar_e2e.py` with `preflight`/`manifest`/`report`; subcommands `sweep`/`reembed`/`pdf-run`/`guard-probe` registered. 4 unit tests (`run_id`, `snapshot_health` ok+fail, `save_evidence` round-trip). Live `preflight` OK on the RX 9070 XT (`Qwen/Qwen3-Embedding-0.6B`, dims 768, cuda:0, loaded). Evidence: `evidence/20260817-095820.{json,md}`. |
| 2. Sweep surface | ✅ `a2b74fe` | `embedding_bakeoff.py` gains `SIDECAR_HTTP_BATCH_DEFAULT`, configurable `SidecarEmbedder(http_batch=...)` (threaded through `run_model`), conditional `GEMINI_API_KEY` (only when `gemini` is selected), `--sidecar-batch`/`--json-out`. `sidecar_e2e.py` gains `_recreate_embedder`/`_embedder_health_loaded`/`_run_bakeoff`/`cmd_sweep`. 4 unit tests. Live sweep below. |
| 3. Re-embed runner | ✅ `4fbb89d` | `cmd_reembed` + `_pick_candidate`/`_poll_material` (D-04 small tier, D-07, D-08). 3 unit tests. Live run below. |
| 4. PDF runner | ✅ `6b7ab0f` (+ live fixes in `…` Phase 6) | `cmd_pdf_run` + `_find_owner`/`_material_payload`. 4 unit tests. Live run below. |
| 5. Guard probe | ✅ `1ac9997` (+ live fix in Phase 6) | `cmd_guard_probe` (D-03, D-06, D-08). 2 unit tests. Live run below. |
| 6. Close-out | ✅ (this doc) | Full operator sequence run live; evidence committed under `evidence/`; operating point recorded; STATUS + handover updated. |

## Live runs (2026-08-17, sidecar worker on the hosted dev project)

| Run | Evidence | Result |
|---|---|---|
| preflight | `evidence/20260817-095820.json` | Embedder OK: `Qwen/Qwen3-Embedding-0.6B`, dims 768, cuda_available true, device `cuda:0` (RX 9070 XT), loaded true. |
| sweep (9 configs × cold + 3 warm) | `evidence/20260817-100010.{json,md}` + `evidence/20260817-100010/sweep-*.json` | All configs: 0 failures, MRR 0.7894–0.7895 (±0.01 of 0.788 baseline). **Recommended operating point: `EMBEDDING_BATCH_SIZE=128` (container env) + HTTP batch 16 (`--sidecar-batch 16`)** — warm median **4,381 chunks/min** (cold 4,406), corpus wall 10.8–11.0 s. ACCA corpus read-only; no DB vector writes. |
| reembed | `evidence/20260817-101448.{json,md}` | Material `07d62b7e-181d-43e8-853e-5d5f4a9f71e8` (`E2E ingestion text …`, 1 chunk): pre `ready`/NULL → post `ready`/`qwen-sidecar`, **0 NULL vectors, 0 skipped, chunk count unchanged**, 3 telemetry records. Left tagged `qwen-sidecar` per D-07. |
| pdf-run | `evidence/20260817-102814.{json,md}` | Material `1a34147fee5e…` (572-page `sample-textbook-572page.pdf`): **754 chunks**, state `ready`, provider `qwen-sidecar`, **0 NULL vectors, 0 skipped**, 67 telemetry records; `ingestion_report.py` stage/embedding tables embedded in the report; material + storage deleted after evidence (D-07). (Earlier trigger-auto-enqueued run `evidence/20260817-102240.json` captured the same path before the runner's manual-enqueue bug was fixed.) |
| guard-probe | `evidence/20260817-103034.{json,md}` | Synthetic material marked `gemini` (no Gemini call, no vectors) → job failed with `validation_failed`, `retryable=false`, material state `failed`; synthetic job/material/telemetry rows deleted (D-06). Re-embed material untouched (verified live). |

## Acceptance criteria

| # | Criterion | Result |
|---|---|---|
| 1 | `preflight` evidence shows embedder `/health` OK: Qwen3-Embedding-0.6B, dimensions 768, cuda_available true, loaded true | ✅ `evidence/20260817-095820.json` |
| 2 | Sweep covers all 9 configs with cold + 3 warm each; records chunks/min, latency, retries, failures, MRR; recommended operating point recorded; no DB vector writes | ✅ `evidence/20260817-100010.json` (+ per-config JSONs; no failures, MRR within ±0.01; operating point `e128-h16`; ACCA material `80c8b138-…` untouched) |
| 3 | Small re-embed: post-state `ready`, `embedding_provider=qwen-sidecar`, zero NULL vectors, chunk count unchanged, telemetry present; material left tagged | ✅ `evidence/20260817-101448.json` |
| 4 | 572-page PDF reaches `ready` via the sidecar path with `qwen-sidecar`, zero NULL vectors, `chunk_count > 100` (754), full telemetry + `ingestion_report.py` in Markdown; material deleted after evidence | ✅ `evidence/20260817-102814.{json,md}` (67 telemetry records, report tables embedded) |
| 5 | Guard probe: synthetic `gemini`-marked material fails with `validation_failed`, `retryable=false`, no redelivery; synthetic rows deleted; no Gemini call anywhere | ✅ `evidence/20260817-103034.json`; no Gemini key used anywhere in the runner (conditional require in bakeoff) |
| 6 | Evidence artifacts committed under `evidence/`; runner unit tests pass; service suite green (5 pre-existing golden-fixture failures unchanged); ruff clean | ✅ 16 runner tests pass; **264 passed / 5 pre-existing golden-fixture failures (unchanged) / ruff clean on all touched files** |

## Deviations from the plan (discovered live, fixed in Phase 6)

1. **`materials.client_id` is NOT NULL (migration 004)**: the plan's `_material_payload` and guard-probe material payload omitted it → 400. Fixed by adding `client_id: uuid.uuid4().hex`; test asserts it.
2. **The enqueue trigger, not manual enqueue**: migration 005 installs `materials_enqueue_ingestion` (AFTER INSERT/UPDATE on materials when `ingestion_state='pending'`), which auto-creates the job row and sends `material_extract`. The plan's manual job insert + `ingestion_send` in `cmd_pdf_run` therefore 409'd on the unique `(material_id, attempt)` constraint — but the trigger's own job already completed the whole 572-page ingestion to `ready` (evidence `20260817-102240`). Fixed `cmd_pdf_run` to rely on the trigger and read the job back for the manifest; the guard probe keeps its manual embed enqueue (the trigger only fires for `material_extract` on `pending`).
3. **Bodiless storage DELETE vs Content-Type**: `_service_client` set `Content-Type: application/json` at the client level, so the storage object DELETE (no body) 400'd ("Body cannot be empty when content-type is set"). Fixed by removing Content-Type from `service_headers` (httpx sets it automatically for `json=` bodies) and adding an explicit `application/pdf` header on the upload; storage cleanup now also deletes the object (D-07).
4. The plan's bakeoff step said `SidecarEmbedder(http_batch=args.sidecar_batch)` inside `run_model`, which has no `args`; threaded as a `sidecar_batch` keyword param instead (Phase 2 notes).
5. Operator shell commands in the plan use `../.venv` from `services/intelligence`, which resolves to the nonexistent `services/.venv`; the venv is at repo root (`../../.venv` from `services/intelligence`). The runner itself resolves the venv via `parents[3]` (repo root) correctly.

## Open items

- Productionizing the worker/embedder runtime (compose orchestration, managed launcher, monitoring dashboards) is the next plan (D-01); consume the recommended operating point (`EMBEDDING_BATCH_SIZE=128`, HTTP batch 16) and the end-to-end numbers above.
- The 632-page PDF stress run remains out of scope (D-09); can become its own benchmark later.