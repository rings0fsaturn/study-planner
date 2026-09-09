# #40 context — implementation surface (gathered 2026-09-09, first-hand)

Ticket: Assessment Review Implementation (#40, parent #32, map #4). Blockers #39 + #34 verified CLOSED on GitHub.

## What the server already returns (no contract amendment needed)

- `GET /v1/assessments/{id}` → Assessment (status generating|ready|partial|failed, questions with prompt/options/citations/skillTags, warnings, groundingStale). AttemptTaker page polls it every 3 s until terminal.
- `GET /v1/assessments/{assessmentId}/attempts` → AttemptRecord[] (attemptId, clientAttemptId, questionId, assessmentId, submittedAt, status queued|graded|failed, grade: QuestionGraded|null).
- `QuestionGraded` = { attemptId, questionId, materialId, score 0..1, correct, perSkill?, explanation?, grader objective|llm_rubric|judge0, modelVersion?, gradedAt }. No key material; the learner's answer is never echoed (write-only).
- Grading worker today grades objective only (`grade_objective` in `app/grading/grader.py`); `llm_rubric`/`judge0` are enum values with no producer yet (#41/#42).

## What the client already has

- `attemptFlow.ts` (403 lines): submitObjectiveAttempt (fresh clientAttemptId per submit), pollGrade (20x1s), drainQueuedAttempts, refreshAttempts (server merge, no answer touch), cacheAssessment/cachedAssessment, listLocalAttempts.
- `AttemptTaker.tsx` (243 lines): taking UI + honest phases + attempt history list; injects `serviceClient.transport` (not the bare client).
- `AssessmentDetail.tsx` (237 lines): generating/failed/ready states; ready state renders per-question prompt + AttemptTaker (objective only) + citations. No review surface yet.
- `FakeAssessmentClient` mirrors the transport view — component tests script against it (`AssessmentDetail.test.tsx` pattern).
- Prototype `apps/app/src/prototype/assessment-review/` (throwaway, dev-only): ReviewSurface/SummaryBand/QuestionNavigator/QuestionPanelShell/QuestionReviewCard + Objective/Written/Coding treatments + AttemptTimeline + queued-retry model; full port source for #40.

## Constraints the plan must honor

1. Your-answer marking is local-only. The server never returns the submitted answer, so objective "your pick" markers render only from local Dexie rows; server-merged rows (fresh-device restore) show grade without the pick. Plan must decide the honest fallback.
2. Retry = fresh observation (map #10): per-question retry reuses submitObjectiveAttempt (fresh clientAttemptId, append-only). Whole-assessment retry needs a production mapping (re-answer all vs regenerate) — plan decision.
3. AC2 extension points: written/coding treatments render from the shared grade shape (score/perSkill/explanation/citations) even before #41/#42 land; family extras (rubric rows, test tables) arrive with their slices. Plan must fix the depth.
4. AC4 redaction gate: no answerBlock/correctIndex/referenceSolution/hiddenTest in client code or DOM; grep + DOM test.
5. Split-pane B per HITL 2026-09-03 (rail ≥1024px, sticky strip below; AttemptCards oldest→latest, latest expanded; retry copy per decisions-34.md).
