"""Generation-quality probe: DeepSeek (OpenRouter) x Qwen-sidecar retrieval.

Measures how well `deepseek/deepseek-v4-flash-0731` authors grounded MCQs from
contexts retrieved by the Qwen3 sidecar pipeline. Sweeps the full reasoning
ladder (off..max) over two context layers (S = retrieval-driven seeds, R =
deterministically sampled corpus chunks) plus a json_object fallback arm (C)
and a reasoning-details continuation check (K).

Runbook: .work/plans/active/2026-08-22-deepseek-qwen-generation-probe/PLAN.md
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import httpx
from openai import APIError, APIStatusError, APITimeoutError, OpenAI

sys.path.insert(0, str(Path(__file__).parent))
from retrieval_probe import embed_query_sidecar, fetch_chunks, load_env_file, rank_with_rpc

MATERIAL_ID = "80c8b138-b544-4095-8dc0-1c390ac70da2"
SLUG = "deepseek/deepseek-v4-flash-0731"
BASE_URL = "https://openrouter.ai/api/v1"
TIERS = ["off", "low", "medium", "high", "xhigh", "max"]
CONTEXT_TOP_K = 5
SEED = 20260822
PRICE_PER_M = {"prompt": 0.08, "completion": 0.18, "cache_read": 0.016}
CHUNK_PREVIEW_CHARS = 2400
MAX_TOKENS = 12000
CALL_TIMEOUT_S = 180

REPO_ROOT = Path(__file__).resolve().parents[3]
OUT_DIR = REPO_ROOT / "research/doc/deepseek-generation-probe"
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
QUESTIONS_PATH = Path(__file__).resolve().parent / "probe_questions.json"

MCQ_SCHEMA = {
    "type": "object",
    "properties": {
        "stem": {"type": "string"},
        "options": {"type": "array", "items": {"type": "string"}, "minItems": 4, "maxItems": 4},
        "correctIndex": {"type": "integer", "minimum": 0, "maximum": 3},
        "difficulty": {"type": "integer", "minimum": 1, "maximum": 5},
        "skillTags": {"type": "array", "items": {"type": "string"}, "minItems": 1},
        "citations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"chunkId": {"type": "string"}},
                "required": ["chunkId"],
                "additionalProperties": False,
            },
            "minItems": 1,
        },
    },
    "required": ["stem", "options", "correctIndex", "difficulty", "skillTags", "citations"],
    "additionalProperties": False,
}

SYSTEM = (
    "You author one multiple-choice exam question grounded STRICTLY in the provided source chunks. "
    "Rules: cite every chunk you used by its chunkId; invent nothing outside the chunks; make "
    "distractors plausible but clearly wrong to an expert; do not copy a full sentence verbatim "
    "into the stem; target difficulty {difficulty_hint}; respond only with the required "
    "JSON object."
)
USER_SEEDED = (
    "Learner need (topic steer): {steer}\n\nSource chunks:\n{chunks}\n\nAuthor one grounded MCQ."
)
USER_RANDOM = (
    "Source chunks:\n{chunks}\n\nAuthor one grounded MCQ from the most assessable concept."
)
CHUNK_FMT = '<chunk id="{cid}">{text}</chunk>'


# ---------------------------------------------------------------------------
# Pure helpers (unit-tested)
# ---------------------------------------------------------------------------


def sanitize(text: str, limit: int = 300) -> str:
    text = re.sub(r"sk-or-[A-Za-z0-9_-]+", "[REDACTED]", text or "")
    return text[:limit]


def reasoning_extra(tier: str) -> dict:
    if tier == "off":
        return {"reasoning": {"enabled": False}}
    return {"reasoning": {"enabled": True, "effort": tier}}


def build_kwargs(tier: str, messages: list[dict]) -> dict:
    kwargs: dict[str, Any] = dict(
        model=SLUG,
        messages=messages,
        seed=SEED,
        max_tokens=MAX_TOKENS,
        timeout=CALL_TIMEOUT_S,
    )
    if tier == "json":
        kwargs["response_format"] = {"type": "json_object"}
        kwargs["extra_body"] = {
            "provider": {"require_parameters": True},
            "reasoning": {"enabled": False},
        }
    else:
        kwargs["response_format"] = {
            "type": "json_schema",
            "json_schema": {"name": "grounded_mcq", "strict": True, "schema": MCQ_SCHEMA},
        }
        kwargs["extra_body"] = {"provider": {"require_parameters": True}, **reasoning_extra(tier)}
    return kwargs


def classify_success(choice: dict) -> str:
    """Map a normalized choice to an outcome (pure)."""
    finish = choice.get("finish_reason")
    message = choice.get("message") or {}
    if message.get("refusal"):
        return "refusal"
    if finish == "length":
        return "truncated"
    if finish == "content_filter":
        return "content_filter"
    if finish == "error":
        return "provider_error"
    if finish in ("stop", "tool_calls"):
        content = message.get("content")
        if not content:
            return "refusal"
        try:
            json.loads(content)
        except Exception:
            return "malformed_json"
        return "ok"
    return "provider_error"


def classify_http_status(status: int, message: str) -> str:
    if status == 400 and ("effort" in message.lower() or "reasoning" in message.lower()):
        return "tier_rejected"
    if status == 429:
        return "rate_limited"
    if status in (401, 402, 403):
        return "credit_or_auth"
    if status >= 500:
        return "provider_error"
    return "provider_error"


def shingles(text: str, n: int = 12) -> set[str]:
    words = re.findall(r"[a-z0-9']+", (text or "").lower())
    return {" ".join(words[i : i + n]) for i in range(max(0, len(words) - n + 1))}


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def validate_mcq_local(mcq: dict, context_ids: set[str]) -> list[str]:
    """Arm-C local validation; returns failure reasons (empty = valid)."""
    failures: list[str] = []
    if not isinstance(mcq, dict):
        return ["not_an_object"]
    if not isinstance(mcq.get("stem"), str) or not mcq["stem"].strip():
        failures.append("stem_missing")
    options = mcq.get("options")
    if not isinstance(options, list) or len(options) != 4:
        failures.append("options_not_4")
    else:
        if not all(isinstance(o, str) and o.strip() for o in options):
            failures.append("options_empty")
        ci = mcq.get("correctIndex")
        if not isinstance(ci, int) or not 0 <= ci <= 3:
            failures.append("correctIndex_out_of_range")
        elif len(set(options)) < 4:
            failures.append("duplicate_options")
    diff = mcq.get("difficulty")
    if not isinstance(diff, int) or not 1 <= diff <= 5:
        failures.append("difficulty_out_of_range")
    tags = mcq.get("skillTags")
    if not isinstance(tags, list) or not all(isinstance(t, str) and t for t in tags):
        failures.append("skillTags_invalid")
    cites = mcq.get("citations")
    if not isinstance(cites, list) or not cites:
        failures.append("citations_missing")
    else:
        for c in cites:
            if not isinstance(c, dict) or c.get("chunkId") not in context_ids:
                failures.append("citation_out_of_context")
                break
    return failures


# ---------------------------------------------------------------------------
# Data plumbing
# ---------------------------------------------------------------------------


def require_key() -> str:
    load_env_file(ENV_PATH)
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise SystemExit("OPENROUTER_API_KEY is required")
    return key


def make_client() -> OpenAI:
    return OpenAI(base_url=BASE_URL, api_key=require_key(), max_retries=0)


def load_questions() -> list[dict]:
    data = json.loads(QUESTIONS_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list) or not data:
        raise SystemExit("question set is empty")
    return data


def load_contexts() -> dict[str, dict]:
    if not (OUT_DIR / "contexts.json").is_file():
        return {}
    return json.loads((OUT_DIR / "contexts.json").read_text(encoding="utf-8"))


def save_contexts(contexts: dict[str, dict]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "contexts.json").write_text(
        json.dumps(contexts, ensure_ascii=False), encoding="utf-8"
    )


def load_done_keys() -> set[str]:
    path = OUT_DIR / "raw.jsonl"
    if not path.is_file():
        return set()
    keys = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            keys.add(json.loads(line)["key"])
        except Exception:
            continue
    return keys


def append_result(record: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_DIR / "raw.jsonl", "a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")
        fh.flush()
        os.fsync(fh.fileno())


def build_contexts() -> dict[str, dict]:
    """Compute (and cache) S and R contexts. Returns {key: {steer, context}}."""
    cached = load_contexts()
    if cached:
        return cached

    load_env_file(ENV_PATH)
    supa_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supa_url or not service_key:
        raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required")

    client = httpx.Client(timeout=60.0)
    questions = load_questions()
    chunks = fetch_chunks(client, supa_url, service_key, MATERIAL_ID)
    if not chunks:
        raise SystemExit("no embedded chunks found for material")

    contexts: dict[str, dict] = {}
    for i, q in enumerate(questions, start=1):
        try:
            vector = embed_query_sidecar(q["question"])
        except Exception as exc:
            raise SystemExit(f"sidecar query embed failed for Q{i}: {exc}") from exc
        rows = rank_with_rpc(client, supa_url, service_key, MATERIAL_ID, vector, q["question"])
        top = [
            {"chunkId": str(r["chunk_id"]), "text": str(r.get("chunk_text") or "")}
            for r in rows[:CONTEXT_TOP_K]
        ]
        contexts[f"S:{i}"] = {
            "steer": q["question"],
            "snippets": [q["answerSnippet"], *q.get("altSnippets", [])],
            "context": top,
        }

    ordered = sorted(chunks, key=lambda c: c["ordinal"])
    bands = 30
    rng = random.Random(SEED)
    for band in range(bands):
        lo = band * len(ordered) // bands
        hi = (band + 1) * len(ordered) // bands
        pick = rng.choice(ordered[lo:hi])
        contexts[f"R:{band + 1}"] = {
            "steer": None,
            "snippets": [],
            "context": [{"chunkId": pick["id"], "text": pick["text"]}],
        }

    save_contexts(contexts)
    return contexts


def chunks_block(context: list[dict]) -> str:
    return "\n".join(
        CHUNK_FMT.format(cid=c["chunkId"], text=(c["text"] or "")[:CHUNK_PREVIEW_CHARS])
        for c in context
    )


def build_messages(steer: str | None, context: list[dict], band: int) -> list[dict]:
    hint = f"band {band} (1..5)" if steer is None else "moderate (band 3)"
    system = SYSTEM.format(difficulty_hint=hint)
    blocks = chunks_block(context)
    if steer:
        user = USER_SEEDED.format(steer=steer, chunks=blocks)
    else:
        user = USER_RANDOM.format(chunks=blocks)
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


# ---------------------------------------------------------------------------
# Live call path
# ---------------------------------------------------------------------------


def _call_once(client: OpenAI, kwargs: dict) -> dict:
    """One SDK call; returns body dict or raises. Uses with_raw_response to keep
    OpenRouter's top-level `provider` echo (SDK v3 exposes the raw body as text)."""
    raw = client.chat.completions.with_raw_response.create(**kwargs)
    return json.loads(raw.text)


def call_and_classify(client: OpenAI, tier: str, messages: list[dict]) -> dict:
    """Run one generation (with at most one app-level retry for 429/5xx)."""
    kwargs = build_kwargs(tier, messages)
    attempts = 0
    while True:
        attempts += 1
        start = time.monotonic()
        try:
            body = _call_once(client, kwargs)
            latency = (time.monotonic() - start) * 1000.0
            choice = (body.get("choices") or [{}])[0]
            outcome = classify_success(choice)
            usage = body.get("usage") or {}
            details = usage.get("completion_tokens_details") or {}
            return {
                "outcome": outcome,
                "finish_reason": choice.get("finish_reason"),
                "native_finish_reason": choice.get("native_finish_reason"),
                "refusal": bool((choice.get("message") or {}).get("refusal")),
                "content": (choice.get("message") or {}).get("content"),
                "reasoning_details": (choice.get("message") or {}).get("reasoning_details"),
                "usage": {
                    "prompt": usage.get("prompt_tokens", 0),
                    "completion": usage.get("completion_tokens", 0),
                    "reasoning": details.get("reasoning_tokens", 0) or 0,
                },
                "model": body.get("model"),
                "provider": body.get("provider"),
                "latency_ms": round(latency, 1),
                "retried": attempts > 1,
                "error": None,
            }
        except APITimeoutError:
            return {"outcome": "timeout", "error": "provider deadline exceeded"}
        except APIStatusError as exc:
            message = sanitize(str(exc))
            return {"outcome": classify_http_status(exc.status_code, str(exc)), "error": message}
        except APIError as exc:
            return {"outcome": "provider_error", "error": sanitize(str(exc))}


def embed_mcq_vectors(mcq: dict) -> dict | None:
    """Sidecar-embed the stem and options for offline near-dup/distractor metrics."""
    try:
        stem = embed_query_sidecar(mcq["stem"])
        options = [embed_query_sidecar(o) for o in mcq["options"]]
        return {"stem": stem, "options": options}
    except Exception:
        return None


def run_unit(client: OpenAI, key: str, unit: dict, tier: str) -> dict:
    layer, index = key.split(":", 2)[:2]
    idx = int(index)
    band = 3 if layer == "S" else (idx - 1) % 5 + 1
    messages = build_messages(unit.get("steer"), unit["context"], band)
    result = call_and_classify(client, tier, messages)
    record = {
        "key": key,
        "kind": "generation",
        "layer": layer,
        "tier": tier,
        "index": idx,
        "intended_band": band,
        **result,
    }
    if result["outcome"] == "ok" and result.get("content"):
        try:
            mcq = json.loads(result["content"])
            record["mcq"] = mcq
            record["parsed_ok"] = True
            if tier == "json":
                ctx_ids = {c["chunkId"] for c in unit["context"]}
                record["local_failures"] = validate_mcq_local(mcq, ctx_ids)
            vec = embed_mcq_vectors(mcq)
            if vec:
                record["embeddings"] = vec
        except Exception:
            record["parsed_ok"] = False
    else:
        record["parsed_ok"] = False
    append_result(record)
    return record


def run_continuation(client: OpenAI, tier: str, unit: dict, base_record: dict) -> dict:
    """K check: replay assistant message with reasoning_details unmodified (D-04)."""
    messages = build_messages(unit.get("steer"), unit["context"], band=1)
    assistant = {
        "role": "assistant",
        "content": base_record.get("content"),
    }
    details = base_record.get("reasoning_details")
    if details:
        assistant["reasoning_details"] = details
    messages.append(assistant)
    messages.append({"role": "user", "content": "Are you sure? Think carefully."})
    result = call_and_classify(client, tier, messages)
    record = {
        "key": f"K:{tier}:1",
        "kind": "continuation",
        "layer": "R",
        "tier": tier,
        "index": 1,
        "accepted": result["outcome"] == "ok" and bool(result.get("content")),
        **result,
    }
    append_result(record)
    return record


def run(args: argparse.Namespace) -> None:
    contexts = build_contexts()
    client = make_client()
    done = load_done_keys()

    units: list[tuple[str, dict, str]] = []
    if "S" in args.layers:
        for i in range(1, 31):
            if args.limit and i > args.limit:
                break
            for tier in args.tiers:
                key = f"S:{i}:{tier}"
                if key not in done:
                    units.append((key, contexts[f"S:{i}"], tier))
    if "R" in args.layers:
        for i in range(1, 31):
            if args.limit and i > args.limit:
                break
            for tier in args.tiers:
                key = f"R:{i}:{tier}"
                if key not in done:
                    units.append((key, contexts[f"R:{i}"], tier))
    if "C" in args.layers:
        for i in range(1, 31):
            if args.limit and i > args.limit:
                break
            key = f"R:{i}:json"
            if key not in done:
                units.append((key, contexts[f"R:{i}"], "json"))

    print(f"pending units: {len(units)} (already done: {len(done)})")
    if not units:
        print("nothing to run")
        return

    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = {pool.submit(run_unit, client, key, unit, tier): key for key, unit, tier in units}
        for future in as_completed(futures):
            key = futures[future]
            try:
                rec = future.result()
                print(f"  {key}: {rec['outcome']} {rec.get('latency_ms', 0)}ms")
            except Exception as exc:
                print(f"  {key}: FAILED {sanitize(str(exc))}")

    if not args.no_continuation and ("R" in args.layers or "C" in args.layers):
        raw_path = OUT_DIR / "raw.jsonl"
        if not raw_path.is_file():
            print("  K: skipped (no raw records yet)")
            return
        for tier in ["low", "medium", "high", "xhigh", "max"]:
            kkey = f"K:{tier}:1"
            if kkey in done:
                continue
            base = None
            for line in raw_path.read_text(encoding="utf-8").splitlines():
                rec = json.loads(line)
                if (
                    rec.get("kind") == "generation"
                    and rec.get("layer") == "R"
                    and rec.get("tier") == tier
                    and rec.get("index") == 1
                ):
                    base = rec
                    break
            if base is None or base.get("outcome") != "ok":
                print(f"  K:{tier}: skipped (no ok base call)")
                continue
            rec = run_continuation(client, tier, contexts["R:1"], base)
            print(f"  K:{tier}: accepted={rec['accepted']} {rec.get('latency_ms', 0)}ms")


# ---------------------------------------------------------------------------
# Offline metrics + report (Phase 6)
# ---------------------------------------------------------------------------


def load_raw() -> list[dict]:
    path = OUT_DIR / "raw.jsonl"
    if not path.is_file():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def _collapse(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def metric_row(rows: list[dict], contexts: dict[str, dict]) -> dict:
    ok = [r for r in rows if r.get("outcome") == "ok" and r.get("parsed_ok") and r.get("mcq")]
    outcomes: dict[str, int] = {}
    for r in rows:
        outcomes[r.get("outcome", "?")] = outcomes.get(r.get("outcome", "?"), 0) + 1

    schema_valid = len(ok) / len(rows) if rows else 0.0

    citation_valid = 0
    gold_support = 0
    gold_total = 0
    copy_through = 0
    for r in ok:
        ctx = contexts.get(f"{r['layer']}:{r['index']}", {})
        ids = {c["chunkId"] for c in ctx.get("context", [])}
        cites = r["mcq"].get("citations") or []
        if cites and all(c.get("chunkId") in ids for c in cites):
            citation_valid += 1
        cited_text = " ".join(
            c["text"]
            for c in ctx.get("context", [])
            if c["chunkId"] in {x.get("chunkId") for x in cites}
        )
        text = _collapse(r["mcq"].get("stem", "") + " " + " ".join(r["mcq"].get("options", [])))
        chunk_shingles = shingles(_collapse(cited_text)) if cited_text else set()
        if chunk_shingles and (shingles(text) & chunk_shingles):
            copy_through += 1
        if r["layer"] == "S":
            gold_total += 1
            snippets = [_collapse(s) for s in ctx.get("snippets", [])]
            if snippets and any(s in _collapse(cited_text) for s in snippets if s):
                gold_support += 1

    positions = [
        r["mcq"].get("correctIndex") for r in ok if isinstance(r["mcq"].get("correctIndex"), int)
    ]
    distractor_cos: list[float] = []
    for r in ok:
        emb = r.get("embeddings")
        if not emb or len(emb.get("options") or []) != 4:
            continue
        ci = r["mcq"].get("correctIndex")
        dists = [o for i, o in enumerate(emb["options"]) if i != ci]
        if len(dists) == 3:
            distractor_cos.append(
                statistics.mean(
                    [
                        cosine(dists[0], dists[1]),
                        cosine(dists[0], dists[2]),
                        cosine(dists[1], dists[2]),
                    ]
                )
            )
    near_dup = 0
    stems = [r["embeddings"]["stem"] for r in ok if r.get("embeddings")]
    pairs = 0
    for i in range(len(stems)):
        for j in range(i + 1, len(stems)):
            pairs += 1
            if cosine(stems[i], stems[j]) >= 0.95:
                near_dup += 1
    near_dup_rate = near_dup / pairs if pairs else 0.0

    lat = [r.get("latency_ms") or 0 for r in rows]
    usage_prompt = sum(r.get("usage", {}).get("prompt", 0) for r in rows)
    usage_completion = sum(r.get("usage", {}).get("completion", 0) for r in rows)
    usage_reasoning = sum(r.get("usage", {}).get("reasoning", 0) for r in rows)
    cost = (usage_prompt / 1e6) * PRICE_PER_M["prompt"] + (usage_completion / 1e6) * PRICE_PER_M[
        "completion"
    ]
    difficulty: dict[int, int] = {}
    for r in ok:
        d = r["mcq"].get("difficulty")
        if isinstance(d, int):
            difficulty[d] = difficulty.get(d, 0) + 1
    tags = {t for r in ok for t in r["mcq"].get("skillTags", [])}
    failures: dict[str, int] = {}
    for r in rows:
        if r.get("outcome") == "ok" and not r.get("parsed_ok"):
            failures["unparseable_json"] = failures.get("unparseable_json", 0) + 1
    for r in ok:
        for f in r.get("local_failures") or []:
            failures[f] = failures.get(f, 0) + 1

    return {
        "n": len(rows),
        "outcomes": outcomes,
        "schema_valid": round(schema_valid, 4),
        "citation_valid": round(citation_valid / len(ok), 4) if ok else None,
        "gold_support": round(gold_support / gold_total, 4) if gold_total else None,
        "copy_through": round(copy_through / len(ok), 4) if ok else None,
        "option_position_hist": {str(i): positions.count(i) for i in range(4)},
        "distractor_mean_cosine": round(statistics.mean(distractor_cos), 4)
        if distractor_cos
        else None,
        "near_dup_rate": round(near_dup_rate, 4),
        "latency_ms_p50": round(statistics.median(lat), 1) if lat else None,
        "latency_ms_p95": round(sorted(lat)[int(len(lat) * 0.95) - 1], 1) if lat else None,
        "latency_over_30s": sum(1 for v in lat if v > 30000),
        "tokens": {
            "prompt": usage_prompt,
            "completion": usage_completion,
            "reasoning": usage_reasoning,
        },
        "reasoning_share_of_completion": round(usage_reasoning / usage_completion, 4)
        if usage_completion
        else None,
        "cost_usd": round(cost, 6),
        "difficulty_dist": {str(k): v for k, v in sorted(difficulty.items())},
        "skillTag_vocab": len(tags),
        "failure_modes": failures,
    }


def summarize() -> None:
    contexts = load_contexts()
    rows = load_raw()
    if not rows:
        raise SystemExit("no raw records to summarize")
    groups: dict[tuple[str, str], list[dict]] = {}
    for r in rows:
        groups.setdefault((r["layer"], r["tier"]), []).append(r)
    summary: dict[str, dict] = {}
    for (layer, tier), grp in sorted(groups.items()):
        summary[f"{layer}:{tier}"] = metric_row(grp, contexts)
    summary["meta"] = {
        "model": SLUG,
        "material": MATERIAL_ID,
        "seed": SEED,
        "prices_per_m": PRICE_PER_M,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    write_report(summary)
    print(f"wrote summary.json + report.md ({len(summary) - 1} groups)")


def write_report(summary: dict[str, dict]) -> None:
    rows = [k for k in summary if k != "meta"]
    lines: list[str] = [
        "# DeepSeek V4 Flash 0731 x Qwen-sidecar generation-quality probe",
        "",
        f"- Model: `{summary['meta']['model']}` · Material: `{summary['meta']['material']}`",
        f"- Generated: {summary['meta']['generated_at']} · Seed: {summary['meta']['seed']}",
        "",
        "## Validity per tier",
        "",
        "| group | n | schema-valid % | citation-valid % | gold-support % | outcomes |",
        "|---|---|---|---|---|---|",
    ]
    for key in rows:
        m = summary[key]
        lines.append(
            f"| {key} | {m['n']} | {m['schema_valid']:.1%} | "
            f"{'n/a' if m['citation_valid'] is None else f'{m["citation_valid"]:.1%}'} | "
            f"{'n/a' if m['gold_support'] is None else f'{m["gold_support"]:.1%}'} | "
            f"{m['outcomes']} |"
        )
    lines += [
        "",
        "## Grounding and craft",
        "",
        "| group | copy-through % | distractor cos | near-dup % | pos hist | vocab |",
        "|---|---|---|---|---|---|",
    ]
    for key in rows:
        m = summary[key]
        distractor = m["distractor_mean_cosine"]
        distractor_text = "n/a" if distractor is None else round(distractor, 3)
        lines.append(
            f"| {key} | {m['copy_through']:.1%} | {distractor_text} | "
            f"{m['near_dup_rate']:.1%} | {m['option_position_hist']} | "
            f"{m['skillTag_vocab']} |"
        )
    lines += [
        "",
        "## Difficulty distribution (self-assessed)",
        "",
        "| group | band counts |",
        "|---|---|",
    ]
    for key in rows:
        lines.append(f"| {key} | {summary[key]['difficulty_dist']} |")
    lines += [
        "",
        "## Latency and economics",
        "",
        "| group | p50 ms | p95 ms | >30 s | prompt | completion | reasoning | r/share | cost $ |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for key in rows:
        m = summary[key]
        reasoning_share = m["reasoning_share_of_completion"]
        share_text = "n/a" if reasoning_share is None else reasoning_share
        lines.append(
            f"| {key} | {m['latency_ms_p50']} | {m['latency_ms_p95']} | {m['latency_over_30s']} | "
            f"{m['tokens']['prompt']} | {m['tokens']['completion']} | {m['tokens']['reasoning']} | "
            f"{share_text} | {m['cost_usd']} |"
        )
    lines += [
        "",
        "## Continuation acceptance (K)",
        "",
    ]
    cont = [r for r in load_raw() if r.get("kind") == "continuation"]
    if cont:
        lines.append("| tier | accepted | latency ms | finish |")
        lines.append("|---|---|---|---|")
        for r in sorted(cont, key=lambda x: x["tier"]):
            lines.append(
                f"| {r['tier']} | {r['accepted']} | {r.get('latency_ms')} | "
                f"{r.get('finish_reason')} |"
            )
    else:
        lines.append("_no continuation runs recorded_")
    lines += [
        "",
        "## S vs R delta (sidecar handoff cost)",
        "",
        "| metric | S (retrieval-driven) | R (sampled) |",
        "|---|---|---|",
    ]
    for metric in ("schema_valid", "copy_through", "near_dup_rate"):
        s_vals = [summary[f"S:{t}"][metric] for t in TIERS if f"S:{t}" in summary]
        r_vals = [summary[f"R:{t}"][metric] for t in TIERS if f"R:{t}" in summary]
        s_avg = statistics.mean(s_vals) if s_vals else None
        r_avg = statistics.mean(r_vals) if r_vals else None
        lines.append(f"| {metric} | {s_avg} | {r_avg} |")
    (OUT_DIR / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="DeepSeek x Qwen generation-quality probe")
    parser.add_argument(
        "--tiers", default=",".join(TIERS), help="comma-separated effort tiers (off..max) or `json`"
    )
    parser.add_argument(
        "--layers",
        default="S,R,C",
        help="comma-separated layers: S (seeded), R (random), C (json fallback)",
    )
    parser.add_argument("--limit", type=int, default=0, help="cap items per layer (smoke)")
    parser.add_argument("--concurrency", type=int, default=6)
    parser.add_argument("--no-continuation", action="store_true", help="skip K checks")
    parser.add_argument("--summarize", action="store_true", help="offline report only")
    args = parser.parse_args()

    if args.summarize:
        summarize()
        return
    args.tiers = [t.strip() for t in args.tiers.split(",") if t.strip()]
    args.layers = [item.strip().upper() for item in args.layers.split(",") if item.strip()]
    if "C" in args.layers:
        args.layers.remove("C")
        args.layers.append("C")
    run(args)


if __name__ == "__main__":
    main()
