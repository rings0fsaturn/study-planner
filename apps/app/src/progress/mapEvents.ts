import type { Event } from '../events/EventStore'
import type {
  SessionEvent,
  ExceptionalTag,
  RecalibrationResolution,
  RoadmapInput,
} from '@study-tracker/progress'
import type { RoadmapCreatedPayload } from '../sync/types'

export function mapSessions(events: Event[]): SessionEvent[] {
  return events
    .filter((e) => e.kind === 'SessionLogged')
    .map((e) => ({
      date: e.payload.date as string,
      source: ((e.payload.source as string) ?? 'manual') as 'active' | 'manual',
      plannedMinutes: e.payload.plannedMinutes as number | undefined,
      activeMinutes: e.payload.activeMinutes as number | undefined,
      duration: (e.payload.duration as number) ?? 0,
      materialRole: e.payload.role as SessionEvent['materialRole'],
      startedAt: e.payload.startedAt as string | undefined,
      sessionId: e.payload.sessionId as string | undefined,
    }))
}

export function mapExceptionalTags(events: Event[]): ExceptionalTag[] {
  return events
    .filter((e) => e.kind === 'SessionTaggedExceptional')
    .map((e) => ({
      sessionId: e.payload.sessionId as string,
      exceptional: e.payload.exceptional as boolean,
    }))
}

export function mapResolutions(events: Event[]): RecalibrationResolution[] {
  return events
    .filter((e) => e.kind === 'RecalibrationPromptResolved')
    .map((e) => ({
      resolution: e.payload.resolution as RecalibrationResolution['resolution'],
      resolvedAt: e.createdAt,
    }))
}

export function findRoadmap(events: Event[]): RoadmapInput | null {
  const roadmapEvents = events.filter(
    (e) => e.kind === 'RoadmapCreated' || e.kind === 'RoadmapReplanned',
  )
  if (roadmapEvents.length === 0) return null
  const payload = roadmapEvents[roadmapEvents.length - 1]
    .payload as unknown as RoadmapCreatedPayload
  return {
    startDate: payload.startDate,
    deadline: payload.deadline,
    weeks: payload.weeks,
    weeklyHours: payload.weeklyHours,
    slots: payload.slots.map((slot) => ({
      date: slot.date,
      dayOfWeek: slot.dayOfWeek,
      weekIndex: slot.weekIndex,
      plannedMinutes: slot.plannedMinutes,
      candidateMaterialIds: slot.candidateMaterialIds,
      role: slot.role,
      sessionTitle: slot.sessionTitle ?? null,
    })),
  }
}
