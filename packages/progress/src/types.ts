export type MaterialRole = 'anchor' | 'foundation' | 'practice'
export type TimeOfDay = 'morning' | 'afternoon' | 'evening'
export type Verdict = 'ahead' | 'on-track' | 'slipping'

// --- Input types (what the app feeds in) ---

export interface SessionEvent {
  date: string
  source: 'active' | 'manual'
  plannedMinutes?: number
  activeMinutes?: number
  duration: number
  materialRole?: MaterialRole
  startedAt?: string
  sessionId?: string
}

export interface ExceptionalTag {
  sessionId: string
  exceptional: boolean
}

export interface RecalibrationResolution {
  resolution: 'replan' | 'acknowledged' | 'temporary'
  resolvedAt: string
}

export interface RoadmapSlot {
  date: string
  dayOfWeek: string
  weekIndex: number
  plannedMinutes: number
  candidateMaterialIds: string[]
  role: MaterialRole | null
  sessionTitle?: string | null
}

export interface RoadmapInput {
  startDate: string
  deadline: string
  weeks: number
  weeklyHours: number
  slots: RoadmapSlot[]
}

// --- CalibrationState output ---

export interface BayesianPosterior {
  mean: number
  variance: number
  sessionCount: number
}

export interface RoleMultiplier {
  multiplier: number
  confidence: number
  sessionCount: number
}

export interface Phase {
  startSessionIndex: number
  endSessionIndex: number
  startDate: string
  endDate: string
  level: number
  slope: number
  slopeUncertainty: number
  sessionCount: number
}

export interface TrendAnalysis {
  phases: Phase[]
  currentPhase: Phase | null
  projectionSlope: number
  projectionUncertainty: number
}

export interface ContextInsight {
  role: MaterialRole
  timeOfDay: TimeOfDay
  multiplier: number
  sessionCount: number
  label: string
}

export interface CalibrationState {
  globalMultiplier: number
  globalPosterior: BayesianPosterior
  roleMultipliers: Partial<Record<MaterialRole, RoleMultiplier>>
  trend: TrendAnalysis
  promptNeeded: boolean
  insightsByContext: ContextInsight[]
}

// --- PromptDetail (cold path, only when modal opens) ---

export interface PromptSession {
  sessionId: string
  date: string
  timeOfDay: TimeOfDay
  sessionTitle: string
  plannedMinutes: number
  activeMinutes: number
}

export interface PromptDetail {
  sessions: PromptSession[]
  currentPace: number
  previousPace: number
}

// --- ProgressSnapshot output ---

export interface DayCell {
  date: string
  level: 0 | 1 | 2 | 3
  minutes: number
  isToday: boolean
}

export interface CumulativePoint {
  date: string
  minutes: number
}

export interface GPPoint {
  date: string
  mean: number
  lower: number
  upper: number
}

export interface BurnUpData {
  planned: CumulativePoint[]
  actual: CumulativePoint[]
  gpCurve: GPPoint[]
  today: string
  deficit: number
  dayNumber: number
  totalDays: number
}

export interface WeeklyStats {
  weekIndex: number
  weekStartDate: string
  sessionsThisWeek: number
  minutesThisWeek: number
  plannedMinutesThisWeek: number
  minutesByDay: Record<string, number>
  materialsTouched: string[]
}

export interface WeekSummaryForNarrative {
  weekStartDate: string
  sessionsLogged: number
  hoursLogged: number
  verdict: Verdict
  daysWithActivity: number
  materialsTouched: string[]
}

export interface ReplanContext {
  isPlanDrifted: boolean
  daysOverDeadline: number | null
  pinnedSlotCount: number
  editableSlotCount: number
}

export interface ProgressSnapshot {
  streak: {
    current: number
    longest: number
    grid: DayCell[]
  }
  burnUp: BurnUpData
  projection: {
    finishDate: string | null
    confidenceInterval: [string, string] | null
  }
  totalMinutes: number
  totalPlannedMinutes: number
  completionPercentage: number
  verdict: Verdict
  driftPastDeadline: boolean
  upNext: RoadmapSlot | null
  weeklyStats: WeeklyStats
  weekSummaryForNarrative: WeekSummaryForNarrative
  replanContext: ReplanContext
}
