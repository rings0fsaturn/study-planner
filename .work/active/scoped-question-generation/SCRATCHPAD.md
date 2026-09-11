# Scratchpad – scoped-question-generation · session 2026-09-11
_state.md: active/scoped-question-generation/state.md · Updated: 2026-09-11T07:10_

## Now / Next
- Doing: **P2 page provenance** — code + migration 029 written; offline fixture check green (754/754 chunks identical, all pages 1..572). Live re-ingest next.
- Next: push 029 (dry-run first, rule 36), delete the APM material's chunk rows (D-07), restart the detached ingestion worker, re-ingest, then assert every chunk has pages in 1..572 and a page-bounded RPC call returns only overlapping chunks.
- Blocked: none. Sidecar started (`docker compose -f services/embedder/docker-compose.yml up -d`).

## Session log
- 06:2x RESUMED  P1 closed and pushed; scratchpad/state agree with the worktree, no disk-vs-record drift this time.
- 06:3x DECIDED `PypdfTextReader.extract` now returns `list[str]` (one entry per page) instead of the joined string: the page is only knowable at the reader, and the file branch rebuilds `"\n\n".join(pages)` so `ExtractedContent.text` stays byte-identical. Two tiny test-double edits beat a second read of a 23 MB PDF.
- 06:3x EDIT   `models.py` – `TextSegment.page`, `ContentChunk.page_start/page_end` (both NULL-able) – verified by tests. `to_schema_dict` deliberately untouched: pages are retrieval metadata, not part of the chunk contract (its schema test still passes).
- 06:4x EDIT   `extractors.py` – `_page_segments()` builds one page-tagged paragraph per blank-line block from per-page cleaning, alongside the unchanged single-clean `text` – verified.
- 06:4x EDIT   `chunking.py` – `_page_bounds()`; `flush()` stamps `page_start/page_end`, the overlap tail carries `page_end`, the recursive re-split carries `segment.page` – verified.
- 06:5x EDIT   `repository.py` + `ingestion_doubles.py` – chunk rows carry the two page columns; `list_chunks` selects them.
- 06:5x DECIDED the resume-on-retry reuse key (`worker.py:391-397`) now includes the page bounds: text-only reuse would re-publish NULL-page rows after any retry, which is the silent path to an unscopable material. Widened the comparison rather than adding a separate guard.
- 06:5x EDIT   `tests/test_extractors.py` (+2 page tests, FakePdfReader takes pages), `tests/test_chunking.py` (+4 propagation tests), `tests/test_repository.py` (page columns in the row assertion) – 126 focused tests pass.
- 06:5x EDIT   `apps/app/supabase/migrations/029_page_scoped_chunks.sql` (new) – two chunk columns; the 016 hybrid body copied verbatim; two page params (DEFAULT NULL) and two overlapped-range predicates in both CTEs; `page_start/page_end` in RETURNS TABLE. The 4-arg overload is DROPPED first (CREATE OR REPLACE cannot change params/returns) and the 6-arg signature's defaults keep every existing 4-named-arg caller resolving to it.
- 07:0x FOUND  offline fixture check (`/tmp/p2_check.py`, throwaway, on the real 572-page PDF): fulltext 963,136 chars (pre-P2 number unchanged), paragraphs 1257 both paths **identical**, chunks 754 vs 754 with **identical texts**, 754/754 carry pages inside 1..572, monotone, 372 straddle a boundary (page_start != page_end), first chunk (1,2) last (571,572). The two-column decision is now data-backed.
- 07:0x EDIT   `generation/models.py` (`RetrievedChunk.page_start/page_end`) + `generation/context.py` (maps them, `_optional_int`) – the RPC returns them so P4's citation-in-scope check (AC5) needs no second migration.
- 07:1x DECIDED `GenerationBlueprint.scope` deferred to P4, not P2 as the plan's file index says: no consumer exists until the scope contract does, and an unused field is dead code. Recorded in the P2 plan notes.
- 07:1x START sidecar up (`services/embedder/docker-compose.yml up -d`); `full-app full` does not run it and the re-embed is on the sidecar path.
