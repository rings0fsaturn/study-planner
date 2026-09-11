# Scoped Question Generation (#18) — Implementation Plan

**Date written:** 2026-09-11 · **Ticket:** GitHub #62 (filed + claimed 2026-09-11) · **Parent:** spec #32 · map #4 · **Branch:** `phase2/issue-62-scoped-question-generation` (cut off `phase2/issue-40-41` at `237faf8`)
**Plan status:** 🟡 In progress — P1 done (2026-09-11); P2…P5 defined, evidence measured, decisions locked with the user on 2026-09-11.
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
| `apps/app/supabase/migrations/029_page_scoped_chunks.sql` (new) | P2/P3 — chunk page columns, material outline columns, RPC page bounds |
| `services/intelligence/contracts/phase2/openapi.yaml` | P4 — `AssessmentRecipe.scope` (load-bearing: `additionalProperties: false`). Optional: sync the `Material` schema with `outline`/`pageCount` for documentation honesty — the client reads materials straight from the DB, so this is not on the feature path. |
| `services/intelligence/app/routers/assessments.py` | P4 — scope validation against `page_count` |
| `services/intelligence/contracts/phase2/fixtures/` + `tests/` | P4 — scoped recipe fixture + contract assertions |
| `apps/app/src/assessments/types.ts` | P4 — `AssessmentScope` on the recipe, outline types |
| `apps/app/src/pages/assessments/AssessmentConfig.tsx` | P4 — scope picker replaces the free-text tag box |
| `apps/app/src/materials/materialClient.ts` | P5 — `createSignedUrl` on `MaterialStorageLike` |
| `apps/app/src/materials/PdfViewer.tsx` (new) | P5 — pdf.js canvas viewer, chapter jump, range select |
| `apps/app/src/App.tsx` | P5 — `/materials/:materialId/view` route |
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

### Phase 2 — Page provenance through ingestion + the RPC `⬜ Not started`
1. `models.py`: `TextSegment.page`, `ContentChunk.page_start/page_end`.
2. `extractors.py`: `PypdfTextReader` returns per-page text; the `file` branch builds page-tagged segments. **The joined text must remain byte-identical** (D-03) or every existing embedding is invalidated.
3. `chunking.py`: propagate pages; a boundary-straddling chunk carries `page_start != page_end`.
4. `worker.py` + `repository.py`: chunk rows carry the columns.
5. Migration 029: `content_chunks.page_start/page_end INT NULL`; `match_content_chunks` gains `p_page_start`/`p_page_end` applied in both CTEs. **Copy the migration-016 body verbatim as the base** — it is the latest definition, and 027 already broke this repo by re-creating a function from a stale body.
**Verification:** unit tests for page propagation, boundary straddling and filter inclusivity; migration applies clean on dev Supabase (rule 36); live re-ingest of the APM material, then assert every chunk has pages and `count(page_start between 1 and 572) == 754`.

**Notes (filled in during implementation):**

### Phase 3 — Outline at ingestion `⬜ Not started`
1. `app/ingestion/outline.py` from `scripts/pdf_outline.py` (deterministic core unchanged; the LLM path wired to the existing OpenRouter adapter and schema).
2. Migration 029 (same file): `materials.outline JSONB`, `materials.page_count INT`, `materials.page_offset INT`.
3. Stage-1 extraction computes and persists the outline. `url`/`manual`/`youtube` materials take the LLM-or-empty path (no page scope offered).
4. No client plumbing: `materialClient` reads `materials` with `select('*')` (`materialClient.ts:193,216`), so the outline and `page_count` arrive on the material record the config page already fetches. No new route, no new fetch.
**Verification:** the `--self-check` layouts become unit tests (wrapped title, dot leaders, single-space page, permissive gating); live: the APM outline equals the printed contents page (16 chapters, offset -33), and re-running on SICP/CSAPP/DDIA stays deterministic.

**Notes (filled in during implementation):**

### Phase 4 — Scope contract + picker + scoped retrieval `⬜ Not started`
1. `openapi.yaml`: `AssessmentRecipe.scope`; a new fixture; contract tests.
2. `routers/assessments.py`: validate the range against `materials.page_count`.
3. `worker.py` + `context.py`: the scope reaches the RPC; the blueprint carries it for telemetry.
4. `AssessmentConfig.tsx`: chapter chips from `materials.outline`, a two-number page range, an "open material" link. Remove the free-text tag box.
5. D-06's widen-and-warn behaviour.
**Verification:** contract test for the scoped recipe; route matrix for out-of-range/zero-chunk/thin-range; app tests for the picker; **live gate: pick Chapter 5, generate, and assert every citation's chunk page lies inside that chapter's range.**

**Notes (filled in during implementation):**

### Phase 5 — pdf.js viewer `⬜ Not started`
1. `pdfjs-dist` in `apps/app`; worker wired via `pdfjs-dist/build/pdf.worker.min.mjs?url` (Vite: without `workerSrc` the canvas renders blank).
2. `MaterialStorageLike` gains `createSignedUrl`; the viewer loads by signed URL so pdf.js range-fetches instead of pulling 22.9 MB.
3. `PdfViewer.tsx`: canvas render, `pagechange` → current page, `getOutline()` first then `materials.outline` for chapter jump, range selection → "Assess these pages". Route `/materials/:materialId/view` (no `/study` prefix, per rule 12).
**Verification:** live at 1280 and 375: renders, jumps to a chapter, selects a range, hands it to the config, and the resulting question's citations sit inside the range.

**Notes (filled in during implementation):**
