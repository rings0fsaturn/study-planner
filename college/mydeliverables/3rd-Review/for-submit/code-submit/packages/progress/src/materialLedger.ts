import type { MaterialPosition, SessionEvent } from './types'

export interface MaterialProgressMark {
  materialId: string
  markedAt: string
  materialPosition: MaterialPosition
}

export interface MaterialLedgerEntry {
  materialId: string
  title: string
  estimatedMinutes: number
  activeMinutesLogged: number
  estimatedConsumedMinutes: number
  remainingEstimatedMinutes: number
  done: boolean
  started: boolean
  lastPosition?: MaterialPosition
}

interface TimedPosition {
  at: string
  position: MaterialPosition
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function positionToEstimatedMinutes(position: MaterialPosition, estimatedMinutes: number): number {
  if (estimatedMinutes <= 0) return 0
  if (position.kind === 'percent') {
    return clamp((position.value / 100) * estimatedMinutes, 0, estimatedMinutes)
  }
  if (position.ofTotal !== undefined && position.ofTotal > 0) {
    return clamp((position.value / position.ofTotal) * estimatedMinutes, 0, estimatedMinutes)
  }
  return clamp(position.value, 0, estimatedMinutes)
}

function sessionMinutes(session: SessionEvent): number {
  return session.activeMinutes ?? session.duration
}

function sessionTime(session: SessionEvent): string {
  return session.startedAt ?? session.date
}

export function buildMaterialLedger(
  materials: { id: string; title: string; estimatedMinutes: number }[],
  sessions: SessionEvent[],
  progressMarks: MaterialProgressMark[] = [],
): MaterialLedgerEntry[] {
  return materials.map((material) => {
    const materialSessions = sessions.filter((session) => session.materialId === material.id)
    const materialMarks = progressMarks.filter((mark) => mark.materialId === material.id)
    const activeMinutesLogged = materialSessions.reduce(
      (total, session) => total + sessionMinutes(session),
      0,
    )
    const consumedFromSessions = materialSessions.reduce(
      (total, session) => total + (session.materialConsumedMinutes ?? 0),
      0,
    )
    const timedPositions: TimedPosition[] = [
      ...materialSessions
        .filter((session): session is SessionEvent & { materialPosition: MaterialPosition } =>
          session.materialPosition !== undefined)
        .map((session) => ({
          at: sessionTime(session),
          position: session.materialPosition,
        })),
      ...materialMarks.map((mark) => ({
        at: mark.markedAt,
        position: mark.materialPosition,
      })),
    ].sort((a, b) => a.at.localeCompare(b.at))
    const lastPosition = timedPositions[timedPositions.length - 1]?.position
    const consumedFromPosition = lastPosition
      ? positionToEstimatedMinutes(lastPosition, material.estimatedMinutes)
      : 0
    const estimatedConsumedMinutes = clamp(
      Math.max(consumedFromSessions, consumedFromPosition),
      0,
      material.estimatedMinutes,
    )
    const done = materialSessions.some((session) => session.resolution === 'completed') ||
      estimatedConsumedMinutes >= material.estimatedMinutes
    const started = activeMinutesLogged > 0 || materialMarks.length > 0

    return {
      materialId: material.id,
      title: material.title,
      estimatedMinutes: material.estimatedMinutes,
      activeMinutesLogged,
      estimatedConsumedMinutes,
      remainingEstimatedMinutes: Math.max(0, material.estimatedMinutes - estimatedConsumedMinutes),
      done,
      started,
      ...(lastPosition ? { lastPosition } : {}),
    }
  })
}
