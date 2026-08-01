export interface ArticleData {
  title: string
  wordCount: number | null
}

export interface ArticleExtractor {
  extract(url: string): Promise<ArticleData>
}

export class ReadabilityExtractor implements ArticleExtractor {
  async extract(url: string): Promise<ArticleData> {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'StudyTracker-Bot/1.0' },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    const html = await res.text()

    const { DOMParser } = await import('https://deno.land/x/deno_dom/deno-dom-wasm.ts')
    const doc = new DOMParser().parseFromString(html, 'text/html')
    if (!doc) throw new Error('Failed to parse HTML')

    try {
      const { Readability } = await import('npm:@mozilla/readability')
      const article = new Readability(doc).parse()

      if (article?.textContent) {
        const wordCount = article.textContent.trim().split(/\s+/).length
        return { title: article.title || extractFallbackTitle(doc, url), wordCount }
      }
    } catch {
      // Readability failed — fall through to fallback
    }

    return { title: extractFallbackTitle(doc, url), wordCount: null }
  }
}

function extractFallbackTitle(doc: { querySelector: (s: string) => { textContent?: string | null; getAttribute?: (a: string) => string | null } | null }, url: string): string {
  const ogTitle = doc.querySelector('meta[property="og:title"]')
  if (ogTitle?.getAttribute?.('content')) return ogTitle.getAttribute('content')!
  const titleEl = doc.querySelector('title')
  if (titleEl?.textContent) return titleEl.textContent
  return url
}
