# P6 live verification — viewer revision (issue #62, 2026-09-12)

Scope: Phase 6 of `plan/PLAN.md` — the viewer becomes one vertical scroll of page
slots with a single width source, Fit plus a zoom stepper, and jump-only page and
chapter controls. Criteria R1-R3 of `plan/VERIFICATION.md`.

Everything below was measured on the live stack (app 5173, intelligence 8000, GPU
sidecar healthy, detached ingestion worker up) against the frozen corpus material
`ACCA APM Study Text` (572 pages, 22,919,258 B), branch
`phase2/issue-62-scoped-question-generation` at `ff3ab07` + this phase.

## 1. The root cause, restated and confirmed

`renderPage` measured `frameRef.current.clientWidth` once per render and never
re-measured, and `.pdf-canvas` carried no `max-width`. The P6 code replaces both:

- one width source: a `ResizeObserver` on `.pdf-frame` feeds `containerWidth`,
  and every slot and canvas is derived from it (`displayScale` in
  `src/materials/pdfView.ts`);
- the frame is the only scroll container (`height: calc(100dvh - 15rem)`,
  vertical scroll, `overscroll-behavior: contain`), so a page never has to fit
  inside a fixed `max-height` box.

Measured in the live spec:

| Reading | Value |
|---|---|
| 1280x720, Fit | canvas 1080 px inside a 1080 px frame, bitmap 1080 px |
| 375x812, Fit | canvas 351 px inside a 351 px frame, bitmap 351 px |
| 1280 -> 375 viewport change | canvas re-fits to 351 px in the same test run |

The resize step is the one that fails on `ff3ab07`: the old code left the 1080 px
canvas in a 351 px frame, which is the reported mobile crop.

## 2. Windowing and scroll (R2)

`pdf-frame` holds one `.pdf-page` slot per page (572 slots), each sized from page
1's viewport with `aspect-ratio`, so the scroll height is stable before any ink.
The rendered set is computed from slot rects on scroll (`pagesInWindow`: on screen
plus one frame-height of margin) rather than from an `IntersectionObserver`.

Measured at 1280x720 after load: `slots 572, rendered 1` — one canvas for the whole
book. Scrolling the frame to page 2's slot moves the page readout to `2` and
rasterises page 2 (`expectRasterised`). The chapter jump to Chapter 5 scrolls to
pdf page 156 and keeps the rendered set small (`rendered < 100`).

Deviation from R-D-01, deliberate and recorded: the window is computed from slot
rects on a `requestAnimationFrame`-throttled scroll handler instead of an
`IntersectionObserver`. Same observable behaviour, and the window rule
(`pagesInWindow`) is unit-testable in jsdom, which the observer callback is not.
Prev/Next are deleted; the PAGE input and the CHAPTER select scroll to a slot.

## 3. Zoom and phone readability (R3)

Zoom levels are `Fit, 1.25x, 1.5x, 2x, 3x`; zoom re-rasterises the bitmap rather
than stretching CSS, and only the fitted state carries the `max-width: 100%`
guard, so a zoomed page is allowed to be wider than the frame and the frame
scrolls sideways.

Measured at 375 with the corpus material, sampling dark-pixel row runs on the
canvas the frame is showing (`textLineHeight` in the spec):

| State | Canvas CSS width | Bitmap width | Median text-line height |
|---|---|---|---|
| Fit | 351 px | 351 px | 8 px |
| 1.5x | 526 px | 526 px | 12 px |

So the phone starts at 0.59 px per PDF unit (8 px body text, which is what the
user reported as unreadable) and 1.5x reaches ~0.89 (12 px). The bitmap grows with
the CSS width, so the text is re-rendered sharp rather than magnified. The spec
asserts `canvasBitmapWidth(1.5x) > canvasBitmapWidth(Fit) * 1.3` and that
`aria-pressed` follows the selected level.

`MAX_RASTER_SCALE = 2.5` caps bitmap pixels per PDF unit: at 1280 Fit the raster
is exactly the CSS size (1.02 ratio on the wider pages), and a 3x zoom on a wide
desktop scales up a 2.5x raster instead of allocating a ~90 MB canvas per page.
Recorded in the code as a `ponytail:` ceiling with its upgrade path.

## 4. Defects found while making the assertions real

1. **The P5 spec's "desktop" scenario never ran at 1280.** A file-level
   `test.use({ viewport: 375 })` applies to every test in the file, so both
   scenarios ran at 375x812 and the desktop flow was never exercised at desktop
   size. The viewport is now scoped to the mobile `describe`, and the desktop
   scenario asserts something only true at 1280 (`[data-page="2"] .pdf-canvas`
   count is 0 there, 1 at 375).
2. **A cancelled render left its canvas blank for good.** The first cut cancelled
   in-flight `RenderTask`s in the effect cleanup and skipped a page whose
   `canvas.width` already matched the target; a render cancelled after the width
   was set therefore never painted again. Renders now go through one serial chain
   and are never cancelled (a superseded run finishes its current page and stops),
   and the "already drawn" marker is written only when a render resolves.
3. **Page 2 of the corpus is nearly blank.** The first scroll assertion sampled
   the top of the revealed page and timed out at 0 dark pixels: page 2 is a
   divider page (33,886 dark pixels in the whole bitmap, ~76 in the visible band).
   The spec now samples the exact visible band for "the page in front of me has
   ink" (pages 1 and 156) and the whole bitmap for "it was rasterised" (page 2).

## 5. What was run

- `pnpm --filter app exec vitest run src/materials/pdfView.test.ts` — 18 passed
  (fit scale, zoom multiplication, raster cap, page clamp, window bounds, topmost
  page). Written before `pdfView.ts` existed (red), then green.
- `pnpm --filter app typecheck` and `pnpm --filter app lint` — clean.
- `pnpm exec playwright test -c e2e/playwright.config.ts --project=app
  --reporter=list material-viewer-live.spec.ts --workers=1` — 2 passed
  (desktop 1280x720 27.1 s, mobile 375x812 11.4 s), no page errors.
- Whole app unit suite and `pnpm build`: see the P6 gate entry in
  `plan/VERIFICATION.md`.
- Not run: the user's own phone pass (the point of R3) and the P7 streaming work.

## 6. Deliberate simplifications

- **Canvases are never unmounted** when a page leaves the window; scroll height is
  held by the slot's `aspect-ratio`, so only bitmaps accumulate. At 1280 the
  rendered set grows with scrolling distance; the upgrade path (release bitmaps
  for slots more than two viewports away) is recorded in the code as a
  `ponytail:` note rather than shipped.
- **Page slots are all laid out from page 1's viewport.** The corpus has pages of
  two sizes (595 and 612 pt wide): a slot may be a few pixels narrower than its
  own page, which the fitted `max-width` absorbs. Per-page aspect ratios are the
  upgrade path if a mixed-size document ever looks wrong.
- **The zoom control is five segmented buttons**, not a `-`/`+` stepper: no state
  machine, every level one click away, and `aria-pressed` is the assertion hook.

## 7. Defect found in the user's hands-on pass: every figure image was skipped

Reported after the P6 pass: "Where are the images in the pdf, not a single image is
seen in the doc", with a console full of
`Warning: Unable to decode image "img_p104_1": "Jbig2Error: JBig2 failed to initialize"`
and `Dependent image isn't ready yet 3` for pages ~96-206.

**The material is not the corpus.** It is `grokking-algorithms-2nd-edition-2nd_compress`
(315 pages, ready), served as the repaired copy `view-2e1fbb5e-....pdf` (3,420,085 B).
Measured with pypdf: **587 JBIG2 images across 260 of its 315 pages** (`/Im0 /Im1 /Im2` on
page 104, which are the three `img_p104_1..3` in the log). The original upload carries the
same JBIG2 (590 raw `JBIG2Decode` names), so the `ff3ab07` repair is not the source. The
corpus has none (432 DCTDecode + 943 FlateDecode), which is why the P6 live spec, the
probes and every pixel measurement so far never saw the defect.

**Root cause.** pdf.js decodes JBIG2/CCITT images with a wasm module it fetches at runtime
from the `wasmUrl` directory (`getFactoryUrlProp` requires a trailing slash and the worker
fetches `${wasmUrl}jbig2.wasm`). Nothing set `wasmUrl`, so pdf.js used its default
relative `"wasm"`, resolved it against the page, got nothing, and skipped every JBIG2
image with a console warning. Text and the other image filters still painted, so the page
looked full rather than broken.

**Fix.** `apps/app/scripts/sync-pdfjs-wasm.mjs` copies `pdfjs-dist/wasm/` (1.6 MB: jbig2,
openjpeg, qcms and their no-wasm fallbacks) into `apps/app/public/pdfjs-wasm/`, which Vite
serves at the app base in dev and copies into `dist/` on build; the app's `dev` and
`build` scripts run it, and the folder is gitignored so the binaries cannot drift from the
installed pdfjs-dist version. `PdfViewer` passes
`wasmUrl: ${import.meta.env.BASE_URL}pdfjs-wasm/`. No nginx, contract or DB change.

**Verified on the user's own material** (throwaway probe, screenshot-checked):

| Reading | Value |
|---|---|
| `/study/pdfjs-wasm/jbig2.wasm`, `/study/pdfjs-wasm/openjpeg.wasm` | 200, 104,852 B / 252,032 B |
| decode warnings on pages 104, 96, 35, 26 | 0 (one per image before the fix, per the user's console) |
| page 104 ink | 65,752 dark pixels, the hash-function diagram present |
| page 96 ink | 80,456 dark pixels, the array-partitioning diagram present |

The corpus path is unaffected: it never requests the wasm (measured with the wasm requests
blocked, pages 104/101/49 pixels identical to the unblocked run, 0 warnings).

**Guard.** `e2e/material-viewer-live.spec.ts` now fails on any `Unable to decode image`
console warning. Ink sampling cannot see a page that lost only its artwork, since the page
keeps its text and its other images, which is exactly how this hid. The spec still runs on
the corpus, so the guard is armed for the class rather than for the Grokking book.

**Recorded, not fixed:** the corpus is a poor regression fixture for image rendering (zero
JBIG2). A second ready material with JBIG2 figures would make the spec's image path real -
a `retrieval-followups-2nd-corpus`-shaped decision, not a P6 one.
