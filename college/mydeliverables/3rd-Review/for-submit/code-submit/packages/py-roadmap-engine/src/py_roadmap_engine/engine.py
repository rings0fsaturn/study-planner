from __future__ import annotations

import math
import re
from dataclasses import replace
from datetime import date, timedelta
from re import Pattern
from typing import Any

from py_roadmap_engine.constants import (
    DAY_OFFSETS,
    DEFAULT_ROADMAP_CONFIG,
    WEEKDAY_DAYS,
    WEEKEND_DAYS,
    InferenceRules,
    RoadmapConfig,
)
from py_roadmap_engine.types import (
    CapacityCheck,
    DayOfWeek,
    Material,
    MaterialRole,
    Pin,
    PinSet,
    RoadmapInput,
    RoadmapOutput,
    RoadmapWeek,
    Slot,
    Warning,
    WarningKind,
)

OccupiedSlot = dict[str, Any]


def generate_roadmap(
    input_data: RoadmapInput | dict[str, Any],
    config: RoadmapConfig | dict[str, Any] | None = None,
) -> RoadmapOutput:
    cfg = _merge_config(config)
    return _generate_roadmap_core(_roadmap_input(input_data), cfg, {})


def infer_role(
    title: str,
    estimated_minutes: int | float,
    existing_materials: list[Material] | list[dict[str, Any]],
    config: RoadmapConfig | dict[str, Any] | None = None,
) -> MaterialRole:
    cfg = _merge_config(config)
    rules = cfg.inferenceRules

    if _regex_search(rules.practiceKeywords, title):
        return "practice"
    if _regex_search(rules.interviewKeyword, title) and estimated_minutes < rules.interviewSizeThreshold:
        return "practice"

    existing = [_material(m) for m in existing_materials]
    max_existing = max((m.totalMinutes for m in existing), default=0)
    if estimated_minutes >= max_existing:
        return "anchor"
    return "foundation"


def add_material_to_roadmap(
    roadmap: RoadmapOutput | dict[str, Any],
    new_material: Material | dict[str, Any],
    pins: PinSet | list[dict[str, Any]],
    config: RoadmapConfig | dict[str, Any] | None = None,
) -> RoadmapOutput:
    cfg = _merge_config(config)
    roadmap_obj = _roadmap_output(roadmap)
    material = _material(new_material)
    pin_set = [_pin(p) for p in pins]
    flat_slots = [_copy_slot(s) for week in roadmap_obj.weeks for s in week.slots]
    pinned_keys = {f"{p.weekIndex}:{p.dayOfWeek}" for p in pin_set}

    candidates = [
        s
        for s in flat_slots
        if s.role is None
        and len(s.candidateMaterialIds) == 0
        and f"{s.weekIndex}:{s.dayOfWeek}" not in pinned_keys
    ]

    if len(candidates) == 0:
        warnings = [
            *_copy_warnings(roadmap_obj.warnings),
            Warning(
                kind="over-capacity",
                detail={"materialId": material.id, "slotsNeeded": 1, "slotsAvailable": 0},
            ),
        ]
        return _rebuild_roadmap_output(flat_slots, warnings, cfg)

    avg_capacity = sum(s.capacityMinutes for s in candidates) / len(candidates)
    slots_needed = math.ceil(material.totalMinutes / avg_capacity) if avg_capacity > 0 else 0

    if material.role == "anchor":
        to_place = _pick_evenly_across_weeks(candidates, slots_needed)
    elif material.role == "foundation":
        to_place = sorted(candidates, key=_slot_sort_key)[:slots_needed]
    else:
        to_place = sorted(candidates, key=_slot_sort_key, reverse=True)[:slots_needed]

    warnings = _copy_warnings(roadmap_obj.warnings)
    if len(to_place) < slots_needed:
        warnings.append(
            Warning(
                kind="over-capacity",
                detail={
                    "materialId": material.id,
                    "slotsNeeded": slots_needed,
                    "slotsAvailable": len(to_place),
                },
            )
        )

    session = 0
    remaining = material.totalMinutes
    for slot in to_place:
        if remaining <= 0:
            break
        session += 1
        slot.role = material.role
        slot.candidateMaterialIds = [material.id]
        allocated = min(slot.capacityMinutes, remaining)
        slot.plannedMinutes = allocated
        remaining -= allocated
        slot.sessionTitle = f"{material.title} · session {session} of {len(to_place)}"

    return _rebuild_roadmap_output(flat_slots, warnings, cfg)


def remove_material_from_roadmap(
    roadmap: RoadmapOutput | dict[str, Any],
    material_id: str,
    pins: PinSet | list[dict[str, Any]],
    config: RoadmapConfig | dict[str, Any] | None = None,
) -> RoadmapOutput:
    cfg = _merge_config(config)
    roadmap_obj = _roadmap_output(roadmap)
    pin_set = [_pin(p) for p in pins]
    pinned_keys = {f"{p.weekIndex}:{p.dayOfWeek}" for p in pin_set}
    flat_slots = [_copy_slot(s) for week in roadmap_obj.weeks for s in week.slots]

    for slot in flat_slots:
        key = f"{slot.weekIndex}:{slot.dayOfWeek}"
        if key in pinned_keys:
            continue
        if material_id in slot.candidateMaterialIds:
            slot.candidateMaterialIds = [mid for mid in slot.candidateMaterialIds if mid != material_id]
            if len(slot.candidateMaterialIds) == 0:
                slot.role = None
                slot.plannedMinutes = 0
                slot.sessionTitle = None

    return _rebuild_roadmap_output(flat_slots, _copy_warnings(roadmap_obj.warnings), cfg)


def regenerate_roadmap(
    input_data: RoadmapInput | dict[str, Any],
    pins: PinSet | list[dict[str, Any]],
    config: RoadmapConfig | dict[str, Any] | None = None,
) -> RoadmapOutput:
    cfg = _merge_config(config)
    input_obj = _roadmap_input(input_data)
    pin_set = [_pin(p) for p in pins]

    pinned_minutes: dict[str, int | float] = {}
    for pin in pin_set:
        if pin.materialId:
            pinned_minutes[pin.materialId] = pinned_minutes.get(pin.materialId, 0) + pin.plannedMinutes

    adjusted_materials = [
        replace(m, totalMinutes=max(0, m.totalMinutes - pinned_minutes.get(m.id, 0)))
        for m in input_obj.materials
    ]
    adjusted_materials = [m for m in adjusted_materials if m.totalMinutes > 0]

    occupied: dict[str, OccupiedSlot] = {}
    for pin in pin_set:
        occupied[f"{pin.weekIndex}:{pin.dayOfWeek}"] = {
            "materialId": pin.materialId or "",
            "plannedMinutes": pin.plannedMinutes,
            "sessionTitle": pin.sessionTitle,
        }

    adjusted_input = replace(input_obj, materials=adjusted_materials)
    result = _generate_roadmap_core(adjusted_input, cfg, occupied)

    flat = [_copy_slot(s) for week in result.weeks for s in week.slots]
    pin_overflow_minutes: int | float = 0
    for pin in pin_set:
        slot = next(
            (
                s
                for s in flat
                if s.weekIndex == pin.weekIndex and s.dayOfWeek == pin.dayOfWeek
            ),
            None,
        )
        if slot is None:
            pin_overflow_minutes += pin.plannedMinutes
            continue
        slot.candidateMaterialIds = [pin.materialId] if pin.materialId else []
        slot.plannedMinutes = pin.plannedMinutes
        slot.sessionTitle = pin.sessionTitle
        material = next((m for m in input_obj.materials if m.id == pin.materialId), None)
        slot.role = material.role if material else None

    warnings = _copy_warnings(result.warnings)
    if pin_overflow_minutes > 0:
        warnings.append(Warning(kind="pin-overflow", detail={"overflowMinutes": pin_overflow_minutes}))

    return _rebuild_roadmap_output(flat, warnings, cfg)


def _generate_roadmap_core(
    input_obj: RoadmapInput,
    cfg: RoadmapConfig,
    occupied_slots: dict[str, OccupiedSlot],
) -> RoadmapOutput:
    _validate_inputs(input_obj)
    grid = _build_slot_grid(input_obj)
    total_capacity_minutes = _sum_capacity(grid)
    total_material_minutes = sum(m.totalMinutes for m in input_obj.materials)

    capacity_check = _compute_capacity_check(
        total_capacity_minutes,
        total_material_minutes,
        input_obj,
        cfg,
    )

    warnings: list[Warning] = []
    if capacity_check.status == "over-capacity":
        warnings.append(
            Warning(
                kind="over-capacity",
                detail={"overflowMinutes": total_material_minutes - total_capacity_minutes},
            )
        )
    if capacity_check.status == "under-capacity-buffer":
        warnings.append(
            Warning(
                kind="under-capacity-buffer",
                detail={
                    "bufferMinutes": total_capacity_minutes - total_material_minutes,
                    "suggestedWeeks": capacity_check.suggestedWeeks,
                },
            )
        )

    tagged = _tag_role_candidates(grid, input_obj.materials, input_obj.weeks, cfg, occupied_slots)

    anchor_stride_warning = _check_anchor_stride(tagged, input_obj.weeks, cfg)
    if anchor_stride_warning:
        warnings.append(anchor_stride_warning)

    assigned = _assign_materials_to_slots(tagged, input_obj.materials, cfg)
    _retrofit_session_titles(assigned)

    for material in input_obj.materials:
        allocated = _sum_planned_for_material(assigned, material.id)
        ratio = allocated / material.totalMinutes
        if ratio > 1 + cfg.materialTotalTolerance:
            warnings.append(
                Warning(
                    kind="material-overfilled",
                    detail={"materialId": material.id, "allocated": allocated, "total": material.totalMinutes},
                )
            )
        elif ratio < 1 - cfg.materialTotalTolerance and allocated > 0:
            warnings.append(
                Warning(
                    kind="material-underfilled",
                    detail={"materialId": material.id, "allocated": allocated, "total": material.totalMinutes},
                )
            )

    unresolved_ties = len([s for s in assigned if len(s.candidateMaterialIds) >= 2])
    if unresolved_ties > 0:
        warnings.append(Warning(kind="unresolved-tie-count", detail={"count": unresolved_ties}))

    weeks = _group_slots_into_weeks(assigned, input_obj)
    return RoadmapOutput(weeks=weeks, warnings=warnings, capacityCheck=capacity_check)


def _validate_inputs(input_obj: RoadmapInput) -> None:
    if input_obj.weeks < 1:
        raise ValueError(f"weeks must be >= 1, got {input_obj.weeks}")
    if len(input_obj.materials) == 0:
        raise ValueError("at least one material required")
    if len(input_obj.selectedStudyDays) == 0:
        raise ValueError("at least one study day must be selected")
    if input_obj.weekdayHours < 0 or input_obj.weekendHours < 0:
        raise ValueError("hours must be non-negative")


def _build_slot_grid(input_obj: RoadmapInput) -> list[Slot]:
    slots: list[Slot] = []
    weekday_count = len([d for d in input_obj.selectedStudyDays if _is_weekday(d)])
    weekend_count = len([d for d in input_obj.selectedStudyDays if _is_weekend(d)])
    weekday_per_slot = (input_obj.weekdayHours * 60) / weekday_count if weekday_count > 0 else 0
    weekend_per_slot = (input_obj.weekendHours * 60) / weekend_count if weekend_count > 0 else 0

    for week_index in range(input_obj.weeks):
        for day in input_obj.selectedStudyDays:
            capacity_minutes = weekend_per_slot if _is_weekend(day) else weekday_per_slot
            slots.append(
                Slot(
                    weekIndex=week_index,
                    dayOfWeek=day,
                    date=_add_days_iso(input_obj.startDate, week_index * 7 + DAY_OFFSETS[day]),
                    capacityMinutes=_js_round(capacity_minutes),
                    role=None,
                    candidateMaterialIds=[],
                    plannedMinutes=0,
                    sessionTitle=None,
                )
            )
    return slots


def _sum_capacity(slots: list[Slot]) -> int | float:
    return sum(slot.capacityMinutes for slot in slots)


def _is_weekend(day: DayOfWeek) -> bool:
    return day in WEEKEND_DAYS


def _is_weekday(day: DayOfWeek) -> bool:
    return day in WEEKDAY_DAYS


def _compute_capacity_check(
    total_capacity: int | float,
    total_material: int | float,
    input_obj: RoadmapInput,
    cfg: RoadmapConfig,
) -> CapacityCheck:
    if total_material > total_capacity:
        return CapacityCheck(
            totalCapacityMinutes=total_capacity,
            totalMaterialMinutes=total_material,
            status="over-capacity",
        )
    if total_capacity > total_material * cfg.underCapacityBufferThreshold:
        per_week_capacity = total_capacity / input_obj.weeks
        suggested_weeks = math.ceil(total_material / per_week_capacity)
        return CapacityCheck(
            totalCapacityMinutes=total_capacity,
            totalMaterialMinutes=total_material,
            status="under-capacity-buffer",
            suggestedWeeks=suggested_weeks,
        )
    return CapacityCheck(
        totalCapacityMinutes=total_capacity,
        totalMaterialMinutes=total_material,
        status="fits",
    )


def _tag_role_candidates(
    slots: list[Slot],
    materials: list[Material],
    weeks: int,
    _cfg: RoadmapConfig,
    occupied_slots: dict[str, OccupiedSlot],
) -> list[Slot]:
    roles_with_materials = {m.role for m in materials}
    out: list[Slot] = []

    for slot in slots:
        key = f"{slot.weekIndex}:{slot.dayOfWeek}"
        occupied = occupied_slots.get(key)
        if occupied:
            out.append(
                replace(
                    slot,
                    role=slot.role,
                    candidateMaterialIds=[occupied["materialId"]] if occupied["materialId"] else [],
                    plannedMinutes=occupied["plannedMinutes"],
                    sessionTitle=occupied["sessionTitle"],
                )
            )
        else:
            out.append(_copy_slot(slot))

    if weeks < 3:
        return _tag_short_timeline(out)

    phase1_end = math.floor(weeks / 3)
    phase2_end = math.floor((2 * weeks) / 3)

    for slot in out:
        if slot.role is not None:
            continue

        candidates: list[MaterialRole] = []

        if slot.weekIndex < phase2_end:
            candidates.append("foundation")

        if slot.weekIndex >= phase1_end:
            candidates.append("practice")

        if _slot_is_anchor_candidate(slot, out):
            candidates.append("anchor")

        slot.role = _resolve_role_candidate(
            slot.weekIndex,
            phase1_end,
            phase2_end,
            [candidate for candidate in candidates if candidate in roles_with_materials],
        )

    return out


def _slot_is_anchor_candidate(slot: Slot, all_slots: list[Slot]) -> bool:
    week_slots = [s for s in all_slots if s.weekIndex == slot.weekIndex]
    capacities = [s.capacityMinutes for s in week_slots]
    max_capacity = max(capacities)
    min_capacity = min(capacities)
    is_uniform = min_capacity > 0 and (max_capacity - min_capacity) / min_capacity <= 0.1

    if is_uniform:
        first_slot_of_week = sorted(week_slots, key=_slot_sort_key)[0]
        return slot is first_slot_of_week

    if slot.capacityMinutes < max_capacity:
        return False
    slots_at_max = [s for s in week_slots if s.capacityMinutes == max_capacity]
    if len(slots_at_max) == 1:
        return True
    first_at_max = sorted(slots_at_max, key=_slot_sort_key)[0]
    return slot is first_at_max


def _resolve_role_candidate(
    week_index: int,
    phase1_end: int,
    phase2_end: int,
    candidates: list[MaterialRole],
) -> MaterialRole | None:
    if len(candidates) == 0:
        return None
    if len(candidates) == 1:
        return candidates[0]

    is_early = week_index < phase1_end
    is_late = week_index >= phase2_end

    if is_early:
        if "anchor" in candidates:
            return "anchor"
        if "foundation" in candidates:
            return "foundation"
        return "practice"

    if is_late:
        if "practice" in candidates:
            return "practice"
        if "anchor" in candidates:
            return "anchor"
        return "foundation"

    if "anchor" in candidates:
        return "anchor"
    if "practice" in candidates:
        return "practice"
    return "foundation"


def _tag_short_timeline(slots: list[Slot]) -> list[Slot]:
    i = 0
    total = len(slots)
    foundation_slots = math.floor(total / 3)
    anchor_slots = math.floor(total / 3)

    for _ in range(foundation_slots):
        if i >= total:
            break
        slots[i].role = "foundation"
        i += 1
    for _ in range(anchor_slots):
        if i >= total:
            break
        slots[i].role = "anchor"
        i += 1
    while i < total:
        slots[i].role = "practice"
        i += 1
    return slots


def _check_anchor_stride(slots: list[Slot], _weeks: int, cfg: RoadmapConfig) -> Warning | None:
    anchor_weeks = {s.weekIndex for s in slots if s.role == "anchor"}
    if len(anchor_weeks) == 0:
        return None
    sorted_weeks = sorted(anchor_weeks)
    max_gap = 0
    for i in range(1, len(sorted_weeks)):
        max_gap = max(max_gap, sorted_weeks[i] - sorted_weeks[i - 1])
    if max_gap > cfg.anchorStrideMax:
        return Warning(
            kind="anchor-stride-too-wide",
            detail={"maxGapWeeks": max_gap, "anchorWeeks": sorted_weeks},
        )
    return None


def _assign_materials_to_slots(
    slots: list[Slot],
    materials: list[Material],
    _cfg: RoadmapConfig,
) -> list[Slot]:
    out = [_copy_slot(slot) for slot in slots]
    by_role: dict[MaterialRole, list[Material]] = {
        "anchor": [],
        "foundation": [],
        "practice": [],
    }
    for material in materials:
        by_role[material.role].append(material)
    for role in by_role:
        by_role[role].sort(key=lambda material: material.additionOrder)

    remaining: dict[str, int | float] = {m.id: m.totalMinutes for m in materials}
    session_counter: dict[str, int] = {m.id: 0 for m in materials}

    for role in ["foundation", "anchor", "practice"]:
        queue = list(by_role[role])
        role_slots = sorted([s for s in out if s.role == role], key=_slot_sort_key)

        if len(queue) == 0:
            for slot in role_slots:
                slot.role = None
                slot.candidateMaterialIds = []
                slot.plannedMinutes = 0
                slot.sessionTitle = None
            continue

        boundary_emitted = False

        for slot in role_slots:
            if len(queue) == 0:
                if not boundary_emitted:
                    review_candidates = [m.id for m in by_role[role]]
                    slot.candidateMaterialIds = [*review_candidates, "__rest__"]
                    slot.plannedMinutes = 0
                    slot.sessionTitle = None
                    boundary_emitted = True
                else:
                    slot.role = None
                    slot.candidateMaterialIds = []
                    slot.plannedMinutes = 0
                    slot.sessionTitle = None
                continue

            material = queue.pop(0)
            slot.candidateMaterialIds = [material.id]

            allocated = min(slot.capacityMinutes, remaining.get(material.id, 0))
            slot.plannedMinutes = allocated

            session_num = session_counter.get(material.id, 0) + 1
            session_counter[material.id] = session_num
            slot.sessionTitle = f"{material.title} · session {session_num}"

            left = remaining.get(material.id, 0) - allocated
            remaining[material.id] = left
            if left > 0:
                queue.append(material)

    return out


def _retrofit_session_titles(slots: list[Slot]) -> None:
    actual_session_counts: dict[str, int] = {}
    for slot in slots:
        if len(slot.candidateMaterialIds) == 1:
            material_id = slot.candidateMaterialIds[0]
            actual_session_counts[material_id] = actual_session_counts.get(material_id, 0) + 1

    for slot in slots:
        if len(slot.candidateMaterialIds) == 1 and slot.sessionTitle:
            material_id = slot.candidateMaterialIds[0]
            total = actual_session_counts.get(material_id, 1)
            match = re.search(r"session (\d+)$", slot.sessionTitle)
            if match:
                slot.sessionTitle = re.sub(
                    r"session \d+$",
                    f"session {match.group(1)} of {total}",
                    slot.sessionTitle,
                )


def _sum_planned_for_material(slots: list[Slot], material_id: str) -> int | float:
    return sum(
        slot.plannedMinutes
        for slot in slots
        if material_id in slot.candidateMaterialIds
    )


def _group_slots_into_weeks(slots: list[Slot], input_obj: RoadmapInput) -> list[RoadmapWeek]:
    weeks: list[RoadmapWeek] = []
    for week_index in range(input_obj.weeks):
        weeks.append(
            RoadmapWeek(
                weekIndex=week_index,
                startDate=_add_days_iso(input_obj.startDate, week_index * 7),
                slots=sorted(
                    [slot for slot in slots if slot.weekIndex == week_index],
                    key=_slot_sort_key,
                ),
            )
        )
    return weeks


def _rebuild_roadmap_output(
    flat_slots: list[Slot],
    warnings: list[Warning],
    cfg: RoadmapConfig,
) -> RoadmapOutput:
    week_indices = {slot.weekIndex for slot in flat_slots}
    weeks: list[RoadmapWeek] = []
    for week_index in sorted(week_indices):
        week_slots = sorted([s for s in flat_slots if s.weekIndex == week_index], key=_slot_sort_key)
        weeks.append(
            RoadmapWeek(
                weekIndex=week_index,
                startDate=week_slots[0].date if week_slots else "",
                slots=week_slots,
            )
        )

    total_capacity = sum(slot.capacityMinutes for slot in flat_slots)
    total_material = sum(
        slot.plannedMinutes
        for slot in flat_slots
        if len(slot.candidateMaterialIds) > 0
    )

    is_over_capacity = total_material > total_capacity
    is_under_capacity_buffer = total_capacity > total_material * cfg.underCapacityBufferThreshold
    status = (
        "over-capacity"
        if is_over_capacity
        else "under-capacity-buffer"
        if is_under_capacity_buffer
        else "fits"
    )

    capacity_check = CapacityCheck(
        totalCapacityMinutes=total_capacity,
        totalMaterialMinutes=total_material,
        status=status,
    )

    return RoadmapOutput(weeks=weeks, warnings=warnings, capacityCheck=capacity_check)


def _pick_evenly_across_weeks(slots: list[Slot], count: int) -> list[Slot]:
    if len(slots) == 0 or count <= 0:
        return []
    by_week: dict[int, list[Slot]] = {}
    for slot in slots:
        by_week.setdefault(slot.weekIndex, []).append(slot)
    weeks = sorted(by_week)
    chosen_weeks = _pick_evenly_spaced_weeks(min(count, len(weeks)), len(weeks))
    result: list[Slot] = []
    for idx in chosen_weeks:
        week = weeks[idx]
        slot = by_week.get(week, [None])[0]
        if slot:
            result.append(slot)
        if len(result) >= count:
            break
    return result


def _pick_evenly_spaced_weeks(count: int, total: int) -> list[int]:
    if count >= total:
        return list(range(total))
    result: list[int] = []
    for i in range(count):
        week = _js_round((i * total) / count)
        if week not in result and week < total:
            result.append(week)
    next_probe = 0
    while len(result) < count and next_probe < total:
        if next_probe not in result:
            result.append(next_probe)
        next_probe += 1
    return sorted(result)[:count]


def _slot_sort_key(slot: Slot) -> tuple[int, int]:
    return (slot.weekIndex, DAY_OFFSETS[slot.dayOfWeek])


def _add_days_iso(iso: str, days: int) -> str:
    year, month, day = [int(part) for part in iso.split("-")]
    normalized_month_index = month - 1
    normalized_year = year + math.floor(normalized_month_index / 12)
    normalized_month = normalized_month_index % 12 + 1
    base = date(normalized_year, normalized_month, 1)
    dt = base + timedelta(days=day - 1 + days)
    return dt.isoformat()


def _js_round(value: int | float) -> int:
    return math.floor(value + 0.5)


def _regex_search(pattern: Pattern[str] | str, title: str) -> bool:
    if isinstance(pattern, str):
        return re.search(pattern, title, re.IGNORECASE) is not None
    return pattern.search(title) is not None


def _merge_config(config: RoadmapConfig | dict[str, Any] | None) -> RoadmapConfig:
    base = RoadmapConfig(
        underCapacityBufferThreshold=DEFAULT_ROADMAP_CONFIG.underCapacityBufferThreshold,
        materialTotalTolerance=DEFAULT_ROADMAP_CONFIG.materialTotalTolerance,
        anchorStrideMax=DEFAULT_ROADMAP_CONFIG.anchorStrideMax,
        inferenceRules=InferenceRules(
            practiceKeywords=DEFAULT_ROADMAP_CONFIG.inferenceRules.practiceKeywords,
            interviewKeyword=DEFAULT_ROADMAP_CONFIG.inferenceRules.interviewKeyword,
            interviewSizeThreshold=DEFAULT_ROADMAP_CONFIG.inferenceRules.interviewSizeThreshold,
        ),
    )
    if config is None:
        return base
    if isinstance(config, RoadmapConfig):
        return RoadmapConfig(
            underCapacityBufferThreshold=config.underCapacityBufferThreshold,
            materialTotalTolerance=config.materialTotalTolerance,
            anchorStrideMax=config.anchorStrideMax,
            inferenceRules=InferenceRules(
                practiceKeywords=config.inferenceRules.practiceKeywords,
                interviewKeyword=config.inferenceRules.interviewKeyword,
                interviewSizeThreshold=config.inferenceRules.interviewSizeThreshold,
            ),
        )

    data = dict(config)
    rules_data = data.pop("inferenceRules", None)
    for key, value in data.items():
        if hasattr(base, key):
            setattr(base, key, value)
    if rules_data:
        if isinstance(rules_data, InferenceRules):
            base.inferenceRules = rules_data
        else:
            for key, value in dict(rules_data).items():
                if hasattr(base.inferenceRules, key):
                    setattr(base.inferenceRules, key, value)
    return base


def _material(value: Material | dict[str, Any]) -> Material:
    if isinstance(value, Material):
        return value
    return Material(
        id=value["id"],
        title=value["title"],
        totalMinutes=value["totalMinutes"],
        role=value["role"],
        additionOrder=value["additionOrder"],
    )


def _roadmap_input(value: RoadmapInput | dict[str, Any]) -> RoadmapInput:
    if isinstance(value, RoadmapInput):
        return value
    return RoadmapInput(
        materials=[_material(m) for m in value["materials"]],
        weeks=value["weeks"],
        startDate=value["startDate"],
        selectedStudyDays=list(value["selectedStudyDays"]),
        weekdayHours=value["weekdayHours"],
        weekendHours=value["weekendHours"],
    )


def _slot(value: Slot | dict[str, Any]) -> Slot:
    if isinstance(value, Slot):
        return value
    return Slot(
        weekIndex=value["weekIndex"],
        dayOfWeek=value["dayOfWeek"],
        date=value["date"],
        capacityMinutes=value["capacityMinutes"],
        role=value.get("role"),
        candidateMaterialIds=list(value.get("candidateMaterialIds", [])),
        plannedMinutes=value["plannedMinutes"],
        sessionTitle=value.get("sessionTitle"),
    )


def _roadmap_week(value: RoadmapWeek | dict[str, Any]) -> RoadmapWeek:
    if isinstance(value, RoadmapWeek):
        return value
    return RoadmapWeek(
        weekIndex=value["weekIndex"],
        startDate=value["startDate"],
        slots=[_slot(s) for s in value["slots"]],
    )


def _warning(value: Warning | dict[str, Any]) -> Warning:
    if isinstance(value, Warning):
        return value
    return Warning(kind=value["kind"], detail=dict(value["detail"]))


def _capacity_check(value: CapacityCheck | dict[str, Any]) -> CapacityCheck:
    if isinstance(value, CapacityCheck):
        return value
    return CapacityCheck(
        totalCapacityMinutes=value["totalCapacityMinutes"],
        totalMaterialMinutes=value["totalMaterialMinutes"],
        status=value["status"],
        suggestedWeeks=value.get("suggestedWeeks"),
    )


def _roadmap_output(value: RoadmapOutput | dict[str, Any]) -> RoadmapOutput:
    if isinstance(value, RoadmapOutput):
        return value
    return RoadmapOutput(
        weeks=[_roadmap_week(w) for w in value["weeks"]],
        warnings=[_warning(w) for w in value["warnings"]],
        capacityCheck=_capacity_check(value["capacityCheck"]),
    )


def _pin(value: Pin | dict[str, Any]) -> Pin:
    if isinstance(value, Pin):
        return value
    return Pin(
        weekIndex=value["weekIndex"],
        dayOfWeek=value["dayOfWeek"],
        materialId=value.get("materialId"),
        sessionTitle=value.get("sessionTitle"),
        plannedMinutes=value["plannedMinutes"],
        reason=value["reason"],
    )


def _copy_slot(slot: Slot) -> Slot:
    return replace(slot, candidateMaterialIds=list(slot.candidateMaterialIds))


def _copy_warnings(warnings: list[Warning]) -> list[Warning]:
    return [Warning(kind=w.kind, detail=dict(w.detail)) for w in warnings]
