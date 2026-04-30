import type { MetadataFetcher, MetadataResult } from './metadata-fetcher'

export class FakeMetadataFetcher implements MetadataFetcher {
  private responses = new Map<string, MetadataResult>()
  private delayMs = 0

  setResponse(url: string, result: MetadataResult): void {
    this.responses.set(url, result)
  }

  setDelay(ms: number): void {
    this.delayMs = ms
  }

  async fetchMetadata(url: string): Promise<MetadataResult> {
    if (this.delayMs > 0) {
      await new Promise(r => setTimeout(r, this.delayMs))
    }
    return this.responses.get(url) ?? { type: 'error', message: 'No canned response for URL' }
  }
}
