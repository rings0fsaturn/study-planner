from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

from research_comparison.generator.types import MaterialRole

MaterialType = Literal["playlist", "textbook", "practice", "flashcards"]


@dataclass(frozen=True)
class Material:
    material_id: str
    material_type: MaterialType
    role: MaterialRole
    total_minutes: float


_ROLE_BY_TYPE: dict[MaterialType, MaterialRole] = {
    "playlist": "anchor",
    "textbook": "foundation",
    "practice": "practice",
    "flashcards": "practice",
}

_BAND_TOTAL_HOURS = {
    "small": (5.0, 15.0),
    "medium": (25.0, 60.0),
    "max": (80.0, 200.0),
}

_BAND_MATERIAL_COUNTS = {
    "small": (1, 1),
    "medium": (2, 3),
    "max": (3, 5),
}


def role_for_type(material_type: MaterialType) -> MaterialRole:
    return _ROLE_BY_TYPE[material_type]


def sample_material_mix(band: str, rng: np.random.Generator) -> list[Material]:
    min_count, max_count = _BAND_MATERIAL_COUNTS[band]
    count = int(rng.integers(min_count, max_count + 1))
    low_hours, high_hours = _BAND_TOTAL_HOURS[band]
    total_minutes = float(rng.uniform(low_hours, high_hours) * 60)
    weights = rng.dirichlet(np.ones(count))
    material_types: list[MaterialType] = ["playlist", "textbook", "practice", "flashcards"]
    rng.shuffle(material_types)
    selected = material_types[:count]
    return [
        Material(
            material_id=f"{band}-{index}-{material_type}",
            material_type=material_type,
            role=role_for_type(material_type),
            total_minutes=round(total_minutes * float(weights[index]), 6),
        )
        for index, material_type in enumerate(selected)
    ]


def sample_chunk_minutes(material_type: MaterialType, rng: np.random.Generator) -> float:
    if material_type == "playlist":
        return float(rng.uniform(20, 50))
    if material_type == "textbook":
        return float(rng.uniform(40, 90))
    if material_type == "practice":
        return float(np.clip(rng.lognormal(mean=np.log(45), sigma=0.25), 30, 75))
    return float(rng.uniform(10, 20))
