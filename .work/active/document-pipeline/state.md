# State – document-pipeline

_Spec: `specs/phase2-tickets/19-document-pipeline.md` (not written yet) · GitHub: not filed yet · Plan: `active/document-pipeline/plan/PLAN.md` · STATUS row: document-pipeline · Status: planned · Updated: 2026-09-12_

## Current state & next

- **Planned 2026-09-12, no code written.** The plan (`plan/PLAN.md`) covers upload → convert → compress → store → serve, with the measured ceilings it rests on.
- **Next: D0** — write the spec, file the GitHub issue on the #33-#49 spine, claim it, cut the branch off the then-current tip, and put both ids back into the plan header.
- **Sequencing:** this task's D4 (serving) consumes #62 Phase 7 (the same-origin range route). #62's P6/P7 and its wayfinder exit land first.
- Blocked by: nothing technical. #62's exit is the queue head, not a blocker.

## Done so far

- 2026-09-12: scoped the task from a design conversation. Established, against the live tree, that upload/storage/queue/worker already exist (`docker-compose.yml:57`, `ingestion/extractors.py:203-275`, migrations 004-030) and that the only missing stages are conversion (docx/pptx/odt) and viewer-copy normalization/compression.
- 2026-09-12: measured the corpus file's composition rather than assuming a compression win: 95.9% stream data, 89% images (12.49 MB already JPEG, 7.94 MB losslessly stored), text/vector only 6.8%, whole-file gzip 0.882. Details in the plan's table.
- 2026-09-12: recorded that `ff3ab07`'s `normalize()` clone **inflates** (2,998,611 B → 3,420,085 B), so compression on the derived copy recovers a real regression.
- 2026-09-12: recorded the decision that compression applies to the viewer copy only, which keeps the frozen retrieval baseline (754 chunks, embeddings, pages 1..572, outline offset −33) untouched.

## Flow trace

1. The learner uploads a file; `apps/app` writes it to Supabase Storage `material-raw` at `<ownerId>/<materialId>/<source>` and inserts the `materials` row (kind `file`).
2. `ingestion-worker` polls (`ingestion_poll`), reads the source through an injected `SourceReader`, and `extract_material` dispatches on `kind` (`manual` | `url` | `file` | `youtube`). `file` goes through `PypdfTextReader` today and nothing else.
3. Extraction produces `ExtractedContent` (text, per-page segments, pages, bookmarks), plus `viewer_pdf` since `ff3ab07` when the page tree needed repair.
4. The worker chunks, embeds, derives the outline (migrations 029/030) and uploads `fulltext.txt` — and since `ff3ab07` a `view-<contentVersion>.pdf` next to it when extraction rewrote the file.
5. The viewer asks `MaterialClient.getMaterialFileUrl`, which prefers the `view-*.pdf` copy and falls back to the raw object, both via `createSignedUrl`.
6. This task inserts conversion before step 3 (docx/pptx/odt → PDF), and normalization/compression at step 4 (the derived copy only), and consumes #62 P7's same-origin route at step 5.

## Files affected

- None yet. The expected index lives in `plan/PLAN.md` and is to be corrected on contact.

## Pitfalls & rules

- **A derived copy is not a source.** Extraction, chunking, embeddings and page provenance must keep reading the original; if the derived copy ever becomes the extraction source, the retrieval baseline moves silently and every citation ordinal changes.
- **`ff3ab07`'s viewer copy is load-bearing.**
  A repeated `/Kids` entry is legal PDF but both engines treat it as a cycle (pypdf aborts, pdf.js truncates to 10 of 322 pages), so for those documents the browser can only open the repaired copy — never "optimize" that path away.
- **The current `normalize()` inflates the file.** pypdf's `PdfWriter(clone_from=...)` re-serialization costs ~14% on the measured sample; measure before claiming a compression win.
- **`CREATE OR REPLACE` cannot change a function's parameters or return type**, and an applied migration is never re-run: D1's columns ship as migration **031** (029/030 are live).
- **MIME must be sniffed from the bytes.** A docx renamed `.pdf` must not reach the PDF reader, and a PDF renamed `.docx` must not reach LibreOffice.
- **Uploads are hostile input.** LibreOffice parses untrusted container formats: run it offline in the worker, with a hard timeout, never in the FastAPI request path.
- **Rule 35 boundary:** snapshot/storage object paths stay uid-prefixed and enforced by policy; a proxy route must forward the user's own credential, never a service-role key to the browser.
- **Rule 80:** dry-run any long operator script (re-ingest, re-embed, corpus surgery) before spending GPU or provider budget.

## Decisions in force

- PD-01 no new service; stages live in `ingestion-worker`.
- PD-02 originals immutable; `sha256` + `(sha256, pipeline_version)` derivations; `view-<contentVersion>.pdf` is the precedent to generalize.
- PD-03 conversion is for visual formats only (docx/pptx/odt, LibreOffice headless, offline, hard timeout); md/txt/url/youtube stay text.
- PD-04 compression touches the viewer copy only; byte-identical extracted text is the gate.
- PD-05 serve from the same-origin route with browser-private caching; no `nginx proxy_cache`; MinIO deferred.

## Open

- Ticket not filed: D0 owns it, including the acceptance criteria.
- Whether the second corpus (`ff3ab07`'s 315-page, 2,998,611 B book) or the 572-page APM corpus is the compression benchmark: use both, report both.
- MinIO / self-hosted object storage is deferred, not rejected. It would remove the CORS range problem at the root and the egress cost, at the price of owning durability, backups, TLS and the migration of every existing material. Revisit only if the project leaves Supabase or serves more than one account.
- ClamAV and the upload size cap (D5) are real production requirements, not polish; they are the first thing to build if uploads ever open beyond the dev account.
