# P5 live verification — pdf.js viewer (#62, AC4)

_Session 2026-09-11. Branch `phase2/issue-62-scoped-question-generation` at `f23ebf0` + P5 worktree._
_Live stack: managed runtime (`./full-app restart full`), detached ingestion worker, GPU sidecar `embedder-embedder-1` on :8200._
_Corpus material: `ACCA APM Study Text` = `80c8b138-b544-4095-8dc0-1c390ac70da2`, `kind=file`, `source=sample-textbook-572page.pdf`, 572 pages, offset -33, ready._

## 1. What shipped

Three steps from the plan: `pdfjs-dist` in `apps/app` with `workerSrc` wired from
`pdfjs-dist/build/pdf.worker.min.mjs?url`; `MaterialStorageLike.createSignedUrl` plus
`MaterialClient.getMaterialFileUrl(material)`; `PdfViewer.tsx` (canvas render, page navigation, chapter
jump from `materials.outline`, range selection handing off to the config) on the new route
`/materials/:materialId/view`. Entry points: `Open in viewer` on the material detail page, and a link
from the assessment config's scope field-group.

The viewer route is lazily imported, so pdf.js stays out of the main bundle:

```
dist/assets/PdfViewer-BtjrPY8K.js          487.97 kB │ gzip: 145.87 kB
dist/assets/pdf.worker.min-Dswkl-cV.mjs  1,265.41 kB
dist/assets/index-D3uK8mbm.js            1,156.04 kB │ gzip: 342.59 kB   (unchanged, pre-existing)
```

## 2. Storage precheck (service role)

```
material: 'ACCA APM Study Text' kind=file state=ready
  source: sample-textbook-572page.pdf
  user_id: 29288e28-...  page_count: 572  page_offset: -33
list material-raw/29288e28-.../80c8b138-... -> 200
  fulltext.txt 973434 bytes
  sample-textbook-572page.pdf 22919258 bytes
sign -> 200 ; GET with Range bytes=0-1023 -> 206 (1024 bytes)  first bytes b'%PDF-'
RESULT: PASS
```

No new storage work was needed: the raw PDF is already at `<uid>/<materialId>/<fileName>` with
owner-read RLS, and the storage path is derivable from the record (`ownerId`/`id`/`source`), so the
client signs it without an extra auth round trip.

## 3. Unit checks

| Check | Result |
|---|---|
| `pnpm typecheck` (5 projects) | clean |
| `pnpm lint` | clean |
| `materialClient.test.ts` | 30 passed (+4: signed path `user-a/mat-1/<file>` with a 600 s TTL, missing file, no storage surface, signed-URL error normalised) |
| `AssessmentConfig.test.tsx` | 12 passed (+2: `?from=&to=` seeds the range and submits it without a `sectionLabel`; a handoff to a material with no `page_count` is dropped) |
| whole app suite `pnpm --filter app test` | **768 passed / 2 failed** — the documented WSL TZ pair in `src/dev/seedTestData.test.ts` (2026-07-05 vs 2026-07-06), re-run `--pool=forks` → **2/2 green** |
| `pnpm build` | both apps built; viewer and worker emit as separate chunks |

## 4. Browser pass (live, real stack)

`e2e/material-viewer-live.spec.ts` (new), `--workers=1`, `--project=app`:

```
✓ renders the PDF, jumps to a chapter, and hands a page range to the config   (21.2s)
✓ mobile: renders, jumps to a chapter and hands the range over at 375px       (11.1s)
2 passed (1.6m)
```

Both scenarios gate on real ink, not just a mounted canvas: they sample the canvas pixels and fail if
the page is blank, which is what a missing `workerSrc` produces.

Measured on the viewer at 1280 (scripted Chromium against the live stack):

| Metric | Value |
|---|---|
| Toolbar rendered after navigation | 2.58 s |
| First page painted (signed URL + fetch + render) | 6.32 s |
| Canvas | 1080 × 1545 CSS px inside a 1080 px frame (fit-to-width) |
| Dark pixels on page 1 | 1,668,600 |
| Chapter jump → page 156 repaint | 3 s poll window; ink 67,051 (a chapter opener carries less text than page 1) |
| Page 213 ink | 136,387 |
| Console/page errors | none |
| Range label after selection | `Assess pages 156–213` |

Visual check of the rendered result at 1280 (screenshot `/tmp/p5-page156.png`): the page renders
legibly inside the frame, the chapter jump lands on the Chapter 5 opener, the page input reads 156,
the toolbar reads `of 572`, and both control rows lay out on one line each with no overlap or
clipping.

The full-page screenshot at 375 (`e2e` mobile scenario) asserts the same flow with the toolbar
wrapping; the range is selected from page 156 alone (`Assess pages 156–156`).

## 5. Findings

### 5.1 The viewer pulls the whole 22.9 MB, and the plan's range-fetch assumption does not hold

The plan's step 2 says the viewer loads by signed URL "so pdf.js range-fetches instead of pulling
22.9 MB". Measured, that is not what happens.

- pdf.js issues **one plain GET with no `Range` header**: `status 200`, `content-length 22919258`,
  no `Cache-Control`. Repeated opens re-download it: pass 1 = 7,478 ms, pass 2 = 4,649 ms, both
  22,919,258 bytes.
- Root cause is CORS exposure, not missing server support. From the browser, against the same signed
  URL: `HEAD` → 200 with a **readable** `content-length` (safelisted); `Accept-Ranges` is **null**
  (not exposed). A `GET` with `Range: bytes=0-65535` → **206 with exactly 65,536 bytes**. So the
  server does range, but pdf.js's `validateRangeRequestCapabilities` reads `Accept-Ranges` off the
  first response to enable ranges and never sees it, so it stream-starts a whole-file fetch.
  `Content-Range` is likewise unreadable.
- An explicit `PDFDataRangeTransport` (`fetchPdfLength` + `fetchPdfRange`, ranges driven by
  `requestDataRange`) was implemented and measured. Ranges fire correctly (206s throughout) but it is
  **worse**: 123 requests / 30,807,072 bytes / 12,900 ms to first paint, and it keeps fetching after
  the page is idle (+589 KB in 10 s). pdf.js walks the file backwards from the trailer chunk by chunk,
  and v6 never passes `disableAutoFetch` into `PDFDataTransportStream` (`build/pdf.mjs:15537` passes
  only `disableRange`/`disableStream`), so there is no supported switch to make it on-demand.
  **Reverted**; the transport code and its helpers were deleted rather than shipped slower.

Upgrade paths, cheapest first:

1. Expose `Accept-Ranges` (and `Content-Range`) on the storage CORS response
   (`Access-Control-Expose-Headers`) for the hosted project. Zero app change: pdf.js would then
   range-fetch natively, and its capability check is the only thing blocking it today.
2. A same-origin streaming proxy endpoint in the intelligence service (`Range` passthrough) if the
   hosted CORS cannot be configured.
3. Re-visit the data-range transport only if a future pdf.js plumbs `disableAutoFetch` into the
   transport stream.

Cost as shipped: 22.9 MB and 4.6-7.5 s per viewer open on this machine, once per open (the signed URL
token changes per open, so the browser has no cache key to reuse). The viewer is correct and usable;
it is not yet cheap.

## 6. Neighbouring live paths

- `e2e/assessment-generation-live.spec.ts` (P4's spec) and `e2e/material-library-live.spec.ts` re-run
  after the `AssessmentConfig` and `MaterialDetail` changes: 3 passed, 2 failed, and both failures are
  the same live-stack flake — the app's event-store sync gate ("Still bringing things over") outlasted
  the specs' default 5 s first assertion, so `Material library` was never visible. Both pass on re-run
  (10.1 s, 10.5 s). `material-viewer-live.spec.ts` now gives that first assertion a 30 s window rather
  than re-failing on it.
- Authenticated API gate for a viewer-shaped scope (no label, pdf 156..213) via the P4 gate script:
  `POST /v1/assessments/generate` → `202` → `ready`, warnings `[]`, recipe echoed verbatim, the one
  citation (ordinal 269) lands on pages (202,202) — inside the range. Question: zero-based budgeting,
  citing "ZBB requires each cost element to be justified".

## 7. Deliberate simplifications (recorded, not defects)

- **No client-side `pdf.getOutline()`.** The plan lists "getOutline() first then materials.outline".
  Ingestion already runs that cascade server-side (bookmarks → contents page → LLM, P3) and the client
  only ever sees the result; and a material whose outline could not be derived has no `page_count`
  either (both are written together, `worker.py:426-428`), so the config offers no page range at all
  and a viewer chapter jump would have nothing to hand over. The client-side duplicate is unreachable
  on this path.
- **Canvas rendering is a plain fit-to-width scale** (capped at 2x, DPR transform when DPR ≠ 1) with
  no resize observer and no zoom control: page changes re-measure, resizes do not.
- **No signed-URL memoisation.** Reusing one URL for its 600 s TTL would let a second open hit the
  HTTP cache; it needs expiry bookkeeping, and it is moot if finding 5.1 is fixed at the source.
