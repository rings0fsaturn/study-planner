# Scratchpad – issue-39-assessment-taking-objective-grading · session 2026-09-03
_state.md: active/issue-39-assessment-taking-objective-grading/state.md · Updated: 2026-09-03T06:05_

## Now / Next
- Doing: Planning COMPLETE — PLAN.md (7 decisions, 6 phases) + surface research + VERIFICATION skeleton written; committing
- Next: Phase 1 — contract amendment (openapi assessment-attempt routes + fixtures + contracts test)
- Blocked: none

## Session log
- 05:25 DONE   #34 branch committed (3 commits), PR #59 merged to project/phase-2, #34 closed
- 05:30 DONE   phase2/issue-39 branch created off origin/project/phase-2 @ f83b8c1 and pushed
- 05:35 DONE   #39 claimed (assignee rings0fsaturn, verified); task folder + STATUS row + state.md bootstrap
- 05:40 DECIDED global wayfinder flow (claim→resolve→record) + project work-journal records; implement skill loaded (TDD at pre-agreed seams)
- 05:45 FOUND  contract gap: AttemptSubmit wired only to practice-runs route; POST /v1/attempts/{id}/grade is body-less; no assessment-attempt submit/read route — #39 must amend openapi (PLAN D-02)
- 05:48 FOUND  durable-events QuestionAttempted payload additionalProperties:false, NO answer field; QuestionGraded event payload lacks perSkill (API-response only) — answers live in a server attempts table + local unsynced table, never the event log
- 05:50 FOUND  Dexie at version(5) (EventStoreProvider.tsx:42-49); no attempts table in any migration (checked all); worker_main.py two arms ready for a grading third arm; ingestion_jobs.kind already has 'grading'
- 05:52 BLOCKED inspector subagent (49 min, 101 api calls) died on provider 524s — recovered by verifying all load-bearing seams first-hand
- 05:58 DONE   research/implementation-surface-39.md (contract/DB/service/client facts + 8 gaps)
- 06:02 DONE   plan/PLAN.md — D-01..D-07, 6 phases; plan/VERIFICATION.md skeleton
- 06:05 NEXT   commit planning, then Phase 1 (TDD: contracts test first)
- 06:08 DONE   P1 TDD RED: 3 new contracts tests (routes-exist, schemas-exclude-hidden, fixtures-validate) fail on missing openapi paths/schemas/fixtures
- 06:12 DECIDED AttemptRecord.grade typed as oneOf [QuestionGraded, null] (OpenAPI 3.1 nullability, questionGraded carries perSkill) — test asserts the $ref inside the oneOf branches
- 06:12 DECIDED AttemptSubmit.answer stays opaque {} per existing contract; added a NAMED ObjectiveAnswer schema (index/indices/flag/value, additionalProperties:false) as the documented objective shape for fixtures + grader tests — no change to the wire contract
- 06:15 DONE   openapi amendment: POST /v1/assessments/{assessmentId}/questions/{questionId}/attempts (201 + idempotent 200), GET /v1/assessments/{assessmentId}/attempts (array of AttemptRecord), QuestionId path param, 3 new schemas; fixtures attempt-submit/-created/-record-queued/-record-graded (graded one carries perSkill + passes secret-field walk)
- 06:18 DONE   P1 GREEN: uv run pytest contracts 15/15 (12 pre-existing + 3 new); pre-existing RefResolver deprecation warnings only
- 06:22 DECIDED AttemptCreated gains required jobId — submit auto-enqueues grading atomically (one RPC: verify ownership + dedupe + insert attempt + insert grading job + pgmq.send), so the client never needs a separate grade-trigger call; POST /v1/attempts/{id}/grade stays for manual re-grade/replay per the pre-existing contract
- 06:22 DECIDED grading queue named assessment_grade (pgmq.create in 025); ingestion_jobs attempt numbering per (kind, material_id) per the 018 unique constraint
- 06:25 DONE   migration 025_question_attempts.sql: table (answer jsonb, grade jsonb public-only, UNIQUE(user_id, client_attempt_id) idempotency), owner RLS (SELECT/INSERT only — grades land solely via service path), assessment_grade queue, submit_assessment_attempt RPC (ownership + format=objective guard + idempotent replay + job insert + send), complete_attempt_grading RPC (attempt+job atomic, service_role-only execute)
- 06:28 DONE   grader TDD: tests first (9), then app/grading/grader.py — mcq/multi_select/true_false/cloze/numeric normalizers, tau 0.6 per-skill correct, publicFeedback 'Correct.'/'Not correct.'; DECIDED malformed answer shape = GraderInputError (route 400s it), never a silent 0; DECIDED perSkill score = overall score (deterministic; #43 owns richer mapping); 9/9 green
- 06:35 DONE   grading worker TDD: tests first (7), then app/grading/worker.py mirroring the generation arm (poll/run_once/_process, complete(success) semantics); DECIDED transient IngestionError → message redelivered + job reset to queued (no orphaned running row); malformed input → attempt failed with ungradable feedback but job succeeded (fail-closed, no retry burn); repo protocol GradingRepo narrow like GenerationRepo; 7/7 green
- 06:40 DONE   SupabaseIngestionRepo gained get_attempt/get_question(service_role incl. answer_block)/complete_attempt (RPC); worker_main third arm _build_grading_worker + grading_thread + join
- 06:45 FOUND  7 pre-existing test failures on this checkout (calibration golden x5, retrieval sidecar probe x2) — fail identically with my changes stashed; unrelated to #39, recorded for the session record; my-domain tests all green
- 06:46 NEXT   P3: service routes (submit/list) in routers/assessments.py + AsyncJob result wiring
- 07:05 DONE   P3 TDD: 5 route tests first (FakeUserClient gained submit_attempt/list_attempts/seed_question mirroring 025 RPC semantics), then routes in routers/assessments.py (POST attempts 201/200-replay, GET attempts list) + UserScopedClient.submit_attempt/list_attempts (RPC path). DECIDED: route validates body.questionId matches route param + answer is an object before the RPC (400); DECIDED: attempt list serialization never echoes the stored answer (learner input, but not needed by any consumer) and grade passes through as the public QuestionGraded; 404 via get_assessment owner check. 48/48 green across api+grader+worker+contracts
- 07:06 NEXT   P4: Dexie version(6) tables + event constants/payloads + attemptClient/assessmentCache + offline queue drain
- 07:25 DONE   P4 TDD: dataLayer tests first (7: event constants verbatim, QuestionAttempted payload rejects answer prop, Dexie v6 tables, client submit/list/replay), then implemented — EventStore QUESTION_ATTEMPTED/QUESTION_GRADED constants, Dexie version(6) with assessmentAttempts + assessmentContentCache, sync/types QuestionAttemptedPayload/QuestionGradedPayload (schema-exact), types.ts ObjectiveAnswer/AttemptSubmitInput/AttemptCreated/QuestionGradedResult/AttemptRecord, AssessmentClient.submitAssessmentAttempt/listAssessmentAttempts. 7/7 green
- 07:28 DECIDED assessmentAttempts keyed by clientAttemptId (client-minted, unique per 025 constraint) because the server mints attemptId on submit; local row patched with attemptId+jobId+status='submitted' after the POST; retry = new clientAttemptId row (AC2 identity)
- 07:30 DECIDED attemptFlow.ts is the single coordinator (PLAN D-05): local row → QuestionAttempted (answer-free, patched with attemptId post-submit) → server submit → pollGrade via the attempts read route → QuestionGraded (deduped by attemptId) → local grade write; drainQueuedAttempts resubmits queued rows with the SAME clientAttemptId (server dedupes — replay-safe, identity retried not a new attempt); refreshAttempts merges server records for fresh-device restore without touching local answers (answer optional on rows: server-merged rows carry none)
- 07:33 FOUND  fake-indexeddb DataCloneError: my test uuid double was an uninvoked IIFE so uuid('ca') stored a closure — lesson: any value written to Dexie must be fully structured-cloneable; 14/14 green after fix
- 07:35 NEXT   P5: taking UI on AssessmentDetail (answer controls per subtype, honest states, retry), then P6 sweep + live pass
