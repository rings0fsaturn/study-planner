from __future__ import annotations

import sys
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, TypeVar

T = TypeVar("T")


@dataclass
class ProgressLogger:
    label: str
    enabled: bool = True
    started_at: float = field(default_factory=time.monotonic)

    def log(self, percent: float, state: str, detail: str = "") -> None:
        if not self.enabled:
            return
        pct = max(0, min(100, int(round(percent))))
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        elapsed = int(time.monotonic() - self.started_at)
        suffix = f" detail={detail}" if detail else ""
        print(
            f"[{self.label}-progress] {timestamp} {pct:03d}% state={state} elapsed={elapsed}s{suffix}",
            file=sys.stderr,
            flush=True,
        )


def run_with_heartbeat(
    work: Callable[[], T],
    *,
    logger: ProgressLogger,
    percent: float,
    state: str,
    detail: str,
    heartbeat_seconds: float,
) -> T:
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(work)
        while True:
            try:
                return future.result(timeout=heartbeat_seconds)
            except TimeoutError:
                logger.log(percent, state, f"{detail}; still running")
