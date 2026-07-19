from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

import numpy as np

from research_comparison.generator.materials import Material, sample_chunk_minutes
from research_comparison.generator.types import MaterialRole


@dataclass(frozen=True)
class PlannedSlot:
    date: date
    day_of_week: str
    planned_minutes: float
    material_role: MaterialRole
    material_type: str
    material_id: str
    time_of_day: str
    started_at: str
    same_day_count: int


@dataclass(frozen=True)
class DecoupledBooking:
    booking_id: str
    date: date
    day_of_week: str
    time_of_day: str
    started_at: str
    same_day_count: int
    is_adhoc: bool


_TIME_BY_SLOT = ["morning", "afternoon", "evening"]
_HOUR_BY_TIME = {"morning": 8, "afternoon": 14, "evening": 19}
_DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def _iso_started_at(day: date, time_of_day: str) -> str:
    started = datetime.combine(day, time(_HOUR_BY_TIME[time_of_day], 0), tzinfo=UTC)
    return started.isoformat().replace("+00:00", "Z")


def build_capacity_plan(
    materials: list[Material],
    slots_needed: int,
    rng: np.random.Generator,
    start_date: date | None = None,
) -> list[PlannedSlot]:
    start = start_date or date(2026, 1, 5)
    slots: list[PlannedSlot] = []
    day_offset = 0
    material_index = 0
    while len(slots) < slots_needed:
        day = start + timedelta(days=day_offset)
        weekday = day.weekday()
        slots_today = 2 if weekday >= 5 else 1
        for same_day_count in range(1, slots_today + 1):
            if len(slots) >= slots_needed:
                break
            material = materials[material_index % len(materials)]
            material_index += 1
            time_of_day = _TIME_BY_SLOT[(same_day_count - 1 + day_offset) % len(_TIME_BY_SLOT)]
            slots.append(
                PlannedSlot(
                    date=day,
                    day_of_week=day.strftime("%A").lower(),
                    planned_minutes=round(sample_chunk_minutes(material.material_type, rng), 6),
                    material_role=material.role,
                    material_type=material.material_type,
                    material_id=material.material_id,
                    time_of_day=time_of_day,
                    started_at=_iso_started_at(day, time_of_day),
                    same_day_count=same_day_count,
                )
            )
        day_offset += 1
    return slots


def sample_study_days(
    rng: np.random.Generator,
    count_weights: dict[int, float],
) -> list[str]:
    counts = np.array(sorted(count_weights), dtype=int)
    weights = np.array([count_weights[int(count)] for count in counts], dtype=float)
    probabilities = weights / weights.sum()
    count = int(rng.choice(counts, p=probabilities))
    selected = sorted(int(value) for value in rng.choice(np.arange(7), size=count, replace=False))
    return [_DAY_NAMES[index] for index in selected]


def _rate_count(target_sessions: int, target_rate: float, low: float, high: float) -> int:
    if target_sessions <= 0:
        return 0
    lower = int(np.ceil(target_sessions * low))
    upper = int(np.floor(target_sessions * high))
    if upper < lower:
        upper = lower
    count = int(round(target_sessions * target_rate))
    return max(lower, min(upper, count))


def build_decoupled_bookings(
    target_sessions: int,
    rng: np.random.Generator,
    study_days: list[str],
    adhoc_rate: float,
    start_date: date | None = None,
) -> list[DecoupledBooking]:
    if target_sessions <= 0:
        return []
    start = start_date or date(2026, 1, 5)
    study_day_set = set(study_days)
    adhoc_target = min(target_sessions - 1, _rate_count(target_sessions, adhoc_rate, 0.10, 0.20))
    study_target = target_sessions - adhoc_target

    study_offsets: list[int] = []
    non_study_offsets: list[int] = []
    day_offset = 0
    while len(study_offsets) < study_target or len(non_study_offsets) < adhoc_target:
        day = start + timedelta(days=day_offset)
        day_name = day.strftime("%A").lower()
        if day_name in study_day_set:
            if len(study_offsets) < study_target:
                study_offsets.append(day_offset)
        elif len(non_study_offsets) < max(adhoc_target * 4, adhoc_target):
            non_study_offsets.append(day_offset)
        day_offset += 1

    if adhoc_target > 0:
        adhoc_offsets = sorted(
            int(value) for value in rng.choice(non_study_offsets, size=adhoc_target, replace=False)
        )
    else:
        adhoc_offsets = []
    scheduled = sorted(
        [(offset, False) for offset in study_offsets]
        + [(offset, True) for offset in adhoc_offsets],
        key=lambda row: (row[0], row[1]),
    )

    bookings: list[DecoupledBooking] = []
    for index, (offset, is_adhoc) in enumerate(scheduled):
        day = start + timedelta(days=offset)
        time_of_day = _TIME_BY_SLOT[(offset + index) % len(_TIME_BY_SLOT)]
        prefix = "adhoc" if is_adhoc else "booking"
        bookings.append(
            DecoupledBooking(
                booking_id=f"{prefix}-{index:04d}",
                date=day,
                day_of_week=day.strftime("%A").lower(),
                time_of_day=time_of_day,
                started_at=_iso_started_at(day, time_of_day),
                same_day_count=1,
                is_adhoc=is_adhoc,
            )
        )
    return bookings[:target_sessions]
