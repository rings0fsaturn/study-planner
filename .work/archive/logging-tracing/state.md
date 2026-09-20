# State – logging-tracing

_Spec: none (infra task, plan is contract) · Plan: `active/logging-tracing/plan/PLAN.md` · STATUS row: logging-tracing · Status: done · Updated: 2026-09-20_

## Current state & next

- P1–P4 all implemented and verified; committed as `703a97b` (39 files) on `project/phase-2`.
- Next: none — wrapping (archive + STATUS flip) is the only remaining step.

## Done so far

- 2026-09-15 P1: `app/logging_config.py` (shared JSON formatter, LOG_LEVEL, idempotent); wired into `main.py` + `worker_main.py`; middleware emits via `extra`; `service_error` + unhandled handler log with request_id; `retrieval.py` swallow sites log; `test_hardening.py` +2 tests (7 passed); affected suites 119 passed; full suite 554 passed modulo 5 pre-existing v1-golden + 2 pre-existing probe failures (verified on clean tree).
- 2026-09-15 P2: `lib/logger.ts` + test; 15 console calls swapped (zero remain outside logger); `X-Request-ID` per logical call on assessment fetch + calibration/regenerate; `requestId` on `AssessmentServiceError`; assessments+lib 39 passed, lib 19 passed; typecheck + lint clean; full app suite 865/867 (2 = known WSL TZ pair).
- 2026-09-15 P3: `e2e/fixtures.ts` (watchErrors + console-error attach + `grepIntelligenceLog`); `request-id-trace.spec.ts` green (echo + log join asserted); config `trace: retain-on-failure` + html reporter + `playwright-report/` gitignored; forced-failure run produced `trace.zip` + `error-context.md`; smoke.spec one failure verified pre-existing on clean tree.
- 2026-09-15 P4: `./full-app logs <service> [--grep] [--tail] [--follow]` (~30 lines); verified join by request id against live runtime; rule 10 gained a Log Tracing paragraph.

## Flow trace

1. Browser mints one `X-Request-ID` per logical call (`HttpAssessmentFetch.fetchJson`, `postCalibration`, `postRoadmapRegenerate`), reuses it across retries, carries it on the typed error.
2. Backend `request_context_middleware` echoes/mints the id, logs one JSON request line; `service_error` + unhandled handler log every error with it; workers attach `trace_id`/`correlation_id` where in scope.
3. All service lines are JSON (`ts/level/logger/msg` + extras) via `configure_logging()` (API at import, worker in `main()`), level from `LOG_LEVEL` (compose + `.env.example` default INFO; `INGESTION_LOG_LEVEL` kept as worker alias).
4. E2E: `fixtures.ts` auto-attaches console errors; failing tests leave `trace.zip`; `request-id-trace.spec.ts` proves the echo→log join; `./full-app logs intelligence --grep <id>` is the operator join.

## Files affected

- P1: `services/intelligence/app/logging_config.py` (new), `app/main.py`, `app/middleware.py`, `app/routers/serialization.py`, `app/routers/retrieval.py`, `app/worker_main.py`, `app/ingestion/worker.py`, `tests/test_hardening.py`, `docker-compose.yml`, `services/intelligence/.env.example`.
- P2: `apps/app/src/lib/logger.ts` + `logger.test.ts` (new), `assessments/assessmentClient.ts`, `assessments/types.ts`, `lib/intelligenceClient.ts`, `auth/AuthProvider.tsx`, `components/ErrorBoundary.tsx`, `dev/DevSeeder.tsx`, `dev/seedTestData.ts`, `onboarding/dev-metadata-fetcher.ts`, `pages/assessments/AssessmentConfig.tsx`, `pages/materials/PracticeThis.tsx`, `pages/practice/PracticeRun.tsx`, `sync/SyncEngine.ts`.
- P3: `e2e/fixtures.ts`, `e2e/request-id-trace.spec.ts` (new), `e2e/playwright.config.ts`, `.gitignore`.
- P4: `scripts/full_app.py`, `.agents/rules/10-runtime-and-e2e.agents.md`.

## Pitfalls & rules

- The em-dash rule (README maintenance conventions) technically covers changed files; pre-existing em dashes already in touched files were left alone (only the new Log Tracing paragraph was checked clean).
- `test-results/` + `playwright-report/` were removed after verification; they regenerate per run and stay gitignored.
- `e2e/request-id-trace.spec.ts` runs under both `app` and `marketing` projects (it matches both); harmless, asserts the same service behavior twice.
- Must not add vendor logging SDKs without a measured need (decision below).

## Decisions in force

- Decided stdlib-only, no vendor SDKs, because no measured need exists (2026-09-15).
- Decided join key is `X-Request-ID`, one id per logical call reused across retries (2026-09-15).
- Decided logs stay stdout-only; capture belongs to orchestrator/compose (2026-09-15).
- Decided `INGESTION_LOG_LEVEL` stays as worker alias; `LOG_LEVEL` is additive (2026-09-15).
- Decided POST callers keep minting their own `X-Request-ID` + `Idempotency-Key`; `fetchJson` fills the header only for callers that did not (GETs) — preserves the existing header contract the client test pins (2026-09-15).

## Open

- none.
