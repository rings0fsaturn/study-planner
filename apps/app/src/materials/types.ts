export type MaterialSourceKind = 'manual' | 'url' | 'youtube' | 'file'

export type IngestionState =
  | 'pending'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'ready'
  | 'failed'

export const INGESTION_STATES: IngestionState[] = [
  'pending',
  'extracting',
  'chunking',
  'embedding',
  'ready',
]

export const INGESTION_STATE_LABELS: Record<IngestionState, string> = {
  pending: 'Pending',
  extracting: 'Extracting',
  chunking: 'Chunking',
  embedding: 'Embedding',
  ready: 'Ready',
  failed: 'Failed',
}

export const SOURCE_LABELS: Record<MaterialSourceKind, string> = {
  manual: 'Plain text',
  url: 'Web article',
  youtube: 'YouTube video',
  file: 'PDF document',
}

/** Field metadata for the source input on the create and replace flows. */
export const SOURCE_FIELDS: Record<
  MaterialSourceKind,
  { label: string; placeholder: string; textarea?: boolean }
> = {
  file: { label: 'File', placeholder: 'Choose file…' },
  url: { label: 'URL', placeholder: 'https://…' },
  youtube: { label: 'YouTube URL', placeholder: 'https://youtube.com/…' },
  manual: { label: 'Plain text', placeholder: 'Paste text here…', textarea: true },
}

export interface MaterialRecord {
  id: string
  ownerId: string
  title: string
  kind: MaterialSourceKind
  source: string
  ingestionState: IngestionState
  ingestionProgress: number
  ingestionError: string | null
  archived: boolean
  contentVersion: string
  replacedAt: string | null
  estimatedMinutes: number | null
  uploadCompleteAt: string | null
  chunkCount: number
  groundingVersion: string | null
  extractedTextPath: string | null
  createdAt: string
  updatedAt: string
}

export interface MaterialCreateInput {
  clientId: string
  title: string
  kind: MaterialSourceKind
  source: string
  estimatedMinutes?: number | null
}

export interface MaterialReplaceInput {
  title: string
  kind: MaterialSourceKind
  source: string
  estimatedMinutes?: number | null
}

/** Partial extracted content surfaced by the service while processing. */
export interface MaterialContentPreview {
  materialId: string
  state: IngestionState
  previewText: string
  chunkCount: number
  ready: boolean
  updatedAt: string
}

export type MaterialServiceErrorCode =
  | 'unauthorized'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'timeout'
  | 'network'
  | 'unknown'

export class MaterialServiceError extends Error {
  readonly code: MaterialServiceErrorCode
  readonly retryable: boolean

  constructor(code: MaterialServiceErrorCode, message: string, retryable = false) {
    super(message)
    this.name = 'MaterialServiceError'
    this.code = code
    this.retryable = retryable
  }
}

export function isReady(material: Pick<MaterialRecord, 'ingestionState'>): boolean {
  return material.ingestionState === 'ready'
}

export function isProcessing(material: Pick<MaterialRecord, 'ingestionState'>): boolean {
  return (
    material.ingestionState !== 'ready' && material.ingestionState !== 'failed'
  )
}

/** A manual (contentless) material is valid for roadmap planning. */
export function isContentless(material: Pick<MaterialRecord, 'kind' | 'source'>): boolean {
  return material.kind === 'manual' && material.source.trim() === ''
}
