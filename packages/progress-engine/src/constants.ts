/**
 * RoadmapEngine constants and configuration.
 * Tunable post-launch via config injection.
 */

import type { DayOfWeek } from './roadmap-engine'

export interface RoadmapConfig {
  underCapacityBufferThreshold: number
  materialTotalTolerance: number
  anchorStrideMax: number
  inferenceRules: {
    practiceKeywords: RegExp
    interviewKeyword: RegExp
    interviewSizeThreshold: number
  }
}

export const DEFAULT_ROADMAP_CONFIG: RoadmapConfig = {
  underCapacityBufferThreshold: 1.3,
  materialTotalTolerance: 0.15,
  anchorStrideMax: 2,
  inferenceRules: {
    practiceKeywords: /mock|leetcode|exercise|problem set/i,
    interviewKeyword: /interview/i,
    interviewSizeThreshold: 200,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Non-tunable infrastructure constants
// ─────────────────────────────────────────────────────────────────────────────

export const WEEKEND_DAYS: ReadonlyArray<DayOfWeek> = ['Sat', 'Sun']
export const WEEKDAY_DAYS: ReadonlyArray<DayOfWeek> = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
export const DAY_OFFSETS: Record<DayOfWeek, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
}
