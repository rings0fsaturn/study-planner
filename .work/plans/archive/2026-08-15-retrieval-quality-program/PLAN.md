# Retrieval Quality Program (embedding bake-off follow-up)

- Status: ✅ Implemented and verified 2026-08-15
- Scope: improve RAG retrieval quality on the 572-page book corpus with Qwen3-Embedding-0.6B as the embedder, without swapping models
- Evidence: [`research/doc/2026-08-15-retrieval-quality-program-results.md`](../../../research/doc/2026-08-15-retrieval-quality-program-results.md)

## Decisions (grilled 2026-08-15)

1. Embedder stays Qwen3-Embedding-0.6B (768-dim, CPU, zero quota).
2. Probe hardened first: 16 → 30 verified questions, multi-gold scoring (answerSnippet + altSnippets), Q15 snippet fixed.
3. Reranker + future local embedder live in a sidecar container (keeps torch out of the Intelligence service).
4. Phase ordering 0 → 1 → 2 → 3, cheapest-measurable-first.

## Results

| phase | config | r@1 | r@3 | r@5 | MRR | verdict |
|---|---|---|---|---|---|---|
| 0 | dense baseline | 0.70 | 0.83 | 0.90 | 0.788 | frozen |
| 1 | hybrid BM25 + dense RRF (k=60, wL=0.7, pool 25) | 0.73 | 0.90 | 0.93 | 0.816 | ✅ PASS |
| 2 | + Qwen3-Reranker-0.6B over top-50 | 0.77 | 0.97 | 0.97 | 0.858 | ✅ PASS |
| 3 | + contextual title prefix | 0.77 | 0.97 | 0.97 | 0.858 | ❌ REJECTED (no gain) |
| 4 | ONNX int8 | 0.10 | 0.10 | 0.10 | 0.131 | ❌ REJECTED (r@1 collapse) |

## Shipped

- Migrations `015_hybrid_retrieval.sql` + `016_hybrid_rrf_tuning.sql` (pushed to dev): tsvector column + GIN index; 4-arg `match_content_chunks` hybrid RRF overload; legacy 3-arg preserved.
- `services/reranker/` FastAPI sidecar (Qwen3-Reranker-0.6B) + Dockerfile + compose service (port 8100).
- `services/intelligence/app/rerank.py` typed client + `tests/test_rerank.py` (6 tests).
- Probe upgrades: `probe_questions.json` (30 Q), `retrieval_probe.py` (`--hybrid`, multi-gold), `embedding_bakeoff.py` (`--hybrid/--rerank/--title-prefix/--onnx-path/--cache`).

## Verification

- Service tests: 229 passed + 5 pre-existing golden-fixture failures (unrelated; confirmed by stash).
- Repo typecheck clean, repo lint clean, service ruff clean.
- Live RPC probed on the dev project (migration 015/016 applied).
- Bake-off smoke re-ran from cache and reproduced exact hybrid numbers after the lint refactor.

## Follow-ups

- Wire the rerank step into the future retrieval endpoint (client + sidecar exist, no caller yet).
- Local Qwen embedder as production `EMBEDDING_BACKEND` (worker already supports the adapter seam).
