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


def cmd_sweep(args: argparse.Namespace) -> int:
    raise NotImplementedError("implemented in Phase 2")


def cmd_reembed(args: argparse.Namespace) -> int:
    raise NotImplementedError("implemented in Phase 3")


def cmd_pdf_run(args: argparse.Namespace) -> int:
    raise NotImplementedError("implemented in Phase 4")


def cmd_guard_probe(args: argparse.Namespace) -> int:
    raise NotImplementedError("implemented in Phase 5")


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