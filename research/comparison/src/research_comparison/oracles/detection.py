from __future__ import annotations

from typing import Any


def detection_oracle_breakpoints(shifts: list[dict[str, Any]]) -> list[int]:
    return sorted(int(shift["onset_index"]) for shift in shifts)
