import { createContext, useContext, type ReactNode } from 'react'
import type { MetadataFetcher } from './metadata-fetcher'

const MetadataFetcherContext = createContext<MetadataFetcher | null>(null)

export function MetadataFetcherProvider({
  fetcher,
  children,
}: {
  fetcher: MetadataFetcher
  children: ReactNode
}) {
  return (
    <MetadataFetcherContext.Provider value={fetcher}>
      {children}
    </MetadataFetcherContext.Provider>
  )
}

export function useMetadataFetcher(): MetadataFetcher {
  const ctx = useContext(MetadataFetcherContext)
  if (!ctx) throw new Error('useMetadataFetcher must be used within MetadataFetcherProvider')
  return ctx
}
