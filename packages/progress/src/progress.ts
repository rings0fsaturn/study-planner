import type {
  SessionEvent,
  RoadmapInput,
  CalibrationState,
  ProgressSnapshot,
} from './types'

export function computeProgress(
  _sessions: SessionEvent[],
  _roadmap: RoadmapInput,
  _calibration: CalibrationState,
  _today: string,
): ProgressSnapshot {
  throw new Error('Not implemented — Phase 6')
}
