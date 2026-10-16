import { useEffect } from 'react'
import { useEventStoreContext } from '../events/EventStoreProvider'
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
        await eventStore.bulkAppend(events)
        logger.info(`[dev] Seeded synth history for ${archetype}: ${events.length} events.`)
      } catch (error) {
        logger.error('[dev] __seedSynth failed:', error)
        throw error
      }
    }
    window.__wipeSynth = async () => {
      await wipeTestData(eventStore)
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
