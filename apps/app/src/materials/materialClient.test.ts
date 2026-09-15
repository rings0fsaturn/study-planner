import { describe, expect, it, vi } from 'vitest'
import {
  MaterialClient,
  type MaterialAuthLike,
  type MaterialRpcLike,
  type MaterialStorageLike,
  type MaterialTableLike,
} from './materialClient'
import { MaterialServiceError } from './types'

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mat-1',
    user_id: 'user-a',
    title: 'Operating Systems — Three Easy Pieces',
    kind: 'file',
    source: 'ostep.pdf',
    ingestion_state: 'ready',
    ingestion_progress: 1,
    ingestion_error: null,
    archived: false,
    content_version: 'v1',
    replaced_at: null,
    estimated_minutes: 420,
    upload_complete_at: null,
    chunk_count: 0,
    grounding_version: null,
    extracted_text_path: null,
    outline: {
      entries: [
        { title: 'Chapter 1 Introduction', page: 34 },
        { title: 'Chapter 2 Performance', page: 60 },
      ],
      source: 'contents',
    },
    page_count: 572,
    page_offset: -33,
    created_at: '2026-07-15T10:00:00.000Z',
    updated_at: '2026-07-15T10:00:00.000Z',
    ...overrides,
  }
}

interface ChainMocks {
  eq: ReturnType<typeof vi.fn>
  ilike: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
}

function fakeDb() {
  const calls: Array<{ op: string; args: unknown[] }> = []
  const rows: Record<string, unknown>[] = []

  const chain: ChainMocks = {
    eq: vi.fn(),
    ilike: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(async () => ({ data: [...rows], error: null })) as unknown as ReturnType<
      typeof vi.fn
    >,
    maybeSingle: vi.fn(async () => ({ data: rows[0] ?? null, error: null })) as unknown as ReturnType<
      typeof vi.fn
    >,
  }
  chain.eq.mockReturnValue(chain)
  chain.ilike.mockReturnValue(chain)
  chain.in.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)

  const db = {
    from: vi.fn((table: string) => {
      expect(table).toBe('materials')
      return {
        select: vi.fn(() => chain),
        insert: vi.fn(async (rowValue: Record<string, unknown>) => {
          calls.push({ op: 'insert', args: [rowValue] })
          rows.push(rowValue)
          return { data: rowValue, error: null }
        }),
        update: vi.fn((rowValue: Record<string, unknown>) => {
          calls.push({ op: 'update', args: [rowValue] })
          return {
            eq: vi.fn(async () => ({ data: null, error: null })),
          }
        }),
        delete: vi.fn(() => {
          calls.push({ op: 'delete', args: [] })
          return {
            eq: vi.fn(async () => ({ data: null, error: null })),
          }
        }),
      }
    }),
  } as unknown as MaterialTableLike

  return {
    db,
    calls,
    rows,
    chain,
  }
}

describe('MaterialClient', () => {
  it('maps rows to MaterialRecord with camelCase fields', async () => {
    const { db, rows } = fakeDb()
    rows.push(row())
    const client = new MaterialClient(db)

    const materials = await client.listMaterials()

    expect(materials).toHaveLength(1)
    expect(materials[0]).toMatchObject({
      id: 'mat-1',
      ownerId: 'user-a',
      title: 'Operating Systems — Three Easy Pieces',
      kind: 'file',
      ingestionState: 'ready',
      ingestionProgress: 1,
      archived: false,
      contentVersion: 'v1',
      estimatedMinutes: 420,
    })
  })

  it('maps the outline, page count and page offset, and reads a junk outline as none', async () => {
    const fake = fakeDb()
    fake.rows.push(
      row(),
      row({ id: 'mat-2', outline: { entries: 'not a list' }, page_count: null, page_offset: null }),
    )
    const client = new MaterialClient(fake.db)

    const [mapped, junk] = await client.listMaterials()

    expect(mapped).toMatchObject({
      outline: {
        entries: [
          { title: 'Chapter 1 Introduction', page: 34 },
          { title: 'Chapter 2 Performance', page: 60 },
        ],
      },
      pageCount: 572,
      pageOffset: -33,
    })
    expect(junk.outline).toBeNull()
    expect(junk.pageCount).toBeNull()
    expect(junk.pageOffset).toBeNull()
  })

  it('applies status, search, archived, and ordering options to the query', async () => {
    const fake = fakeDb()
    fake.rows.push(row())
    const client = new MaterialClient(fake.db)

    await client.listMaterials({ status: 'failed', search: 'raft' })

    const chain = fake.chain
    expect(chain.eq).toHaveBeenCalledWith('archived', false)
    expect(chain.eq).toHaveBeenCalledWith('ingestion_state', 'failed')
    expect(chain.ilike).toHaveBeenCalledWith('title', '%raft%')
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(chain.limit).toHaveBeenCalledWith(200)
  })

  it('includes archived materials when requested', async () => {
    const fake = fakeDb()
    fake.rows.push(row())
    const client = new MaterialClient(fake.db)

    await client.listMaterials({ includeArchived: true })

    expect(fake.chain.eq).not.toHaveBeenCalledWith('archived', false)
  })

  it('returns a typed not_found error when the row is missing', async () => {
    const fake = fakeDb()
    const client = new MaterialClient(fake.db)

    await expect(client.getMaterial('missing')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('classifies ownership violations as unauthorized', async () => {
    const fake = fakeDb()
    fake.chain.limit.mockResolvedValue({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    })
    const client = new MaterialClient(fake.db)

    await expect(client.listMaterials()).rejects.toMatchObject({
      code: 'unauthorized',
      retryable: false,
    })
  })

  it('classifies abort-shaped failures as timeouts', async () => {
    const fake = fakeDb()
    fake.chain.limit.mockRejectedValue({ name: 'AbortError', message: 'aborted' })
    const client = new MaterialClient(fake.db)

    await expect(client.listMaterials()).rejects.toMatchObject({ code: 'timeout', retryable: true })
  })

  it('classifies rejected TypeError values as network errors', async () => {
    const fake = fakeDb()
    fake.chain.limit.mockRejectedValue(new TypeError('fetch failed'))
    const client = new MaterialClient(fake.db)

    await expect(client.listMaterials()).rejects.toMatchObject({ code: 'network', retryable: true })
  })

  it('classifies unknown non-Error values as unknown', async () => {
    const fake = fakeDb()
    fake.chain.limit.mockRejectedValue('boom')
    const client = new MaterialClient(fake.db)

    await expect(client.listMaterials()).rejects.toMatchObject({ code: 'unknown' })
  })

  it('creates a pending material with a content version and client id', async () => {
    const fake = fakeDb()
    const client = new MaterialClient(fake.db)

    await client.createMaterial({
      clientId: 'client-1',
      title: 'Raft paper',
      kind: 'url',
      source: 'https://raft.github.io/raft.pdf',
      estimatedMinutes: 90,
    })

    expect(fake.calls[0]).toMatchObject({ op: 'insert' })
    const inserted = fake.calls[0].args[0] as Record<string, unknown>
    expect(inserted).toMatchObject({
      client_id: 'client-1',
      title: 'Raft paper',
      kind: 'url',
      source: 'https://raft.github.io/raft.pdf',
      ingestion_state: 'pending',
      archived: false,
      estimated_minutes: 90,
    })
    expect(inserted.id).toBeTruthy()
    expect(inserted.content_version).toBeTruthy()
  })

  it('archives and restores a material', async () => {
    const fake = fakeDb()
    const client = new MaterialClient(fake.db)

    await client.archiveMaterial('mat-1')
    await client.restoreMaterial('mat-1')

    expect(fake.calls[0]).toMatchObject({ op: 'update' })
    expect((fake.calls[0].args[0] as Record<string, unknown>).archived).toBe(true)
    expect(fake.calls[1]).toMatchObject({ op: 'update' })
    expect((fake.calls[1].args[0] as Record<string, unknown>).archived).toBe(false)
  })

  it('replaces a material keeping the id and resetting ingestion to pending', async () => {
    const fake = fakeDb()
    const client = new MaterialClient(fake.db)

    await client.replaceMaterial('mat-1', {
      title: 'Raft paper (2nd ed)',
      kind: 'url',
      source: 'https://raft.github.io/',
    })

    const update = fake.calls[0].args[0] as Record<string, unknown>
    expect(update).toMatchObject({
      title: 'Raft paper (2nd ed)',
      kind: 'url',
      source: 'https://raft.github.io/',
      ingestion_state: 'pending',
      ingestion_progress: 0,
      ingestion_error: null,
    })
    expect(update.replaced_at).toBeTruthy()
    expect(update.content_version).toBeTruthy()
  })

  it('retries through the DB-atomic RPC', async () => {
    const { db } = fakeDb()
    const rpcCalls: Array<{ fn: string; args: object }> = []
    const rpc = {
      rpc: vi.fn(async (fn: string, args: object) => {
        rpcCalls.push({ fn, args })
        return { data: 'job-2', error: null }
      }),
    } as unknown as MaterialRpcLike

    const client = new MaterialClient(db, undefined, rpc)
    await client.retryIngestion('mat-1')

    expect(rpcCalls).toEqual([{ fn: 'retry_material_ingestion', args: { p_material_id: 'mat-1' } }])
    expect(db.from).not.toHaveBeenCalled()
  })

  it('rejects retry when the RPC surface is not configured', async () => {
    const { db } = fakeDb()
    const client = new MaterialClient(db)
    await expect(client.retryIngestion('mat-1')).rejects.toMatchObject({
      code: 'unknown',
    })
  })

  it('normalizes a retry RPC failure', async () => {
    const { db } = fakeDb()
    const rpc = {
      rpc: vi.fn(async () => ({ error: { message: 'server-owned columns', code: '42501' } })),
    } as unknown as MaterialRpcLike

    const client = new MaterialClient(db, undefined, rpc)
    await expect(client.retryIngestion('mat-1')).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('deletes a material by id', async () => {
    const fake = fakeDb()
    const client = new MaterialClient(fake.db)

    await client.deleteMaterial('mat-1')

    expect(fake.calls[0]).toMatchObject({ op: 'delete' })
  })

  it('keeps the typed error for pass-through callers', async () => {
    const fake = fakeDb()
    fake.chain.limit.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key', code: '23505' },
    })
    const client = new MaterialClient(fake.db)

    const promise = client.listMaterials()

    await expect(promise).rejects.toBeInstanceOf(MaterialServiceError)
    await expect(promise).rejects.toMatchObject({ code: 'conflict' })
  })

  it('isolates owner-scoped rows across account switches (RLS contract)', async () => {
    let sessionUser = 'user-a'
    const rows: Record<string, unknown>[] = []

    const makeChain = (): ChainMocks => {
      const chain: ChainMocks = {
        eq: vi.fn(),
        ilike: vi.fn(),
        in: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(async () => ({
          data: rows.filter((row) => row.user_id === sessionUser),
          error: null,
        })) as unknown as ReturnType<typeof vi.fn>,
        maybeSingle: vi.fn(async () => ({
          data: rows.find((row) => row.user_id === sessionUser) ?? null,
          error: null,
        })) as unknown as ReturnType<typeof vi.fn>,
      }
      chain.eq.mockReturnValue(chain)
      chain.ilike.mockReturnValue(chain)
      chain.in.mockReturnValue(chain)
      chain.order.mockReturnValue(chain)
      return chain
    }

    const db = {
      from: vi.fn(() => ({
        select: vi.fn(() => makeChain()),
        insert: vi.fn(async (row: Record<string, unknown>) => {
          rows.push({ ...row, user_id: sessionUser })
          return { data: null, error: null }
        }),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: null, error: null })),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    } as unknown as MaterialTableLike

    const clientA = new MaterialClient(db)
    await clientA.createMaterial({ clientId: 'c-1', title: 'A material', kind: 'manual', source: '' })
    expect((await clientA.listMaterials()).map((m) => m.title)).toEqual(['A material'])

    sessionUser = 'user-b'
    const clientB = new MaterialClient(db)
    expect(await clientB.listMaterials()).toEqual([])
    await expect(clientB.getMaterial('any-id')).rejects.toMatchObject({ code: 'not_found' })

    sessionUser = 'user-a'
    expect(await clientA.listMaterials()).toHaveLength(1)
  })

  it('uploads a file to the owner-scoped private path and completes the upload', async () => {
    const { db } = fakeDb()
    const uploads: Array<{ bucket: string; path: string; file: File; options?: object }> = []
    const rpcCalls: Array<{ fn: string; args: object }> = []
    const storage = {
      from: vi.fn((bucket: string) => {
        uploads.push({ bucket, path: '', file: new File([], 'x') })
        uploads.pop()
        return {
          upload: vi.fn(async (path: string, file: File, options?: object) => {
            uploads.push({ bucket, path, file, options })
            return { error: null }
          }),
        }
      }),
    } as unknown as MaterialStorageLike
    const rpc = {
      rpc: vi.fn(async (fn: string, args: object) => {
        rpcCalls.push({ fn, args })
        return { error: null }
      }),
    } as unknown as MaterialRpcLike
    const auth = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: 'user-a' } } },
        })),
      },
    } as unknown as MaterialAuthLike

    const client = new MaterialClient(db, storage, rpc, auth)
    const file = new File(['pdf'], 'paper.pdf', { type: 'application/pdf' })
    await client.uploadMaterialFile('mat-1', file)
    await client.completeUpload('mat-1')

    expect(uploads).toHaveLength(1)
    expect(uploads[0].bucket).toBe('material-raw')
    expect(uploads[0].path).toBe('user-a/mat-1/paper.pdf')
    expect(uploads[0].options).toEqual({ upsert: true })
    expect(rpcCalls).toEqual([{ fn: 'complete_material_upload', args: { p_material_id: 'mat-1' } }])
  })

  it('rejects the upload without an active session', async () => {
    const { db } = fakeDb()
    const client = new MaterialClient(db, {} as never, {} as never, {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null } })),
      },
    } as never)
    await expect(
      client.uploadMaterialFile('mat-1', new File(['x'], 'a.pdf')),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('signs the owner-scoped private path for the viewer', async () => {
    const { db } = fakeDb()
    const signs: Array<{ bucket: string; path: string; expiresIn: number }> = []
    const storage = {
      from: vi.fn((bucket: string) => ({
        createSignedUrl: vi.fn(async (path: string, expiresIn: number) => {
          signs.push({ bucket, path, expiresIn })
          // No ingestion viewer copy exists for this material.
          if (path.includes('/view-')) {
            return { data: null, error: { message: 'Object not found', code: '404' } }
          }
          return { data: { signedUrl: 'https://example.test/storage/v1/object/sign/x' }, error: null }
        }),
      })),
    } as unknown as MaterialStorageLike

    const client = new MaterialClient(db, storage)

    const url = await client.getMaterialFileUrl({
      id: 'mat-1',
      ownerId: 'user-a',
      source: 'sample-textbook-572page.pdf',
      contentVersion: 'cv-1',
    })

    expect(url).toBe('https://example.test/storage/v1/object/sign/x')
    expect(signs).toEqual([
      {
        bucket: 'material-raw',
        path: 'user-a/mat-1/view-cv-1.pdf',
        expiresIn: 600,
      },
      {
        bucket: 'material-raw',
        path: 'user-a/mat-1/sample-textbook-572page.pdf',
        expiresIn: 600,
      },
    ])
  })

  it('prefers the ingestion viewer copy for a PDF the viewer could not open', async () => {
    const { db } = fakeDb()
    const signs: string[] = []
    const storage = {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async (path: string) => {
          signs.push(path)
          return { data: { signedUrl: `https://example.test/${path}` }, error: null }
        }),
      })),
    } as unknown as MaterialStorageLike

    const client = new MaterialClient(db, storage)
    const url = await client.getMaterialFileUrl({
      id: 'mat-1',
      ownerId: 'user-a',
      source: 'grokking-algorithms.pdf',
      contentVersion: 'cv-2',
    })

    expect(url).toBe('https://example.test/user-a/mat-1/view-cv-2.pdf')
    expect(signs).toEqual(['user-a/mat-1/view-cv-2.pdf'])
  })

  it('reports a missing stored file instead of handing over an empty URL', async () => {
    const { db } = fakeDb()
    const storage = {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => ({ data: null, error: null })),
      })),
    } as unknown as MaterialStorageLike

    const client = new MaterialClient(db, storage)
    await expect(
      client.getMaterialFileUrl({ id: 'mat-1', ownerId: 'user-a', source: 'a.pdf', contentVersion: '' }),
    ).rejects.toMatchObject({ code: 'not_found' })
  })

  it('rejects a file URL when storage is not configured', async () => {
    const { db } = fakeDb()
    const client = new MaterialClient(db)
    await expect(
      client.getMaterialFileUrl({ id: 'mat-1', ownerId: 'user-a', source: 'a.pdf', contentVersion: '' }),
    ).rejects.toMatchObject({ code: 'unknown' })
  })

  it('normalizes a storage signing failure', async () => {
    const { db } = fakeDb()
    const storage = {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => ({
          data: null,
          error: { message: 'object not found', code: 'PGRST116' },
        })),
      })),
    } as unknown as MaterialStorageLike

    const client = new MaterialClient(db, storage)
    await expect(
      client.getMaterialFileUrl({ id: 'mat-1', ownerId: 'user-a', source: 'a.pdf', contentVersion: '' }),
    ).rejects.toMatchObject({ code: 'not_found' })
  })

  it('marks a failed upload so the detail page can offer retry', async () => {
    const fake = fakeDb()
    const client = new MaterialClient(fake.db)
    await client.markUploadFailed('mat-1', 'upload exploded')
    const [updateCall] = fake.calls.filter((call) => call.op === 'update')
    expect(updateCall.args[0]).toMatchObject({
      ingestion_state: 'failed',
      ingestion_error: 'upload exploded',
    })
  })

  it('rejects the upload when storage or auth is not configured', async () => {
    const { db } = fakeDb()
    const client = new MaterialClient(db)
    await expect(
      client.uploadMaterialFile('mat-1', new File(['x'], 'a.pdf')),
    ).rejects.toMatchObject({ code: 'unknown' })
  })

  it('normalizes a storage upload rejection', async () => {
    const { db } = fakeDb()
    const storage = {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: { message: 'quota exceeded', code: '23505' } })),
      })),
    } as unknown as MaterialStorageLike
    const auth = {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { id: 'user-a' } } },
        })),
      },
    } as unknown as MaterialAuthLike

    const client = new MaterialClient(db, storage, undefined, auth)
    await expect(
      client.uploadMaterialFile('mat-1', new File(['x'], 'a.pdf')),
    ).rejects.toMatchObject({ code: 'conflict' })
  })

  it('normalizes a completion RPC rejection', async () => {
    const { db } = fakeDb()
    const rpc = {
      rpc: vi.fn(async () => ({ error: { message: 'material not found', code: 'PGRST116' } })),
    } as unknown as MaterialRpcLike

    const client = new MaterialClient(db, undefined, rpc)
    await expect(client.completeUpload('mat-1')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('normalizes an auth getSession failure on upload', async () => {
    const { db } = fakeDb()
    const storage = {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null })),
      })),
    } as unknown as MaterialStorageLike
    const auth = {
      auth: {
        getSession: vi.fn(async () => {
          throw new TypeError('network down')
        }),
      },
    } as unknown as MaterialAuthLike

    const client = new MaterialClient(db, storage, undefined, auth)
    await expect(
      client.uploadMaterialFile('mat-1', new File(['x'], 'a.pdf')),
    ).rejects.toMatchObject({ code: 'network', retryable: true })
  })

  it('normalizes a markUploadFailed database failure', async () => {
    const fake = fakeDb()
    const client = new MaterialClient({
      from: vi.fn((table: string) => {
        expect(table).toBe('materials')
        return {
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: { message: 'row policy violated', code: '42501' } })),
          })),
        }
      }),
    } as unknown as MaterialTableLike)

    await expect(client.markUploadFailed('mat-1', 'boom')).rejects.toMatchObject({
      code: 'unauthorized',
    })
    expect(fake.calls).toEqual([])
  })
})
