"""Ingestion telemetry report for one material.

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
        uv run --package intelligence python scripts/ingestion_report.py <material_id>

Loads `services/intelligence/.env` if present (plain KEY=VALUE lines). Prints
a markdown report built from `generation_telemetry` plus the material/jobs/
chunks rows, so a PDF run's stage breakdown, embedding batch latency, token
throughput, retry rate, chunk size distribution, and overlap waste are all
auditable after the fact.
"""

from __future__ import annotations

import argparse
import os
import statistics
from pathlib import Path
from typing import Any

import httpx

TELEMETRY_TABLE = "generation_telemetry"
MATERIALS_TABLE = "materials"
JOBS_TABLE = "ingestion_jobs"
CHUNKS_TABLE = "content_chunks"
OVERLAP_TOKENS = 30  # chunking default; overlap waste is an estimate from it


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
        raise SystemExit(f"{name} is required (set it or provide services/intelligence/.env)")
    return value


class Client:
    def __init__(self, base: str, key: str) -> None:
        self._base = base.rstrip("/")
        self._key = key

    def get(self, path: str, params: dict[str, Any] | None = None) -> list[dict]:
        response = httpx.get(
            f"{self._base}/rest/v1/{path}",
            params=params,
            headers={
                "apikey": self._key,
                "Authorization": f"Bearer {self._key}",
                "Content-Type": "application/json",
            },
            timeout=60.0,
        )
        if response.status_code >= 400:
            raise SystemExit(f"GET {path} failed: {response.status_code} {response.text[:300]}")
        return response.json()

    def get_all_pages(self, path: str, params: dict[str, Any]) -> list[dict]:
        rows: list[dict] = []
        params = dict(params)
        params.setdefault("limit", 1000)
        offset = 0
        while True:
            page = self.get(path, {**params, "offset": offset})
            rows.extend(page)
            if len(page) < params["limit"]:
                return rows
            offset += len(page)


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(round(pct / 100.0 * (len(ordered) - 1))))
    return ordered[index]


def fmt_ms(ms: float) -> str:
    if ms >= 1000:
        return f"{ms / 1000:.2f}s"
    return f"{ms:.0f}ms"


def stage_table(records: list[dict]) -> list[tuple[str, int, str, str, str, str]]:
    by_stage: dict[str, list[float]] = {}
    models: dict[str, str] = {}
    for record in records:
        stage = record.get("stage") or "?"
        by_stage.setdefault(stage, []).append(float(record.get("latency_ms") or 0))
        models[stage] = record.get("model") or ""
    rows: list[tuple[str, int, str, str, str, str]] = []
    for stage in sorted(by_stage):
        latencies = by_stage[stage]
        rows.append(
            (
                stage,
                len(latencies),
                models[stage],
                fmt_ms(sum(latencies)),
                fmt_ms(percentile(latencies, 50)),
                fmt_ms(percentile(latencies, 95)),
            )
        )
    return rows


def chunk_token_stats(chunks: list[dict]) -> dict[str, Any]:
    """Token-count each chunk text with the production counter (cl100k_base)."""
    try:
        import tiktoken
    except ImportError:
        return {"error": "tiktoken not available"}
    encoder = tiktoken.get_encoding("cl100k_base")
    tokens = [len(encoder.encode(chunk.get("text") or "")) for chunk in chunks]
    if not tokens:
        return {"count": 0}
    return {
        "count": len(tokens),
        "total": sum(tokens),
        "min": min(tokens),
        "max": max(tokens),
        "mean": statistics.mean(tokens),
        "p50": percentile([float(t) for t in tokens], 50),
        "p90": percentile([float(t) for t in tokens], 90),
    }


def build_report(material_id: str) -> str:
    load_env_file(Path(__file__).parents[1] / ".env")
    client = Client(require_env("SUPABASE_URL"), require_env("SUPABASE_SERVICE_ROLE_KEY"))

    materials = client.get(
        MATERIALS_TABLE, {"id": f"eq.{material_id}", "select": "*", "limit": 1}
    )
    if not materials:
        raise SystemExit(f"material {material_id} not found")
    material = materials[0]

    jobs = client.get(
        JOBS_TABLE,
        {"material_id": f"eq.{material_id}", "order": "attempt.asc", "select": "*"},
    )
    telemetry = client.get_all_pages(
        TELEMETRY_TABLE, {"material_id": f"eq.{material_id}", "order": "id.asc", "select": "*"}
    )
    chunks = client.get_all_pages(
        CHUNKS_TABLE,
        {
            "material_id": f"eq.{material_id}",
            "order": "ordinal.asc",
            "select": "ordinal,text,skipped",
        },
    )

    lines: list[str] = []
    lines.append(f"# Ingestion telemetry report — `{material_id}`")
    lines.append("")
    lines.append(f"- **Title:** {material.get('title') or '(untitled)'}")
    lines.append(
        f"- **Kind:** {material.get('kind')} · **State:** {material.get('ingestion_state')}"
    )
    lines.append(
        f"- **Chunk count:** {material.get('chunk_count')} · "
        f"**Grounding version:** {material.get('grounding_version')}"
    )
    lines.append(f"- **Telemetry records:** {len(telemetry)}")
    lines.append("")

    lines.append("## Attempts (ingestion_jobs)")
    lines.append("")
    lines.append("| attempt | status | error | created_at | completed_at |")
    lines.append("|---|---|---|---|---|")
    for job in jobs:
        if job.get("error_code"):
            error = f"{job.get('error_code')}: {job.get('error_message')}"
        else:
            error = "—"
        lines.append(
            f"| {job.get('attempt')} | {job.get('status')} | {error} | "
            f"{job.get('created_at', '')[:19]} | {job.get('completed_at') or '—'} |"
        )
    lines.append("")

    if telemetry:
        lines.append("## Stage breakdown")
        lines.append("")
        lines.append("| stage | count | engine | total | p50 | p95 |")
        lines.append("|---|---|---|---|---|---|")
        for stage, count, model, total, p50, p95 in stage_table(telemetry):
            lines.append(f"| {stage} | {count} | {model} | {total} | {p50} | {p95} |")
        lines.append("")

        batches = [r for r in telemetry if r.get("stage") == "embed-batch"]
        if batches:
            latencies = [float(r.get("latency_ms") or 0) for r in batches]
            tokens = [int(r.get("input_tokens") or 0) for r in batches]
            texts = [int(r.get("texts_count") or 0) for r in batches]
            retried = sum(1 for r in batches if r.get("repair_attempted"))
            outcomes: dict[str, int] = {}
            for record in batches:
                outcome = record.get("outcome") or "?"
                outcomes[outcome] = outcomes.get(outcome, 0) + 1
            lines.append("## Embedding provider calls (embed-batch)")
            lines.append("")
            lines.append(f"- **Calls:** {len(batches)} · **Total tokens:** {sum(tokens):,}")
            mean_tokens = statistics.mean(tokens) if tokens else 0
            mean_texts = statistics.mean(texts) if texts else 0
            lines.append(
                f"- **Mean tokens/call:** {mean_tokens:.0f} · "
                f"**Mean texts/call:** {mean_texts:.0f}"
            )
            mean_latency = fmt_ms(statistics.mean(latencies))
            lines.append(
                f"- **Latency — mean:** {mean_latency} · "
                f"**p50:** {fmt_ms(percentile(latencies, 50))} · "
                f"**p95:** {fmt_ms(percentile(latencies, 95))} · "
                f"**max:** {fmt_ms(max(latencies))}"
            )
            retry_rate = retried / len(batches) * 100
            lines.append(f"- **Retried calls:** {retried} ({retry_rate:.1f}%)")
            outcome_text = ", ".join(f"{k}={v}" for k, v in sorted(outcomes.items()))
            lines.append(f"- **Outcomes:** {outcome_text}")
            throughput = sum(tokens) / max(1.0, sum(latencies) / 1000.0)
            lines.append(
                f"- **Embedding throughput:** {throughput:,.0f} tokens/s "
                "(provider wall time)"
            )
            lines.append("")

        total_latency = sum(float(r.get("latency_ms") or 0) for r in telemetry)
        lines.append(
            f"**Sum of stage latencies (worker-side pipeline time):** "
            f"{fmt_ms(total_latency)}"
        )
        lines.append("")

    lines.append("## Chunks")
    lines.append("")
    skipped = sum(1 for chunk in chunks if chunk.get("skipped"))
    lines.append(
        f"- **Total chunks:** {len(chunks)} · "
        f"**Skipped (provider zero vector):** {skipped}"
    )
    token_stats = chunk_token_stats(chunks)
    if "error" not in token_stats and token_stats.get("count"):
        stats = token_stats
        overlap_waste = OVERLAP_TOKENS * max(0, stats["count"] - 1)
        lines.append(
            f"- **Tokens — total:** {stats['total']:,} · **mean/chunk:** {stats['mean']:.0f} · "
            f"**p50:** {stats['p50']:.0f} · **p90:** {stats['p90']:.0f} · **max:** {stats['max']}"
        )
        boundaries = max(0, stats["count"] - 1)
        waste_pct = overlap_waste / max(1, stats["total"]) * 100
        lines.append(
            f"- **Overlap waste (est. {OVERLAP_TOKENS} tokens × "
            f"{boundaries} boundaries):** {overlap_waste:,} tokens "
            f"({waste_pct:.1f}% of embedded text)"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingestion telemetry report for one material")
    parser.add_argument("material_id", help="materials.id to report on")
    args = parser.parse_args()
    print(build_report(args.material_id))


if __name__ == "__main__":
    main()
