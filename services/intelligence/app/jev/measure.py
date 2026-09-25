"""Rubric measurement summarizer (#74): pure aggregation over recorded pairs.

One split at a time: the caller owns the train/test split (gate 4), this
module only summarizes the pairs it is given. Agreement is the Jev
pass/fail verdict (``jev_score >= cutoff``) vs the server grade's ``met``.
"""

from __future__ import annotations

from typing import Any


def _percentile(sorted_vals: list[float], pct: float) -> float | None:
    if not sorted_vals:
        return None
    rank = pct / 100.0 * (len(sorted_vals) - 1)
    low = int(rank)
    high = min(low + 1, len(sorted_vals) - 1)
    frac = rank - low
    return sorted_vals[low] + frac * (sorted_vals[high] - sorted_vals[low])


def summarize_measurement(
    pairs: list[dict[str, Any]],
    *,
    cutoff: float,
    margin: float = 0.1,
    latencies_ms: list[float] | tuple[float, ...] = (),
) -> dict[str, Any]:
    """Agreement, bands, malformed rate, and latency for one split of pairs."""
    scored = [p for p in pairs if p.get("scored", p.get("jev_score") is not None)]
    verdicts = [(p["jev_score"] >= cutoff, p["grade_met"]) for p in scored]
    agree = [v == g for v, g in verdicts]
    met = [a for (v, g), a in zip(verdicts, agree) if g]
    notmet = [a for (v, g), a in zip(verdicts, agree) if not g]
    lat = sorted(latencies_ms)
    return {
        "cutoff": cutoff,
        "n": len(pairs),
        "n_scored": len(scored),
        "malformed_rate": (len(pairs) - len(scored)) / len(pairs) if pairs else 0.0,
        "agreement": sum(agree) / len(agree) if agree else None,
        "agree_met": sum(met) / len(met) if met else None,
        "agree_notmet": sum(notmet) / len(notmet) if notmet else None,
        "n_review": sum(abs(p["jev_score"] - cutoff) <= margin for p in scored),
        "latency_p50_ms": _percentile(lat, 50),
        "latency_p95_ms": _percentile(lat, 95),
    }
