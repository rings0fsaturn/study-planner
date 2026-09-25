"""Jev slice-1 stress sweep (#75 Phase A2): thresholds on fresh evidence rows.

Live spend only on variants x repeats: one decide() per row per prompt
variant per repeat with both column values recorded (choice + confidence).
The threshold grid (suitability approve/block, citation stands) reruns
offline on the recorded calls with the pure summarizers, so the grid costs
zero spend. Budget-guarded like jev_probe/jev_measure: aborts before
cumulative estimated spend passes ``--max-spend``. Rule 80: ``--limit 2``
dry run first.

Usage:
    uv run --package intelligence python scripts/jev_sweep_slice1.py \
      --rows ../.work/active/jev-integration/plan/evidence/slice1_rows.json \
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

from app.generation.worker import _SUITABILITY_STATE_CHARS  # noqa: E402
from app.jev.client import JevClient, JevError, estimate_cost_usd  # noqa: E402
from app.jev.measure_slice1 import summarize_citation, summarize_suitability  # noqa: E402
from app.jev.questions import (  # noqa: E402
    citation_questions,
    suitability_questions,
)

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"

SUITABILITY_GRID = [
    (0.85, 0.05),
    (0.85, 0.1),
    (0.85, 0.15),
    (0.9, 0.05),
    (0.9, 0.1),
    (0.9, 0.15),
    (0.95, 0.05),
    (0.95, 0.1),
    (0.95, 0.15),
]
CITATION_GRID = (0.75, 0.8, 0.85)


def load_rows(path: str, split: str) -> list[dict[str, Any]]:
    """Evidence rows, filtered to one split (sweep tunes, final reports)."""
    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    rows = payload["rows"]
    if split == "all":
        return rows
    return [row for row in rows if row.get("split") == split]


def _suitability_state(row: dict[str, Any]) -> dict[str, str]:
    return {"chunk_text": str(row.get("chunk_text") or "")[:_SUITABILITY_STATE_CHARS]}


def _citation_state(row: dict[str, Any]) -> dict[str, str]:
    return {"claim": str(row.get("claim") or ""), "section": str(row.get("section") or "")}


def _answer_fields(answers: dict[str, Any], key: str) -> dict[str, Any]:
    ans = answers.get(key) or {}
    try:
        confidence = float(ans.get("confidence"))
    except (TypeError, ValueError):
        confidence = None
    return {"choice": str(ans.get("choice") or ""), "confidence": confidence}


def sweep_rows(
    client: Any,
    rows: list[dict[str, Any]],
    *,
    prompt_variant: str = "v1",
    repeats: int = 1,
    request_prefix: str = "jev-sweep-slice1",
) -> dict[str, Any]:
    """One decide() per row per variant per repeat; fail-open per row.

    Suitability rows carry ``chunk_text`` (+``family``); citation rows carry
    ``claim`` + ``section``. Model stays pinned to the client default
    (``jev-1.13``); only the builder wording varies by ``prompt_variant``.
    """
    suitability_calls: list[dict[str, Any]] = []
    citation_calls: list[dict[str, Any]] = []
    errors: list[str] = []
    latencies_ms: list[float] = []
    spent_input_tokens = 0
    n_calls = 0
    for row in rows:
        kind = str(row.get("kind") or "")
        for _ in range(max(repeats, 1)):
            started = time.perf_counter()
            try:
                if kind == "suitability":
                    result = client.decide(
                        _suitability_state(row),
                        suitability_questions(variant=prompt_variant),
                        request_id=f"{request_prefix}-{uuid.uuid4().hex[:8]}",
                    )
                    fields = _answer_fields(result.answers, "suitability")
                    call = {
                        "row_id": row["row_id"],
                        "family": row.get("family"),
                        "label": row.get("label"),
                        "variant": prompt_variant,
                        **fields,
                        "scored": fields["confidence"] is not None,
                    }
                    suitability_calls.append(call)
                elif kind == "citation":
                    result = client.decide(
                        _citation_state(row),
                        citation_questions(variant=prompt_variant),
                        request_id=f"{request_prefix}-{uuid.uuid4().hex[:8]}",
                    )
                    fields = _answer_fields(result.answers, "relation")
                    call = {
                        "row_id": row["row_id"],
                        "label": row.get("label"),
                        "variant": prompt_variant,
                        **fields,
                        "scored": fields["confidence"] is not None,
                    }
                    citation_calls.append(call)
                else:
                    errors.append(f"unknown-kind:{kind}")
                    continue
            except JevError as exc:
                errors.append(exc.code)
                call = {
                    "row_id": row.get("row_id"),
                    "family": row.get("family"),
                    "label": row.get("label"),
                    "variant": prompt_variant,
                    "choice": "",
                    "confidence": None,
                    "scored": False,
                }
                (suitability_calls if kind == "suitability" else citation_calls).append(call)
                continue
            finally:
                latencies_ms.append((time.perf_counter() - started) * 1000.0)
            n_calls += 1
            spent_input_tokens += result.input_tokens or 0
    suitability_grid = [
        {
            "approve_at": approve,
            "block_at": block,
            **summarize_suitability(suitability_calls, approve_at=approve, block_at=block),
        }
        for approve, block in SUITABILITY_GRID
    ]
    citation_grid = [
        {"stands_at": stands, **summarize_citation(citation_calls, stands_at=stands)}
        for stands in CITATION_GRID
    ]
    return {
        "prompt_variant": prompt_variant,
        "repeats": repeats,
        "n_rows": len(rows),
        "n_calls": n_calls,
        "spent_input_tokens": spent_input_tokens,
        "latencies_ms": latencies_ms,
        "suitability_calls": suitability_calls,
        "citation_calls": citation_calls,
        "suitability_grid": suitability_grid,
        "citation_grid": citation_grid,
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", required=True)
    parser.add_argument("--split", default="sweep", choices=("sweep", "final", "all"))
    parser.add_argument("--prompt-variant", default="v1", choices=("v1", "v2"))
    parser.add_argument("--repeats", type=int, default=2)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--max-spend", type=float, default=0.40)
    args = parser.parse_args()

    load_env_file(ENV_PATH)
    if not os.getenv("OPENROUTER_JEV_API_KEY", "").strip():
        print(json.dumps({"outcome": "skipped", "reason": "OPENROUTER_JEV_API_KEY is not set"}))
        return 2

    client = JevClient.from_env()
    price_per_mtok = float(os.getenv("JEV_PRICE_PER_MTOK", "0.042"))
    rows = load_rows(args.rows, args.split)
    if args.limit > 0:
        rows = rows[: args.limit]

    try:
        outcome = sweep_rows(client, rows, prompt_variant=args.prompt_variant, repeats=args.repeats)
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
