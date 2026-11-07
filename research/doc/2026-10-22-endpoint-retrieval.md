# Gap-2 endpoint retrieval (2026-10-22, live /v1/retrieval/search)

- Material: `80c8b138-b544-4095-8dc0-1c390ac70da2`; topK 50; hybrid default true; dev-account JWT (material owner, no 404); one X-Request-ID per call with same-id retry (rule 17).
- Answered: `30` skipped=[]; 60 calls total.
- Runtime note: the managed stack was externally stopped mid-run (intelligence SIGTERM during Q3, connection reset); intelligence + sidecar were restarted and the driver retried with the same request-id. All 60 request_ids join `intelligence.log`.

| flag | recall@1 | recall@3 | recall@5 | MRR | latency mean/p95 (s) |
|---|---|---|---|---|---|
| rerank=false | 0.60 | 0.73 | 0.87 | 0.703 | 0.99/1.33 |
| rerank=true | 0.70 | 0.90 | 0.93 | 0.813 | 1.58/1.77 |

- Equivalence check: plain arm reproduces the live RPC probe (0.60/0.73/0.87/0.703) exactly.
- Rerank deltas on the endpoint: r@1 +10 (0.60 to 0.70), r@3 +17 (0.73 to 0.90), MRR +0.110 (0.703 to 0.813).
- Variance note: endpoint reranked (0.70/0.813) reads slightly above the harness arm (0.67/0.797); the RPC candidate set differs slightly from the in-process RRF copy, so per-question ranks move (Q15 18 vs 13, Q29 8 both). Report the endpoint row as the deployed number.
- Cost: 60 endpoint calls, sidecar GPU only, no paid APIs.

| Q | answer chunk | plain | reranked |
|---|---|---|---|
| 1 | 114 | 1 | 1 |
| 2 | 114 | 1 | 2 |
| 3 | 192 | 1 | 1 |
| 4 | 219 | 1 | 1 |
| 5 | 504 | 2 | 1 |
| 6 | 258 | 3 | 2 |
| 7 | 685 | 1 | 1 |
| 8 | 149 | 1 | 1 |
| 9 | 644 | 1 | 2 |
| 10 | 690 | 1 | 1 |
| 11 | 700 | 2 | 1 |
| 12 | 663 | 1 | 1 |
| 13 | 316 | 1 | 1 |
| 14 | 291 | 1 | 1 |
| 15 | 503 | 31 | 18 |
| 16 | 549 | 4 | 1 |
| 17 | 131 | 1 | 1 |
| 18 | 135 | 5 | 1 |
| 19 | 345 | 1 | 5 |
| 20 | 293 | 2 | 2 |
| 21 | 472 | 1 | 1 |
| 22 | 612 | 1 | 1 |
| 23 | 99 | 4 | 1 |
| 24 | 115 | 1 | 1 |
| 25 | 346 | 5 | 1 |
| 26 | 439 | 9 | 2 |
| 27 | 128 | 19 | 1 |
| 28 | 349 | 1 | 2 |
| 29 | 727 | 6 | 8 |
| 30 | 440 | 1 | 1 |
