# State – scoped-question-generation
_Spec: specs/phase2-tickets/18-scoped-question-generation.md · GitHub #62 · Plan: active/scoped-question-generation/plan/ · STATUS row: scoped-question-generation · Status: active · Updated: 2026-09-11_

## Current state & next
- **P1 done 2026-09-11** (prompt meta blocklist + steer fix, no DB/contract/UI) on branch `phase2/issue-62-scoped-question-generation`, cut off `phase2/issue-40-41` at `237faf8`.
- P2–P5 are defined in `plan/PLAN.md` (now with D-08); the ACs and per-phase gates are in `plan/VERIFICATION.md`; measured evidence is in `research/2026-09-11-evidence.md` and `research/2026-09-11-p1-live-verification.md`.
- Scoping locked with the user 2026-09-11 (four decisions, below); decisions D-01–D-08 in force.
- **Next:** P2 — page provenance through ingestion (`TextSegment.page`, chunk `page_start`/`page_end`, migration 029 with the RPC's nullable page bounds), copying the migration-016 body verbatim.
- Sequence note: this branch was cut *before* issue-41's wayfinder exit; that exit is still open in its own task and touches `.work/` records only, not this ticket's code.

## Done so far
- 2026-09-11 (P1): filed and claimed GitHub **#62** on the #33–#49 spine (`wayfinder:phase2` + `ready-for-agent`), cut branch `phase2/issue-62-scoped-question-generation` off `237faf8`.
- 2026-09-11 (P1): **steer fix** — `build_context` lost its `title` parameter entirely; the steer is the learner's tags (the section label rides there until P4 passes `scope.sectionLabel`). `prompts.py` gained a shared `META_BLOCKLIST` in both system templates, and both user templates carry `{title_line}` as document context separate from `{steer}`. `routers/assessments.py` dropped `DEFAULT_SKILL_TAGS`; `skillTags` stays optional per the contract. `worker_main.py`'s context builder follows the new signature.
- 2026-09-11 (P1): **D-08 discovered by measurement** — an empty steer embeds to a degenerate vector and returns fragments; `build_context` now refuses it (`validation_failed`, non-retryable) and the worker fails the assessment on a non-retryable context error instead of leaving it `generating`.
- 2026-09-11 (P1): live verification — probe pre-fix steer -> 5/5 front matter (753/0/67/49/24), chapter steer -> 5/5 Chapter 5 body (203/271/204/269/202); real DeepSeek A/B produced no exam question in either arm and a body-grounded question for the chapter steer. Focused suites 139 passed; service suite 509 passed / 7 failed with the identical 7 failing on the untouched base. Transcript: `research/2026-09-11-p1-live-verification.md`.
- 2026-09-11: diagnosed the reported defect end to end. 25 questions exist in the dev project and **25/25 ask about the examination or the document, 0 about the material's content**; 22 distinct skill-tag sets, so tags do not control the subject.
- 2026-09-11: proved the mechanism by replaying the exact failing steer through the real retrieval path — 5/5 retrieved chunks are front/back matter (cover, index, chapter-1 boundary, "The examination", "Study skills and revision guidance") while only 8.5% of the corpus is exam-meta. Removing the material title from the steer retrieves the technical chapters instead. Probe: `scripts/diagnose_generation_context.py`.
- 2026-09-11: measured page feasibility on the live corpus — 0 PDF bookmarks, the printed contents page is parseable (16 chapters + Index, pdf page 6), the printed→pdf offset is −33 (266/320 header-bearing pages agree), and the existing page→chunk mapping is recoverable 754/754. Probes: `scripts/probe_pdf_pages.py` (removed after use), `scripts/pdf_outline.py` (kept as the P3 seed).
- 2026-09-11: built and validated the outline parser on four real PDFs and four TOC layouts — APM 16 entries (exact match to the printed contents, 1.4 s), SICP 91, CSAPP 128, DDIA 188, deterministic; the DeepSeek fallback returned 16/16 correct entries in 16.2 s. `--self-check` pins the three layout rules.
- 2026-09-11: opened this task — `specs/phase2-tickets/18-scoped-question-generation.md`, `active/scoped-question-generation/{plan,research}/`, STATUS row under Active. No `state.md`/`SCRATCHPAD.md` existed before this session.

## Flow trace
1. The learner picks a material and asks for an assessment. `AssessmentConfig.tsx:124-157` builds the request with `recipe = {formats, questionCount: 1, difficulty, skillTags}` and posts it to `/v1/assessments/generate`.
2. `routers/assessments.py:37-53` validates the recipe (`questionCount` must be 1; formats must be `['objective']` or `['written']`), inserts the assessment row, and enqueues the generation job atomically.
3. The generation worker (`generation/worker.py:136-204`) reads the assessment, takes `difficulty` and `skillTags` from the stored recipe, and calls the context builder.
4. `generation/context.py:21-31` builds the steer as `" ".join((title, *skill_tags))` — **the material title is the query** — embeds it with the sidecar as a query, and calls `match_content_chunks` with `top_k = 5` and the same string as `query_text` for the hybrid BM25 half (migration 016's RRF function).
5. Because the title literally matches the cover, contents and index, those chunks win both halves of the hybrid retrieval; the worker passes them to the prompt as the only source.
6. `prompts.py:115-125` (objective) and `:172-188` (written) instruct the model to author one question grounded strictly in those chunks, with the same steer string repeated as "Learner need (topic steer)". Neither prompt forbids exam/syllabus/document questions.
7. The model therefore authors an exam-format question — the only genre the retrieved context supports. Validation passes (the chunks are real, the citations verify), so the question is accepted and stored; nothing downstream can detect that the question is about the document rather than its content.
8. Pages never enter this path: `extractors.py:104-117` joins all PDF pages into one string, `chunking.py` carries no page, `content_chunks` has no page column, and `match_content_chunks` cannot filter by one.
9. The plan inserts a scope at three points: page provenance through extraction/chunking/storage (P2), an outline parsed at ingestion (P3), and `recipe.scope` carrying the learner's chapter or page range into the retrieval call (P4). The viewer (P5) exists so the learner can read the page numbers they are choosing.
10. Scope persistence is free: `assessments.recipe` is jsonb and the read route already echoes it (`routers/assessments.py:149-151`, the #41 P5 fix), so retry and restore round-trip the scope with no new plumbing.

## Files affected
- `services/intelligence/app/generation/context.py` (P1) – `title` parameter removed; the steer is the tags; an empty steer is refused (D-08).
- `services/intelligence/app/generation/prompts.py` (P1) – shared `META_BLOCKLIST` in both system templates; `{title_line}` document context separate from `{steer}`; `_topic_steer`/`_title_line` helpers.
- `services/intelligence/app/generation/worker.py` (P1) – context builder called with `(material_id, skill_tags)`; `["core"]` default dropped; a non-retryable context error fails the assessment.
- `services/intelligence/app/worker_main.py` (P1) – context-builder adapter follows the new signature.
- `services/intelligence/app/routers/assessments.py` (P1) – `DEFAULT_SKILL_TAGS` removed; `skillTags` validated only when present.
- `services/intelligence/tests/test_generation_{context,prompts,worker}.py`, `tests/test_assessments_api.py` (P1) – steer/blocklist assertions, empty-steer and non-retryable-context tests, two new route cases (6 new tests).
- `.work/active/scoped-question-generation/research/2026-09-11-p1-live-verification.md` (new, P1) – probe + real-model A/B transcript.
- `.work/specs/phase2-tickets/18-scoped-question-generation.md` (new) – the ticket contract: AC1–AC6, the four locked scoping decisions, out-of-scope list.
- `.work/active/scoped-question-generation/plan/PLAN.md` (new) – P1–P5, decisions D-01–D-08, files-touched index, measured context.
- `.work/active/scoped-question-generation/plan/VERIFICATION.md` (new) – AC tick-down, per-phase gates, exit checklist; P1 gate ticked.
- `.work/active/scoped-question-generation/research/2026-09-11-evidence.md` (new) – the drift table, the retrieval replay table, page forensics, outline-parser results, reproduction commands.
- `.work/active/scoped-question-generation/state.md` + `SCRATCHPAD.md` (new) – this record.
- `.work/STATUS.md` – new Active row; `_Last reconciled_` bumped to 2026-09-11.
- Client material read needs no change: `materialClient` uses `select('*')` (`materialClient.ts:193,216`), so new `materials` columns (outline, page_count) arrive with the record `AssessmentConfig` already fetches.
- `services/intelligence/scripts/diagnose_generation_context.py` (new) – retrieval-drift probe; the regression tool for P1. Committed with P1.
- `services/intelligence/scripts/pdf_outline.py` (new) – outline parser prototype and P3 seed; `--self-check` becomes the unit-test seed. Committed with P1.

## Pitfalls & rules
- **Never embed an empty steer.** `""` (or whitespace) embeds to a degenerate vector and `match_content_chunks` answers with fragments (measured ordinals 393 `'likes'.`, 259 `produced.`, 90 `GU.`, 532 `369`, 344 `necessary.`). `context.build_context` now raises `validation_failed` (non-retryable) instead, and the worker fails the assessment on a non-retryable context error rather than leaving it `generating` (D-08).
- **The material title is front matter.** Any steer containing it retrieves the cover, contents page and index (5/5 measured); the title belongs in the prompt as document context only, never in the query.
- `.work/specs/test-login-cred.txt` no longer satisfies Supabase's password grant (`invalid_credentials`, tried with both the service-role and the publishable apikey), so a live browser/API pass needs the user's own credentials.
- A stale `.git/index.lock` (04:20, no git process alive) blocked git operations in this checkout; it was removed after confirming no git process was running. Check before deleting.
- The extracted text must stay **byte-identical** when pages are added: `ingestion/worker.py:391-397` reuses existing chunk rows when the re-extracted text matches, so any whitespace change silently invalidates the corpus's embeddings.
- Adding page columns requires **deleting the material's chunk rows** before re-ingest; a plain retry hits that byte-identical reuse and leaves the new columns NULL (D-07).
- Before `CREATE OR REPLACE`-ing `match_content_chunks`, copy the **most recent** body (migration 016) verbatim. Migration 027 already broke this repo by re-creating a function from a stale body and dropping a cast (42804 at live runtime, plpgsql bodies are only parsed at first execution).
- `AssessmentRecipe` is `additionalProperties: false` (`openapi.yaml:135`) — `scope` must be added to the contract or the request is rejected.
- `questionCount` is pinned to 1 in three places (`routers/assessments.py:44`, one message = one question in `generation/worker.py`, the single-row accept RPC in `migrations/028:44`) — do not attempt multi-question inside this ticket.
- A scope that returns fewer chunks than `CONTEXT_TOP_K` must widen and warn (D-06); a silently thin context is how the original defect hid.
- pdf.js needs `GlobalWorkerOptions.workerSrc` set (Vite: `pdfjs-dist/build/pdf.worker.min.mjs?url`) or the canvas renders blank with only a console warning.
- An `<iframe>` PDF viewer **cannot** report the page being displayed; that is why the viewer choice is pdfjs-dist and not the zero-dependency native option.
- Printed page ≠ PDF page (offset −33 on the APM corpus); the offset is per-document and must be derived from running headers, never hardcoded. Label the picker with the number the learner sees in the viewer.
- The printed→PDF offset has a ~2-page skew on chapter openers (the opener page carries no printed number); acceptable for scoping a chapter, not for exactness.
- The DeepSeek outline fallback returns titles without the `Chapter N` prefix, so parser-vs-model comparison must key on page numbers, never on title substrings.
- Per-prompt rule from #41 that still holds: prompts and response schemas are built per message; never reintroduce a module-level schema constant.
- Live runs need the managed runtime **plus** the detached ingestion worker (`bash scripts/run-detached-ingestion-worker.sh`; `full` does not run it) **plus** the GPU sidecar on :8200; the detached worker does not hot-reload, so restart it after any `services/intelligence/app/` change. Live mutation specs run `--workers=1` and without a `--` separator.
- `.work/` is tracked on purpose; never add it to `.gitignore` and never run `git clean -fdx` at the repo root.

## Decisions in force
- Scoping locked with the user 2026-09-11 (spec table): (1) viewer = `pdfjs-dist` custom canvas, not `react-pdf`, not an iframe; (2) index source = deterministic contents-page parse primary, LLM judge/fallback only; (3) chapter **and** page range in the same release; (4) re-ingest is free (local embeddings) so page columns land by forcing a re-chunk, no backfill script.
- **D-01:** the steer is the chosen section label (or empty), never the material title; the title stays as separate document context in the prompt (2026-09-11).
- **D-02:** both system prompts carry an explicit meta blocklist (no exam, syllabus, marks, duration, section structure, study guidance, chapter structure, or study-text questions) and require a concept-or-application question (2026-09-11).
- **D-03:** page provenance rides ingestion segment → chunk → column → RPC, with `page_start`/`page_end` (two columns, because chunks straddle boundaries) and nullable page bounds in `match_content_chunks` (2026-09-11).
- **D-04:** the outline is parsed deterministically at ingestion (`ingestion/outline.py`, stage 1, no new queue stage); bookmarks first, then the contents-page parse, then one DeepSeek call over front-page excerpts; persisted on `materials` (2026-09-11).
- **D-05:** one scope shape for both levels — `recipe.scope = {pageStart, pageEnd, sectionLabel?}`, validated against `materials.page_count`, stored in the existing recipe jsonb (2026-09-11).
- **D-06:** a thin range widens and warns; only a zero-chunk range is rejected (2026-09-11).
- **D-07:** existing materials re-ingest rather than backfill; the measured 754/754 page-recovery stays a verification probe, not a mechanism (2026-09-11).
- **D-08:** an empty steer is refused (`validation_failed`, non-retryable), never embedded; the worker fails the assessment on a non-retryable context error. The proper unscoped query ("no query -> an evenly spread sample inside the page range") needs the RPC's nullable page bounds and belongs to P2/P4 (2026-09-11, added during P1 after measuring the empty-steer fragments).
- Inherited from map #4: the capstone principle (feature-rich, no MVP deferral) and #13's decision that similarity retrieval is for targeted "about topic X" slots — this ticket implements that targeted slot.

## Open
- GitHub #62 is **filed and assigned** (2026-09-11); the map #4 resolution line and close still come at P5's exit.
- `services/intelligence/scripts/diagnose_generation_context.py` and `pdf_outline.py` are now **tracked** (committed with P1) instead of sitting untracked.
- Blocked-by sequence: issue-41's wayfinder exit (push `phase2/issue-40-41`, resolution comment, close #41, map line, STATUS flip, archive) is still open in its own task. This branch was cut before it, so `.work/` records diverge while the code does not; the ticket's code stands on `237faf8`.
- Not verified live: the authenticated browser/API click-through (P1's steer cannot be exercised from the UI without typing a real topic tag). `.work/specs/test-login-cred.txt` fails Supabase's password grant, so this pass needs the user's credentials or a hands-on click-through.
- P4 to close a P1 wart: `AssessmentConfig.tsx:135` still sends `skillTags: ['core']` when the tag box is empty, so an untagged request still steers on a meaningless term. The tag box and that default are both P4's.
- Needed before a page-only scope ships (D-08 follow-up): the RPC must answer an unscoped, page-bounded request with a spread of chunks (no query) rather than a similarity query. P2 adds the nullable bounds; the "no query" branch is a P2/P4 decision.
- Out of scope, deliberately: `questionCount > 1` (needs an accept RPC taking a question array, a worker slot loop, telemetry and config changes — its own ticket); page scope for `url`/`manual` materials; YouTube timestamp scoping (cheap later: `start_seconds` exists and the IFrame API is already wired).
- Unverified by design (to be proven during implementation, not assumed): that a chapter-scoped generation reliably produces content questions — AC1's live gate is the proof.
