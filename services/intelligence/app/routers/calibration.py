from __future__ import annotations

from fastapi import APIRouter
from py_progress import compute_calibration, get_prompt_detail

from app.schemas.progress import CalibrationRequest, PromptDetailRequest, dump_model
from app.serialize import to_json_value

router = APIRouter()


@router.post("/calibration")
def calibration(payload: CalibrationRequest) -> dict:
    data = dump_model(payload)
    result = compute_calibration(
        data.get("sessions", []),
        data.get("exceptionalTags", []),
        data.get("resolutions", []),
        data.get("nextContext"),
    )
    return to_json_value(result)


@router.post("/calibration/prompt-detail")
def prompt_detail(payload: PromptDetailRequest) -> dict:
    data = dump_model(payload)
    result = get_prompt_detail(data.get("sessions", []), data.get("breakpoints", []))
    return to_json_value(result)
