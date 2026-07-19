import { afterEach, describe, expect, it, vi } from 'vitest'

type SeedEvent = {
  kind: string
  payload: Record<string, unknown>
  createdAt: string
}

const ORIGINAL_TZ = process.env.TZ

async function buildSeedAtKolkataInstant(instant: string) {
  process.env.TZ = 'Asia/Kolkata'
  vi.resetModules()
  const { buildSeedDemoEvents } = await import('./seedTestData')
  return buildSeedDemoEvents(new Date(instant))
}

function activeRoadmapEvent(events: SeedEvent[]): SeedEvent {
  const active = events.find(
    (event) =>
      event.kind === 'RoadmapCreated' &&
      (event.payload as { purpose?: string }).purpose === 'Learn modern React + TypeScript',
  )

  expect(active).toBeDefined()
  return active!
}

afterEach(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = ORIGINAL_TZ
  }
  vi.resetModules()
})

describe('buildSeedDemoEvents', () => {
  it('uses the browser-local date key for a late-evening UTC instant', async () => {
    const seed = await buildSeedAtKolkataInstant('2026-07-04T20:00:00Z')
    const activeRoadmap = activeRoadmapEvent(seed.events)

    expect(seed.todayStr).toBe('2026-07-05')
    expect(activeRoadmap.payload).toMatchObject({
      startDate: '2026-06-07',
      deadline: '2026-08-09',
      selectedStudyDays: ['Mon', 'Wed', 'Fri', 'Sat'],
    })
  })

  it('books local today on a study day and leaves that booking unlogged', async () => {
    const seed = await buildSeedAtKolkataInstant('2026-07-05T20:00:00Z')
    const activeRoadmap = activeRoadmapEvent(seed.events)
    const todayBooking = seed.events.find(
      (event) =>
        event.kind === 'SessionBooked' &&
        event.payload.roadmapCreatedAt === activeRoadmap.createdAt &&
        event.payload.date === seed.todayStr,
    )
    const loggedBookingIds = new Set(
      seed.events
        .filter((event) => event.kind === 'SessionLogged')
        .map((event) => event.payload.bookingId),
    )

    expect(seed.todayStr).toBe('2026-07-06')
    expect(todayBooking).toBeDefined()
    expect(loggedBookingIds.has(todayBooking?.payload.bookingId)).toBe(false)
  })
})
