"""Stateless mastery and adaptive-difficulty endpoints (#43).

`GET /v1/mastery` rebuilds the owner's mastery projection from their durable
graded attempts: every call re-reads the grades and re-runs the BKT forward
filter, so the projection is stateless, owner-scoped (RLS), and rebuildable.
`GET /v1/mastery/recommendations` applies the one-band ~0.7 rule to the same
projection. The service never stores mastery (map #4 #14/#15); the client
supplies the snapshot to generation via `GenerationRequest.masterySnapshot`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.dependencies import get_user_client
from app.ingestion.models import IngestionError
from app.routers.serialization import service_error
from app.userrest import UserScopedClient
from py_progress import MasteryObservation, project_mastery, recommend_band

router = APIRouter()

DEFAULT_BAND = 3


def _observations_by_key(rows: list[dict]) -> dict[tuple[str, str], list[MasteryObservation]]:
    """Group graded attempts into (materialId, skillTag) observation sequences.

    A graded row contributes one observation per entry in
    ``grade.perSkill``; rows without perSkill observations contribute none.
    The grade order (``graded_at.asc``) is the sequence order.
    """
    by_key: dict[tuple[str, str], list[MasteryObservation]] = {}
    for row in rows:
        grade = row.get("grade") or {}
        material_id = grade.get("materialId")
        for skill in grade.get("perSkill", []):
            skill_tag = skill.get("skillTag")
            if not material_id or not skill_tag:
                continue
            by_key.setdefault((material_id, skill_tag), []).append(
                MasteryObservation(
                    skillTag=skill_tag,
                    correct=bool(skill.get("correct", False)),
                    score=float(skill.get("score", 1.0) or 1.0),
                )
            )
    return by_key


@router.get("/mastery")
def get_mastery(
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
    materialId: str | None = None,
    skillTag: str | None = None,
) -> list:
    try:
        rows = client.list_graded_attempts()
        by_key = _observations_by_key(rows)
        return [
            project_mastery(material_id, observations)
            for (material_id, skill_tag), observations in sorted(by_key.items())
            if (materialId is None or material_id == materialId)
            and (skillTag is None or skill_tag == skillTag)
        ]
    except IngestionError as exc:
        return service_error(request, exc)


@router.get("/mastery/recommendations")
def get_mastery_recommendations(
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
    materialId: str | None = None,
    skillTag: str | None = None,
    currentBand: int | None = None,
) -> list:
    try:
        rows = client.list_graded_attempts()
        by_key = _observations_by_key(rows)
        band = currentBand if currentBand is not None else DEFAULT_BAND
        return [
            recommend_band(projection, band)
            for (material_id, skill_tag), observations in sorted(by_key.items())
            if (materialId is None or material_id == materialId)
            and (skillTag is None or skill_tag == skillTag)
            for projection in [project_mastery(material_id, observations)]
        ]
    except IngestionError as exc:
        return service_error(request, exc)