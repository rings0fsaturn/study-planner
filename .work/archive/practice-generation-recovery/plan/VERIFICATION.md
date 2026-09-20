# VERIFICATION — practice-generation-recovery

Verified 2026-09-15 on the live dev stack (`./full-app`, managed worker; sidecar down — practice-run generation does not need it).

## Phase 1 — worker down root cause
- `ps aux` had no `app.worker_main`; worker log SIGTERM'd at 14:19; job `ea7aefd2…` `queued` since 17:06 (attempt 15) with assessment `c8b4171a…` `generating`, `warnings=[]`, 0 questions.
- Detached worker start → backlog drained FIFO; the user's job processed. Its generation **failed** `malformed_output`/`difficulty_mismatch` (hard format gate, terminal by design) — not a worker fault.

## Phase A — worker in `./full-app`
- `uv run python -m pytest scripts/tests/test_full_app.py` → 8 passed.
- `./full-app restart full` → `worker: running pid=… health=running log=…/worker.log`; `ingestion worker starting against …` logged; queue polls 200.
- `./full-app stop full` / `start full` clean (managed group, SIGTERM drain). Worker is portless; `status`/`logs worker` work.

## Phase B — regenerate route
- `uv run pytest services/intelligence/tests/test_assessments_api.py` → 42 passed (7 new regenerate cases: 202+job row, 409 ready, 409 failed, 404 missing material, 409 material not ready, 404 unknown, 401 unauth).
- Route live after restart: `OPTIONS /v1/assessments/abc/regenerate` → 200; `GET` → 405 (POST-only).
- `pnpm --filter app test src/assessments/assessmentClient.test.ts` → route path + headers asserted.
- PracticeRun retry test: warnings render + `regenerateAssessment` called once with the same id.

## Phase C — poll hygiene
- `mergeEnvelopes` unit tests (identity preserved / replaced on status+warnings change / new id / empty map) — 5 passed.
- Focused practice tests 43/43.

## Full gates
- `pnpm --filter app test` → 872/874 (2 = known `seedTestData` WSL TZ flakes, pre-existing).
- `pnpm typecheck` clean; `pnpm lint` clean; `pnpm build` green (Vite large-chunk notice pre-existing).
- `uv run ruff check` on touched files → only pre-existing violations (verified against HEAD); no new lines >100 chars.
- Live `e2e/practice-run-live.spec.ts` (`--project=app --workers=1`) → 2/2 (desktop 1280 + phone 375), start→first problem 28.1 s / 41.6 s, reload-resume, finish, summary.

## Not verified live
- The in-browser retry button on a real stuck-generating assessment (needs a retryable provider error to induce). Covered by the PracticeRun unit test + backend route tests.
- The user's original stuck run (device-local run pointer lives in the user's browser; its assessment is terminal `failed` by design).