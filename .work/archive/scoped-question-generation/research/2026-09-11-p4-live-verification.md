# P4 live verification — scope contract, picker and scoped retrieval (2026-09-11)

Ticket #62 · phase 4 of `plan/PLAN.md` · branch `phase2/issue-62-scoped-question-generation`.
Everything below is measured, not predicted.
Live stack: dev Supabase project, ROCm sidecar on :8200, Intelligence service on :8000 (`./full-app restart full`, so the router change is actually loaded), detached ingestion worker restarted for the generation change (`scripts/run-detached-ingestion-worker.sh`, rule 53 — it had been running the P3 code).
Material: `ACCA APM Study Text` `80c8b138-b544-4095-8dc0-1c390ac70da2` (572 PDF pages, 754 chunks, 16 outline entries, `page_offset` -33).
Probes: `/tmp/p4_live_gate.py` (throwaway, not committed; the durable checks are the contract/route/worker unit tests and the live e2e spec).

No new migration was written for P4. The scope rides `assessments.recipe` (jsonb) and the read route echoes it, so retry and restore round-trip it with no plumbing — visible below in that every run came back with its scope verbatim.

## 1. Suites

| Measurement | Result |
|---|---|
| `contracts/phase2` (incl. the 2 new scoped-recipe tests) | 22 passed |
| `tests/test_generation_context.py`, `test_generation_worker.py`, `test_assessments_api.py` | green (see §5) |
| service `tests/` minus the 7 known pre-existing failures | 518 passed |
| `AssessmentConfig.test.tsx` + `src/materials` | 70 passed |
| `materialClient.test.ts` (outline/pageCount/pageOffset mapping + a junk outline reading as none) | 26 passed |
| `pnpm typecheck` | clean (5 workspace projects) |
| `pnpm lint` | clean |
| whole app suite `pnpm --filter app test` | **762 passed / 2 failed** — the documented WSL threads-pool TZ pair in `src/dev/seedTestData.test.ts`; re-run `--pool=forks` → **2/2 green**, so it is the recorded flake and not P4 fallout |

## 2. Authenticated API gate — AC1 grounding and AC5 citations-in-scope

Password grant with the repo's test account (backticks stripped, per rule 16), then `POST /v1/assessments/generate` on `:8000` with

```
recipe.scope = {pageStart: 156, pageEnd: 213, sectionLabel: "Chapter 5 Budgeting and control"}
```

156..213 is Chapter 5 in **PDF** page numbers (printed 123 → pdf 156; the next chapter starts at 214). Response `202` → poll → `ready`, **warnings `[]`** (the range is 85 chunks wide, so no widening was needed), and the recipe came back through the read route verbatim:

```
{'scope': {'pageEnd': 213, 'pageStart': 156, 'sectionLabel': 'Chapter 5 Budgeting and control'},
 'formats': ['objective'], 'difficulty': 3, 'questionCount': 1}
```

Question and citations, with each cited chunk joined to `content_chunks` under the service role (a user token returns 0 rows for that table):

> Q: Which of the following best defines a budget according to the provided material? A budget is a quantitative plan prepared for a specific time period, normally expressed in financial terms and prepared for one year.
> 1. A budget is a detailed plan of action expressed in financial terms, usually covering a one-year period.

| cited chunk | ordinal | pages | in 156..213 |
|---|---|---|---|
| `98edec8237a64712bf773704bcd9e116` | 204 | (158, 158) | yes |
| `5a7de9ed6e3143aaa09646bc5d7847dc` | 269 | (202, 202) | yes |

Both cited chunks are Chapter 5 body text (ordinal 204 is the "3 Introduction to budgeting / 3.1 What is a budget?" page) and the question is about Chapter 5's subject matter, not the examination. **AC1's grounding half and the whole of AC5 are proven on the real request path.**

Control from the same run set: the pre-P4 shape (no scope, no steer) now takes the spread branch and produced a supply-chain question citing a body chunk, and the earlier P1 measurement (title steers → front matter) is unchanged for a title-shaped steer. Nothing in the scoped arm quotes the examination, the syllabus or the study text.

## 3. Route matrix (live)

| Case | Result |
|---|---|
| `156..213` + label | `202` → `ready`, warnings `[]`, citations inside the range (§2) |
| `156..158` (3 pages) + label | `ready`, warnings `[]` — **does not widen**: overlap matching already returns exactly `CONTEXT_TOP_K` = 5 chunks |
| `156..156` (single page) + label | `ready`, warnings `[scope_widened]`: *"pages 156-156 held only 4 chunk(s); the search widened to pages 151-161"*; the citation lands at page 161, i.e. inside the **widened** range — this is D-06 working, and it is why AC5's assertion is stated for a correctly sized chapter range rather than for a deliberately thin one |
| `156..600` (over 572) | `409 validation_failed`: *"scope.pageEnd must not exceed the material's 572 pages"* |
| `200..100` (inverted) | `400 invalid_request`: *"scope.pageStart must not be greater than scope.pageEnd"* |
| pageless `url` material scoped | `409 validation_failed`: *"this material has no page numbering to scope by"* |
| `156..213` with **no** `sectionLabel` (page-only, no `skillTags` at all) | `202` → `ready`, warnings `[]`, citation at pages (177, 178) inside the range — the spread branch (D-08's deferred "no query" path) works and never embeds an empty string |

The plan predicted a 3-page scope would starve and widen; the measurement says 3 pages is already enough on this corpus because a page window is an *overlap*, so it collects the chunks that straddle its edges. A single page is the genuinely thin case and widens as designed.

## 4. Browser click-through (AC4)

`pnpm exec playwright test -c e2e/playwright.config.ts --project=app e2e/assessment-generation-live.spec.ts --workers=1` with `E2E_LIVE_EMAIL` / `E2E_LIVE_PASSWORD` exported from the repo credential file (never printed).

**3 passed (1.6 m)** at the two viewports the AC names:

| Test | Viewport | Result |
|---|---|---|
| unscoped generation (pre-existing scenario) | 1280 | ✓ 19.4 s |
| chapter chip → page range → generate → citations | 1280 | ✓ 16.2 s |
| config renders, chip fills the range, "Whole material" clears it | 375 | ✓ 6.8 s |

What the scoped click-through asserts: the `Chapter scope` chip group renders from `materials.outline`; clicking *Chapter 5 Budgeting and control* fills **From page = 156** and **To page = 213** (the outline entry's own page to the next chapter's minus one); "Generate question" lands on `/study/assessments/<id>`; the review surface renders the question with a `Citations` heading and a cited chunk; the page body contains no `examination` / `syllabus` text. The mobile test additionally proves `Whole material` clears both inputs again at 375px.

The question the scoped flow produced (from the page snapshot of the first attempt of this run — same spec, one stale assertion fixed between attempts; the assertion itself is what the final green run covers):

> Q: A company's marketing division runs fixed-duration campaigns that do not align with the annual accounting period, and its spending is largely discretionary. Which budgeting approach is most appropriate for this division?
> 0. Incremental budgeting · 1. Zero-based budgeting · 2. Top-down budgeting · 3. Rolling budgeting
> cite `5a7de9ed`: "ZBB requires each cost element to be justified, otherwise no resources are allocated. ... ZBB is often used where spending is discretionary in areas such as marketing and research and development."

**The spec itself was stale.** It waited for the text `Difficulty band` and read the citation out of `.card-large`; the detail page has rendered "Difficulty 3" plus a `Citations` heading (the review surface) since the #40/#41 rework, so those two assertions had been failing regardless of this phase. Both are now written against the real DOM, the retry-poll loop is one shared `waitForQuestion` helper, and the scoped scenario above is new. That is the only e2e change in P4.

## 5. Files touched by P4

`services/intelligence/app/routers/assessments.py` (`_validate_scope`, `_scope_range_failure`),
`app/generation/models.py` (`AssessmentScope`, `GenerationBlueprint.scope`),
`app/generation/context.py` (scope-aware steer, page bounds into the RPC, `_spread_context`),
`app/generation/worker.py` (scope from the recipe, `_widen_thin_context`, required 3-arg `ContextBuilder`),
`app/worker_main.py` (adapter passes the scope),
`contracts/phase2/openapi.yaml` + `fixtures/assessment-recipe-scoped.json` + `fixtures/README.md` + `contracts/phase2/tests/test_contracts.py`,
`apps/app/src/assessments/types.ts`, `src/materials/types.ts` (`OutlineEntry`/`MaterialOutline`/`outlineFromRow`), `src/materials/materialClient.ts` (row mapping), `src/pages/assessments/AssessmentConfig.tsx` (chapter chips + page range, tag box deleted),
and the tests named in §1 plus `e2e/assessment-generation-live.spec.ts`.
