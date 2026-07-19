from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

DayOfWeek = Literal["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MaterialRole = Literal["anchor", "foundation", "practice"]
WarningKind = Literal[
    "over-capacity",
    "under-capacity-buffer",
    "anchor-stride-too-wide",
    "pin-overflow",
    "unresolved-tie-count",
    "material-overfilled",
    "material-underfilled",
]
CapacityStatus = Literal["fits", "over-capacity", "under-capacity-buffer"]
PinReason = Literal["completed", "today", "user-edited"]


@dataclass
class Material:
    id: str
    title: str
    totalMinutes: int | float
    role: MaterialRole
    additionOrder: int


@dataclass
class RoadmapInput:
    materials: list[Material]
    weeks: int
    startDate: str
    selectedStudyDays: list[DayOfWeek]
    weekdayHours: int | float
    weekendHours: int | float


@dataclass
class Slot:
    weekIndex: int
    dayOfWeek: DayOfWeek
    date: str
    capacityMinutes: int
    role: MaterialRole | None
    candidateMaterialIds: list[str]
    plannedMinutes: int | float
    sessionTitle: str | None


@dataclass
class RoadmapWeek:
    weekIndex: int
    startDate: str
    slots: list[Slot]


@dataclass
class Warning:
    kind: WarningKind
    detail: dict[str, Any]


@dataclass
class CapacityCheck:
    totalCapacityMinutes: int | float
    totalMaterialMinutes: int | float
    status: CapacityStatus
    suggestedWeeks: int | None = None


@dataclass
class RoadmapOutput:
    weeks: list[RoadmapWeek]
    warnings: list[Warning]
    capacityCheck: CapacityCheck


@dataclass
class Pin:
    weekIndex: int
    dayOfWeek: DayOfWeek
    materialId: str | None
    sessionTitle: str | None
    plannedMinutes: int | float
    reason: PinReason


PinSet = list[Pin]
