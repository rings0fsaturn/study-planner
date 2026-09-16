# State – practice-generation-recovery
_Spec: .work/specs/phase2-assessments-practice.md · Plan: active/practice-generation-recovery/plan/PLAN.md · STATUS row: practice-generation-recovery · Status: active · Updated: 2026-09-15_

## Current state & next
- All four phases done and verified. Root cause (worker not running) fixed; `./full-app start full` now also starts the generation/ingestion/grading worker.
- The user's original assessment `c8b4171a…` ended `failed` (`difficulty_mismatch`, hard format gate, terminal by design) — the run shows the honest "could not be generated" copy; fresh runs work.
- Live spec `e2e/practice-run-live.spec.ts` 2/2; app suite 872/874 (2 = known `seedTestData` WSL TZ flakes); typecheck/lint/build green.
- Next: wrap this task (promote rule 10 note is done; archive + STATUS flip on user sign-off).

## Done so far
- Phase 1: started the detached worker, drained the ~15-job backlog; user's job processed (generation failed validation, not the worker).
- Phase A: `scripts/full_app.py` `Service` port/health optional; `worker` service (`pnpm dev:ingestion-worker`); `full`/`all` profiles include it; portless health = 1 s pid-liveness; status/stop/logs handle portless. `test_full_app.py` updated. `./full-app restart full` verified (worker health=running, `.dev/full-app/logs/worker.log`).
- Phase B: `POST /v1/assessments/{id}/regenerate` (reuses `UserScopedClient.enqueue_generation`, 409 unless `generating`, material-ready gate, 202 AsyncJob); openapi path; `AssessmentClientLike.regenerateAssessment`; fake `scriptRegenerate`; PracticeRun shows warnings + "Retry generation" when `generating && warnings`, and the warnings list on `failed`.
- Phase C: `mergeEnvelopes` identity-stable merge in `practiceRunModel.ts`; PracticeRun load effect uses it; unchanged polls no longer re-trigger `GET …/attempts`.
- Rule 10 updated (worker in `full`; sidecar still demand-started per rule 54).

## Flow trace
1. `POST /v1/assessments/generate` inserts the assessment row (`status='generating'`, routers/assessments.py:173) and enqueues via the `enqueue_assessment_generation` RPC (migration 021) → `pgmq 'assessment_generate'`.
2. The worker (`app.worker_main`, generation arm) polls the queue and completes the assessment (`generation/worker.py`), flipping it `ready` and inserting the question.
3. `PracticeRun.tsx` polls `GET /v1/assessments/{id}` every 3 s while status is `generating` (lines 119-123); each poll's new envelope object also re-triggered `hydrate()` → `GET …/attempts` (lines 126-153). Fixed by `mergeEnvelopes` identity stability.
4. `./full-app` profiles (scripts/full_app.py) now include the worker: `["intelligence","app","worker"]`.

## Files affected
- scripts/full_app.py – `Service` port/health optional; worker service + profiles; portless start/status/blocker paths.
- scripts/tests/test_full_app.py – profile expectations + portless worker case.
- services/intelligence/app/routers/assessments.py – `POST /v1/assessments/{id}/regenerate`.
- services/intelligence/contracts/phase2/openapi.yaml – regenerate path.
- services/intelligence/tests/test_assessments_api.py – 7 regenerate tests.
- apps/app/src/assessments/assessmentClient.ts – `regenerateAssessment` + interface.
- apps/app/src/assessments/testing/fakeAssessmentClient.ts – `scriptRegenerate`.
- apps/app/src/assessments/assessmentClient.test.ts – regenerate route test.
- apps/app/src/pages/practice/practiceRunModel.ts – `mergeEnvelopes`.
- apps/app/src/pages/practice/practiceRunModel.test.ts – merge tests.
- apps/app/src/pages/practice/PracticeRun.tsx – mergeEnvelopes use + warnings/retry UI.
- apps/app/src/pages/practice/PracticeRun.test.tsx – retry test + helper warnings param.
- .agents/rules/10-runtime-and-e2e.agents.md – worker in `full` profile description.

## Pitfalls & rules
- Must keep worker/queue work behind the service; the app talks to the intelligence service, not Supabase directly (rule 30/35).
- Must keep logging contract (rule 17): new route errors through `service_error`; client sends `X-Request-ID` + `Idempotency-Key`.
- Must restart the managed runtime after app/service edits on WSL (rule 53) before browser verification.
- GPU sidecar stays demand-started (rule 54); practice-run generation does NOT need it (no `skillTags`/`scope` → `_spread_context`), but steer-based generation and ingestion embedding do.
- A run pointer is immutable (D-02/D-11): practice-run generation retry re-enqueues the SAME assessment id; `AssessmentDetail`'s new-assessment+`navigate` path cannot be reused in a run.
- `difficulty_mismatch` is a hard format gate (validation.py:49,107): the model must author the exact requested difficulty; after one repair it is a terminal non-retryable failure. Do not weaken it casually.

## Decisions in force
- Decided to reuse the existing `enqueue_assessment_generation` RPC for retry (no new migration), gate the retry route to `status='generating'`, because a `failed` assessment's re-enqueued message would be dropped by the worker's re-entry guard (generation/worker.py:157). (2026-09-15)
- Decided to run under ponytail full mode (user request): YAGNI, reuse existing patterns, shortest diff.
- Decided to keep the `failed` assessment non-retryable in-run (honest "could not be generated" copy) rather than reset its status to `generating`. (2026-09-15)

## Open
- none