"""Generation-quality evaluation harness (#48).

Durable, offline-first evaluation for groundedness, retrieval, difficulty
calibration, diversity/deduplication, mastery candidates, and coding
suitability. Evaluation never runs inside the online generation hot path and
cannot block ordinary generation unless the caller explicitly activates a gate
(``--activate`` or ``EVAL_HARNESS_ACTIVATE=1``).

Evidence is redacted: the harness reads counts, rates, bands, and warning
codes. It never selects ``hidden_block``, answer keys, reference solutions, or
raw material text into its output.

Gold samples, shared folds, the attempt-count gate, and the activation
thresholds are all pinned in ``eval_golds.json`` (AC1).

Usage:
    uv run --package intelligence python scripts/eval_harness.py --verify-golds
    uv run --package intelligence python scripts/eval_harness.py --summarize
    uv run --package intelligence python scripts/eval_harness.py --summarize --activate
    uv run --package intelligence python scripts/eval_harness.py --groundedness-judge --limit 2
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import math
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any

import httpx

sys.path.insert(0, str(Path(__file__).parent))
from generation_probe import (  # noqa: E402 - reused, never reimplemented
    cosine,
    make_client,
    metric_row,
    normalize_mcq,
    sanitize,
)
from retrieval_probe import (  # noqa: E402
    embed_query_sidecar,
    fetch_chunks,
    load_env_file,
    rank_with_rpc,
)

from py_progress.mastery import BktParams, MasteryObservation, bkt_forward  # noqa: E402

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[2]
ENV_PATH = SCRIPT_DIR.parent / ".env"
GOLD_PATH = SCRIPT_DIR / "eval_golds.json"
EVIDENCE_DIR = REPO_ROOT / "research/doc/deepseek-generation-probe"
OUT_DIR = REPO_ROOT / "research/doc/generation-quality-harness"
LIVE_CACHE = OUT_DIR / "live.json"

JUDGE_SYSTEM = (
    "You audit whether a generated exam question is answerable purely from the "
    "source chunks it cites. Answer strictly from the chunks; do not use outside "
    "knowledge. Respond only with the required JSON object."
)
JUDGE_USER = (
    "Question:\n{question}\n\nCited chunks:\n{chunks}\n\n"
    "Is the question answerable purely from these chunks?"
)
JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "answerable": {"type": "boolean"},
        "reason": {"type": "string"},
    },
    "required": ["answerable", "reason"],
    "additionalProperties": False,
}

logger = logging.getLogger("eval_harness")


def configure_logging() -> None:
    """One JSON-ish line per record; additive LOG_LEVEL, rule 17."""
    if logging.getLogger().handlers:
        return
    level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


# ---------------------------------------------------------------------------
# Pure metrics (unit-tested)
# ---------------------------------------------------------------------------


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(65536), b""):
            digest.update(block)
    return digest.hexdigest()


def retrieval_metrics(ranks: list[int | None]) -> dict:
    """ranks[i] = best rank of a gold chunk for query i, None = miss."""
    n = len(ranks)
    if n == 0:
        return {"n": 0, "recall1": None, "recall3": None, "recall5": None, "mrr": None}
    hits = [r for r in ranks if r is not None]
    return {
        "n": n,
        "recall1": round(sum(1 for r in hits if r <= 1) / n, 4),
        "recall3": round(sum(1 for r in hits if r <= 3) / n, 4),
        "recall5": round(sum(1 for r in hits if r <= 5) / n, 4),
        "mrr": round(sum(1.0 / r for r in hits) / n, 4),
    }


def expected_calibration_error(preds: list[float], actual: list[bool], bins: int = 10) -> float:
    """Mirrors the #43 bake-off ECE definition (10 bins)."""
    if not preds:
        return 0.0
    buckets: list[list[tuple[float, bool]]] = [[] for _ in range(bins)]
    for pred, truth in zip(preds, actual):
        index = min(bins - 1, int(pred * bins))
        buckets[index].append((pred, truth))
    total = len(preds)
    error = 0.0
    for bucket in buckets:
        if not bucket:
            continue
        mean_pred = statistics.mean(p for p, _ in bucket)
        mean_actual = statistics.mean(1.0 if t else 0.0 for _, t in bucket)
        error += (len(bucket) / total) * abs(mean_pred - mean_actual)
    return round(error, 4)


def auc(preds: list[float], actual: list[bool]) -> float | None:
    """Rank AUC with ties counted half. None when one class is absent."""
    positives = [p for p, t in zip(preds, actual) if t]
    negatives = [p for p, t in zip(preds, actual) if not t]
    if not positives or not negatives:
        return None
    wins = 0.0
    for pos in positives:
        for neg in negatives:
            if pos > neg:
                wins += 1.0
            elif pos == neg:
                wins += 0.5
    return round(wins / (len(positives) * len(negatives)), 4)


def calibration_metrics(rows: list[dict]) -> dict:
    """Authored band vs empirical score.

    rows = [{band: int, score: float, questionId: str}]. The observed band is
    derived from the empirical score (band 1 is the hardest, band 5 the
    easiest): observed = round(6 - 5 * mean_score), clamped to 1..5.
    """
    if not rows:
        return {
            "n": 0,
            "questions": 0,
            "mean_abs_band_error": None,
            "curve": {},
            "monotonic_decreasing": None,
        }
    by_band: dict[int, list[float]] = {}
    by_question: dict[str, list[float]] = {}
    for row in rows:
        by_band.setdefault(int(row["band"]), []).append(float(row["score"]))
        by_question.setdefault(str(row["questionId"]), []).append(float(row["score"]))
    curve = {band: round(statistics.mean(scores), 4) for band, scores in sorted(by_band.items())}
    # A curve needs at least two authored bands; one band cannot calibrate.
    if len(curve) < 2:
        return {
            "n": len(rows),
            "questions": len(by_question),
            "mean_abs_band_error": None,
            "curve": {str(k): v for k, v in curve.items()},
            "monotonic_decreasing": None,
        }
    errors = [abs(band - min(5, max(1, round(6 - 5 * mean)))) for band, mean in curve.items()]
    means = [curve[band] for band in sorted(curve)]
    monotonic = all(a >= b for a, b in zip(means, means[1:]))
    return {
        "n": len(rows),
        "questions": len(by_question),
        "mean_abs_band_error": round(statistics.mean(errors), 4),
        "curve": {str(k): v for k, v in curve.items()},
        "monotonic_decreasing": monotonic,
    }


def position_entropy(positions: list[int], slots: int = 4) -> float | None:
    if not positions:
        return None
    counts = [positions.count(i) for i in range(slots)]
    total = sum(counts)
    entropy = 0.0
    for count in counts:
        if count:
            p = count / total
            entropy -= p * math.log(p, 2)
    return round(entropy, 4)


def diversity_metrics(records: list[dict]) -> dict:
    """records = [{embeddings: {stem, options} | None, correctIndex: int|None}]."""
    stems = [r["embeddings"]["stem"] for r in records if r.get("embeddings")]
    pairs = 0
    near_dup = 0
    for i in range(len(stems)):
        for j in range(i + 1, len(stems)):
            pairs += 1
            if cosine(stems[i], stems[j]) >= 0.95:
                near_dup += 1
    distractor_cos: list[float] = []
    for record in records:
        embeddings = record.get("embeddings")
        index = record.get("correctIndex")
        if (
            not embeddings
            or len(embeddings.get("options") or []) != 4
            or not isinstance(index, int)
        ):
            continue
        dists = [o for i, o in enumerate(embeddings["options"]) if i != index]
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
    positions = [r["correctIndex"] for r in records if isinstance(r.get("correctIndex"), int)]
    return {
        "stem_pairs": pairs,
        "near_dup_rate": round(near_dup / pairs, 4) if pairs else None,
        "distractor_mean_cosine": round(statistics.mean(distractor_cos), 4)
        if distractor_cos
        else None,
        "option_position_entropy": position_entropy(positions),
        "option_position_hist": {str(i): positions.count(i) for i in range(4)},
    }


def coding_suitability(rows: list[dict]) -> dict:
    """rows = [{materialId, formats: [str], warnings: [str], status: str}].

    Only attempts that reached the suitability judge count: an attempt that
    failed for another reason (for example an empty material) carries a
    different warning code and is excluded from the derivable rate.
    """
    coding = [r for r in rows if "coding" in (r.get("formats") or [])]
    judged = [r for r in coding if not (set(r.get("warnings") or []) - {"code_not_derivable"})]
    refused = [r for r in judged if "code_not_derivable" in (r.get("warnings") or [])]
    failed_other = [r for r in coding if r not in judged]
    by_material: dict[str, dict] = {}
    for row in judged:
        entry = by_material.setdefault(str(row.get("materialId")), {"attempts": 0, "refused": 0})
        entry["attempts"] += 1
        if "code_not_derivable" in (row.get("warnings") or []):
            entry["refused"] += 1
    return {
        "coding_attempts": len(coding),
        "judged_attempts": len(judged),
        "code_not_derivable": len(refused),
        "failed_other": len(failed_other),
        "derivable_rate": round(1 - len(refused) / len(judged), 4) if judged else None,
        "by_material": by_material,
    }


def coding_gold_agreement(by_material: dict, coding_gold: list[dict]) -> dict:
    """Compare observed derivability against the labeled gold battery."""
    checked = 0
    agreed = 0
    disagreements: list[str] = []
    for item in coding_gold:
        observed = by_material.get(str(item["materialId"]))
        if not observed or not observed["attempts"]:
            continue
        observed_derivable = observed["refused"] < observed["attempts"]
        checked += 1
        if observed_derivable == bool(item["expectedDerivable"]):
            agreed += 1
        else:
            disagreements.append(
                f"{item['label']}: expected derivable={item['expectedDerivable']} "
                f"but {observed['refused']}/{observed['attempts']} refused"
            )
    return {
        "checked": checked,
        "agreed": agreed,
        "agreement_rate": round(agreed / checked, 4) if checked else None,
        "disagreements": disagreements,
    }


def unresolved_snippets(golds: dict, chunks: list[dict]) -> list[str]:
    """Gold snippets that match no corpus chunk (actionable gold-set repair)."""
    collapsed = [" ".join((c.get("text") or "").split()).lower() for c in chunks]
    problems: list[str] = []
    for key, label in (("objectiveGold", "objective"), ("writtenGold", "written")):
        items = json.loads(gold_path(golds[key]).read_text(encoding="utf-8"))
        for item in items:
            snippets = [item["answerSnippet"], *item.get("altSnippets", [])]
            if not any(
                any(" ".join(s.split()).lower() in text for s in snippets) for text in collapsed
            ):
                problems.append(f"{label} gold snippet unresolved: {item['label']}")
    return problems


def mastery_candidates(sequences: list[list[bool]]) -> dict:
    """Score the shipped bkt-v1 against a running-proportion baseline.

    sequences = per-(material, skill) observation order, oldest first.
    """
    bkt_preds: list[float] = []
    base_preds: list[float] = []
    actual: list[bool] = []
    for sequence in sequences:
        if not sequence:
            continue
        observations = [MasteryObservation(skillTag="", correct=bool(x)) for x in sequence]
        _, p_correct = bkt_forward(observations, BktParams())
        successes = 0
        for i, truth in enumerate(sequence):
            prior = successes / i if i else 0.5
            bkt_preds.append(p_correct[i])
            base_preds.append(prior)
            actual.append(bool(truth))
            successes += 1 if truth else 0
    return {
        "sequences": len([s for s in sequences if s]),
        "observations": len(actual),
        "bkt-v1": {
            "ece": expected_calibration_error(bkt_preds, actual),
            "auc": auc(bkt_preds, actual),
        },
        "running-proportion": {
            "ece": expected_calibration_error(base_preds, actual),
            "auc": auc(base_preds, actual),
        },
    }


def telemetry_summary(rows: list[dict]) -> dict:
    outcomes: dict[str, int] = {}
    requested = accepted = repairs = 0
    for row in rows:
        outcomes[row.get("outcome", "?")] = outcomes.get(row.get("outcome", "?"), 0) + 1
        requested += int(row.get("questions_requested") or 0)
        accepted += int(row.get("questions_accepted") or 0)
        repairs += 1 if row.get("repair_attempted") else 0
    return {
        "records": len(rows),
        "outcomes": outcomes,
        "questions_requested": requested,
        "questions_accepted": accepted,
        "acceptance_rate": round(accepted / requested, 4) if requested else None,
        "repair_rate": round(repairs / len(rows), 4) if rows else None,
    }


def evaluate_gates(summary: dict, thresholds: dict) -> list[dict]:
    """Fail-closed, actionable: one entry per breached gate."""
    checks = [
        ("schemaValid", summary["objective"].get("schema_valid"), thresholds["schemaValid"], "min"),
        (
            "citationValid",
            summary["objective"].get("citation_valid"),
            thresholds["citationValid"],
            "min",
        ),
        ("goldSupport", summary["objective"].get("gold_support"), thresholds["goldSupport"], "min"),
        (
            "retrievalRecall3",
            summary["retrieval"].get("recall3"),
            thresholds["retrievalRecall3"],
            "min",
        ),
        ("retrievalMrr", summary["retrieval"].get("mrr"), thresholds["retrievalMrr"], "min"),
        ("nearDupMax", summary["diversity"].get("near_dup_rate"), thresholds["nearDupMax"], "max"),
        (
            "difficultyMeanAbsBandError",
            summary["difficulty"].get("mean_abs_band_error"),
            thresholds["difficultyMeanAbsBandError"],
            "max",
        ),
        (
            "masteryMinAuc",
            summary["mastery"]["bkt-v1"].get("auc"),
            thresholds["masteryMinAuc"],
            "min",
        ),
        (
            "codingDerivableMin",
            summary["coding"].get("derivable_rate"),
            thresholds["codingDerivableMin"],
            "min",
        ),
    ]
    failures: list[dict] = []
    for metric, observed, threshold, direction in checks:
        if observed is None:
            failures.append(
                {
                    "metric": metric,
                    "observed": None,
                    "threshold": threshold,
                    "message": (
                        f"{metric} unmeasured (no eligible evidence) - "
                        "collect data or lower the gate"
                    ),
                }
            )
            continue
        breached = observed < threshold if direction == "min" else observed > threshold
        if breached:
            failures.append(
                {
                    "metric": metric,
                    "observed": observed,
                    "threshold": threshold,
                    "message": (
                        f"{metric} {observed} {'<' if direction == 'min' else '>'} {threshold}"
                    ),
                }
            )
    return failures


# ---------------------------------------------------------------------------
# Gold registry
# ---------------------------------------------------------------------------


def load_golds(path: Path = GOLD_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def gold_path(name: str) -> Path:
    return SCRIPT_DIR / name


def verify_golds(golds: dict) -> list[str]:
    """Actionable list of gold-set problems (empty = healthy)."""
    problems: list[str] = []
    for fold in golds.get("folds", []):
        path = REPO_ROOT / fold["path"]
        if not path.is_file():
            problems.append(f"fold missing: {fold['path']}")
        elif sha256_file(path) != fold["sha256"]:
            problems.append(f"fold hash drifted: {fold['path']} (folds are pinned, not edited)")
    for key, label in (
        ("objectiveGold", "objective"),
        ("writtenGold", "written"),
        ("codingGold", "coding"),
    ):
        path = gold_path(golds[key])
        if not path.is_file():
            problems.append(f"{label} gold missing: {path.name}")
            continue
        items = json.loads(path.read_text(encoding="utf-8"))
        if not items:
            problems.append(f"{label} gold is empty: {path.name}")
        for item in items:
            if label in ("objective", "written") and not item.get("answerSnippet"):
                problems.append(f"{label} gold item without answerSnippet: {item.get('label')}")
            if label == "coding" and "expectedDerivable" not in item:
                problems.append(f"coding gold item without expectedDerivable: {item.get('label')}")
    return problems


# ---------------------------------------------------------------------------
# Evidence readers (redacted columns only)
# ---------------------------------------------------------------------------


class SupabaseReader:
    """Read-only PostgREST reader; never selects hidden grading content."""

    def __init__(self, base: str, key: str, client: httpx.Client | None = None) -> None:
        self._base = base.rstrip("/")
        self._key = key
        self._client = client

    def select(self, table: str, params: dict[str, str]) -> list[dict]:
        client = self._client or httpx.Client(timeout=60.0)
        try:
            response = client.get(
                f"{self._base}/rest/v1/{table}",
                params=params,
                headers={"apikey": self._key, "Authorization": f"Bearer {self._key}"},
            )
        finally:
            if self._client is None:
                client.close()
        if response.status_code >= 400:
            raise SystemExit(f"{table} read failed: {response.status_code} {response.text[:200]}")
        return response.json()

    def assessments(self, limit: int) -> list[dict]:
        return self.select(
            "assessments",
            {
                "select": "id,material_id,status,recipe,warnings",
                "limit": str(limit),
                "order": "created_at.desc",
            },
        )

    def questions(self, limit: int) -> list[dict]:
        return self.select(
            "questions",
            {
                "select": "id,format,authored_difficulty,skill_tags",
                "limit": str(limit),
                "order": "created_at.desc",
            },
        )

    def attempts(self, limit: int) -> list[dict]:
        return self.select(
            "question_attempts",
            {
                "select": "question_id,grade,graded_at",
                "grade": "not.is.null",
                "limit": str(limit),
                "order": "graded_at.asc",
            },
        )

    def telemetry(self, limit: int) -> list[dict]:
        return self.select(
            "generation_telemetry",
            {
                "select": (
                    "task,outcome,questions_requested,questions_accepted,"
                    "repair_attempted,input_tokens,output_tokens"
                ),
                "task": "eq.assessment_generation",
                "limit": str(limit),
            },
        )


def read_env() -> tuple[str, str]:
    load_env_file(ENV_PATH)
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base or not key:
        raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required")
    return base, key


def load_evidence_rows(golds: dict) -> dict:
    """Objective rows from the recorded #56 probe (no live calls)."""
    contexts_path = EVIDENCE_DIR / "contexts.json"
    raw_path = EVIDENCE_DIR / "raw.jsonl"
    contexts = (
        json.loads(contexts_path.read_text(encoding="utf-8")) if contexts_path.is_file() else {}
    )
    rows = []
    if raw_path.is_file():
        rows = [json.loads(line) for line in raw_path.read_text(encoding="utf-8").splitlines()]
    return {"contexts": contexts, "rows": rows}


def objective_metrics(evidence: dict) -> tuple[dict, list[dict]]:
    rows = [r for r in evidence["rows"] if r.get("kind") == "generation" and r.get("layer") == "S"]
    if not rows:
        return {"n": 0}, []
    metrics = metric_row(rows, evidence["contexts"])
    records = []
    for row in rows:
        if row.get("outcome") != "ok" or not row.get("parsed_ok") or not row.get("mcq"):
            continue
        mcq = normalize_mcq(row["mcq"])
        records.append(
            {"embeddings": row.get("embeddings"), "correctIndex": mcq.get("correctIndex")}
        )
    return metrics, records


# ---------------------------------------------------------------------------
# Live arms (opt-in)
# ---------------------------------------------------------------------------


def retrieval_arm(golds: dict, limit: int) -> dict:
    """Recompute recall@k / MRR for the objective gold set (needs the sidecar)."""
    base, key = read_env()
    material_id = golds["corpus"]["materialId"]
    questions = json.loads(gold_path(golds["objectiveGold"]).read_text(encoding="utf-8"))
    if limit:
        questions = questions[:limit]
    client = httpx.Client(timeout=60.0)
    chunks = fetch_chunks(client, base, key, material_id)

    def collapse(text: str) -> str:
        return " ".join(text.split()).strip().lower()

    ranks: list[int | None] = []
    for item in questions:
        vector = embed_query_sidecar(item["question"])
        results = rank_with_rpc(client, base, key, material_id, vector, item["question"])
        snippets = [item["answerSnippet"], *item.get("altSnippets", [])]
        gold_ids = {
            chunk["id"]
            for chunk in chunks
            if any(collapse(s) in collapse(chunk.get("text") or "") for s in snippets)
        }
        if not gold_ids:
            logger.warning("gold snippet unresolved for %s - rerun --verify-golds", item["label"])
            continue
        best = min(
            (i for i, row in enumerate(results, start=1) if row["chunk_id"] in gold_ids),
            default=None,
        )
        ranks.append(best)
    return retrieval_metrics(ranks)


def judge_groundedness(golds: dict, limit: int) -> dict:
    """Offline LLM judge: is each question answerable from its cited chunks?"""
    evidence = load_evidence_rows(golds)
    judge = golds["judge"]
    client = make_client()
    records = [
        r
        for r in evidence["rows"]
        if r.get("kind") == "generation" and r.get("layer") == "S" and r.get("parsed_ok")
    ]
    if limit:
        records = records[:limit]
    verdicts: list[dict] = []
    for row in records:
        mcq = normalize_mcq(row["mcq"])
        context = evidence["contexts"].get(f"{row['layer']}:{row['index']}", {}).get("context", [])
        cited = {c.get("chunkId") for c in mcq["citations"] if isinstance(c, dict)}
        blocks = "\n".join(
            f'<chunk id="{c["chunkId"]}">{(c["text"] or "")[:2400]}</chunk>'
            for c in context
            if c["chunkId"] in cited
        )
        question = mcq["stem"] + "\n" + "\n".join(mcq["options"])
        verdicts.append(
            {
                "key": f"{row['layer']}:{row['index']}",
                **_judge_call(client, judge, question, blocks),
            }
        )
    answerable = [v for v in verdicts if v["answerable"] is True]
    return {
        "judged": len(verdicts),
        "answerable": len(answerable),
        "groundedness_rate": round(len(answerable) / len(verdicts), 4) if verdicts else None,
        "verdicts": verdicts,
    }


def _judge_call(client: Any, judge: dict, question: str, blocks: str) -> dict:
    try:
        raw = client.chat.completions.with_raw_response.create(
            model=judge["model"],
            messages=[
                {"role": "system", "content": JUDGE_SYSTEM},
                {"role": "user", "content": JUDGE_USER.format(question=question, chunks=blocks)},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "groundedness", "strict": True, "schema": JUDGE_SCHEMA},
            },
            timeout=judge["timeoutSeconds"],
            extra_body={"reasoning": {"enabled": False}},
        )
        body = json.loads(raw.text)
        content = (body.get("choices") or [{}])[0].get("message", {}).get("content")
        parsed = json.loads(content)
        return {
            "answerable": bool(parsed.get("answerable")),
            "reason": sanitize(parsed.get("reason", "")),
        }
    except Exception as exc:  # noqa: BLE001 - fail-closed, surfaced in the report
        logger.warning("groundedness judge failed: %s", sanitize(str(exc)))
        return {"answerable": None, "reason": "judge_error"}


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


def load_live_cache() -> dict:
    """Last live-arm results, so a plain --summarize reproduces the report."""
    if not LIVE_CACHE.is_file():
        return {}
    return json.loads(LIVE_CACHE.read_text(encoding="utf-8"))


def save_live_cache(live: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    LIVE_CACHE.write_text(json.dumps(live, indent=2), encoding="utf-8")


def build_summary(golds: dict, live: dict) -> dict:
    base, key = read_env()
    reader = SupabaseReader(base, key)
    evidence = load_evidence_rows(golds)
    objective, diversity_records = objective_metrics(evidence)

    questions = {q["id"]: q for q in reader.questions(2000)}
    attempts = reader.attempts(2000)
    gate_k = golds["attemptGateK"]

    per_question: dict[str, list[float]] = {}
    sequences: dict[tuple[str, str], list[bool]] = {}
    for attempt in attempts:
        grade = attempt.get("grade") or {}
        question = questions.get(str(attempt.get("question_id")))
        if question is None:
            continue
        per_question.setdefault(question["id"], []).append(float(grade.get("score") or 0.0))
        for skill in grade.get("perSkill") or []:
            sequences.setdefault(
                (grade.get("materialId", ""), skill.get("skillTag", "")), []
            ).append(bool(skill.get("correct")))

    calibration_rows = [
        {"band": q["authored_difficulty"], "score": score, "questionId": q["id"]}
        for qid, scores in per_question.items()
        if len(scores) >= gate_k and (q := questions[qid]).get("authored_difficulty") is not None
        for score in scores
    ]

    assessments = reader.assessments(2000)
    coding_rows = [
        {
            "materialId": row.get("material_id"),
            "formats": (row.get("recipe") or {}).get("formats") or [],
            "warnings": [w.get("code") for w in (row.get("warnings") or []) if isinstance(w, dict)],
            "status": row.get("status"),
        }
        for row in assessments
    ]
    coding = coding_suitability(coding_rows)
    coding["gold"] = coding_gold_agreement(
        coding["by_material"],
        json.loads(gold_path(golds["codingGold"]).read_text(encoding="utf-8")),
    )

    return {
        "meta": {
            "goldVersion": golds["version"],
            "corpus": golds["corpus"],
            "attemptGateK": gate_k,
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "evidenceDir": str(EVIDENCE_DIR.relative_to(REPO_ROOT)),
        },
        "objective": objective,
        "diversity": diversity_metrics(diversity_records),
        "retrieval": live.get(
            "retrieval", {"n": 0, "recall1": None, "recall3": None, "recall5": None, "mrr": None}
        ),
        "groundedness": live.get("groundedness", {"judged": 0, "groundedness_rate": None}),
        "difficulty": calibration_metrics(calibration_rows),
        "mastery": mastery_candidates(list(sequences.values())),
        "coding": coding,
        "telemetry": telemetry_summary(reader.telemetry(5000)),
    }


def write_report(summary: dict, failures: list[dict], activated: bool) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    meta = summary["meta"]
    lines = [
        "# Generation-quality evaluation harness",
        "",
        f"- Gold version: `{meta['goldVersion']}` · Attempt gate K: {meta['attemptGateK']}",
        f"- Corpus: `{meta['corpus']['materialId']}` ({meta['corpus']['expectedChunks']} chunks, "
        f"{meta['corpus']['embeddingProvider']})",
        f"- Generated: {meta['generatedAt']} · Activation gate: {'ON' if activated else 'off'}",
        f"- Live arms: {meta.get('liveSource', 'none')}",
        "",
        "## Gate verdict",
        "",
    ]
    if not failures:
        lines.append("PASS - every measured metric met its threshold.")
    else:
        lines.append(f"FAIL - {len(failures)} gate(s) breached:")
        lines.append("")
        for failure in failures:
            lines.append(f"- `{failure['metric']}`: {failure['message']}")
    lines += [
        "",
        "## Objective (recorded #56 evidence)",
        "",
        "| metric | value |",
        "|---|---|",
    ]
    for key in (
        "n",
        "schema_valid",
        "citation_valid",
        "gold_support",
        "copy_through",
        "near_dup_rate",
    ):
        lines.append(f"| {key} | {summary['objective'].get(key)} |")
    lines += [
        "",
        "## Groundedness",
        "",
        f"- LLM judge (offline): {summary['groundedness'].get('groundedness_rate')} "
        f"over {summary['groundedness'].get('judged')} judged",
        f"- Gold support (citation contains the gold answer): "
        f"{summary['objective'].get('gold_support')}",
        "",
        "## Retrieval",
        "",
        f"- n={summary['retrieval'].get('n')} · recall@1={summary['retrieval'].get('recall1')} · "
        f"recall@3={summary['retrieval'].get('recall3')} · "
        f"recall@5={summary['retrieval'].get('recall5')} · "
        f"MRR={summary['retrieval'].get('mrr')}",
        "",
        "## Difficulty calibration",
        "",
        f"- questions with >= K attempts: {summary['difficulty'].get('questions')} "
        f"(observations: {summary['difficulty'].get('n')})",
        f"- mean abs band error: {summary['difficulty'].get('mean_abs_band_error')} · "
        f"monotonic: {summary['difficulty'].get('monotonic_decreasing')}",
        f"- authored band -> empirical score: {summary['difficulty'].get('curve')}",
        "",
        "## Diversity / deduplication",
        "",
        f"- near-dup rate: {summary['diversity'].get('near_dup_rate')} · "
        f"distractor cosine: {summary['diversity'].get('distractor_mean_cosine')} · "
        f"option position entropy: {summary['diversity'].get('option_position_entropy')}",
        "",
        "## Mastery candidates",
        "",
        "| candidate | ECE | AUC |",
        "|---|---|---|",
    ]
    for candidate in ("bkt-v1", "running-proportion"):
        entry = summary["mastery"][candidate]
        lines.append(f"| {candidate} | {entry.get('ece')} | {entry.get('auc')} |")
    lines += [
        "",
        f"- observations: {summary['mastery'].get('observations')} over "
        f"{summary['mastery'].get('sequences')} (material, skill) sequences",
        "",
        "## Coding suitability",
        "",
        f"- attempts: {summary['coding'].get('coding_attempts')} "
        f"(judged: {summary['coding'].get('judged_attempts')}) · "
        f"`code_not_derivable`: {summary['coding'].get('code_not_derivable')} · "
        f"derivable rate: {summary['coding'].get('derivable_rate')}",
        f"- gold agreement: {summary['coding']['gold'].get('agreement_rate')} "
        f"({summary['coding']['gold'].get('agreed')}/{summary['coding']['gold'].get('checked')} "
        "labeled materials)",
    ]
    for disagreement in summary["coding"]["gold"].get("disagreements") or []:
        lines.append(f"  - {disagreement}")
    lines += [
        "",
        "## Telemetry (redacted)",
        "",
        f"- records: {summary['telemetry'].get('records')} · "
        f"acceptance: {summary['telemetry'].get('acceptance_rate')} · "
        f"repair rate: {summary['telemetry'].get('repair_rate')}",
        f"- outcomes: {summary['telemetry'].get('outcomes')}",
        "",
    ]
    (OUT_DIR / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    logger.info("wrote %s/summary.json + report.md", OUT_DIR.relative_to(REPO_ROOT))


def main() -> None:
    configure_logging()
    parser = argparse.ArgumentParser(description="Generation-quality evaluation harness (#48)")
    parser.add_argument(
        "--summarize", action="store_true", help="offline report from durable evidence"
    )
    parser.add_argument("--verify-golds", action="store_true", help="validate the gold registry")
    parser.add_argument(
        "--retrieval", action="store_true", help="live retrieval arm (needs the sidecar)"
    )
    parser.add_argument(
        "--groundedness-judge", action="store_true", help="live offline groundedness judge"
    )
    parser.add_argument("--limit", type=int, default=0, help="cap retrieval items (dry run)")
    parser.add_argument(
        "--judge-limit", type=int, default=0, help="cap judge items (0 = registry judge.maxItems)"
    )
    parser.add_argument("--activate", action="store_true", help="enable the activation gate")
    args = parser.parse_args()

    golds = load_golds()
    activated = args.activate or os.getenv("EVAL_HARNESS_ACTIVATE") == "1"

    if args.verify_golds:
        problems = verify_golds(golds)
        try:
            base, key = read_env()
        except SystemExit:
            logger.warning("SUPABASE creds absent - skipping snippet resolution")
        else:
            with httpx.Client(timeout=60.0) as client:
                chunks = fetch_chunks(client, base, key, golds["corpus"]["materialId"])
            problems += unresolved_snippets(golds, chunks)
            logger.info("resolved gold snippets against %d corpus chunks", len(chunks))
        for problem in problems:
            logger.error("gold problem: %s", problem)
        if problems:
            raise SystemExit(1)
        logger.info("gold registry healthy (version %s)", golds["version"])
        return

    judge_cap = args.judge_limit or golds["judge"].get("maxItems", 0)

    live: dict[str, Any] = {}
    live_fresh = bool(args.retrieval or args.groundedness_judge)
    if args.retrieval:
        live["retrieval"] = retrieval_arm(golds, args.limit)
    if args.groundedness_judge:
        live["groundedness"] = judge_groundedness(golds, judge_cap)
    if live:
        cached = load_live_cache()
        cached.update(live)
        save_live_cache(cached)
    else:
        live = load_live_cache()
        if live:
            logger.info("reusing cached live arms: %s", ", ".join(sorted(live)))

    summary = build_summary(golds, live)
    summary["meta"]["liveSource"] = "live" if live_fresh else ("cache" if live else "none")
    failures = evaluate_gates(summary, golds["thresholds"])
    write_report(summary, failures, activated)
    for failure in failures:
        logger.warning("gate: %s", failure["message"])
    if activated and failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
