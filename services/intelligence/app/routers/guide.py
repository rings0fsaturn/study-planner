"""Owner-scoped Socratic guide endpoints (#46).

`POST /v1/guide/stream` streams tiered Socratic hints as SSE `HintFrame`s
(`contracts/phase2/provider/guide-hint-frame.schema.json`); `POST /v1/guide/reveal`
is the explicit gate for the final `worked_step` tier and returns only a
`GatedRevealAcknowledgement` - never hidden content (D-04).

The guide reads the question through the caller's token (`get_question` selects
the column-granted public columns only), so `answer_block`, reference
solutions, and hidden tests can never enter the prompt or the stream (D-05).
Retrieval is best-effort: a retrieval failure degrades to no citations and
logs, rather than failing the hint.
"""

from __future__ import annotations

import json
import logging
import os
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import StreamingResponse

from app.dependencies import get_user_client
from app.generation.context import build_context
from app.generation.factory import build_openrouter_adapter
from app.generation.models import RetrievedChunk
from app.generation.openrouter_client import GenerationStreamError
from app.generation.prompts import (
    GUIDE_ACTIVE_LINE_MAX_CHARS,
    GUIDE_TIERS,
    build_guide_messages,
)
from app.ingestion.models import IngestionError
from app.middleware import request_id_from_request
from app.routers.serialization import service_error
from app.userrest import UserScopedClient

router = APIRouter()

logger = logging.getLogger("app.routers.guide")

GUIDE_STEER_MAX_CHARS = 1200
CITATION_QUOTE_MAX_CHARS = 300
GUIDE_SCHEMA_NAME = "guide_hint"
REVEAL_EXPLANATION = (
    "Reveal gate satisfied. A worked step is a reference to check against, not to paste."
)

_adapter = None
_http_client: httpx.Client | None = None


def _get_adapter():
    """One shared guide adapter; safe across worker threads (D-07)."""
    global _adapter
    if _adapter is None:
        _adapter = build_openrouter_adapter("GUIDE", GUIDE_SCHEMA_NAME)
    return _adapter


def _get_http_client() -> httpx.Client:
    global _http_client
    if _http_client is None:
        _http_client = httpx.Client(timeout=10.0)
    return _http_client


def _frame(payload: dict) -> str:
    """One SSE data frame; `json.dumps` keeps the payload on a single line."""
    return f"data: {json.dumps(payload)}\n\n"


def _error_frame(
    sequence: int, correlation_id: str, code: str, retryable: bool, request_id: str
) -> str:
    """The contract error frame carries no free-text message (schema is closed)."""
    return _frame(
        {
            "frame": "error",
            "sequence": sequence,
            "correlationId": correlation_id,
            "error": {
                "code": code,
                "retryable": retryable,
                "requestId": request_id,
                "correlationId": correlation_id,
            },
        }
    )


def _active_line_text(work: str, active_line: int | None) -> str:
    if not active_line or not work:
        return ""
    lines = work.splitlines()
    if 1 <= active_line <= len(lines):
        return lines[active_line - 1].strip()[:GUIDE_ACTIVE_LINE_MAX_CHARS]
    return ""


def _guide_steer(question: dict, work: str, active_line_text: str) -> str:
    parts = (str(question.get("prompt") or ""), work, active_line_text)
    return " ".join(part.strip() for part in parts if part and part.strip())[:GUIDE_STEER_MAX_CHARS]


def _retrieve(
    question: dict, work: str, active_line_text: str, request_id: str
) -> list[RetrievedChunk]:
    """Best-effort RAG context; a failure logs and yields no citations (D-06)."""
    material_id = str(question.get("material_id") or "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    if not material_id or not service_key or not supabase_url:
        return []
    steer = _guide_steer(question, work, active_line_text)
    if not steer:
        return []
    try:
        return build_context(
            material_id,
            tuple(str(tag) for tag in (question.get("skill_tags") or []) if tag),
            None,
            supabase_url,
            service_key,
            _get_http_client(),
            steer_override=steer,
        )
    except Exception as exc:
        # D-06: retrieval is best-effort. Any failure (ingestion error, httpx
        # timeout, malformed row) degrades to no citations rather than killing
        # the hint. An unexpected failure is logged with its traceback so a real
        # defect is not hidden as a citation-free hint.
        if isinstance(exc, IngestionError):
            logger.warning(
                "guide retrieval failed; streaming without citations",
                extra={"request_id": request_id, "code": exc.code},
            )
        else:
            logger.exception(
                "guide retrieval crashed; streaming without citations",
                extra={"request_id": request_id, "code": type(exc).__name__},
            )
        return []


def _frames(
    *,
    question: dict,
    tier: str,
    work: str,
    active_line: int | None,
    active_line_text: str,
    request_id: str,
    correlation_id: str,
) -> Iterator[str]:
    """Ordered SSE frames: `start`, citations, deltas, then `done` or `error`."""
    sequence = 0
    try:
        chunks = _retrieve(question, work, active_line_text, request_id)
        messages = build_guide_messages(
            str(question.get("prompt") or ""),
            tier,
            work,
            chunks,
            question_format=str(question.get("format") or ""),
            active_line=active_line,
            active_line_text=active_line_text,
        )
        stream = _get_adapter().stream_text(
            messages, request_id=request_id, correlation_id=correlation_id
        )
        first = next(stream, None)
        if not first:
            yield _error_frame(sequence, correlation_id, "provider_error", True, request_id)
            return
        yield _frame(
            {
                "frame": "start",
                "sequence": sequence,
                "correlationId": correlation_id,
                "text": first,
            }
        )
        sequence += 1
        citations = [
            {
                "chunkId": chunk.chunk_id,
                "materialId": chunk.material_id,
                "quote": chunk.text.strip()[:CITATION_QUOTE_MAX_CHARS],
            }
            for chunk in chunks
            if chunk.chunk_id and chunk.text.strip()
        ]
        if citations:
            yield _frame(
                {
                    "frame": "citation",
                    "sequence": sequence,
                    "correlationId": correlation_id,
                    "citations": citations,
                }
            )
            sequence += 1
        for delta in stream:
            yield _frame(
                {
                    "frame": "delta",
                    "sequence": sequence,
                    "correlationId": correlation_id,
                    "text": delta,
                }
            )
            sequence += 1
        yield _frame({"frame": "done", "sequence": sequence, "correlationId": correlation_id})
    except GenerationStreamError as exc:
        logger.warning(
            "guide stream failed",
            extra={
                "request_id": request_id,
                "correlation_id": correlation_id,
                "code": exc.code,
            },
        )
        yield _error_frame(sequence, correlation_id, exc.code, exc.retryable, request_id)
    except Exception:
        logger.exception(
            "guide stream crashed",
            extra={"request_id": request_id, "correlation_id": correlation_id},
        )
        yield _error_frame(sequence, correlation_id, "internal_error", True, request_id)


def _invalid(request: Request, message: str):
    return service_error(request, IngestionError("invalid_request", message))


def _required_str(body: dict, key: str) -> str:
    return str(body.get(key) or "").strip()


@router.post("/guide/stream")
def stream_guide(
    body: dict,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16),
):
    """Stream tiered Socratic hints for one owned question (D-03)."""
    if not isinstance(body, dict):
        return _invalid(request, "body must be an object")
    question_id = _required_str(body, "questionId")
    tier = _required_str(body, "tier")
    correlation_id = _required_str(body, "correlationId")
    if not question_id:
        return _invalid(request, "questionId is required")
    if tier not in GUIDE_TIERS:
        return _invalid(request, f"tier must be one of {', '.join(GUIDE_TIERS)}")
    if not correlation_id:
        return _invalid(request, "correlationId is required")
    raw_active_line = body.get("activeLine")
    active_line = (
        raw_active_line
        if isinstance(raw_active_line, int)
        and not isinstance(raw_active_line, bool)
        and raw_active_line >= 1
        else None
    )
    work = str(body.get("learnerWork") or "")
    try:
        question = client.get_question(question_id)
    except IngestionError as exc:
        return service_error(request, exc)

    request_id = request_id_from_request(request)
    active_line_text = _active_line_text(work, active_line)
    return StreamingResponse(
        _frames(
            question=question,
            tier=tier,
            work=work,
            active_line=active_line,
            active_line_text=active_line_text,
            request_id=request_id,
            correlation_id=correlation_id,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/guide/reveal")
def reveal_guide(
    body: dict,
    request: Request,
    client: Annotated[UserScopedClient, Depends(get_user_client)],
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=16),
) -> dict:
    """The explicit reveal gate: owned question + owned attempt + confirmation (D-04)."""
    if not isinstance(body, dict):
        return _invalid(request, "body must be an object")
    question_id = _required_str(body, "questionId")
    attempt_id = _required_str(body, "attemptId")
    correlation_id = _required_str(body, "correlationId")
    if body.get("confirmation") is not True:
        return service_error(
            request, IngestionError("forbidden", "reveal confirmation is required")
        )
    if not question_id or not attempt_id or not correlation_id:
        return _invalid(request, "questionId, attemptId and correlationId are required")
    try:
        question = client.get_question(question_id)
        attempts = client.list_attempts(str(question.get("assessment_id") or ""))
    except IngestionError as exc:
        return service_error(request, exc)
    # D-05: the attempt must belong to *this* question, not merely to a sibling
    # question that shares the assessment.
    if not any(
        str(row.get("id") or "") == attempt_id
        and str(row.get("question_id") or "") == question_id
        for row in attempts
    ):
        return service_error(
            request, IngestionError("forbidden", "no owned attempt for this question")
        )
    request_id = request_id_from_request(request)
    logger.info(
        "guide reveal gated",
        extra={
            "request_id": request_id,
            "correlation_id": correlation_id,
            "question_id": question_id,
        },
    )
    return {
        "questionId": question_id,
        "attemptId": attempt_id,
        "gateSatisfied": True,
        "explanation": REVEAL_EXPLANATION,
        "revealedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
    }
