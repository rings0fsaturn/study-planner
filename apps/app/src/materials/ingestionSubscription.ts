import { materialRowToRecord } from './materialClient'
import type { MaterialRecord } from './types'

export interface MaterialStatusUpdate {
  upserts: MaterialRecord[]
  removed: string[]
}

interface RealtimeChannelLike {
  on: (
    event: 'postgres_changes',
    options: Record<string, unknown>,
    callback: (payload: {
      eventType: string
      new: Record<string, unknown>
      old?: Record<string, unknown>
    }) => void,
  ) => RealtimeChannelLike
  subscribe: (callback?: (status: string) => void) => RealtimeChannelLike
}

interface SupabaseRealtimeLike {
  channel: (name: string) => RealtimeChannelLike
  removeChannel: (channel: RealtimeChannelLike) => void
}

/**
 * Subscribes to owner-scoped material row changes. Supabase Realtime applies
 * RLS, so the payloads are already scoped to the signed-in user. Returns an
 * unsubscribe function; a no-op when realtime is unavailable so callers and
 * tests without a channel survive.
 */
export function subscribeMaterialStatus(
  supabaseLike: SupabaseRealtimeLike | undefined,
  onChange: (update: MaterialStatusUpdate) => void,
  onStatus?: (status: string) => void,
): () => void {
  if (!supabaseLike || typeof supabaseLike.channel !== 'function') {
    return () => {}
  }
  const channel = supabaseLike.channel('materials-live-status')
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, (payload) => {
    if (payload.eventType === 'DELETE') {
      const id = String(payload.old?.id ?? payload.new?.id ?? '')
      if (id) onChange({ upserts: [], removed: [id] })
      return
    }
    if (payload.new && payload.new.id != null) {
      onChange({ upserts: [materialRowToRecord(payload.new)], removed: [] })
    }
  })
  channel.subscribe((status) => onStatus?.(status))
  return () => {
    supabaseLike.removeChannel(channel)
  }
}
