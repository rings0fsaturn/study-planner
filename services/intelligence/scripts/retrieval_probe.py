"""Retrieval-quality probe for an ingested material (embedding accuracy).

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... \
        uv run --package intelligence python scripts/retrieval_probe.py <material_id> \
        [--questions questions.json] [--top-k 10]

Loads `services/intelligence/.env` if present. The default question set is
`scripts/probe_questions.json` (label → question with an expected answer
snippet). Each question is embedded with `taskType=retrieval_query`, then
`match_content_chunks` ranks the material's chunks; recall@1/3/5 and MRR are
computed against the chunk whose text contains the expected snippet.

Consumes only ~1-2 k embedding tokens (15-20 single-text calls).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import statistics
from pathlib import Path
from typing import Any

import httpx

EMBEDDING_DIMENSIONS = 768


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"{name} is required")
    return value


def embed_query(key: str, text: str) -> list[float]:
    response = httpx.post(
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-embedding-001:batchEmbedContents",
        json={
            "requests": [
                {
                    "model": "models/gemini-embedding-001",
                    "content": {"parts": [{"text": text}]},
                    "taskType": "retrieval_query",
                    "outputDimensionality": EMBEDDING_DIMENSIONS,
                }
            ]
        },
        headers={"x-goog-api-key": key},
        timeout=30.0,
    )
    if response.status_code != 200:
        raise SystemExit(f"embedding failed: {response.status_code} {response.text[:300]}")
    return [float(value) for value in response.json()["embeddings"][0]["values"]]


def fetch_chunks(client: httpx.Client, base: str, key: str, material_id: str) -> list[dict]:
    chunks: list[dict] = []
    offset = 0
    while True:
        response = client.get(
            f"{base}/rest/v1/content_chunks",
            params={
                "material_id": f"eq.{material_id}",
                "order": "ordinal.asc",
                "select": "id,ordinal,text",
                "embedding": "not.is.null",
                "limit": 1000,
                "offset": offset,
            },
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        if response.status_code >= 400:
            raise SystemExit(f"chunk fetch failed: {response.status_code} {response.text[:200]}")
        page = response.json()
        chunks.extend(page)
        if len(page) < 1000:
            return chunks
        offset += len(page)


def rank_with_rpc(
    client: httpx.Client,
    base: str,
    key: str,
    material_id: str,
    vector: list[float],
    query_text: str | None = None,
) -> list[dict]:
    # PostgREST takes the vector as a halfvec literal string.
    literal = "[" + ",".join(f"{value:.8f}" for value in vector) + "]"
    payload: dict[str, object] = {
        "query_embedding": literal,
        "match_material_id": material_id,
        "top_k": 50,
    }
    if query_text:
        # Hybrid retrieval: the 4-arg RPC overload fuses BM25 + dense with RRF.
        payload["query_text"] = query_text
    response = client.post(
        f"{base}/rest/v1/rpc/match_content_chunks",
        json=payload,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    if response.status_code >= 400:
        raise SystemExit(f"match RPC failed: {response.status_code} {response.text[:200]}")
    return response.json()


def probe(material_id: str, question_file: str, hybrid: bool = False) -> str:
    load_env_file(Path(__file__).parents[1] / ".env")
    supabase_url = require_env("SUPABASE_URL").rstrip("/")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    gemini_key = require_env("GEMINI_API_KEY")

    questions_path = Path(question_file)
    if not questions_path.is_file():
        questions_path = Path(__file__).parent / question_file
    questions: list[dict[str, str]] = json.loads(questions_path.read_text(encoding="utf-8"))
    if not questions:
        raise SystemExit("question set is empty")

    client = httpx.Client(timeout=60.0)
    chunks = fetch_chunks(client, supabase_url, service_key, material_id)
    print(f"chunks: {len(chunks)} total (embedded only)")
    if not chunks:
        raise SystemExit("material has no embedded chunks to probe")

    lines: list[str] = []
    lines.append(f"# Retrieval probe — `{material_id}` ({len(questions)} questions)")
    lines.append("")
    lines.append(f"- Embedded chunks available: {len(chunks)}")
    lines.append(f"- Retrieval mode: `{'hybrid (BM25 + dense RRF)' if hybrid else 'dense-only'}`")
    lines.append("")
    lines.append("| # | question | answer chunk | rank@match | recall@1 | recall@3 | recall@5 |")
    lines.append("|---|---|---|---|---|---|---|")

    hits: list[dict[str, Any]] = []
    for index, item in enumerate(questions, start=1):
        vector = embed_query(gemini_key, item["question"])
        results = rank_with_rpc(
            client,
            supabase_url,
            service_key,
            material_id,
            vector,
            query_text=item["question"] if hybrid else None,
        )

        def _collapse(text: str) -> str:
            return re.sub(r"\s+", " ", text).strip().lower()

        # Multi-gold scoring: every chunk containing the answer snippet (or an
        # altSnippet for questions with multiple legitimately-answerable
        # passages) is a valid answer chunk, so a question is a hit if any gold
        # chunk ranks in the top-k. The reported rank is the best rank across
        # all gold chunks.
        snippets = [item["answerSnippet"], *item.get("altSnippets", [])]
        gold_ids = {
            chunk["id"]
            for chunk in chunks
            if any(
                _collapse(snippet) in _collapse(chunk.get("text") or "")
                for snippet in snippets
            )
        }
        if not gold_ids:
            print(f"WARNING: answer snippet for Q{index} not found in any chunk — skipping")
            continue
        gold_by_id = {chunk["id"]: chunk for chunk in chunks}
        best_rank = min(
            (
                position
                for position, row in enumerate(results, start=1)
                if row["chunk_id"] in gold_ids
            ),
            default=None,
        )
        hits.append(
            {
                "index": index,
                "label": item["label"],
                "answer_ordinal": gold_by_id[next(iter(gold_ids))]["ordinal"],
                "rank": best_rank,
                "top_similarity": results[0]["similarity"] if results else None,
            }
        )
        rank_text = str(best_rank) if best_rank is not None else "miss"
        lines.append(
            f"| {index} | {item['label']} | {gold_by_id[next(iter(gold_ids))]['ordinal']} | "
            f"{rank_text} | {int(best_rank is not None and best_rank <= 1)} | "
            f"{int(best_rank is not None and best_rank <= 3)} | "
            f"{int(best_rank is not None and best_rank <= 5)} |"
        )

    lines.append("")
    if hits:
        ranks = [h["rank"] for h in hits if h["rank"] is not None]
        mrr = statistics.mean(1.0 / rank for rank in ranks) if ranks else 0.0
        recall1 = sum(1 for h in hits if h["rank"] is not None and h["rank"] <= 1) / len(hits)
        recall3 = sum(1 for h in hits if h["rank"] is not None and h["rank"] <= 3) / len(hits)
        recall5 = sum(1 for h in hits if h["rank"] is not None and h["rank"] <= 5) / len(hits)
        lines.append(
            f"- **Recall@1:** {recall1:.2f} · **Recall@3:** {recall3:.2f} · "
            f"**Recall@5:** {recall5:.2f}"
        )
        top_sims = [h["top_similarity"] for h in hits if h["top_similarity"] is not None]
        lines.append(
            f"- **MRR:** {mrr:.3f} · **Mean top similarity:** "
            f"{statistics.mean(top_sims):.3f}"
        )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Embedding retrieval-quality probe")
    parser.add_argument("material_id", help="materials.id to probe")
    parser.add_argument("--questions", default="probe_questions.json", help="question set file")
    parser.add_argument(
        "--hybrid", action="store_true", help="use hybrid BM25 + dense RRF retrieval"
    )
    args = parser.parse_args()
    print(probe(args.material_id, args.questions, hybrid=args.hybrid))


if __name__ == "__main__":
    main()
