"""Shared JSON log configuration (logging-tracing P1).

One JSON object per line on stdout: {"ts","level","logger","msg",...extra}.
Level from LOG_LEVEL (default INFO). Idempotent: safe to call twice
(uvicorn reload imports main.py more than once).
"""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime

_CONFIGURED = False


class JsonFormatter(logging.Formatter):
    # ponytail: free-form extra keys pass through unvalidated; a strict schema
    # pays only when a log consumer breaks on an unexpected key.

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.now(UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in (
                "args",
                "asctime",
                "created",
                "exc_info",
                "exc_text",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "module",
                "msecs",
                "msg",
                "name",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "stack_info",
                "taskName",
                "thread",
                "threadName",
            ):
                payload[key] = value
        if record.exc_info and not record.exc_text:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, separators=(",", ":"))


def configure_logging() -> None:
    """Install the shared JSON handler on the root logger (once)."""
    global _CONFIGURED
    if _CONFIGURED:
        return
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, level, logging.INFO))
    _CONFIGURED = True
