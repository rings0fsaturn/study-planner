"""Wipe and restore the frozen probe corpus on the live dev project.

Operator tool. Preflights the GPU embedder, wipes one owner's library
(materials, chunks, jobs, telemetry, storage objects), then re-ingests the
canonical 572-page textbook through the sidecar worker at its stable
material id. Writes timestamped JSON + Markdown evidence under
`.work/plans/active/2026-08-19-corpus-restore/evidence/`.

Gemini is never called (plan decision D-03). The runner only preflights,
triggers, polls, snapshots, and verifies; the worker does the stage work.

Run from `services/intelligence` with `services/intelligence/.env` present:

    ../../.venv/bin/python scripts/corpus_restore.py wipe --owner-id <uuid>
    ../../.venv/bin/python scripts/corpus_restore.py restore \
        --pdf e2e/pdf/sample-textbook-572page.pdf
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

import httpx

from scripts.sidecar_e2e import (
    load_env_file,
    require_env,
    service_headers,
    snapshot_health,
)

EVIDENCE_DIR = (
    Path(__file__).resolve().parents[3]
    / ".work"
    / "plans"
    / "active"
    / "2026-08-19-corpus-restore"
    / "evidence"
)
PROBE_MATERIAL_ID = "80c8b138-b544-4095-8dc0-1c390ac70da2"


def run_id() -> str:
    return datetime.now(UTC).strftime("%Y%m%d-%H%M%S")


def _service_client(key: str) -> httpx.Client:
    return httpx.Client(timeout=30.0, headers=service_headers(key))


def _find_owner(client: httpx.Client, base: str, key: str, email: str | None) -> str:
    if not email:
        raise SystemExit("--owner-id or E2E_LIVE_EMAIL is required")
    response = client.get(
        f"{base}/auth/v1/admin/users",
        params={"per_page": 1000},
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    response.raise_for_status()
    for user in response.json().get("users", []):
        if user.get("email") == email:
            return user["id"]
    raise SystemExit(f"no auth.users row for email {email!r}")


def snapshot_library(client: httpx.Client, base: str, key: str, owner_id: str) -> dict:
    """Count every server-owned row + storage object for one owner (D-02).

    Storage listing is a POST with a JSON body (GET is rejected); entries
    under `<owner>/` are per-material folders, so each is listed again to
    collect the actual file objects. Orphan folders (no matching material
    row) are recorded too — clean slate deletes them as well.
    """
    materials = client.get(
        f"{base}/rest/v1/materials",
        params={
            "user_id": f"eq.{owner_id}",
            "select": "id,title,ingestion_state,embedding_provider,chunk_count",
        },
    ).json()
    material_ids = [m["id"] for m in materials]
    chunks = (
        client.get(
            f"{base}/rest/v1/content_chunks",
            params={"user_id": f"eq.{owner_id}", "select": "id"},
        ).json()
        if material_ids
        else []
    )
    jobs = (
        client.get(
            f"{base}/rest/v1/ingestion_jobs",
            params={"user_id": f"eq.{owner_id}", "select": "id,status"},
        ).json()
        if material_ids
        else []
    )
    telemetry = (
        client.get(
            f"{base}/rest/v1/generation_telemetry",
            params={"owner_id": f"eq.{owner_id}", "select": "id"},
        ).json()
        if material_ids
        else []
    )
    objects: list[dict] = []
    top = client.post(
        f"{base}/storage/v1/object/list/material-raw",
        json={"prefix": f"{owner_id}/", "limit": 200},
        headers=service_headers(key),
    )
    if top.status_code < 400:
        for entry in top.json():
            folder = (entry.get("name") or "").rstrip("/")
            if not folder:
                continue
            sub = client.post(
                f"{base}/storage/v1/object/list/material-raw",
                json={"prefix": f"{owner_id}/{folder}", "limit": 1000},
                headers=service_headers(key),
            )
            if sub.status_code >= 400:
                continue
            for child in sub.json():
                name = child.get("name") or ""
                if name:
                    objects.append(
                        {
                            "name": f"{owner_id}/{folder}/{name}",
                            "material_id": folder,
                        }
                    )
    return {
        "owner_id": owner_id,
        "materials": materials,
        "material_count": len(materials),
        "chunk_count": len(chunks),
        "job_count": len(jobs),
        "telemetry_count": len(telemetry),
        "storage_objects": objects,
    }


def _delete_owner_rows(
    client: httpx.Client, base: str, snapshot: dict
) -> None:
    """Delete one owner's rows + storage objects via service-role (D-02).

    Order mirrors sidecar_e2e.py cleanup: chunks -> jobs -> telemetry ->
    materials -> storage. Bodiless deletes carry no Content-Type (rule 36).
    Orphan storage objects (no matching material row) are deleted too.
    """
    for material in snapshot["materials"]:
        material_id = material["id"]
        client.delete(
            f"{base}/rest/v1/content_chunks?material_id=eq.{material_id}"
        ).raise_for_status()
        client.delete(
            f"{base}/rest/v1/ingestion_jobs?material_id=eq.{material_id}"
        ).raise_for_status()
        client.delete(
            f"{base}/rest/v1/generation_telemetry?material_id=eq.{material_id}"
        ).raise_for_status()
        client.delete(
            f"{base}/rest/v1/materials?id=eq.{material_id}"
        ).raise_for_status()
    seen: set[str] = set()
    for obj in snapshot["storage_objects"]:
        name = obj["name"]
        if name in seen:
            continue
        seen.add(name)
        client.delete(
            f"{base}/storage/v1/object/material-raw/{name}",
            headers=service_headers(client.headers.get("apikey", "")),
        ).raise_for_status()


def cmd_preflight(args: argparse.Namespace) -> int:
    """Fail-fast gate before any mutation (D-08 pattern)."""
    load_env_file(Path(__file__).parents[1] / ".env")
    require_env("SUPABASE_URL")
    key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    with _service_client(key) as client:
        health = snapshot_health(client)
    problems = []
    if health.get("status") != "ok":
        problems.append(f"health.status={health.get('status')!r} (expected 'ok')")
    if health.get("loaded") is not True:
        problems.append("health.loaded is not true")
    if health.get("dimensions") != 768:
        problems.append(f"health.dimensions={health.get('dimensions')} (expected 768)")
    if not health.get("cuda_available"):
        problems.append("health.cuda_available is false — GPU passthrough broken (rule 54)")
    if problems:
        print("PREFLIGHT FAILED:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print("PREFLIGHT OK")
    return 0


def cmd_wipe(args: argparse.Namespace) -> int:
    load_env_file(Path(__file__).parents[1] / ".env")
    base = require_env("SUPABASE_URL").rstrip("/")
    key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    run = run_id()
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    with _service_client(key) as client:
        owner_id = args.owner_id or _find_owner(
            client, base, key, os.getenv("E2E_LIVE_EMAIL")
        )
        snapshot = snapshot_library(client, base, key, owner_id)
        pre_path = EVIDENCE_DIR / f"{run}-pre-wipe.json"
        pre_path.write_text(
            json.dumps(
                {"run_id": run, "created_at": datetime.now(UTC).isoformat(), **snapshot},
                indent=2,
                sort_keys=True,
            ),
            encoding="utf-8",
        )
        print(
            f"owner {owner_id}: {snapshot['material_count']} materials, "
            f"{snapshot['chunk_count']} chunks, {snapshot['job_count']} jobs, "
            f"{snapshot['telemetry_count']} telemetry, "
            f"{len(snapshot['storage_objects'])} storage objects"
        )
        if args.dry_run:
            print(f"DRY-RUN: nothing deleted; pre-wipe snapshot at {pre_path}")
            return 0
        if not args.yes:
            answer = input("delete all of the above? [y/N] ").strip().lower()
            if answer not in ("y", "yes"):
                print("aborted")
                return 0
        _delete_owner_rows(client, base, snapshot)
        # Assert: the owner's library is empty (D-02).
        leftover = client.get(
            f"{base}/rest/v1/materials",
            params={"user_id": f"eq.{owner_id}", "select": "id"},
        ).json()
        if leftover:
            raise SystemExit(f"WIPE VERIFICATION FAILED: {len(leftover)} materials remain")
        manifest = {
            "run_id": run,
            "created_at": datetime.now(UTC).isoformat(),
            "wipe": {
                "owner_id": owner_id,
                "pre": snapshot,
                "post": {"material_count": 0, "chunk_count": 0},
            },
        }
        post_path = EVIDENCE_DIR / f"{run}-wipe.json"
        post_path.write_text(
            json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8"
        )
        print(f"WIPE OK: owner {owner_id} library cleared")
        print(f"pre-wipe snapshot: {pre_path}")
        print(f"wipe evidence:     {post_path}")
    return 0


def _material_payload(
    owner_id: str, material_id: str, title: str, pdf_name: str
) -> dict:
    return {
        "id": material_id,
        "user_id": owner_id,
        "client_id": uuid.uuid4().hex,
        "title": title,
        "kind": "file",
        "source": pdf_name,
        "ingestion_state": "pending",
        "ingestion_progress": 0,
        "content_version": uuid.uuid4().hex,
        "upload_complete_at": datetime.now(UTC).isoformat(),
    }


def _poll_material(
    client: httpx.Client,
    base: str,
    key: str,
    material_id: str,
    timeout_s: float,
) -> dict:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        row = client.get(
            f"{base}/rest/v1/materials",
            params={"id": f"eq.{material_id}", "select": "*", "limit": 1},
        ).json()
        if row:
            state = row[0].get("ingestion_state")
            if state == "ready":
                return row[0]
            if state == "failed":
                raise SystemExit(
                    f"material {material_id} FAILED: "
                    f"{row[0].get('ingestion_error')} (no auto-retry, D-08)"
                )
        time.sleep(5)
    raise SystemExit(f"material {material_id} did not reach ready in {timeout_s}s")


def _check_vectors(
    client: httpx.Client, base: str, material_id: str, expected_chunks: int
) -> list[dict]:
    chunks = client.get(
        f"{base}/rest/v1/content_chunks",
        params={
            "material_id": f"eq.{material_id}",
            "order": "ordinal.asc",
            "select": "id,embedding,skipped",
        },
    ).json()
    nulls = [c for c in chunks if c.get("embedding") is None]
    skipped = [c for c in chunks if c.get("skipped")]
    if len(chunks) != expected_chunks:
        raise SystemExit(
            f"chunk count {len(chunks)} != expected {expected_chunks} "
            "(no auto-retry, D-08)"
        )
    if nulls:
        raise SystemExit(f"{len(nulls)} NULL vectors remain (no auto-retry, D-08)")
    if skipped:
        raise SystemExit(f"{len(skipped)} chunks skipped (no auto-retry, D-08)")
    sample = chunks[:5]
    problems = []
    for chunk in sample:
        vector = chunk.get("embedding") or []
        if len(vector) != 768:
            problems.append(f"dims={len(vector)} (expected 768)")
            break
        norm = sum(v * v for v in vector) ** 0.5
        if not (0.99 <= norm <= 1.01):
            problems.append(f"L2 norm {norm:.4f} out of [0.99,1.01]")
            break
    if problems:
        raise SystemExit(f"VECTOR CHECK FAILED: {'; '.join(problems)}")
    return chunks


def cmd_restore(args: argparse.Namespace) -> int:
    load_env_file(Path(__file__).parents[1] / ".env")
    base = require_env("SUPABASE_URL").rstrip("/")
    key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    pdf = Path(args.pdf)
    if not pdf.is_file():
        root = Path(__file__).resolve().parents[3]
        alt = root / args.pdf
        if alt.is_file():
            pdf = alt
        else:
            raise SystemExit(f"--pdf {args.pdf} not found")
    run = run_id()
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    with _service_client(key) as client:
        # Idempotency guard (D-04): a ready/qwen-sidecar material is done.
        existing = client.get(
            f"{base}/rest/v1/materials",
            params={"id": f"eq.{args.material_id}", "select": "*", "limit": 1},
        ).json()
        if existing:
            row = existing[0]
            if (
                row.get("ingestion_state") == "ready"
                and row.get("embedding_provider") == "qwen-sidecar"
            ):
                print(
                    f"material {args.material_id} already restored "
                    f"({row.get('chunk_count')} chunks); nothing to do"
                )
                return 0
            raise SystemExit(
                f"material {args.material_id} exists in state "
                f"{row.get('ingestion_state')}/{row.get('embedding_provider')}; "
                "run `wipe` first (no overwrite, D-08)"
            )
        owner_id = args.owner_id or _find_owner(
            client, base, key, os.getenv("E2E_LIVE_EMAIL")
        )
        object_path = f"{owner_id}/{args.material_id}/{pdf.name}"
        upload = client.post(
            f"{base}/storage/v1/object/material-raw/{object_path}",
            headers={
                **service_headers(key),
                "x-upsert": "true",
                "Content-Type": "application/pdf",
            },
            content=pdf.read_bytes(),
        )
        if upload.status_code >= 400:
            raise SystemExit(
                f"storage upload failed: {upload.status_code} {upload.text[:300]}"
            )
        client.post(
            f"{base}/rest/v1/materials",
            json=_material_payload(owner_id, args.material_id, args.title, pdf.name),
        ).raise_for_status()
        jobs = client.get(
            f"{base}/rest/v1/ingestion_jobs",
            params={
                "material_id": f"eq.{args.material_id}",
                "select": "id,correlation_id,attempt",
            },
        ).json()
        if not jobs:
            raise SystemExit("trigger did not create an ingestion job for the material")
        job_id = jobs[0]["id"]
        correlation_id = jobs[0]["correlation_id"]
        print(f"trigger enqueued extract: material={args.material_id} job={job_id}")
        post = _poll_material(client, base, key, args.material_id, float(args.timeout))
        if post.get("embedding_provider") != "qwen-sidecar":
            raise SystemExit(
                f"provider={post.get('embedding_provider')!r} (expected qwen-sidecar)"
            )
        expected = int(post.get("chunk_count") or 0) or 754
        chunks = _check_vectors(client, base, args.material_id, expected)
        telemetry = client.get(
            f"{base}/rest/v1/generation_telemetry",
            params={
                "material_id": f"eq.{args.material_id}",
                "order": "id.asc",
                "select": "*",
            },
        ).json()
        import subprocess as sp

        report_md = sp.run(
            [
                str(Path(__file__).resolve().parents[3] / ".venv" / "bin" / "python"),
                "scripts/ingestion_report.py",
                args.material_id,
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        report_text = (
            report_md.stdout
            if report_md.returncode == 0
            else f"(report failed: {report_md.stderr[-500:]})"
        )
        manifest = {
            "run_id": run,
            "created_at": datetime.now(UTC).isoformat(),
            "restore": {
                "material_id": args.material_id,
                "job_id": job_id,
                "correlation_id": correlation_id,
                "owner_id": owner_id,
                "pdf": str(pdf),
                "title": args.title,
                "state": post.get("ingestion_state"),
                "provider": post.get("embedding_provider"),
                "chunk_count": len(chunks),
                "null_vectors": 0,
                "skipped_chunks": 0,
                "vector_sample": [
                    {"dims": len(c.get("embedding") or []), "id": c["id"]}
                    for c in chunks[:5]
                ],
                "telemetry_records": len(telemetry),
            },
            "telemetry_report_md": report_text,
        }
        json_path = EVIDENCE_DIR / f"{run}-restore.json"
        json_path.write_text(
            json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8"
        )
        print(
            f"RESTORE OK: {args.material_id} ready with {len(chunks)} chunks, 0 NULL"
        )
        print(f"evidence: {json_path}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Corpus wipe + restore driver")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("preflight", help="check embedder + env (fail-fast)")

    wipe = sub.add_parser("wipe", help="delete one owner's library (D-02)")
    wipe.add_argument("--owner-id", default="")
    wipe.add_argument("--yes", action="store_true", help="skip the confirmation prompt")
    wipe.add_argument("--dry-run", action="store_true", help="snapshot only, no mutation")

    restore = sub.add_parser("restore", help="re-ingest the frozen 572p corpus")
    restore.add_argument("--pdf", default="e2e/pdf/sample-textbook-572page.pdf")
    restore.add_argument("--material-id", default=PROBE_MATERIAL_ID)
    restore.add_argument("--title", default="ACCA APM Study Text")
    restore.add_argument("--owner-id", default="")
    restore.add_argument("--timeout", type=int, default=2400)

    args = parser.parse_args()
    handlers = {
        "preflight": cmd_preflight,
        "wipe": cmd_wipe,
        "restore": cmd_restore,
    }
    sys.exit(handlers[args.command](args))


if __name__ == "__main__":
    main()