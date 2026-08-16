---
name: reranker-sidecar
description: Run, build, configure, and troubleshoot the Qwen3 cross-encoder reranker sidecar on port 8100.
---

# Reranker Sidecar

The reranker (`services/reranker/`) is the retrieval-quality program's
cross-encoder sidecar: it scores `(query, passage)` pairs and returns the
passages reordered by descending relevance.
It is part of the root Docker Compose stack (`reranker` service in
`docker-compose.yml`), unlike the GPU embedder which is a standalone compose
project (rule 54).

## Contract

Default model is `Qwen/Qwen3-Reranker-0.6B` (`RERANKER_MODEL` env var), with
batch size `RERANKER_BATCH_SIZE` (default 8).
Endpoints: `GET /health` (status, model, device, loaded) and `POST /rerank`
with `{"query": "...", "passages": [...]}` returning `indices`, `scores`,
and `latency_ms`.
The sidecar caps `MAX_PAIRS` at 100 and `MAX_PASSAGE_CHARS` at 8192.
Torch picks the device automatically; the containerized service runs on CPU
because the root compose file carries no GPU passthrough.

## Run

Containerized via the root stack:

```bash
./docker-app start
curl -s http://127.0.0.1:8100/health
```

Local dev run from `services/reranker/` with the repo-root venv:

```bash
../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8100
```

The Intelligence service consumes the sidecar through the typed
`RerankerClient` in `services/intelligence/app/rerank.py`, which normalizes
errors per rule 22 and defaults `RERANKER_URL` to `http://reranker:8100`.
The ingestion worker never calls the reranker in the hot path; retrieval
probes and the bake-off script invoke it explicitly.

## Rebuild

Rebuild and recreate the service after editing sidecar code:

```bash
./docker-app restart
```

## Troubleshoot

Check `/health` before touching code: `loaded` must be `true` and the model
name must match what the client expects.
A slow first `/health` means the model weights are still downloading into the
image layer; the compose `start_period` is intentional.
Verify a `/rerank` round trip with a couple of passages and confirm the
returned `indices` reorder the passages by descending score.
