# Ingestion telemetry report — `80c8b138-b544-4095-8dc0-1c390ac70da2`

- **Title:** E2E ingestion pdf 1786713902107
- **Kind:** file · **State:** failed
- **Chunk count:** 788 · **Grounding version:** None
- **Telemetry records:** 12

## Attempts (ingestion_jobs)

| attempt | status | error | created_at | completed_at |
|---|---|---|---|---|
| 1 | failed | quota_exhausted: embedding quota exhausted | 2026-08-14T13:25:12 | 2026-08-14T13:26:06.139936+00:00 |

## Stage breakdown

| stage | count | engine | total | p50 | p95 |
|---|---|---|---|---|---|
| chunk | 1 | tiktoken-cl100k | 2.35s | 2.35s | 2.35s |
| embed | 1 | local | 11.77s | 11.77s | 11.77s |
| embed-batch | 8 | gemini-embedding-001 | 9.47s | 1.28s | 1.36s |
| extract | 1 | pypdf | 7.38s | 7.38s | 7.38s |
| upload | 1 | supabase-storage | 800ms | 800ms | 800ms |

## Embedding provider calls (embed-batch)

- **Calls:** 8 · **Total tokens:** 30,690
- **Mean tokens/call:** 3836 · **Mean texts/call:** 12
- **Latency — mean:** 1.18s · **p50:** 1.28s · **p95:** 1.36s · **max:** 1.36s
- **Retried calls:** 0 (0.0%)
- **Outcomes:** ok=7, quota_failure=1
- **Embedding throughput:** 3,239 tokens/s (provider wall time)

**Sum of stage latencies (worker-side pipeline time):** 31.77s

## Chunks

- **Total chunks:** 788 · **Skipped (provider zero vector):** 0
- **Tokens — total:** 245,404 · **mean/chunk:** 311 · **p50:** 343 · **p90:** 400 · **max:** 400
- **Overlap waste (est. 60 tokens × 787 boundaries):** 47,220 tokens (19.2% of embedded text)

