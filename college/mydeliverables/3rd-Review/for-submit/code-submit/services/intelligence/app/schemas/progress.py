from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from py_progress.types import (
    BayesianPosterior,
    CalibrationState,
    ContextInsight,
    Phase,
    RoleMultiplier,
    TrendAnalysis,
)

MaterialRole = Literal["anchor", "foundation", "practice"]
TimeOfDay = Literal["morning", "afternoon", "evening"]
MAX_SESSIONS = 5000


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class SessionEvent(ApiModel):
    date: str | None = None
    source: Literal["active", "manual"] | None = None
    plannedMinutes: float | None = None
    activeMinutes: float | None = None
    duration: float | None = None
    materialRole: MaterialRole | None = None
    startedAt: str | None = None
    sessionId: str | None = None


class ExceptionalTag(ApiModel):
    sessionId: str
    exceptional: bool


class RecalibrationResolution(ApiModel):
    resolution: Literal["replan", "acknowledged", "temporary"]
    resolvedAt: str


class PlannedHorizon(ApiModel):
    deadline: str | None = None
    planned_total_sessions: int | None = None


class NextContext(ApiModel):
    startedAt: str | None = None
    date: str | None = None
    materialRole: MaterialRole | None = None
    session_index: int | None = None
    planned_horizon: PlannedHorizon | None = None


class CalibrationRequest(ApiModel):
    sessions: list[SessionEvent] = Field(default_factory=list, max_length=MAX_SESSIONS)
    exceptionalTags: list[ExceptionalTag] = Field(default_factory=list)
    resolutions: list[RecalibrationResolution] = Field(default_factory=list)
    nextContext: NextContext | None = None


class PromptDetailRequest(ApiModel):
    sessions: list[SessionEvent] = Field(default_factory=list, max_length=MAX_SESSIONS)
    breakpoints: list[int] = Field(default_factory=list)


class RoadmapSlot(ApiModel):
    date: str
    dayOfWeek: str | None = None
    weekIndex: int | None = None
    plannedMinutes: float
    candidateMaterialIds: list[str] = Field(default_factory=list)
    role: MaterialRole | None = None
    sessionTitle: str | None = None


class ProgressRoadmapInput(ApiModel):
    startDate: str
    deadline: str
    weeks: int
    weeklyHours: float
    slots: list[RoadmapSlot]


class BayesianPosteriorPayload(ApiModel):
    mean: float
    variance: float
    sessionCount: int


class RoleMultiplierPayload(ApiModel):
    multiplier: float
    confidence: float
    sessionCount: int


class PhasePayload(ApiModel):
    startSessionIndex: int
    endSessionIndex: int
    startDate: str
    endDate: str
    level: float
    slope: float
    slopeUncertainty: float
    sessionCount: int


class TrendPayload(ApiModel):
    phases: list[PhasePayload] = Field(default_factory=list)
    currentPhase: PhasePayload | None = None
    projectionSlope: float
    projectionUncertainty: float


class ContextInsightPayload(ApiModel):
    role: MaterialRole
    timeOfDay: TimeOfDay
    multiplier: float
    sessionCount: int
    label: str


class CalibrationStatePayload(ApiModel):
    globalMultiplier: float
    globalPosterior: BayesianPosteriorPayload
    roleMultipliers: dict[str, RoleMultiplierPayload] = Field(default_factory=dict)
    trend: TrendPayload
    promptNeeded: bool
    insightsByContext: list[ContextInsightPayload] = Field(default_factory=list)
    nextSessionForecast: float | None = None


class ProgressRequest(ApiModel):
    sessions: list[SessionEvent] = Field(default_factory=list, max_length=MAX_SESSIONS)
    roadmap: ProgressRoadmapInput
    calibration: CalibrationStatePayload
    today: str


def dump_model(model: BaseModel) -> dict:
    return model.model_dump(exclude_none=True)


def to_calibration_state(payload: CalibrationStatePayload) -> CalibrationState:
    data = payload.model_dump(exclude_none=True)
    trend_data = data["trend"]
    phases = [Phase(**phase) for phase in trend_data.get("phases", [])]
    current_phase_data = trend_data.get("currentPhase")
    current_phase = Phase(**current_phase_data) if current_phase_data else None

    return CalibrationState(
        globalMultiplier=data["globalMultiplier"],
        globalPosterior=BayesianPosterior(**data["globalPosterior"]),
        roleMultipliers={
            role: RoleMultiplier(**role_multiplier)
            for role, role_multiplier in data.get("roleMultipliers", {}).items()
        },
        trend=TrendAnalysis(
            phases=phases,
            currentPhase=current_phase,
            projectionSlope=trend_data.get("projectionSlope", 0),
            projectionUncertainty=trend_data.get("projectionUncertainty", 1),
        ),
        promptNeeded=data.get("promptNeeded", False),
        insightsByContext=[
            ContextInsight(**insight)
            for insight in data.get("insightsByContext", [])
        ],
        nextSessionForecast=data.get("nextSessionForecast"),
    )
