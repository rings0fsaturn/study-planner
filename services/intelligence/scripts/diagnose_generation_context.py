"""Diagnostic: what context does the generation steer actually retrieve?

Reproduces app/generation/context.build_context (sidecar query embedding +
match_content_chunks) for one material and prints hit ordinals + text heads, so
we can see whether a steer query keeps landing in the front matter of a study
text instead of the technical chapters.

Usage:
    uv run --package intelligence python scripts/diagnose_generation_context.py \
        <material_id> ["steer 1"] ["steer 2"] ...
"""

from __future__ import annotations

import os
import os.path as op
import sys

import httpx

CONTEXT_TOP_K = 5
MATERIAL_TITLE = "ACCA APM Study Text"


def load_env(path: str) -> None:
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def embed_query(client: httpx.Client, text: str) -> list[float]:
    base = os.getenv("EMBEDDER_URL", "http://localhost:8200").rstrip("/")
    response = client.post(f"{base}/embed", json={"texts": [text], "is_query": True})
    response.raise_for_status()
    return [float(value) for value in response.json()["embeddings"][0]]


def retrieve(
    client: httpx.Client, url: str, key: str, material_id: str, steer: str
) -> list[dict]:
    vector = embed_query(client, steer)
    literal = "[" + ",".join(f"{value:.8f}" for value in vector) + "]"
    response = client.post(
        f"{url}/rest/v1/rpc/match_content_chunks",
        json={
            "query_embedding": literal,
            "match_material_id": material_id,
            "top_k": CONTEXT_TOP_K,
            "query_text": steer,
        },
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    here = op.dirname(op.abspath(__file__))
    load_env(op.join(here, "..", ".env"))
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    material_id = sys.argv[1]
    steers = sys.argv[2:] or [MATERIAL_TITLE, f"{MATERIAL_TITLE}, core"]

    with httpx.Client(timeout=60.0) as client:
        for steer in steers:
            print(f"\nsteer: {steer!r}")
            for row in retrieve(client, url, key, material_id, steer):
                text = " ".join(str(row.get("chunk_text") or "").split())
                print(f"  ordinal={row.get('ordinal'):>4}  {text[:160]}")


if __name__ == "__main__":
    main()
