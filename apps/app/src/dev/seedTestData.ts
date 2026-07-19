import type { DayOfWeek } from '@study-tracker/roadmap-engine'
import type { EventStore, Event } from '../events/EventStore'
import type {
  MaterialAddedPayload,
  RoadmapCreatedPayload,
  SessionBookedPayload,
} from '../sync/types'
import type { SessionLoggedPayload } from '../session/types'

type OmitId = Omit<Event, 'id'>

let seed = 42

function rand(): number {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

function randInt(min: number, max: number): number {
  return Math.round(min + rand() * (max - min))
}

function uuid(): string {
  return crypto.randomUUID()
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function iso(d: Date): string {
  return d.toISOString()
}

function dateStr(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromDateStr(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function localDayNumber(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
}

function localDayDiff(start: Date, end: Date): number {
  return localDayNumber(end) - localDayNumber(start)
}

const STUDY_DAY_NUMS = new Set([1, 3, 5, 6])
const STUDY_DAYS: DayOfWeek[] = ['Mon', 'Wed', 'Fri', 'Sat']
const PAST_SESSION_SKIP_PROBABILITY = 0.01

function plannedMinutesForDate(d: Date): number {
  const day = d.getDay()
  return day === 0 || day === 6 ? 120 : 90
}

interface SeedMaterial {
  id: string
  title: string
  duration: number
  role: 'anchor' | 'foundation' | 'practice'
  kind: 'youtube' | 'article' | 'manual'
}

interface BookingSeed {
  bookingId: string
  date: string
  estimatedDuration: number
  materialId: string
  weekIndex: number
}

interface SeedBuildResult {
  events: OmitId[]
  activeBookings: BookingSeed[]
  activeStartDate: string
  activeDeadlineDate: string
  loggedCount: number
  todayStr: string
}

function bookingsForWindow(start: Date, end: Date, materials: SeedMaterial[]): BookingSeed[] {
  const budgets = materials.map((m) => m.duration)
  let materialIndex = 0
  const bookings: BookingSeed[] = []

  for (let cur = new Date(start); cur <= end; cur = addDays(cur, 1)) {
    if (!STUDY_DAY_NUMS.has(cur.getDay())) continue

    while (materialIndex < materials.length - 1 && budgets[materialIndex] <= 0) {
      materialIndex += 1
    }

    const estimatedDuration = plannedMinutesForDate(cur)
    budgets[materialIndex] -= estimatedDuration

    bookings.push({
      bookingId: uuid(),
      date: dateStr(cur),
      estimatedDuration,
      materialId: materials[materialIndex].id,
      weekIndex: Math.max(
        0,
        Math.floor(localDayDiff(start, cur) / 7),
      ),
    })
  }

  return bookings
}

function materialEvent(material: SeedMaterial, createdAt: string): OmitId {
  const payload: MaterialAddedPayload = {
    materialId: material.id,
    title: material.title,
    estimatedDuration: material.duration,
    kind: material.kind,
    role: material.role,
  }

  return {
    kind: 'MaterialAdded',
    payload: payload as unknown as Record<string, unknown>,
    createdAt,
  }
}

function roadmapEvent(
  args: { start: Date; deadline: Date; materials: SeedMaterial[]; purpose: string },
  createdAt: string,
): OmitId {
  const weeks = Math.max(
    1,
    Math.ceil(localDayDiff(args.start, args.deadline) / 7),
  )
  const payload: RoadmapCreatedPayload = {
    startDate: dateStr(args.start),
    deadline: dateStr(args.deadline),
    weeks,
    purpose: args.purpose,
    selectedStudyDays: STUDY_DAYS,
    weekdayHours: 1.5,
    weekendHours: 2,
    weeklyHours: 6.5,
    materialIds: args.materials.map((material) => material.id),
  }

  return {
    kind: 'RoadmapCreated',
    payload: payload as unknown as Record<string, unknown>,
    createdAt,
  }
}

function bookingEvent(booking: BookingSeed, roadmapCreatedAt: string): OmitId {
  const payload: SessionBookedPayload = {
    roadmapCreatedAt,
    bookingId: booking.bookingId,
    date: booking.date,
    estimatedDuration: booking.estimatedDuration,
    materialId: booking.materialId,
  }

  return {
    kind: 'SessionBooked',
    payload: payload as unknown as Record<string, unknown>,
    createdAt: roadmapCreatedAt,
  }
}

function loggedSessionEvent(
  booking: BookingSeed,
  material: SeedMaterial,
  activeMinutes: number,
): OmitId {
  const slotDate = dateFromDateStr(booking.date)
  const startHour = [8, 9, 10, 14, 15, 19][Math.floor(rand() * 6)]
  const startedAt = new Date(slotDate)
  startedAt.setHours(startHour, randInt(0, 55), 0, 0)
  const endedAt = new Date(startedAt.getTime() + activeMinutes * 60_000)
  const payload: SessionLoggedPayload = {
    sessionId: uuid(),
    materialId: booking.materialId,
    sessionTitle: material.title,
    slotDate: booking.date,
    weekIndex: booking.weekIndex,
    plannedMinutes: booking.estimatedDuration,
    bookingId: booking.bookingId,
    plannedSessionMinutes: booking.estimatedDuration,
    materialConsumedMinutes: activeMinutes,
    startedAt: iso(startedAt),
    endedAt: iso(endedAt),
    activeMinutes,
    pauseCount: randInt(0, 3),
    totalPauseMinutes: randInt(0, 8),
    pomodorosCompleted: Math.floor(activeMinutes / 25),
    source: 'active',
    resolution: 'completed',
    duration: activeMinutes,
    description: material.title,
    date: booking.date,
  }

  return {
    kind: 'SessionLogged',
    payload: payload as unknown as Record<string, unknown>,
    createdAt: iso(endedAt),
  }
}

export function buildSeedDemoEvents(now = new Date()): SeedBuildResult {
  seed = 42

  const today = startOfLocalDay(now)
  const todayStr = dateStr(today)
  const events: OmitId[] = []

  // ---------------- PAST ROADMAP #1 - completed ----------------
  {
    const start = addDays(today, -140)
    const deadline = addDays(today, -95)
    const createdAt = iso(addDays(start, -1))
    const materials: SeedMaterial[] = [
      {
        id: uuid(),
        title: 'Foundations of Machine Learning',
        duration: 900,
        role: 'anchor',
        kind: 'youtube',
      },
      {
        id: uuid(),
        title: 'Linear Algebra Refresher',
        duration: 480,
        role: 'foundation',
        kind: 'article',
      },
    ]

    for (const material of materials) {
      events.push(materialEvent(material, createdAt))
    }

    events.push(
      roadmapEvent(
        {
          start,
          deadline,
          materials,
          purpose: 'Foundations of Machine Learning',
        },
        createdAt,
      ),
    )

    for (const booking of bookingsForWindow(start, deadline, materials)) {
      events.push(bookingEvent(booking, createdAt))
    }

    const resolvedAt = iso(addDays(deadline, -1))
    const terminal = {
      roadmapCreatedAt: createdAt,
      resolvedAt,
      reason: 'Finished the syllabus',
    }
    events.push({
      kind: 'RoadmapMarkedComplete',
      payload: terminal as unknown as Record<string, unknown>,
      createdAt: resolvedAt,
    })
  }

  // ---------------- PAST ROADMAP #2 - abandoned ----------------
  {
    const start = addDays(today, -84)
    const deadline = addDays(today, -28)
    const createdAt = iso(addDays(start, -1))
    const materials: SeedMaterial[] = [
      {
        id: uuid(),
        title: 'System Design Interview Prep',
        duration: 720,
        role: 'anchor',
        kind: 'youtube',
      },
      {
        id: uuid(),
        title: 'Distributed Systems Notes',
        duration: 420,
        role: 'foundation',
        kind: 'article',
      },
    ]

    for (const material of materials) {
      events.push(materialEvent(material, createdAt))
    }

    events.push(
      roadmapEvent(
        {
          start,
          deadline,
          materials,
          purpose: 'System Design Interview Prep',
        },
        createdAt,
      ),
    )

    for (const booking of bookingsForWindow(start, deadline, materials)) {
      events.push(bookingEvent(booking, createdAt))
    }

    const resolvedAt = iso(addDays(start, 30))
    const terminal = {
      roadmapCreatedAt: createdAt,
      resolvedAt,
      reason: 'Shifted focus to the current plan',
    }
    events.push({
      kind: 'RoadmapMarkedAbandoned',
      payload: terminal as unknown as Record<string, unknown>,
      createdAt: resolvedAt,
    })
  }

  const activeStart = addDays(today, -28)
  const activeDeadline = addDays(today, 35)
  const activeCreatedAt = iso(addDays(activeStart, -1))
  const activeMaterials: SeedMaterial[] = [
    { id: uuid(), title: 'React 19 Deep Dive', duration: 1080, role: 'anchor', kind: 'youtube' },
    { id: uuid(), title: 'TypeScript Patterns', duration: 780, role: 'foundation', kind: 'article' },
    { id: uuid(), title: 'Practice Problems Set', duration: 540, role: 'practice', kind: 'manual' },
  ]

  events.push({ kind: 'OnboardingCompleted', payload: {}, createdAt: activeCreatedAt })

  for (const material of activeMaterials) {
    events.push(materialEvent(material, activeCreatedAt))
  }

  events.push(
    roadmapEvent(
      {
        start: activeStart,
        deadline: activeDeadline,
        materials: activeMaterials,
        purpose: 'Learn modern React + TypeScript',
      },
      activeCreatedAt,
    ),
  )

  const activeBookings = bookingsForWindow(activeStart, activeDeadline, activeMaterials)
  for (const booking of activeBookings) {
    events.push(bookingEvent(booking, activeCreatedAt))
  }

  const materialById = new Map(activeMaterials.map((material) => [material.id, material]))
  let loggedCount = 0

  for (const booking of activeBookings) {
    if (booking.date >= todayStr) continue
    if (rand() < PAST_SESSION_SKIP_PROBABILITY) continue

    const pace = booking.weekIndex < 2 ? 0.78 + rand() * 0.1 : 0.62 + rand() * 0.1
    const activeMinutes = Math.max(20, Math.round(booking.estimatedDuration * pace))
    events.push(loggedSessionEvent(booking, materialById.get(booking.materialId)!, activeMinutes))
    loggedCount += 1
  }

  events.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return {
    events,
    activeBookings,
    activeStartDate: dateStr(activeStart),
    activeDeadlineDate: dateStr(activeDeadline),
    loggedCount,
    todayStr,
  }
}

export async function seedTestData(eventStore: EventStore): Promise<void> {
  const existing = await eventStore.getAll()
  if (existing.length > 0) {
    console.warn(`[seed] EventStore already has ${existing.length} events. Wiping first...`)
    await eventStore.wipe()
  }

  const { events, activeBookings, activeStartDate, activeDeadlineDate, loggedCount } = buildSeedDemoEvents()

  await eventStore.bulkAppend(events)

  console.log(
    `[seed] Done - active roadmap ${activeStartDate} to ${activeDeadlineDate}; ` +
      `${activeBookings.length} active bookings, ${loggedCount} logged sessions; ` +
      '2 past roadmaps (1 completed, 1 abandoned); ' +
      `${events.length} events total.`,
  )
}

export async function wipeTestData(eventStore: EventStore): Promise<void> {
  await eventStore.wipe()
  console.log('[seed] Wiped all events from EventStore')
}
