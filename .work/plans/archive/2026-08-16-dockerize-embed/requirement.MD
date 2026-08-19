# Task: Containerize sentence-transformers embedding model with AMD ROCm GPU support (WSL2 + Docker Desktop)

## Context
- Host: WSL2 (Ubuntu-based distro), Docker Desktop with WSL2 backend/integration enabled.
- I currently have a working `.venv` with `torch` + `sentence-transformers` installed, using AMD ROCm as the GPU backend. GPU access is confirmed working there (`torch.cuda.is_available()` returns `True` and `rocminfo` succeeds).
- Goal: move the embedding model out of the venv and into a Docker container that still has GPU access, via Docker Desktop's WSL2 integration.
- WSL2 does NOT expose `/dev/kfd` (the standard native-Linux ROCm device). GPU passthrough must use `/dev/dxg` + `/dev/dri`, plus mounts of WSL's driver shim libraries (`libdxcore.so`) and the host's ROCm HSA runtime lib. Do not attempt `/dev/kfd`-only passthrough — it will silently fail or error on WSL2.

## Step 1 — Detect the actual environment (do this first, don't assume)
Run these and record the output before writing any Dockerfile:

```bash
# Torch + ROCm version actually installed in the venv
source .venv/bin/activate 2>/dev/null || true
python3 -c "import torch; print('torch:', torch.__version__); print('hip/rocm:', torch.version.hip)"

# Python version used in the venv
python3 --version

# ROCm install path(s) on host
ls -d /opt/rocm* 2>/dev/null

# GPU model as seen by ROCm
rocminfo 2>/dev/null | grep -i "Marketing Name" | head -5

# Confirm WSL driver shim paths exist (needed for container mounts)
ls /usr/lib/wsl/lib/libdxcore.so
ls /opt/rocm/lib/libhsa-runtime64.so.1 2>/dev/null || find /opt/rocm* -name "libhsa-runtime64.so.1" 2>/dev/null

# Confirm docker CLI is the Docker Desktop shim, not a separate engine
which docker
docker info | grep -i "Operating System"
```

## Step 2 — Pick the base image to match detected torch/ROCm version
- Use `rocm/pytorch:latest` as the default base UNLESS the detected `torch.version.hip` in Step 1 corresponds to an older ROCm release, in which case look up a matching tag at https://hub.docker.com/r/rocm/pytorch/tags and pin it explicitly (don't silently use `latest` if there's a version mismatch — flag the mismatch to me instead of guessing).
- If the detected GPU marketing name from `rocminfo` is a consumer/unofficial-support card (e.g. most Radeon RX cards not on AMD's official ROCm support matrix), plan to set `HSA_OVERRIDE_GFX_VERSION` as an env var in the container matching whatever value (if any) is currently set in the working `.venv` environment. Check with:
  ```bash
  echo $HSA_OVERRIDE_GFX_VERSION
  ```
  If unset but `.venv` works anyway, leave it unset in the container too. If set, carry the exact same value into the container.

## Step 3 — Write the Dockerfile
- Base: the image chosen in Step 2.
- `pip install sentence-transformers fastapi "uvicorn[standard]"` — do NOT reinstall torch, the base image already has the correct ROCm-linked build.
- Match the Python version to what was detected in Step 1 if it diverges meaningfully from the base image's Python (flag this rather than silently ignoring it).

## Step 4 — Write serve.py
A minimal FastAPI service:
- Loads a `SentenceTransformer` model once at startup (default model: `all-MiniLM-L6-v2`, but make it configurable via an `EMBEDDING_MODEL` env var).
- Device selection: `"cuda" if torch.cuda.is_available() else "cpu"` — but also print a clear warning to stdout at startup if it falls back to CPU, since silent CPU fallback is the main failure mode here.
- POST `/embed` endpoint accepting `{"texts": [...]}`, returning `{"embeddings": [...]}`.
- GET `/health` endpoint returning device info (`torch.cuda.is_available()`, `torch.cuda.get_device_name(0)` if available, torch version).

## Step 5 — Write docker-compose.yml
Must include, based on the WSL2 Docker Desktop GPU passthrough requirements:
```yaml
cap_add:
  - SYS_PTRACE
security_opt:
  - seccomp:unconfined
devices:
  - /dev/dxg
  - /dev/dri
group_add:
  - video
ipc: host
shm_size: "8g"
volumes:
  - /usr/lib/wsl:/usr/lib/wsl
  - /usr/lib/wsl/lib/libdxcore.so:/usr/lib/libdxcore.so
  - <ROCm HSA runtime path found in Step 1>:/opt/rocm/lib/libhsa-runtime64.so.1
ports:
  - "8000:8000"
```
Use the exact host path for `libhsa-runtime64.so.1` found in Step 1 — do not hardcode `/opt/rocm/lib/...` if the actual install lives under a versioned path like `/opt/rocm-6.4.4/lib/...`.

## Step 6 — Build, run, and verify
```bash
docker compose build
docker compose up -d
docker compose exec embedder python3 -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU FALLBACK')"
curl -s http://localhost:8000/health
curl -s -X POST http://localhost:8000/embed -H "Content-Type: application/json" -d '{"texts": ["hello world"]}'
```

## Step 7 — Report back
Summarize:
- Detected torch/ROCm/Python/GPU versions from Step 1.
- The base image and tag actually used, and why (exact match vs. nearest available).
- Whether `HSA_OVERRIDE_GFX_VERSION` was needed and what value.
- Confirmation that `torch.cuda.is_available()` returns `True` inside the container, with the reported device name.
- If GPU access failed inside the container, show the exact error output (don't paper over it with a CPU fallback silently working) and the specific mount/device that's likely missing.

## Constraints
- Don't reinstall torch inside the container — it must come from the base ROCm image.
- Don't use `/dev/kfd` — this WSL2 setup requires `/dev/dxg`.
- Don't hardcode paths without verifying they exist on this specific host first (Step 1 output is the source of truth, not assumptions from general ROCm docs).