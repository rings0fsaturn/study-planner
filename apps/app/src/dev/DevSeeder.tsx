import { useEffect, useRef } from 'react'
import { useEventStoreContext } from '../events/EventStoreProvider'
import { useOptionalSyncContext } from '../sync/SyncProvider'
import { logger } from '../lib/logger'
import { seedTestData, wipeTestData } from './seedTestData'
import { buildSynthHistory, type ArchetypeParams } from './synthSeed'

declare global {
  interface Window {
    __seed: () => Promise<void>
    __wipe: () => Promise<void>
    __seedSynth: (
      archetype: ArchetypeParams['key'],
      materialIds: string[],
      startDate: string,
    ) => Promise<void>
    __wipeSynth: () => Promise<void>
  }
}

export function DevSeeder() {
  const { eventStore, ready } = useEventStoreContext()
  // Ref, not dep: SyncContext value is a fresh literal per provider render, so
  // depending on it would re-register window hooks on every syncState tick
  // (including ticks the seed loop itself causes). The ref always reads the
  // latest engine; an in-flight loop keeps its captured sync object, which is
  // safe because logEvent resolves the engine at call time.
  const sync = useOptionalSyncContext()
  const syncRef = useRef(sync)
  syncRef.current = sync

  useEffect(() => {
    if (!ready || !eventStore) return

    window.__seed = async () => {
      await seedTestData(eventStore)
    }
    window.__wipe = async () => {
      await wipeTestData(eventStore)
    }
    window.__seedSynth = async (archetype, materialIds, startDate) => {
      try {
        const events = buildSynthHistory(archetype, materialIds, startDate)
        // N ~50: sequential logEvent is intentional (order + createdAt
        // preserved; flush debounce coalesces network). Unavailable while
        // SyncProvider BootScreen-gates initial restore; logged-out falls back
        // to local-only bulkAppend (pre-fix behavior).
        const sync = syncRef.current
        if (sync) {
          for (const event of events) {
            await sync.logEvent(event.kind, event.payload, event.createdAt)
          }
        } else {
          await eventStore.bulkAppend(events)
        }
        logger.info(`[dev] Seeded synth history for ${archetype}: ${events.length} events.`)
      } catch (error) {
        logger.error('[dev] __seedSynth failed:', error)
        throw error
      }
    }
    window.__wipeSynth = async () => {
      await wipeTestData(eventStore)
      // DEV-only queue drain: wipe() clears events but not sync_queue, so
      // without this a wipe-then-reseed (or wipe-before-flush) would push
      // wiped events to cloud. Checkpoint (sync_meta) intentionally kept.
      await eventStore.table('sync_queue').clear()
    }

    logger.info(
      '[dev] Seed commands available:\n' +
        '  __seed()  - generate demo data (2 past + 1 active roadmap)\n' +
        '  __wipe()  - clear all events\n' +
        '  __seedSynth(archetype, materialIds, startDate) - append synthetic archetype history\n' +
        '  __wipeSynth()  - clear all events',
    )

    return () => {
      delete (window as Partial<Window>).__seed
      delete (window as Partial<Window>).__wipe
      delete (window as Partial<Window>).__seedSynth
      delete (window as Partial<Window>).__wipeSynth
    }
  }, [eventStore, ready])

  return null
}
