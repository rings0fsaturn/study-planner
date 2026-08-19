# Retrieval Quality Program — Results (Qwen3-Embedding-0.6B)

- Date: 2026-08-15
- Corpus: 788 chunks of the 572-page ACCA APM study text (material `80c8b138-b544-4095-8dc0-1c390ac70da2`)
- Eval: 30 verified questions with multi-gold scoring (answerSnippet + altSnippets; a question hits when any gold chunk ranks in top-k; rank = best rank across golds)
- Embedder: `Qwen/Qwen3-Embedding-0.6B` (768-dim via Matryoshka truncation), FP32 CPU unless noted
- Reference runs: `scripts/embedding_bakeoff.py` (in-process), `scripts/retrieval_probe.py` (live RPC)

## Final metric table

| phase | config | recall@1 | recall@3 | recall@5 | MRR | gate | verdict |
|---|---|---|---|---|---|---|---|
| 0 | dense-only baseline | 0.70 | 0.83 | 0.90 | 0.788 | — | frozen |
| 1 | hybrid BM25 + dense RRF (k=60, wD=1.0, wL=0.7, pool 25) | 0.73 | 0.90 | 0.93 | 0.816 | recall@3 +5 | **PASS** |
| 2 | + Qwen3-Reranker-0.6B over top-50 | 0.77 | 0.97 | 0.97 | 0.858 | recall@1 +10 / MRR +0.05 | **PASS** |
| 3 | + contextual title prefix on embed inputs | 0.77 | 0.97 | 0.97 | 0.858 | recall@3 +3 | **REJECTED** (no gain) |
| 4 | ONNX int8 quantization | 0.10 | 0.10 | 0.10 | 0.131 | ≥2× speed AND recall −≤1 | **REJECTED** (r@1 collapse) |
| 2026-08-19 | re-ingested 754 (overlap 30, sidecar) — dense | 0.60 | 0.77 | 0.87 | 0.706 | — | **new durable baseline** |
| 2026-08-19 | re-ingested 754 (overlap 30, sidecar) — hybrid | 0.60 | 0.80 | 0.87 | 0.720 | — | **new durable baseline** |

> **2026-08-19 corpus-split note (Decision A):** the frozen rows 0–4 were measured on the
> 788-chunk split produced with the pre-C3 60-token overlap (`chunking.py` before `344798e`).
> The 2026-08-19 corpus restore re-ingested the same PDF with the current 30-token overlap
> (`services/intelligence/app/ingestion/chunking.py:3-6,18`) and produces **754 chunks** — the
> ~4% delta is the reduced overlap, not corruption. The 754 corpus is now the durable baseline
> for future live probes; the frozen 788 metrics are tied to the retired split and are not
> reproducible without reverting the chunker. Restore evidence:
> `.work/plans/active/2026-08-19-corpus-restore/evidence/20260819-091457-restore.json`
> (`ready / qwen-sidecar / 754 / 754 embedded / 0 NULL / 768-dim / 67 telemetry records`).
> Rerank parity (0.858) was not re-run on 754: it needs the in-process `sentence_transformers`
> reranker (not in the test venv); the sidecar's own reranker stays a deferred follow-up.

## What shipped

1. **Migration `015_hybrid_retrieval.sql`** — `content_chunks.search_vector` tsvector generated column + partial GIN index (embedding-not-null), and a new 4-arg `match_content_chunks(query_embedding, material_id, top_k, query_text)` overload fusing dense cosine top-50 with `ts_rank_cd` top-25 via weighted RRF. The legacy 3-arg overload is preserved untouched.
2. **Migration `016_hybrid_rrf_tuning.sql`** — redefines the 4-arg function with the swept weights (k=60, dense 1.0, lexical 0.7, BM25 pool 25). Both pushed to the dev project and probed live.
3. **`services/reranker/` sidecar** — FastAPI service loading `Qwen/Qwen3-Reranker-0.6B` (Apache-2.0), `POST /rerank` returning reordered indices + scores, `/health`, Dockerfile, compose service on port 8100 (`RERANKER_MODEL`, `RERANKER_BATCH_SIZE` overrides).
4. **`services/intelligence/app/rerank.py`** — typed client for the sidecar (rule 22: `IngestionError` provider_timeout/provider_unavailable, bounded retry, injected transport for tests). 6 unit tests pass.
5. **Probe hardening** — `probe_questions.json` 16 → 30 questions; Q15 snippet fixed (stray "illustration" token); 3 questions gained `altSnippets` for genuinely-answerable repeated passages; `retrieval_probe.py` and `embedding_bakeoff.py` now score multi-gold and support `--hybrid` / `--rerank` / `--title-prefix` / `--onnx-path` / vector caching.

## Tuning evidence

RRF sweep (dense-only baseline: r@1 0.70 / r@3 0.83 / MRR 0.788):

| k | wD | wL | pool | r@1 | r@3 | MRR |
|---|---|---|---|---|---|---|
| 60 | 1.0 | 1.0 | 50 | 0.67 | 0.90 | 0.780 (equal-weight regressed r@1) |
| 60 | 1.0 | 0.7 | 25 | **0.73** | **0.90** | **0.816** |

The 0.7 lexical weight matters: equal-weight RRF let noisy BM25 candidates displace strong dense hits.

## Rejected levers and why

- **Contextual title prefix (Phase 3):** prepending "ACCA APM Study Text: Advanced Performance Management" to every embed input changed exactly one rank (Q15 17→16) and moved no metric. The corpus already carries running headers ("Chapter N ... KAPLAN PUBLISHING") in every chunk, so the title adds no disambiguating context. Keeping unmodified chunks.
- **ONNX int8 (Phase 4):** 2.45× embed speedup (150 vs 61 chunks/min) but recall@1 collapsed 0.73 → 0.10; quantized vectors cluster (ranks stuck at 28-30, mean top-sim 0.967) so the MRL/pooling semantics are not preserved through quantization. Not production-viable without a fidelity fix outside this program's scope.

## Observed failure cases (remaining gap)

With the accepted stack (hybrid + rerank@50), 23/30 questions rank the answer #1. The residual misses:

- Q2 (planning-gap measures, ord 115) and Q6 (learning curve, ord 270): answer ranked 2 by reranker — the reranker prefers a near-synonymous passage; both within recall@3.
- Q5 (liquidity, ord 526): rank 3 — 526 also answers Q15; the chunk packs multiple definitions.
- Q15 (ROI/RI/EVA list, ord 526): rank 16-17 — the answer is a bare acronym list with no defining prose; lexical and dense both fail to connect "divisional profitability measures" to the list chunk. This is the hardest question for every config.
- Q29 (communication, ord 23/759/760): rank 3 — gold spans three passages (syllabus bullet + prose definition + exam-marks description).

## Latency

- Hybrid retrieval: in-DB, no added API calls (tsvector column + GIN).
- Rerank: ~0.81 s/pair at batch 8 on CPU → top-50 candidates ≈ 41 s/query, top-25 ≈ 20 s. Under the 2 s/pair budget.
- Qwen corpus embed: 81 chunks/min FP32 CPU (~9.7 min for this book, zero quota).

## Reproduction

```bash
# 1. Probe live RPC (needs embedded chunks in the DB)
cd services/intelligence
uv run --package intelligence python scripts/retrieval_probe.py <material_id> --hybrid

# 2. Full bake-off matrix (in-process, cached vectors)
export HF_HOME=/mnt/d/hf-cache
.venv-bakeoff/Scripts/python.exe scripts/embedding_bakeoff.py \
  --material <material_id> --models qwen --hybrid --rerank \
  --cache .dev/bakeoff/qwen-vectors --output <report.md>
```

## Follow-ups

- Production wiring of the rerank step into the future retrieval endpoint (the sidecar + client exist; no caller consumes them yet).
- When the worker moves to the local Qwen embedder, its NULL-scan resume and atomic per-material re-embed already guarantee hybrid-consistent vectors (dense branch reads whatever is stored).
