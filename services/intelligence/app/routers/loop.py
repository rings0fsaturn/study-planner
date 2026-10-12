"""Closed-loop action verdict (#49 Slice 1, builds on the loop v1 lock).

`POST /v1/loop/decision` asks Jev (`jev-1.13` via `JevClient.decide`) which
advisory action fits the week - `hold` / `reprioritize` / `suggest_replan` -
over the v1 state ceiling (`signals[]` + `evidence_summary` + `posture`).
Owner-scoped to the request's materials; advisory only, never writes.

The whole request is the prompt ceiling: signals, the code-computed
evidence summary, and posture. Skill tags travel as untrusted data inside
the JSON state and titles are validated labels excluded from it; chunk
text, answers, rubrics, solutions, and hidden tests never enter the prompt
because they never enter the request.
The code router (`route_loop_action`) stays fail-closed: thin evidence, a
low-confidence verdict, the middle band, or an unknown choice all land on
`hold` and the caller renders the static copy. Any failure surfaces as a
typed service error so the caller falls back and never blocks.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request

from app.dependencies import get_user_client
from app.ingestion.models import ERROR_CODES, IngestionError
from app.jev.client import JevClient, JevError
from app.jev.questions import loop_questions, route_loop_action
from app.middleware import request_id_from_request
from app.routers.serialization import service_error
from app.userrest import UserScopedClient

router = APIRouter()

logger = logging.getLogger("app.routers.loop")

#: Caps mirror the feedback arm so one client envelope stays bounded.
_MAX_MATERIALS = 50
_MAX_SIGNALS = 200
#: Per-string bounds mirror the feedback prompt ceilings (untrusted data).
_TITLE_MAX_CHARS = 200
_SKILL_MAX_CHARS = 120

_jev_client: JevClient | None = None

#: Jev failure codes onto the typed service contract (cf. ERROR_CODES).
_JEV_TO_SERVICE = {
    "provider_credentials": "provider_credentials",
    "quota_failure": "quota_exhausted",
    "timeout": "provider_timeout",
    "provider_unavailable": "provider_unavailable",
    "malformed": "malformed_output",
    "provider_error": "provider_unavailable",
}


def _get_jev_client() -> JevClient:
    """One shared loop client; tests inject a fake via module `_jev_client`."""
    global _jev_client
    if _jev_client is None:
        _jev_client = JevClient.from_env()
    return _jev_client


def _invalid(request: Request, message: str):
    return service_error(request, IngestionError("invalid_request", message))


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _unit_number(value: Any) -> bool:
    return _is_number(value) and 0.0 <= float(value) <= 1.0


def _nonneg_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _as_signal(row: Any) -> dict | None:
    """Normalize one mastery signal row; None when it breaks the ceiling."""
    if not isinstance(row, dict):
        return None
    material = row.get("material")
    skill = row.get("skill")
    if not material or not isinstance(material, str):
        return None
    if len(material) > _TITLE_MAX_CHARS:
        return None
    if not skill or not isinstance(skill, str):
        return None
    if not _unit_number(row.get("mastery")):
        return None
    if not _unit_number(row.get("confidence")):
        return None
    if not _nonneg_int(row.get("observations")):
        return None
    if not _is_number(row.get("trend", 0.0)):
        return None
    return {
        "material": str(material),
        "skill": str(skill)[:_SKILL_MAX_CHARS],
        "mastery": float(row["mastery"]),
        "confidence": float(row["confidence"]),
        "observations": row["observations"],
        "trend": float(row.get("trend") or 0.0),
    }


def _as_evidence_summary(value: Any) -> dict | None:
    """Normalize the code-computed evidence summary; None when off-ceiling."""
    if not isinstance(value, dict):
        return None
    for key in (
        "total_attempts",
        "skills_observed",
        "min_obs_per_skill",
        "max_obs_per_skill",
        "days_span",
    ):
        if not _nonneg_int(value.get(key)):
            return None
    return {
        key: value[key]
        for key in (
            "total_attempts",
            "skills_observed",
            "min_obs_per_skill",
            "max_obs_per_skill",
            "days_span",
        )
    }


def _as_posture(value: Any) -> dict | None:
    """Normalize the code-computed schedule posture; None when off-ceiling."""
    if not isinstance(value, dict):
        return None
    if not _is_number(value.get("behind_days")):
        return None
    if not _nonneg_int(value.get("days_left")):
        return None
    if not _is_number(value.get("pace_vs_plan")):
        return None
    capacity = value.get("capacity_hours_per_week")
    if not _is_number(capacity) or float(capacity) < 0:
        return None
    return {
        "behind_days": float(value["behind_days"]),
        "days_left": value["days_left"],
        "pace_vs_plan": float(value["pace_vs_plan"]),
        "capacity_hours_per_week": float(capacity),
    }


def _validate(body: Any) -> tuple[dict, str | None]:
    """Validate the loop-decision ceiling; error message or None."""
    if not isinstance(body, dict):
        return {}, "body must be an object"
    material_ids = body.get("materialIds")
    if (
        not isinstance(material_ids, list)
        or not material_ids
        or len(material_ids) > _MAX_MATERIALS
        or any(
            not isinstance(mid, str) or not mid or len(mid) > _TITLE_MAX_CHARS
            for mid in material_ids
        )
    ):
        return {}, "materialIds must be a non-empty list of ids"
    titles = body.get("materialTitles", [])
    if (
        not isinstance(titles, list)
        or len(titles) > _MAX_MATERIALS
        or any(not isinstance(title, str) for title in titles)
    ):
        return {}, "materialTitles must be a list of strings"
    raw_signals = body.get("signals", [])
    if not isinstance(raw_signals, list) or len(raw_signals) > _MAX_SIGNALS:
        return {}, "signals must be a list"
    signals = [_as_signal(row) for row in raw_signals]
    if any(row is None for row in signals):
        return {}, "every signal needs material, skill, unit numbers, observations, trend"
    evidence_summary = _as_evidence_summary(body.get("evidence_summary"))
    if evidence_summary is None:
        return {}, "evidence_summary must carry attempt and coverage counts"
    posture = _as_posture(body.get("posture"))
    if posture is None:
        return {}, "posture must carry behind_days, days_left, pace_vs_plan, capacity"
    return (
        {
            "materialIds": [str(mid) for mid in material_ids],
            "materialTitles": [str(title)[:_TITLE_MAX_CHARS] for title in titles],
            "signals": [row for row in signals if row is not None],
            "evidence_summary": evidence_summary,
            "posture": posture,
        },
        None,
    )


def _jev_error(request: Request, exc: JevError):
    """Map a Jev failure onto a typed service error (fail-closed hold upstream)."""
    code = _JEV_TO_SERVICE.get(exc.code, exc.code)
    if code not in ERROR_CODES:
        code = "provider_unavailable"
    request_id = request_id_from_request(request)
    logger.warning(
        "loop decision unavailable",
        extra={
            "request_id": request_id,
            "code": code,
            "provider_code": exc.code,
            "retryable": exc.retryable,
        },
    )
    return service_error(
        request,
        IngestionError(code, "loop decision unavailable", retryable=exc.retryable),
    )


@router.post("/loop/decision")
def loop_decision(
    body: dict,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16),
):
    """Decide one advisory loop action for owned materials over the v1 ceiling."""
    parsed, error = _validate(body)
    if error is not None:
        return _invalid(request, error)
    owned = set(parsed["materialIds"])
    owned.update(row["material"] for row in parsed["signals"])
    try:
        for material_id in sorted(owned):
            client.get_material(material_id)
    except IngestionError as exc:
        return service_error(request, exc)

    request_id = request_id_from_request(request)
    state = {
        "signals": parsed["signals"],
        "evidence_summary": parsed["evidence_summary"],
        "posture": parsed["posture"],
    }
    try:
        result = _get_jev_client().decide(state, loop_questions(), request_id=request_id)
    except JevError as exc:
        return _jev_error(request, exc)
    except Exception:
        logger.exception("loop decision failed", extra={"request_id": request_id})
        return service_error(request, IngestionError("internal_error", "loop decision unavailable"))

    action = result.answers.get("loop_action") or {}
    sufficient = result.answers.get("evidence_sufficient") or {}
    choice = str(action.get("choice") or "")
    # Fail closed on non-numeric Jev numbers: a string "0.95" must hold, not
    # pass the gate. (bool is an int subclass, so it is rejected explicitly.)
    raw_confidence = action.get("confidence", 0.0)
    if isinstance(raw_confidence, bool) or not isinstance(raw_confidence, (int, float)):
        logger.warning(
            "loop decision coerced confidence to hold",
            extra={"request_id": request_id, "choice": choice},
        )
        confidence = 0.0
    else:
        confidence = float(raw_confidence)
    raw_sufficiency = sufficient.get("noul", 0.0)
    if isinstance(raw_sufficiency, bool) or not isinstance(raw_sufficiency, (int, float)):
        logger.warning(
            "loop decision coerced sufficiency to hold",
            extra={"request_id": request_id, "choice": choice},
        )
        sufficiency = 0.0
    else:
        sufficiency = float(raw_sufficiency)
    verdict = route_loop_action(choice, confidence, sufficiency)
    logger.info(
        "loop decision",
        extra={
            "request_id": request_id,
            "choice": choice,
            "confidence": confidence,
            "sufficiency": sufficiency,
            "verdict": verdict,
            "model": result.model,
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
        },
    )
    return {
        "verdict": verdict,
        "choice": choice,
        "confidence": confidence,
        "sufficiency": sufficiency,
        "model": result.model,
    }
