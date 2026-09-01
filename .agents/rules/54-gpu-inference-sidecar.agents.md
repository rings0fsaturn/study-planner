---
name: gpu-inference-sidecar
description: Run, build, configure, and troubleshoot the standalone ROCm GPU inference sidecar on WSL2, which serves both Qwen3 embeddings and Qwen3 reranking from one container.
---

# GPU Inference Sidecar

The GPU inference sidecar (`services/embedder/`) is a standalone compose
project, separate from the product stack and `./docker-app`.
It serves the embedding contract (formerly the embedder container) and the
reranking contract (formerly the separate `services/reranker/` sidecar) from
one ROCm container.
Run it from the repository root with `-f services/embedder/docker-compose.yml`.
Never add it to the root compose file: it carries ROCm host mounts and device
passthrough that no other service needs.

Default host port is 8200 (`EMBEDDER_PORT`); the container listens on 8000.
Default models: `Qwen/Qwen3-Embedding-0.6B` (`EMBEDDING_MODEL` env var) and
`Qwen/Qwen3-Reranker-0.6B` (`RERANKER_MODEL` env var).
Endpoints: `GET /health` (device info plus both models), `POST /embed` with
`{"texts": [...], "is_query": bool}`, and `POST /rerank` with
`{"query": "...", "passages": [...]}` returning `indices`, `scores`, and
`latency_ms`.

## Embedding contract (matches the frozen research baseline)

The sidecar reproduces the 2026-08-15 retrieval-quality baseline exactly:
fp32, Matryoshka truncation to `EMBEDDING_DIMENSIONS` (default 768, matching
the `halfvec(768)` schema), L2 normalization after truncation
(`normalize_embeddings`), and the model's own prompt config (`is_query: true`
uses the `query` prompt; Qwen3 exposes no passage prompt, so passages embed
without one). Verified parity: recall@1 0.70 / r@3 0.83 / r@5 0.90 /
MRR 0.790 on the 788-chunk ACCA corpus, at ~4,300 chunks/min on the RX 9070 XT
(CPU baseline: 80 chunks/min).
Do not add title prefixes or int8/ONNX quantization; both were rejected by the
research program.
The ingestion worker consumes this container as the `sidecar` embedding
provider (`EMBEDDING_PROVIDER=sidecar`, `EMBEDDER_URL` default
`http://localhost:8200`); see `services/intelligence/app/ingestion/
embeddings_sidecar.py` and `scripts/embedding_bakeoff.py --models sidecar`.

## Rerank contract

The `/rerank` endpoint scores (query, passage) pairs with the Qwen3 cross-
encoder and returns the passage indices reordered by descending relevance.
Request caps: at most 100 passages (`MAX_PAIRS`) and 8192 chars per passage
(`MAX_PASSAGE_CHARS`), enforced at the pydantic layer.
GPU latency measured on the RX 9070 XT: ~325 ms per 50-pair request at batch 8
(~126x over CPU), so the typed client's 30 s timeout is ample.
The typed client lives in `services/intelligence/app/rerank.py`, normalizes
errors per rule 22, and defaults `RERANKER_URL` to `http://localhost:8200`.
The root compose stack has no reranker service anymore; a containerized caller
must point `RERANKER_URL` at the GPU host (for example
`http://host.docker.internal:8200`).
Rerank is wired into the retrieval endpoint `POST /v1/retrieval/search` as an
opt-in flag.
Send `"rerank": true` (plus optional `"rerankTopK"`) to reorder the matched
chunks through `RerankerClient`; reranking stays off by default.
The endpoint lives in `services/intelligence/app/routers/retrieval.py` and
calls the typed client from `app/rerank.py`.
Tests and operator scripts use the client directly against the sidecar.

## Start

```bash
export HF_TOKEN=$(grep '^HF_TOKEN=' .env.git.local | cut -d= -f2- | tr -d '\r')
docker compose -f services/embedder/docker-compose.yml up -d
```

Export `HF_TOKEN` from the gitignored `.env.git.local` before `docker compose up`
so model downloads are authenticated; never copy the token into the compose file
or the image.
First startup downloads both model weight sets (about 1.2 GB each) into the
container layer, so expect a slow first `/health`; the compose `start_period`
is intentional.

## Configure

Override model, port, or base image with environment variables:

```bash
export EMBEDDING_MODEL=Qwen/Qwen3-Embedding-0.6B
export EMBEDDER_PORT=8200
export EMBEDDING_DIMENSIONS=768
export EMBEDDING_BATCH_SIZE=64
export RERANKER_MODEL=Qwen/Qwen3-Reranker-0.6B
export RERANKER_BATCH_SIZE=8
export ROCM_IMAGE=rocm/pytorch:rocm7.14_ubuntu24.04_py3.12_pytorch_release_2.12.0
```

The base image is pinned to `rocm/pytorch:rocm7.14_ubuntu24.04_py3.12_pytorch_release_2.12.0`
to match the host venv's torch 2.12.0+rocm7.14.0.
Do not reinstall torch inside the container; the image must keep its ROCm-linked build.
Upgrading means repinning this tag after checking Docker Hub for the matching
ROCm release.

## Maintain

Rebuild and recreate after editing service code or compose files:

```bash
docker compose -f services/embedder/docker-compose.yml build
docker compose -f services/embedder/docker-compose.yml up -d
```

Docker Desktop data lives on `D:\docker\DockerDesktopWSL`; the ROCm image plus
build cache measured about 74 GB on this host (2026-08), so check D: free space
before rebuilding.
Stop the service with `docker compose -f services/embedder/docker-compose.yml
stop` and use `down` only when you also want to remove the container (see
"Start only when needed").

## GPU requirements

GPU access requires the WSL2 DXG passthrough: `/dev/dxg` device, `/usr/lib/wsl`
and `/usr/lib/wsl/lib/libdxcore.so` mounts, the read-only `/opt/rocm/lib` mount,
and `LD_LIBRARY_PATH=/opt/rocm/lib`.
This host has no `/dev/dri` and no `/dev/kfd`; do not add them.

Mount `/opt/rocm/lib` as a whole directory because the loader resolves the
unversioned `librocdxg.so` symlink.
A single-file `libhsa-runtime64.so.1` mount silently breaks GPU init and falls
back to CPU.

## Idle CPU on WSL2 (known upstream bug)

The container burns about two full CPU cores (~200%) for the whole lifetime of
the GPU context, even with zero `/embed` or `/rerank` traffic, under WSL2 DXG.
This is upstream ROCm bug `ROCm/librocdxg#60`, not an app fault.
WSL2 DXG cannot deliver GPU interrupts, so ROCr's `AsyncEventsLoop` threads
(`rocr::core::Runtime::AsyncEventsLoop` in `libhsa-runtime64.so.1`) fall into a
no-sleep polling loop.
OpenMP env vars such as `OMP_WAIT_POLICY=PASSIVE` and `OMP_NUM_THREADS` do not
stop it; they only bound the intra-op pool.
The upstream fix (`ROCm/rocm-systems#7898`, escalating backoff in the polling
loop, measured 182% down to 1%) is not merged into any released ROCm yet.
Contain it with the compose `deploy.resources.limits.cpus` cap already present
in `services/embedder/docker-compose.yml` (currently 4 cores: the two spin
threads plus headroom for real tokenization work).
Verify the cap with `docker inspect <id> --format '{{.HostConfig.NanoCpus}}'`.
Inference stays GPU-bound, so the cap does not change throughput.
Do not chase env-var workarounds for the spin; the defect is in the bundled
runtime.

## Start only when needed

Because the container burns about two CPU cores whenever it runs, treat it as a
demand-started service and never leave it running idle.
Start it immediately before embedding work (sidecar bake-off, live sidecar
re-embed, or ingestion runs with `EMBEDDING_PROVIDER=sidecar`) or rerank work,
and stop it as soon as the work completes.
Stop with `docker compose -f services/embedder/docker-compose.yml stop`; the
`restart: unless-stopped` policy then leaves the stopped container alone, and
`up -d` later restarts it quickly because the models stay cached in the image.
Use `down` only when you also want to remove the container.
Check `docker ps --filter name=embedder-embedder-1` before starting work and
confirm the sidecar is running, because a stopped sidecar produces
connect-refused errors.

## Verify and troubleshoot

After any recreate, confirm the GPU with `GET /health`: expect
`cuda_available: true`, `device: cuda:0`, `device_name: AMD Radeon RX 9070 XT`,
`dimensions: 768`, and both `loaded` and `reranker_loaded` true.
Round-trip one embed (`POST /embed` with a couple of texts) and check every
returned vector has exactly `dimensions` entries.
Round-trip one rerank (`POST /rerank` with a query and a few passages) and
check the returned `indices` reorder the passages by relevance.

A CPU fallback means the DXG mounts are wrong; check container logs
(`docker compose -f services/embedder/docker-compose.yml logs`) for
`librocdxg` or `hsaKmtOpenKFD` errors before touching code.
Check the live host paths under `/opt/rocm` and `/usr/lib/wsl/lib` before
changing any mount; they are the source of truth, not the general ROCm docs.