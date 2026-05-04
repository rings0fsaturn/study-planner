// Deprecated: use @study-tracker/progress instead.
// These functions are kept for backward compat until Plan B migrates Home.tsx.
import type { Event } from './EventStore';
import type { RoadmapCreatedPayload } from '../sync/types'
import type { Slot } from '@study-tracker/roadmap-engine'

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

export function getProjectedFinish(roadmap: RoadmapCreatedPayload): string | null {
  const allSlots = roadmap.slots
    .filter(s => s.candidateMaterialIds.length >= 1 || s.role !== null)
  if (allSlots.length === 0) return null
  return allSlots[allSlots.length - 1].date
}

export function getUpNextSlot(roadmap: RoadmapCreatedPayload, today: string): Slot | null {
  const upcoming = roadmap.slots
    .filter(s => s.date >= today && (s.candidateMaterialIds.length >= 1 || s.role !== null))
  return upcoming[0] ?? null
}