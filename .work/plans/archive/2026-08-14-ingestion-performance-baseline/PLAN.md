---
title: PDF Ingestion Performance & Embedding-Quality Baseline
status: active
created: 2026-08-14
branch: phase2/issue-37
tags: [APP, RESEARCH, ingestion, telemetry, embeddings, performance]
---

# PLAN — PDF Ingestion Performance & Embedding-Quality Baseline

## Goal

Measure how the production ingestion pipeline behaves on a real 572-page PDF
(end-to-end), understand how well Gemini embedding performs, quantify pipeline
efficiency, and produce a measurement-backed list of speed/accuracy
improvement candidates (including preprocessing).

## Decisions (user-approved 2026-08-14)

- **D-01** Implement the approved `GenerationTelemetry` contract as the
  metrics layer now (not a throwaway log format): worker emits contract-shaped
  records, persisted in a new server-owned Supabase table (`migration 014`).
- **D-02** Embedding accuracy is in scope for the first pass: a retrieval
  probe (recall@k / MRR via `match_content_chunks`) runs after the baseline.
- **D-03** The baseline run is the full live E2E ingestion spec
  (`e2e/material-ingestion-live.spec.ts`), which also closes the issue-37
  handover's one unverified slice (live E2E against the post-sweep code).
- **D-04** Findings and metrics artifacts live in this plan folder; STATUS row
  added under Active.

## Out of scope

- Changing extraction/chunking/embedding parameters (improvements are
  *candidates* measured by this baseline, implemented in follow-ups).
- Docker runtime verification (operator step on a Docker-enabled host).
- Emitting telemetry for generation/grading tasks (table and contract already
  accept the full task enum; only ingestion emits today).

## Telemetry design

- Contract: `contracts/phase2/generation-telemetry.schema.json` (approved).
- Table `public.generation_telemetry` (migration `014`): contract fields
  (`trace_id, owner_id, task, model, prompt_template_version, outcome,
  latency_ms, input_tokens, output_tokens, repair_attempted`) plus
  persistence-only `id, material_id, attempt, stage, created_at`.
  RLS enabled, no policies: service-role writes only (server-owned, redacted).
- Worker emits per stage:
  - `extract` (task=ingestion; model=pypdf/trafilatura/youtube/local): whole
    extract+clean wall time.
  - `chunk` (model=tiktoken-cl100k): wall time + total chunk tokens.
  - `upload` (model=supabase-storage): fulltext upload wall time.
  - `embed` stage aggregate (model=local): whole embed-loop wall time incl.
    bulk RPC writes; plus per `batchEmbedContents` call (task=embedding,
    model=gemini-embedding-001) with latency, input tokens, attempts, outcome,
    `repair_attempted` (retries > 0).
  - `publish` (model=supabase-rpc): verify + publish RPC wall time.
  - Failure records on stage failure with contract outcome mapping
    (`provider_timeout→timeout`, `quota_exhausted→quota_failure`,
    `rate_limited/provider_*→provider_error`, `malformed_output`, else
    `partial`).
- `traceId` = ingestion job `correlation_id`; a full PDF run is queryable
  end-to-end.

## Phases

### Phase 0 — Plan docs (this folder + STATUS row)
Done: PLAN.md, VERIFICATION.md, STATUS.md Active row.

### Phase 1 — Telemetry contract implementation
- `app/ingestion/telemetry.py`: `TelemetryRecord`, `TelemetrySink` protocol,
  `LoggingTelemetrySink`, `SupabaseTelemetrySink` (bare-array bulk insert),
  null sink.
- Migration `014_generation_telemetry.sql`; dry-run + push (rule 36).
- `GeminiEmbedder` embedding observer: `EmbeddingStats` (texts, tokens,
  latency_ms, attempts, outcome) reported after every `embed()` call.
- Worker instrumentation (extract/chunk/upload/embed/publish/failure).
- `worker_main.py` wiring (sink + token counter into embedder).
- Tests: record-shape vs contract schema, sink payloads, observer stats,
  worker emission + failure + emission-failure resilience.
- Contract fixtures: `telemetry-ingestion.json`, `telemetry-embedding.json`
  registered in `fixtures/manifest.json`.

### Phase 2 — Metrics report script
`services/intelligence/scripts/ingestion_report.py <material_id>`: stage
breakdown, embed batch p50/p95/mean latency, tokens/s, chunks/s, retry rate,
outcome distribution, chunk token distribution, overlap waste estimate,
total pipeline wall time. Markdown output.

### Phase 3 — Baseline run (full live E2E)
Clean runtime per handover (unset GEMINI_API_KEY, restart worker + full-app),
run `e2e/material-ingestion-live.spec.ts`, then generate the report for the
PDF material. Append evidence to issue-37 readiness VERIFICATION.md.

### Phase 4 — Retrieval-quality probe
`services/intelligence/scripts/retrieval_probe.py`: ~15–20 labeled questions
against the textbook fixture, embed with `taskType=retrieval_query`, query
`match_content_chunks`, report recall@1/3/5 + MRR + skipped rate.

### Phase 5 — Analysis + FINDINGS.md
Ranked improvement candidates, each tied to a measured number from Phases 3–4
(extraction time share, batch sizes vs Gemini limits, retry/429 frequency,
overlap waste, preprocessing candidates).

## Verification

- `uv run --package intelligence pytest services/intelligence/tests -q`
- `uv run --package intelligence pytest services/intelligence/contracts/phase2/tests -q`
- `uv run ruff check services/intelligence`
- Live E2E (Phase 3) with report artifacts in this folder.
