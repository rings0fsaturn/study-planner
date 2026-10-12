"""Loop threshold sweeps over logged Jev verdicts (offline, no network).

Thresholds stay frozen until the loop has graded app data; then this sweep
picks the split from logged verdicts with the same bake-off discipline as
the ``bkt-v1`` params and the slice-4 cutoff. Candidates are explicit, the
full table is reported, and ties break fail-closed (strictest floor).
"""

from __future__ import annotations

from typing import Any

DEFAULT_FLOOR_CANDIDATES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]


def sweep_evidence_floor(
    cases: list[dict[str, Any]],
    candidates: list[float] | None = None,
) -> dict[str, Any]:
    """Pick the evidence-sufficiency floor from logged verdicts.

    Each case is ``{"sufficient": float, "thin": bool}``: ``thin`` is the
    human (or outcome-derived) label saying this state must route to hold.
    A candidate floor predicts hold iff ``sufficient < floor``; agreement is
    the fraction of cases it calls right. The highest floor wins ties, so
    the pick is the strictest perfect separator. Raises on empty input
    rather than inventing a threshold.
    """
    if not cases:
        raise ValueError("sweep needs at least one logged verdict")
    floors = candidates if candidates is not None else DEFAULT_FLOOR_CANDIDATES
    table = [
        {
            "floor": floor,
            "agreement": sum(1 for c in cases if (c["sufficient"] < floor) == c["thin"])
            / len(cases),
        }
        for floor in floors
    ]
    best = max(table, key=lambda row: (row["agreement"], row["floor"]))
    return {"floor": best["floor"], "agreement": best["agreement"], "table": table}
