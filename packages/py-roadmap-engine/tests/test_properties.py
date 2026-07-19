from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any

from py_roadmap_engine import generate_roadmap


def _to_json_value(obj: Any) -> Any:
    if is_dataclass(obj) and not isinstance(obj, type):
        return {k: _to_json_value(v) for k, v in asdict(obj).items()}
    if isinstance(obj, dict):
        return {k: _to_json_value(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_json_value(v) for v in obj]
    return obj


VALID_INPUTS = [
    {
        "materials": [
            {"id": "ddia", "title": "DDIA", "totalMinutes": 600, "role": "anchor", "additionOrder": 0},
            {"id": "cap", "title": "CAP", "totalMinutes": 200, "role": "foundation", "additionOrder": 1},
            {"id": "mock", "title": "Mock interviews", "totalMinutes": 300, "role": "practice", "additionOrder": 2},
        ],
        "weeks": 8,
        "startDate": "2026-04-29",
        "selectedStudyDays": ["Mon", "Wed", "Sat"],
        "weekdayHours": 2,
        "weekendHours": 3,
    },
    {
        "materials": [
            {"id": "foundation", "title": "Foundations", "totalMinutes": 180, "role": "foundation", "additionOrder": 0},
            {"id": "practice", "title": "Practice", "totalMinutes": 120, "role": "practice", "additionOrder": 1},
        ],
        "weeks": 3,
        "startDate": "2026-04-29",
        "selectedStudyDays": ["Tue", "Thu", "Sun"],
        "weekdayHours": 3,
        "weekendHours": 2,
    },
    {
        "materials": [
            {"id": "anchor", "title": "Main text", "totalMinutes": 300, "role": "anchor", "additionOrder": 0},
        ],
        "weeks": 6,
        "startDate": "2026-04-29",
        "selectedStudyDays": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "weekdayHours": 5,
        "weekendHours": 0,
    },
]


def test_determinism_same_input_produces_identical_output() -> None:
    for roadmap_input in VALID_INPUTS:
        first = _to_json_value(generate_roadmap(roadmap_input))
        second = _to_json_value(generate_roadmap(roadmap_input))
        assert first == second


def test_foundation_never_appears_in_last_third_for_three_or_more_weeks() -> None:
    for roadmap_input in VALID_INPUTS:
        if roadmap_input["weeks"] < 3:
            continue
        cutoff = (2 * roadmap_input["weeks"]) // 3
        result = generate_roadmap(roadmap_input)
        for week in result.weeks:
            if week.weekIndex >= cutoff:
                assert all(slot.role != "foundation" for slot in week.slots)


def test_practice_never_appears_in_first_third_for_three_or_more_weeks() -> None:
    for roadmap_input in VALID_INPUTS:
        if roadmap_input["weeks"] < 3:
            continue
        cutoff = roadmap_input["weeks"] // 3
        result = generate_roadmap(roadmap_input)
        for week in result.weeks:
            if week.weekIndex < cutoff:
                assert all(slot.role != "practice" for slot in week.slots)
