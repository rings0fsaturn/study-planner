from __future__ import annotations

import re
from dataclasses import dataclass, field
from re import Pattern

from py_roadmap_engine.types import MaterialRole

DAY_OFFSETS: dict[str, int] = {
    "Mon": 0,
    "Tue": 1,
    "Wed": 2,
    "Thu": 3,
    "Fri": 4,
    "Sat": 5,
    "Sun": 6,
}

WEEKEND_DAYS: list[str] = ["Sat", "Sun"]
WEEKDAY_DAYS: list[str] = ["Mon", "Tue", "Wed", "Thu", "Fri"]


@dataclass
class InferenceRules:
    practiceKeywords: Pattern[str] = field(
        default_factory=lambda: re.compile(r"mock|leetcode|exercise|problem set", re.IGNORECASE)
    )
    interviewKeyword: Pattern[str] = field(
        default_factory=lambda: re.compile(r"interview", re.IGNORECASE)
    )
    interviewSizeThreshold: int = 200


@dataclass
class RoadmapConfig:
    underCapacityBufferThreshold: float = 1.3
    materialTotalTolerance: float = 0.15
    anchorStrideMax: int = 2
    inferenceRules: InferenceRules = field(default_factory=InferenceRules)


DEFAULT_ROADMAP_CONFIG = RoadmapConfig()

ROLE_TO_LABEL: dict[MaterialRole, str] = {
    "anchor": "Main reading",
    "foundation": "Foundations",
    "practice": "Practice",
}

LABEL_TO_ROLE: dict[str, MaterialRole] = {
    "Main reading": "anchor",
    "Foundations": "foundation",
    "Practice": "practice",
}
