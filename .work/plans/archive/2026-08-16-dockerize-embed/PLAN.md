# PLAN — Provider-Abstract Ingestion Embedding + Research-Tuned Docker Embedder

Continuation of this task folder's containerization work: apply the frozen
2026-08-15 retrieval-quality baseline to the Docker embedder sidecar, then
make the ingestion worker's embedding provider pluggable so the sidecar can
replace Gemini in production.

## Goal

- The Docker embedder reproduces the evaluated Qwen3-Embedding-0.6B config:
  768-dim Matryoshka truncation, L2 normalization, model prompts, fp32.
- The ingestion worker selects its embedding provider via `EMBEDDING_PROVIDER`
  (gemini | sidecar) with no code change between providers.
- Provider mixing on one material is impossible; re-embedding a material to a
  new provider is a one-command operator step.
- The container's vectors reproduce the frozen retrieval baseline within
  tolerance (parity gate).

## Acceptance criteria (pre-filled verification checklist)

1. Sidecar `/health` reports `dimensions: 768`, `cuda_available: true`,
   device `AMD Radeon RX 9070 XT`; `/embed` returns 768-dim L2-normalized
   vectors; `is_query` switches the Qwen query prompt.
2. Parity gate: dense-only eval against the 788-chunk ACCA corpus with
   `--models sidecar` reproduces recall@1 0.70 / recall@3 0.83 / recall@5 0.90 /
   MRR 0.788 (tolerance ±0.01).
3. GPU throughput measured (CPU baseline 80 chunks/min).
4. `SidecarEmbedder` client unit tests pass; worker telemetry attaches without
   `isinstance(GeminiEmbedder)`.
5. Worker writes `materials.embedding_provider` and refuses provider mixing
   (terminal `validation_failed`).
6. Migration `017_material_embedding_provider.sql` exists — ✅ pushed and
   live-probed 2026-08-16 (legacy rows `NULL`; see VERIFICATION.md).
7. `reembed_materials.py` operator script exists and is documented.
8. Service suite: 248 passed + the 5 pre-existing golden-fixture failures
   (unchanged baseline); ruff clean on all touched files.
9. Rule `54-embedder-gpu-container.agents.md` documents the embedding
   contract, new env vars, and throughput.

## Phases

- **Phase 1** — sidecar matches the evaluated config (`services/embedder/`).
- **Phase 2** — ingestion abstraction (`embeddings_sidecar.py`, provider
  selection in `worker_main.py`, telemetry decoupling, tests).
- **Phase 3** — parity gate (`embedding_bakeoff.py --models sidecar`).
- **Phase 4** — `embedding_provider` column + mixing guard + re-embed script.
- **Phase 5** — docs and rules.

## Decisions

- `embedding_provider` stored as a materials column (not an event); values
  `gemini` | `qwen-sidecar`, written by the worker at embed-stage start,
  guarded against mixing at embed-stage entry.
- Dimension truncation env-configurable (`EMBEDDING_DIMENSIONS`, default 768).
- Rate limiter disabled in sidecar mode (local GPU has no TPM quota);
  `TokenRateLimiter` already no-ops when `max_tokens_per_minute <= 0`.
- Sidecar doc prompt: candidates `retrieval.document`/`search_document`/
  `passage`; Qwen3 exposes only `query`, so passages embed without a prompt —
  exactly the frozen baseline (bakeoff `LocalEmbedder` used the same lists).
- Out of scope: production query-side retrieval endpoint (no caller exists),
  int8/ONNX, title prefixes, reranker production wiring.
