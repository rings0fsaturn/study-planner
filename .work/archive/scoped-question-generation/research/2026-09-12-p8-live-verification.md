# P8 live verification — viewer interaction round 2 + the preview removal (2026-09-12)

Ticket #62, second revision round. Plan: `plan/PLAN.md` Phase 8 · criteria: `plan/VERIFICATION.md` R6-R8 ·
exploration: `research/2026-09-12-p8-exploration.md`. Every number below is a measurement, not an estimate.

## 0. What was asked, and the state before it

User report (screenshot attached), 2026-09-12:

> 1. The extracted content makes no sense, within /study/materials when i view a material … Remove that section itself
> 2. Viewing the pdf, the height feels very limited, make it the height of a A4, so that complete pdf page is
>    visible, also make the pdf interactable, zoom in, drag the page, highlight etc.

Before P8 the viewer opened fit-to-width in a 480 px frame: at 1280x720 that showed 480 of a 1545 px page, i.e.
31% of one page. Two follow-up corrections from the user during the session shaped the gesture contract
(§4) and are the reason the final behaviour is what it is.

## 1. The extracted-content removal (commit `7bd2f6d`)

The card rendered `fulltext.txt[:4000]`, which for a book is the cover, the foreword and the preface - exactly
what the screenshot showed. It was wired in six places and all six went: the fetch effect, the card, the
"Content preview unavailable" banner, `previewClient.ts` + its test, `MaterialContentPreview`, and
`.material-preview-text`. `MaterialDetail.test.tsx` 13/13 green; the live ingestion spec asserts the heading
and the class are absent. Net -328 lines. The service route `GET /v1/materials/{id}/content` stays (R-D-10).

## 2. Whole page, not a third of one (R6)

`pdfView.ts` gained a fit *mode*: `Page` = `min(fitWidth, fitHeight)`, `Width` = the old fit. Measured live at
1280x720, frame 1080x480:

| Mode | canvas | bitmap | note |
|---|---|---|---|
| `Page` (default) | **335x479** | 335 | four edges inside the frame; scale 0.57498 |
| `Width` | 1080x1545 | 1080 | today's behaviour, one click away |

At 375x812, frame 351x492: `Page` gives **343x492**, median body-text line **8 px**; at 1.5x **515x738** with a
**11 px** line - the bitmap grows with the CSS width, so text is re-rendered, not stretched. A 1280 → 375
`setViewportSize` re-fits to 342x484 in the same run.

## 3. The page is a reader (R7)

- **Zoom**: `Page` / `Width` buttons plus a `-` / `+` stepper over `1/1.25/1.5/2/3` with an `x N` readout
  (ctrl/cmd + wheel steps the same pure function). Zooming in re-rasterises: the spec asserts the *bitmap*
  width grows, and the ladder reads `1.25x` then back to `1x`.
- **Select**: Shift+drag selects from where the pointer went down -
  `"Valid for September 2025, December 2025, March 2026 and June"`. The assertion also pins that the
  selection does **not** contain the viewer's header copy, which is what an extend-from-top selection sweeps
  up (the user's report: "Shift + drag selects all lines from the top to current line").
- **Pan**: a plain drag moves the page **220 px** - measured both from the page's own margin and from a drag
  that starts **on a glyph**, with `window.getSelection()` empty in the second case (a drag must pan, not
  select).
- **Text layer**: one `pdfjs.TextLayer` per rendered slot, sized from the same viewport as the canvas.

## 4. The gesture contract, and the four defects found while making it real

Final contract: plain drag pans; Shift+drag selects (cursor becomes a text caret while Shift is held); the
layer is `user-select: none` otherwise; touch keeps the browser's own scrolling and pinch.

1. **A later page's text layer was 2% wider than its slot.** Slots are laid out from page 1's box, but page 1
   of the corpus is 583.255 pt wide while page 2 onward are A4 (595.22), so the library sized that page's
   layer 1102 px inside a 1080 px slot: the frame reported **22 px of horizontal overflow** at Fit for a page
   the learner could not scroll to. The canvas already had a `.pdf-fit { max-width: 100% }` guard; the layer
   now shares it.
2. **A slot that scrolled out of the window and back stayed blank.** The "already drawn" record and the
   text-layer record were keyed by *page number* while the canvas and layer elements are unmounted when a
   slot leaves `rendered`; a remounting slot found its stale record and skipped its render. Both are keyed by
   element now (WeakMap), and the spec scrolls to page 20 and back to page 1 to pin it.
3. **The pan lost the pointer stream.** With pointer capture on the frame and a browser selection gesture in
   play, the pan received the first move and then nothing (`moves: 12` on the old element-bound handler but
   18 px of the 220 px on the new path). The drag is tracked on `window` now, which also survives the pointer
   leaving the frame - normal, because a glyph-start drag leaves the page immediately.
4. **Shift+drag selected from the top of the document.** Shift+drag is the browser's *extend* gesture and its
   anchor with nothing selected is the document start. The viewer now anchors the selection under the pointer
   before the drag proceeds.

## 5. What was run

- `e2e/material-viewer-live.spec.ts` **2/2** with `--workers=1`, against the app on `:5174` (see §6):
  desktop 1280x720 and mobile 375x812, both with no page errors and no `Unable to decode image` warnings.
  Log lines: page fit 335x479 / width fit 1080x1545 / shift-drag select / pan 220 px + 220 px / 375 refit
  342x484 and 343x492 with the 1.5x bitmap at 515 px.
- `apps/app/src/materials/pdfView.test.ts` extended (mode arithmetic + `stepZoom` clamping); the whole app
  suite and `typecheck`/`lint`/`build` results are recorded in `plan/VERIFICATION.md` with the commit.
- The user's own hands-on pass confirmed drag-to-select and zoom, and reported the two gesture defects that
  §4.3/§4.4 fixed.

**Deliberately not verified here:** the assessment *generation* half of the old scenario. It duplicated
`e2e/assessment-generation-live.spec.ts` and made every viewer run depend on the queue, the service's auth
config and the GPU sidecar. In this session it also could not run cleanly: the sibling worktree owns port
8000, and an ad-hoc service instance on 8001 answers `POST /v1/assessments/generate` with
`500 {"detail":"auth not configured"}` because the managed launcher injects that config. The viewer spec now
ends at the range handoff (`?from=156&to=213` with both inputs holding the values and Generate enabled).

## 6. Environment: a second worktree owns the default ports

`../study-planner-web-issue-63` (a sibling checkout, actively being worked) holds **5173** (Vite) and
**8000** (uvicorn), so `./full-app` refused to start this checkout's stack and the first live runs in this
session silently exercised *that* worktree's app - they are invalid and were discarded. This checkout's app
now runs on **5174** and its intelligence service on **8001**, and:

- the spec takes `E2E_APP_URL` (default unchanged: `http://localhost:5173`);
- the ad-hoc service needs `CORS_ORIGINS=http://localhost:5173,http://localhost:5174`, or every request from
  :5174 fails its preflight with 400;
- Vite on `/mnt/d` served a stale `PdfViewer` module more than once (no dev logs, old rendering): restart
  `vite` after a frontend edit and check the served module, per the recorded WSL rule.

## 7. Deliberate simplifications (ponytail)

- The text layer's stylesheet is ~25 lines copied from the library's `.textLayer` block instead of importing
  `web/pdf_viewer.css` (163,832 B, which also drags the annotation-editor theme in). Adopt the library
  stylesheet if pdf.js renames its CSS variables.
- Pinch-to-zoom is not implemented: our zoom re-renders the bitmap rather than stretching CSS, so pinch needs
  two-pointer tracking and a gesture origin, while the browser's own pinch already zooms the viewport.
- Persisted highlights are out of scope (R-D-08); the text layer is what makes "highlight" true today.
