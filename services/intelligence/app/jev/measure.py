"""Rubric measurement (#74) plus the slice-4 Score-to-action mapping (#77).

One split at a time: the caller owns the train/test split (gate 4), this module
only summarizes or maps the pairs it is given. Agreement is the Jev pass/fail
verdict (``jev_score >= cutoff``) vs the server grade's ``met``.

The mapping is pure and score-only (no answer text, no I/O) so the worker can
apply it after a grade composes and the report can replay it offline.
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
        # Class size behind the met agreement rate, so a thin class is visible
        # to the caller instead of being read off an averaged percentage. The
        # sweep's pick picks its floor off this.
        "n_met": len(met),
        "n_review": sum(abs(p["jev_score"] - cutoff) <= margin for p in scored),
        "latency_p50_ms": _percentile(lat, 50),
        "latency_p95_ms": _percentile(lat, 95),
    }


def criterion_action(
    index: int,
    jev_score: float | None,
    server_met: bool,
    *,
    cutoff: float,
    margin: float,
) -> dict[str, Any]:
    """Per-criterion Score-to-action verdict (D-02): ``flag`` / ``ok`` / ``skipped``.

    ``flag`` when the Jev verdict disagrees with the server grade, or when the
    score sits inside the review band and so is not trusted either way.
    ``skipped`` when the pair carries no score: a malformed answer is a
    fail-open outcome, never a reason to queue a question for review.
    """
    verdict = {
        "index": index,
        "action": "skipped",
        "reason": None,
        "jev_score": jev_score,
        "server_met": server_met,
    }
    if jev_score is None:
        return verdict
    if abs(jev_score - cutoff) <= margin:
        verdict["action"] = "flag"
        verdict["reason"] = "review_band"
    elif (jev_score >= cutoff) != server_met:
        verdict["action"] = "flag"
        verdict["reason"] = "disagreement"
    else:
        verdict["action"] = "ok"
    return verdict


def map_scores(pairs: list[dict[str, Any]], *, cutoff: float, margin: float) -> dict[str, Any]:
    """Per-criterion verdicts plus the any-flag aggregate (D-02).

    ``pairs`` is the ``_summarize_rubric_shadow`` shape (``scored`` /
    ``jev_score`` / ``grade_met``). Any flagged criterion flags the question.
    """
    criteria = [
        criterion_action(
            int(pair.get("index") or 0),
            pair.get("jev_score") if pair.get("scored") else None,
            bool(pair.get("grade_met")),
            cutoff=cutoff,
            margin=margin,
        )
        for pair in pairs
    ]
    flagged = [verdict["index"] for verdict in criteria if verdict["action"] == "flag"]
    return {"criteria": criteria, "flagged": flagged, "question_flags": bool(flagged)}
