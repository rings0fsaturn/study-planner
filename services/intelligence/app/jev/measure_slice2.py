"""Slice-2 sweep summarizer (#76 Phase A): pure aggregation over recorded calls.

One threshold setting at a time: the sweep runner reruns the grid offline on
recorded Nouls with these pure functions, so the grid costs zero spend.
Modeled on ``app/jev/measure_slice1.py``.

A call is ``{"row_id": ..., "label": ..., "nouls": {...}, "scored": bool}``:
``label`` is the hand label (``include`` / ``exclude`` /
``conflicting_evidence``) and ``nouls`` are the recorded Jev Noul floats.
Repeats of one row share its ``row_id``. ``windows`` maps a window id to its
row ids for starvation/floor math (the floor fires exactly on starved
windows, mirroring ``_summarize_passage_shadow``).
"""

from __future__ import annotations

from typing import Any

from app.jev.measure_slice1 import _latency, _scored
from app.jev.questions import route_passage


def _verdict(call: dict[str, Any], thresholds: dict[str, float]) -> str:
    nouls = call.get("nouls") or {}
    return route_passage({key: float(value) for key, value in nouls.items()}, thresholds)


def summarize_passage(
    calls: list[dict[str, Any]],
    *,
    thresholds: dict[str, float],
    windows: dict[str, list[str]] | None = None,
    latencies_ms: list[float] | tuple[float, ...] = (),
) -> dict[str, Any]:
    """Verdict histogram plus keep precision/recall and starvation/floor rates."""
    scored = _scored(calls)
    verdicts = [_verdict(c, thresholds) for c in scored]
    predicted = [v == "include" for v in verdicts]
    actual = [str(c.get("label") or "") == "include" for c in scored]
    tp = sum(p and a for p, a in zip(predicted, actual))
    by_row = {str(c.get("row_id") or ""): v for c, v in zip(scored, verdicts)}
    starved: int | None = None
    if windows is not None:
        starved = sum(
            all(by_row.get(str(rid), "exclude") == "exclude" for rid in rids)
            for rids in windows.values()
        )
    return {
        "n": len(calls),
        "n_scored": len(scored),
        "malformed_rate": (len(calls) - len(scored)) / len(calls) if calls else 0.0,
        "include": sum(v == "include" for v in verdicts),
        "exclude": sum(v == "exclude" for v in verdicts),
        "conflicting": sum(v == "conflicting_evidence" for v in verdicts),
        "include_precision": tp / sum(predicted) if any(predicted) else None,
        "include_recall": tp / sum(actual) if any(actual) else None,
        "starvation_rate": starved / len(windows) if windows else None,
        "floor_rate": starved / len(windows) if windows else None,
        **_latency(latencies_ms),
    }
