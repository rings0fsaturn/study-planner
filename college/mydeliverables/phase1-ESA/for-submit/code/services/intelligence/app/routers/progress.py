from __future__ import annotations

from fastapi import APIRouter
from py_progress import compute_progress

from app.schemas.progress import ProgressRequest, dump_model, to_calibration_state
from app.serialize import to_json_value

router = APIRouter()


@router.post("/progress")
def progress(payload: ProgressRequest) -> dict:
    data = dump_model(payload)
    result = compute_progress(
        data.get("sessions", []),
        data["roadmap"],
        to_calibration_state(payload.calibration),
        data["today"],
    )
    return to_json_value(result)
