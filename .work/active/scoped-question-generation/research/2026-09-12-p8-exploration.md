# P8 exploration — viewer interaction round 2 + the preview removal (2026-09-12)

Second hands-on revision of issue #62's viewer surface. Written before any code, from the live checkout, the
P5/P6 transcripts and dumps of the installed `pdfjs-dist@6.3.289`. Nothing here is a guess: every number is
either a P5/P6 measurement or was read this session, and the source of each is named.

## What was reported

1. **The material detail page's "Extracted content" card is meaningless.** The screenshot shows the card
   holding `Aditya Y. Bhargava / Foreword by Daniel Zingaro / SECOND EDITION / The algorithms you use most
   often…` — i.e. the first 4,000 characters of the extracted text, which for a book whose opening pages are
   a cover, a foreword and a preface is exactly that. The ask is to remove the section, not to improve the
   extraction.
2. **The viewer's height is limited and it is not a reader.** "Viewing the pdf, the height feels very
   limited, make it the height of a A4, so that complete pdf page is visible, also make the pdf
   interactable, zoom in, drag the page, highlight etc."

## Measured — why 480 px of frame feels like a third of a page

| Fact | Value | Source |
|---|---|---|
| `.pdf-frame` height (desktop) | `calc(100dvh - 15rem)` → **480 px** at 1280x720 (240 px of page chrome) | `materials.css:714-723` |
| `.pdf-frame` height (≤640 px) | `calc(100dvh - 20rem)` → **492 px** at 375x812 | `materials.css:761-763` |
| Fit-to-width page, 1280x720 | canvas **1080 x 1545** CSS px in a 1080 px frame | P6 live run, `2026-09-12-p6-live-verification.md` |
| Fit-to-width page, 375x812 | canvas **351 x 497** CSS px in a 351 px frame | same |
| Median body-text line | **8 px** at a 351 px page, **12 px** at 526 px → ≈ **0.0228 x page width** | same |

So at 1280x720 the frame shows **480 / 1545 = 31%** of one page, while at 375x812 it already shows
**492 / 497 = 99%** — one page, to within 5 px. The report is a desktop report, and the phone case needs no
change.

Consequence for a whole-page fit at 1280x720: the page is `842/595` tall, so `min(1080/595, 480/842)` gives a
**339 x 480 px** page and a body-text line of **≈ 7.7 px** — the same size the phone already renders at Fit.
Zooming from there: 1.25x → 424 px wide, 1.5x → 508, 2x → 678, 3x → 1017 (a 1438 px tall page, its raster
capped at `MAX_RASTER_SCALE = 2.5`, i.e. soft by design — `pdfView.ts:18`).

## The two readings of "the height of an A4", and which is cheaper

- **(a) Fit the whole page into the existing frame** — `scale = min(fitWidth, fitHeight)`; the frame stays
  1080 x 480 and the page sits centred at 339 x 480 with all four edges visible, text small until zoom.
  The frame remains the single scroll container, so the P6 windowing, the scroll handler, the slot rects and
  the jump controls are untouched. **Smallest diff.**
- **(b) Make the frame itself page-shaped** (`aspect-ratio: 210 / 297`, height from its width) so the viewer
  is one long document scrolled by the outer page. Text stays the size it is today and the page boundary is
  visible, but at 1080 px wide the frame is 1528 px tall against a 720 px window, so the whole page is never
  visible at once — it answers the "A4 height" half and drops the "complete page is visible" half. It also
  moves the scroll source from the frame to the window, which is what the windowing is written against.

**Trap found while sketching (b):** "let the frame hug the page" (`width: fit-content`) cannot work while the
frame's own width is the fit input — `ResizeObserver` → `containerWidth` → scale → slot width → frame width
is a feedback loop. Either the frame keeps the column width, or the fit reference has to move to the frame's
parent. Recorded so the next session does not "simplify" it into that loop.

**Recommendation:** (a), exposed as the default zoom mode (`Page`), with today's fit-to-width kept one click
away as `Width` — both readings are then reachable without another rewrite, and the existing assertions keep
a meaning.

## Interactivity — cost of each item, from the installed source

### zoom in / zoom out
The ladder today is five discrete buttons (`ZOOM_LEVELS = [1, 1.25, 1.5, 2, 3]`, `pdfView.ts:10`) multiplied
into fit-to-width. Make the base a mode (`Page | Width`) and the multiplier a `− / +` stepper over the same
ladder with an `x N` readout, plus ctrl/⌘ + wheel. The arithmetic is a pure function, so it lands in
`pdfView.ts` with unit tests, the way the P6 geometry did.
**Deliberate skip:** two-finger pinch. Our zoom re-renders the bitmap rather than stretching CSS, so pinch
needs two-pointer tracking, a gesture origin and a rAF re-render — while the mobile browser's own pinch
already zooms the visual viewport. The `− / +` buttons cover a phone.

### drag the page
Pointer-drag panning of `.pdf-frame` (`pointerdown/move/up` → `scrollLeft/scrollTop`), **mouse pointers
only**, leaving `touch-action` to the browser so native touch scrolling and the browser's own pinch keep
working. `cursor: grab` when the page overflows, `grabbing` while dragging. ~25 lines, no new dependency.

### highlight
`pdfjs-dist@6.3.289` exports `TextLayer` (`node_modules/pdfjs-dist/types/src/pdf.d.ts:69`, class at
`types/src/display/text_layer.d.ts:61` with `render()`/`update()`/`cancel()`), and `page.streamTextContent()`
is an accepted `textContentSource`. One text layer per rendered slot gives selectable, copyable text and the
browser's own selection paint. Alignment requirements, read out of the installed build:

- the spans' font size is `calc(var(--text-scale-factor) * var(--font-height))` and the layer box is
  `round(down, var(--total-scale-factor) * <page px>, var(--scale-round-x))` (`web/pdf_viewer.css:647-736`,
  `build/pdf.mjs:1524-1546`);
- **nothing in the library ever sets `--total-scale-factor`** — it is only ever read
  (`build/pdf.mjs:1533/1534`, and `setLayerDimensions` reads it too), so the *embedder* must set it on the
  slot (`el.style.setProperty('--total-scale-factor', String(scale))`); `--scale-round-x/y` come with the
  library stylesheet;
- the library stylesheet is `web/pdf_viewer.css` (163,832 B) and its `.textLayer` block is what positions the
  spans and styles `::selection`; import it in the lazy viewer chunk, or mirror that one block;
- the layer is `position:absolute; inset:0`, so the slot needs `position: relative`, and the layer must be
  re-created whenever the scale changes — the same lifecycle as the canvas;
- the P6 rule "never cancel a render mid-flight" is about `RenderTask`s and the canvas hand-off; a text layer
  is a separate object and is simply thrown away with its slot;
- **both interactions can coexist** with a pointer-events split: `.pdf-text-layer { pointer-events: none }`
  plus `.pdf-text-layer span { pointer-events: auto }`. A drag that starts on a glyph selects; a drag that
  starts on the page background pans. pdf.js's `TextLayer` defines no such rule itself.

**Not in this round:** saved highlights. Nothing in the app stores an annotation, the event log has no
highlight event, and a persisted mark needs its own ticket (store, restore, UI to manage). Text layer first —
it is what makes "highlight" true in the browser sense, and it is one slot-level addition.

## The preview removal — exactly what is wired

`MaterialDetail.tsx:140-161` fetches `GET /v1/materials/{id}/content` on every open of the page and renders
the result in `.material-preview-text` (`:349-356`), with a "Content preview unavailable" banner (`:358-365`)
for the failure case. The service returns `text[:4000] + '…'` of `fulltext.txt`
(`services/intelligence/app/routers/materials.py:75-88`).

Every consumer, from a repo-wide grep: `previewClient.ts`, `previewClient.test.ts`,
`MaterialContentPreview` (`types.ts:117`), `MaterialDetail.tsx`, `MaterialDetail.test.tsx:13/19/298-306`,
`e2e/material-ingestion-live.spec.ts:128-130`, `.material-preview-text` (`materials.css:654`). Nothing else —
no contract reference, no other client, no other service caller.

**Recommendation:** delete the UI, the fetch effect, the failure banner, the client and its tests and the
dead CSS, and update the two test surfaces. Keep the service route: it is the only owner-scoped way to ask
"does this material have text yet, and how many chunks" and deleting an authenticated API is a separate,
more sensitive call. Recorded rather than done quietly.

## Open questions (answer before the phase is implemented)

- **Q1 — what "highlight" means:** (a) selectable text via a text layer, nothing stored [recommended];
  (b) highlights saved per material and restored on reopen; (c) both, (b) as its own follow-up ticket.
- **Q2 — the default zoom:** (a) `Page`, the whole A4 visible on open at ~339 px wide at 1280x720
  [recommended]; (b) keep `Width` as the default and only grow the frame.
- **Q3 — where this rides:** (a) #62 as revision round 2 (Phase 8, criteria R6–R8), the way P6/R1–R5 did
  [recommended]; (b) the viewer rides #62 and the preview deletion gets its own small issue; (c) both get
  their own new tickets on the #33–#49 spine.
