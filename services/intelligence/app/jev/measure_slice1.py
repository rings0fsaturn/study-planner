"""Slice-1 sweep summarizer (#75 Phase A2): pure aggregation over recorded calls.

One threshold setting at a time: the sweep runner reruns the grid offline on
recorded choice/confidence with these pure functions, so the grid costs zero
spend. Modeled on ``app/jev/measure.py``.

A call is ``{"row_id": ..., "label": ..., "choice": ..., "confidence": ...,
"scored": bool}``: ``label`` is the hand label (suitability: ``derivable`` /
``not_derivable``; citation: ``verified`` / ``contradicted`` / ``unsupported``)
and ``choice``/``confidence`` are the recorded Jev answer fields. Repeats of
one row share its ``row_id`` (variants x repeats) for jitter/flip math.
"""

from __future__ import annotations

from typing import Any

from app.jev.measure import _percentile
from app.jev.questions import route_citation, route_suitability

_CITATION_REJECTS = ("contradicted", "unsupported")


def _scored(calls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [c for c in calls if c.get("scored", c.get("confidence") is not None)]


def _verdict_suitability(call: dict[str, Any], approve_at: float, block_at: float) -> str:
    import app.jev.questions as _q

    saved_approve, saved_block = _q.APPROVE_AT, _q.BLOCK_AT
    _q.APPROVE_AT, _q.BLOCK_AT = approve_at, block_at
    try:
        return route_suitability(str(call.get("choice") or ""), float(call["confidence"]))
    finally:
        _q.APPROVE_AT, _q.BLOCK_AT = saved_approve, saved_block


def _verdict_citation(call: dict[str, Any], stands_at: float) -> tuple[str, bool]:
    import app.jev.questions as _q

    saved_auto = _q.AUTO_ACCEPT
    _q.AUTO_ACCEPT = stands_at
    try:
        return route_citation(str(call.get("choice") or ""), float(call["confidence"]))
    finally:
        _q.AUTO_ACCEPT = saved_auto


def _jitter_flip(scored: list[dict[str, Any]], verdict_of) -> dict[str, Any]:
    by_row: dict[str, list[dict[str, Any]]] = {}
    for call in scored:
        by_row.setdefault(str(call.get("row_id") or ""), []).append(call)
    repeated = [calls for calls in by_row.values() if len(calls) > 1]
    spreads = [
        max(float(c["confidence"]) for c in calls) - min(float(c["confidence"]) for c in calls)
        for calls in repeated
    ]
    flips = sum(len({verdict_of(c) for c in calls}) > 1 for calls in repeated)
    return {
        "jitter_mean": sum(spreads) / len(spreads) if spreads else None,
        "jitter_max": max(spreads) if spreads else None,
        "flip_rate": flips / len(repeated) if repeated else None,
    }


def _latency(latencies_ms: list[float] | tuple[float, ...]) -> dict[str, Any]:
    lat = sorted(latencies_ms)
    return {
        "latency_p50_ms": _percentile(lat, 50),
        "latency_p95_ms": _percentile(lat, 95),
    }


def summarize_suitability(
    calls: list[dict[str, Any]],
    *,
    approve_at: float,
    block_at: float,
    latencies_ms: list[float] | tuple[float, ...] = (),
) -> dict[str, Any]:
    """Approve/review/block counts plus confident-reject precision/recall."""
    scored = _scored(calls)
    verdicts = [_verdict_suitability(c, approve_at, block_at) for c in scored]
    predicted = [v == "not_derivable" for v in verdicts]
    actual = [str(c.get("label") or "") == "not_derivable" for c in scored]
    tp = sum(p and a for p, a in zip(predicted, actual))
    return {
        "approve_at": approve_at,
        "block_at": block_at,
        "n": len(calls),
        "n_scored": len(scored),
        "malformed_rate": (len(calls) - len(scored)) / len(calls) if calls else 0.0,
        "approve": sum(v == "derivable" for v in verdicts),
        "block": sum(predicted),
        "review": sum(v == "review" for v in verdicts),
        "reject_precision": tp / sum(predicted) if any(predicted) else None,
        "reject_recall": tp / sum(actual) if any(actual) else None,
        **_jitter_flip(scored, lambda c: _verdict_suitability(c, approve_at, block_at)),
        **_latency(latencies_ms),
    }


def summarize_citation(
    calls: list[dict[str, Any]],
    *,
    stands_at: float,
    latencies_ms: list[float] | tuple[float, ...] = (),
) -> dict[str, Any]:
    """Stands counts plus confident-reject precision/recall."""
    scored = _scored(calls)
    routed = [_verdict_citation(c, stands_at) for c in scored]
    predicted = [v in _CITATION_REJECTS and stands for v, stands in routed]
    actual = [str(c.get("label") or "") in _CITATION_REJECTS for c in scored]
    tp = sum(p and a for p, a in zip(predicted, actual))
    return {
        "stands_at": stands_at,
        "n": len(calls),
        "n_scored": len(scored),
        "malformed_rate": (len(calls) - len(scored)) / len(calls) if calls else 0.0,
        "stands_true": sum(stands for _, stands in routed),
        "stands_false": sum(not stands for _, stands in routed),
        "reject_precision": tp / sum(predicted) if any(predicted) else None,
        "reject_recall": tp / sum(actual) if any(actual) else None,
        **_jitter_flip(scored, lambda c: _verdict_citation(c, stands_at)),
        **_latency(latencies_ms),
    }
