# P7 - viewer streaming: measured transcript (2026-09-20)

_Ticket: GitHub #62 · Phase: P7 (R4) · Branch: `project/phase-2` · Runtime: managed `./full-app full`, real Supabase account, desktop 1280x720_

## What was attempted, and what the numbers said

The plan's P7 was "same-origin range route + prefetch + session cache", with an expected first ink of about 1.0-1.5 s.

### 1. Baseline (recorded 2026-09-12, re-confirmed 2026-09-20)

`e2e/tmp-viewer-timings.spec.ts` (throwaway CDP probe), clicking "Open in viewer" on the 572-page ACCA APM material:

| Phase | ms |
|---|---|
| route + material heading rendered | 24 |
| material record in hand | 1,888 |
| signed-URL round trip | ~300 |
| PDF body GET - 22,922,615 B, one plain GET | 4,283 |
| pdf.js document parsed (`of 572`) | 6,763 |
| first ink on the canvas | 6,772 |

Response headers on the body: `accept-ranges: bytes`, `content-length: 22919258`, `cf-cache-status: MISS`, `etag`, **no `Cache-Control`**.

### 2. Same-origin range route (built, measured, then reverted)

Built `location /study/material-file/` in a new `docker/nginx.conf.template` (envsubst via the nginx image), a dev-parity `server.proxy` entry in `apps/app/vite.config.ts`, a `SUPABASE_URL` env on the compose `web` service, and a client rewrite of the Storage signed URL onto that path.

- The route **works**: pdf.js issued `206` range responses through it (66,556 B and 48,224 B chunks observed), confirming `Accept-Ranges` is visible same-origin.
- But first ink did **not** move: 6,789 ms with the route against 6,772 ms without it. The material's PDF is not linearised, so pdf.js still needs most of the file.
- Forcing range-only mode (`disableStream: true` + `disableAutoFetch: true`) was **worse**: 134 requests, 9.3 MB, first ink **15,794 ms** - each 64 KB chunk serialises a round trip. This repeats the P5 finding that an explicit range transport loses to one streamed GET on this corpus.
- The route was then **reverted**, for a second, decisive reason: the production deploy is Vercel static (`DEPLOYMENT.md`; `apps/marketing/vercel.json` rewrites `/study/*` to the app, whose `vercel.json` rewrites `/study/:path*` to `index.html`). There is no nginx in production, so an unconditional same-origin rewrite would have served HTML to pdf.js and broken the deployed viewer. Keeping the route only in Docker would have been dead complexity for a benefit the measurement did not show.

### 3. Session document cache + prefetch (shipped)

`apps/app/src/materials/documentCache.ts` (new): a module-level two-entry LRU of `Promise<PDFDocumentLoadingTask>` keyed by material id; a failed load evicts itself. `PdfViewer` adopts the cached task and no longer destroys it on unmount; `MaterialDetail`'s "Open in viewer" link warms it on `pointerenter`/`pointerdown` through a dynamic import (so pdf.js stays out of the main bundle).

Measured with the same probe on the final code:

| Phase | before | after |
|---|---|---|
| material record in hand | 1,888 ms | **897 ms** (prefetch starts it on intent) |
| pdf.js document parsed | 6,763 ms | 6,799 ms |
| first ink | 6,772 ms | 6,840 ms |
| **repeat open first ink** | **6.8 s** (one 22.9 MB GET) | **897 ms** (2 requests, 3,433 B) |

## A viewer defect found and fixed on the way

The desktop scenario of `e2e/material-viewer-live.spec.ts` failed on a clean tree at the refit assertion: `375 refit: canvas 343x496px in a 351x492px frame` (a 4px overflow), while a fresh mobile load measured 343x492. Root cause: the whole-page fit and every slot placeholder were sized from **page 1's** viewport, and this corpus mixes page sizes - page 1's CropBox is `583.255 x 834.811` while pages 2+ are `595.22 x 842`. The fit was height-limited by page 1, so an A4 page rendered 4px taller than the frame.

Fix: `largestPageBox(doc)` reads every page's viewport and the fit uses the document's largest box (measured 32 ms for 572 pages). Slots are laid out from the same box, so no page can exceed its slot. The chapter jump also landed one page low (reported 155 for 156) because `pageAtTop`'s 1px tolerance was too tight under the new slot heights; the tolerance is now 2px, with a unit case pinning it.

Final viewer spec: `e2e/material-viewer-live.spec.ts` **2/2** with `--workers=1` - `1280 page fit 332x475 / bitmap 332 in a 1080x480 frame`, `1280 width fit 1058x1514`, `375 refit 347x491 in 351x492`, `mobile page fit 340x487, line 7px | 1.5x 511x731, line 11px`, no page errors, no decode warnings.

## Deliberate simplifications

- **No same-origin route** (reverted): measured to give no first-open win on a non-linearised corpus, and would break the Vercel deployment. The range route stays a recorded upgrade path for a linearised document or a future Docker-only deploy.
- **No unit test for the cache**: `documentCache.ts` imports `pdfjs-dist`, which the viewer deliberately keeps out of the jsdom graph; the live probe and viewer spec are the checks.
- **No `PDFDataRangeTransport`**: re-measured worse again (see above).
- The throwaway probe `e2e/tmp-viewer-timings.spec.ts` was deleted in the P7 commit.

## R4 outcome

"Opening the viewer stops paying for the whole file every time" is met by the session cache: a repeat open fetches no PDF bytes (22.9 MB -> 3.4 KB) and paints in 897 ms. First open is unchanged (~6.8 s) because the corpus is not linearised; the plan's 1.0-1.5 s expectation was not achievable by the route and is recorded as falsified.
