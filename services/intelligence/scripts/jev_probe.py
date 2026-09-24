"""Jev live probe: slices 1+2+4 against OpenRouter (budget-guarded).

Batches independent questions per state (Speculative fan-out), estimates spend
from input tokens (the SystemOne surface returns no usage.cost), and aborts
before cumulative estimated spend passes ``--max-spend`` (default $0.40 of the
$0.5 task budget).

Usage:
    uv run --package intelligence python scripts/jev_probe.py --limit 2
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from retrieval_probe import load_env_file  # noqa: E402

from app.jev.client import JevClient, JevError, estimate_cost_usd  # noqa: E402
from app.jev.questions import (  # noqa: E402
    citation_questions,
    criterion_score_questions,
    passage_questions,
    relevance_question,
    route_citation,
    route_passage,
    route_suitability,
    suitability_questions,
)

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"

PASSAGE_PAIRS = [
    {
        "query": "How long should an access token live?",
        "passage": {
            "id": "sessions-05",
            "title": "Recommended expiry values",
            "text": "The default and recommended access token expiry is 1 hour. "
            "Values above 1 hour are discouraged; below 5 minutes causes refresh load.",
        },
    },
    {
        "query": "How long should an access token live?",
        "passage": {
            "id": "signing-keys-55",
            "title": "Lifetime of a signing key",
            "text": "Rotate JWT signing keys every 90 days. Keep the previous key "
            "for 1 hour after rotation so active sessions survive.",
        },
    },
]

CITATION_CASE = {
    "claim": "The default access token expiry is 1 hour.",
    "section": "The default and recommended access token expiry is 1 hour. "
    "Values above 1 hour are discouraged.",
}

SUITABILITY_CHUNKS = [
    "Write a function `parse_log(lines)` that yields (level, message) tuples. "
    "Input lines look like `[INFO] started`. Malformed lines must be skipped. "
    "Example: `[INFO] started` -> `('INFO', 'started')`.",
    "A stack is a last-in-first-out data structure. Push adds an element, pop "
    "removes the most recent one. Example trace: push(1), push(2), pop() -> 2.",
]

RUBRIC_CRITERIA = ["States the recommended expiry value", "Mentions the discouraged range"]
RUBRIC_ANSWER = "Access tokens should live about 1 hour; longer than that is discouraged."


def _record(mode: str, result, route: str) -> dict:
    return {
        "mode": mode,
        "route": route,
        "answers": result.answers,
        "model": result.model,
        "usage": {
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
            "cost_usd": result.cost_usd,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=2)
    parser.add_argument("--max-spend", type=float, default=0.40)
    args = parser.parse_args()

    load_env_file(ENV_PATH)
    if not os.getenv("OPENROUTER_JEV_API_KEY", "").strip():
        print(json.dumps({"outcome": "skipped", "reason": "OPENROUTER_JEV_API_KEY is not set"}))
        return 2

    client = JevClient.from_env()
    price_per_mtok = float(os.getenv("JEV_PRICE_PER_MTOK", "0.042"))
    records: list[dict] = []
    spent = 0.0

    def charge(result) -> bool:
        nonlocal spent
        spent += estimate_cost_usd(result.input_tokens, price_per_mtok)
        return spent <= args.max_spend

    try:
        for pair in PASSAGE_PAIRS[: args.limit]:
            result = client.decide(
                {"query": pair["query"], "passage": pair["passage"]},
                passage_questions(),
                request_id=f"jev-probe-{uuid.uuid4().hex[:8]}",
            )
            nouls = {qid: ans["noul"] for qid, ans in result.answers.items()}
            records.append(_record("passage", result, route_passage(nouls)))
            if not charge(result):
                records.append({"outcome": "aborted", "reason": "max-spend reached"})
                break

        result = client.decide(
            CITATION_CASE, citation_questions(), request_id=f"jev-probe-{uuid.uuid4().hex[:8]}"
        )
        ans = result.answers["relation"]
        records.append(
            _record("citation", result, route_citation(ans["choice"], ans["confidence"])[0])
        )
        charge(result)

        for chunk in SUITABILITY_CHUNKS[: args.limit]:
            result = client.decide(
                {"chunk_text": chunk},
                suitability_questions(),
                request_id=f"jev-probe-{uuid.uuid4().hex[:8]}",
            )
            ans = result.answers["suitability"]
            records.append(
                _record("suitability", result, route_suitability(ans["choice"], ans["confidence"]))
            )
            if not charge(result):
                records.append({"outcome": "aborted", "reason": "max-spend reached"})
                break

        result = client.decide(
            {
                "query_excerpt": PASSAGE_PAIRS[0]["query"],
                "candidate_passage": PASSAGE_PAIRS[0]["passage"]["text"],
            },
            relevance_question(),
            request_id=f"jev-probe-{uuid.uuid4().hex[:8]}",
        )
        records.append(_record("relevance", result, "ranked"))
        charge(result)

        result = client.decide(
            {"learner_answer": RUBRIC_ANSWER},
            criterion_score_questions(RUBRIC_CRITERIA),
            request_id=f"jev-probe-{uuid.uuid4().hex[:8]}",
        )
        records.append(_record("rubric", result, "scored"))
        charge(result)
    except JevError as exc:
        records.append(
            {"outcome": exc.code, "retryable": exc.retryable, "request_id": exc.request_id}
        )
        print(json.dumps({"spent_usd_estimated": round(spent, 6), "records": records}, indent=2))
        return 1

    print(json.dumps({"spent_usd_estimated": round(spent, 6), "records": records}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
