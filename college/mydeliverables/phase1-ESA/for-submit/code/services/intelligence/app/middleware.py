from __future__ import annotations

import json
import logging
import time
import uuid

from fastapi import Request, Response
from py_progress import PRODUCTION_PRIOR_STRATEGY

logger = logging.getLogger("app.middleware")


def request_id_from_request(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    if isinstance(request_id, str) and request_id:
        return request_id
    header_request_id = request.headers.get("X-Request-ID")
    if header_request_id:
        return header_request_id
    return str(uuid.uuid4())


async def request_context_middleware(request: Request, call_next) -> Response:
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()
    status = 500

    try:
        response = await call_next(request)
        status = response.status_code
    except Exception:
        status = 500
        raise
    finally:
        latency_ms = round((time.perf_counter() - started) * 1000, 3)
        logger.info(
            json.dumps(
                {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": status,
                    "latency_ms": latency_ms,
                },
                separators=(",", ":"),
            )
        )

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Model-Version"] = PRODUCTION_PRIOR_STRATEGY
    return response
