# Logging and Tracing

Every code change that can fail, retry, or emit diagnostics must keep the logging contract intact.
The contract is: one `X-Request-ID` per logical call joins frontend, backend, and e2e evidence.
A change that adds a failure path without its log line breaks that join.

## Mandatory updates when changing code

- Never call `console.*` directly in `apps/app/src` outside `apps/app/src/lib/logger.ts`.
- Route every new frontend warning or error through `logger`.
- Never add a bare `logging.basicConfig` or `print` for service logs in `services/intelligence/`.
- Use the shared `configure_logging()` plus module loggers.
- Attach `request_id` (HTTP paths) or `trace_id` (worker paths) via `extra={...}` on every new backend log line.
- Send `X-Request-ID` on every new app-to-intelligence fetch.
- Mint one id per logical call and reuse it across retries.
- Surface the id on the thrown typed error.
- Route every new HTTP error return through `service_error` (it logs) or log with `request_id` explicitly.
- Never add a silent `except: pass` or a bare `except Exception` that only falls back to a default.
- Use the shared `e2e/fixtures.ts` error fixture in every new e2e spec instead of hand-rolled capture.
- Keep `LOG_LEVEL` additive and do not rename `INGESTION_LOG_LEVEL`.
- Update the logger tests in the same change when touching their contracts (`logger.test.ts`, `test_hardening.py`, `request-id-trace.spec.ts`).

## Join verification

- Copy the `X-Request-ID` from devtools, the network response, or the typed error's `requestId`.
- Run `./full-app logs intelligence --grep <request-id>` to see the full frontend-to-backend trail.
- See the Log Tracing section in [`10-runtime-and-e2e.agents.md`](10-runtime-and-e2e.agents.md).
