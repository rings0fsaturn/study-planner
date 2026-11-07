# Gap 2 plan - endpoint-level retrieval numbers (2026-10-22)

_Goal: r@1/r@3/r@5/MRR through the deployed `POST /v1/retrieval/search` with `rerank: false` vs `rerank: true` on durable 754, so the paper reports endpoint numbers, not just harness/RPC-probe numbers._

## Ground facts

- Route: `services/intelligence/app/routers/retrieval.py:31`; body `materialId`, `topK` default 10 (MAX 50), `hybrid` default true, `rerank` default false, `rerankTopK` default = topK (:20-67).
- All `/v1` routes carry auth; drive it with the dev-account token flow used by live E2E (rule 16) or a service-scoped caller the router accepts. Confirm by reading the router's dependency before writing the driver.
- Same 30Q set (`scripts/probe_questions.json`) and multi-gold scoring as gap 1; set `topK: 50` to match the harness top-50.

## Steps

1. Start managed runtime (`./full-app start full`) + sidecar; verify service `/health`, sidecar `/health`, app sign-in.
2. Dry run per rule 80: driver with 2 questions x both flags. Inspect: per-question rank records parse, auth accepted, no secrets in output.
3. Full run: 30 questions x 2 flags on material `80c8b138`. Record per-call latency for a p50/p95 column.
4. Write `research/doc/2026-XX-endpoint-retrieval.md` (same table shape as gap-1 doc) + JSON beside it; close gap 2 in the brief.

## Acceptance

- 30/30 answered or explicitly skipped per flag; endpoint numbers within noise of harness numbers (dense-path equivalence check) or the delta is explained, not ignored.
- Reported: r@k/MRR per flag + rerank latency p50/p95 + auth path used.

## Cost

- Sidecar GPU minutes only; no paid APIs. Stop sidecar + runtime after.
