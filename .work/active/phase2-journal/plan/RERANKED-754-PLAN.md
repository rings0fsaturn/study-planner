# Reranked-754 re-run plan (2026-10-22)

_Goal: close brief gap 1. Measure hybrid + Qwen3-Reranker top-50 r@1/r@3/r@5/MRR on the durable 754-chunk corpus, same 30Q set, so the journal can report one coherent retrieval table instead of scoping 0.77/0.97/0.858 to the retired 788 split._

## Method (faithful to the 788 runs, GPU-routed for speed)

- Original 788 rerank run: in-process Qwen3-Embedding-0.6B + hybrid RRF (k=60, wD=1.0, wL=0.7, pool 25, top-50) + in-process CrossEncoder `Qwen/Qwen3-Reranker-0.6B` over top-50 (`embedding_bakeoff.py --models qwen --hybrid --rerank`).
- Re-run routes both model calls through the GPU sidecar (`POST /embed`, `POST /rerank`), which the parity gate proved equivalent (+0.002 MRR): same weights, same prompts, same 768-d MRL+L2 contract (rule 54).
- Three arms in one harness on the current corpus: dense-only, hybrid, hybrid+rerank. BM25 + RRF + cosine stay in-process (pure python, copied from `embedding_bakeoff.py`), so the only measured variables are the corpus split and the rerank stage.
- Multi-gold scoring identical to both prior harnesses (snippet + altSnippets containment, best rank across gold chunks).
- No paid APIs: sidecar + Supabase reads only. No repo code changes: driver lives in `/tmp/reranked-754/`, evidence lands in `research/doc/` per bakeoff precedent.

## Steps

1. Start sidecar (`docker compose -f services/embedder/docker-compose.yml up -d` with `HF_TOKEN` from `.env.git.local`), verify `/health`: `cuda_available: true`, `dimensions: 768`, `loaded` + `reranker_loaded` true.
2. Dry run per rule 80: driver with `--limit 2` (2 questions x 3 arms). Inspect: every record has a rank/miss/skip outcome, summary parses, no secrets in output.
3. Full run: 30 questions x 3 arms on material `80c8b138-b544-4095-8dc0-1c390ac70da2`. Expected wall-clock under 5 min (GPU embed + 30 rerank calls at ~325 ms each).
4. Write `research/doc/2026-10-22-reranked-754.md` (same table shape as the 2026-08-14 bakeoff docs) + JSON evidence beside it.
5. Stop the sidecar (`docker compose -f services/embedder/docker-compose.yml stop`), update the content brief (close gap 1, record the coherent table), distill state.md + STATUS.

## Acceptance

- Corpus fetched is 754 embedded chunks, 0 skipped.
- All 30 questions answered or explicitly skipped with reason (snippet absent).
- Reported: r@1/r@3/r@5/MRR per arm + per-question rank table + sidecar `/health` snapshot + config provenance (model ids, RRF params, top-50).
- Verdict rule: rerank arm keeps or beats hybrid r@1/MRR on 754 (788 precedent: +0.04 r@1, +0.042 MRR). Either outcome is reportable; a regression is an honest-limits result, not a failed run.
