# State – issue-39-assessment-taking-objective-grading
_Spec: specs/phase2-tickets/07-assessment-taking-objective-grading.md (ticket #39, parent #32, map #4) · Plan: active/issue-39-assessment-taking-objective-grading/plan/ · STATUS row: issue-39-assessment-taking-objective-grading · Status: active (P5 in progress) · Updated: 2026-09-03_

## Current state & next
- Phases 1–4 COMPLETE and verified (contracts 15/15, grader 9/9, worker 7/7, service routes 48/48 domain-total, client data layer 14/14). All committed on `phase2/issue-39`.
- Phase 5 (taking UI) IN PROGRESS: `AttemptTaker.tsx` implemented + wired into `AssessmentDetail.tsx`; `FakeAssessmentClient` extended with the attempt methods + transport view; UI test is 1/3 passing.
- Next: **fix the 2 timing-out UI tests**, then P6 sweep (typecheck/lint/full vitest/pytest + redaction grep + live pass per PLAN).
- Debugging lead for the timeouts (from the last run): (1) the test opens its own `Dexie('StudyTracker_taker-user')` while `EventStoreProvider` opens the same name — the "Another connection wants to delete database" stderr shows two connections fighting; let the provider own the DB and assert through its tables instead of a parallel connection. (2) `pollGrade` polls 20×1 s (attemptFlow GRADE_POLL_ATTEMPTS/GRADE_POLL_INTERVAL_MS); if the read route mock ever misses a clientAttemptId the component waits up to 20 s — longer than the 5 s vitest default timeout. Make the poll budget injectable via `AttemptFlowDeps` (or use `waitFor` with an explicit test timeout). (3) The test's `scriptedGrades` 'next'-key trick is fragile — replace with a plain function mock returning grades per clientAttemptId.

## Done so far
- Planning (commit `acad118`): surface research verified first-hand (contract gap → this slice amends openapi; QuestionAttempted payload is answer-free by schema; Dexie v5→v6; no attempts table; two-arm worker), PLAN.md with D-01..D-07, VERIFICATION skeleton.
- P1 contract amendment GREEN: openapi gains `POST /v1/assessments/{assessmentId}/questions/{questionId}/attempts` (201 + idempotent 200), `GET /v1/assessments/{assessmentId}/attempts`, `QuestionId` param, `ObjectiveAnswer`/`AttemptCreated`/`AttemptRecord` schemas (grade = oneOf [QuestionGraded, null]); AttemptCreated requires `jobId` (submit auto-enqueues grading); 4 fixtures; 3 new contracts tests.
- P2 GREEN: migration `025_question_attempts.sql` (table + owner RLS SELECT/INSERT + `assessment_grade` queue + `submit_assessment_attempt` RPC (ownership/objective guard/idempotent replay/job insert/pgmq.send) + `complete_attempt_grading` RPC service_role-only); `app/grading/grader.py` (mcq/multi_select/true_false/cloze/numeric, τ 0.6, deterministic feedback); `app/grading/worker.py` third arm; `SupabaseIngestionRepo` grading methods; `worker_main.py` three arms.
- P3 GREEN: routes in `routers/assessments.py` (submit 201/200-replay, list) + `UserScopedClient.submit_attempt/list_attempts`; `FakeUserClient` attempt doubles; 5 route tests incl. redaction walk.
- P4 GREEN: EventStore `QUESTION_ATTEMPTED`/`QUESTION_GRADED`; Dexie `version(6)` (`assessmentAttempts` keyed by clientAttemptId + `assessmentContentCache`); `sync/types` payload interfaces (schema-exact); `types.ts` ObjectiveAnswer/AttemptSubmitInput/AttemptCreated/QuestionGradedResult/AttemptRecord; `AssessmentClient` submit/list + `transport` DI view; `attemptFlow.ts` coordinator + 14 tests.
- P5 partial: `AttemptTaker.tsx` (radio group per options / text input, honest phases answering→submitting→queued-offline→grading→graded→failed, score + per-skill + feedback line, Retry question with fresh-attempt copy, attempt history list), wired into AssessmentDetail ready state replacing the static options list.

## Flow trace
1. Contract chain: AttemptSubmit (opaque answer) → 025 RPC validates ownership + format=objective + dedupes on (user, clientAttemptId) → attempt row + grading job + pgmq message in one transaction → 201 AttemptCreated{attemptId, jobId}.
2. Grading chain: `assessment_grade` queue → GradingWorker._process → repo.get_attempt + get_question (service_role, answer_block included) → grade_objective → complete_attempt_grading RPC (attempt status/grade + job succeeded atomic) → public grade in `question_attempts.grade`.
3. Read chain: GET /v1/assessments/{id}/attempts → owner RLS rows → `_attempt_record` serialization (never echoes the answer; grade passthrough).
4. Client chain: AttemptTaker → attemptFlow.submitObjectiveAttempt (local row → QUESTION_ATTEMPTED event (no answer) → transport.submit → patch row + event with server attemptId) → pollGrade (attempts read route) → recordGrade (row + QUESTION_GRADED, deduped) → UI honest states.
5. Offline: submit failure keeps row `queued` + QuestionAttempted already logged; drainQueuedAttempts (reconnect) resubmits with the SAME clientAttemptId (server dedupes → identity retried, not a new attempt); refreshAttempts merges server rows for fresh-device restore without touching local answers.
6. Retry identity: every submit mints a new clientAttemptId row; history is append-only (AC2).

## Files affected
- `services/intelligence/contracts/phase2/openapi.yaml` – attempt routes + schemas + QuestionId param.
- `services/intelligence/contracts/phase2/fixtures/attempt-{submit,created,record-queued,record-graded}.json` – new fixtures.
- `services/intelligence/contracts/phase2/tests/test_contracts.py` – 3 new tests + oneOf-nullability assertion helper.
- `apps/app/supabase/migrations/025_question_attempts.sql` – table + RLS + queue + 2 RPCs.
- `services/intelligence/app/grading/{__init__,grader,worker}.py` – new grading domain + arm.
- `services/intelligence/app/ingestion/repository.py` – ATTEMPTS_TABLE + get_attempt/get_question/complete_attempt.
- `services/intelligence/app/worker_main.py` – third arm wiring + join.
- `services/intelligence/app/routers/assessments.py` – submit/list routes + `_attempt_record`.
- `services/intelligence/app/userrest.py` – submit_attempt/list_attempts.
- `services/intelligence/tests/test_grading_grader.py`, `test_grading_worker.py`, `test_assessments_api.py` – 21 new tests total.
- `apps/app/src/events/EventStore.ts` – QUESTION_ATTEMPTED/QUESTION_GRADED.
- `apps/app/src/events/EventStoreProvider.tsx` – version(6) stores.
- `apps/app/src/sync/types.ts` – QuestionAttemptedPayload/QuestionGradedPayload.
- `apps/app/src/assessments/types.ts` – ObjectiveAnswer/AttemptSubmitInput/AttemptCreated/QuestionGradedResult/AttemptRecord.
- `apps/app/src/assessments/assessmentClient.ts` – submit/list + transport view.
- `apps/app/src/assessments/attemptFlow.ts` – flow coordinator (transport DI).
- `apps/app/src/assessments/testing/fakeAssessmentClient.ts` – attempt mocks + transport.
- `apps/app/src/pages/assessments/AttemptTaker.tsx` – new taking UI.
- `apps/app/src/pages/assessments/AssessmentDetail.tsx` – AttemptTaker wired into the ready state.
- `apps/app/src/events/attempts.dataLayer.test.ts`, `apps/app/src/assessments/attemptFlow.test.ts`, `apps/app/src/pages/assessments/AttemptTaker.test.tsx` – new test files (P5 test 1/3 green).
- `.work/active/issue-39-…/` – plan, verification, research, state, scratchpad.

## Pitfalls & rules
- Dexie (fake-indexeddb in tests) rejects non-cloneable values with DataCloneError — never store closures; ensure injected doubles are invoked functions (a test uuid double burned 20 min).
- `answer_block` is service_role-only: only `repo.get_question` may read it; routes/serializations must never touch it (P6 redaction grep: no answerBlock/correctIndex/correct_index in `apps/app/src/`).
- The durable QuestionAttempted payload has NO answer field (schema `additionalProperties:false`); the answer lives only in the server attempts row and the local unsynced `assessmentAttempts` row.
- Malformed answer shape = GraderInputError → route 400 (never a silent 0); worker fail-closes to attempt `failed` + ungradable feedback while the job still succeeds.
- 7 PRE-EXISTING test failures on this checkout (calibration golden ×5, retrieval sidecar probe ×2) — verified identical with changes stashed; not ours, do not chase.
- WSL: restart the managed runtime before browser verification; playwright-cli sessions die between tool calls (batch compound commands).
- AssessmentClientLike now carries `transport` (DI seam for attemptFlow); FakeAssessmentClient mirrors it — keep the two in sync when adding methods.

## Decisions in force
- D-01 server-owned `question_attempts` table (migration 025) with UNIQUE(user_id, client_attempt_id) idempotency; grades land only via the service path (no authenticated UPDATE).
- D-02 contract amendment owned by this slice: submit + read routes; AttemptCreated carries `jobId` because submit auto-enqueues grading atomically (client never calls a separate grade trigger; `POST /v1/attempts/{attemptId}/grade` stays for manual re-grade).
- D-03 deterministic grader: per-subtype normalizers, score ∈ {0,1}, perSkill = overall score with τ 0.6, publicFeedback "Correct."/"Not correct." (richer feedback is #50).
- D-04 Dexie version(6): `assessmentAttempts` keyed by **clientAttemptId** (server mints attemptId later; row patched) + `assessmentContentCache`; neither syncs.
- D-05 attemptFlow is the single coordinator; offline drain resubmits the same clientAttemptId; QuestionAttempted is patched with the server attemptId post-submit.
- D-06 lean honest taking UI (AttemptTaker); the #34 split-pane review surface stays with #40.
- D-07 restore/account-switch ride existing machinery (per-user Dexie; server rows are the durable attempt record).

## Open
- P5: 2 UI tests time out (1/3 green) — debugging leads in Current state & next.
- P6 pending: full sweep + live pass + AC tick-down + wayfinder resolution (comment + close #39 + map #4 line).
- `pollGrade` poll budget is hard-coded (20×1 s) — consider making it injectable for tests.
- Uncommitted-then-committed WIP on `phase2/issue-39` (see git log); branch not pushed since the WIP commit unless noted.
