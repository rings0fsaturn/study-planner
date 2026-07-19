from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DayOfWeek = Literal["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MaterialRole = Literal["anchor", "foundation", "practice"]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class Material(ApiModel):
    id: str
    title: str
    totalMinutes: float
    role: MaterialRole
    additionOrder: int


class RoadmapGenerateRequest(ApiModel):
    materials: list[Material]
    weeks: int
    startDate: str
    selectedStudyDays: list[DayOfWeek]
    weekdayHours: float
    weekendHours: float


class Pin(ApiModel):
    weekIndex: int
    dayOfWeek: DayOfWeek
    materialId: str | None = None
    sessionTitle: str | None = None
    plannedMinutes: float
    reason: Literal["completed", "today", "user-edited"]


class RoadmapRegenerateRequest(ApiModel):
    input: RoadmapGenerateRequest
    pins: list[Pin] = Field(default_factory=list)


def dump_model(model: BaseModel) -> dict:
    return model.model_dump(exclude_none=True)
