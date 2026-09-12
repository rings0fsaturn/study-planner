import { useCallback, useEffect, useRef, useState } from 'react'
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
  type SlotRect,
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
 * single source of the frame width, every slot is laid out from page 1's
 * viewport so the scroll height is stable before any ink, and only the slots
 * around the viewport are rasterised. The page/chapter controls jump the
 * scroll rather than page through it. Selecting a range hands off to the
 * assessment config (`?from=&to=`, PDF page numbers, per D-05).
 */
export function PdfViewer() {
  const { materialId } = useParams<{ materialId: string }>()
  const navigate = useNavigate()
  const client = useMaterialsClient()

  const [material, setMaterial] = useState<MaterialRecord | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [base, setBase] = useState<{ width: number; height: number } | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [rendered, setRendered] = useState<number[]>([])
  const [page, setPage] = useState(1)
  const [rangeStart, setRangeStart] = useState<number | null>(null)
  const [rangeEnd, setRangeEnd] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const frameRef = useRef<HTMLDivElement>(null)
  const slotRefs = useRef(new Map<number, HTMLDivElement>())
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>())
  /** page -> bitmap width of its last completed render. */
  const drawnRef = useRef(new Map<number, number>())
  /** Serialises rasterisation: pdf.js allows one render per canvas at a time. */
  const chainRef = useRef<Promise<void>>(Promise.resolve())

  const numPages = doc?.numPages ?? 0

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
      return pdfjs.getDocument({ url })
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

  // One width source. The old viewer measured the frame once, so a resize or an
  // orientation change left a bitmap wider than the frame forever (the reported
  // mobile crop) - this is the fix for that class.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const measure = () => setContainerWidth(frame.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [material])

  const measureScroll = useCallback(() => {
    const frame = frameRef.current
    // No width yet means the slots are still at their natural size; measuring
    // then would render the wrong window (page heights change with the width).
    if (!frame || !numPages || !containerWidth) return
    const frameTop = frame.getBoundingClientRect().top
    const rects: SlotRect[] = []
    for (const [pageNumber, slot] of slotRefs.current) {
      const rect = slot.getBoundingClientRect()
      rects.push({ page: pageNumber, top: rect.top - frameTop, bottom: rect.bottom - frameTop })
    }
    rects.sort((a, b) => a.page - b.page)
    const inWindow = pagesInWindow(rects, 0, frame.clientHeight)
    setRendered((previous) => (samePages(previous, inWindow) ? previous : inWindow))
    setPage((previous) => {
      const next = pageAtTop(rects, 0, numPages)
      return next === previous ? previous : next
    })
  }, [containerWidth, numPages])

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

  // Rasterise the slots in the window, one render at a time.
  //
  // pdf.js refuses a second render on a canvas that is still drawing, and a
  // render that is cancelled mid-flight can leave its canvas blank for good, so
  // every render goes through one serial chain and is never cancelled: a
  // superseded run finishes the page it is on and stops, and the run that
  // replaced it re-renders at the new raster. The second run's body only starts
  // once the first has returned, which is what makes the canvas hand-off safe.
  useEffect(() => {
    if (!doc || !base || !containerWidth) return
    const scale = displayScale(containerWidth, base.width, zoom)
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
          if (drawnRef.current.get(pageNumber) === width) continue
          canvas.width = width
          canvas.height = Math.floor(viewport.height * ratio)
          canvas.style.width = `${Math.floor(viewport.width)}px`
          canvas.style.height = `${Math.floor(viewport.height)}px`
          if (!canvas.getContext('2d')) continue
          await pdfPage
            .render({
              canvas,
              viewport,
              transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
            })
            .promise.then(
              () => drawnRef.current.set(pageNumber, width),
              () => undefined,
            )
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [base, containerWidth, doc, rendered, zoom])

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
  const scale = base ? displayScale(containerWidth, base.width, zoom) : 0
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
          {ZOOM_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              className={`btn btn-sm ${level === zoom ? 'btn-secondary' : 'btn-ghost'}`}
              aria-pressed={level === zoom}
              disabled={!doc}
              onClick={() => setZoom(level)}
            >
              {level === 1 ? 'Fit' : `${level}×`}
            </button>
          ))}
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

      <div className={`pdf-frame${zoom === 1 ? ' pdf-fit' : ''}`} ref={frameRef}>
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
              <canvas
                ref={(element) => {
                  if (element) canvasRefs.current.set(pageNumber, element)
                  else canvasRefs.current.delete(pageNumber)
                }}
                className="pdf-canvas"
                aria-label={`Rendered page ${pageNumber}`}
              />
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
