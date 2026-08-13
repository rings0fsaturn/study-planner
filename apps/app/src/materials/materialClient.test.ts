import { describe, expect, it, vi } from 'vitest'
import { MaterialClient, type MaterialTableLike } from './materialClient'
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

  it('resets a failed material to pending on retry', async () => {
    const fake = fakeDb()
    const client = new MaterialClient(fake.db)

    await client.retryIngestion('mat-1')

    const update = fake.calls[0].args[0] as Record<string, unknown>
    expect(update).toMatchObject({
      ingestion_state: 'pending',
      ingestion_progress: 0,
      ingestion_error: null,
    })
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
})
