from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, TypedDict

MaterialRole = Literal["anchor", "foundation", "practice"]
TimeOfDay = Literal["morning", "afternoon", "evening"]
DayOfWeek = Literal["weekday", "weekend"]
Verdict = Literal["ahead", "on-track", "slipping"]


class SessionEvent(TypedDict, total=False):
    date: str
    source: Literal["active", "manual"]
    plannedMinutes: float | None
    activeMinutes: float | None
    duration: float
    materialRole: MaterialRole
    startedAt: str
    sessionId: str


class ExceptionalTag(TypedDict):
    sessionId: str
    exceptional: bool


class RecalibrationResolution(TypedDict):
    resolution: Literal["replan", "acknowledged", "temporary"]
    resolvedAt: str


class RoadmapSlot(TypedDict, total=False):
    date: str
    dayOfWeek: str
    weekIndex: int
    plannedMinutes: float
    candidateMaterialIds: list[str]
    role: MaterialRole | None
    sessionTitle: str | None


class RoadmapInput(TypedDict):
    startDate: str
    deadline: str
    weeks: int
    weeklyHours: float
    slots: list[RoadmapSlot]


@dataclass
class BayesianPosterior:
    mean: float
    variance: float
    sessionCount: int


@dataclass
class RoleMultiplier:
    multiplier: float
    confidence: float
    sessionCount: int


@dataclass
class Phase:
    startSessionIndex: int
    endSessionIndex: int
    startDate: str
    endDate: str
    level: float
    slope: float
    slopeUncertainty: float
    sessionCount: int


@dataclass
class TrendAnalysis:
    phases: list[Phase]
    currentPhase: Phase | None
    projectionSlope: float
    projectionUncertainty: float


@dataclass
class ContextInsight:
    role: MaterialRole
    timeOfDay: TimeOfDay
    multiplier: float
    sessionCount: int
    label: str


@dataclass
class CalibrationState:
    globalMultiplier: float
    globalPosterior: BayesianPosterior
    roleMultipliers: dict[str, RoleMultiplier]
    trend: TrendAnalysis
    promptNeeded: bool
    insightsByContext: list[ContextInsight]
    nextSessionForecast: float | None = None


@dataclass
class PromptSession:
    sessionId: str
    date: str
    timeOfDay: TimeOfDay
    sessionTitle: str
    plannedMinutes: float
    activeMinutes: float


@dataclass
class PromptDetail:
    sessions: list[PromptSession]
    currentPace: float
    previousPace: float


@dataclass
class DayCell:
    date: str
    level: Literal[0, 1, 2, 3]
    minutes: float
    isToday: bool


@dataclass
class CumulativePoint:
    date: str
    minutes: float


@dataclass
class GPPoint:
    date: str
    mean: float
    lower: float
    upper: float


@dataclass
class BurnUpData:
    planned: list[CumulativePoint]
    actual: list[CumulativePoint]
    gpCurve: list[GPPoint]
    today: str
    deficit: float
    dayNumber: int
    totalDays: int


@dataclass
class WeeklyStats:
    weekIndex: int
    weekStartDate: str
    sessionsThisWeek: int
    minutesThisWeek: float
    plannedMinutesThisWeek: float
    minutesByDay: dict[str, float]
    materialsTouched: list[str]


@dataclass
class WeekSummaryForNarrative:
    weekStartDate: str
    sessionsLogged: int
    hoursLogged: float
    verdict: Verdict
    daysWithActivity: int
    materialsTouched: list[str]


@dataclass
class ReplanContext:
    isPlanDrifted: bool
    daysOverDeadline: int | None
    pinnedSlotCount: int
    editableSlotCount: int


@dataclass
class ProgressSnapshot:
    streak: dict
    burnUp: BurnUpData
    projection: dict
    totalMinutes: float
    totalPlannedMinutes: float
    completionPercentage: float
    verdict: Verdict
    driftPastDeadline: bool
    upNext: RoadmapSlot | None
    weeklyStats: WeeklyStats
    weekSummaryForNarrative: WeekSummaryForNarrative
    replanContext: ReplanContext


@dataclass
class HierarchicalResult:
    globalPosterior: BayesianPosterior
    globalMultiplier: float
    roleMultipliers: dict[str, RoleMultiplier]
    insights: list[ContextInsight] = field(default_factory=list)


@dataclass
class CUSUMResult:
    breakpoints: list[int]
    upperAccumulator: list[float]
    lowerAccumulator: list[float]


@dataclass
class RegimeShiftResult:
    breakpoints: list[int]
    promptNeeded: bool
    cusumState: dict[str, float]


@dataclass
class KalmanState:
    x: list[float]
    P: list[list[float]]


@dataclass
class KalmanPhaseResult:
    finalLevel: float
    finalSlope: float
    levelUncertainty: float
    slopeUncertainty: float
