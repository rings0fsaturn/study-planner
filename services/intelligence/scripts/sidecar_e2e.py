"""Sidecar embedding live E2E driver (services/embedder + ingestion worker).

Operator tool. Preflights the GPU embedder, runs the batch-size sweep,
drives a small legacy-material re-embed and the canonical 572-page PDF
ingestion through the sidecar worker, proves the provider mixing guard, and
writes timestamped JSON + Markdown evidence under
`.work/plans/active/2026-08-17-sidecar-embed-live-e2e/evidence/`.

Gemini is never called (plan decision D-03). The runner only preflights,
triggers, polls, snapshots, and verifies; the worker does the stage work.

Run from `services/intelligence` with `services/intelligence/.env` present:

    ../.venv/bin/python scripts/sidecar_e2e.py preflight
    ../.venv/bin/python scripts/sidecar_e2e.py sweep --http-batch 16,32,64 --model-batch 32,64,128
    ../.venv/bin/python scripts/sidecar_e2e.py reembed --material <id>
    ../.venv/bin/python scripts/sidecar_e2e.py pdf-run \\
        --pdf e2e/pdf/sample-textbook-572page.pdf --title "Sidecar E2E 572p"
    ../.venv/bin/python scripts/sidecar_e2e.py guard-probe --owner-id <uuid>
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

EMBEDDER_HEALTH_URL = os.getenv("EMBEDDER_URL", "http://localhost:8200").rstrip("/")
EVIDENCE_DIR = (
    Path(__file__).resolve().parents[3]
    / ".work"
    / "plans"
    / "active"
    / "2026-08-17-sidecar-embed-live-e2e"
    / "evidence"
)


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
        raise SystemExit(f"{name} is required (set it in services/intelligence/.env)")
    return value


def service_headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def run_id() -> str:
    return datetime.now(UTC).strftime("%Y%m%d-%H%M%S")


def evidence_paths(run: str) -> tuple[Path, Path]:
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    return EVIDENCE_DIR / f"{run}.json", EVIDENCE_DIR / f"{run}.md"


def save_evidence(run: str, manifest: dict) -> tuple[Path, Path]:
    """Write the JSON manifest and a compact Markdown summary (D-02, D-10)."""
    json_path, md_path = evidence_paths(run)
    json_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    lines = [f"# Sidecar embedding E2E evidence — `{run}`", ""]
    lines.append(f"- **Run id:** {run}")
    lines.append(f"- **Model:** {manifest.get('health', {}).get('model')}")
    lines.append(
        f"- **Device:** {manifest.get('health', {}).get('device')} "
        f"({manifest.get('health', {}).get('device_name')})"
    )
    lines.append(f"- **Dimensions:** {manifest.get('health', {}).get('dimensions')}")
    for step in ("preflight", "sweep", "reembed", "pdf_run", "guard_probe"):
        section = manifest.get(step)
        if section:
            lines.append("")
            lines.append(f"## {step}")
            lines.append("")
            lines.append(json.dumps(section, indent=2, sort_keys=True))
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"evidence written: {json_path}")
    print(f"report written:   {md_path}")
    return json_path, md_path


def snapshot_health(client: httpx.Client) -> dict:
    """GET /health on the embedder; raises SystemExit on failure (D-08)."""
    try:
        response = client.get(f"{EMBEDDER_HEALTH_URL}/health", timeout=10.0)
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        raise SystemExit(f"embedder /health failed: {exc}") from exc


def cmd_preflight(args: argparse.Namespace) -> int:
    """Fail-fast gate before any live mutation (D-08).

    Checks: embedder /health contract, required env vars, and that the
    evidence directory is writable. Aborts with a clear message otherwise.
    """
    load_env_file(Path(__file__).parents[1] / ".env")
    require_env("SUPABASE_URL")
    require_env("SUPABASE_SERVICE_ROLE_KEY")
    run = run_id()
    with httpx.Client(timeout=30.0) as client:
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
    manifest = {
        "run_id": run,
        "created_at": datetime.now(UTC).isoformat(),
        "worker_env": {
            "EMBEDDING_PROVIDER": os.getenv("EMBEDDING_PROVIDER", ""),
            "EMBEDDER_URL": os.getenv("EMBEDDER_URL", EMBEDDER_HEALTH_URL),
            "INGESTION_BATCH_SIZE": os.getenv("INGESTION_BATCH_SIZE", "100"),
            "INGESTION_MAX_BATCH_TOKENS": os.getenv("INGESTION_MAX_BATCH_TOKENS", "4000"),
            "INGESTION_MAX_TOKENS_PER_MINUTE": os.getenv(
                "INGESTION_MAX_TOKENS_PER_MINUTE", "0"
            ),
        },
        "health": health,
        "preflight": {"ok": True, "problems": []},
    }
    save_evidence(run, manifest)
    print("PREFLIGHT OK")
    return 0


def _embedder_health_loaded(client: httpx.Client, timeout_s: float = 300.0) -> dict:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            health = snapshot_health(client)
            if health.get("loaded") is True:
                return health
        except SystemExit:
            pass
        time.sleep(5)
    raise SystemExit("embedder /health never reported loaded=True")


def _recreate_embedder(model_batch: int) -> None:
    """Recreate the embedder container with EMBEDDING_BATCH_SIZE (rule 54)."""
    import subprocess

    env = os.environ.copy()
    env["EMBEDDING_BATCH_SIZE"] = str(model_batch)
    result = subprocess.run(
        [
            "docker",
            "compose",
            "-f",
            "services/embedder/docker-compose.yml",
            "up",
            "-d",
            "--force-recreate",
            "embedder",
        ],
        cwd=Path(__file__).resolve().parents[3],
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
    )
    if result.returncode != 0:
        raise SystemExit(f"docker compose recreate failed: {result.stderr[-2000:]}")


def _run_bakeoff(args: argparse.Namespace, http_batch: int, json_out: Path) -> dict:
    import subprocess

    cmd = [
        str(Path(__file__).resolve().parents[3] / ".venv" / "bin" / "python"),
        "scripts/embedding_bakeoff.py",
        "--material",
        args.material,
        "--models",
        "sidecar",
        "--questions",
        args.questions,
        "--sidecar-batch",
        str(http_batch),
        "--json-out",
        str(json_out),
    ]
    if json_out.parent:
        json_out.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        cmd,
        cwd=Path(__file__).resolve().parents[1],
        capture_output=True,
        text=True,
        timeout=1800,
    )
    if result.returncode != 0:
        return {"error": result.stderr[-4000:] or result.stdout[-4000:]}
    return json.loads(json_out.read_text(encoding="utf-8"))


def cmd_sweep(args: argparse.Namespace) -> int:
    load_env_file(Path(__file__).parents[1] / ".env")
    require_env("SUPABASE_URL")
    require_env("SUPABASE_SERVICE_ROLE_KEY")
    run = run_id()
    http_batches = [int(v) for v in args.http_batch.split(",") if v.strip()]
    model_batches = [int(v) for v in args.model_batch.split(",") if v.strip()]
    results: dict[str, dict] = {}
    with httpx.Client(timeout=30.0) as client:
        for model_batch in model_batches:
            print(f"== EMBEDDING_BATCH_SIZE={model_batch} ==")
            _recreate_embedder(model_batch)
            health = _embedder_health_loaded(client)
            for http_batch in http_batches:
                runs: list[dict] = []
                # Cold run first (fresh container load / GPU warm-up), then warm repeats.
                for warm_index in range(args.warm_runs + 1):
                    label = "cold" if warm_index == 0 else f"warm-{warm_index}"
                    out = EVIDENCE_DIR / run / f"sweep-e{model_batch}-h{http_batch}-{label}.json"
                    result = _run_bakeoff(args, http_batch, out)
                    runs.append({"label": label, "result": result})
                    print(
                        f"  http={http_batch} {label}: "
                        f"{result.get('chunks_per_min', 'ERR')} chunks/min "
                        f"MRR={result.get('mrr', 'ERR')}"
                    )
                results[f"e{model_batch}-h{http_batch}"] = {
                    "model_batch": model_batch,
                    "http_batch": http_batch,
                    "health": health,
                    "runs": runs,
                }
    manifest = {
        "run_id": run,
        "created_at": datetime.now(UTC).isoformat(),
        "sweep": {
            "material": args.material,
            "questions": args.questions,
            "warm_runs": args.warm_runs,
            "note": "baseline-only performance (D-05); ACCA corpus read-only; no DB writes",
            "configs": results,
        },
    }
    save_evidence(run, manifest)
    return 0


CANDIDATE_EXCLUDED_IDS = {"80c8b138-b544-4095-8dc0-1c390ac70da2"}  # frozen ACCA corpus (rule 54)


def _service_client(key: str) -> httpx.Client:
    return httpx.Client(timeout=30.0, headers=service_headers(key))


def _pick_candidate(
    client: httpx.Client, base: str, key: str, min_chunks: int, max_chunks: int
) -> dict:
    """A ready, provider-NULL material with an inactive job, excluded IDs removed."""
    rows = client.get(
        f"{base}/rest/v1/materials",
        params={
            "ingestion_state": "eq.ready",
            "embedding_provider": "is.null",
            "select": "id,title,kind,chunk_count,user_id,created_at",
            "order": "chunk_count.asc",
        },
    ).json()
    candidates = [
        row
        for row in rows
        if row["id"] not in CANDIDATE_EXCLUDED_IDS
        and min_chunks <= int(row.get("chunk_count") or 0) <= max_chunks
    ]
    if not candidates:
        raise SystemExit(
            f"no disposable ready/NULL material with {min_chunks}-{max_chunks} chunks; "
            "create one (e.g. a small manual text) and re-run (D-04)"
        )
    chosen = candidates[0]
    jobs = client.get(
        f"{base}/rest/v1/ingestion_jobs",
        params={"material_id": f"eq.{chosen['id']}", "status": "in.(queued,running)"},
    ).json()
    if jobs:
        raise SystemExit(f"candidate {chosen['id']} has an active job; pick another")
    return chosen


def _poll_material(
    client: httpx.Client,
    base: str,
    key: str,
    material_id: str,
    timeout_s: float = 900.0,
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


def cmd_reembed(args: argparse.Namespace) -> int:
    load_env_file(Path(__file__).parents[1] / ".env")
    base = require_env("SUPABASE_URL").rstrip("/")
    key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    run = run_id()
    with _service_client(key) as client:
        candidate = _pick_candidate(client, base, key, min_chunks=1, max_chunks=100)
        material_id = candidate["id"]
        pre = client.get(
            f"{base}/rest/v1/materials",
            params={"id": f"eq.{material_id}", "select": "*", "limit": 1},
        ).json()[0]
        pre_chunks = client.get(
            f"{base}/rest/v1/content_chunks",
            params={"material_id": f"eq.{material_id}", "select": "id"},
        ).json()
        print(
            f"candidate: {material_id} ({candidate.get('title')!r}, "
            f"{candidate.get('chunk_count')} chunks)"
        )
    # Trigger the operator script (non-interactive).
    import subprocess

    trigger = subprocess.run(
        [
            str(Path(__file__).resolve().parents[3] / ".venv" / "bin" / "python"),
            "scripts/reembed_materials.py",
            "--material",
            material_id,
            "--provider",
            "qwen-sidecar",
            "--yes",
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if trigger.returncode != 0:
        raise SystemExit(
            f"reembed trigger failed: {trigger.stderr[-2000:] or trigger.stdout[-2000:]}"
        )
    with _service_client(key) as client:
        post = _poll_material(client, base, key, material_id)
        post_chunks = client.get(
            f"{base}/rest/v1/content_chunks",
            params={"material_id": f"eq.{material_id}", "select": "id,embedding,skipped"},
        ).json()
        nulls = [c for c in post_chunks if c.get("embedding") is None]
        skipped = [c for c in post_chunks if c.get("skipped")]
        problems = []
        if post.get("embedding_provider") != "qwen-sidecar":
            problems.append(f"provider={post.get('embedding_provider')!r}")
        if nulls:
            problems.append(f"{len(nulls)} NULL vectors remain")
        if len(post_chunks) != len(pre_chunks):
            problems.append(
                f"chunk count changed {len(pre_chunks)} -> {len(post_chunks)}"
            )
        if problems:
            raise SystemExit(f"REEMBED VERIFICATION FAILED: {'; '.join(problems)}")
        telemetry = client.get(
            f"{base}/rest/v1/generation_telemetry",
            params={"material_id": f"eq.{material_id}", "order": "id.asc", "select": "*"},
        ).json()
        import subprocess as sp

        report_md = sp.run(
            [
                str(Path(__file__).resolve().parents[3] / ".venv" / "bin" / "python"),
                "scripts/ingestion_report.py",
                material_id,
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
        "reembed": {
            "material_id": material_id,
            "title": candidate.get("title"),
            "pre_state": {
                "ingestion_state": pre.get("ingestion_state"),
                "embedding_provider": pre.get("embedding_provider"),
                "chunk_count": pre.get("chunk_count"),
            },
            "post_state": {
                "ingestion_state": post.get("ingestion_state"),
                "embedding_provider": post.get("embedding_provider"),
                "chunk_count": post.get("chunk_count"),
                "null_vectors": len(nulls),
                "skipped_chunks": len(skipped),
            },
            "telemetry_records": len(telemetry),
            "trigger_output": trigger.stdout[-2000:],
            "note": "material left tagged qwen-sidecar per D-07",
        },
        "telemetry_report_md": report_text,
    }
    save_evidence(run, manifest)
    print(f"REEMBED OK: {material_id} ready with provider qwen-sidecar")
    return 0


def _find_owner(client: httpx.Client, base: str, key: str, email: str | None) -> str:
    """Service-role admin lookup of the dev account id (auth/v1/admin/users)."""
    if not email:
        raise SystemExit("--owner-id or E2E_LIVE_EMAIL is required for pdf-run")
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


def _material_payload(
    base: str, key: str, material_id: str, owner_id: str, title: str, pdf_name: str
) -> dict:
    return {
        "id": material_id,
        "user_id": owner_id,
        "title": title,
        "kind": "file",
        "source": pdf_name,
        "ingestion_state": "pending",
        "ingestion_progress": 0,
        "content_version": uuid.uuid4().hex,
        "upload_complete_at": datetime.now(UTC).isoformat(),
    }


def cmd_pdf_run(args: argparse.Namespace) -> int:
    load_env_file(Path(__file__).parents[1] / ".env")
    base = require_env("SUPABASE_URL").rstrip("/")
    key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    pdf = Path(args.pdf)
    if not pdf.is_file():
        raise SystemExit(f"--pdf {args.pdf} not found")
    run = run_id()
    material_id = uuid.uuid4().hex
    job_id = uuid.uuid4().hex
    correlation_id = uuid.uuid4().hex
    with _service_client(key) as client:
        owner_id = args.owner_id or _find_owner(
            client, base, key, os.getenv("E2E_LIVE_EMAIL")
        )
        # 1) Upload the raw PDF (deterministic path; x-upsert per rule 36).
        object_path = f"{owner_id}/{material_id}/{pdf.name}"
        upload = client.post(
            f"{base}/storage/v1/object/material-raw/{object_path}",
            headers={**service_headers(key), "x-upsert": "true"},
            content=pdf.read_bytes(),
        )
        if upload.status_code >= 400:
            raise SystemExit(f"storage upload failed: {upload.status_code} {upload.text[:300]}")
        # 2) Material row.
        client.post(
            f"{base}/rest/v1/materials",
            json=_material_payload(base, key, material_id, owner_id, args.title, pdf.name),
        ).raise_for_status()
        # 3) Job row.
        client.post(
            f"{base}/rest/v1/ingestion_jobs",
            json={
                "id": job_id,
                "user_id": owner_id,
                "material_id": material_id,
                "kind": "ingestion",
                "status": "queued",
                "attempt": 1,
                "correlation_id": correlation_id,
            },
        ).raise_for_status()
        # 4) Enqueue extract (worker consumes it in sidecar mode).
        client.post(
            f"{base}/rest/v1/rpc/ingestion_send",
            json={
                "p_queue": "material_extract",
                "p_payload": {
                    "jobId": job_id,
                    "materialId": material_id,
                    "ownerId": owner_id,
                    "attempt": 1,
                    "correlationId": correlation_id,
                    "kind": "file",
                    "title": args.title,
                    "source": pdf.name,
                },
            },
        ).raise_for_status()
        print(f"enqueued extract: material={material_id} job={job_id}")
        # 5) Poll to ready (the 572-page book needs several minutes; D-04).
        post = _poll_material(client, base, key, material_id, timeout_s=2400.0)
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
        problems = []
        if post.get("embedding_provider") != "qwen-sidecar":
            problems.append(f"provider={post.get('embedding_provider')!r}")
        if nulls:
            problems.append(f"{len(nulls)} NULL vectors remain")
        if len(chunks) < 100:
            problems.append(f"suspiciously few chunks: {len(chunks)}")
        if problems:
            raise SystemExit(f"PDF RUN VERIFICATION FAILED: {'; '.join(problems)}")
        telemetry = client.get(
            f"{base}/rest/v1/generation_telemetry",
            params={"material_id": f"eq.{material_id}", "order": "id.asc", "select": "*"},
        ).json()
        import subprocess as sp

        report_md = sp.run(
            [
                str(Path(__file__).resolve().parents[3] / ".venv" / "bin" / "python"),
                "scripts/ingestion_report.py",
                material_id,
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
        # 6) Evidence BEFORE cleanup.
        manifest = {
            "run_id": run,
            "created_at": datetime.now(UTC).isoformat(),
            "pdf_run": {
                "material_id": material_id,
                "job_id": job_id,
                "correlation_id": correlation_id,
                "owner_id": owner_id,
                "pdf": str(pdf),
                "title": args.title,
                "state": post.get("ingestion_state"),
                "provider": post.get("embedding_provider"),
                "chunk_count": post.get("chunk_count"),
                "null_vectors": len(nulls),
                "skipped_chunks": len(skipped),
                "telemetry_records": len(telemetry),
            },
            "telemetry_report_md": report_text,
        }
        json_path, md_path = save_evidence(run, manifest)
        # 7) Cleanup (D-07): the PDF material is a throwaway.
        client.delete(f"{base}/rest/v1/materials?id=eq.{material_id}").raise_for_status()
        client.delete(f"{base}/rest/v1/content_chunks?material_id=eq.{material_id}").raise_for_status()
        client.delete(f"{base}/rest/v1/ingestion_jobs?material_id=eq.{material_id}").raise_for_status()
        print(f"PDF RUN OK: {len(chunks)} chunks embedded; material deleted; evidence kept")
    return 0


def cmd_guard_probe(args: argparse.Namespace) -> int:
    load_env_file(Path(__file__).parents[1] / ".env")
    base = require_env("SUPABASE_URL").rstrip("/")
    key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    run = run_id()
    material_id = uuid.uuid4().hex
    job_id = uuid.uuid4().hex
    correlation_id = uuid.uuid4().hex
    with _service_client(key) as client:
        client.post(
            f"{base}/rest/v1/materials",
            json={
                "id": material_id,
                "user_id": args.owner_id,
                "title": f"E2E mixing guard probe {run}",
                "kind": "manual",
                "source": "",
                "ingestion_state": "embedding",
                "ingestion_progress": 0.6,
                "content_version": uuid.uuid4().hex,
                # Synthetic marker ONLY: no Gemini vectors or API calls (D-03).
                "embedding_provider": "gemini",
            },
        ).raise_for_status()
        client.post(
            f"{base}/rest/v1/ingestion_jobs",
            json={
                "id": job_id,
                "user_id": args.owner_id,
                "material_id": material_id,
                "kind": "ingestion",
                "status": "queued",
                "attempt": 1,
                "correlation_id": correlation_id,
            },
        ).raise_for_status()
        client.post(
            f"{base}/rest/v1/rpc/ingestion_send",
            json={
                "p_queue": "material_embed",
                "p_payload": {
                    "jobId": job_id,
                    "materialId": material_id,
                    "ownerId": args.owner_id,
                    "attempt": 1,
                    "correlationId": correlation_id,
                },
            },
        ).raise_for_status()
        # Poll the job to terminal state.
        deadline = time.monotonic() + 300.0
        job = None
        while time.monotonic() < deadline:
            rows = client.get(
                f"{base}/rest/v1/ingestion_jobs",
                params={"id": f"eq.{job_id}", "select": "*", "limit": 1},
            ).json()
            if rows:
                job = rows[0]
                if job.get("status") in ("succeeded", "failed", "cancelled"):
                    break
            time.sleep(5)
        if not job or job.get("status") != "failed":
            raise SystemExit(
                f"guard probe did not fail the job: {job} (no auto-retry, D-08)"
            )
        problems = []
        if job.get("error_code") != "validation_failed":
            problems.append(f"error_code={job.get('error_code')!r}")
        if job.get("retryable"):
            problems.append("job marked retryable (expected terminal)")
        material_after = client.get(
            f"{base}/rest/v1/materials",
            params={"id": f"eq.{material_id}", "select": "ingestion_state", "limit": 1},
        ).json()
        if problems:
            raise SystemExit(f"GUARD PROBE FAILED: {'; '.join(problems)}")
        manifest = {
            "run_id": run,
            "created_at": datetime.now(UTC).isoformat(),
            "guard_probe": {
                "material_id": material_id,
                "job_id": job_id,
                "correlation_id": correlation_id,
                "owner_id": args.owner_id,
                "synthetic_provider": "gemini",
                "worker_provider": "qwen-sidecar",
                "job_status": job.get("status"),
                "error_code": job.get("error_code"),
                "retryable": job.get("retryable"),
                "material_state_after": (
                    material_after[0].get("ingestion_state") if material_after else None
                ),
                "note": "no Gemini called; no vectors written; synthetic rows deleted below",
            },
        }
        save_evidence(run, manifest)
        # Cleanup (D-06): job, telemetry, material.
        client.delete(f"{base}/rest/v1/ingestion_jobs?id=eq.{job_id}").raise_for_status()
        client.delete(
            f"{base}/rest/v1/generation_telemetry?material_id=eq.{material_id}"
        ).raise_for_status()
        client.delete(f"{base}/rest/v1/materials?id=eq.{material_id}").raise_for_status()
        print("GUARD PROBE OK: validation_failed, non-retryable; synthetic rows deleted")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Sidecar embedding live E2E driver")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("preflight", help="check embedder + env, write preflight evidence")

    sweep = sub.add_parser("sweep", help="batch-size sweep via embedding_bakeoff.py")
    sweep.add_argument("--http-batch", default="16,32,64")
    sweep.add_argument("--model-batch", default="32,64,128")
    sweep.add_argument("--material", default="80c8b138-b544-4095-8dc0-1c390ac70da2")
    sweep.add_argument("--questions", default="probe_questions.json")
    sweep.add_argument("--warm-runs", type=int, default=3)

    reembed = sub.add_parser("reembed", help="re-embed a small legacy material")
    reembed.add_argument("--material", required=True)

    pdf = sub.add_parser("pdf-run", help="ingest the canonical PDF via the sidecar")
    pdf.add_argument("--pdf", required=True)
    pdf.add_argument("--title", default="Sidecar E2E 572p")
    pdf.add_argument("--owner-id", default="")

    guard = sub.add_parser("guard-probe", help="non-destructive mixing-guard probe")
    guard.add_argument("--owner-id", required=True)

    args = parser.parse_args()
    handlers = {
        "preflight": cmd_preflight,
        "sweep": cmd_sweep,
        "reembed": cmd_reembed,
        "pdf-run": cmd_pdf_run,
        "guard-probe": cmd_guard_probe,
    }
    sys.exit(handlers[args.command](args))


if __name__ == "__main__":
    main()