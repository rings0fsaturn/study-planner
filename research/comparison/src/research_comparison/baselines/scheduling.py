from __future__ import annotations

from dataclasses import replace
from datetime import date, timedelta
from typing import Literal

from py_roadmap_engine import CapacityCheck, RoadmapInput, RoadmapOutput, RoadmapWeek, Slot, Warning
from py_roadmap_engine.types import Material

DAY_OFFSETS = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}
ROLE_ORDER = {"anchor": 0, "foundation": 1, "practice": 2}

OrderMode = Literal["addition", "short_first", "long_first"]


def _topological_materials(
    materials: list[Material],
    *,
    mode: OrderMode = "addition",
) -> list[Material]:
    def secondary(material: Material) -> tuple[float, int]:
        if mode == "short_first":
            return (float(material.totalMinutes), material.additionOrder)
        if mode == "long_first":
            return (-float(material.totalMinutes), material.additionOrder)
        return (float(material.additionOrder), material.additionOrder)

    return sorted(
        materials,
        key=lambda material: (ROLE_ORDER[material.role], *secondary(material)),
    )


def _capacity_for_day(input_data: RoadmapInput, day: str) -> int:
    selected_weekdays = [d for d in input_data.selectedStudyDays if d not in {"Sat", "Sun"}]
    selected_weekends = [d for d in input_data.selectedStudyDays if d in {"Sat", "Sun"}]
    if day in {"Sat", "Sun"}:
        return round((input_data.weekendHours * 60) / max(1, len(selected_weekends)))
    return round((input_data.weekdayHours * 60) / max(1, len(selected_weekdays)))


def _slot_grid(input_data: RoadmapInput) -> list[Slot]:
    start = date.fromisoformat(input_data.startDate)
    slots: list[Slot] = []
    for week in range(input_data.weeks):
        for day in input_data.selectedStudyDays:
            slots.append(
                Slot(
                    weekIndex=week,
                    dayOfWeek=day,
                    date=(start + timedelta(days=week * 7 + DAY_OFFSETS[day])).isoformat(),
                    capacityMinutes=_capacity_for_day(input_data, day),
                    role=None,
                    candidateMaterialIds=[],
                    plannedMinutes=0,
                    sessionTitle=None,
                )
            )
    return sorted(slots, key=lambda slot: (slot.date, DAY_OFFSETS[slot.dayOfWeek]))


def _capacity_check(input_data: RoadmapInput, slots: list[Slot]) -> CapacityCheck:
    total_capacity = sum(slot.capacityMinutes for slot in slots)
    total_material = sum(material.totalMinutes for material in input_data.materials)
    if total_material > total_capacity:
        return CapacityCheck(total_capacity, total_material, "over-capacity")
    return CapacityCheck(total_capacity, total_material, "fits")


def _weeks_from_slots(
    slots: list[Slot],
    input_data: RoadmapInput,
    warnings: list[Warning],
) -> RoadmapOutput:
    weeks: list[RoadmapWeek] = []
    start = date.fromisoformat(input_data.startDate)
    for week_index in range(input_data.weeks):
        week_slots = [slot for slot in slots if slot.weekIndex == week_index]
        weeks.append(
            RoadmapWeek(
                weekIndex=week_index,
                startDate=(start + timedelta(days=week_index * 7)).isoformat(),
                slots=week_slots,
            )
        )
    return RoadmapOutput(
        weeks=weeks,
        warnings=warnings,
        capacityCheck=_capacity_check(input_data, slots),
    )


def _allocate(
    input_data: RoadmapInput,
    materials: list[Material],
    *,
    overflow_last_slot: bool,
) -> RoadmapOutput:
    slots = _slot_grid(input_data)
    warnings: list[Warning] = []
    slot_index = 0
    for material in materials:
        remaining = float(material.totalMinutes)
        session = 1
        while remaining > 1e-6 and slot_index < len(slots):
            slot = slots[slot_index]
            available = float(slot.capacityMinutes)
            if available <= 0:
                slot_index += 1
                continue
            planned = min(available, remaining)
            slot.role = material.role
            slot.candidateMaterialIds = [material.id]
            slot.plannedMinutes = round(planned, 3)
            slot.sessionTitle = f"{material.title} · session {session}"
            remaining -= planned
            session += 1
            slot_index += 1
        if remaining > 1e-6:
            warnings.append(
                Warning(
                    "over-capacity",
                    {"materialId": material.id, "overflowMinutes": round(remaining, 3)},
                )
            )
            if overflow_last_slot and slots:
                slot = slots[-1]
                slot.role = material.role
                slot.candidateMaterialIds = [material.id]
                slot.plannedMinutes = round(float(slot.plannedMinutes) + remaining, 3)
                slot.sessionTitle = f"{material.title} · overflow"
    return _weeks_from_slots(slots, input_data, warnings)


def schedule_dp(input_data: RoadmapInput) -> RoadmapOutput:
    """Capacity-respecting DP-style baseline: role order, then smaller jobs first."""
    materials = _topological_materials(input_data.materials, mode="short_first")
    return _allocate(replace(input_data, materials=materials), materials, overflow_last_slot=False)


def schedule_rule_based(input_data: RoadmapInput) -> RoadmapOutput:
    """Fixed heuristic baseline: anchor, foundation, practice, original addition order."""
    materials = _topological_materials(input_data.materials, mode="addition")
    return _allocate(replace(input_data, materials=materials), materials, overflow_last_slot=True)


def schedule_topological_prereq(input_data: RoadmapInput) -> RoadmapOutput:
    """Prerequisite-first scheduler: topological role order, then original order."""
    materials = _topological_materials(input_data.materials, mode="addition")
    return _allocate(replace(input_data, materials=materials), materials, overflow_last_slot=False)


def schedule_local_search_repair(input_data: RoadmapInput) -> RoadmapOutput:
    """Local repair over prerequisite-safe orders; picks the least overflowing schedule."""
    candidates = [
        _topological_materials(input_data.materials, mode="addition"),
        _topological_materials(input_data.materials, mode="short_first"),
        _topological_materials(input_data.materials, mode="long_first"),
    ]
    outputs = [
        _allocate(replace(input_data, materials=materials), materials, overflow_last_slot=False)
        for materials in candidates
    ]

    def objective(output: RoadmapOutput) -> tuple[float, int]:
        overflow = sum(
            float(warning.detail.get("overflowMinutes", 0.0))
            for warning in output.warnings
            if warning.kind == "over-capacity"
        )
        filled_slots = sum(
            1
            for week in output.weeks
            for slot in week.slots
            if float(slot.plannedMinutes) > 0
        )
        return (overflow, filled_slots)

    return min(outputs, key=objective)


def ortools_available() -> bool:
    try:
        from ortools.sat.python import cp_model  # noqa: F401
    except ImportError:
        return False
    return True


def schedule_cpsat_optimum(input_data: RoadmapInput) -> RoadmapOutput:
    """CP-SAT upper bound over prerequisite-safe material ordering."""
    try:
        from ortools.sat.python import cp_model
    except ImportError as exc:
        raise RuntimeError("ortools is not installed") from exc

    materials = list(input_data.materials)
    if not materials:
        return _allocate(input_data, materials, overflow_last_slot=False)

    model = cp_model.CpModel()
    positions = {
        material.id: model.NewIntVar(0, len(materials) - 1, f"pos_{material.id}")
        for material in materials
    }
    model.AddAllDifferent(list(positions.values()))
    for left in materials:
        for right in materials:
            if ROLE_ORDER[left.role] < ROLE_ORDER[right.role]:
                model.Add(positions[left.id] < positions[right.id])

    objective_terms = []
    for material in materials:
        role_weight = ROLE_ORDER[material.role] * 1000 + int(material.additionOrder)
        objective_terms.append(role_weight * positions[material.id])
    model.Minimize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 1.0
    status = solver.Solve(model)
    if status not in {cp_model.OPTIMAL, cp_model.FEASIBLE}:
        return schedule_topological_prereq(input_data)

    ordered = sorted(materials, key=lambda material: solver.Value(positions[material.id]))
    return _allocate(replace(input_data, materials=ordered), ordered, overflow_last_slot=False)
