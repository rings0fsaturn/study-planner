import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { MaterialsProvider } from './MaterialsProvider'
import { useMaterialLibrary } from './useMaterialLibrary'
import { FakeMaterialClient } from './testing/fakeMaterialClient'
import type { MaterialRecord } from './types'

interface FakeChannel {
  on: Mock<[event: string, options: unknown, callback: (payload: unknown) => void], FakeChannel>
  subscribe: Mock<[callback?: (status: string) => void], FakeChannel>
}

const { channelHandlers, channelStatusCbs } = vi.hoisted(() => ({
  channelHandlers: [] as Array<(payload: {
    eventType: string
    new: Record<string, unknown>
    old?: Record<string, unknown>
  }) => void>,
  channelStatusCbs: [] as Array<(status: string) => void>,
}))

vi.mock('../lib/supabase', () => {
  const channel: FakeChannel = {
    on: vi.fn((_event: string, _options: unknown, callback: (payload: unknown) => void) => {
      channelHandlers.push(callback as never)
      return channel
    }),
    subscribe: vi.fn((callback?: (status: string) => void) => {
      if (callback) channelStatusCbs.push(callback)
      return channel
    }),
  }
  return {
    supabase: {
      auth: { getSession: vi.fn() },
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  }
})

function material(overrides: Partial<MaterialRecord> = {}): MaterialRecord {
  return {
    id: 'mat-1',
    ownerId: 'user-a',
    title: 'A material',
    kind: 'manual',
    source: 'text',
    ingestionState: 'pending',
    ingestionProgress: 0,
    ingestionError: null,
    archived: false,
    contentVersion: 'v1',
    replacedAt: null,
    estimatedMinutes: 60,
    uploadCompleteAt: null,
    chunkCount: 0,
    groundingVersion: null,
    extractedTextPath: null,
    createdAt: '2026-08-14T00:00:00Z',
    updatedAt: '2026-08-14T00:00:00Z',
    ...overrides,
  }
}

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const record = material()
  return {
    id: record.id,
    user_id: record.ownerId,
    title: record.title,
    kind: record.kind,
    source: record.source,
    ingestion_state: record.ingestionState,
    ingestion_progress: record.ingestionProgress,
    ingestion_error: record.ingestionError,
    archived: record.archived,
    content_version: record.contentVersion,
    replaced_at: record.replacedAt,
    estimated_minutes: record.estimatedMinutes,
    upload_complete_at: record.uploadCompleteAt,
    chunk_count: record.chunkCount,
    grounding_version: record.groundingVersion,
    extracted_text_path: record.extractedTextPath,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    ...overrides,
  }
}

function pushUpdate(payload: {
  eventType: string
  new: Record<string, unknown>
  old?: Record<string, unknown>
}): void {
  act(() => {
    channelHandlers.forEach((handler) => handler(payload))
  })
}

function setStatus(status: string): void {
  act(() => {
    channelStatusCbs.forEach((callback) => callback(status))
  })
}

function renderLibrary(client: FakeMaterialClient) {
  return renderHook(() => useMaterialLibrary(), {
    wrapper: ({ children }) => (
      <MaterialsProvider client={client as never}>{children}</MaterialsProvider>
    ),
  })
}

function flushAsync(): Promise<void> {
  return act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  channelHandlers.length = 0
  channelStatusCbs.length = 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useMaterialLibrary', () => {
  it('loads the material list on mount', async () => {
    const client = new FakeMaterialClient([material({ id: 'mat-1' })])
    const { result } = renderLibrary(client)

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.materials?.map((m) => m.id)).toEqual(['mat-1'])
    expect(result.current.live).toBe(false)
  })

  it('surfaces reload errors', async () => {
    const client = new FakeMaterialClient()
    vi.spyOn(client, 'listMaterials').mockRejectedValue(new Error('boom'))
    const { result } = renderLibrary(client)

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toContain('boom')
  })

  it('appends a realtime insert to the list', async () => {
    const client = new FakeMaterialClient([material({ id: 'mat-1' })])
    const { result } = renderLibrary(client)
    await waitFor(() => expect(result.current.materials).not.toBeNull())

    pushUpdate({ eventType: 'INSERT', new: row({ id: 'mat-9', title: 'Inserted' }) })

    expect(result.current.materials?.map((m) => m.id)).toEqual(['mat-9', 'mat-1'])
  })

  it('replaces an existing row on realtime update', async () => {
    const client = new FakeMaterialClient([material({ id: 'mat-1' })])
    const { result } = renderLibrary(client)
    await waitFor(() => expect(result.current.materials).not.toBeNull())

    pushUpdate({
      eventType: 'UPDATE',
      new: row({ id: 'mat-1', ingestion_state: 'ready' }),
    })

    expect(result.current.materials?.[0].ingestionState).toBe('ready')
    expect(result.current.materials).toHaveLength(1)
  })

  it('removes a deleted row via realtime', async () => {
    const client = new FakeMaterialClient([material({ id: 'mat-1' })])
    const { result } = renderLibrary(client)
    await waitFor(() => expect(result.current.materials).not.toBeNull())

    pushUpdate({ eventType: 'DELETE', old: row({ id: 'mat-1' }), new: {} })

    expect(result.current.materials).toEqual([])
  })

  it('drops an archived row from a non-archived library on realtime update', async () => {
    const client = new FakeMaterialClient([material({ id: 'mat-1' })])
    const { result } = renderLibrary(client)
    await waitFor(() => expect(result.current.materials).not.toBeNull())

    pushUpdate({
      eventType: 'UPDATE',
      new: row({ id: 'mat-1', archived: true }),
    })

    expect(result.current.materials).toEqual([])
  })

  it('keeps an archived row when includeArchived is enabled', async () => {
    const client = new FakeMaterialClient([material({ id: 'mat-1', archived: true })])
    const { result } = renderHook(() => useMaterialLibrary({ includeArchived: true }), {
      wrapper: ({ children }) => (
        <MaterialsProvider client={client as never}>{children}</MaterialsProvider>
      ),
    })

    await waitFor(() => expect(result.current.materials).not.toBeNull())
    pushUpdate({
      eventType: 'UPDATE',
      new: row({ id: 'mat-1', archived: true, title: 'Archived but visible' }),
    })

    expect(result.current.materials?.[0].title).toBe('Archived but visible')
  })

  it('polls every 15 seconds while the channel is not subscribed', async () => {
    vi.useFakeTimers()
    const client = new FakeMaterialClient([material({ id: 'mat-1' })])
    const listSpy = vi.spyOn(client, 'listMaterials')
    const { result } = renderLibrary(client)
    await flushAsync()
    expect(result.current.status).toBe('ready')
    const initialCalls = listSpy.mock.calls.length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000)
    })

    expect(listSpy.mock.calls.length).toBe(initialCalls + 3)
  })

  it('stops polling once the channel subscribes', async () => {
    vi.useFakeTimers()
    const client = new FakeMaterialClient([material({ id: 'mat-1' })])
    const listSpy = vi.spyOn(client, 'listMaterials')
    const { result } = renderLibrary(client)
    await flushAsync()
    expect(result.current.status).toBe('ready')
    const initialCalls = listSpy.mock.calls.length

    setStatus('SUBSCRIBED')
    expect(result.current.live).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000)
    })

    expect(listSpy.mock.calls.length).toBe(initialCalls)
  })

  it('resumes polling after the channel errors', async () => {
    vi.useFakeTimers()
    const client = new FakeMaterialClient([material({ id: 'mat-1' })])
    const listSpy = vi.spyOn(client, 'listMaterials')
    const { result } = renderLibrary(client)
    await flushAsync()
    expect(result.current.status).toBe('ready')

    setStatus('SUBSCRIBED')
    expect(result.current.live).toBe(true)

    setStatus('CHANNEL_ERROR')
    expect(result.current.live).toBe(false)

    const initialCalls = listSpy.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(listSpy.mock.calls.length).toBe(initialCalls + 1)
  })
})
