# #39 Implementation-surface findings — verified first-hand 2026-09-03

(Dispatched inspector subagent died on provider 524s after ~49 min; the load-bearing seams below were verified directly. Trust these over summaries; re-check file:line before editing.)

## Contracts (services/intelligence/contracts/phase2/)
- `openapi.yaml:56` — `POST /v1/attempts/{attemptId}/grade`: body-less, 202 → AsyncJob. `openapi.yaml:127` — `AttemptSubmit` {clientAttemptId, questionId, answer (opaque), submittedAt, elapsedSeconds?, correlationId} wired ONLY to `POST /v1/practice-runs/{runId}/attempts` (line 47–49). No assessment-attempt submit/read route exists → #39 amends the contract (PLAN D-02).
- `openapi.yaml:128` — API `QuestionGraded` {attemptId, questionId, materialId, score, correct, perSkill[], explanation?, grader, modelVersion?, gradedAt}.
- `durable-events.schema.json` — envelope {eventId, clientEventId, kind, ownerId, createdAt, correlationId, idempotencyKey?, payload}; `QuestionAttempted` payload = {attemptId, clientAttemptId, questionId, submittedAt, answerKind? (objective|written|coding), elapsedSeconds?} additionalProperties:false → **no answer field**; `QuestionGraded` event payload = {attemptId, questionId, score, correct, gradedAt, grader?, publicFeedback?} → perSkill is API-response-only.
- `PIPELINES.md` — "Objective grading is deterministic… A grade is one-to-one with an attempt ID. Offline attempts can queue locally and sync later; grades are server-authoritative. A retry creates a fresh attempt." Persistence boundary: "Local-first clients persist only thin event pointers, attempts, and redacted caches."

## Database (apps/app/supabase/migrations/, latest = 024)
- `018_assessments_generation.sql` — `assessments` + `questions` (`answer_block JSONB NOT NULL`, line 72); column-grant discipline: `GRANT SELECT (public cols) ON questions TO authenticated` tightened by `022_questions_column_grant_fix.sql`; answer_block readable by service_role only. `enqueue_assessment_generation` RPC (line 116).
- No attempts table in any migration (checked all) → PLAN D-01 migration 025.
- `ingestion_jobs.kind` CHECK enum includes 'grading' (#38 PLAN D-01/verification); pgmq wrappers queue-name-generic (ingestion_send/poll/complete).

## Service (services/intelligence/app/)
- `routers/`: assessments.py (generate: RLS INSERT + enqueue RPC → 202), calibration.py, jobs.py, materials.py, progress.py, retrieval.py, roadmap.py, serialization.py. No grading router.
- `worker_main.py` — two daemon arms (ingestion + generation on `assessment_generate` queue) sharing one httpx pool (D-04 of #38); `_build_generation_worker` at line 72 → grading arm mirrors this.
- `app/generation/worker.py` exists as the generation arm; grading gets `app/grading/` (grader.py + worker.py) per PLAN P2.

## Client (apps/app/src/)
- `events/EventStore.ts:21` — `append(kind, payload, createdAt)` kind-agnostic; only constant `ASSESSMENT_CREATED` (line 5). No Dexie version bump needed for new event kinds (events table already indexed by kind).
- `events/EventStoreProvider.tsx:19-51` — per-user DB `StudyTracker_<userId>`; Dexie at `version(5)` (events, sync_queue, sync_meta, onboardingDraft, activeSession, calibrationCache) → #39 ships version(6) (rule 31). Account switch = new DB per userId (isolation already proven).
- `sync/SyncEngine.ts:192` — pushes queued events to `public.events` via supabase insert; snapshot/restore machinery exists (fresh-device restore); `SyncProvider.tsx:216` exposes `logEvent(kind, payload, createdAt)` via `useSync()`.
- `sync/types.ts:74-77` — `AssessmentCreatedPayload` precedent for new payload interfaces (QUESTION_ATTEMPTED/GRADED payloads to add).
- `pages/assessments/AssessmentDetail.tsx` — #38's single-objective surface (polling, citations, warnings); taking UI hangs here (PLAN D-06). `AssessmentDetail.test.tsx` mocks `../../lib/supabase` — test pattern to mirror.
- `lib/intelligenceClient.ts` — fetch + Bearer + timeout/retry + typed errors (CalibrationAuthError etc.); `materials/materialClient.ts` is the narrow-DI client pattern for attemptClient.ts.

## Test baselines (post-#38, from archive records)
- app vitest 699/699 green; service pytest 391 + 7 golden; contracts 12/12. EventStore.test.ts = 17 tests (verified live in inspector transcript before it died).

## Gaps to build (= the plan's phases)
1. openapi amendment: assessment attempt submit + read routes (D-02) + fixtures + contracts test.
2. Migration 025 `question_attempts` + RLS/grants (D-01).
3. `app/grading/` deterministic grader + third worker arm on `grading` queue (D-03).
4. Service routes: submit/read/grade-trigger (P3).
5. Dexie version(6): assessmentAttempts + assessmentContentCache tables; event constants + payload types (D-04).
6. attemptClient.ts + assessmentCache.ts + offline queue/drain (D-05).
7. Taking UI on AssessmentDetail with honest states (D-06).
8. AC4 test matrix: offline append/queue/retry, restore, account switch, event order.
