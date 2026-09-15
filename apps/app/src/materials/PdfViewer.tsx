import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useMaterialsClient } from './MaterialsProvider'
import { SOURCE_LABELS, isReady, type MaterialRecord } from './types'
import {
  ZOOM_LEVELS,
  clampPage,
  displayScale,
  pageAtTop,
  pagesInWindow,
  rasterScale,
  stepZoom,
  type SlotRect,
  type ZoomMode,
} from './pdfView'
import './materials.css'

// Without workerSrc pdf.js paints a blank canvas and only warns in the console.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const samePages = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((page, index) => page === b[index])

/**
 * The material's own pages, rendered with pdf.js from a short-lived signed URL,
 * so the learner reads the page numbers they are about to scope a question to.
 *
 * Reading is one vertical scroll of page slots (P6): a `ResizeObserver` is the
 * single source of the frame's width and height, every slot is laid out from
 * page 1's viewport so the scroll height is stable before any ink, and only the
 * slots around the viewport are rasterised. The page/chapter controls jump the
 * scroll rather than page through it. Selecting a range hands off to the
 * assessment config (`?from=&to=`, PDF page numbers, per D-05).
 *
 * P8 made it a reader: the default fit mode is the whole page (`Page`), the
 * zoom stepper re-rasterises the bitmap, a mouse drag pans the frame, and every
 * rendered page carries a pdf.js text layer, so text is selectable, copyable
 * and highlighted by the browser's own selection.
 */
export function PdfViewer() {
  const { materialId } = useParams<{ materialId: string }>()
  const navigate = useNavigate()
  const client = useMaterialsClient()

  const [material, setMaterial] = useState<MaterialRecord | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [base, setBase] = useState<{ width: number; height: number } | null>(null)
  const [frame, setFrame] = useState({ width: 0, height: 0 })
  const [mode, setMode] = useState<ZoomMode>('page')
  const [textSelectable, setTextSelectable] = useState(false)
  const [zoomIndex, setZoomIndex] = useState(0)
  const [rendered, setRendered] = useState<number[]>([])
  const [page, setPage] = useState(1)
  const [rangeStart, setRangeStart] = useState<number | null>(null)
  const [rangeEnd, setRangeEnd] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const frameRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef(new Map<number, HTMLDivElement>())
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>())
  const textRefs = useRef(new Map<number, HTMLDivElement>())
  /**
   * canvas element -> bitmap width of its last completed render, and text-layer
   * element -> the scale its spans were laid out at. Both are keyed by the
   * element, not the page: a slot that scrolls out of the window unmounts its
   * children, and a page-keyed record would then skip the fresh element and
   * leave that page blank for good.
   */
  const drawnRef = useRef(new WeakMap<HTMLCanvasElement, number>())
  const textScaleRef = useRef(new WeakMap<HTMLDivElement, number>())
  /** Serialises rasterisation: pdf.js allows one render per canvas at a time. */
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  /** Tears down an in-flight drag's window listeners (see `onPointerDown`). */
  const panCleanupRef = useRef<(() => void) | null>(null)

  const numPages = doc?.numPages ?? 0
  const zoom = ZOOM_LEVELS[zoomIndex]

  useEffect(() => {
    if (!materialId) return
    let cancelled = false
    void client
      .getMaterial(materialId)
      .then((record) => {
        if (!cancelled) setMaterial(record)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load material')
      })
    return () => {
      cancelled = true
    }
  }, [client, materialId])

  // Each run owns its loading task and destroys it on cleanup; a cancelled run
  // never publishes its document (StrictMode double-invokes this effect).
  useEffect(() => {
    if (!material) return
    let cancelled = false
    let task: PDFDocumentLoadingTask | null = null
    const open = async () => {
      const url = await client.getMaterialFileUrl(material)
      if (cancelled) return null
      // The signed URL is range-capable (a browser fetch with a Range header
      // gets 206), but pdf.js cannot see `Accept-Ranges` through Supabase
      // Storage's CORS, so it falls back to one whole-file GET. Measured on the
      // 572-page corpus: 22,919,258 bytes, 4.6-7.5 s per open. An explicit
      // PDFDataRangeTransport was tried and is worse (123 requests, 30.8 MB,
      // 12.9 s): pdf.js walks the file backwards from the trailer and v6 never
      // passes `disableAutoFetch` to the transport stream. Details:
      // research/2026-09-11-p5-live-verification.md; P7 serves ranges from a
      // same-origin route instead.
      //
      // wasmUrl is the jbig2/openjpeg/qcms decoders, fetched by the worker at
      // runtime (scripts/sync-pdfjs-wasm.mjs copies them into public/). Without
      // it every JBIG2 image fails with "JBig2 failed to initialize" and the
      // page silently loses its figures.
      return pdfjs.getDocument({
        url,
        wasmUrl: `${import.meta.env.BASE_URL}pdfjs-wasm/`,
      })
    }
    void open()
      .then((started) => {
        if (!started) return null
        task = started
        return started.promise
      })
      .then(async (loaded) => {
        if (cancelled || !loaded) return
        // Page 1's viewport sizes every slot placeholder, so the scroll height
        // is correct before a single page has been rasterised.
        const first = await loaded.getPage(1)
        if (cancelled) return
        const viewport = first.getViewport({ scale: 1 })
        setBase({ width: viewport.width, height: viewport.height })
        setDoc(loaded)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not open the file')
      })
    return () => {
      cancelled = true
      const pending = task
      if (pending) void pending.destroy()
    }
  }, [client, material])

  // One measure source for both axes: the fit mode needs the height as well as
  // the width, and a resize or an orientation change must move both. The old
  // viewer measured once, so a resize left a bitmap wider than the frame
  // forever (the reported mobile crop) - this is the fix for that class.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => {
      const width = frame.clientWidth
      const height = frame.clientHeight
      setFrame((current) =>
        current.width === width && current.height === height ? current : { width, height },
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [material])

  const measureScroll = useCallback(() => {
    const node = frameRef.current
    // No width yet means the slots are still at their natural size; measuring
    // then would render the wrong window (page heights change with the width).
    if (!node || !numPages || !frame.width) return
    const frameTop = node.getBoundingClientRect().top
    const rects: SlotRect[] = []
    for (const [pageNumber, slot] of slotRefs.current) {
      const rect = slot.getBoundingClientRect()
      rects.push({ page: pageNumber, top: rect.top - frameTop, bottom: rect.bottom - frameTop })
    }
    rects.sort((a, b) => a.page - b.page)
    const inWindow = pagesInWindow(rects, 0, node.clientHeight)
    setRendered((previous) => (samePages(previous, inWindow) ? previous : inWindow))
    setPage((previous) => {
      const next = pageAtTop(rects, 0, numPages)
      return next === previous ? previous : next
    })
  }, [frame.width, numPages])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let queued = false
    const onScroll = () => {
      if (queued) return
      queued = true
      window.requestAnimationFrame(() => {
        queued = false
        measureScroll()
      })
    }
    frame.addEventListener('scroll', onScroll, { passive: true })
    measureScroll()
    return () => frame.removeEventListener('scroll', onScroll)
  }, [measureScroll])

  // ctrl/cmd + wheel steps the zoom ladder. The listener is native and
  // non-passive because React attaches `onWheel` passively at the root, and
  // without preventDefault the browser zooms the whole page instead.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || !doc) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      setZoomIndex((index) => stepZoom(index, event.deltaY < 0 ? 1 : -1))
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [doc])

  // Shift turns the text layer selectable (see onPointerDown); a plain drag pans
  // instead, so the two gestures never fight over the same pointer stream.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => setTextSelectable(event.shiftKey)
    const onBlur = () => setTextSelectable(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  // A drag interrupted by this component unmounting must not leave its window
  // listeners (and the frame they hold) behind.
  useEffect(() => () => panCleanupRef.current?.(), [])

  /** The page and chapter controls jump the scroll; they do not page the scroll. */
  const goToPage = useCallback(
    (target: number) => {
      const frame = frameRef.current
      const slot = slotRefs.current.get(target)
      setPage(target)
      if (!frame || !slot) return
      frame.scrollTop += slot.getBoundingClientRect().top - frame.getBoundingClientRect().top
      measureScroll()
    },
    [measureScroll],
  )

  /**
   * Drag the page to pan (P8). Mouse only: touch keeps the browser's own
   * scrolling and pinch. A plain drag pans wherever it starts - the gesture a
   * reader reaches for - and the text layer is left non-selectable so the
   * browser does not start a selection gesture mid-pan. Holding Shift makes the
   * layer selectable again and stands this handler down.
   *
   * The gesture is tracked on `window`, not with pointer capture: a drag that
   * leaves the frame must keep panning (a drag that starts on a glyph leaves it
   * almost immediately), and capture alone did not survive that - the pan
   * received one move, then nothing, and the frame moved 18 px of the 220.
   */
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    if (event.shiftKey) {
      // Shift+drag is the browser's *extend* gesture: with nothing selected its
      // anchor is the top of the document, so a Shift+drag selects every line
      // above the pointer. Anchor the selection under the pointer first, then
      // let the browser extend from there.
      const caret = (
        document as unknown as {
          caretRangeFromPoint?: (x: number, y: number) => Range | null
        }
      ).caretRangeFromPoint
      const range = caret?.call(document, event.clientX, event.clientY)
      const selection = window.getSelection()
      if (range && selection) {
        selection.removeAllRanges()
        selection.addRange(range)
      }
      return
    }
    const frame = frameRef.current
    if (!frame) return
    const origin = {
      x: event.clientX,
      y: event.clientY,
      left: frame.scrollLeft,
      top: frame.scrollTop,
    }
    const onMove = (move: PointerEvent) => {
      frame.scrollLeft = origin.left - (move.clientX - origin.x)
      frame.scrollTop = origin.top - (move.clientY - origin.y)
    }
    const onDone = () => {
      panCleanupRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onDone)
      window.removeEventListener('pointercancel', onDone)
    }
    panCleanupRef.current = onDone
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onDone)
    window.addEventListener('pointercancel', onDone)
  }

  // Rasterise the slots in the window, one render at a time, and lay out their
  // text layers.
  //
  // pdf.js refuses a second render on a canvas that is still drawing, and a
  // render that is cancelled mid-flight can leave its canvas blank for good, so
  // every render goes through one serial chain and is never cancelled: a
  // superseded run finishes the page it is on and stops, and the run that
  // replaced it re-renders at the new raster. The second run's body only starts
  // once the first has returned, which is what makes the canvas hand-off safe.
  useEffect(() => {
    if (!doc || !base || !frame.width) return
    const scale = displayScale(mode, frame.width, frame.height, base.width, base.height, zoom)
    const ratio = rasterScale(scale, window.devicePixelRatio || 1) / scale
    let cancelled = false
    chainRef.current = chainRef.current
      .then(async () => {
        for (const pageNumber of rendered) {
          if (cancelled) return
          const canvas = canvasRefs.current.get(pageNumber)
          if (!canvas) continue
          const pdfPage = await doc.getPage(pageNumber)
          if (cancelled) return
          const viewport = pdfPage.getViewport({ scale })
          const width = Math.floor(viewport.width * ratio)
          if (drawnRef.current.get(canvas) !== width) {
            canvas.width = width
            canvas.height = Math.floor(viewport.height * ratio)
            canvas.style.width = `${Math.floor(viewport.width)}px`
            canvas.style.height = `${Math.floor(viewport.height)}px`
            if (canvas.getContext('2d')) {
              await pdfPage
                .render({
                  canvas,
                  viewport,
                  transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
                })
                .promise.then(
                  () => drawnRef.current.set(canvas, width),
                  () => undefined,
                )
            }
          }
          const layer = textRefs.current.get(pageNumber)
          if (layer && textScaleRef.current.get(layer) !== scale) {
            // The spans are laid out in page units and sized by
            // `--total-scale-factor`, which nothing in the library ever sets
            // (its own stylesheet reads it on the page element), and the
            // container box is measured by setLayerDimensions in the same
            // units, so it has to be set before the TextLayer is constructed.
            layer.style.setProperty('--total-scale-factor', String(scale))
            layer.replaceChildren()
            await new pdfjs.TextLayer({
              textContentSource: pdfPage.streamTextContent(),
              container: layer,
              viewport,
            })
              .render()
              .then(
                () => textScaleRef.current.set(layer, scale),
                () => undefined,
              )
          }
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [base, doc, frame.height, frame.width, mode, rendered, zoom])

  if (!materialId) return null

  if (!material && !error) {
    return (
      <div className="materials-page">
        <p className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
          Loading material…
        </p>
      </div>
    )
  }

  if (!material) {
    return (
      <div className="materials-page">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/materials')}>
          ← Back to library
        </button>
        <div className="banner attention" style={{ marginTop: '1rem' }}>
          <div className="banner-body">
            <div className="banner-title">Could not open the viewer</div>
            <div className="banner-desc">{error}</div>
          </div>
        </div>
      </div>
    )
  }

  const outlineEntries = material.outline?.entries ?? []
  const selectable = rangeStart !== null && rangeEnd !== null
  const scopeStart = selectable ? Math.min(rangeStart, rangeEnd) : 0
  const scopeEnd = selectable ? Math.max(rangeStart, rangeEnd) : 0
  const scale = base ? displayScale(mode, frame.width, frame.height, base.width, base.height, zoom) : 0
  const slotWidth = base ? Math.floor(base.width * scale) : 0
  const pageNumbers = base ? Array.from({ length: numPages }, (_, index) => index + 1) : []

  return (
    <div className="materials-page">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => navigate(`/materials/${material.id}`)}
      >
        ← Back to material
      </button>
      <h1 style={{ margin: '0.5rem 0 0.25rem', font: '2rem var(--font-display)', lineHeight: 1.1 }}>
        {material.title}
      </h1>
      <p className="t-body" style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        {SOURCE_LABELS[material.kind]} · read the pages you want to be assessed on.
      </p>

      <div className="pdf-toolbar">
        <label className="pdf-field">
          <span className="mono-caps">Page</span>
          <input
            aria-label="Page"
            className="field"
            type="number"
            min={1}
            max={numPages || undefined}
            value={numPages ? page : ''}
            disabled={!doc}
            onChange={(event) => goToPage(clampPage(Number(event.target.value), numPages))}
          />
        </label>
        <span className="t-body-sm" style={{ color: 'var(--text-tertiary)' }}>
          of {numPages || '…'}
        </span>
        {outlineEntries.length > 0 && (
          <label className="pdf-field">
            <span className="mono-caps">Chapter</span>
            <select
              aria-label="Jump to chapter"
              className="field"
              value=""
              onChange={(event) => {
                const entry = outlineEntries[Number(event.target.value)]
                if (entry) goToPage(clampPage(entry.page, numPages))
              }}
            >
              <option value="">Jump to…</option>
              {outlineEntries.map((entry, index) => (
                <option key={`${entry.page}-${entry.title}`} value={index}>
                  {entry.title} (p.{entry.page})
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="pdf-zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            className={`btn btn-sm ${mode === 'page' ? 'btn-secondary' : 'btn-ghost'}`}
            aria-pressed={mode === 'page'}
            disabled={!doc}
            onClick={() => setMode('page')}
          >
            Page
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'width' ? 'btn-secondary' : 'btn-ghost'}`}
            aria-pressed={mode === 'width'}
            disabled={!doc}
            onClick={() => setMode('width')}
          >
            Width
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            aria-label="Zoom out"
            disabled={!doc || zoomIndex === 0}
            onClick={() => setZoomIndex((index) => stepZoom(index, -1))}
          >
            -
          </button>
          <span className="pdf-zoom-value" aria-live="polite">
            {zoom}×
          </span>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            aria-label="Zoom in"
            disabled={!doc || zoomIndex === ZOOM_LEVELS.length - 1}
            onClick={() => setZoomIndex((index) => stepZoom(index, 1))}
          >
            +
          </button>
        </div>
      </div>

      <div className="pdf-scope-bar">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setRangeStart(clampPage(page, numPages))}
          disabled={!doc}
        >
          Set first page
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setRangeEnd(clampPage(page, numPages))}
          disabled={!doc}
        >
          Set last page
        </button>
        <span className="t-body-sm" aria-live="polite">
          {selectable
            ? `Assess pages ${scopeStart}–${scopeEnd}`
            : rangeStart !== null
              ? `First page ${rangeStart} — set the last page`
              : rangeEnd !== null
                ? `Last page ${rangeEnd} — set the first page`
                : 'No page range selected'}
        </span>
        {selectable && (
          <>
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() =>
                navigate(`/materials/${material.id}/assessments/new?from=${scopeStart}&to=${scopeEnd}`)
              }
            >
              Assess these pages
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setRangeStart(null)
                setRangeEnd(null)
              }}
            >
              Clear
            </button>
          </>
        )}
      </div>

      {!isReady(material) && (
        <div className="banner warning" style={{ marginTop: '1rem', maxWidth: '720px' }}>
          <div className="banner-body">
            <div className="banner-title">Still processing</div>
            <div className="banner-desc">
              Questions are grounded in the extracted content, so generation needs this material to
              be ready.
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="banner attention" style={{ marginTop: '1rem', maxWidth: '720px' }}>
          <div className="banner-body">
            <div className="banner-title">Could not open the viewer</div>
            <div className="banner-desc">{error}</div>
          </div>
        </div>
      )}

      <div
        className={`pdf-frame${zoomIndex === 0 ? ' pdf-fit' : ''}`}
        ref={frameRef}
        onPointerDown={onPointerDown}
      >
        {pageNumbers.map((pageNumber) => (
          <div
            key={pageNumber}
            className="pdf-page"
            data-page={pageNumber}
            ref={(element) => {
              if (element) slotRefs.current.set(pageNumber, element)
              else slotRefs.current.delete(pageNumber)
            }}
            style={{
              width: slotWidth ? `${slotWidth}px` : undefined,
              aspectRatio: base ? `${base.width} / ${base.height}` : undefined,
            }}
          >
            {rendered.includes(pageNumber) && (
              <>
                <canvas
                  ref={(element) => {
                    if (element) canvasRefs.current.set(pageNumber, element)
                    else canvasRefs.current.delete(pageNumber)
                  }}
                  className="pdf-canvas"
                  aria-label={`Rendered page ${pageNumber}`}
                />
                <div
                  ref={(element) => {
                    if (element) textRefs.current.set(pageNumber, element)
                    else textRefs.current.delete(pageNumber)
                  }}
                  className={`pdf-text-layer${textSelectable ? ' pdf-text-selectable' : ''}`}
                />
              </>
            )}
          </div>
        ))}
        {!doc && !error && (
          <p className="t-body-sm" style={{ color: 'var(--text-tertiary)', padding: '1rem' }}>
            Opening the document…
          </p>
        )}
      </div>
    </div>
  )
}
