# Logging/tracing — backend findings (2026-09-15)

Source: Explore subagent sweep of `services/intelligence/`.

- Lib: stdlib `logging` only. No structlog/loguru/OTel/Sentry (pyproject deps: fastapi, uvicorn, pyjwt, httpx, pypdf, tiktoken, trafilatura, youtube-transcript-api, openai; dev: pytest, httpx, ruff, jsonschema, pyyaml).
- Config: effectively none for the API. Only `basicConfig` is worker-only (`app/worker_main.py:163`, `INGESTION_LOG_LEVEL`, default INFO). FastAPI (`app/main.py`) inherits uvicorn defaults. No dictConfig, no formatters, no LOG_LEVEL wiring, no `--log-config`.
- Loggers: bare `logging.getLogger("<dotted>")` (middleware, ingestion/generation/grading workers, telemetry, extractors, embeddings). One dead logger (`generation.openrouter`, zero emits). Routers never log; `query_embedder.py`, `security.py`, `dependencies.py` have no logger.
- Request ID: `app/middleware.py:15-54` — reads `X-Request-ID` or UUID, sets `request.state.request_id`, logs one JSON line per request (request_id, method, path, status, latency_ms), returns `X-Request-ID` + `X-Model-Version` headers. Wired in `main.py:37`.
- Domain correlation: job-scoped `correlationId` payload field / `correlation_id` DB column / telemetry `traceId` (assessments router, ingestion models/worker/telemetry). Not W3C traceparent, no propagation.
- Errors: workers `logger.exception` + backoff (worker_main, generation, grading); best-effort paths `logger.warning(exc_info=True)`. HTTP errors returned not logged (`routers/serialization.py:19-28`, global handler `main.py:40-54`, `except IngestionError → service_error` everywhere). `retrieval.py:39,46` bare `except` swallows without logging.
- Destination: stdout/stderr only. Dockerfile sets `PYTHONUNBUFFERED=1`, no log driver/volume/file handler. Local dev inherits stdio into `.dev/full-app/logs/` (app.log, intelligence.log via state.json; ingestion-worker.log via run-detached script).
- Telemetry: `LoggingTelemetrySink` one JSON line/record; prod path `SupabaseTelemetrySink` → `generation_telemetry` table, best-effort.
- OTel/Sentry: absent (no SDK, exporter, DSN, middleware).
