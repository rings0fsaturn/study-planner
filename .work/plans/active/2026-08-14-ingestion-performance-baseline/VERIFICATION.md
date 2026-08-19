---
title: VERIFICATION — PDF Ingestion Performance & Embedding-Quality Baseline
status: in progress
created: 2026-08-14
---

# VERIFICATION — 2026-08-14 Ingestion Performance Baseline

Per-phase evidence lives here as work completes.

## Phase 0 — Plan docs

- [x] PLAN.md created; STATUS.md Active row added.
- [x] `git status` confirms only unrelated pre-existing changes
  (`apps/marketing/.astro/settings.json`, untracked `supabase/`).

## Phase 1 — Telemetry contract implementation

- [x] `app/ingestion/telemetry.py` + unit tests pass.
- [x] Migration `014` pushed and live-probed (rule 36): table columns,
  RLS enabled, no anon/authenticated grants, service-role grants, indexes.
- [x] Contract fixtures validate (`contracts/phase2/tests`).
- [x] Worker + embedder instrumentation unit tests pass.
- [x] Focused suites + ruff clean (service suite 223 passed + the same 5
  pre-existing golden-fixture failures).

## Phase 2 — Report script

- [x] `ingestion_report.py` runs against the live PDF material; report
  committed as `baseline-report-pdf-material.md`.

## Phase 3 — Baseline run (2026-08-14, full live E2E)

- [x] Full live E2E spec run: **3 passed, 2 failed, 2 skipped** (8.0 min).
- [x] Telemetry report for the PDF material committed to this folder.
- [x] Issue-37 readiness VERIFICATION.md appended with evidence.
- [ ] Re-run of the PDF scenario under the C8 throttle (the wall is per-minute
  TPM, not a daily cap; the book fits RPD 1000 in ~9-10 min when paced).
  **Open as of 2026-08-17** and likely superseded by the local Qwen3 GPU
  embedder path (`2026-08-16-dockerize-embed`) — confirm before closing.

### Baseline numbers (first real measurement of the pipeline)

| Metric | Value |
|---|---|
| 572-page extract (pypdf, serial) | 7.38 s (12.9 ms/page) |
| Chunking 788 chunks / 245,404 tokens | 2.35 s |
| Fulltext upload (23 MB) | 0.80 s |
| Embed: per-call latency (3.8k tokens) | mean 1.18 s, p50 1.28 s, p95 1.36 s |
| Embed: throughput | 3,239 tokens/s (provider wall) |
| Batch token budget utilization | 96 % (3,836/4,000) |
| Retried provider calls | 0/8 |
| Skipped chunks (zero vector) | 0 |
| Chunk size | mean 311, p50 343, p90 400 tokens |
| Overlap waste (60-token tail × 787) | 47,220 tokens ≈ 19.2 % of embedded text |
| Gemini free-tier daily quota | ~100 k tokens (probe-confirmed wall) |
| Full-book requirement | ~307 k embedded tokens → ~3 days on free tier |

### Root causes found (corrected after dashboard limits were confirmed)
1. **The worker burst past the per-minute token quota (TPM 30 k — dashboard:
   RPM 100 · TPM 30 k · RPD 1000), NOT a daily cap.** ~27 k tokens in ~10 s,
   the 8th call crossed 30 k → 429 `quota_exhausted`; recovery took seconds.
   The full book (~270 k tokens after C3) fits RPD 1000 (~70 calls) and takes
   ~9-10 min when paced. **Fixed: C8 TPM throttle.**
2. **Retry-after-quota discards progress.** The retry flow re-extracted and
   replaced chunks (D-05), deleting the embeddings that already succeeded.
   **Fixed: C2 resume.**
3. **E2E retry-scenario flake:** the service has no `SUPABASE_JWT_SECRET`, so
   ES256 verification does a network JWKS fetch per uncached kid; a flaky
   fetch or a dev reload yields an intermittent 401 on a valid token.
4. **Small-material embedding cost:** even 1 chunk takes ~1.2 s (fixed
   provider/network overhead per call).

## Phase 4 — Retrieval probe

- [x] `retrieval_probe.py` + `probe_questions.json` (16 questions, each with a
  verbatim, single-match answer snippet from the book) authored and lint-clean.
- [x] Run — superseded and completed by the 30-question multi-gold
  retrieval-quality program (2026-08-15, `f467f76`): the probe was hardened to
  30 questions with altSnippets, and hybrid + rerank configs were scored live
  against the pushed migrations 015/016. See
  `.work/plans/archive/2026-08-15-retrieval-quality-program/` and
  `research/doc/2026-08-15-retrieval-quality-program-results.md`.


## Phase 5 — FINDINGS.md + C2/C3/C8 implementation

- [x] FINDINGS.md written with ranked candidates, each tied to a measured
  number; root cause corrected after the dashboard limits (TPM 30 k) were
  confirmed.
- [x] **C8 TPM throttle implemented:** `TokenRateLimiter` (sliding 60 s window)
  gates every provider sub-batch in `_embed_batch`; env
  `INGESTION_MAX_TOKENS_PER_MINUTE` (default 25,000, headroom under the
  30 k TPM). Unit tests cover window sliding, over-budget single batches, and
  a whole-stage pacing run with a fake clock.
- [x] **C2 resume-on-retry implemented:** `_handle_extract` now lists existing
  chunks and, when the re-extracted text is byte-identical, reuses the
  existing chunk rows so already-embedded vectors survive; only missing
  vectors are re-embedded (NULL-scan). Changed content still replaces chunks
  (stale vectors dropped). New repo method `list_chunks`; worker tests cover
  preserve/replace/first-run paths.
- [x] **C3 overlap tuned 60 -> 30 tokens** (`chunking.py` default; chunk tests
  pin the new default; report script waste estimate updated). Expected waste:
  ~19.2% -> ~9.6% of embedded text on the 572-page book (~24 k tokens saved
  per full run).
- [x] Suites after C2/C3: service 220 passed + same 5 pre-existing
  golden-fixture failures; contracts 6/6; ruff clean (only the pre-existing
  `test_v1_integration.py` E501 remains).

## Status (2026-08-17 reconciliation)

- C2 resume-on-retry, C3 overlap 60 -> 30, and C8 TPM throttle are implemented
  and unit-tested (phases above); telemetry and the report script are live.
- The full-book PDF E2E under the C8 throttle is the only remaining open
  validation. It is likely superseded by the local Qwen3 GPU embedder path
  (`2026-08-16-dockerize-embed`, ~10 s per book, zero quota) — the user should
  confirm whether to close it without a Gemini re-run.
- The 16-question retrieval probe was superseded by the completed 30-question
  retrieval-quality program (2026-08-15). FINDINGS.md carries the same
  reconciliation.
