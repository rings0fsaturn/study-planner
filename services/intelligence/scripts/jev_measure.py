"""Jev rubric measurement on labeled app rows (#74).

One decide() per learner answer with all its criteria batched (the
slice-4 shape), pairs via the #73 shadow summarizer, one report per split.
Budget-guarded like jev_probe: aborts before cumulative estimated spend
passes ``--max-spend``. Rule 80: ``--limit 2`` dry run first.

Usage:
    uv run --package intelligence python scripts/jev_measure.py \
      --rows ../.work/active/jev-integration/plan/evidence/rubric_rows.json \
      --split train --limit 2
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

from app.grading.grader import CORRECT_THRESHOLD  # noqa: E402
from app.grading.worker import _summarize_rubric_shadow  # noqa: E402
from app.jev.client import JevClient, JevError, estimate_cost_usd  # noqa: E402
from app.jev.measure import summarize_measurement  # noqa: E402
from app.jev.questions import criterion_score_questions  # noqa: E402

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"


def load_rows(path: str, split: str) -> list[dict[str, Any]]:
    """Labeled rows, filtered to one split (gate 4 lives with the caller)."""
    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    rows = payload["rows"]
    if split == "all":
        return rows
    return [row for row in rows if row.get("split") == split]


def measure_rows(
    client: Any,
    rows: list[dict[str, Any]],
    *,
    cutoff: float,
    margin: float = 0.1,
    request_prefix: str = "jev-measure",
) -> dict[str, Any]:
    """One batched decide() per answer; fail-open per answer, never per run."""
    pairs: list[dict[str, Any]] = []
    disagreements: list[dict[str, Any]] = []
    errors: list[str] = []
    latencies_ms: list[float] = []
    spent_input_tokens = 0
    for row in rows:
        questions = criterion_score_questions(row["criteria"])
        started = time.perf_counter()
        try:
            result = client.decide(
                {"learner_answer": row["answer"]},
                questions,
                request_id=f"{request_prefix}-{uuid.uuid4().hex[:8]}",
            )
        except JevError as exc:
            errors.append(exc.code)
            pairs.extend(
                {
                    "index": index,
                    "scored": False,
                    "jev_score": None,
                    "grade_met": bool(item.get("met")),
                    "agree": None,
                }
                for index, item in enumerate(row["breakdown"])
            )
            continue
        finally:
            latencies_ms.append((time.perf_counter() - started) * 1000.0)
        spent_input_tokens += result.input_tokens or 0
        for pair in _summarize_rubric_shadow(result.answers, row["breakdown"]):
            pairs.append(pair)
            if pair["scored"] and not pair["agree"]:
                disagreements.append(
                    {
                        "answer_id": row["answer_id"],
                        "index": pair["index"],
                        "criterion": row["criteria"][pair["index"]],
                        "jev_score": pair["jev_score"],
                        "grade_met": pair["grade_met"],
                    }
                )
    return {
        "report": summarize_measurement(
            pairs, cutoff=cutoff, margin=margin, latencies_ms=latencies_ms
        ),
        "n_answers": len(rows),
        "n_calls": len(latencies_ms),
        "spent_input_tokens": spent_input_tokens,
        "disagreements": disagreements,
        "errors": errors,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", required=True)
    parser.add_argument("--split", default="train", choices=("train", "test", "all"))
    parser.add_argument("--cutoff", type=float, default=CORRECT_THRESHOLD)
    parser.add_argument("--margin", type=float, default=0.1)
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
        outcome = measure_rows(client, rows, cutoff=args.cutoff, margin=args.margin)
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
