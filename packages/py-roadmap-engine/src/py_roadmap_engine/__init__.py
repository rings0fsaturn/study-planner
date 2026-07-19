"""Pillar A roadmap engine — port of @study-tracker/roadmap-engine."""

__version__ = "0.1.0"

from py_roadmap_engine.engine import (
    add_material_to_roadmap,
    generate_roadmap,
    infer_role,
    regenerate_roadmap,
    remove_material_from_roadmap,
)
from py_roadmap_engine.types import (
    CapacityCheck,
    Material,
    Pin,
    RoadmapInput,
    RoadmapOutput,
    RoadmapWeek,
    Slot,
    Warning,
)

__all__ = [
    "CapacityCheck",
    "Material",
    "Pin",
    "RoadmapInput",
    "RoadmapOutput",
    "RoadmapWeek",
    "Slot",
    "Warning",
    "add_material_to_roadmap",
    "generate_roadmap",
    "infer_role",
    "regenerate_roadmap",
    "remove_material_from_roadmap",
]
