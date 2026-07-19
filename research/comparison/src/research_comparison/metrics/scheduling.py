from __future__ import annotations

import statistics
from datetime import date
from typing import Any

from py_roadmap_engine import RoadmapOutput, Slot


def flatten_slots(output: RoadmapOutput) -> list[Slot]:
    return [slot for week in output.weeks for slot in week.slots]


def planned_slots(output: RoadmapOutput) -> list[Slot]:
    return [slot for slot in flatten_slots(output) if float(slot.plannedMinutes) > 0]


def capacity_violation_rate(output: RoadmapOutput) -> float:
    slots = planned_slots(output)
    if not slots:
        return 0.0
    overfilled = sum(
        1 for slot in slots if float(slot.plannedMinutes) > float(slot.capacityMinutes) + 1e-6
    )
    return overfilled / len(slots)


def deadline_drift_days(output: RoadmapOutput, deadline: str) -> float:
    slots = planned_slots(output)
    if not slots:
        return 0.0
    finish_date = max(date.fromisoformat(slot.date) for slot in slots)
    return float((finish_date - date.fromisoformat(deadline)).days)


def prereq_order_correctness(output: RoadmapOutput) -> float:
    first_by_role: dict[str, date] = {}
    for slot in planned_slots(output):
        if slot.role is None:
            continue
        first_by_role.setdefault(slot.role, date.fromisoformat(slot.date))
    anchor = first_by_role.get("anchor")
    foundation = first_by_role.get("foundation")
    practice = first_by_role.get("practice")
    if anchor and practice and practice < anchor:
        return 0.0
    if foundation and practice and practice < foundation:
        return 0.0
    return 1.0


def scheduling_metric_row(
    output: RoadmapOutput,
    deadline: str,
    gen_time_ms: float,
) -> dict[str, float]:
    return {
        "deadline_drift_days": deadline_drift_days(output, deadline),
        "capacity_violation_rate": capacity_violation_rate(output),
        "prereq_order_correctness": prereq_order_correctness(output),
        "gen_time_ms": float(gen_time_ms),
    }


def winner_by_material_mix(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    winners: dict[str, dict[str, Any]] = {}
    deployable_rows = [
        row
        for row in rows
        if row.get("candidate_kind") != "upper_bound"
        and not str(row.get("candidate", "")).startswith("oracle")
    ]
    for material_mix in sorted({row["material_mix"] for row in deployable_rows}):
        candidates = sorted(
            {
                row["candidate"]
                for row in deployable_rows
                if row["material_mix"] == material_mix
            }
        )
        scores: dict[str, dict[str, float]] = {}
        for candidate in candidates:
            selected = [
                row
                for row in deployable_rows
                if row["material_mix"] == material_mix and row["candidate"] == candidate
            ]
            if not selected:
                continue
            drift = statistics.fmean(abs(float(row["deadline_drift_days"])) for row in selected)
            capacity = statistics.fmean(float(row["capacity_violation_rate"]) for row in selected)
            prereq = statistics.fmean(float(row["prereq_order_correctness"]) for row in selected)
            gen_time = statistics.fmean(float(row["gen_time_ms"]) for row in selected)
            score = drift + capacity * 25.0 + (1.0 - prereq) * 25.0
            scores[candidate] = {
                "score": float(score),
                "mean_abs_deadline_drift_days": float(drift),
                "capacity_violation_rate": float(capacity),
                "prereq_order_correctness": float(prereq),
                "gen_time_ms": float(gen_time),
            }
        if scores:
            winner = min(scores, key=lambda candidate: scores[candidate]["score"])
            winners[material_mix] = {"winner": winner, "candidates": scores, **scores[winner]}
    return winners
