import type { EventStore, Event } from '../events/EventStore'

function uuid(): string {
  return crypto.randomUUID()
}

type OmitId = Omit<Event, 'id'>

function iso(date: Date): string {
  return date.toISOString()
}

function dateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function dayOfWeekName(date: Date): string {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()]
}

// Deterministic pseudo-random for reproducibility
let seed = 42
function rand(): number {
  seed = (seed * 16807 + 0) % 2147483647
  return (seed - 1) / 2147483646
}

function randBetween(min: number, max: number): number {
  return Math.round(min + rand() * (max - min))
}

export async function seedTestData(eventStore: EventStore): Promise<void> {
  seed = 42

  const existing = await eventStore.getAll()
  if (existing.length > 0) {
    console.warn(
      `[seed] EventStore already has ${existing.length} events. Wiping first...`,
    )
    await eventStore.wipe()
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = addDays(today, -28) // 4 weeks ago
  const deadline = addDays(today, 42)   // 6 weeks from now
  const totalWeeks = 10

  // Study days: Mon, Wed, Fri, Sat
  const studyDayNums = new Set([1, 3, 5, 6])
  const studyDayNames = ['monday', 'wednesday', 'friday', 'saturday']

  // --- Materials ---
  const materials = [
    {
      id: uuid(),
      title: 'React 19 Deep Dive',
      duration: 600,
      role: 'anchor' as const,
      kind: 'youtube',
    },
    {
      id: uuid(),
      title: 'TypeScript Patterns',
      duration: 480,
      role: 'foundation' as const,
      kind: 'article',
    },
    {
      id: uuid(),
      title: 'Practice Problems Set',
      duration: 360,
      role: 'practice' as const,
      kind: 'manual',
    },
  ]

  // --- Generate roadmap slots ---
  const slots: Array<{
    date: string
    dayOfWeek: string
    weekIndex: number
    plannedMinutes: number
    candidateMaterialIds: string[]
    role: string
    sessionTitle: string
  }> = []

  let slotIndex = 0
  for (let d = 0; d < totalWeeks * 7; d++) {
    const date = addDays(startDate, d)
    if (!studyDayNums.has(date.getDay())) continue

    const matIndex = slotIndex % materials.length
    const mat = materials[matIndex]
    const plannedMinutes = date.getDay() === 6 ? 120 : 90

    slots.push({
      date: dateStr(date),
      dayOfWeek: dayOfWeekName(date),
      weekIndex: Math.floor(d / 7),
      plannedMinutes,
      candidateMaterialIds: [mat.id],
      role: mat.role,
      sessionTitle: mat.title,
    })
    slotIndex++
  }

  // --- Build events ---
  const events: OmitId[] = []

  // 1. OnboardingCompleted
  events.push({
    kind: 'OnboardingCompleted',
    payload: {},
    createdAt: iso(addDays(startDate, -1)),
  })

  // 2. MaterialAdded (one per material)
  for (const mat of materials) {
    events.push({
      kind: 'MaterialAdded',
      payload: {
        materialId: mat.id,
        title: mat.title,
        estimatedDuration: mat.duration,
        kind: mat.kind,
        role: mat.role,
      },
      createdAt: iso(addDays(startDate, -1)),
    })
  }

  // 3. RoadmapCreated
  events.push({
    kind: 'RoadmapCreated',
    payload: {
      startDate: dateStr(startDate),
      deadline: dateStr(deadline),
      weeks: totalWeeks,
      purpose: 'Learn modern React + TypeScript',
      selectedStudyDays: studyDayNames,
      weekdayHours: 1.5,
      weekendHours: 2,
      weeklyHours: 6.5,
      slots,
    },
    createdAt: iso(addDays(startDate, -1)),
  })

  // 4. SessionLogged events — only for dates up to today
  //    Weeks 1-2: user is slightly slow (1.1-1.3x planned time)
  //    Weeks 3-4: pace shift — user gets faster (0.7-0.9x planned time)
  //    Some sessions skipped (~15% chance)
  const pastSlots = slots.filter((s) => s.date <= dateStr(today))

  for (const slot of pastSlots) {
    const roll = rand()
    if (roll < 0.12) continue // 12% skip rate

    const slotDate = new Date(slot.date + 'T00:00:00')
    const weeksSinceStart = Math.floor(
      (slotDate.getTime() - startDate.getTime()) / (7 * 86400000),
    )

    // Pace shift: weeks 0-1 slower, weeks 2-3 faster
    let paceMultiplier: number
    if (weeksSinceStart < 2) {
      paceMultiplier = 1.1 + rand() * 0.3 // 1.1 - 1.4x (slower)
    } else {
      paceMultiplier = 0.65 + rand() * 0.25 // 0.65 - 0.9x (faster)
    }

    const activeMinutes = Math.round(slot.plannedMinutes * paceMultiplier)
    const sessionId = uuid()

    // Random start time: morning (8-11), afternoon (13-16), evening (18-20)
    const timeSlots = [
      { hour: 8, label: 'morning' },
      { hour: 9, label: 'morning' },
      { hour: 10, label: 'morning' },
      { hour: 14, label: 'afternoon' },
      { hour: 15, label: 'afternoon' },
      { hour: 19, label: 'evening' },
    ]
    const timeSlot = timeSlots[Math.floor(rand() * timeSlots.length)]
    const startHour = timeSlot.hour
    const startMin = Math.floor(rand() * 60)

    const startedAt = new Date(slotDate)
    startedAt.setHours(startHour, startMin, 0, 0)
    const endedAt = new Date(startedAt.getTime() + activeMinutes * 60000)

    events.push({
      kind: 'SessionLogged',
      payload: {
        sessionId,
        materialId: slot.candidateMaterialIds[0],
        sessionTitle: slot.sessionTitle,
        slotDate: slot.date,
        weekIndex: slot.weekIndex,
        plannedMinutes: slot.plannedMinutes,
        startedAt: iso(startedAt),
        endedAt: iso(endedAt),
        activeMinutes,
        pauseCount: randBetween(0, 3),
        totalPauseMinutes: randBetween(0, 8),
        pomodorosCompleted: Math.floor(activeMinutes / 25),
        resolution: 'completed',
        source: 'active',
        duration: activeMinutes,
        description: slot.sessionTitle,
        date: slot.date,
        role: slot.role,
      },
      createdAt: iso(endedAt),
    })
  }

  // Sort all events by createdAt
  events.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )

  await eventStore.bulkAppend(events)

  const sessionCount = events.filter((e) => e.kind === 'SessionLogged').length
  console.log(
    `[seed] Done! Created ${events.length} events (${sessionCount} sessions across ${pastSlots.length} planned slots)`,
  )
  console.log(
    `[seed] Roadmap: ${dateStr(startDate)} → ${dateStr(deadline)} (${totalWeeks} weeks)`,
  )
  console.log(
    `[seed] Pace shift: weeks 1-2 slower (1.1-1.4x), weeks 3-4 faster (0.65-0.9x)`,
  )
}

export async function wipeTestData(eventStore: EventStore): Promise<void> {
  await eventStore.wipe()
  console.log('[seed] Wiped all events from EventStore')
}
