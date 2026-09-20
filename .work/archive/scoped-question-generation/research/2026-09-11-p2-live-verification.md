# P2 live verification — page provenance through ingestion (2026-09-11)

Ticket #62 · phase 2 of `plan/PLAN.md` · branch `phase2/issue-62-scoped-question-generation`.
Everything below is measured, not predicted. Probes: `/tmp/p2_check.py`,
`/tmp/p2_rpc_check.py`, `/tmp/p2_boundary_check.py` (throwaway, not committed;
the durable checks are the unit tests listed at the end).

## 1. Offline identity check — did page tagging move anything?

Real fixture `e2e/pdf/sample-textbook-572page.pdf` (22,919,258 bytes, the stored
copy of the ingested ACCA APM material). Runs the pre-P2 path
(`clean_text("\n\n".join(pages))` -> `document_segments` -> `chunk_segments`) and
the P2 path (same `text`, page-tagged paragraph segments) and compares.

| Measurement | Result |
|---|---|
| Pages | 572 |
| `ExtractedContent.text` | 963,136 chars — the pre-P2 number, unchanged |
| Paragraph segments old / new | 1257 / 1257, **texts identical** |
| Chunks old / new | 754 / 754, **texts identical** |
| Chunks carrying a page | 754/754 |
| Page bounds inside 1..572 | all; `page_start` monotone across ordinals |
| Straddling chunks (`page_start != page_end`) | 372 |
| First / last chunk pages | (1, 2) / (571, 572) |

This is the P2 gate's core claim: attaching the page to the existing paragraph
segments cannot move a chunk boundary, so the live 754-chunk baseline and every
measured retrieval number survive. 372 of 754 chunks straddle a page boundary,
which is why the schema carries two columns instead of one.

## 2. Migration 029

- `npx supabase db push --dry-run` listed exactly `029_page_scoped_chunks.sql`;
  the real push applied it (`{"migrations":["029_page_scoped_chunks.sql"]}`).
- Live signatures after the push (`pg_proc`):
  - `match_content_chunks(halfvec,text,integer)` — legacy 3-arg, untouched;
  - `match_content_chunks(halfvec,text,integer,text,integer,integer)` — new, returns
    `page_start`/`page_end`.
  The 4-arg hybrid overload is gone: the new signature defaults both page bounds,
  so the existing 4-named-argument callers resolve to it unambiguously (see §3A).

## 3. Live re-ingest (APM material `80c8b138-b544-4095-8dc0-1c390ac70da2`)

`content_chunks` rows deleted (D-07 — the byte-identical reuse shortcut at
`worker.py:391-397` would otherwise keep the old NULL-page rows), then
`POST /rest/v1/rpc/retry_material_ingestion` (200, job
`892af4f2-519e-4f13-8e62-ee1263a97471`). The detached ingestion worker was
restarted first (rule 53, no hot reload) and the GPU sidecar was up
(`/health`: `cuda_available: true`, `device: AMD Radeon RX 9070 XT`).

State walk: `extracting` (0.25) -> `embedding` (0.60) -> `ready` (1.00) in ~45 s,
including 754 re-embeddings on the local sidecar (free, per the locked scoping
decision).

SQL, after `ready`:

```
total=754 paged=754 min_p=1 max_p=572 straddling=372 out_of_range=0 embedded=754
```

Every chunk carries a page, the range is exactly 1..572, the straddling count
matches the offline measurement (372), and all 754 embeddings were rewritten.
Note: reading `content_chunks` over PostgREST with a *user* token returns 0 rows
by design (service-owned table, no client policy) — the checks above use SQL /
service role.

## 4. RPC behaviour (service role, live project)

Steer "Chapter 5 Budgeting and control" embedded on the sidecar.

| Call | Result |
|---|---|
| A. unscoped (4 named args, no page bounds) | 5 hits, ordinals **203, 271, 204, 269, 202**, pages (157,158) (203,203) (158,158) (202,202) (156,157) — the P1-measured chapter-steer result, so the rebuilt function is a regression-free replacement |
| B. `p_page_start=124, p_page_end=170` | 5 hits, ordinals 203, 204, 202, 208, 220; all overlap the range; ordinal 271 (page 203) correctly excluded |
| C. boundary: `158..158` | hits include (157,158) and (158,159) |
| C. boundary: `1..3` | hits include (3,4) |
| C. boundary: `157..157` | hits include (156,157) |
| D. pageless `url` material, scoped 1..5 | 0 hits (NULL pages never match a range) |
| D. same material unscoped | 1 hit (its text is unchanged) |

Section C is the inclusivity proof: a single-page range keeps the chunks that
merely *overlap* it. Containment would have dropped every one of the listed
chunks, and those are exactly the chunks carrying the section's opening text.

## 5. Tests

- Focused: `uv run pytest tests/test_chunking.py tests/test_extractors.py
  tests/test_repository.py tests/test_models.py tests/test_ingestion_worker.py`
  -> **126 passed**. New: 4 page-propagation tests (range per chunk, overlap tail
  carries the page, NULL for pageless sources, oversized-paragraph re-split) and
  2 extractor tests (paragraph page tagging; `text` still built by one clean over
  the joined pages).
- Whole service: **515 passed / 7 failed**. The 7 are `tests/test_retrieval_probe.py`
  (2) plus `tests/test_v1_integration.py` (5), and the **identical 7 fail on the
  untouched base** — checked in a clean `git worktree` at `c30cd43`: same 7 test
  ids, same count. Causes are unrelated to this phase: the probe test cannot
  import `services.*` (`ModuleNotFoundError: No module named 'services'`), and the
  integration failures are calibration golden fixtures drifting `evening` ->
  `afternoon`. The +6 over P1's 509-passed baseline is exactly the 6 new P2 tests.

## 6. Files touched by P2

`app/ingestion/models.py` (`TextSegment.page`, `ContentChunk.page_start/page_end`),
`app/ingestion/extractors.py` (per-page reader + `_page_segments`),
`app/ingestion/chunking.py` (`_page_bounds`, tail and re-split propagation),
`app/ingestion/repository.py` (columns in the insert + `list_chunks` select),
`app/ingestion/worker.py` (reuse key includes the page bounds),
`app/generation/models.py` + `app/generation/context.py` (page fields on
`RetrievedChunk`), `apps/app/supabase/migrations/029_page_scoped_chunks.sql` (new),
and the three test files named above.
