from __future__ import annotations

from fastapi import APIRouter
from py_roadmap_engine import generate_roadmap, regenerate_roadmap

from app.schemas.roadmap import RoadmapGenerateRequest, RoadmapRegenerateRequest, dump_model
from app.serialize import to_json_value

router = APIRouter()


@router.post("/roadmap/generate")
def generate(payload: RoadmapGenerateRequest) -> dict:
    result = generate_roadmap(dump_model(payload))
    return to_json_value(result)


@router.post("/roadmap/regenerate")
def regenerate(payload: RoadmapRegenerateRequest) -> dict:
    data = dump_model(payload)
    result = regenerate_roadmap(data["input"], data.get("pins", []))
    return to_json_value(result)
