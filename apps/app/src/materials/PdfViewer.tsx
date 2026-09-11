import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useMaterialsClient } from './MaterialsProvider'
import { SOURCE_LABELS, isReady, type MaterialRecord } from './types'
import './materials.css'

// Without workerSrc pdf.js paints a blank canvas and only warns in the console.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Never upscale past 2x: a 572-page book at DPR 2 needs only so many pixels. */
const MAX_SCALE = 2

function clampPage(value: number, numPages: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(Math.max(1, Math.trunc(value)), Math.max(1, numPages))
}

/**
 * The material's own pages, rendered with pdf.js from a short-lived signed URL,
 * so the learner reads the page numbers they are about to scope a question to.
 * Selecting a range hands off to the assessment config (`?from=&to=`, PDF page
 * numbers, per D-05).
 */
export function PdfViewer() {
  const { materialId } = useParams<{ materialId: string }>()
  const navigate = useNavigate()
  const client = useMaterialsClient()

  const [material, setMaterial] = useState<MaterialRecord | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [rangeStart, setRangeStart] = useState<number | null>(null)
  const [rangeEnd, setRangeEnd] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
      // research/2026-09-11-p5-live-verification.md.
      return pdfjs.getDocument({ url })
    }
    void open()
      .then((started) => {
        if (!started) return null
        task = started
        return started.promise
      })
      .then((loaded) => {
        if (cancelled || !loaded) return
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

  const renderPage = useCallback(
    async (target: PDFDocumentProxy, pageNumber: number): Promise<RenderTask | undefined> => {
      const canvas = canvasRef.current
      if (!canvas) return undefined
      const pdfPage = await target.getPage(pageNumber)
      const base = pdfPage.getViewport({ scale: 1 })
      const available = frameRef.current?.clientWidth ?? base.width
      const scale = Math.min(MAX_SCALE, Math.max(0.25, available / base.width))
      const viewport = pdfPage.getViewport({ scale })
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.floor(viewport.width * ratio)
      canvas.height = Math.floor(viewport.height * ratio)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`
      if (!canvas.getContext('2d')) return undefined
      return pdfPage.render({
        canvas,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      })
    },
    [],
  )

  useEffect(() => {
    if (!doc) return
    let cancelled = false
    let task: RenderTask | null = null
    void renderPage(doc, page)
      .then((started) => {
        if (cancelled) {
          started?.cancel()
          return undefined
        }
        task = started ?? null
        return task?.promise
      })
      .catch((err) => {
        if (cancelled || (err instanceof Error && err.name === 'RenderingCancelledException')) {
          return
        }
        setError(err instanceof Error ? err.message : 'Could not render this page')
      })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, page, renderPage])

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
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setPage((current) => clampPage(current - 1, numPages))}
          disabled={!doc || page <= 1}
        >
          ← Previous
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setPage((current) => clampPage(current + 1, numPages))}
          disabled={!doc || page >= numPages}
        >
          Next →
        </button>
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
            onChange={(event) => setPage(clampPage(Number(event.target.value), numPages))}
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
                if (entry) setPage(clampPage(entry.page, numPages))
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
          <Link className="banner-action-btn" to={`/materials/${material.id}`}>
            Back to material
          </Link>
        </div>
      )}

      <div className="pdf-frame" ref={frameRef}>
        <canvas ref={canvasRef} className="pdf-canvas" aria-label={`Rendered page ${page}`} />
        {!doc && !error && (
          <p className="t-body-sm" style={{ color: 'var(--text-tertiary)', padding: '1rem' }}>
            Opening the document…
          </p>
        )}
      </div>
    </div>
  )
}
