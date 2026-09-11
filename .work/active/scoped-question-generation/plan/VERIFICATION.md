# Verification – scoped-question-generation (#18)

_Ticket: GitHub #62 (filed + claimed 2026-09-11) · Parent spec #32 · Plan: plan/PLAN.md · Updated: 2026-09-11_

## AC tick-down (all unchecked until proven)

- [ ] AC1 — Generation grounds in the chosen chapter or page range, and exam/syllabus/document meta cannot be asked even without a scope. — Evidence required: prompt blocklist asserted in both templates; a live scoped generation whose question is about the material's content; an unscoped generation that still refuses exam-format framing. **P1 (2026-09-11) landed the blocklist half:** both templates carry `META_BLOCKLIST`, the title is out of the steer, and a real A/B generation showed exam framing gone with a front-matter steer and a body-grounded question with a chapter steer (`research/2026-09-11-p1-live-verification.md`). The *grounding* half still needs P2+P4 (a page-only scope has no qualified query yet — D-08).
- [ ] AC2 — Chunks carry `page_start`/`page_end` and `match_content_chunks` filters on a page range. — Evidence required: unit tests for propagation, boundary straddling and filter inclusivity; migration 029 applied on dev Supabase; live re-ingest with every chunk paged.
- [ ] AC3 — The outline is derived at ingestion and matches the document's own contents page. — Evidence required: unit tests for the three TOC layouts; the APM outline compared line-by-line against the printed contents page (16 chapters, offset -33); deterministic re-run on SICP/CSAPP/DDIA.
- [ ] AC4 — The learner picks a chapter or a typed page range and can open the material in a viewer. — Evidence required: config picker fed by `materials.outline`; live click-through at 1280 and 375; viewer page number visible and consistent with the range control.
- [ ] AC5 — Every citation of a scoped generation falls inside the chosen scope. — Evidence required: live gate — pick a chapter, generate, assert each cited chunk's page lies in the range.
- [ ] AC6 — Existing materials need no backfill migration. — Evidence required: re-ingest path exercised on the APM material with no scripted backfill, and the page columns populated as a result.

## Phase gates

- [x] P1 prompt + steer: `uv run pytest services/intelligence/tests -q` green with updated prompt/context assertions; the retrieval probe returns technical ordinals for a chapter steer; one real generation reads as content, not exam framing. — **Done 2026-09-11:** focused generation+assessment suites 139 passed; service suite 509 passed / 7 failed with the identical 7 failing on the untouched base; probe chapter steer -> ordinals 203/271/204/269/202 (Chapter 5 body) vs the pre-fix title steer -> 753/0/67/49/24 (front matter); real DeepSeek A/B produced a body-grounded question for the chapter steer and no exam question in either arm. Transcript: `research/2026-09-11-p1-live-verification.md`. Rode along: D-08 (empty steer refused) and the worker's non-retryable context path now fails the assessment instead of leaving it `generating`.
- [ ] P2 page provenance: focused service tests green; `content_chunks.page_start/page_end` populated for all 754 chunks after re-ingest; RPC range filter returns an inclusive, correct subset; existing embeddings not invalidated (text byte-identical).
- [ ] P3 outline: outline unit tests green (three layouts + permissive gating); live APM outline equals the printed contents page; no model call on the deterministic path.
- [ ] P4 scope + picker: contracts green; route matrix green (out-of-range, inverted range, zero-chunk, thin-range widen-and-warn); app tests green; live scoped generation with every citation in range.
- [ ] P5 viewer: live at 1280 and 375 — renders, chapter jump, range select, hands off to the config, no console errors, no blank canvas (worker wired).

## Live evidence

- 2026-09-11 (P1): retrieval probe + real-model A/B on the ACCA APM material — `research/2026-09-11-p1-live-verification.md`.
- 2026-09-11 (P1): empty-steer measurement (ordinals 393/259/90/532/344, fragments) that produced D-08.
- Not run (P1): authenticated `POST /v1/assessments/generate` click-through — `.work/specs/test-login-cred.txt` fails Supabase's password grant (`invalid_credentials`), so the browser/API pass needs the user's credentials; the generation proof drives the same worker objects directly.

## Wayfinder resolution (exit)

- [x] File the GitHub ticket on the #33-#49 spine, claim it, and add the map #4 line. — **Ticket #62 filed + assigned 2026-09-11** (`wayfinder:phase2` + `ready-for-agent`). Map #4 line still to add at resolution.
- [ ] Resolution comment; issue closed; STATUS row flipped to Done; folder archived.
