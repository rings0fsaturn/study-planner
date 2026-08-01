import type { SessionEvent } from './types'

export function calibrationDenominator(session: SessionEvent): number | undefined {
  return session.materialConsumedMinutes ?? session.plannedMinutes
}

export function isCalibrationSession(session: SessionEvent, exceptionalIds?: Set<string>): boolean {
  const denominator = calibrationDenominator(session)
  return (
    session.source === 'active' &&
    denominator != null &&
    denominator > 0 &&
    session.activeMinutes != null &&
    session.activeMinutes > 0 &&
    (!exceptionalIds || !session.sessionId || !exceptionalIds.has(session.sessionId))
  )
}
