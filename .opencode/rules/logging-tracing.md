---
name: logging-tracing
description: Keep the X-Request-ID log join intact on every code change
---

# Logging and Tracing

Every code change that can fail, retry, or emit diagnostics must keep the logging contract intact: one `X-Request-ID` per logical call joins frontend, backend, and e2e evidence.

## Mandatory updates when changing code

- Never call `console.*` directly in `apps/app/src` outside `apps/app/src/lib/logger.ts`; route new warnings/errors through `logger`.
- Never add bare `logging.basicConfig` or `print` for service logs in `services/intelligence/`; use `configure_logging()` plus module loggers.
- Attach `request_id` (HTTP) or `trace_id` (workers) via `extra={...}` on every new backend log line.
- Send `X-Request-ID` on every new app-to-intelligence fetch; mint one id per logical call, reuse across retries, surface it on the typed error.
- Route new HTTP error returns through `service_error` (it logs) or log with `request_id` explicitly.
- Never add silent `except: pass` or bare `except Exception` that only falls back to a default.
- Use the shared `e2e/fixtures.ts` error fixture in new e2e specs, not hand-rolled capture.
- Update the logger tests in the same change (`logger.test.ts`, `test_hardening.py`, `request-id-trace.spec.ts`).

## Join verification

Copy the `X-Request-ID` from devtools or the error's `requestId`, then `./full-app logs intelligence --grep <request-id>`.
