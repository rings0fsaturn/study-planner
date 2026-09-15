# Plan – logging-tracing: production logging + e2e trace join

_Status: planned 2026-09-15 · Branch: none yet (cut off main at build time) · STATUS row: not yet added_

## Problem

Three gaps, each verified against live code:

1. **Backend logs are unparseable as JSON except one line.** Only the middleware's per-request line is JSON (`middleware.py:39-50`); every worker/telemetry line is `logger.info("telemetry %s", ...)` free text. No shared formatter, no `LOG_LEVEL` for the API (only `INGESTION_LOG_LEVEL` for the worker, `worker_main.py:163`), routers never log, HTTP errors are returned not logged (`serialization.py:19-28`, `main.py:40-54`), `retrieval.py:113-114` and `:39,46` swallow without logging.
2. **Frontend has no logger; console.warn is load-bearing in tests.** 15 prod `console.*` calls, no abstraction, no prod stripping. Four `intelligenceClient.test.ts` assertions pin `console.warn` call counts — any logger swap must update those first.
3. **E2E traces almost never exist and carry no app/backend join key.** `trace: 'on-first-retry'` + `retries: 0` locally = no trace files. No shared `watchErrors`, no `testInfo.attach`, scattered manual screenshots. The backend request-id line and the frontend's per-call UUIDs never meet (`assessmentClient.ts:190-191` mints fresh UUIDs per call, GETs send nothing).

## Non-goals (ponytail cuts)

- No OTel/Sentry/Pino/vendor SDKs. Stdlib `logging` + `crypto.randomUUID` + `X-Request-ID` already in the tree cover the requirement; add a vendor when a measured need arrives.
- No log files on disk from the service (stdout only; orchestrator/compose own capture). No log rotation config in compose (defaults + `docker compose logs` suffice for one account).
- No per-route frontend boundaries, no Plausible wiring (separate tasks), no marketing logging (static Astro, zero console calls).
- No new `correlationId` propagation beyond what exists: the domain `correlationId` job field stays as-is; the join key is `X-Request-ID`, which already has backend support.

## Design (4 phases, each shippable alone)

### P1 — Backend: one JSON formatter + LOG_LEVEL + error logging (no new deps)

- New `app/logging_config.py` (~40 lines): `configure_logging()` installing a single stdlib `logging.Formatter` emitting one JSON object per line (`ts`, `level`, `logger`, `msg`, plus `request_id`/`code`/`status`/`latency_ms` when passed via `extra={...}`), level from `LOG_LEVEL` env (default INFO), idempotent (guard `handler already installed`). Call it from `app/main.py` (import time) and `worker_main.main()` (replace the bare `basicConfig`).
- `middleware.py`: keep the per-request JSON line, but emit through the shared formatter (drop the hand-rolled `json.dumps`, pass fields via `extra`). No contract change (headers + `request_id_from_request` untouched).
- `serialization.service_error` + `main.unhandled_exception_handler`: add `logger.warning/exception` with `extra={"request_id": ..., "code": ...}` before returning. This is the highest-value single change: today every 4xx/5xx is silent in logs.
- `routers/retrieval.py`: log-and-raise in the two swallow sites (`:39,46` top_k parse → debug; `:113-114` rerank failure already raises, add `logger.warning` with request id). Smallest diff that closes silent failure.
- Worker/telemetry lines: pass `correlation_id`/`trace_id` via `extra` where the value is already in scope (ingestion worker `_fail_attempt`, telemetry emit); do NOT thread new params through functions that lack them.
- Tests: extend `tests/test_hardening.py` (JSON-parse the caplog line, assert `request_id` join key; assert `service_error` logs). No new test file.
- Env: `LOG_LEVEL` added to compose `intelligence` environment + `.env.example` (default INFO). `INGESTION_LOG_LEVEL` stays (worker alias, documented as deprecated-in-place, not removed — removing breaks the running worker config).

### P2 — Frontend: one `lib/logger.ts` (~30 lines) + X-Request-ID on every intelligence call

- New `apps/app/src/lib/logger.ts`: `debug/info/warn/error` gating on `import.meta.env.DEV` for debug/info, always-on warn/error, each prepending nothing (call sites keep their `[tag]` prefixes), plus `setRequestId`/context later only if needed. Implementation: thin wrappers over `console.*` (no dep). Update the 15 call sites mechanically (`console.warn(` → `logger.warn(`).
- Update `intelligenceClient.test.ts` 4 assertions to spy on the logger module (or `console.warn` still, since the wrapper delegates — prefer spying the wrapper to decouple). Rule 22 normalization untouched.
- `HttpAssessmentFetch.fetchJson` + `intelligenceClient` POSTs: generate ONE `requestId = crypto.randomUUID()` per logical call (not per retry attempt — generate outside the retry loop), send as `X-Request-ID`, attach it to the thrown typed error (`AssessmentServiceError.requestId` field already exists in `ServiceErrorShape`; extend the error classes with an optional `requestId`). Retry attempts reuse the same id so backend lines for attempt 1..3 share one key. GETs (`getAssessment`, `getJob`) send the header too (one line each).
- `ErrorBoundary.componentDidCatch`: `logger.error` (keeps console behavior, gains gating later). No reporting service.

### P3 — E2E: shared fixture + trace-on + request-id join assertion

- New `e2e/fixtures.ts`: `test.extend` with `watchErrors` (the `material-ingestion-live.spec.ts:51-58` pattern, promoted verbatim) auto-attached via `testInfo.attach('console-errors', ...)` on failure, plus `testInfo.attach` of the backend `intelligence.log` tail for the failing test's request ids. Keep `webServer` top-level (rule 10); this file adds no config.
- `playwright.config.ts`: `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, add `reporter: [['list'], ['html', { open: 'never' }]]` (html output is gitignored already via `test-results/`? verify, else add). `video: off` stays (cost without need).
- One live spec proves the join: extend the smallest live spec (or `smoke.spec.ts` if it hits the service) to read `X-Request-ID` from a response header and assert the same id appears in `.dev/full-app/logs/intelligence.log`. That test IS the e2e log-tracing proof.
- Migrate existing specs to the shared fixture opportunistically (one spec per commit, starting with the live ones); do not bulk-rewrite.

### P4 — Runtime/inferencing: make logs queryable with zero infra

- `full-app`: add `./full-app logs <service> [--follow] [--grep <pattern>]` subcommand (tails `.dev/full-app/logs/<service>.log`, grep filter). ~20 lines in `scripts/full_app.py`. This is the "easier inferencing" operator surface: `full-app logs intelligence --grep <request-id>` joins a browser-visible id to backend lines.
- Document the join in one place: `e2e/README.md` or rule 10 appendix — "copy `X-Request-ID` from devtools/network or the error shape's `requestId`, grep the intelligence log". One paragraph, not a runbook.
- Compose: no change (defaults stand). CI: none exists; when CI arrives, `playwright-report/` + `test-results/` become the artifact upload — note it, don't build it.

## Verification per phase

- P1: `uv run pytest tests/test_hardening.py` + full service suite; `curl` the service and `jq` one log line; assert 4xx produces a log line with `request_id`.
- P2: `pnpm --filter app test` (updated logger assertions), typecheck, lint; browser sign-in smoke at both viewports.
- P3: smallest Playwright test first (rule 10), then the request-id join spec; `trace.zip` + html report open on a forced failure.
- P4: `./full-app logs intelligence --grep` against a live run.

## Acceptance

- AC1: every backend log line is JSON-parseable with `ts/level/logger/msg`, and every HTTP 4xx/5xx leaves a line carrying its `request_id`.
- AC2: no direct `console.*` in `apps/app/src` outside `lib/logger.ts`; P2 tests green.
- AC3: one `X-Request-ID` minted per frontend logical call, sent on every intelligence fetch, echoed by the backend, and present on the typed error.
- AC4: a failing e2e test yields trace + screenshot + console-error attachment without manual code in the spec.
- AC5: `./full-app logs <service> --grep <request-id>` shows the full frontend→backend trail for one user action.

## Files affected (expected)

- P1: `services/intelligence/app/logging_config.py` (new), `app/main.py`, `app/middleware.py`, `app/routers/serialization.py`, `app/routers/retrieval.py`, `app/worker_main.py`, `app/ingestion/worker.py` (extra= only), `tests/test_hardening.py`, `docker-compose.yml` (LOG_LEVEL), `services/intelligence/.env.example`.
- P2: `apps/app/src/lib/logger.ts` (new), 8 files with console calls, `intelligenceClient.test.ts`, `assessments/assessmentClient.ts`, `assessments/types.ts` (requestId on errors), `lib/intelligenceClient.ts`, `components/ErrorBoundary.tsx`.
- P3: `e2e/fixtures.ts` (new), `e2e/playwright.config.ts`, one join spec.
- P4: `scripts/full_app.py`, one doc paragraph.
