# PLAN — practice-generation-recovery

Task-id: `practice-generation-recovery` · Spec: `.work/specs/phase2-assessments-practice.md`
Status: 🟢 approved 2026-09-15 · Ponytail mode: full

## Problem

A practice run stuck on "Generating problem 1…" with continuous `GET
/v1/assessments/{id}` + `/attempts` polls. Root cause: the generation worker
(`app.worker_main`) was not running, so the `assessment_generate` pgmq message
was never consumed; the assessment stays `status=generating` forever and
`PracticeRun` polls every 3 s by design. `./full-app`'s profiles never start
the worker (`scripts/full_app.py:66`), which is the documented gap in
`active/issue-44-written-practice-runs/state.md` ("generations sit at
`generating` forever").

Evidence (2026-09-15): job `ea7aefd2…` kind=generation `queued` (attempt 15);
assessment `c8b4171a…` `generating`, `warnings=[]`, zero questions; worker log
SIGTERM'd 14:19; ~15 queued messages backlog.

## Phases

### Phase 1 — Unstick the current run (ops, no code)
1. Start detached worker per rule 53:
   `setsid nohup bash scripts/run-detached-ingestion-worker.sh >/dev/null 2>&1 </dev/null &`
2. Verify the queue drains; assessment flips to `ready` with one question; job
   `succeeded`. Browser re-entry renders the prompt + answer slot.

### Phase A — `./full-app` owns the worker
- `scripts/full_app.py`: `Service.port`/`health_url` optional; add `worker`
  service (`pnpm dev:ingestion-worker`); `full`/`all` profiles include it;
  portless health = pid-alive check; stop/status/logs handle the portless case.
- `scripts/tests/test_full_app.py`: update profile expectations, portless case.
- `.agents/rules/10-runtime-and-e2e.agents.md`: profile description includes the
  worker; sidecar stays demand-started (rule 54).

### Phase B — honest warnings + "Retry generation" on the practice run
Ponytail-scoped: reuse the existing `enqueue_assessment_generation` RPC; no new
migration. A run pointer is immutable (D-02/D-11), so retry must re-enqueue the
SAME assessment id, not create a new one (which is `AssessmentDetail`'s path).
- `services/intelligence/app/routers/assessments.py`: `POST
  /v1/assessments/{assessmentId}/regenerate` — owner read; 409 unless
  `status='generating'`; material-ready gate; 202 `AsyncJob` via existing
  `UserScopedClient.enqueue_generation`. Errors through `service_error` (rule 17).
- `services/intelligence/contracts/phase2/openapi.yaml`: add the path.
- `apps/app/src/assessments/assessmentClient.ts`: `regenerateAssessment` on
  `AssessmentClientLike` + `AssessmentClient`.
- `apps/app/src/assessments/testing/fakeAssessmentClient.ts`: `vi.fn` + script.
- `apps/app/src/pages/practice/PracticeRun.tsx`: render warnings + retry button
  when `generating && warnings.length > 0` (pattern: `AssessmentDetail.tsx:430-450`).
- Tests: `test_assessments_api.py`, `assessmentClient.test.ts`,
  `PracticeRun.test.tsx`.

Ceiling (`ponytail:`): a `failed` assessment is not retryable in-run (re-enqueue
would be dropped by the worker's re-entry guard); the page keeps the honest
"could not be generated" copy for `failed`.

### Phase C — stop the per-poll `GET /attempts`
- `apps/app/src/pages/practice/practiceRunModel.ts`: exported `mergeEnvelopes`
  that returns the same reference when nothing changed.
- `apps/app/src/pages/practice/PracticeRun.tsx`: use it in the load effect so
  unchanged polls don't re-trigger `hydrate()`.
- Tests: `practiceRunModel.test.ts` (identity preserved / replaced).

## Verification
- `uv run python -m pytest scripts/tests/test_full_app.py`
- `uv run pytest services/intelligence/tests/test_assessments_api.py`
- `uv run ruff check` + `ruff format --check` on touched Python
- `pnpm --filter app test src/pages/practice/PracticeRun.test.tsx src/pages/practice/practiceRunModel.test.ts src/assessments/assessmentClient.test.ts`
- `pnpm typecheck` + `pnpm lint` + `pnpm build`
- Restart app (stale Vite on WSL, rule 53); browser: stuck run unsticks; with
  worker stopped mid-generation → warnings + retry appear; retry regenerates
  the same assessment.
- Live: `e2e/practice-run-live.spec.ts` (`--project=app --workers=1`).
- Request-id join check via `./full-app logs worker --grep <id>`.

## Notes
- The ~15-job backlog drains when the worker starts; optional service-role
  cleanup of orphaned `generating` assessments.