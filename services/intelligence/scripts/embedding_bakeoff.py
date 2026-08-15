#!/usr/bin/env python3
"""Embedding-model bake-off for large-material ingestion.

Runs the incumbent Gemini embedder and candidate self-hosted 768-dim models
over one material's chunk corpus, ranks every model's vectors in-process with
cosine similarity, and reports retrieval quality (recall@1/3/5, MRR, mean top
similarity) plus practical throughput (model load time, corpus wall-clock,
chunks/min, peak RSS).

The Gemini corpus pass is paced with the same sliding-window TPM budget the
production worker uses (25 k tokens/min default), so its wall-clock is the
real per-material wait a self-hosted model would replace.

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... \
        uv run --package intelligence --with sentence-transformers --with torch \
            python scripts/embedding_bakeoff.py --material <material_id> \
            [--models gemini,nomic,gemma,qwen] \
            [--output research/doc/2026-08-14-embedding-model-bakeoff.md]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import time
from pathlib import Path
from typing import Any

import httpx

EMBEDDING_DIMENSIONS = 768
GEMINI_MODEL = "gemini-embedding-001"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:batchEmbedContents"
)
MAX_BATCH_TOKENS = 4000
MAX_TOKENS_PER_MINUTE = 25000
TOP_K = 50
LOCAL_BATCH_SIZE = 32
SAMPLE_SIZE = 64
MAX_MODEL_SECONDS = 40 * 60
RERANK_CANDIDATES = 50

GEMINI_QUERY_TASK = "retrieval_query"
GEMINI_DOC_TASK = "retrieval_document"


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


def load_questions(path: str) -> list[dict[str, str]]:
    questions_path = Path(path)
    if not questions_path.is_file():
        questions_path = Path(__file__).parent / path
    questions: list[dict[str, str]] = json.loads(questions_path.read_text(encoding="utf-8"))
    if not questions:
        raise SystemExit("question set is empty")
    return questions


def _collapse(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower()


def count_tokens(texts: list[str]) -> int:
    """cl100k token estimate via tiktoken when available, else chars/4."""
    try:
        import tiktoken

        encoder = tiktoken.get_encoding("cl100k_base")
        return sum(len(encoder.encode(text)) for text in texts)
    except Exception:
        return sum(len(text) // 4 for text in texts)


class SlidingWindowLimiter:
    """Sliding-window per-minute token budget, mirroring the worker's limiter."""

    def __init__(self, max_per_minute: int) -> None:
        self._max = max_per_minute
        self._events: list[tuple[float, int]] = []

    def wait_for(self, tokens: int) -> None:
        if self._max <= 0 or tokens <= 0:
            return
        if tokens > self._max:
            return
        window = 60.0
        while True:
            now = time.monotonic()
            cutoff = now - window
            self._events = [(t, n) for t, n in self._events if t > cutoff]
            if sum(n for _, n in self._events) + tokens <= self._max:
                self._events.append((now, tokens))
                return
            oldest = min(t for t, _ in self._events) if self._events else now
            time.sleep(oldest + window - now + 0.05)


def _l2_normalize(vector: list[float]) -> list[float]:
    norm = sum(value * value for value in vector) ** 0.5
    if norm == 0.0:
        return [0.0] * len(vector)
    return [value / norm for value in vector]


def _parse_embedding(payload: dict) -> list[float]:
    try:
        values = payload["values"]
    except (KeyError, TypeError) as exc:
        raise SystemExit(f"embedding response missing values: {exc}")
    if not isinstance(values, list) or len(values) != EMBEDDING_DIMENSIONS:
        raise SystemExit(f"embedding has wrong dimensions: {len(values)}")
    try:
        parsed = [float(value) for value in values]
    except (TypeError, ValueError) as exc:
        raise SystemExit(f"embedding contains non-numeric values: {exc}")
    if not all(
        value == value and value != float("inf") and value != float("-inf")
        for value in parsed
    ):
        raise SystemExit("embedding contains non-finite values")
    return parsed


def gemini_embed(
    client: httpx.Client,
    api_key: str,
    texts: list[str],
    task_type: str,
    limiter: SlidingWindowLimiter,
) -> list[list[float]]:
    vectors: list[list[float]] = []
    batch: list[str] = []
    batch_tokens = 0
    for text in texts:
        tokens = count_tokens([text])
        if batch and batch_tokens + tokens > MAX_BATCH_TOKENS:
            vectors.extend(_gemini_call(client, api_key, batch, task_type, limiter))
            batch = []
            batch_tokens = 0
        batch.append(text)
        batch_tokens += tokens
    if batch:
        vectors.extend(_gemini_call(client, api_key, batch, task_type, limiter))
    return vectors


def _gemini_call(
    client: httpx.Client,
    api_key: str,
    texts: list[str],
    task_type: str,
    limiter: SlidingWindowLimiter,
) -> list[list[float]]:
    limiter.wait_for(count_tokens(texts))
    request = {
        "requests": [
            {
                "model": f"models/{GEMINI_MODEL}",
                "content": {"parts": [{"text": text}]},
                "taskType": task_type,
                "outputDimensionality": EMBEDDING_DIMENSIONS,
            }
            for text in texts
        ]
    }
    for attempt in range(6):
        response = client.post(
            GEMINI_URL,
            json=request,
            headers={"x-goog-api-key": api_key},
            timeout=120.0,
        )
        if response.status_code == 429:
            retry_after = response.headers.get("retry-after")
            delay = min(float(retry_after), 60.0) if retry_after else 2.0 ** attempt
            time.sleep(delay)
            continue
        if response.status_code >= 400:
            raise SystemExit(
                f"gemini failed: {response.status_code} {response.text[:300]}"
            )
        payload = response.json()
        embeddings = payload["embeddings"]
        if len(embeddings) != len(texts):
            raise SystemExit("gemini embedding count mismatch")
        return [_l2_normalize(_parse_embedding(item)) for item in embeddings]
    raise SystemExit("gemini rate-limited after retries")


class LocalEmbedder:
    """One sentence-transformers model with its prompt/prefix convention."""

    def __init__(
        self,
        model_id: str,
        query_prompt: str | None,
        doc_prompt: str | None,
        prefixes: tuple[str, str] | None = None,
        truncate_dim: int | None = None,
        onnx_path: str = "",
    ) -> None:
        self.model_id = model_id
        self.query_prompt = query_prompt
        self.doc_prompt = doc_prompt
        self.prefixes = prefixes
        self.truncate_dim = truncate_dim
        self.onnx_path = onnx_path
    def load(self) -> float:
        from sentence_transformers import SentenceTransformer

        started = time.perf_counter()
        if self.onnx_path:
            self._onnx = _load_onnx(self.onnx_path, self.model_id)
            self._load_s = time.perf_counter() - started
            return self._load_s
        kwargs: dict[str, Any] = {}
        if self.truncate_dim is not None:
            kwargs["truncate_dim"] = self.truncate_dim
        self._model = SentenceTransformer(self.model_id, trust_remote_code=True, **kwargs)
        # Resolve prompt names from the model's own config; the documented
        # names differ per family (gemma uses "retrieval.query", Qwen3 uses
        # "query"), and a wrong prompt_name raises at encode time.
        available = set(getattr(self._model, "prompts", {}) or {})
        if self.query_prompt is None:
            for candidate in ("retrieval.query", "search_query", "query"):
                if candidate in available:
                    self.query_prompt = candidate
                    break
        if self.doc_prompt is None:
            for candidate in ("retrieval.document", "search_document", "passage"):
                if candidate in available:
                    self.doc_prompt = candidate
                    break
        self._load_s = time.perf_counter() - started
        return self._load_s

    def embed(self, texts: list[str], is_query: bool) -> list[list[float]]:
        if self.onnx_path:
            return _onnx_embed(self._onnx, texts)
        if self.prefixes is not None:
            prefix = self.prefixes[1 if is_query else 0]
            texts = [f"{prefix}{text}" for text in texts]
        prompt = self.query_prompt if is_query else self.doc_prompt
        kwargs: dict[str, Any] = {"batch_size": LOCAL_BATCH_SIZE, "normalize_embeddings": True}
        if prompt:
            kwargs["prompt_name"] = prompt
        vectors = self._model.encode(texts, **kwargs)
        return [list(map(float, row)) for row in vectors]


def _load_onnx(path: str, model_id: str):
    from pathlib import Path

    from optimum.onnxruntime import ORTModelForFeatureExtraction
    from transformers import AutoTokenizer

    directory = Path(path)
    candidates = sorted(p.name for p in directory.glob("*.onnx"))
    if not candidates:
        raise SystemExit(f"no .onnx files in {path}")
    file_name = candidates[0] if len(candidates) == 1 else None
    kwargs = {"file_name": file_name} if file_name else {}
    model = ORTModelForFeatureExtraction.from_pretrained(
        path, provider="CPUExecutionProvider", **kwargs
    )
    # The ONNX export dir carries only the graph + config; the tokenizer
    # comes from the original sentence-transformers model repository.
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    return model, tokenizer


def _onnx_embed(model_tokenizer: tuple, texts: list[str]) -> list[list[float]]:
    """Embed with an ONNX Qwen3 model: last_hidden_state row 0, MRL to 768, L2."""
    import numpy as np

    model, tokenizer = model_tokenizer
    vectors: list[list[float]] = []
    for text in texts:
        enc = tokenizer(text, return_tensors="np", max_length=8192, truncation=True)
        inputs = dict(enc)
        inputs["position_ids"] = np.arange(
            enc["input_ids"].shape[1], dtype=np.int64
        )[None, :]
        hidden = np.asarray(model(**inputs).last_hidden_state)
        vector = hidden[0, 0].astype(np.float32)[:768]
        norm = np.linalg.norm(vector)
        vectors.append((vector / norm).tolist() if norm else [0.0] * 768)
    return vectors


def rank_corpus(corpus: list[list[float]], query: list[float], top_k: int) -> list[int]:
    """Return corpus indices ranked by cosine similarity (vectors are normalized)."""
    import numpy as np

    matrix = np.asarray(corpus, dtype=np.float32)
    q = np.asarray(query, dtype=np.float32)
    sims = matrix @ q
    order = np.argsort(-sims)[:top_k]
    return [int(index) for index in order]


def _tokenize(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if len(w) > 1]


def bm25_top_k(corpus_texts: list[str], query: str, top_k: int) -> list[int]:
    """Return corpus indices ranked by Okapi BM25 (k1=1.5, b=0.75)."""
    import math

    tokenized = [_tokenize(t) for t in corpus_texts]
    n_docs = len(tokenized)
    avg_len = sum(len(d) for d in tokenized) / max(n_docs, 1)
    k1, b = 1.5, 0.75
    doc_freq: dict[str, int] = {}
    for doc in tokenized:
        for token in set(doc):
            doc_freq[token] = doc_freq.get(token, 0) + 1
    query_tokens = _tokenize(query)
    scores: list[float] = []
    for doc in tokenized:
        length = len(doc)
        if length == 0:
            scores.append(0.0)
            continue
        tf = {token: doc.count(token) for token in set(query_tokens)}
        score = 0.0
        for token in query_tokens:
            if token not in doc_freq:
                continue
            idf = math.log(1 + (n_docs - doc_freq[token] + 0.5) / (doc_freq[token] + 0.5))
            t = tf.get(token, 0)
            score += idf * (t * (k1 + 1)) / (t + k1 * (1 - b + b * length / avg_len))
        scores.append(score)
    return sorted(range(n_docs), key=lambda i: -scores[i])[:top_k]


def hybrid_rank(
    corpus: list[list[float]],
    corpus_texts: list[str],
    query: list[float],
    query_text: str,
    top_k: int,
) -> list[int]:
    """Fuse dense cosine and BM25 rankings with tuned weighted RRF.

    Mirrors the production RPC (`match_content_chunks` 4-arg overload after
    migration 016): k = 60, dense weight 1.0, lexical weight 0.7, BM25 pool
    capped at 25. This config was swept against the 30-question probe and is
    strictly better than dense-only and equal-weight RRF.
    """
    dense_order = rank_corpus(corpus, query, top_k)
    lexical_order = bm25_top_k(corpus_texts, query_text, 25)
    rrf: dict[int, float] = {}
    for position, idx in enumerate(dense_order, start=1):
        rrf[idx] = rrf.get(idx, 0.0) + 1.0 / (60 + position)
    for position, idx in enumerate(lexical_order, start=1):
        rrf[idx] = rrf.get(idx, 0.0) + 0.7 / (60 + position)
    return sorted(rrf, key=lambda idx: -rrf[idx])


class CrossEncoderReranker:
    """Cross-encoder reranker over (query, chunk) pairs.

    Loads once per run; `rerank` scores up to `candidates` pairs and returns
    the candidate indices reordered by descending relevance.
    """

    def __init__(self, model_id: str = "Qwen/Qwen3-Reranker-0.6B") -> None:
        from sentence_transformers import CrossEncoder

        self._model = CrossEncoder(model_id, trust_remote_code=True)
        self.load_s: float = 0.0

    def load(self) -> float:
        started = time.perf_counter()
        self.load_s = time.perf_counter() - started
        return self.load_s

    def rerank(
        self,
        query_text: str,
        chunk_texts: list[str],
        candidate_indices: list[int],
    ) -> list[int]:
        pairs = [(query_text, chunk_texts[idx]) for idx in candidate_indices]
        scores = self._model.predict(pairs, batch_size=8)
        order = sorted(range(len(candidate_indices)), key=lambda i: -float(scores[i]))
        return [candidate_indices[i] for i in order]


def _load_vectors(cache_path: Path) -> list[list[float]] | None:
    if not cache_path.is_file():
        return None
    import numpy as np

    return np.load(cache_path).tolist()


def _save_vectors(cache_path: Path, vectors: list[list[float]]) -> None:
    import numpy as np

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    np.save(cache_path, np.asarray(vectors, dtype=np.float32))


def run_model(
    model_name: str,
    chunks: list[dict],
    questions: list[dict[str, str]],
    client: httpx.Client,
    gemini_key: str,
    hybrid: bool = False,
    rerank: bool = False,
    title_prefix: str = "",
    onnx_path: str = "",
    vector_cache: Path | None = None,
) -> dict[str, Any]:
    import numpy as np

    raw_texts = [chunk["text"] for chunk in chunks]
    corpus_texts = raw_texts
    if title_prefix:
        # The prefix is embed-time context only: production stores the raw
        # chunk text and its tsvector, so BM25 must score the raw text too.
        corpus_texts = [f"{title_prefix}\n\n{text}" for text in raw_texts]
    query_texts = [item["question"] for item in questions]
    result: dict[str, Any] = {"model": model_name, "note": ""}

    reranker = None
    if rerank:
        reranker = CrossEncoderReranker()
        reranker.load()

    if model_name == "gemini":
        started = time.perf_counter()
        limiter = SlidingWindowLimiter(MAX_TOKENS_PER_MINUTE)
        corpus = gemini_embed(client, gemini_key, corpus_texts, GEMINI_DOC_TASK, limiter)
        queries = gemini_embed(client, gemini_key, query_texts, GEMINI_QUERY_TASK, limiter)
        result["corpus_wall_s"] = time.perf_counter() - started
        result["load_s"] = 0.0
        result["backend"] = "gemini-embedding-001 (API)"
    else:
        specs = {
            "nomic": LocalEmbedder(
                "nomic-ai/nomic-embed-text-v1.5",
                None,
                None,
                prefixes=("search_document: ", "search_query: "),
            ),
            "gemma": LocalEmbedder(
                "google/embeddinggemma-300m",
                None,
                None,
            ),
            "qwen": LocalEmbedder(
                "Qwen/Qwen3-Embedding-0.6B",
                None,
                None,
                truncate_dim=EMBEDDING_DIMENSIONS,
                onnx_path=onnx_path,
            ),
        }
        embedder = specs[model_name]
        result["load_s"] = embedder.load()

        cached_corpus = None
        cached_queries = None
        if vector_cache is not None:
            corpus_cache = Path(f"{vector_cache}-corpus.npy")
            query_cache = Path(f"{vector_cache}-queries.npy")
            cached_corpus = _load_vectors(corpus_cache)
            cached_queries = _load_vectors(query_cache)

        # Throughput probe on a sample first; skip the full corpus when the
        # extrapolated wall-clock exceeds the budget.
        sample = corpus_texts[:SAMPLE_SIZE]
        sample_started = time.perf_counter()
        if cached_corpus is None:
            embedder.embed(sample, is_query=False)
        sample_s = time.perf_counter() - sample_started
        per_chunk = sample_s / len(sample)
        corpus_estimate = per_chunk * len(corpus_texts)
        if cached_corpus is None and corpus_estimate > MAX_MODEL_SECONDS:
            result["note"] = (
                f"CPU throughput {per_chunk:.3f} s/chunk would take "
                f"{corpus_estimate / 60:.0f} min for the full corpus (budget "
                f"{MAX_MODEL_SECONDS // 60} min) — full embed skipped."
            )
            result["corpus_wall_s"] = corpus_estimate
            result["embedded"] = False
            result["sample_s"] = sample_s
            return result

        if cached_corpus is not None and cached_queries is not None:
            corpus = cached_corpus
            queries = cached_queries
            result["corpus_wall_s"] = 0.0
            result["cached"] = True
        else:
            started = time.perf_counter()
            corpus = embedder.embed(corpus_texts, is_query=False)
            queries = embedder.embed(query_texts, is_query=True)
            result["corpus_wall_s"] = time.perf_counter() - started
            if vector_cache is not None:
                _save_vectors(Path(f"{vector_cache}-corpus.npy"), corpus)
                _save_vectors(Path(f"{vector_cache}-queries.npy"), queries)
        result["sample_s"] = sample_s
        result["embedded"] = True

    peak_rss = _peak_rss_mb()
    result["peak_rss_mb"] = peak_rss

    corpus = [_l2_normalize(v) for v in corpus]
    queries = [_l2_normalize(v) for v in queries]

    hits: list[dict[str, Any]] = []
    for q_index, item in enumerate(questions):
        # Multi-gold scoring: every chunk containing the answer snippet (or an
        # altSnippet for questions with multiple legitimately-answerable
        # passages) is a valid answer; the reported rank is the best rank
        # across all gold chunks.
        snippets = [item["answerSnippet"], *item.get("altSnippets", [])]
        gold_positions = [
            index
            for index, chunk in enumerate(chunks)
            if any(
                _collapse(snippet) in _collapse(chunk["text"] or "")
                for snippet in snippets
            )
        ]
        if not gold_positions:
            result.setdefault("skipped", []).append(q_index + 1)
            continue
        if hybrid:
            order = hybrid_rank(
                corpus,
                raw_texts,
                queries[q_index],
                item["question"],
                TOP_K,
            )
        else:
            order = rank_corpus(corpus, queries[q_index], TOP_K)
        if reranker is not None:
            order = reranker.rerank(item["question"], raw_texts, order[:RERANK_CANDIDATES])
        rank = next(
            (
                position + 1
                for position, idx in enumerate(order)
                if idx in gold_positions
            ),
            None,
        )
        sims = np.asarray(corpus, dtype=np.float32) @ np.asarray(queries[q_index], dtype=np.float32)
        hits.append(
            {
                "index": q_index + 1,
                "answer_ordinal": chunks[gold_positions[0]]["ordinal"],
                "rank": rank,
                "top_similarity": float(sims[order[0]]) if order else None,
            }
        )

    result["questions"] = len(questions)
    result["answered"] = len(hits)
    result["skipped"] = result.get("skipped", [])
    ranks = [h["rank"] for h in hits if h["rank"] is not None]
    if hits:
        def _in_top(k: int) -> int:
            return sum(1 for h in hits if h["rank"] is not None and h["rank"] <= k)

        result["recall1"] = _in_top(1) / len(hits)
        result["recall3"] = _in_top(3) / len(hits)
        result["recall5"] = _in_top(5) / len(hits)
    else:
        result["recall1"] = result["recall3"] = result["recall5"] = 0.0
    result["mrr"] = statistics.mean(1.0 / rank for rank in ranks) if ranks else 0.0
    top_sims = [h["top_similarity"] for h in hits if h["top_similarity"] is not None]
    result["mean_top_sim"] = statistics.mean(top_sims) if top_sims else 0.0
    result["hits"] = hits
    result["chunks"] = len(chunks)
    if result.get("embedded", True) and result["corpus_wall_s"] > 0:
        result["chunks_per_min"] = len(chunks) / (result["corpus_wall_s"] / 60.0)
    return result


def _peak_rss_mb() -> float:
    # ru_maxrss is POSIX-only; Windows runs report 0.
    try:
        import resource

        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0
    except (ImportError, AttributeError):
        return 0.0


def render_report(
    model_results: list[dict[str, Any]],
    chunks: list[dict],
    questions: list[dict[str, str]],
) -> str:
    lines: list[str] = []
    lines.append("# Embedding model bake-off")
    lines.append("")
    lines.append(
        f"- Corpus: `{len(chunks)}` chunks of material "
        f"`{os.getenv('BAKEOFF_MATERIAL_ID', '?')}` (572-page ACCA APM study text)"
    )
    lines.append(f"- Questions: `{len(questions)}` (verified answer snippets)")
    retrieval_mode = (
        'hybrid (BM25 + dense RRF)' if os.getenv('BAKEOFF_HYBRID') else 'dense-only'
    )
    lines.append(f"- Retrieval: `{retrieval_mode}`")
    lines.append(f"- Gemini pacing: `{MAX_TOKENS_PER_MINUTE}` tokens/min sliding window")
    lines.append("")
    header = (
        "| model | recall@1 | recall@3 | recall@5 | MRR | mean top sim | "
        "corpus (s) | chunks/min | load (s) | peak RSS (MB) |"
    )
    lines.append(header)
    lines.append("|---|---|---|---|---|---|---|---|---|---|")
    for result in model_results:
        note = f" ({result.get('note')})" if result.get("note") else ""
        lines.append(
            f"| {result['model']} | {result['recall1']:.2f} | {result['recall3']:.2f} | "
            f"{result['recall5']:.2f} | {result['mrr']:.3f} | {result['mean_top_sim']:.3f} | "
            f"{result['corpus_wall_s']:.1f} | "
            f"{result.get('chunks_per_min', 0.0):.1f} | {result['load_s']:.1f} | "
            f"{result.get('peak_rss_mb', 0.0):.1f}{note} |"
        )
    lines.append("")
    for result in model_results:
        lines.append(f"## {result['model']}")
        lines.append("")
        lines.append(f"- Backend: `{result.get('backend', 'local')}`")
        lines.append(f"- Questions answered: `{result['answered']}/{result['questions']}`")
        if result.get("skipped"):
            lines.append(f"- Skipped (snippet not found in corpus): Q{result['skipped']}")
        if result.get("note"):
            lines.append(f"- Note: {result['note']}")
        lines.append("")
        lines.append("| Q | answer chunk | rank |")
        lines.append("|---|---|---|")
        for hit in result.get("hits", []):
            rank = str(hit["rank"]) if hit["rank"] is not None else "miss"
            lines.append(f"| {hit['index']} | {hit['answer_ordinal']} | {rank} |")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Embedding model bake-off")
    parser.add_argument("--material", required=True, help="materials.id to probe")
    parser.add_argument(
        "--models",
        default="gemini,nomic,gemma,qwen",
        help="comma-separated: gemini,nomic,gemma,qwen",
    )
    parser.add_argument("--questions", default="probe_questions.json")
    parser.add_argument("--hybrid", action="store_true", help="fuse BM25 + dense with RRF")
    parser.add_argument(
        "--rerank", action="store_true", help="cross-encoder rerank of top candidates"
    )
    parser.add_argument(
        "--cache", default="", help="path prefix for embedding vector cache (.npy)"
    )
    parser.add_argument(
        "--title-prefix",
        default="",
        help="prepend this context header to each chunk before embedding",
    )
    parser.add_argument(
        "--onnx-path",
        default="",
        help="embed with an ONNX model directory instead of sentence-transformers",
    )
    parser.add_argument("--output", default="")
    args = parser.parse_args()

    load_env_file(Path(__file__).parents[1] / ".env")
    supabase_url = require_env("SUPABASE_URL").rstrip("/")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    gemini_key = require_env("GEMINI_API_KEY")
    os.environ["BAKEOFF_MATERIAL_ID"] = args.material

    questions = load_questions(args.questions)
    if args.hybrid:
        os.environ["BAKEOFF_HYBRID"] = "1"
    client = httpx.Client(timeout=120.0)
    chunks = fetch_chunks(client, supabase_url, service_key, args.material)
    print(f"corpus: {len(chunks)} chunks")
    if not chunks:
        raise SystemExit("material has no chunks")

    results: list[dict[str, Any]] = []
    for model_name in [name.strip() for name in args.models.split(",") if name.strip()]:
        print(f"== {model_name} ==", flush=True)
        started = time.perf_counter()
        results.append(
            run_model(
                model_name,
                chunks,
                questions,
                client,
                gemini_key,
                hybrid=args.hybrid,
                rerank=args.rerank,
                title_prefix=args.title_prefix,
                onnx_path=args.onnx_path,
                vector_cache=Path(args.cache) if args.cache else None,
            )
        )
        print(f"   done in {time.perf_counter() - started:.1f}s", flush=True)

    report = render_report(results, chunks, questions)
    if args.output:
        Path(args.output).write_text(report, encoding="utf-8")
        print(f"report written to {args.output}")
    else:
        print(report)


if __name__ == "__main__":
    main()
