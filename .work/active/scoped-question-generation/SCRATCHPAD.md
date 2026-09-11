# Scratchpad – scoped-question-generation · session 2026-09-11
_state.md: active/scoped-question-generation/state.md · Updated: 2026-09-11T07:40_

## Now / Next
- Doing: nothing in flight — **P2 is done, verified live, committed (`2ea2d77`) and pushed.**
- Next: **P3 outline at ingestion** — `app/ingestion/outline.py` from `scripts/pdf_outline.py` (deterministic core unchanged, DeepSeek only as fallback/judge), run in stage 1, persisted on `materials` via a **new migration 030** (029 is already applied remotely and never re-runs), `--self-check` layouts become unit tests.
- Blocked: none. Left running for hands-on testing: the managed runtime (intelligence :8000 healthy, app :5173 healthy), the detached ingestion worker (new code), and the GPU sidecar on :8200.
- Session end not requested: the scratchpad is current rather than reset, so the next session can either continue here or seed from `state.md`.

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
- 07:1x START sidecar up (`services/embedder/docker-compose.yml up -d`); `/health` reports cuda_available true, RX 9070 XT, both models loaded.
- 07:2x DONE   migration 029 dry-run listed exactly 029, then the real push applied it. Live signatures: legacy 3-arg untouched + the new 6-arg returning page columns; the 4-arg overload is gone.
- 07:3x DONE   live re-ingest of the APM material: chunk rows deleted (D-07), retry RPC 200 (job 892af4f2), detached worker restarted first (rule 53) -> extracting -> embedding -> ready in ~45 s.
- 07:3x FOUND  `content_chunks` returns 0 rows to a *user* token (service-owned table, no client policy) — the watcher's chunk counters read 0 while the table was full. Verify chunk state with SQL/service role, never with the client key.
- 07:3x DONE   live SQL: `total=754 paged=754 min_p=1 max_p=572 straddling=372 out_of_range=0 embedded=754` — every chunk paged, in range, re-embedded.
- 07:3x DONE   live RPC probes: unscoped chapter steer -> ordinals 203/271/204/269/202 (P1's exact number, so the rebuilt function is a regression-free replacement); range 124..170 -> 5 hits all in range with page 203 (ordinal 271) excluded; single-page ranges keep straddling chunks (158..158 -> (157,158) and (158,159); 1..3 -> (3,4)); pageless url material scoped -> 0 hits, unscoped -> 1.
- 07:4x FOUND  the whole-service suite's 7 failures are pre-existing: checked in a clean `git worktree` at `c30cd43`, the identical 7 test ids fail (2 probe-test import errors, 5 calibration golden-fixture drifts). 515 passed = P1's 509 + the 6 new P2 tests.
- 07:4x DONE   records: PLAN Phase 2 status + notes (incl. the 029-vs-030 correction for P3), VERIFICATION AC2 note + P2 gate ticked + live-evidence line, state.md (current/Done/Files/Pitfalls/D-03/Open), STATUS row. Evidence file `research/2026-09-11-p2-live-verification.md`.
- 07:4x FOUND  a stale `.git/index.lock` (dated 06:10, no git process alive) blocked the first commit attempt; removed after checking `pgrep -af git` was empty (the same pitfall P1 recorded).
- 07:4x DONE   committed `2ea2d77` (18 files) and pushed to `phase2/issue-62-scoped-question-generation` (c30cd43..2ea2d77); `graphify update .` re-run.
