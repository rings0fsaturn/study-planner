"""Re-embed a ready material with a different embedding provider.

Operator tool: switches a material to a new embedding provider by nulling its
chunk vectors, resetting skipped flags, tagging the material with the target
provider, and enqueueing an embed-stage job for the running worker. The worker
re-embeds the whole material through the NULL-scan (atomic per material, so a
crash mid-way resumes instead of mixing providers).

Run from `services/intelligence`:

    .venv/bin/python scripts/reembed_materials.py --material <id> --provider qwen-sidecar

Providers: `gemini` | `qwen-sidecar`. The script refuses to touch in-progress
materials and refuses a no-op re-embed. Confirmation is interactive unless
`--yes` is passed (batch use).
"""

from __future__ import annotations

import argparse
import os
import sys
import uuid
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parents[1]))
from app.ingestion.queue import EMBED_QUEUE, SupabaseWorkQueue
from app.ingestion.repository import SupabaseIngestionRepo

PROVIDERS = ("gemini", "qwen-sidecar")


def _load_env_file(path: Path) -> None:
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


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"{name} is required (set it in services/intelligence/.env)")
    return value


def _service_headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _next_attempt(client: httpx.Client, base: str, key: str, material_id: str) -> int:
    rows = client.get(
        f"{base}/rest/v1/ingestion_jobs",
        params={"material_id": f"eq.{material_id}", "select": "attempt"},
        headers=_service_headers(key),
    )
    rows.raise_for_status()
    attempts = [int(row["attempt"]) for row in rows.json()]
    return max(attempts, default=0) + 1


def _reset_chunk_vectors(
    client: httpx.Client, base: str, key: str, material_id: str
) -> int:
    response = client.patch(
        f"{base}/rest/v1/content_chunks",
        params={"material_id": f"eq.{material_id}"},
        headers=_service_headers(key),
        json={"embedding": None, "skipped": False},
    )
    response.raise_for_status()
    return len(response.json() or []) if response.content else 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-embed a material with another provider")
    parser.add_argument("--material", required=True, help="materials.id to re-embed")
    parser.add_argument(
        "--provider",
        required=True,
        choices=PROVIDERS,
        help="target embedding provider",
    )
    parser.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    args = parser.parse_args()

    _load_env_file(Path(__file__).parents[1] / ".env")
    base = _require_env("SUPABASE_URL").rstrip("/")
    key = _require_env("SUPABASE_SERVICE_ROLE_KEY")

    client = httpx.Client(timeout=30.0)
    repo = SupabaseIngestionRepo(base, key, client=client)
    queue = SupabaseWorkQueue(base, key, client=client)

    material = repo.get_material(args.material)
    if material.ingestion_state != "ready":
        raise SystemExit(
            f"material {material.id} is {material.ingestion_state}; "
            "only ready materials can be re-embedded"
        )
    if material.embedding_provider == args.provider:
        print(f"material {material.id} is already embedded with {args.provider}; nothing to do")
        return

    print(
        f"material {material.id}: "
        f"{material.embedding_provider or '(never embedded)'} -> {args.provider}"
    )
    if not args.yes:
        answer = input("continue? [y/N] ").strip().lower()
        if answer not in ("y", "yes"):
            print("aborted")
            return

    attempt = _next_attempt(client, base, key, material.id)
    job_id = uuid.uuid4().hex
    correlation_id = uuid.uuid4().hex

    client.post(
        f"{base}/rest/v1/ingestion_jobs",
        headers=_service_headers(key),
        json={
            "id": job_id,
            "user_id": material.owner_id,
            "material_id": material.id,
            "kind": "ingestion",
            "status": "queued",
            "attempt": attempt,
            "correlation_id": correlation_id,
        },
    ).raise_for_status()

    client.patch(
        f"{base}/rest/v1/materials",
        params={"id": f"eq.{material.id}"},
        headers=_service_headers(key),
        json={
            "ingestion_state": "embedding",
            "ingestion_progress": 0.6,
            "ingestion_error": None,
            "embedding_provider": args.provider,
        },
    ).raise_for_status()

    _reset_chunk_vectors(client, base, key, material.id)
    queue.send(
        EMBED_QUEUE,
        {
            "jobId": job_id,
            "materialId": material.id,
            "ownerId": material.owner_id,
            "attempt": attempt,
            "correlationId": correlation_id,
        },
    )
    print(
        f"queued re-embed: attempt {attempt} with {args.provider}; "
        "the worker will embed and publish the material when it next polls"
    )


if __name__ == "__main__":
    main()
