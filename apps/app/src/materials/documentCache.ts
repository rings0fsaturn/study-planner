import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentLoadingTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Without workerSrc pdf.js paints a blank canvas and only warns in the console.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const MAX_CACHED_DOCUMENTS = 2
const cache = new Map<string, Promise<PDFDocumentLoadingTask>>()

function evictOldest(): void {
  while (cache.size > MAX_CACHED_DOCUMENTS) {
    const oldest = cache.keys().next().value as string
    const task = cache.get(oldest)
    cache.delete(oldest)
    if (task) void task.then((loading) => loading.destroy())
  }
}

/**
 * The pdf.js document for a material, shared by the viewer and the
 * prefetch-on-intent on the material detail page. A repeat open adopts the
 * in-flight or loaded task instead of downloading and parsing again (the
 * measured open was 6.8 s, almost all of it one 22.9 MB fetch), and a two-entry
 * LRU keeps the worker memory bounded.
 */
export function loadMaterialDocument(
  getUrl: () => Promise<string>,
  materialId: string,
): Promise<PDFDocumentLoadingTask> {
  const cached = cache.get(materialId)
  if (cached) {
    // Refresh insertion order so the most recently used document survives.
    cache.delete(materialId)
    cache.set(materialId, cached)
    return cached
  }
  const task = (async () => {
    const url = await getUrl()
    return pdfjs.getDocument({
      url,
      // Default streaming is kept deliberately. Range-only mode was measured
      // (disableStream + disableAutoFetch) and is *worse* on this corpus: the
      // 572-page APM PDF is not linearised, so pdf.js needs most of the file
      // and issues 134 64 KB range requests, first ink 15.8 s against 6.8 s for
      // one streamed GET. A same-origin range route was built and also dropped:
      // it served 206s but did not move first ink, and the production deploy is
      // Vercel static (no nginx), so the route would have broken the deployed
      // viewer. The measured win is this cache: a repeat open drops from one
      // 22.9 MB GET to no PDF fetch at all.
      // The jbig2/openjpeg/qcms decoders, fetched by the worker at runtime
      // (scripts/sync-pdfjs-wasm.mjs copies them into public/). Without this
      // every JBIG2 image fails with "JBig2 failed to initialize" and the page
      // silently loses its figures.
      wasmUrl: `${import.meta.env.BASE_URL}pdfjs-wasm/`,
    })
  })()
  cache.set(materialId, task)
  // A failed load must not be cached, or every retry adopts the rejection.
  void task.catch(() => {
    if (cache.get(materialId) === task) cache.delete(materialId)
  })
  evictOldest()
  return task
}
