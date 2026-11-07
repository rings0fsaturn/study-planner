# Gap-3 second corpus: DDIA (2026-10-22)

- Corpus: `1094` chunks of `ef3abfa1-99c7-4166-8ba7-6560c862f49f` (Designing Data-Intensive Applications, already ingested `ready`, `qwen-sidecar`, 0 NULL embeddings). Chosen over the un-ingested 632-page fixture: same generalization question, no ingest spend.
- Gold set: 30 label/question/snippet Q&As authored for DDIA, every snippet mechanically verified present in at least one chunk before the run (`research/doc/2026-10-22-ddia-questions.json`). Short snippets avoid PDF soft-hyphen artifacts.
- Method: gap-1 driver recipe verbatim (sidecar GPU embed, in-process hybrid RRF k=60/wD=1.0/wL=0.7/pool25 top-50, sidecar Qwen3-Reranker over top-50, multi-gold scoring). Dry `--limit 2` green first.
- Answered: `30` skipped=[]; rerank mean 0.72 s / p95 0.84 s per call. No paid APIs.

| arm | recall@1 | recall@3 | recall@5 | MRR | mean top sim |
|---|---|---|---|---|---|
| dense | 0.40 | 0.73 | 0.83 | 0.593 | 0.668 |
| hybrid | 0.47 | 0.73 | 0.83 | 0.660 | 0.646 |
| hybrid_rerank | 0.63 | 0.90 | 0.97 | 0.799 | 0.644 |

- Lever check: rerank deltas on DDIA are r@1 +16 (0.47 to 0.63), r@3 +17 (0.73 to 0.90), MRR +0.139 (0.660 to 0.799). Same direction as ACCA (+7/+10/+0.077), larger magnitude. The generalization claim holds for direction; absolutes differ by corpus and gold set, as expected.
- Honest notes: Q22 (`serializable strongest`) misses on all arms - its snippet sits in a 59-chunk term crowd and never reaches top-50. DDIA dense r@1 (0.40) trails ACCA dense (0.60); the gold sets are independently authored, so cross-corpus absolutes are not comparable, only the arm deltas are.
