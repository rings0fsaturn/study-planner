"""Jev slice-2 conflict-gate sweep (#76 Phase B): premise-denying rows, one call each.

Live spend only on the rows: one batched ``decide()`` per row through the same
builder the worker enforce path uses (``batch_passage_questions(1)``), so the
recorded Nouls are the ones enforcement would act on. The threshold grid and
the per-split summaries rerun offline on the recorded calls through
``measure_slice2.summarize_passage``, so the grid costs zero spend.
Budget-guarded like the slice-1 runner. Rule 80: ``--limit 2`` dry run first.

The ``routing`` block is the conflict-gate readout: verdict counts per split plus
``injection_gated``, the rows a premise-denying passage lost to the injection
check before the contradiction check could fire (the conflict-01 shape).

Usage (from the repository root):
    uv run --package intelligence python services/intelligence/scripts/jev_sweep_slice2.py \\
      --rows .work/active/jev-integration/plan/evidence/slice2_conflict_rows.json \\
      --split sweep --limit 2
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from retrieval_probe import load_env_file  # noqa: E402

from app.jev.client import JevClient, JevError, estimate_cost_usd  # noqa: E402
from app.jev.measure_slice2 import PASSAGE_GRID, summarize_passage  # noqa: E402
from app.jev.questions import (  # noqa: E402
    _BATCH_NOULS,
    PASSAGE_THRESHOLDS,
    batch_passage_questions,
    route_batch_passage,
)

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"

VERDICTS = ("include", "conflicting_evidence", "exclude")


def load_rows(path: str, split: str) -> list[dict[str, Any]]:
    """Evidence rows, filtered to one split (sweep tunes, final reports)."""
    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    rows = payload["rows"]
    if split == "all":
        return rows
    return [row for row in rows if row.get("split") == split]


def passage_state(row: dict[str, Any]) -> dict[str, Any]:
    """One-row batched state: the shape ``_jev_classify_passages_shadow`` builds."""
    passage = row.get("passage") or {}
    return {
        "query": str(row.get("query") or ""),
        "passages": [{"id": str(passage.get("id") or ""), "text": str(passage.get("text") or "")}],
    }


def _answer_fields(answers: dict[str, Any]) -> dict[str, Any]:
    """Passage 0 re-keyed into the router's own ``p0_`` answer shape."""
    return {
        f"p0_{key}": {"noul": float((answers.get(f"p0_{key}") or {}).get("noul") or 0.0)}
        for key in _BATCH_NOULS
    }


def sweep_rows(
    client: Any,
    rows: list[dict[str, Any]],
    *,
    repeats: int = 1,
    request_prefix: str = "jev-sweep-slice2",
) -> dict[str, Any]:
    """One batched decide() per row per repeat; fail-open per row."""
    calls: list[dict[str, Any]] = []
    errors: list[str] = []
    latencies_ms: list[float] = []
    spent_input_tokens = 0
    n_calls = 0
    for row in rows:
        for _ in range(max(repeats, 1)):
            started = time.perf_counter()
            try:
                result = client.decide(
                    passage_state(row),
                    batch_passage_questions(1),
                    request_id=f"{request_prefix}-{uuid.uuid4().hex[:8]}",
                )
                answers = _answer_fields(result.answers or {})
                calls.append(
                    {
                        "row_id": str(row.get("row_id") or ""),
                        "split": row.get("split"),
                        "window_id": row.get("window_id"),
                        "label": row.get("label"),
                        "nouls": {key: answers[f"p0_{key}"]["noul"] for key in _BATCH_NOULS},
                        "verdict": route_batch_passage(answers, 1)[0],
                        "scored": True,
                    }
                )
            except JevError as exc:
                errors.append(exc.code)
                calls.append(
                    {
                        "row_id": str(row.get("row_id") or ""),
                        "split": row.get("split"),
                        "window_id": row.get("window_id"),
                        "label": row.get("label"),
                        "nouls": {},
                        "verdict": None,
                        "scored": False,
                    }
                )
                continue
            finally:
                latencies_ms.append((time.perf_counter() - started) * 1000.0)
            n_calls += 1
            spent_input_tokens += result.input_tokens or 0
    splits = sorted({str(c.get("split")) for c in calls})
    return {
        "repeats": repeats,
        "n_rows": len(rows),
        "n_calls": n_calls,
        "spent_input_tokens": spent_input_tokens,
        "latencies_ms": latencies_ms,
        "calls": calls,
        "errors": errors,
        "thresholds": dict(PASSAGE_THRESHOLDS),
        "splits": {
            split: summarize_passage(
                [c for c in calls if str(c.get("split")) == split],
                thresholds=PASSAGE_THRESHOLDS,
                latencies_ms=latencies_ms,
            )
            for split in splits
        },
        "grid": {
            split: [
                {
                    **cell,
                    **summarize_passage(
                        [c for c in calls if str(c.get("split")) == split], thresholds=cell
                    ),
                }
                for cell in PASSAGE_GRID
            ]
            for split in splits
        },
        "routing": {
            split: _routing([c for c in calls if str(c.get("split")) == split], PASSAGE_THRESHOLDS)
            for split in splits
        },
    }


def _routing(calls: list[dict[str, Any]], thresholds: dict[str, float]) -> dict[str, Any]:
    """Verdict counts plus how many excludes the injection check took first."""
    scored = [c for c in calls if c.get("scored")]
    return {
        "n": len(scored),
        **{verdict: sum(c.get("verdict") == verdict for c in scored) for verdict in VERDICTS},
        "injection_gated": sum(
            c.get("verdict") == "exclude"
            and float((c.get("nouls") or {}).get("contains_prompt_injection") or 0.0)
            > thresholds["injection_max"]
            for c in scored
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", required=True)
    parser.add_argument("--split", default="sweep", choices=("sweep", "final", "all"))
    parser.add_argument("--repeats", type=int, default=1)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--max-spend", type=float, default=0.05)
    args = parser.parse_args()

    load_env_file(ENV_PATH)
    if not os.getenv("OPENROUTER_JEV_API_KEY", "").strip():
        print(json.dumps({"outcome": "skipped", "reason": "OPENROUTER_JEV_API_KEY is not set"}))
        return 2

    client = JevClient.from_env("JEV_SLICE2", default_timeout_ms=15000)
    price_per_mtok = float(os.getenv("JEV_PRICE_PER_MTOK", "0.042"))
    rows = load_rows(args.rows, args.split)
    if args.limit > 0:
        rows = rows[: args.limit]

    try:
        outcome = sweep_rows(client, rows, repeats=args.repeats)
    except JevError as exc:
        print(
            json.dumps(
                {
                    "outcome": exc.code,
                    "retryable": exc.retryable,
                    "request_id": exc.request_id,
                }
            )
        )
        return 1
    outcome["spent_usd_estimated"] = round(
        estimate_cost_usd(outcome["spent_input_tokens"], price_per_mtok), 6
    )
    if outcome["spent_usd_estimated"] > args.max_spend:
        outcome["outcome"] = "aborted"
        outcome["reason"] = "max-spend reached"
        print(json.dumps(outcome, indent=2))
        return 1
    print(json.dumps(outcome, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
