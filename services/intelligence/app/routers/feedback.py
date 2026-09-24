"""LLM-backed learner feedback copy (#68, builds on the #50 contract).

`POST /v1/feedback/copy` renders one `FeedbackCopy` for an `updated` roadmap
feedback state through the OpenRouter adapter (`feedback-v1` template, model
`meta/muse-spark-1.3-contributor` unless `FEEDBACK_MODEL` says otherwise).
Owner-scoped to the roadmap's materials; advisory only, never writes.

The whole `FeedbackCopyInput` is the prompt ceiling (D-02): state,
titles, projections, recommendation, evidence. Raw chunk/material text,
answer keys, rubrics, solutions, and hidden tests never enter the prompt
because they never enter the request. One repair attempt on malformed
output (D-03); any failure surfaces as a typed service error so the caller
falls back to the static copy and never blocks (D-05).
"""

from __future__ import annotations

import logging
import os
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Request

from app.dependencies import get_user_client
from app.generation.factory import build_openrouter_adapter
from app.generation.prompts import (
    FEEDBACK_COPY_FIELDS,
    FEEDBACK_PROMPT_TEMPLATE_VERSION,
    build_feedback_messages,
    feedback_copy_schema,
)
from app.ingestion.models import ERROR_CODES, IngestionError
from app.middleware import request_id_from_request
from app.routers.serialization import service_error
from app.userrest import UserScopedClient

router = APIRouter()

logger = logging.getLogger("app.routers.feedback")

FEEDBACK_SCHEMA_NAME = "feedback_copy"
#: #50 D-00: the contract model for this arm (configurable via FEEDBACK_MODEL).
FEEDBACK_MODEL_DEFAULT = "meta/muse-spark-1.3-contributor"

_EVIDENCE_READS = ("clear", "mixed", "revisit")

_MAX_MATERIALS = 50
_MAX_PROJECTIONS = 200
_MAX_EVIDENCE = 50

_adapter = None


def _feedback_model() -> str:
    return os.getenv("FEEDBACK_MODEL", FEEDBACK_MODEL_DEFAULT).strip() or FEEDBACK_MODEL_DEFAULT


def _get_adapter():
    """One shared feedback adapter; safe across worker threads (guide D-07)."""
    global _adapter
    if _adapter is None:
        # Pin the contract model before the factory reads the env, so the
        # adapter and the `source` label can never disagree; an operator
        # `FEEDBACK_MODEL` still wins through the shared factory path.
        os.environ.setdefault("FEEDBACK_MODEL", FEEDBACK_MODEL_DEFAULT)
        _adapter = build_openrouter_adapter("FEEDBACK", FEEDBACK_SCHEMA_NAME)
    return _adapter


def _invalid(request: Request, message: str):
    return service_error(request, IngestionError("invalid_request", message))


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _unit_number(value: Any) -> bool:
    return _is_number(value) and 0.0 <= float(value) <= 1.0


def _as_projection(row: Any) -> dict | None:
    """Normalize one projection row; None when the row breaks the contract."""
    if not isinstance(row, dict):
        return None
    if not row.get("materialId") or not row.get("skillTag") or not row.get("modelVersion"):
        return None
    for key in ("mastery", "uncertainty", "confidence"):
        if not _unit_number(row.get(key)):
            return None
    n = row.get("n")
    if not isinstance(n, int) or isinstance(n, bool) or n < 0:
        return None
    trend = row.get("recentTrend", 0.0)
    if trend is not None and not _is_number(trend):
        return None
    return {
        "materialId": str(row["materialId"]),
        "skillTag": str(row["skillTag"]),
        "mastery": float(row["mastery"]),
        "uncertainty": float(row["uncertainty"]),
        "confidence": float(row["confidence"]),
        "n": n,
        "modelVersion": str(row["modelVersion"]),
        "recentTrend": float(trend or 0.0),
    }


def _as_recommendation(value: Any) -> tuple[dict | None, bool]:
    """Normalize the one-band recommendation; (None, True) is cold start."""
    if value is None:
        return None, True
    if not isinstance(value, dict):
        return None, False
    for key in ("currentBand", "recommendedBand"):
        band = value.get(key)
        if not isinstance(band, int) or isinstance(band, bool):
            return None, False
    target = value.get("targetExpectedCorrectness")
    if not _is_number(target) or not 0.0 < float(target) < 1.0:
        return None, False
    if not value.get("modelVersion"):
        return None, False
    return (
        {
            "materialId": str(value.get("materialId") or ""),
            "skillTag": str(value.get("skillTag") or ""),
            "currentBand": value["currentBand"],
            "recommendedBand": value["recommendedBand"],
            "targetExpectedCorrectness": float(target),
            "modelVersion": str(value["modelVersion"]),
        },
        True,
    )


def _as_evidence(row: Any) -> dict | None:
    """Normalize one evidence row; None when the row breaks the contract."""
    if not isinstance(row, dict):
        return None
    if not row.get("materialId") or not row.get("skillTag"):
        return None
    observations = row.get("observations")
    if not isinstance(observations, int) or isinstance(observations, bool) or observations < 0:
        return None
    if row.get("read") not in _EVIDENCE_READS:
        return None
    trend = row.get("trend", 0.0)
    if trend is not None and not _is_number(trend):
        return None
    return {
        "materialId": str(row["materialId"]),
        "skillTag": str(row["skillTag"]),
        "observations": observations,
        "read": str(row["read"]),
        "trend": float(trend or 0.0),
    }


def _validate(body: Any) -> tuple[dict, str | None]:
    """Validate the FeedbackCopyInput ceiling; error message or None."""
    if not isinstance(body, dict):
        return {}, "body must be an object"
    if body.get("state") != "updated":
        return {}, "feedback copy is only generated for the updated state"
    material_ids = body.get("materialIds")
    if (
        not isinstance(material_ids, list)
        or not material_ids
        or len(material_ids) > _MAX_MATERIALS
        or any(not isinstance(mid, str) or not mid for mid in material_ids)
    ):
        return {}, "materialIds must be a non-empty list of ids"
    titles = body.get("materialTitles", [])
    if (
        not isinstance(titles, list)
        or len(titles) > _MAX_MATERIALS
        or any(not isinstance(title, str) for title in titles)
    ):
        return {}, "materialTitles must be a list of strings"
    raw_projections = body.get("projections", [])
    if not isinstance(raw_projections, list) or len(raw_projections) > _MAX_PROJECTIONS:
        return {}, "projections must be a list"
    projections = [_as_projection(row) for row in raw_projections]
    if any(row is None for row in projections):
        return {}, "every projection needs materialId, skillTag, unit numbers, n, modelVersion"
    recommendation, recommendation_ok = _as_recommendation(body.get("recommendation"))
    if not recommendation_ok:
        return {}, "recommendation must be null or carry bands, target, modelVersion"
    raw_evidence = body.get("evidence", [])
    if not isinstance(raw_evidence, list) or len(raw_evidence) > _MAX_EVIDENCE:
        return {}, "evidence must be a list"
    evidence = [_as_evidence(row) for row in raw_evidence]
    if any(row is None for row in evidence):
        return {}, "every evidence row needs materialId, skillTag, observations, read"
    return (
        {
            "materialIds": [str(mid) for mid in material_ids],
            "materialTitles": [str(title) for title in titles],
            "projections": [row for row in projections if row is not None],
            "recommendation": recommendation,
            "evidence": [row for row in evidence if row is not None],
        },
        None,
    )


def _provider_error(request: Request, response) -> Any:
    """Map a failed adapter response onto a typed service error (D-05)."""
    envelope = response.error or {}
    provider_code = str(envelope.get("code") or "")
    code = provider_code
    if code not in ERROR_CODES:
        # The adapter's generic `provider_error` is not an IngestionError
        # code; `provider_unavailable` keeps the failure typed and retryable.
        code = "provider_unavailable"
    request_id = request_id_from_request(request)
    logger.warning(
        "feedback copy unavailable",
        extra={
            "request_id": request_id,
            "code": code,
            "provider_code": provider_code,
            "retryable": bool(envelope.get("retryable", True)),
        },
    )
    return service_error(
        request,
        IngestionError(
            code, "feedback copy unavailable", retryable=bool(envelope.get("retryable", True))
        ),
    )


@router.post("/feedback/copy")
def copy_feedback(
    body: dict,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16),
):
    """Render one LLM `FeedbackCopy` for owned materials in the updated state."""
    parsed, error = _validate(body)
    if error is not None:
        return _invalid(request, error)
    owned = set(parsed["materialIds"])
    owned.update(row["materialId"] for row in parsed["projections"])
    owned.update(row["materialId"] for row in parsed["evidence"])
    if parsed["recommendation"] and parsed["recommendation"]["materialId"]:
        owned.add(parsed["recommendation"]["materialId"])
    try:
        for material_id in sorted(owned):
            client.get_material(material_id)
    except IngestionError as exc:
        return service_error(request, exc)

    request_id = request_id_from_request(request)
    model = _feedback_model()
    schema = feedback_copy_schema()
    messages = build_feedback_messages(
        parsed["materialTitles"],
        parsed["projections"],
        parsed["recommendation"],
        parsed["evidence"],
    )
    adapter = _get_adapter()
    response = adapter.generate(messages, schema, request_id=request_id, correlation_id=request_id)
    repair_attempted = False
    if response.outcome != "ok" or not response.structured_output:
        if response.outcome != "malformed_output":
            return _provider_error(request, response)
        repair_feedback = str((response.error or {}).get("message") or "output failed validation")
        response = adapter.generate(
            build_feedback_messages(
                parsed["materialTitles"],
                parsed["projections"],
                parsed["recommendation"],
                parsed["evidence"],
                repair_feedback=repair_feedback,
                assistant_content=response.content,
            ),
            schema,
            repair=True,
            request_id=request_id,
            correlation_id=request_id,
        )
        repair_attempted = True
    if response.outcome != "ok" or not response.structured_output:
        logger.warning(
            "feedback copy repair failed",
            extra={"request_id": request_id, "code": (response.error or {}).get("code")},
        )
        return _provider_error(request, response)
    payload = {field: str(response.structured_output[field]) for field in FEEDBACK_COPY_FIELDS}
    logger.info(
        "feedback copy generated",
        extra={
            "request_id": request_id,
            "model": model,
            "template": FEEDBACK_PROMPT_TEMPLATE_VERSION,
            "repair_attempted": repair_attempted,
            "latency_ms": response.latency_ms,
            "materials": len(parsed["materialIds"]),
            "projections": len(parsed["projections"]),
        },
    )
    return {**payload, "source": model}
