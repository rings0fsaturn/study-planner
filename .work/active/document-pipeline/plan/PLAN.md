# Document Pipeline — upload → derive → compress → store → serve

_Opened: 2026-09-12 · Ticket: **not filed yet** (D0) · Parent: map #4 / spec #32 · Plan: this file · Status: planned, not started_
_Companion: #62 Phases 6-7 (`active/scoped-question-generation/plan/PLAN.md`) carry the viewer + streaming work this task consumes._

## TL;DR

Upload, storage and a processing pipeline already exist: Supabase Storage (`material-raw`) + the `materials` row + the ingestion queue + `ingestion-worker` (`docker-compose.yml:57`, the same image as `intelligence`, separate process).
This task adds the two stages that do not exist, both **inside that existing worker image**:

1. **Conversion** — docx / pptx / odt into a PDF the viewer can page through.
2. **Derivation + compression of the viewer copy** — the `view-<contentVersion>.pdf` pattern `ff3ab07` introduced becomes the general place where a document is normalized, compressed and cached.

No new service, no new queue, no storage migration. The serving half is #62 Phase 7 (same-origin range route) and is consumed here rather than duplicated.

## Why not a dedicated document-processing service

`ingestion-worker` already *is* that service: same image, separate process, poll-based queue with retry/terminal semantics, telemetry from migration 014.
A new service would mean a second queue, a second deploy, health checks, auth wiring and a duplicated copy of `ingestion/extractors.py` — four new failure modes for zero new capability.
AGENTS.md also pins the boundary that keeps Supabase access behind the existing injected clients.

## Measured facts this plan rests on (2026-09-12, trust over memory)

Composition of the frozen corpus file (`e2e/pdf/sample-textbook-572page.pdf`, byte-identical to the stored object, 22,919,258 B):

| Where the bytes are | Size | Share |
|---|---|---|
| stream data total | 21,977,489 B | 95.9% of the file |
| images (125 objects) | 20,425,874 B | 89% |
| — `/DCTDecode` (already JPEG) | 12,490,563 B | 54.5% |
| — `/FlateDecode` (lossless, decodes to 120,785,893 B of pixels) | 7,935,311 B | 34.6% |
| page content streams (text, vector, fonts) | 1,551,615 B | 6.8% |
| text layer extracted | 990,741 chars (1,001,039 B raw, 316,881 B gzipped) | — |
| whole-file `gzip -9` | 20,224,817 B (0.882) | — |

Consequences, measured not assumed:

- Re-wrapping the file is worth 12%. There is no lossless "hypercompression" of a 572-page book to KBs: text is 6.8% of it, and the text alone is 317 KB gzipped.
- The only real win in this file is the 7.94 MB of losslessly stored images (the 12.49 MB JPEG set is already the floor unless resolution is dropped). Image re-encode / downsample is a *figure-fidelity* trade, never a text one: text here is vector.
- Tooling is absent in this checkout (no `gs`, `qpdf`, `mutool`, `ocr-mypdf`, `pikepdf`; `Pillow` missing, `pypdf 6.16` present), so any compressor is an install plus a pipeline stage — which is why it belongs in the worker image and not in the app.

Measured cost of the viewer path today (#62 Phase 7 baseline, throwaway probe `e2e/tmp-viewer-timings.spec.ts`):

| Phase | ms |
|---|---|
| click → route painted | 26 |
| material record in hand (Supabase REST round trips) | 1,884 |
| signed-URL POST | 278 |
| PDF body GET (22,922,615 B, one plain GET) | 4,283 |
| pdf.js parse + `numPages` | 6,749 |
| first ink | 6,761 |

The PDF response is range-capable at the server (`accept-ranges: bytes`, `content-length`) — the gap is header visibility through Storage CORS, not server support. And `ff3ab07`'s own numbers matter here: the current `normalize()` clone **inflates** (2,998,611 B source → 3,420,085 B viewer copy), so a compression pass on the derived copy is a genuine regression to recover, not an optimization of something already optimal.

## Decisions

- **PD-01 — No new service.** Conversion and compression are stages in `ingestion-worker`. New stages are added to `extract_material` / the worker's existing transition machine, not to a new container.
- **PD-02 — Originals are immutable.** The uploaded bytes are the source of truth forever. Compute `sha256` at upload; every derivation is recorded against `(sha256, pipeline_version)` so reprocessing is idempotent, re-runnable and auditable. `view-<contentVersion>.pdf` (`ff3ab07`) is the precedent to generalize into an explicit derivation record.
- **PD-03 — Convert only what has pages.** docx/pptx/odt → PDF via LibreOffice headless in the worker image, run with no network and a hard per-file timeout. `md`, `txt`, `url`, `youtube` stay text: they already scope by content (chunks), and a synthetic PDF would carry fake page numbers that `materials.outline` / `page_count` (migrations 029/030) cannot honestly support.
- **PD-04 — Compression touches the viewer copy only.** Extraction continues to read the original, so chunks, embeddings, `page_start/page_end` (1..572) and the outline's offset never move. The derived copy must extract **byte-identical text** to the original; that assertion is the gate. This is what makes compression safe here, and it is why the earlier "compressing invalidates the frozen baseline" objection does not apply to this design.
- **PD-05 — Serve from the same-origin route, cache in the browser.** No `nginx proxy_cache`: a cached body would be served without Storage's ownership check, and the uid-prefixed path alone is not an authorization. The cache tier is the browser's private HTTP cache via `Cache-Control: private, max-age=…` on a stable URL. MinIO stays deferred (see Open).

## Phases

### D0 — Ticket + spec `⏳ Next`
1. Spec `specs/phase2-tickets/19-document-pipeline.md` (ACs, out-of-scope, the measured ceilings above).
2. File the GitHub issue on the #33-#49 spine, claim it, cut the branch off the then-current tip.
**Verification:** spec filed, ticket numbered, branch named in this header.

### D1 — Derivation record + content hash `⏳ Planned`
1. `sha256` of the uploaded bytes at upload time; persist on `materials` (new column, migration 031 — 029/030 are applied and never re-run).
2. Derivation record: `materials.derived` jsonb or a `material_derivations` table — `kind` (viewer_pdf, converted_pdf, fulltext), `pipeline_version`, `bytes`, `storage_path`, `status`. `view-<contentVersion>.pdf` becomes `kind=viewer_pdf`.
3. Reprocess = compare `(sha256, pipeline_version)`; skip when equal.
**Verification:** unit tests for skip/rerun; a live re-ingest proves an unchanged file is not reconverted.

### D2 — Conversion stage (docx / pptx / odt) `⏳ Planned`
1. `libreoffice --headless --convert-to pdf` in `services/intelligence/Dockerfile`; invoked from one branch in `extract_material`, after **MIME sniffing the bytes** (never the extension).
2. Converted PDF becomes the extraction source **and** the viewer source; `page_count`/`outline` are derived from it (never from the docx).
3. Hard timeout and a terminal `validation_failed` when LibreOffice fails; no retry loop on a malformed file.
**Verification:** fixture docx/pptx/odt in the service test suite; one live upload end to end at 1280 and 375.

### D3 — Viewer-copy normalization + compression `⏳ Planned`
1. Extend `PypdfTextReader.normalize()`: today it only prunes repeated `/Kids` (and inflates by 14%). Add a lossless pass first (object streams / `compress_content_streams` / drop unused objects) and measure.
2. Second, optional and measured: re-encode the losslessly stored images (7.94 MB on the corpus) with Pillow — downsample toward ~150 dpi, JPEG q≈78. Figure fidelity is the trade; it must be visible in the numbers before it ships.
3. Gate: the derived copy extracts text byte-identical to the original, and its page count/order equals the original's (the `ff3ab07` page-list guarantee, asserted).
**Verification:** before/after bytes and a text-identity assertion on the real fixture; the viewer renders the compressed copy at 1280/375 including a figure page.

### D4 — Serving `⏳ Planned (consumes #62 P7)`
1. The same-origin `/material-file/` route serves derived objects first (`view-*`), original second.
2. `Cache-Control: private, max-age=…` on a stable path; ranges pass through.
**Verification:** repeat-open byte count from the browser network log; ranges observed in the proxy (206s), no `Accept-Ranges` needed from Storage.

### D5 — Production hardening `⏳ Planned`
1. Upload trust boundary: size cap and MIME sniff before storage, ClamAV sidecar once this serves more than one account.
2. Worker resource caps: bounded conversion concurrency, per-material timeout, never inside the FastAPI request path.
3. Telemetry: reuse migration 014's stage timing so "which stage is slow" is a query.
4. Dedupe: unique index on the content hash so one book is stored and converted once and referenced by N materials (the real multi-tenant win — compression is not).

## Don't build (recorded so the next session does not re-open it)

- A new document-processing microservice (the worker image already is one).
- In-house compression or an HLS-style segmented format for a PDF (byte ranges are the PDF's segments; a PDF is never re-encoded for delivery).
- Docker-volume-as-source-of-truth (ephemeral, unbacked; MinIO is the only sane self-hosted option and it is deferred).
- md/txt → PDF "for uniformity".
- Compression on the read path, or retro-fitted onto a corpus that is already chunked and embedded.
- `nginx proxy_cache` for user-owned objects (auth bypass).
- `PDFDataRangeTransport` in the app (source-verified dead end: `pdf.mjs:15534-15539` never receives `disableAutoFetch`).

## Files-touched index (expected, to be corrected on contact)

- `services/intelligence/app/ingestion/extractors.py` — conversion branch, `normalize()` compression pass, MIME sniffing.
- `services/intelligence/app/ingestion/worker.py` — the second derived upload, derivation record write.
- `services/intelligence/app/ingestion/models.py` — `ExtractedContent` derivation fields alongside `viewer_pdf`.
- `services/intelligence/Dockerfile` — LibreOffice headless (+ Pillow if D3 ships).
- `apps/app/supabase/migrations/031_*.sql` — `sha256` / derivations (D1 only; nothing for D2-D4).
- `services/intelligence/tests/` — conversion fixtures, text-identity and page-order assertions.
- ~~`docker/nginx.conf` + `apps/app/vite.config.ts` — the `/material-file/` route (shared with #62 P7).~~ **Superseded:** #62 P7 built and reverted that route (no first-open win on a non-linearised corpus; the Vercel deploy has no nginx), shipping a session document cache instead. A serving route belongs to this task if it still needs one.
