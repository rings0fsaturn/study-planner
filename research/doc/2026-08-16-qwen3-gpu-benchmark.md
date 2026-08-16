# Qwen3 Embedding + Reranker — GPU Benchmark (AMD RX 9070 XT / ROCm)

- Date: 2026-08-16
- Branch: `phase2/issue-37` (retrieval quality program follow-up: move away from the Gemini embedding API)
- Hardware: AMD Radeon RX 9070 XT via ROCm (torch 2.12.0+rocm7.14.0, Python 3.14.4, transformers 5.15.0, sentence-transformers 5.7.0)
- Corpus: 788 chunks of the 572-page ACCA APM study text (material `80c8b138-b544-4095-8dc0-1c390ac70da2`)
- Eval: 30 verified multi-gold questions (same set as the CPU bake-off, 2026-08-15)
- Reference runs: `services/intelligence/scripts/embedding_bakeoff.py` (in-process, `--models qwen --hybrid --rerank`), reranker sidecar `services/reranker/` on port 8100

## Embedding quality — parity with the CPU run

| metric | CPU FP32 (2026-08-15) | GPU ROCm (2026-08-16) |
|---|---|---|
| recall@1 | 0.77 | 0.77 |
| recall@3 | 0.97 | 0.97 |
| recall@5 | 0.97 | 0.97 |
| MRR | 0.858 | 0.852 |
| mean top sim | — | 0.648 |

Quality parity: identical ranks on 29/30 questions. The single diff is Q26 (answer chunk ord 460), rank 1 → 2 on GPU — still a recall@3 hit, within normal numerics drift between backends.

## Embedding throughput

| | CPU FP32 | GPU ROCm | speedup |
|---|---|---|---|
| chunks/min | 81 | 4522 | ~56× |
| full corpus (788 chunks) | ~9.7 min | 10.5 s | ~55× |
| model load | — | 13.4 s | |
| peak RSS | — | 2373 MB | |

The full 572-page book embeds in ~10 s on GPU, zero quota, vs ~9.7 min CPU and ~9-10 min Gemini-paced (25 k tokens/min).

## Reranker latency (Qwen3-Reranker-0.6B, top-50 candidates)

Measured via `POST /rerank` on the sidecar (`services/reranker/app/main.py`, device now reported in `/health`):

| config | CPU batch 8 (2026-08-15) | GPU batch 8 | GPU batch 32 |
|---|---|---|---|
| per 50-pair request | ~41 s | 325 ms mean / 256 ms p95 | 246 ms mean |
| speedup vs CPU | — | ~126× | ~167× |

GPU batch 32 gives only ~1.3× over batch 8 — at 0.6B the request latency is fixed-overhead dominated, so batch 8 is fine and keeps memory low.

## Notes

- `nvidia-smi` is absent on this host: the device presents as `cuda:0` via ROCm (`torch.cuda.is_available()` True). HF models are cached under `/mnt/d/hf-cache` (`HF_HOME`), and `HF_TOKEN` comes from the gitignored `.env.git.local` (`whoami: soulinpain`).
- The live RPC probe (`retrieval_probe.py`) could not be re-run: the dev DB's embeddings for this material were wiped since 2026-08-15 (`embedding=not.is.null` returns only 11 rows across all materials). Re-running it requires re-ingesting the material (Gemini embed, or the future Qwen worker path).

## Reproduction

```bash
export HF_TOKEN=$(grep '^HF_TOKEN=' .env.git.local | cut -d= -f2- | tr -d '\r')
export HF_HOME=/mnt/d/hf-cache

# Embedding bake-off (GPU)
./.venv/bin/python services/intelligence/scripts/embedding_bakeoff.py \
  --material 80c8b138-b544-4095-8dc0-1c390ac70da2 \
  --models qwen --hybrid --rerank \
  --cache services/intelligence/.dev/bakeoff/qwen-gpu-vectors \
  --output /tmp/opencode/qwen-gpu-bakeoff.md

# Reranker sidecar (GPU)
cd services/reranker
setsid nohup ../.venv/bin/python -m uvicorn app.main:app \
  --host 127.0.0.1 --port 8100 --log-level info > /tmp/opencode/reranker-gpu.log 2>&1 </dev/null &
curl -s http://127.0.0.1:8100/health   # {"device":"cuda:0"}
```

## Follow-ups

- Worker wiring of the local Qwen embedder (the reason for this bench): GPU numbers make it clearly viable — 10 s per book vs 9-10 min Gemini-paced, quality parity, no quota.
- Re-embed the dev corpus (or re-ingest the material) to restore live-RPC probe capability.
- Rerank production wiring into the retrieval endpoint (client exists; no caller yet).
