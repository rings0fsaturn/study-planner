from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict

MaterialRole = Literal["anchor", "foundation", "practice"]


class SessionEvent(TypedDict, total=False):
    date: str
    source: Literal["active", "manual"]
    plannedMinutes: float | None
    activeMinutes: float | None
    duration: float
    materialRole: MaterialRole
    materialId: str
    materialChunkMinutes: float
    plannedSessionMinutes: float
    resolution: Literal["complete", "interrupted"]
    materialPosition: float
    bookingId: str
    isAdHoc: bool
    startedAt: str
    sessionId: str


@dataclass(frozen=True)
class Shift:
    onset_index: int
    type: Literal["step", "drift"]
    pre_mean: float
    post_mean: float
    drift_window: tuple[int, int] | None


@dataclass(frozen=True)
class GroundTruth:
    m_global: float
    role_multipliers: dict[str, float]
    context_multipliers: dict[str, float]
    regime_schedule: list[Shift]
    r_star: list[float]
    true_finish_date: str
    is_faker: bool
    clip_rate: float
    study_days: list[str] | None = None
    adherence_bias: float | None = None
    interruption_rate: float | None = None
    adhoc_rate: float | None = None
