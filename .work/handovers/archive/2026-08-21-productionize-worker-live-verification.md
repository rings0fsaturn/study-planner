# Live Verification — 2026-08-21 productionize-worker + sidecar query-embedder
Date: 2026-08-21 06:15 UTC
Corpus: 80c8b138-b544-4095-8dc0-1c390ac70da2 ready/qwen-sidecar 754/754
Embedder: http://127.0.0.1:8200/health {"status":"ok","dimensions":768,"cuda_available":true,"device":"cuda:0","device_name":"AMD Radeon RX 9070 XT","loaded":true,"reranker_loaded":true}
Intelligence: http://127.0.0.1:8000/health {"status":"ok"}
Worker: embedding provider: sidecar (http://host.docker.internal:8200) healthy
Probe sidecar --hybrid: MRR 0.703 Recall@1 0.60/0.73/0.87 (gemini control 0.356)
Retrieval: hybrid true 200, hybrid false 200 (fixed PGRST203), rerank 200, 401/404 correct
Tests: 13 passed (query_embedder+probe+retrieval), 286 passed 5 pre-existing golden failures, ruff clean, db push up to date
Fixes: qwen-sidecar alias, intelligence env, overload handling, test update
