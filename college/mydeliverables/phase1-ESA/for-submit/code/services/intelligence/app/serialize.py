from __future__ import annotations

from dataclasses import fields, is_dataclass
from typing import Any

from py_roadmap_engine.types import CapacityCheck as RoadmapCapacityCheck


def to_json_value(obj: Any) -> Any:
    if is_dataclass(obj) and not isinstance(obj, type):
        if isinstance(obj, RoadmapCapacityCheck):
            return {
                field.name: to_json_value(getattr(obj, field.name))
                for field in fields(obj)
                if field.name != "suggestedWeeks" or getattr(obj, field.name) is not None
            }
        return {
            field.name: to_json_value(getattr(obj, field.name))
            for field in fields(obj)
        }
    if isinstance(obj, dict):
        return {key: to_json_value(value) for key, value in obj.items()}
    if isinstance(obj, list):
        return [to_json_value(value) for value in obj]
    if isinstance(obj, tuple):
        return [to_json_value(value) for value in obj]
    return obj
