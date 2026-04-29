/**
 * Configuration and constants for RoadmapEngine.
 * Tunable parameters that may be A/B tested or adjusted post-launch.
 */

export const DAY_OFFSETS: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
}

export const WEEKEND_DAYS: string[] = ['Sat', 'Sun']
export const WEEKDAY_DAYS: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export interface InferenceRules {
  practiceKeywords: RegExp
  interviewKeyword: RegExp
  interviewSizeThreshold: number
}

export interface RoadmapConfig {
  /** Trigger under-capacity-buffer warning when capacity > material × this */
  underCapacityBufferThreshold: number
  /** Material totals must sum to ±this fraction of declared totalMinutes */
  materialTotalTolerance: number
  /** Anchor stride warning fires when consecutive anchor weeks are >this apart */
  anchorStrideMax: number
  /** Title-regex inference rules for inferRole */
  inferenceRules: InferenceRules
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
