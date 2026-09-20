# Scoped Question Generation (#18) — Implementation Plan

**Date written:** 2026-09-11 · **Ticket:** GitHub #62 (filed + claimed 2026-09-11) · **Parent:** spec #32 · map #4 · **Branch:** `phase2/issue-62-scoped-question-generation` (cut off `phase2/issue-40-41` at `237faf8`)
**Plan status:** ✅ P1–P6 implemented and verified (P1–P5 2026-09-11, P6 2026-09-12). Evidence measured and decisions locked with the user on 2026-09-11; the viewer revision (P6/P7) was raised 2026-09-12 from a hands-on pass. **P8 — a second revision round raised 2026-09-12 (whole-page fit, zoom in/out, text layer, drag-pan, and the removal of the extracted-content preview) — is planned and not started**; P7 and the P5/P6 wayfinder resolution remain.
**Trigger:** user report — "I dont like the questions being generated in the assessment"; 25/25 generated questions asked about the exam instead of the material's content.

> Runbook convention inherited from the #38/#39/#40/#41 plans: implement one phase per session, statuses updated in the same commit as the work, STOP on any reality-mismatch.

## TL;DR

The learner picks what they are assessed on — a chapter from the material's own contents page, or a page range seen in a PDF viewer — and generation grounds in exactly those chunks. Three things are missing today and each is fixed in one place:

1. **The steer is the material title.** `generation/context.py:30` builds `steer = title + skill tags`, and `prompts.py:145/:200` reuse that same string as the prompt's "Learner need (topic steer)"; `context.py:44` also sends it as the BM25 `query_text`. The literal title matches the cover, the contents page and the index, so retrieval returns front matter and the model can only author exam-format questions. Measured: 5/5 retrieved chunks were front or back matter.
2. **Pages are discarded at extraction.** `extractors.py:104-117` joins all 572 PDF pages into one string, `chunking.py` never sees a page, `content_chunks` has no page column, and `match_content_chunks` cannot filter by one. Nothing downstream can scope to a section, even in principle.
3. **There is no outline and no picker.** The only steer surface is a free-text "Skill tags" box (`AssessmentConfig.tsx:194-226`) that is appended after the title and therefore drowned.

The fix is a page-provenance pass through ingestion, a contents-page outline per material, a `recipe.scope` page range, and a pdf.js viewer so the learner can read the page numbers they are choosing.

## Acceptance criteria → where they are met

| AC | Meaning | Met by |
|---|---|---|
| AC1 | Generation grounds in the chosen chapter/page range; exam meta cannot be asked even without a scope | D-01 + D-02 + P1 (prompt blocklist, label steer) + P2 (page filter) + P4 (scope contract) |
| AC2 | Chunks carry page provenance and the RPC can filter on a range | D-03 + P2 (models/extractor/chunker/column/RPC) |
| AC3 | The outline is derived at ingestion and matches the document's contents page | D-04 + P3 (`outline.py`, `materials.outline`) |
| AC4 | The learner picks a chapter or page range and can see the page numbers | D-05 + P4 (picker) + P5 (viewer) |
| AC5 | Every citation of a scoped generation falls inside the scope | D-06 + P4 live gate (citation chunk pages checked against the range) |
| AC6 | No backfill migration for existing materials | D-07 + P3 (re-ingest; embeddings are local and free) |

## Context — live stack facts (measured 2026-09-11, trust over older notes)

Evidence file: `research/2026-09-11-evidence.md` (raw numbers behind every claim below).

### The defect

- 25 questions exist in the dev project, all generated from the one ready material (`ACCA APM Study Text`, 572 pages, 754 chunks). **25/25 ask about the exam or the document** ("In the ACCA APM exam, what is the total duration of the computer-based examination?", "Describe the structure of the ACCA APM examination...", the user's example "Explain how the APM syllabus is structured... describe the format of Section A"). 16 written / 9 objective, 22 distinct skill-tag sets — so typing tags does not control the outcome.
- Replaying the exact steer that produced the user's example (`ACCA APM Study Text, knowledge, comprehension`) through the real path (sidecar embed + `match_content_chunks`, top_k 5) returns ordinals **0, 753, 67, 24, 30**: cover page, index, a chapter-1 boundary, "The examination / Approach to examining the syllabus", "Study skills and revision guidance". 5/5 front or back matter, while only 64/754 chunks (8.5%) are exam-meta.
- The title is the cause, not the corpus: with the title removed, `gap analysis` returns ordinals 114/115 (the F0/F1/F2 planning-gap working) and 96/97; `decision-making techniques` returns 131/132 (maximax decision rules) and 729/730.
- Default tag `["core"]` (`routers/assessments.py:29`) does not help: `ACCA APM Study Text, core` returns the same front matter, and `core` alone returns fragments ("necessary.", "369").
- Nothing in either prompt forbids exam-meta questions, and "grounded STRICTLY in the provided source chunks" is satisfied by front matter — the model is behaving correctly on the context it is given.

### Page forensics (the numbers the design rests on)

- **0 PDF bookmarks** (`PdfReader.outline` empty, cross-checked with pypdf): the outline cannot come from document metadata; it must be read off the printed contents page.
- The printed contents page is extractable text (**pdf page 6**) and machine-parseable: 16 chapters + Index with page numbers, exact match to `CHAPTER n <title> <printed page>`.
- Printed → PDF page offset is **-33**, derived by mode from running headers (266 of 320 header-bearing pages agree). 31 pages carry `P.N` front-matter markers; 320 carry `KAPLAN PUBLISHING <n>` body headers; 223 carry neither. The offset is per-document and must never be hardcoded.
- Chapter openers sit ~2 pages after the contents-derived page (the opener page carries no printed number). Acceptable for scoping a 40-page chapter; not for exactness.
- **Page → chunk mapping is fully recoverable (754/754)** by replaying the pipeline's own concatenation (join pages with `\n\n`, `clean_text`, match each chunk's opening text). Kept as a verification tool, not as the mechanism: P3 re-ingests instead.
- Chunk density is comfortable for scoping: 58 chunks in PDF pages 1-40, 22 in 45-60, 55 in 100-140.
- Outline parser prototype (`scripts/pdf_outline.py`, deterministic, no model call): **APM 16 entries** (exact match to the printed contents, 1.4 s for 572 pages), **SICP 91**, **CSAPP 128**, **DDIA 188** — four publishers, four TOC layouts. The DeepSeek fallback on the same APM PDF returned 16/16 correct chapters in 16.2 s.

### Boundaries that shaped the design

- The raw PDF is already in private storage (`material-raw/<uid>/<materialId>/<file>`, owner-read RLS from migration 005), so the viewer needs a signed URL and no new storage work.
- `assessments.recipe` is jsonb and the read route already echoes it (`routers/assessments.py:149-151`, the #41 P5 fix), so a scope stored in the recipe round-trips through retry and restore with **no new plumbing**.
- `AssessmentRecipe` is `additionalProperties: false` (`openapi.yaml:135`), so `scope` must be added to the contract, not smuggled through.
- `questionCount` is pinned to 1 in three places (`routers/assessments.py:44`, one message = one question in `generation/worker.py:1-9`, and the single-row accept RPC in `migrations/028:44`), which is why multi-question is out of scope.
- `worker.py:391-397` **reuses existing chunk rows when the re-extracted text is byte-identical**, so adding page columns requires deleting the material's chunk rows and re-ingesting — a plain retry would leave the new columns NULL.
- Map #4's #13 decision already specifies "similarity-retrieval reserved for *targeted* 'about topic X' slots" and full-text-in-context when it fits. A page/section scope **is** that targeted slot: this ticket implements the decided half that never shipped.

## Decisions log

### D-01: The steer is the chosen section label, never the material title
**Decision:** `build_context` stops prefixing the title. The steer becomes the picked section label when a scope exists (e.g. `Chapter 5 Budgeting and control`) and is empty otherwise; the same string feeds the embedding (`context.py:31`), the prompt's topic steer (`prompts.py:145/:200`), and the hybrid `query_text` (`context.py:44`). The material title stays available to the prompt as document context, clearly separate from the topic.
**Rationale:** the title is what retrieves the cover/contents/index. Measured: dropping it lands the same topic in the technical chapters. This is also the user's stated intent — "instead of asking from the contents of the material, it's asking something else".

### D-02: Both prompts carry an explicit meta blocklist
**Decision:** `SYSTEM_TEMPLATE` and `WRITTEN_SYSTEM_TEMPLATE` require the question to test a concept or technique from the chunks (define, explain why, compare, apply to a scenario, compute) and name the prohibition: no questions about the examination, the syllabus, marks, duration, section structure, study or revision guidance, chapter/contents structure, or the study text itself.
**Rationale:** a scope alone is not sufficient — a scope that happens to cover front matter (or a material with no outline) must still not produce meta questions. 25/25 observed questions were meta, and nothing in either prompt forbids it.

### D-03: Page provenance rides ingestion (segment → chunk → column → RPC)
**Decision:** `TextSegment.page` and `ContentChunk.page_start/page_end`; `PypdfTextReader` returns per-page text and the `file` branch builds page-tagged segments; the chunker propagates the page of its first and last part (a chunk may straddle a page boundary, so a single `page` column would be wrong); `content_chunks` gains `page_start`/`page_end` INT NULL; `match_content_chunks` gains nullable page bounds applied inside both the dense and lexical CTEs. The extracted text must stay **byte-identical** so existing embeddings remain valid; only the metadata changes.
**Rationale:** nothing downstream can filter by page if the boundary is destroyed at extraction. Two columns rather than one because the 30-token overlap and page-length variance both straddle boundaries (`chunking.py:58-68`, `127-130`).

### D-04: The outline is parsed deterministically at ingestion; the LLM only judges
**Decision:** new `app/ingestion/outline.py`, run inside stage-1 extraction (no new queue stage). Cascade: (1) `getOutline()` bookmarks — free, 0 hit on this corpus; (2) deterministic contents-page parse, requiring ≥ 3 entries, with the page offset derived from running headers; (3) one DeepSeek call over front-page excerpts, validating its answer against `page_count`. Result persisted to `materials.outline` (jsonb) with `page_count` and `page_offset`. The model never sees the whole document and never produces the page→chunk mapping.
**Rationale:** the deterministic parse matched the printed contents page exactly on the APM corpus and works on four publishers' layouts in 1.4 s with no provider spend; the LLM fallback returned 16/16 correct entries where it was exercised, so it is a real fallback rather than a degraded one. Judge-only keeps the common path free, fast and uninventable.

### D-05: `recipe.scope` is one shape for both levels
**Decision:** `AssessmentRecipe.scope = { pageStart, pageEnd, sectionLabel? }` in the contract, validated against `materials.page_count` (reject out of range, `start > end`). A chapter pick resolves to the outline row's page start and the next row's start − 1; a typed range is used as given. Stored in the existing `assessments.recipe` jsonb and echoed by the read route, so retry and restore need no new plumbing. Config UI: chapter chips plus a two-number range, with the viewer's current page as a convenience.
**Rationale:** generation branches on nothing — both levels reach the worker as one page range. `additionalProperties: false` forces the contract amendment, and the recipe echo means no new persistence work at all.

### D-06: A range that is too thin widens and warns; it never silently grounds on 2 chunks
**Decision:** when a scope returns fewer chunks than `CONTEXT_TOP_K`, the range widens (nearest neighbouring pages) and the assessment carries a warning; the request is rejected only when the scope matches zero chunks.
**Rationale:** a 3-page scope can starve retrieval into a question grounded on almost nothing, and a silent thin context is exactly how the original defect hid.

### D-07: Existing materials re-ingest; no backfill script
**Decision:** page columns land by deleting a material's chunk rows and re-ingesting through the existing `retry_material_ingestion` RPC. No backfill migration and no forced re-chunk path in the worker.
**Rationale:** embeddings run on the local ROCm sidecar and are free, and the delete is what defeats the byte-identical row-reuse shortcut at `worker.py:391-397`. The measured backfill (754/754 locatable) stays as a verification probe, not a mechanism.

### D-08: An empty steer is refused, never embedded (added 2026-09-11 during P1)
**Decision:** `build_context` raises `validation_failed` (non-retryable) when the steer is empty, and the generation worker fails the assessment on any non-retryable context error instead of leaving it `generating`. The steer for the P1 bridge is the learner's tags (`["Chapter 5 Budgeting and control"]` today, `scope.sectionLabel` from P4).
**Rationale:** D-01's "empty otherwise" was written without measuring it: an empty-string query embeds to a degenerate vector and the live RPC returned fragments (ordinals 393 `'likes'.`, 259 `produced.`, 90 `GU.`, 532 `369`, 344 `necessary.`). Grounding a question on that is worse than refusing, and a silent thin context is exactly how this defect hid. The proper unscoped query ("no query -> an evenly spread sample inside the page range") needs the RPC's nullable page bounds, so it belongs to P2/P4 and is required before a page-only scope can ship.

## Files-touched index

| File | Change |
|---|---|
| `services/intelligence/app/generation/context.py` | P1/P2 — steer from the label, optional page bounds into the RPC |
| `services/intelligence/app/generation/prompts.py` | P1 — meta blocklist in both system prompts; steer passed separately from the title |
| `services/intelligence/app/generation/models.py` | P2 — `GenerationBlueprint.scope`; page fields on `RetrievedChunk` |
| `services/intelligence/app/generation/worker.py` | P2/P4 — scope → context builder; telemetry records the scope |
| `services/intelligence/app/ingestion/models.py` | P2 — `TextSegment.page`, `ContentChunk.page_start/page_end` |
| `services/intelligence/app/ingestion/extractors.py` | P2 — per-page PDF extraction, page-tagged segments |
| `services/intelligence/app/ingestion/chunking.py` | P2 — page propagation through segments and chunks |
| `services/intelligence/app/ingestion/worker.py` | P2/P3 — persist page columns; compute the outline in stage 1 |
| `services/intelligence/app/ingestion/outline.py` (new) | P3 — contents-page parse, offset derivation, LLM fallback |
| `services/intelligence/app/ingestion/repository.py` | P2/P3 — chunk page columns, material outline columns |
| `apps/app/supabase/migrations/029_page_scoped_chunks.sql` (new) | P2 — chunk page columns, RPC page bounds |
| `apps/app/supabase/migrations/030_material_outline.sql` (new) | P3 — `materials.outline`/`page_count`/`page_offset` + the server-owned-column guard extended |
| `services/intelligence/contracts/phase2/openapi.yaml` | P4 — `AssessmentRecipe.scope` (load-bearing: `additionalProperties: false`). Optional: sync the `Material` schema with `outline`/`pageCount` for documentation honesty — the client reads materials straight from the DB, so this is not on the feature path. |
| `services/intelligence/app/routers/assessments.py` | P4 — scope validation against `page_count` |
| `services/intelligence/contracts/phase2/fixtures/` + `tests/` | P4 — scoped recipe fixture + contract assertions |
| `apps/app/src/assessments/types.ts` | P4 — `AssessmentScope` on the recipe, outline types |
| `apps/app/src/pages/assessments/AssessmentConfig.tsx` | P4 — scope picker replaces the free-text tag box |
| `apps/app/src/materials/materialClient.ts` | P4/P5 — `getMaterialFileUrl` signed URL (`MaterialStorageLike.createSignedUrl`) |
| `apps/app/src/materials/PdfViewer.tsx` (new) | P5 — pdf.js canvas viewer; P6 — one windowed vertical scroll of page slots, ResizeObserver width, Fit + zoom, jump-only controls |
| `apps/app/src/materials/pdfView.ts` (new) | P6 — the viewer's geometry as pure functions: fit/zoom scale, raster cap, window bounds, topmost page |
| `apps/app/src/materials/pdfView.test.ts` (new) | P6 — the 18 unit cases that pin the geometry (written before the module) |
| `apps/app/src/App.tsx` | P5 — `/materials/:materialId/view` route, lazily imported |
| `apps/app/src/materials/testing/fakeMaterialClient.ts` | P5 — `getMaterialFileUrl` on the double |
| `apps/app/src/pages/materials/MaterialDetail.tsx` | P5 — "Open in viewer" action for PDF materials |
| `apps/app/package.json` | P5 — `pdfjs-dist` |
| `services/intelligence/scripts/pdf_outline.py` | P3 — prototype; its `--self-check` becomes the unit-test seed |
| `services/intelligence/scripts/diagnose_generation_context.py` | P1 — the retrieval-drift probe that found this defect; keep as the regression tool |

## Phases

### Phase 1 — Kill the meta drift (prompt + steer). No DB, no contract, no UI. `✅ Done 2026-09-11`
1. `context.py`: steer = section label (or empty); drop the title prefix. Keep the title as document context in the prompt.
2. `prompts.py`: add the meta blocklist to `SYSTEM_TEMPLATE` and `WRITTEN_SYSTEM_TEMPLATE`; pass the title separately from the topic steer.
3. `routers/assessments.py`: remove the `["core"]` default tag so an unscoped request does not inject a meaningless term.
**Verification:** update `test_generation_prompts.py:86-105/:163-193` and `test_generation_context.py:40-45`; add an assertion that the blocklist text is present in both prompts; live probe replays a chapter steer through `scripts/diagnose_generation_context.py` and confirms the retrieved ordinals are technical chapters, then one real generation is eyeballed for content (not exam) framing.

**Notes (filled in during implementation):**

- `context.py`: `build_context(material_id, skill_tags, supabase_url, service_key, client)` — the `title` parameter is gone entirely, so the title is unreachable from the retrieval path; the steer is the joined skill tags.
- **The empty steer cannot be embedded (new finding, recorded as D-08).** D-01's "or empty" is not passable into retrieval: `""` embeds to a degenerate vector and the live RPC answered with fragments (ordinals 393 `'likes'.`, 259 `produced.`, 90 `GU.`, 532 `369`, 344 `necessary.`). P1 therefore refuses an empty steer (`validation_failed`, non-retryable, nothing embedded) and the worker fails the assessment on a non-retryable context error instead of leaving it `generating` with a warning the learner can only retry into the same failure.
- No qualified query for a page-only scope exists yet: until P2/P4 give the RPC an "unscoped query -> spread inside the range" path, a scoped request carries its label in `skillTags` (e.g. `["Chapter 5 Budgeting and control"]`); P4 hands it over as `scope.sectionLabel` and both converge on one steer string.
- `prompts.py`: one shared `META_BLOCKLIST` constant used verbatim by both system templates (D-02 asks for the same text in both); both user templates take `{title_line}` (document context) separately from `{steer}`; `_topic_steer` / `_title_line` are shared by the objective and written builders.
- `routers/assessments.py`: `DEFAULT_SKILL_TAGS` deleted; `skillTags` stays optional exactly as the contract has it, an absent key is not filled, and a present-but-malformed list is still rejected.
- **Verification (evidence: `research/2026-09-11-p1-live-verification.md`).** Probe: `ACCA APM Study Text, budgeting` -> 753/0/67/49/24 (5/5 front matter); `Chapter 5 Budgeting and control` -> 203/271/204/269/202 (5/5 Chapter 5 body, printed pages 124-170). Real model A/B through the fixed code: the pre-fix steer still returns a content question only because the blocklist forbids the exam question (its grounding is an index line), the P1 steer returns a body-grounded question. Authenticated API run: password grant -> `POST /v1/assessments/generate` with the chapter steer -> `202` -> `ready`, question about ZBB citing the Chapter 5 chunk at ordinal 203. Focused suites 139 passed; whole service 509 passed / 7 failed with the identical 7 failing on the untouched base.
- **The credential file wraps its values in backticks** (`` `user@host` ``): a password grant that keeps them answers `invalid_credentials` for an account that is perfectly valid. Strip backticks (and quotes) before the grant.
- Wart to close in P4 (P1 is "no UI"): `AssessmentConfig.tsx:135` still sends `skillTags: ['core']` when the tag box is empty, so an untagged browser request still steers on a meaningless term. The tag box and that default both go in P4.
- Not run: the browser click-through — P1 changed no UI, so the authenticated API run (same request the browser sends) is the real path; a browser pass would exercise pre-P4 UI.

### Phase 2 — Page provenance through ingestion + the RPC `✅ Done 2026-09-11`
1. `models.py`: `TextSegment.page`, `ContentChunk.page_start/page_end`.
2. `extractors.py`: `PypdfTextReader` returns per-page text; the `file` branch builds page-tagged segments. **The joined text must remain byte-identical** (D-03) or every existing embedding is invalidated.
3. `chunking.py`: propagate pages; a boundary-straddling chunk carries `page_start != page_end`.
4. `worker.py` + `repository.py`: chunk rows carry the columns.
5. Migration 029: `content_chunks.page_start/page_end INT NULL`; `match_content_chunks` gains `p_page_start`/`p_page_end` applied in both CTEs. **Copy the migration-016 body verbatim as the base** — it is the latest definition, and 027 already broke this repo by re-creating a function from a stale body.
**Verification:** unit tests for page propagation, boundary straddling and filter inclusivity; migration applies clean on dev Supabase (rule 36); live re-ingest of the APM material, then assert every chunk has pages and `count(page_start between 1 and 572) == 754`.

**Entry conditions (measured offline 2026-09-11, evidence `research/2026-09-11-p2-precheck-page-identity.md`):**

- **Attach the page to the paragraph segments, not to new page-sized segments.** Chunking consumes segments; tagging today's 1257 paragraphs with their page leaves the chunk boundaries (and therefore the chunk texts and the 754 baseline) untouched. Page-level segments would re-cut every chunk.
- **Build `ExtractedContent.text` exactly as today** (one `clean_text` over the joined raw pages) and derive the page-tagged segments alongside it: per-page cleaning and joining loses 735 characters of page-boundary blank lines (963,136 vs 962,401 chars on the 572-page fixture), and that text is the uploaded `fulltext.txt`.
- **Carry the page through the chunker, including the overlap tail.** Only 3/754 chunks begin at a paragraph boundary because `flush()` composes `carry + current`; the tail is currently built as a bare `TextSegment(tail)` with no page (`chunking.py:127-130`).
- `page_start` = page of the first part, `page_end` = page of the last part; both NULL for `url`/`manual`/`youtube` materials.

**Notes (filled in during implementation):**

- `PypdfTextReader.extract` now returns `list[str]` (one entry per page) instead of the joined string; the `file` branch rebuilds `"\n\n".join(pages)` so `ExtractedContent.text` is built by the same single `clean_text` as before. `_page_segments(pages)` derives the page-tagged paragraph segments alongside it (per-page cleaning, split on `\n\n`, blanks dropped) — the same paragraph texts today's path produced, which is what keeps the chunk boundaries still.
- `chunking.py`: `_page_bounds(parts)` gives `page_start` = first part's page, `page_end` = last part's page; the overlap tail carries the previous chunk's `page_end` (without it most chunks, which open with a tail, would have no page); the recursive oversized re-split carries `segment.page`. Chunks from sources without pages keep both bounds NULL.
- `worker.py`: the resume-on-retry reuse key is now `(text, page_start, page_end)`, not `text`. Text-only reuse would re-publish rows written before the columns existed (identical text, NULL pages) and silently produce an unscopable material after any retry.
- `generation/models.py` + `generation/context.py`: `RetrievedChunk` gained `page_start`/`page_end` and the RPC rows map them, so P4's citation-in-scope check (AC5) needs no second migration. **Deferred to P4: `GenerationBlueprint.scope`** — this phase has no consumer for it, and the plan's file index lists it here only because the two live in the same file.
- `to_schema_dict` deliberately untouched: pages are retrieval metadata, not part of the visible chunk contract (`content-chunk.schema.json` unchanged, its test still passes).
- Migration 029: two chunk columns; the 016 hybrid body copied verbatim with two page params (`DEFAULT NULL`) and the range predicate added to **both** CTEs; `page_start`/`page_end` added to `RETURNS TABLE`. The 4-arg overload is `DROP`ped first (CREATE OR REPLACE cannot change params or the return type) and the 6-arg signature's defaults keep every existing 4-named-argument caller resolving to it unambiguously — verified live (§3A of the evidence file replays P1's chapter steer to the same ordinals). Range matching is **overlap**, not containment: a single-page range must keep the chunk that carries the page boundary's text.
- **Verification (evidence: `research/2026-09-11-p2-live-verification.md`).** Offline on the real 572-page fixture: paragraph stream 1257 identical, chunks 754 with identical texts, 754/754 paged, 372 straddling, all inside 1..572. Live: 029 pushed; APM material re-ingested from scratch (rows deleted per D-07, detached worker restarted per rule 53, sidecar up) -> `total=754 paged=754 min_p=1 max_p=572 straddling=372 out_of_range=0 embedded=754`. RPC: unscoped chapter steer -> ordinals 203/271/204/269/202 (P1's measured result), scoped 124..170 -> 5 hits all in range with page 203 excluded, single-page ranges keep straddling chunks, pageless material -> 0 hits. Focused suites 126 passed; whole service 515 passed / 7 failed with the identical 7 failing on the untouched base.

### Phase 3 — Outline at ingestion `✅ Done 2026-09-11`
1. `app/ingestion/outline.py` from `scripts/pdf_outline.py` (deterministic core unchanged; the LLM path wired to the existing OpenRouter adapter and schema).
2. ~~Migration 029 (same file)~~ → **its own migration 030**: 029 was pushed to the dev project during P2 (2026-09-11), and an applied migration is never re-run, so the `materials.outline`/`page_count`/`page_offset` columns must ship in a new file. `materials.outline JSONB`, `materials.page_count INT`, `materials.page_offset INT`.
3. Stage-1 extraction computes and persists the outline. `url`/`manual`/`youtube` materials take the LLM-or-empty path (no page scope offered).
4. No client plumbing: `materialClient` reads `materials` with `select('*')` (`materialClient.ts:193,216`), so the outline and `page_count` arrive on the material record the config page already fetches. No new route, no new fetch.
**Verification:** the `--self-check` layouts become unit tests (wrapped title, dot leaders, single-space page, permissive gating); live: the APM outline equals the printed contents page (16 chapters, offset -33), and re-running on SICP/CSAPP/DDIA stays deterministic.

**Notes (filled in during implementation):**

- `outline.py` owns `build_outline(pages, *, bookmarks=(), page_count=None, llm=None) -> Outline | None` where `Outline = (entries, page_count, page_offset, source)`. The deterministic core moved verbatim; `scripts/pdf_outline.py` is now a thin CLI over the module, so there is one implementation. Its `--self-check` assertions became `tests/test_outline.py` (the flag is gone).
- **The printed→PDF offset is the load-bearing measurement.** Measured on the real 572-page fixture: the strict rule (standalone number, not part of `3.2`/`P.5`/`20X9`, on one of the first two lines, ≤6 words, within 1..page_count, and a page votes only when its candidates agree on one delta) gives **282 of 284 voting pages on -33 = 99.3%**; reading every head/footer number gives only 64.8%, too close to a threshold to trust. Tail lines were dropped because body prose carries numbers and cost 34 votes. Floors: `OFFSET_MIN_PAGES = 20`, `OFFSET_MIN_AGREEMENT = 0.6`.
- **Entries are stored as PDF page numbers**, not the numbers printed on the page: `page = printed - page_offset`. Chunk pages and the viewer are PDF-page numbered, so the conversion happens once, server-side; `page_offset` (-33) is persisted for provenance and printed-page labelling. Measured conversion: Chapter 1 printed 1 -> pdf 34, Chapter 5 123 -> 156, Chapter 16 525 -> 558.
- **No derivable offset means no outline** (`build_outline` returns None): without the conversion a chapter range would silently scope the right chapter to the wrong chunks. A typed page range still works for such a material because `page_count` is always the true PDF page count. Documented as a deliberate refusal, not a gap.
- Bookmarks are the first rung of D-04's cascade: `PypdfTextReader.bookmarks` is an *optional* reader capability (`getattr`, so a test double or another adapter without it is not an error), top-level destinations only, already in PDF pages, `page_offset` stays NULL. 0 bookmarks on this corpus, so the path is covered by a unit test rather than by the live run.
- The LLM fallback runs only when the deterministic parse yields fewer than 3 entries, and any provider failure returns None instead of failing ingestion (`_safe_fallback`) — the outline is best-effort, a readable material is still a readable material. The model's `page` is the printed number and is converted with the same measured offset. The live run never called it (source `contents`).
- `ExtractedContent` gained `pages` (raw per-page text) and `bookmarks` so stage 1 derives the outline from the parse that already happened (D-04, no second read of the PDF, no new queue stage). The outline is persisted in the same `set_material_state` call as the `chunking` transition, i.e. before any embedding work.
- Migration 030 also re-creates 008's `guard_server_owned_material_columns` with the three columns added, so a client token cannot forge a derived outline (the worker writes as service_role).
- **Verification (evidence: `research/2026-09-11-p3-live-verification.md`).** Offline on the real fixture: contents page pdf 6, 16 entries exactly matching the printed contents, offset -33 (99.3% agreement), 0.01 s on cached page texts, source `contents` (no provider call). Live: migration 030 pushed (dry-run listed exactly 030), worker restarted, APM material re-ingested -> the `chunking` transition already carries `pages=572 offset=-33 entries=16`, `ready` in ~80 s with 754 re-embeddings; the stored outline equals the offline parse entry for entry. Focused suites 123 passed; whole service 533 passed / 7 failed (the identical 7 pre-existing failures).


### Phase 4 — Scope contract + picker + scoped retrieval `✅ Done 2026-09-11`
1. `openapi.yaml`: `AssessmentRecipe.scope`; a new fixture; contract tests.
2. `routers/assessments.py`: validate the range against `materials.page_count`.
3. `worker.py` + `context.py`: the scope reaches the RPC; the blueprint carries it for telemetry.
4. `AssessmentConfig.tsx`: chapter chips from `materials.outline`, a two-number page range, an "open material" link. Remove the free-text tag box.
5. D-06's widen-and-warn behaviour.
**Verification:** contract test for the scoped recipe; route matrix for out-of-range/zero-chunk/thin-range; app tests for the picker; **live gate: pick Chapter 5, generate, and assert every citation's chunk page lies inside that chapter's range.**

**Notes (filled in during implementation):**

- **Contract.** `AssessmentRecipe.scope` plus a new `AssessmentScope` (`pageStart`/`pageEnd` required integers ≥ 1, `sectionLabel` optional and non-empty, `additionalProperties: false` on both) and the `assessment-recipe-scoped.json` fixture; 2 contract tests bring `contracts/phase2` to **22 passed**. The free-text-era request shape (no `scope`, optional `skillTags`) stays valid, so nothing breaks for an older client, and an unknown scope key is rejected rather than ignored.
- **Router.** `_validate_scope` owns the shape (integers ≥ 1, start ≤ end, non-empty label, unknown keys rejected) and `_scope_range_failure` owns the range (409 when the material has no `page_count`, or `pageEnd > page_count`); 6 new route tests. Live: `start > end` → 400, `pageEnd = 600` on a 572-page material → 409 `validation_failed`, a pageless `url` material → 409 "no page numbering to scope by".
- **Retrieval.** `build_context(material_id, skill_tags, scope, supabase_url, service_key, client)` — the steer is `scope.sectionLabel` and then the tags, and the page bounds ride into `match_content_chunks` as `p_page_start`/`p_page_end`. **The no-steer case now spreads** (`_spread_context`: id/ordinal listing → evenly spaced picks → text fetch), bounded by the scope: this is D-08's long-deferred "no query → spread inside the range" branch, and it is what makes a page-only scope render a grounded question instead of failing. `build_context` still refuses an *empty material*.
- **Worker.** The scope comes off the stored recipe into the blueprint; an empty context is a non-retryable `validation_failed`; `_widen_thin_context` implements D-06 (pad 5 pages per round, 2 rounds, `scope_widened` warning re-prepended so a repair round cannot drop it). `ContextBuilder` is now a **required 3-arg callable with no default**, so production cannot silently fall back to the wrong arity again.
- **The widen threshold is `CONTEXT_TOP_K` = 5, and it is cheaper to reach than the plan assumed.** Measured live: the 3-page range 156..158 already returns 5 chunks (overlap matching pulls in the straddling chunks) so it does **not** widen, while the single page 156..156 returns 4 and widens to 151..161 with `scope_widened`.
- **Client.** `AssessmentScope` on `AssessmentRecipe`; the chapter chip resolves to its own page and the next chapter's page − 1 (the last chapter runs to `page_count`); editing either page drops the label, because it no longer describes the range; "Whole material" clears the range. The free-text tag box and the `['core']` default are gone — the P1 wart closed.
- **No new migration.** The scope rides the existing `assessments.recipe` jsonb and the read route echoes it, so retry/restore round-trip it with no plumbing. Confirmed live: every one of the six P4 runs came back with its recipe — scope included — verbatim. This is D-05's bet paying off.
- **The e2e spec was stale, not P4-broken.** `e2e/assessment-generation-live.spec.ts` waited for `Difficulty band` and read the citation out of `.card-large`; the detail page has rendered "Difficulty 3" and a `Citations` heading (the review surface) since the #40/#41 rework, so the spec had been failing at those two assertions regardless of this phase. Fixed to the real DOM, and a scoped scenario (chapter chip → both page inputs → generate → citations) plus the mobile chip/reset assertions were added; the retry-poll loop is now one shared `waitForQuestion` helper instead of an inline copy.
- **Verification (evidence: `research/2026-09-11-p4-live-verification.md`).** Contract fixture + tests green; whole app suite 762 passed / 2 failed (the documented WSL TZ pair in `src/dev/seedTestData.test.ts`, 2/2 green under `--pool=forks`); `pnpm typecheck` + `pnpm lint` clean; service `tests/` minus the 7 known pre-existing failures = 518 passed. Live: a Chapter 5 scope (pdf 156..213) → `ready` with no warnings, every citation inside the range (ordinals 204 page (158,158) and 269 page (202,202)); the route matrix (thin range widens and warns, over-572 409, pageless 409, inverted 400); a page-only scope with no label spreads and still cites inside the range; the browser click-through at 1280 and 375.

### Phase 5 — pdf.js viewer `✅ Done 2026-09-11`
1. `pdfjs-dist` in `apps/app`; worker wired via `pdfjs-dist/build/pdf.worker.min.mjs?url` (Vite: without `workerSrc` the canvas renders blank).
2. `MaterialStorageLike` gains `createSignedUrl`; the viewer loads by signed URL so pdf.js range-fetches instead of pulling 22.9 MB.
3. `PdfViewer.tsx`: canvas render, `pagechange` → current page, `getOutline()` first then `materials.outline` for chapter jump, range selection → "Assess these pages". Route `/materials/:materialId/view` (no `/study` prefix, per rule 12).
**Verification:** live at 1280 and 375: renders, jumps to a chapter, selects a range, hands it to the config, and the resulting question's citations sit inside the range.

**Notes (filled in during implementation):**

- **Shipped as three steps plus the wiring.** `pdfjs-dist@6.3.289`; `MaterialStorageLike.createSignedUrl` and `MaterialClient.getMaterialFileUrl(material)` (path `<ownerId>/<materialId>/<source>`, 600 s TTL — no extra auth round trip, the record already carries all three parts); `PdfViewer.tsx` on `/materials/:materialId/view`, reached from a new `Open in viewer` action on the material detail page and a link in the config's scope field-group. The route is lazily imported, so pdf.js does not enter the main bundle: it emits as `PdfViewer-*.js` (488 kB) with the worker as `pdf.worker.min-*.mjs` (1.27 MB); the main chunk is unchanged.
- **`createSignedUrl` returns an absolute `signedUrl`** in storage-js 2.105 (`StorageFileApi.createSignedUrl` builds `${url}/object/sign/...` with the token), so the viewer hands it straight to pdf.js.
- **The range control is the learner's own page navigation, not a slider.** Previous/Next + a page input + a chapter `<select>` drive the page; `Set first page` / `Set last page` capture the current page, and `Assess these pages` hands off as `/materials/:id/assessments/new?from=X&to=Y`. The config seeds `pageStart`/`pageEnd` from those params and, when the material turns out to have no `page_count`, clears them — otherwise a handoff would ship an unvalidated scope past the inputs that are not rendered. A viewer range is a typed range: numbers, no `sectionLabel`.
- **The blank-canvas failure mode is covered by the spec, not by hope.** A missing `workerSrc` paints a blank canvas with only a console warning, so both live scenarios sample canvas pixels and fail if the page has no ink. Measured on page 1: 1,668,600 dark pixels; the desktop scenario also proves the chapter jump repaints (67,051 dark pixels on the Chapter 5 opener, page 156).
- **Measured cost: 22.9 MB per viewer open, 4.6-7.5 s to first paint, and the plan's range-fetch rationale does not hold.** pdf.js issues one plain GET with no `Range` header (`content-length 22919258`, no `Cache-Control`), on every open. Root cause is CORS exposure: from the browser the signed URL answers a `Range` request with 206 and 64 KiB, but `Accept-Ranges` is **not** in the exposed header set (only `cache-control`, `content-length`, `content-type`, `expires`, `last-modified` are readable), so pdf.js's `validateRangeRequestCapabilities` never enables ranges. An explicit `PDFDataRangeTransport` was implemented and measured, and it is **worse** — 123 requests, 30,807,072 bytes, 12.9 s, plus continued fetching while idle — because pdf.js walks the file backwards from the trailer and v6 does not pass `disableAutoFetch` into `PDFDataTransportStream`. Reverted and deleted rather than shipped slower; the fix belongs on the storage CORS (`Access-Control-Expose-Headers: Accept-Ranges`) or a same-origin range proxy. Full numbers and the three upgrade paths: `research/2026-09-11-p5-live-verification.md` §5.
- **Dropped the client-side `pdf.getOutline()`.** Ingestion already runs the cascade server-side (bookmarks → contents page → LLM) and owns the printed→PDF conversion; a material whose outline could not be derived also has no `page_count` (both are written together), so no page range is offered and a client-side chapter list would have nothing to hand over. Recorded as a deliberate simplification rather than a gap.
- **Verification (evidence: `research/2026-09-11-p5-live-verification.md`).** Contract: storage precheck under the service role (PDF present, 22,919,258 bytes, signed URL 200, range GET 206). Unit: `pnpm typecheck` clean, `pnpm lint` clean, `materialClient.test.ts` 30 passed (+4), `AssessmentConfig.test.tsx` 12 passed (+2), whole app suite 768 passed / 2 failed (the documented WSL TZ pair, 2/2 green under `--pool=forks`), `pnpm build` produces both apps. Live: the new `material-viewer-live.spec.ts` passes 2/2 at 1280 and 375 (`--workers=1`) — render with real ink, chapter jump to page 156, range `156–213` handed to the config, generation landing on a question with citations; the authenticated API gate for the same label-less scope returns `ready` with warnings `[]` and its citation on pages (202,202), inside the range; the P4 and material-library live specs re-run green after the `AssessmentConfig` and `MaterialDetail` changes.

## Drift reconciliation (2026-09-12, before Phase 6)

The plan above was written against `c803be5`; the branch has since moved.

- **HEAD is now `ff3ab07`** (`fix(ingestion,app): #62 - tolerate a page tree that repeats a page object`), authored 2026-09-12, **unpushed** (branch is `ahead 1` of origin). `state.md` and the STATUS row still describe `c803be5` as the tip.
- What it adds, and why the plan must respect it: a compressed-book PDF whose `/Pages /Kids` repeats a page object is legal but both engines treat it as a cycle (pypdf aborts the document, pdf.js truncates 322 pages to 10). `PypdfTextReader.normalize()` now returns a repaired PDF, `ExtractedContent.viewer_pdf` carries it, the worker uploads `material-raw/<uid>/<materialId>/view-<contentVersion>.pdf`, and `materialClient.getMaterialFileUrl` prefers that copy and falls back to the raw object.
- So the viewer no longer necessarily loads the uploaded file: **Phase 7 must serve the derived object first**, and any caching keyed on a path must key on the copy the client actually requests.
- Two measured facts from that commit feed this revision: the repaired copy is **larger** than its source (2,998,611 B → 3,420,085 B, pypdf re-serialization), and the raw response is **range-capable at the server** (`accept-ranges: bytes`, `content-length` on the 22,919,258 B corpus file) — the whole Phase 7 problem is header visibility through Storage CORS, not server support.
- The #62 acceptance criteria (AC1–AC6) remain met and do not change; the revision below carries its own criteria (R1–R4) in `VERIFICATION.md`.

### Phase 6 — Viewer revision: fit, vertical scroll, mobile zoom `✅ Done 2026-09-12`

Raised from a hands-on pass at 375 px (2026-09-12): the page rendered at roughly 1.8x and was cut off at the right edge, "not readable in mobile screen format", and Prev/Next paging is the wrong interaction for reading a document.

**Recorded root cause, not a guess.** `renderPage` measured `frameRef.current.clientWidth` once per render and never re-measured (`PdfViewer.tsx:106-113` in the pre-P6 file — the code moved in P6), and `.pdf-canvas` carried no `max-width` (`materials.css:711-715`). Any wider measure — a desktop-ish layout at load, a resize, an orientation change — leaves a bitmap wider than the frame forever, which is the reported crop. The same single source of width in step 2 is the fix for the class, not for the instance.

1. One scroll container: `.pdf-frame` becomes `overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; height: calc(100dvh - 15rem); min-height: 22rem`; `.pdf-canvas { max-width: 100% }`.
2. One width source: a `ResizeObserver` on the frame feeds a `containerWidth` state; every mounted page renders at `scale = containerWidth * zoom / base.width * devicePixelRatio`.
3. Page slots + windowing: a `.pdf-page` slot per page with an `aspect-ratio` placeholder (page 1's viewport) so scroll height is stable before ink; an `IntersectionObserver` renders a slot within one viewport of the visible area and leaves it mounted. `ponytail:` canvases are never unmounted — the upgrade path, when a phone proves it needs it, is releasing bitmaps for slots more than two viewports away.
4. Zoom: `Fit` (default) plus a stepper (`1.25 / 1.5 / 2 / 3`), which **re-renders the bitmap** rather than CSS-stretching it, so zoomed text is sharp. Fit-to-width of an A4 page at 375 px is scale ≈ 0.59, which is why the control exists at all.
5. Prev/Next are deleted. The PAGE input and the CHAPTER `<select>` become jump controls (`scrollIntoView` on the target slot), and the current page is the topmost visible slot — which is what the PAGE field shows and what `Set first page` / `Set last page` capture. The handoff to the config is unchanged (`?from=&to=`, typed range, no `sectionLabel`).
6. Spec: `e2e/material-viewer-live.spec.ts` gains a no-horizontal-overflow assertion (`frame.scrollWidth === frame.clientWidth`), ink sampling on the visible canvas rather than `querySelector` on the first one, a scroll-reveals-next-slot step, and — the assertion that fails on today's code — resize 1280 → 375 then `canvas.style.width <= frame.clientWidth`.

**Verification:** `pnpm typecheck` + `pnpm lint` clean; app suite green apart from the two documented WSL TZ flakes (`--pool=forks` confirms); the live spec 2/2 at 1280 and 375 with `--workers=1`; then the user's own phone pass.

**Notes (filled in during implementation):**

- **The geometry moved to `src/materials/pdfView.ts`, pure and unit-tested first.** `fitScale`, `displayScale`, `rasterScale`, `clampPage`, `pagesInWindow`, `pageAtTop` — written as failing tests (`pdfView.test.ts`, 18 cases) before the module existed, because the viewer is lazily imported and pdf.js stays out of the jsdom graph, so an untested viewer would have been an untested layout claim. The component keeps only the DOM wiring.
- **Windowing is computed from slot rects, not an `IntersectionObserver`** (a deliberate deviation from R-D-01, recorded in `research/2026-09-12-p6-live-verification.md` §2): one `requestAnimationFrame`-throttled scroll handler reads the slot rects, `pagesInWindow` returns the slots on screen plus one frame-height of margin, and `pageAtTop` names the page at the frame's top edge — which is what the PAGE field shows and what `Set first/last page` capture. Same observable behaviour, and the rule is a pure function rather than an observer callback.
- **Renders are serialised through one promise chain and never cancelled.** The first cut cancelled in-flight `RenderTask`s in the effect cleanup and skipped any page whose `canvas.width` already matched; a render cancelled after the width was set never painted again, so page 2 stayed blank forever (found by the scroll step, not by inspection). A superseded run now finishes the page it is on and stops, and the "already drawn" marker is written only when a render resolves.
- **The `max-width: 100%` guard is scoped to the fitted state.** `.pdf-fit` (zoom === 1) carries it on the slot and the canvas, so a stale measure cannot overflow during the frame between a resize and the re-render; a zoom level is allowed to be wider than the frame and the frame scrolls sideways, which is the whole point of zooming on a phone.
- **`MAX_RASTER_SCALE = 2.5` caps the bitmap** (a `ponytail:` ceiling in the code, with its upgrade path): bitmap px per PDF unit stops there, so a 3x zoom on a wide desktop scales up a 2.5x raster instead of allocating a ~90 MB canvas per page. At 1280 Fit and 375 1.5x the raster is exactly the CSS size, which is the case the criteria care about.
- **The P5 spec's "desktop" scenario never ran at 1280** — a file-level `test.use({ viewport: 375 })` applies to every test in the file, so both scenarios ran at 375x812. The viewport is now scoped to the mobile `describe`, and the desktop scenario asserts a fact that is only true at 1280 (`[data-page="2"] .pdf-canvas` count 0). The "2/2 at 1280 and 375" line in P5's transcript is therefore 375 twice; P6 restores the desktop arm. Found by the windowing assertion failing, not by reading the config.
- **The scroll assertion samples the whole bitmap, the "in front of me" assertions sample the visible band.** Page 2 of the corpus is a near-empty divider (33,886 dark pixels in the bitmap, ~76 in the visible band), so "the next page's ink appears by scrolling" is asserted as "the revealed slot was rasterised" while pages 1 and 156 assert ink in the exact visible band.
- **Measured live** (evidence: `research/2026-09-12-p6-live-verification.md`): 1280x720 Fit — canvas 1080 px in a 1080 px frame, bitmap 1080 px, `slots 572, rendered 1`; 375x812 Fit — canvas 351 px in a 351 px frame, median text line 8 px; 1.5x — canvas and bitmap 526 px, median text line 12 px; a 1280 → 375 viewport change re-fits the canvas to 351 px in the same run. Focused unit tests 18 passed; whole app suite 787 passed / 2 failed (the documented WSL TZ pair in `src/dev/seedTestData.test.ts`, green under `--pool=forks`); `pnpm typecheck` + `pnpm lint` clean; `pnpm build` emits both apps; the live spec 2/2 with `--workers=1` (desktop 27.1 s at 1280x720, mobile 11.4 s at 375x812); the neighbouring live specs (`assessment-generation-live`, `material-library-live`) re-run green 5/5.
- **Not done in P6:** the user's own phone pass (the point of R3) and P7's streaming; the throwaway `e2e/tmp-viewer-timings.spec.ts` baseline probe stays untracked for P7 to re-run and delete.

### Phase 6 fix — image decoders (JBIG2 wasm), found in the hands-on pass `✅ Done 2026-09-12`

Reported by the user right after the P6 pass, about **their own material**, not the corpus: "Where are the images in the pdf, not a single image is seen in the doc", with a console full of `Warning: Unable to decode image "img_p104_1": "Jbig2Error: JBig2 failed to initialize"` and `Dependent image isn't ready yet 3` for pages ~96-206.

- **The material is `grokking-algorithms-2nd-edition-2nd_compress`** (315 pages, ready), served as its repaired `view-2e1fbb5e-….pdf` copy (3,420,085 B). Its pages carry **587 JBIG2 images across 260 pages** (pypdf; the original upload has 590 raw `JBIG2Decode` names, so the repair is not the source). Page 104 has exactly three (`/Im0 /Im1 /Im2`), which is the `img_p104_1..3` in the log. **The corpus has none** (432 DCTDecode + 943 FlateDecode), which is why the P6 live spec never saw this.
- **Root cause:** pdf.js decodes JBIG2/CCITT images with a wasm module it fetches at runtime from `wasmUrl`. Nothing set `wasmUrl`, so the worker resolved the default relative `"wasm"` against the page, got nothing, and skipped every JBIG2 image with a console warning. Text and the other image types still painted, so nothing else noticed.
- **Fix:** `apps/app/scripts/sync-pdfjs-wasm.mjs` copies `pdfjs-dist/wasm/` into `apps/app/public/pdfjs-wasm/` (gitignored) and the app's `dev`/`build` scripts run it, so `/study/pdfjs-wasm/<file>` exists in dev and in `dist/`; `PdfViewer` passes `wasmUrl: ${import.meta.env.BASE_URL}pdfjs-wasm/`. No nginx or contract change: same origin, same base.
- **Guard:** `e2e/material-viewer-live.spec.ts` now fails on any `Unable to decode image` console warning — ink sampling cannot see a page that lost only its artwork, which is exactly how this hid.

**Verification:** on the user's material the worker fetches `/study/pdfjs-wasm/jbig2.wasm` (200) and `/study/pdfjs-wasm/openjpeg.wasm` (200); decode warnings on pages 104/96/35/26 = **0** (the same pages logged one per image before the fix, per the user's console); the rendered pages show the hand-drawn hash-function and array-partitioning diagrams intact, checked by screenshot. The corpus path is unaffected (it never requests the wasm). `pnpm --filter app build` emits `dist/pdfjs-wasm/`; typecheck + lint clean; the viewer spec 2/2 with `--workers=1`. Full numbers: `research/2026-09-12-p6-live-verification.md` §7.

### Phase 7 — Streaming: same-origin ranges, prefetch, session cache `✅ Done 2026-09-20 (mechanism corrected by measurement)`

**Baseline measured 2026-09-12** with a throwaway probe (`e2e/tmp-viewer-timings.spec.ts`, currently untracked, CDP Network timeline on the live stack, desktop 1280):

| Phase | ms |
|---|---|
| click → route painted | 26 |
| material record in hand | 1,884 |
| signed-URL POST (`storage/v1/object/sign`) | 278 |
| PDF body GET — 22,922,615 B, one plain GET | 4,283 |
| pdf.js parse + `numPages` | 6,749 |
| first ink | 6,761 |

63% of the wait is one un-ranged download; 28% is Supabase REST latency before it can even start. `accept-ranges: bytes` and `content-length` are present on the response, so this is CORS header visibility; and the source confirms the recorded dead end (`pdf.mjs:15534-15539` builds `PDFDataTransportStream` with only `pdfDataRangeTransport, disableRange, disableStream`, so `disableAutoFetch` never reaches it).

1. Same-origin route `/material-file/<ownerId>/<materialId>/<view-…|source>`:
   - `docker/nginx.conf` (already fronts both services): `location /material-file/` → `proxy_pass https://<proj>.supabase.co/storage/v1/object/authenticated/` with `proxy_set_header Authorization $http_authorization`, `proxy_set_header Range $http_range`, `proxy_set_header If-Range $http_if_range`, `proxy_http_version 1.1`, `proxy_buffering off`, `add_header Accept-Ranges bytes always`, and `proxy_hide_header Cache-Control` + `add_header Cache-Control "private, max-age=600" always`. **No `proxy_cache`** (R-D-04).
   - dev parity: the same route as a `server.proxy` entry in `apps/app/vite.config.ts`, next to the existing `/supabase-fn` proxy.
2. `materialClient.getMaterialFileUrl` keeps `ff3ab07`'s preference for `view-<contentVersion>.pdf` but returns the same-origin path; the caller passes the session access token (`supabase.auth.getSession()`, the pattern `previewClient.ts:20-21` already uses) to pdf.js as `httpHeaders`, so Storage RLS keeps enforcing the uid prefix (rule 35). Keep the direct signed-URL path behind a config flag as the fallback for a deployment without the route.
3. Prefetch on intent: `pointerdown`/hover on `Open in viewer` starts the document load, and the viewer adopts the in-flight task, moving the 1.9 s of REST latency under the click.
4. Session cache: a module-level `Map<materialId, PDFDocumentLoadingTask>` (cap 2, LRU destroy); the viewer stops destroying its task on unmount (`PdfViewer.tsx:93-97`), which is what makes a repeat open ~0.1 s.
5. Re-run the probe as the before/after gate, write `research/2026-09-12-p6p7-live-verification.md`, then delete the throwaway probe in the same commit.

**Verification:** the probe's phase table before/after (expect first ink ≈ 1.0-1.5 s and 50-200 KB per additional page); the live viewer spec green with the route on and with the fallback; a repeat-open byte count from the network log proving the browser cache is used.

**Outcome (2026-09-20):** the same-origin route was built, served 206s, and was **reverted** - first ink did not move on this non-linearised corpus (6,789 ms vs 6,772 ms), range-only mode was worse (134 requests / 15.8 s), and the production deploy is Vercel static with no nginx, so the route would have broken the deployed viewer. Shipped instead: `documentCache.ts` (2-entry LRU of pdf.js loading tasks) + prefetch-on-intent on "Open in viewer". A repeat open drops from one 22.9 MB GET to 3.4 KB and paints in 897 ms. A mixed-page-size fit defect was fixed alongside (`largestPageBox`). Full numbers: `research/2026-09-20-p7-live-verification.md`.

### Phase 8 — Viewer interaction round 2, and the extracted-content removal `✅ Done 2026-09-12`

Raised by a second hands-on pass (2026-09-12): a screenshot of the material detail page ("the extracted content makes no sense … remove that section itself") and a report on the viewer ("the height feels very limited, make it the height of a A4, so that complete pdf page is visible, also make the pdf interactable, zoom in, drag the page, highlight etc."). The measurements, the two readings of "the height of an A4" and the reading of the installed pdf.js that this phase rests on are in `research/2026-09-12-p8-exploration.md`; nothing below is re-derived here.

**Answers this phase assumes** (all three in the research note §Open questions; a different answer changes 8.2-8.4 only, never the architecture): highlight = the text layer; default zoom = `Page`; the round rides #62.

**8.1 Remove the extracted-content preview** (companion change, independent of the viewer — it may land as its own commit):
delete the fetch effect (`MaterialDetail.tsx:140-161`) and the section (`:349-356`), the "Content preview unavailable" banner (`:358-365`), `previewClient.ts` + `previewClient.test.ts`, the `MaterialContentPreview` type (`types.ts:117`) and the now-dead `.material-preview-text` (`materials.css:654`); update the mock and the case in `MaterialDetail.test.tsx` (`:13-19`, `:298-306`) and `e2e/material-ingestion-live.spec.ts:128-130`. The service route `GET /v1/materials/{id}/content` **stays** (R-D-10).

**8.2 Whole page on open.** `pdfView.ts` gains a zoom *mode*: `baseScale(mode, frame, base) = min(fitWidth, fitHeight)` for `'page'`, `fitWidth` for `'width'`; `ZOOM_LEVELS` and `MAX_RASTER_SCALE` are unchanged. The frame keeps the column width as the fit reference and stays the single scroll container — the feedback loop that "let the frame hug the page" creates is recorded in the research note and must not be reintroduced. Unit tests first in `pdfView.test.ts`.

**8.3 Zoom in / out, and drag the page.** `Page` / `Width` mode buttons plus a `−` / `+` stepper over the ladder with an `x N` readout (ctrl/⌘ + wheel steps the same pure function). Pointer-drag panning of `.pdf-frame` for mouse pointers only (`touch-action` left to the browser so native touch scroll and the browser's own pinch keep working), `cursor: grab` when the page overflows and `grabbing` while dragging. Two-finger pinch is a recorded skip (our zoom re-renders the bitmap, so pinch needs two-pointer tracking and a gesture origin).

**8.4 Text layer — selection, highlight, copy.** One `pdfjs.TextLayer` per rendered slot, created in the same effect as the canvas, with `--total-scale-factor` set on the slot (nothing in the library sets it) and the library's text-layer CSS in the lazy chunk. The pointer-events split (`.pdf-text-layer { pointer-events: none }`, `span { pointer-events: auto }`) is what lets a glyph drag select and a background drag pan. Saved highlights stay out of this round (R-D-08).

**8.5 Verification.** `pdfView.test.ts` extended (mode arithmetic, stepper clamping) and written before the code; the live spec updated for the new default and extended with a selection assertion (the selection round-trips through `window.getSelection()`), a pan assertion (dragging the background moves `scrollTop`/`scrollLeft` at a zoom where the page overflows) and the removal assertion (no `Extracted content` heading and no `.material-preview-text` on the detail page, and no `/content` request when it opens); app suite, `pnpm typecheck`, `pnpm lint`, `pnpm build`; then a hands-on pass on the user's own material, stack left running.

**As built (2026-09-12):** 8.1 landed first as `7bd2f6d` (its own commit, -328 lines). 8.2-8.4 landed together with the live spec rewritten: `pdfView.ts` carries the fit mode and `stepZoom`; `PdfViewer.tsx` the `Page`/`Width` buttons, the `-`/`+` stepper with an `x N` readout, ctrl/cmd+wheel, the window-tracked drag pan, the Shift-anchored selection and the per-slot `TextLayer`; `materials.css` the layer block, the I-beam/grab cursors and the `.pdf-fit` cap the layer now shares with the canvas. Four defects surfaced while making the assertions real (a later page's layer overflowing its slot by 2%, a blank page after a slot left and re-entered the window, the pan losing the pointer stream to the browser's selection gesture, and Shift+drag selecting from the top of the document); all four are in the transcript with their measurements. Verified: live spec **2/2** with `--workers=1` (desktop 1280x720, mobile 375x812), the user's own hands-on pass, and the gates recorded in `plan/VERIFICATION.md`. Transcript: `research/2026-09-12-p8-live-verification.md`.

## Revision decisions (2026-09-12)
- **R-D-01:** the viewer is a continuous vertical scroll of page slots, windowed **by a rAF-throttled scroll handler over the slots' rects**, not by the `IntersectionObserver` this decision originally named (P6 deviation, `state.md` P6 decisions; same observable behaviour, unit-testable in jsdom). Prev/Next are removed; the page input and chapter select become jump controls. A typing-friendly page field is not a paging control.
- **R-D-02:** one width source (`ResizeObserver` → `containerWidth`) and a `max-width: 100%` guard on the canvas. The measure-once/no-guard pair is the recorded cause of the mobile crop.
- **R-D-03:** zoom re-renders the bitmap; it is not a CSS `zoom`/`transform` stretch, so text stays sharp at 1.25x-3x.
- **R-D-04:** the file route carries the **user's** access token to Storage's authenticated endpoint and `proxy_cache` is deliberately absent. nginx would serve a cached body without any Storage ownership check, and a uid-prefixed path is not an authorization; the cache tier is the browser's private HTTP cache (`private, max-age=600`) behind a stable URL. This replaces the earlier "disk cache in front of the bucket" sketch.
- **R-D-05:** prefetch on intent plus a session-scoped document cache; the document is not destroyed on unmount, because re-downloading and re-parsing on every open is the waste the user actually hits.
- **R-D-06:** the viewer loads the **derived** copy first when one exists (`ff3ab07`), so both the route and any future cache key must be built from the path the client requests, not from the uploaded object's name.
- **R-D-07 (P8):** zoom is a **mode plus a multiplier** — `Page` (`min(fitWidth, fitHeight)`, the whole A4 visible) and `Width` (today's fit) with the `1.25/1.5/2/3` ladder on top — because "a complete page is visible" and "the text is readable" cannot both hold in a 480 px frame at 1280x720, and the two readings of the report differ only in this choice. The frame keeps the column width as the fit input: letting it hug the page makes measure → scale → width a feedback loop.
- **R-D-08 (P8):** "highlight" is the pdf.js **text layer** — selectable, copyable, browser-painted — and persisted highlight marks are a separate ticket; nothing in the app stores an annotation today.
- **R-D-09 (P8, superseded by R-D-11 during implementation):** panning and selecting were originally meant to coexist by a pointer-events split (glyph drags select, background drags pan). That is *not* what shipped: the split left the page itself undraggable and the selection gesture cancelled the pan, so the contract became plain-drag-pans / Shift-selects (R-D-11). Pinch-to-zoom remains a recorded skip because our zoom re-renders rather than stretching CSS.
- **R-D-10 (P8):** the extracted-content preview is deleted from the **client** (screen, fetch, client module, its tests, the type, the CSS) and the service route survives — it is the only owner-scoped way to ask whether a material has text and how many chunks it produced, and removing an authenticated API is a separate call.
- **R-D-11 (P8):** the drag contract is **plain drag pans, Shift+drag selects**, and the text layer is `user-select: none` while Shift is up — the browser otherwise starts a selection gesture that cancels the pan mid-drag. The drag is tracked on `window`, not with pointer capture: a glyph-start drag leaves the frame immediately, and capture alone stopped delivering moves (18 px of 220). Shift anchoring the selection under the pointer is what stops the browser's extend gesture selecting from the top of the document.
- **R-D-12 (P8):** the default fit is a **mode** (`Page` = whole A4 visible, `Width` = fit-to-width) with the multiplier ladder on top, and the frame keeps the column width as the fit input — "frame hugs the page" would make measure → scale → width a feedback loop.
- **R-D-13 (P8):** the viewer spec ends at the **range handoff**. Generating the question there duplicated `e2e/assessment-generation-live.spec.ts` and made every viewer run depend on the queue, the service's auth config and the GPU sidecar. `E2E_APP_URL` was added so the spec can point at another port when a sibling worktree owns 5173.

## Sequencing

Phase 8 lands **before** Phase 7 (the reported interaction is what the user is looking at; P7 is latency for the same surface), then Phase 7, then the #62 wayfinder exit (push `ff3ab07` + P6 + P8 + P7, resolution comment, close #62, map #4 line, STATUS flip to Done, archive the folder). The document-processing work is a separate task (`active/document-pipeline/plan/PLAN.md`, ticket at its D0) whose serving phase consumes Phase 7.
