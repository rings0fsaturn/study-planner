import type {
  IngestionState,
  MaterialCreateInput,
  MaterialRecord,
  MaterialReplaceInput,
  MaterialServiceErrorCode,
} from './types'
import { MaterialServiceError, outlineFromRow } from './types'

interface DbRow {
  id: string
  user_id: string
  title: string
  kind: MaterialRecord['kind']
  source: string
  ingestion_state: IngestionState
  ingestion_progress: number
  ingestion_error: string | null
  archived: boolean
  content_version: string
  replaced_at: string | null
  estimated_minutes: number | null
  upload_complete_at: string | null
  chunk_count: number
  grounding_version: string | null
  extracted_text_path: string | null
  created_at: string
  updated_at: string
}

interface SelectChain {
  eq: (column: string, value: unknown) => SelectChain
  ilike: (column: string, pattern: string) => SelectChain
  in: (column: string, values: unknown[]) => SelectChain
  order: (column: string, options?: { ascending?: boolean }) => SelectChain
  limit: (count: number) => PromiseLike<{ data: DbRow[] | null; error: DbError | null }>
  maybeSingle: () => PromiseLike<{ data: DbRow | null; error: DbError | null }>
}

interface UpdateChain {
  eq: (column: string, value: unknown) => PromiseLike<{ data: unknown; error: DbError | null }>
}

interface DeleteChain {
  eq: (column: string, value: unknown) => PromiseLike<{ data: unknown; error: DbError | null }>
}

interface DbError {
  message: string
  code?: string
}

/**
 * Narrow Supabase surface the material client needs.
 * The real supabase client is structurally compatible with this shape.
 */
export interface MaterialTableLike {
  from: (table: 'materials') => {
    select: (columns: string) => SelectChain
    insert: (
      row: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: DbError | null }>
    update: (row: Record<string, unknown>) => UpdateChain
    delete: () => DeleteChain
  }
}

/** Narrow Storage surface for private material uploads. */
export interface MaterialStorageLike {
  from: (bucket: 'material-raw') => {
    upload: (
      path: string,
      file: Blob,
      options?: { upsert?: boolean },
    ) => PromiseLike<{ error: DbError | null }>
  }
}

/** Narrow RPC surface for the upload-completion and retry boundaries. */
export interface MaterialRpcLike {
  rpc: (
    fn: 'complete_material_upload' | 'retry_material_ingestion',
    args: { p_material_id: string },
  ) => PromiseLike<{ data?: unknown; error: DbError | null }>
}

/** Narrow auth surface used to build owner-scoped storage paths. */
export interface MaterialAuthLike {
  auth: {
    getSession: () => PromiseLike<{
      data: { session: { user: { id: string } } | null }
    }>
  }
}

export interface MaterialListOptions {
  includeArchived?: boolean
  status?: IngestionState | 'all'
  search?: string
}

function classifyDbError(error: DbError): MaterialServiceErrorCode {
  if (error.code === '42501') return 'unauthorized'
  if (error.code === 'PGRST116') return 'not_found'
  if (error.code === '23505') return 'conflict'
  if (error.code === '23514' || error.code === '22P02' || error.code === '22001') {
    return 'validation'
  }
  return 'unknown'
}

export function normalizeMaterialError(err: unknown): MaterialServiceError {
  if (err instanceof MaterialServiceError) return err
  if (err instanceof TypeError) {
    return new MaterialServiceError('network', 'material request failed', true)
  }
  if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
    return new MaterialServiceError('timeout', 'material request timed out', true)
  }
  if (err && typeof err === 'object' && 'message' in err) {
    const dbError = err as DbError
    const code = classifyDbError(dbError)
    const retryable = code === 'network' || code === 'timeout'
    return new MaterialServiceError(code, dbError.message || 'material request failed', retryable)
  }
  return new MaterialServiceError('unknown', 'material request failed', false)
}

/** Maps a raw Supabase row to the typed record (shared with realtime). */
export function materialRowToRecord(row: Record<string, unknown>): MaterialRecord {
  return {
    id: String(row.id),
    ownerId: String(row.user_id),
    title: String(row.title ?? ''),
    kind: row.kind as MaterialRecord['kind'],
    source: String(row.source ?? ''),
    ingestionState: row.ingestion_state as IngestionState,
    ingestionProgress: Number(row.ingestion_progress ?? 0),
    ingestionError: row.ingestion_error == null ? null : String(row.ingestion_error),
    archived: Boolean(row.archived),
    contentVersion: String(row.content_version ?? ''),
    replacedAt: row.replaced_at == null ? null : String(row.replaced_at),
    estimatedMinutes: row.estimated_minutes == null ? null : Number(row.estimated_minutes),
    uploadCompleteAt: row.upload_complete_at == null ? null : String(row.upload_complete_at),
    chunkCount: Number(row.chunk_count ?? 0),
    groundingVersion: row.grounding_version == null ? null : String(row.grounding_version),
    extractedTextPath: row.extracted_text_path == null ? null : String(row.extracted_text_path),
    outline: outlineFromRow(row.outline),
    pageCount: row.page_count == null ? null : Number(row.page_count),
    pageOffset: row.page_offset == null ? null : Number(row.page_offset),
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  }
}

function toRecord(row: DbRow): MaterialRecord {
  return materialRowToRecord(row as unknown as Record<string, unknown>)
}

/**
 * Public material client contract. Pages and hooks depend on this interface so
 * tests can inject in-memory doubles without private-member coupling.
 */
export interface MaterialClientLike {
  listMaterials(options?: MaterialListOptions): Promise<MaterialRecord[]>
  getMaterial(id: string): Promise<MaterialRecord>
  createMaterial(input: MaterialCreateInput): Promise<MaterialRecord>
  archiveMaterial(id: string): Promise<void>
  restoreMaterial(id: string): Promise<void>
  replaceMaterial(id: string, input: MaterialReplaceInput): Promise<void>
  retryIngestion(id: string): Promise<void>
  uploadMaterialFile(id: string, file: File): Promise<void>
  completeUpload(id: string): Promise<void>
  markUploadFailed(id: string, message: string): Promise<void>
  deleteMaterial(id: string): Promise<void>
}

export class MaterialClient implements MaterialClientLike {
  constructor(
    private readonly db: MaterialTableLike,
    private readonly storage?: MaterialStorageLike,
    private readonly rpc?: MaterialRpcLike,
    private readonly auth?: MaterialAuthLike,
  ) {}

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (err) {
      throw normalizeMaterialError(err)
    }
  }

  private selectChain(options: MaterialListOptions = {}) {
    let chain = this.db.from('materials').select('*')
    if (!options.includeArchived) chain = chain.eq('archived', false)
    if (options.status && options.status !== 'all') {
      chain = chain.eq('ingestion_state', options.status)
    }
    if (options.search && options.search.trim() !== '') {
      chain = chain.ilike('title', `%${options.search.trim()}%`)
    }
    return chain.order('created_at', { ascending: false })
  }

  listMaterials(options: MaterialListOptions = {}): Promise<MaterialRecord[]> {
    return this.run(async () => {
      const { data, error } = await this.selectChain(options).limit(200)
      if (error) throw normalizeMaterialError(error)
      return (data as DbRow[] | null)?.map(toRecord) ?? []
    })
  }

  getMaterial(id: string): Promise<MaterialRecord> {
    return this.run(async () => {
      const { data, error } = await this.db
        .from('materials')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw normalizeMaterialError(error)
      if (!data) throw new MaterialServiceError('not_found', 'material not found')
      return toRecord(data)
    })
  }

  createMaterial(input: MaterialCreateInput): Promise<MaterialRecord> {
    return this.run(async () => {
      const now = new Date().toISOString()
      // user_id is intentionally omitted: the RLS default auth.uid() owns the row.
      const row = {
        id: crypto.randomUUID(),
        client_id: input.clientId,
        title: input.title,
        kind: input.kind,
        source: input.source,
        ingestion_state: 'pending' as const,
        ingestion_progress: 0,
        ingestion_error: null,
        archived: false,
        content_version: crypto.randomUUID(),
        replaced_at: null,
        estimated_minutes: input.estimatedMinutes ?? null,
        upload_complete_at: null,
        chunk_count: 0,
        grounding_version: null,
        extracted_text_path: null,
        created_at: now,
        updated_at: now,
      }
      const { error } = await this.db.from('materials').insert(row)
      if (error) throw normalizeMaterialError(error)
      return toRecord({ ...row, user_id: '' } as DbRow)
    })
  }

  archiveMaterial(id: string): Promise<void> {
    return this.run(async () => {
      const { error } = await this.db
        .from('materials')
        .update({ archived: true, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw normalizeMaterialError(error)
    })
  }

  restoreMaterial(id: string): Promise<void> {
    return this.run(async () => {
      const { error } = await this.db
        .from('materials')
        .update({ archived: false, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw normalizeMaterialError(error)
    })
  }

  /**
   * Replace keeps the material id, resets ingestion to pending, and bumps
   * content_version so dependent generated content is recognizable as stale.
   */
  replaceMaterial(id: string, input: MaterialReplaceInput): Promise<void> {
    return this.run(async () => {
      const { error } = await this.db
        .from('materials')
        .update({
          title: input.title,
          kind: input.kind,
          source: input.source,
          estimated_minutes: input.estimatedMinutes ?? null,
          ingestion_state: 'pending',
          ingestion_progress: 0,
          ingestion_error: null,
          content_version: crypto.randomUUID(),
          replaced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw normalizeMaterialError(error)
    })
  }

  /**
   * Retries a failed material through the DB-atomic retry RPC: the RPC locks
   * the material row, is a no-op while an attempt is already in flight, and
   * otherwise creates the next attempt + queue message in one transaction.
   */
  retryIngestion(id: string): Promise<void> {
    return this.run(async () => {
      if (!this.rpc) {
        throw new MaterialServiceError('unknown', 'material retry is not configured')
      }
      const { error } = await this.rpc.rpc('retry_material_ingestion', { p_material_id: id })
      if (error) throw normalizeMaterialError(error)
    })
  }

  /**
   * Uploads the source file to private Storage at
   * `material-raw/<userId>/<materialId>/<fileName>` (the bucket is already
   * selected by `from('material-raw')`; the path is the object name inside
   * it). Ingestion stays pending until `completeUpload` marks the upload done.
   */
  uploadMaterialFile(id: string, file: File): Promise<void> {
    return this.run(async () => {
      if (!this.storage || !this.auth) {
        throw new MaterialServiceError('unknown', 'material upload is not configured')
      }
      const { data } = await this.auth.auth.getSession()
      const userId = data.session?.user?.id
      if (!userId) throw new MaterialServiceError('unauthorized', 'no active session', false)
      const path = `${userId}/${id}/${file.name}`
      const { error } = await this.storage.from('material-raw').upload(path, file, { upsert: true })
      if (error) throw normalizeMaterialError(error)
    })
  }

  /** Marks the private upload complete; the enqueue trigger starts ingestion. */
  completeUpload(id: string): Promise<void> {
    return this.run(async () => {
      if (!this.rpc) throw new MaterialServiceError('unknown', 'material upload is not configured')
      const { error } = await this.rpc.rpc('complete_material_upload', { p_material_id: id })
      if (error) throw normalizeMaterialError(error)
    })
  }

  /** Records a failed upload so the detail page can offer retry. */
  markUploadFailed(id: string, message: string): Promise<void> {
    return this.run(async () => {
      const { error } = await this.db
        .from('materials')
        .update({
          ingestion_state: 'failed',
          ingestion_progress: 0,
          ingestion_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw normalizeMaterialError(error)
    })
  }

  deleteMaterial(id: string): Promise<void> {
    return this.run(async () => {
      const { error } = await this.db.from('materials').delete().eq('id', id)
      if (error) throw normalizeMaterialError(error)
    })
  }
}
