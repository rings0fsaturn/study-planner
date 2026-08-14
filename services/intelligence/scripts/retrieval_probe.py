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
    client: httpx.Client, base: str, key: str, material_id: str, vector: list[float]
) -> list[dict]:
    # PostgREST takes the vector as a halfvec literal string.
    literal = "[" + ",".join(f"{value:.8f}" for value in vector) + "]"
    response = client.post(
        f"{base}/rest/v1/rpc/match_content_chunks",
        json={
            "query_embedding": literal,
            "match_material_id": material_id,
            "top_k": 50,
        },
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    if response.status_code >= 400:
        raise SystemExit(f"match RPC failed: {response.status_code} {response.text[:200]}")
    return response.json()


def probe(material_id: str, question_file: str) -> str:
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
    lines.append("")
    lines.append("| # | question | answer chunk | rank@match | recall@1 | recall@3 | recall@5 |")
    lines.append("|---|---|---|---|---|---|---|")

    hits: list[dict[str, Any]] = []
    for index, item in enumerate(questions, start=1):
        vector = embed_query(gemini_key, item["question"])
        results = rank_with_rpc(client, supabase_url, service_key, material_id, vector)

        def _collapse(text: str) -> str:
            return re.sub(r"\s+", " ", text).strip().lower()

        answer_chunk = next(
            (
                chunk
                for chunk in chunks
                if _collapse(item["answerSnippet"]) in _collapse(chunk.get("text") or "")
            ),
            None,
        )
        if answer_chunk is None:
            print(f"WARNING: answer snippet for Q{index} not found in any chunk — skipping")
            continue
        rank = next(
            (
                position
                for position, row in enumerate(results, start=1)
                if row["chunk_id"] == answer_chunk["id"]
            ),
            None,
        )
        hits.append(
            {
                "index": index,
                "label": item["label"],
                "answer_ordinal": answer_chunk["ordinal"],
                "rank": rank,
                "top_similarity": results[0]["similarity"] if results else None,
            }
        )
        rank_text = str(rank) if rank is not None else "miss"
        lines.append(
            f"| {index} | {item['label']} | {answer_chunk['ordinal']} | "
            f"{rank_text} | {int(rank is not None and rank <= 1)} | "
            f"{int(rank is not None and rank <= 3)} | "
            f"{int(rank is not None and rank <= 5)} |"
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
    args = parser.parse_args()
    print(probe(args.material_id, args.questions))


if __name__ == "__main__":
    main()
