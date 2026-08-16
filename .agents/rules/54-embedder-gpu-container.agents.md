---
name: embedder-gpu-container
description: Run, build, configure, and troubleshoot the standalone ROCm GPU sentence-transformers embedder container on WSL2.
---

# Embedder GPU Container

The embedder (`services/embedder/`) is a standalone compose project, separate from
the product stack and `./docker-app`.
Run it from the repository root with `-f services/embedder/docker-compose.yml`.
Never add it to the root compose file: it carries ROCm host mounts and device
passthrough that no other service needs.

Default host port is 8200 (`EMBEDDER_PORT`); the container listens on 8000.
Default model is `Qwen/Qwen3-Embedding-0.6B` (`EMBEDDING_MODEL` env var).
Endpoints: `GET /health` (device info) and `POST /embed` with
`{"texts": [...], "is_query": bool}`.

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

## Start

```bash
export HF_TOKEN=$(grep '^HF_TOKEN=' .env.git.local | cut -d= -f2- | tr -d '\r')
docker compose -f services/embedder/docker-compose.yml up -d
```

Export `HF_TOKEN` from the gitignored `.env.git.local` before `docker compose up`
so model downloads are authenticated; never copy the token into the compose file
or the image.
First startup downloads the model weights (about 1.2 GB) into the container layer,
so expect a slow first `/health`; the compose `start_period` is intentional.

## Configure

Override model, port, or base image with environment variables:

```bash
export EMBEDDING_MODEL=Qwen/Qwen3-Embedding-0.6B
export EMBEDDER_PORT=8200
export EMBEDDING_DIMENSIONS=768
export EMBEDDING_BATCH_SIZE=64
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
Stop with `docker compose -f services/embedder/docker-compose.yml down`; the
`restart: unless-stopped` policy keeps it alive across Docker Desktop restarts.

## GPU requirements

GPU access requires the WSL2 DXG passthrough: `/dev/dxg` device, `/usr/lib/wsl`
and `/usr/lib/wsl/lib/libdxcore.so` mounts, the read-only `/opt/rocm/lib` mount,
and `LD_LIBRARY_PATH=/opt/rocm/lib`.
This host has no `/dev/dri` and no `/dev/kfd`; do not add them.

Mount `/opt/rocm/lib` as a whole directory because the loader resolves the
unversioned `librocdxg.so` symlink.
A single-file `libhsa-runtime64.so.1` mount silently breaks GPU init and falls
back to CPU.

## Verify and troubleshoot

After any recreate, confirm the GPU with `GET /health`: expect
`cuda_available: true`, `device: cuda:0`, `device_name: AMD Radeon RX 9070 XT`,
and `dimensions: 768`.
Round-trip one embed (`POST /embed` with a couple of texts) and check every
returned vector has exactly `dimensions` entries.

A CPU fallback means the DXG mounts are wrong; check container logs
(`docker compose -f services/embedder/docker-compose.yml logs`) for
`librocdxg` or `hsaKmtOpenKFD` errors before touching code.
Check the live host paths under `/opt/rocm` and `/usr/lib/wsl/lib` before
changing any mount; they are the source of truth, not the general ROCm docs.
