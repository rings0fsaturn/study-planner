import type {
  IngestionState,
  MaterialCreateInput,
  MaterialRecord,
  MaterialReplaceInput,
  MaterialServiceErrorCode,
} from './types'
import { MaterialServiceError } from './types'

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

function toRecord(row: DbRow): MaterialRecord {
  return {
    id: row.id,
    ownerId: row.user_id,
    title: row.title,
    kind: row.kind,
    source: row.source,
    ingestionState: row.ingestion_state,
    ingestionProgress: row.ingestion_progress,
    ingestionError: row.ingestion_error,
    archived: row.archived,
    contentVersion: row.content_version,
    replacedAt: row.replaced_at,
    estimatedMinutes: row.estimated_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
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
  deleteMaterial(id: string): Promise<void>
}

export class MaterialClient implements MaterialClientLike {
  constructor(private readonly db: MaterialTableLike) {}

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
   * Marks a failed material for re-ingestion. The ingestion pipeline (#37)
   * owns the actual re-processing; the library surfaces the pending state.
   */
  retryIngestion(id: string): Promise<void> {
    return this.run(async () => {
      const { error } = await this.db
        .from('materials')
        .update({
          ingestion_state: 'pending',
          ingestion_progress: 0,
          ingestion_error: null,
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
