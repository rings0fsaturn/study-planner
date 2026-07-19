// Deprecated: use @study-tracker/progress instead.
// These functions are kept for backward compat until Plan B migrates Home.tsx.
import type { Event } from './EventStore';

interface RoadmapSlotLike {
  date: string
  candidateMaterialIds: string[]
  role: unknown | null
}

interface RoadmapWithSlots<T extends RoadmapSlotLike> {
  slots: T[]
}

export function totalMinutesLogged(events: Event[]): number {
  return events
    .filter(event => event.kind === 'SessionLogged')
    .reduce((total, event) => {
      const duration = event.payload.duration;
      if (typeof duration === 'number') {
        return total + duration;
      }
      return total;
    }, 0);
}

export function getProjectedFinish<T extends RoadmapSlotLike>(
  roadmap: RoadmapWithSlots<T>,
): string | null {
  const allSlots = roadmap.slots
    .filter(s => s.candidateMaterialIds.length >= 1 || s.role !== null)
  if (allSlots.length === 0) return null
  return allSlots[allSlots.length - 1].date
}

export function getUpNextSlot<T extends RoadmapSlotLike>(
  roadmap: RoadmapWithSlots<T>,
  today: string,
): T | null {
  const upcoming = roadmap.slots
    .filter(s => s.date >= today && (s.candidateMaterialIds.length >= 1 || s.role !== null))
  return upcoming[0] ?? null
}
