# FINDINGS — PDF ingestion performance & embedding-quality baseline (interim)

Status: interim (2026-08-14), root cause corrected. The E2E failure was the
worker bursting past the provider's per-minute token quota (TPM 30 k from the
AI Studio dashboard), not a daily cap; the fix (TPM throttle) is implemented
and the full-book re-run is pending. Numbers below are real measurements from
the live stack.

> **Updated 2026-08-17 (work-docs reconciliation):** the two open decisions
> below are now mostly superseded — the 16-question retrieval probe was
> replaced by the completed 30-question retrieval-quality program (2026-08-15,
> `f467f76`, live hybrid + rerank scoring), and the Qwen3 GPU sidecar
> (2026-08-16, `f08c47c`) removes the Gemini quota from the embedding hot path
> entirely. Only the full-book Gemini PDF validation run remains open, and it
> is likely moot under the sidecar path (confirm before closing).

## Measured numbers (572-page ACCA APM textbook, `80c8b138-...`)

| Metric | Value | Source |
|---|---|---|
| PDF extract (download + pypdf + clean) | 7.38 s (12.9 ms/page, serial) | telemetry `extract` |
| Chunking (tiktoken, 788 chunks / 245,404 tokens) | 2.35 s | telemetry `chunk` |
| Fulltext upload | 0.80 s | telemetry `upload` |
| Embed provider call (3,836 tokens avg, 12 texts) | mean 1.18 s · p50 1.28 s · p95 1.36 s | telemetry `embed-batch` |
| Embed throughput | 3,239 tokens/s (provider wall time) | telemetry |
| Batch token-budget utilization | 96 % (3,836 / 4,000) | telemetry |
| Provider retries | 0 / 8 (no 429 during the successful prefix) | telemetry |
| Zero-vector skipped chunks | 0 / 788 | DB |
| Chunk size | mean 311 · p50 343 · p90 400 tokens | report script |
| Overlap waste (60-token tail × 787 boundaries) | 47,220 tokens ≈ 19.2 % of embedded text | report script |
| Gemini free-tier limits (AI Studio dashboard) | **RPM 100 · TPM 30 k · RPD 1000** | dashboard (user) |
| E2E failure point | 7 calls × 3,836 ≈ 27 k tokens in ~10 s; 8th call crossed ~30 k TPM → 429 | telemetry |
| 429 recovery | seconds (next wall-clock minute) — the wall is per-minute, NOT daily | probes |
| Full-book embedding requirement | ~293 k tokens (245 k + 47 k overlap; ~270 k after C3) → **~9-10 min at 30 k TPM, ~70 calls < RPD 1000** | report script |

## Root causes (ranked by impact)

1. **The worker burst past the provider's per-minute token quota — a code bug,
   now fixed (C8).** The free tier allows ~30 k input tokens/minute (RPM 100 ·
   TPM 30 k · RPD 1000). The embed stage sent ~3.8 k-token batches back-to-back
   (~1.2 s apart), crossing ~30 k tokens in ~10 s; the 8th call tripped TPM and
   failed the material with `quota_exhausted`. The full book (~270-293 k
   tokens) actually **fits the daily request quota (~70 calls < RPD 1000)** and
   needs only ~9-10 min of embedding when paced. The earlier "daily ~100 k"
   interpretation was wrong: the 429 recovered within seconds, which is
   per-minute behavior. Fix: sliding-window `TokenRateLimiter` in the embed
   stage (`INGESTION_MAX_TOKENS_PER_MINUTE`, default 25 k) sleeps instead of
   bursting.
2. **Retry after `quota_exhausted` discarded completed embeddings — fixed
   (C2).** The retry flow re-extracted and replaced chunks (D-05), deleting the
   vectors that already succeeded (30,690 tokens of work thrown away in this
   run). Identical re-extractions now keep the existing chunk rows, so only
   missing vectors are re-embedded.
3. **Overlap costs ~19 % extra embedding volume.** The 60-token overlap tail
   on every boundary re-embeds ~47 k tokens of a 245 k-token book — directly
   consuming scarce quota. Candidates: reduce overlap (e.g., 30), overlap only
   across paragraph boundaries, or chunk boundaries aligned to headings.
4. **Small materials pay a fixed ~1.2 s per provider call** (1-chunk text/URL
   materials took ~1.15-1.4 s embed). Batching multiple materials' chunks
   would amortize it; not critical for big books.
5. **Serial worker pipeline** (`max_in_flight=1`): the PDF's embed stage
   waited ~40 s behind the URL-retry material's redeliveries in the same run.
   Raising `INGESTION_MAX_IN_FLIGHT` (carefully, bounded) reduces cross-
   material tail latency.
6. **E2E retry-scenario flake (infra):** the service has no
   `SUPABASE_JWT_SECRET`, so ES256 tokens verify via a network JWKS fetch;
   a flaky fetch or a dev reload produces intermittent 401s on valid tokens.
   Not a sweep regression; fix = configure the secret or cache JWKS.

## Improvement candidates (each tied to a measurement above)

| # | Candidate | Status | Expected gain |
|---|---|---|---|
| C8 | TPM throttle — sliding-window rate limiter in the embed stage | ✅ implemented (default 25 k/min, env knob) | Unblocks full-book ingestion on the free tier |
| C2 | Resume embeddings on retry instead of replacing chunks | ✅ implemented | No re-embedding of completed work after a mid-run failure |
| C3 | Overlap 60 → 30 tokens | ✅ implemented | ~10 % less embedding volume (~24 k tokens/book) |
| C1 | Quota-aware UX: warn users pre-upload about size vs per-minute quota | open | Sets expectations for large PDFs |
| C4 | Heading-aware chunking (page headers, running heads) | open | Better chunk coherence + less vector noise |
| C5 | Raise `INGESTION_MAX_IN_FLIGHT` (e.g., 2) | open | ~2× cross-material throughput |
| C6 | Configure `SUPABASE_JWT_SECRET` (or JWKS caching) | open | Kills the intermittent 401 E2E flake |
| C7 | Parallelize pypdf page extraction (multiprocessing) | open | ~7.4 s → ~2 s (minor vs ~10 min embed) |

## Open decisions

- [ ] Validate the throttle live: re-run the full-book PDF E2E (uses ~270 k
  tokens / ~70 requests of the RPD 1000 budget). Open; likely superseded by
  the local Qwen3 GPU embedder (2026-08-16) — confirm before closing.
- [x] Run the retrieval probe (16 questions, ~1-2 k tokens) — superseded by
  the 30-question multi-gold retrieval-quality program (2026-08-15,
  `f467f76`); completed and documented in
  `research/doc/2026-08-15-retrieval-quality-program-results.md`.
