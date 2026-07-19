import { useEffect } from 'react'
import { useEventStoreContext } from '../events/EventStoreProvider'
import { seedTestData, wipeTestData } from './seedTestData'

declare global {
  interface Window {
    __seed: () => Promise<void>
    __wipe: () => Promise<void>
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

    console.log(
      '[dev] Seed commands available:\n' +
        '  __seed()  - generate demo data (2 past + 1 active roadmap)\n' +
        '  __wipe()  - clear all events',
    )

    return () => {
      delete (window as Partial<Window>).__seed
      delete (window as Partial<Window>).__wipe
    }
  }, [eventStore, ready])

  return null
}
