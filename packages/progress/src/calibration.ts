import type {
  SessionEvent,
  ExceptionalTag,
  RecalibrationResolution,
  CalibrationState,
  PromptDetail,
} from './types'

export function computeCalibration(
  _sessions: SessionEvent[],
  _exceptionalTags: ExceptionalTag[],
  _resolutions: RecalibrationResolution[],
): CalibrationState {
  throw new Error('Not implemented — Phase 6')
}

export function getPromptDetail(
  _sessions: SessionEvent[],
  _cusumBreakpoints: number[],
): PromptDetail {
  throw new Error('Not implemented — Phase 6')
}
