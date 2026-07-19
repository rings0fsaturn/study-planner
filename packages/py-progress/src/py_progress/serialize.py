from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any


def to_json_value(obj: Any) -> Any:
    if is_dataclass(obj) and not isinstance(obj, type):
        return {k: to_json_value(v) for k, v in asdict(obj).items()}
    if isinstance(obj, dict):
        return {k: to_json_value(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_json_value(v) for v in obj]
    if isinstance(obj, tuple):
        return [to_json_value(v) for v in obj]
    return obj
