## Parent

- Implementation spec: #32
- Wayfinder map: #4
- GitHub ticket: [#62](https://github.com/rings0fsaturn/study-planner/issues/62) (filed + claimed 2026-09-11; claim it before work per the map's tracker ops)
- Local task: `active/scoped-question-generation/`

## What to build

Let the learner choose what they are assessed on, and make generation ground in that choice instead of in the material's own front matter.

Today the only steer is the material title, which retrieves the cover, contents, index and study-guidance chunks; the model then authors exam-format questions ("describe the format of Section A") because that is all the context it has. The learner sees the document's contents (chapters) and its pages, picks a chapter or a page range, and the question is authored from those chunks only.

Deliver: page provenance through ingestion, a contents-page outline per material, a page-scoped generation recipe, a chapter/page picker, and a PDF viewer so the learner can see what they are choosing.

## Acceptance criteria

- [ ] Generation grounds in the learner's chosen chapter or page range; the prompt carries a blocklist so exam/syllabus/document meta cannot be asked even inside a full-material scope.
- [ ] Content chunks carry page provenance (page_start/page_end) and the retrieval RPC can filter on a page range.
- [ ] A material's outline (chapter or section titles + page numbers) is derived at ingestion and served to the client; it matches the document's own contents page.
- [ ] The learner picks a chapter or a typed page range in the config surface and can open the material in a viewer to see the page numbers.
- [ ] A generated question's citations all fall inside the chosen scope, verified live.
- [ ] Existing materials need no backfill migration: re-ingest is cheap because embeddings are local and free.

## Blocked by

- Ticket #07 — Assessment Taking and Objective Grading (done)
- Ticket #09 — Written Assessment and Grading (done)

## Scoping decisions (user, 2026-09-11)

| # | Decision |
|---|---|
| 1 | Viewer = `pdfjs-dist` (custom canvas viewer), not `react-pdf`, and not an `<iframe>` (an iframe cannot report the page in view). |
| 2 | Index source = deterministic contents-page parse first; the LLM (DeepSeek via OpenRouter) is a judge/fallback, never the extractor. |
| 3 | Scope levels = chapter **and** page range in the same release. |
| 4 | Re-ingest is free (local LLM embeddings), so page columns land by forcing a re-chunk, not by a backfill script. |

## Out of scope

- `questionCount > 1`: the accept RPC takes one question row and the worker is one-message-one-question. Multi-question needs its own ticket.
- Page scope for `url` / `manual` materials (no pages). They get the outline via the LLM path and no scope picker.
- YouTube timestamp scoping: the analogous feature, cheap later (`start_seconds` already exists, the IFrame API is already wired), not in this ticket.
