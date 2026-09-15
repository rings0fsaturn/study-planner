# P3 live verification — outline at ingestion (2026-09-11)

Ticket #62 · phase 3 of `plan/PLAN.md` · branch `phase2/issue-62-scoped-question-generation`.
Probes: `/tmp/p3_dump_pages.py`, `/tmp/p3_check.py` (throwaway offline analysis of the
real fixture), plus the live SQL/REST checks below. Durable checks: `tests/test_outline.py`,
`tests/test_extractors.py`, `tests/test_ingestion_worker.py`.

## 1. Deterministic parse on the real document (offline)

Fixture `e2e/pdf/sample-textbook-572page.pdf` (22,919,258 bytes = byte-for-byte the stored
copy of the ingested ACCA APM material), pages extracted once with pypdf and cached.

| Measurement | Result |
|---|---|
| Contents page found | pdf page 6, score 20 |
| Entries parsed | **16 chapters**, titles + printed page numbers exactly the printed contents |
| Printed -> PDF offset | **-33** (282 of 284 voting pages agree = 99.3%) |
| Voting pages | 284 of 572 (pages whose header numbers all agree on one delta) |
| Wall clock, end to end | 0.01 s on the cached page texts (1.4 s including pypdf extraction of 572 pages) |
| Source | `contents` — **no provider call** on the deterministic path |
| Bookmarks | 0 (`PdfReader.outline` empty, as measured in the P1 forensics) |

The offset rule: a page votes only when every standalone number on its first two lines
agrees on one delta, the number is not part of `3.2` / `P.5` / `20X9`, and it lies within
1..page_count. The naive rule (all numbers on all header/footer lines) gives the same mode
but only 64.8% agreement — too close to a threshold to trust; the strict rule gives 99.3%.

Entries are stored as **PDF page numbers** (what the viewer shows and what
`content_chunks.page_start/page_end` hold), not the book's printed numbers:

| Chapter | printed | stored pdf page |
|---|---|---|
| 1 Introduction to performance management | 1 | 34 |
| 5 Budgeting and control | 123 | 156 |
| 8 Performance reports for management | 295 | 328 |
| 16 Employability and technology skills | 525 | 558 |

When the offset cannot be measured the outline is refused outright (`build_outline` returns
None): a chapter range off by the offset would scope the right chapter to the wrong chunks.
The typed page range stays available in that case because `page_count` is always the true
PDF page count.

## 2. Migration 030

- `npx supabase db push --dry-run` listed exactly `030_material_outline.sql`; the real push
  applied it (`{"migrations":["030_material_outline.sql"]}`).
- `materials` gained `outline JSONB`, `page_count INTEGER`, `page_offset INTEGER`.
- 008's server-owned-column guard was re-created with the three columns added, so a client
  token can no longer forge a derived outline (the worker writes as service_role).

## 3. Live re-ingest (APM material `80c8b138-b544-4095-8dc0-1c390ac70da2`)

`content_chunks` rows deleted (D-07), detached ingestion worker restarted first (rule 53, it
does not hot-reload), `POST /rest/v1/rpc/retry_material_ingestion` -> 200, job
`e6be81a0-7401-4dfd-9dda-8f985125e6a5`.

State walk (`pending` -> `extracting` -> `chunking` -> `embedding` -> `ready`, ~80 s with
754 re-embeddings on the local sidecar):

```
10:47:24 chunking 0.5 chunks=754 pages=572 offset=-33 entries=16
10:48:23 ready    1.0 chunks=754 pages=572 offset=-33 entries=16
```

The outline is written in the same store call as the chunking transition, i.e. at extraction
time, and it is present before any embedding work starts.

Stored `materials.outline`:

```json
{"source": "contents", "entries": [{"title": "Chapter 1 Introduction to performance management", "page": 34}, ... 16 rows ...]}
```

Asserted against the offline parse of the same fixture: **stored == offline, 16/16 entries
identical, offset and page_count identical.** Because the source is `contents`, the DeepSeek
fallback was never called (the fallback only runs when the contents parse yields fewer than
3 entries).

## 4. Tests

- Focused: `uv run pytest tests/test_outline.py tests/test_extractors.py
  tests/test_ingestion_worker.py tests/test_repository.py tests/test_models.py`
  -> **123 passed**. New: 14 outline tests (three real contents layouts, permissive gating,
  offset derivation including "too few pages" / "no agreement" / "a conflicting header does
  not vote", bookmark preference, refused outline without an offset, LLM fallback gating and
  its failure path, implausible entries dropped), 2 extractor tests (pages/bookmarks reach
  `ExtractedContent`; a reader without the bookmark capability is not an error) and 2 worker
  tests (the outline is persisted at extraction; page-less materials leave the columns empty).
- Whole service: **533 passed / 7 failed** — the same 7 pre-existing failures as P1/P2
  (2 `tests/test_retrieval_probe.py` import errors, 5 `tests/test_v1_integration.py`
  calibration golden-fixture drifts `evening` -> `afternoon`). 515 (P2) + 18 new tests = 533.

## 5. Files touched by P3

`app/ingestion/outline.py` (new: deterministic parse, offset derivation, LLM fallback),
`app/ingestion/models.py` (`ExtractedContent.pages`/`bookmarks`),
`app/ingestion/extractors.py` (`PypdfTextReader.bookmarks`, optional-capability adapter,
pages/bookmarks onto the file branch), `app/ingestion/worker.py` (outline at stage 1),
`app/ingestion/repository.py` (three new `set_material_state` columns),
`apps/app/supabase/migrations/030_material_outline.sql` (new),
`tests/test_outline.py` (new), `tests/test_extractors.py`, `tests/test_ingestion_worker.py`,
`tests/ingestion_doubles.py`, and `scripts/pdf_outline.py` (now a thin CLI over the module;
its old `--self-check` assertions live in `tests/test_outline.py`).
