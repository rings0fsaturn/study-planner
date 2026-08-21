import { describe, expect, it, vi, type Mock } from 'vitest'
import { subscribeMaterialStatus, type MaterialStatusUpdate } from './ingestionSubscription'

interface FakeChannel {
  on: Mock<[event: string, options: unknown, callback: (payload: unknown) => void], FakeChannel>
  subscribe: Mock<[callback?: (status: string) => void], FakeChannel>
}

function makeChannel(): {
  channel: FakeChannel
  handlers: Array<(payload: {
    eventType: string
    new: Record<string, unknown>
    old?: Record<string, unknown>
  }) => void>
  statusCbs: Array<(status: string) => void>
} {
  const handlers: Array<(payload: {
    eventType: string
    new: Record<string, unknown>
    old?: Record<string, unknown>
  }) => void> = []
  const statusCbs: Array<(status: string) => void> = []
  const channel: FakeChannel = {
    on: vi.fn((_event: string, _options: unknown, callback: (payload: unknown) => void) => {
      handlers.push(callback as never)
      return channel
    }),
    subscribe: vi.fn((callback?: (status: string) => void) => {
      if (callback) statusCbs.push(callback)
      return channel
    }),
  }
  return { channel, handlers, statusCbs }
}

function makeSupabase(channel: FakeChannel) {
  return {
    channel: vi.fn((_name: string) => channel),
    removeChannel: vi.fn(),
  } as Parameters<typeof subscribeMaterialStatus>[0]
}

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'mat-1',
    user_id: 'user-a',
    title: 'A material',
    kind: 'manual',
    source: 'text',
    ingestion_state: 'pending',
    ingestion_progress: 0,
    ingestion_error: null,
    archived: false,
    content_version: 'v1',
    replaced_at: null,
    estimated_minutes: 60,
    upload_complete_at: null,
    chunk_count: 0,
    grounding_version: null,
    extracted_text_path: null,
    created_at: '2026-08-14T00:00:00Z',
    updated_at: '2026-08-14T00:00:00Z',
    ...overrides,
  }
}

describe('subscribeMaterialStatus', () => {
  it('returns a no-op unsubscribe when realtime is unavailable', () => {
    const unsubscribe = subscribeMaterialStatus(undefined, vi.fn())
    expect(unsubscribe).toBeInstanceOf(Function)
    expect(() => unsubscribe()).not.toThrow()

    const noChannel = {} as never
    const unsubscribe2 = subscribeMaterialStatus(noChannel, vi.fn())
    expect(() => unsubscribe2()).not.toThrow()
  })

  it('subscribes to materials postgres_changes on the live channel', () => {
    const { channel } = makeChannel()
    const unsubscribe = subscribeMaterialStatus(makeSupabase(channel), vi.fn())
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'materials' },
      expect.any(Function),
    )
    expect(channel.subscribe).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('maps insert and update payloads to upserts', () => {
    const { channel, handlers } = makeChannel()
    const onChange = vi.fn()
    subscribeMaterialStatus(makeSupabase(channel), onChange)

    handlers[0]({ eventType: 'INSERT', new: row({ id: 'mat-9', title: 'New one' }) })
    const first = onChange.mock.calls[0][0] as MaterialStatusUpdate
    expect(first.upserts).toHaveLength(1)
    expect(first.upserts[0].id).toBe('mat-9')
    expect(first.upserts[0].title).toBe('New one')
    expect(first.removed).toEqual([])

    handlers[0]({
      eventType: 'UPDATE',
      new: row({ id: 'mat-1', ingestion_state: 'ready' }),
    })
    const second = onChange.mock.calls[1][0] as MaterialStatusUpdate
    expect(second.upserts[0].ingestionState).toBe('ready')
  })

  it('maps delete payloads to removals using old.id', () => {
    const { channel, handlers } = makeChannel()
    const onChange = vi.fn()
    subscribeMaterialStatus(makeSupabase(channel), onChange)

    handlers[0]({ eventType: 'DELETE', old: row({ id: 'mat-5' }), new: {} })
    const update = onChange.mock.calls[0][0] as MaterialStatusUpdate
    expect(update.removed).toEqual(['mat-5'])
    expect(update.upserts).toEqual([])
  })

  it('falls back to new.id for delete payloads without old', () => {
    const { channel, handlers } = makeChannel()
    const onChange = vi.fn()
    subscribeMaterialStatus(makeSupabase(channel), onChange)

    handlers[0]({ eventType: 'DELETE', new: row({ id: 'mat-7' }) })
    const update = onChange.mock.calls[0][0] as MaterialStatusUpdate
    expect(update.removed).toEqual(['mat-7'])
  })

  it('ignores payloads without a new row or id', () => {
    const { channel, handlers } = makeChannel()
    const onChange = vi.fn()
    subscribeMaterialStatus(makeSupabase(channel), onChange)

    handlers[0]({ eventType: 'UPDATE', new: {} })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('forwards subscription status changes', () => {
    const { channel, statusCbs } = makeChannel()
    const onStatus = vi.fn()
    subscribeMaterialStatus(makeSupabase(channel), vi.fn(), onStatus)

    statusCbs[0]('SUBSCRIBED')
    statusCbs[0]('CHANNEL_ERROR')
    expect(onStatus.mock.calls.map((call) => call[0])).toEqual([
      'SUBSCRIBED',
      'CHANNEL_ERROR',
    ])
  })

  it('removes the channel on unsubscribe', () => {
    const { channel } = makeChannel()
    const removeChannel = vi.fn()
    const unsubscribe = subscribeMaterialStatus(
      { ...makeSupabase(channel), removeChannel } as never,
      vi.fn(),
    )

    unsubscribe()
    expect(removeChannel).toHaveBeenCalledWith(channel)
  })
})
