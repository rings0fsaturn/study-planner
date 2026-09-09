# Assessment Taking and Objective Grading (#39) — Implementation Plan

**Slug:** `2026-09-03-issue-39-assessment-taking-objective-grading`
**Date written:** 2026-09-03 · **Ticket:** [#39](https://github.com/rings0fsaturn/study-planner/issues/39) (claimed `rings0fsaturn`) · **Parent:** spec #32 · map #4 · **Branch:** `phase2/issue-39`
**Plan status:** 🟡 In progress — P1–P5 done (2026-09-03, all green), P6 partial (static sweep green; live pass blocked on external Supabase outage)
**Downstream:** unblocks #40 (review), #41 (written), #42 (coding), #43 (mastery); #44/#48 block on #39+#43.

> Runbook convention inherited from the #38 plan: implement one phase per session, statuses updated in the same commit as the work, STOP on any reality-mismatch.

## TL;DR

A learner can **take** the grounded objective question produced by #38: answer it online or offline (answer stored locally, attempt event recorded), have the attempt **submitted and queued** when offline, and receive **authoritative normalized grading** (score ∈ [0,1] + per-skill binary observations, τ ≈ 0.6) once connected. Grading is deterministic and server-side: the service compares the submitted answer against `questions.answer_block` (service-role-only), never shipping the key. The client logs `QuestionAttempted` → `QuestionGraded` events (1:1 via `attemptId`, retry = fresh attemptId) into the existing local-first spine.

## Acceptance criteria → where they are met

| AC | Meaning | Met by |
|---|---|---|
| AC1 | Cache holds only envelope + visible payload | D-04: `assessmentContentCache` Dexie table stores the redacted `Assessment` shape only (what `GET /v1/assessments/{id}` already returns); grep gate in P6 |
| AC2 | Approved per-question event + retry identity semantics | D-05: `QuestionAttempted`/`QuestionGraded` per durable-events.schema.json; retry mints a new `attemptId`/`clientAttemptId` |
| AC3 | Normalized score + perSkill without exposing hidden answers | D-03/D-06: server grader reads `answer_block` under service role; response carries score/correct/perSkill/publicFeedback only |
| AC4 | Offline append, queue, retry, restore, account switching, event order tested | P4/P6 test matrix (Dexie tests + service pytest + live pass) |

## Context — live stack facts (verified 2026-09-03, trust over older notes)

- Contract `openapi.yaml` (`services/intelligence/contracts/phase2/`): `AttemptSubmit` schema exists (line 127: clientAttemptId, questionId, opaque `answer`, submittedAt, elapsedSeconds, correlationId) but is wired only to `POST /v1/practice-runs/{runId}/attempts`; `POST /v1/attempts/{attemptId}/grade` (line 56) is body-less → 202 AsyncJob. **No assessment-attempt submission route and no attempt-read route exist** — this slice amends the contract (P1).
- `durable-events.schema.json`: `QuestionAttempted` payload = {attemptId, clientAttemptId, questionId, submittedAt, answerKind?, elapsedSeconds?} `additionalProperties:false` (**no answer field — the answer never rides the event log**); `QuestionGraded` payload = {attemptId, questionId, score, correct, gradedAt, grader?, publicFeedback?} (perSkill is API-response-only).
- DB: migrations live in `apps/app/supabase/migrations/` (latest `024`); `018` created `assessments` + `questions` (`answer_block JSONB NOT NULL`, service_role-only per `022_questions_column_grant_fix.sql`); **no attempts table exists**. `ingestion_jobs.kind` CHECK enum already includes `'grading'`; pgmq wrappers are queue-name-generic (`ingestion_send/poll/complete`).
- Service: `app/routers/assessments.py` (generate = RLS INSERT + DB-atomic `enqueue_assessment_generation` RPC), `app/routers/jobs.py`, `app/worker_main.py` runs **two arms** (ingestion + generation on `assessment_generate` queue) — grading adds a third arm on a `grading` queue (D-04 pattern from #38).
- Client: `EventStore.append(kind, payload)` is kind-agnostic (`apps/app/src/events/EventStore.ts:21`); only `ASSESSMENT_CREATED` constant exists today. Dexie is per-user (`StudyTracker_<uid>`), currently **version(5)** in `apps/app/src/events/EventStoreProvider.tsx:42-49` → this slice ships **version(6)** (rule 31: version-up, never edit in place). `SyncEngine` pushes `events` rows to `public.events` (`apps/app/src/sync/SyncEngine.ts:192`) with snapshot/restore machinery already handling fresh-device restore + account switching (`EventStoreProvider` keys the DB by userId).
- #38's surface: `apps/app/src/pages/assessments/AssessmentDetail.tsx` renders the single objective question (prompt, options, citations, warnings, polling). #39 hangs the taking interaction off this page; the #34 review treatment stays out of scope (#40).
- Baselines: app vitest ≈ 699 green, service pytest ≈ 391 green + contracts 12/12 (post-#38). WSL rule 53 quirks apply to any live run.

## Decisions log

### D-01: Server-owned `question_attempts` table (migration `025`)
**Decision:** `CREATE TABLE public.question_attempts` — `id uuid pk`, `client_attempt_id` (unique per user_id), `question_id → questions`, `assessment_id → assessments`, `user_id`, `answer jsonb NOT NULL`, `submitted_at`, `status text check (queued|graded|failed)`, `grade jsonb null` (the public QuestionGraded result), `correlation_id`, `graded_at null`. RLS: owner SELECT/INSERT by `auth.uid() = user_id`; service_role full. The learner's own answer is owner-readable (it is not hidden content — the *key* is).
**Rationale:** attempts must survive fresh devices and account switching (AC4); the durable event log is redacted-thin so the answer needs a server home; `ingestion_jobs` is the wrong shape (job ≠ attempt).

### D-02: Contract amendment — attempt submission + read routes for assessments
**Decision:** amend `openapi.yaml` (this slice owns the edit; #57's freeze ended): add `POST /v1/assessments/{assessmentId}/questions/{questionId}/attempts` (body `AttemptSubmit`, 201 → `{attemptId, questionId, status:'queued'}`, Idempotency-Key honored via `client_attempt_id` uniqueness) and `GET /v1/assessments/{assessmentId}/attempts` (200 → array of owner attempts, grade included when present). Keep `POST /v1/attempts/{attemptId}/grade` as the grading trigger (202 AsyncJob, kind=`grading`). Add fixtures + a contracts test.
**Rationale:** honors both existing contract shapes without redefining them; submission and grading stay separable so an offline client can submit-then-grade on reconnect; the practice-run route stays untouched (#44/#45).

### D-03: Objective grading is deterministic, synchronous-fast, queue-async
**Decision:** grader normalizes per objective subtype — `mcq`: answer `{index}` vs `answer_block.correctIndex`; `multi_select`: set equality of `{indices}`; `true_false`: boolean compare; `cloze`/`numeric`: trimmed case-insensitive / numeric-tolerance compare (tolerance from `answer_block.tolerance ?? 0`). Score = 1.0 exact / 0.0 otherwise. perSkill = one `PerSkillObservation` per `question.skill_tags`: `{score, correct: score ≥ 0.6}` (map #6 τ). `publicFeedback`: "Correct." / "Not correct." (deterministic; richer feedback is #50's contract). Grading runs in a **third worker arm** on a `grading` pgmq queue (`worker_main.py` arm pattern from #38 D-04), writes `question_attempts.grade/status`, and the AsyncJob `result` carries the public `QuestionGraded`.
**Rationale:** deterministic per PIPELINES ("Objective grading is deterministic"); keeps the 30 s grading timeout budget meaningful for future LLM/Judge0 families; reuses the proven queue/job/job-result machinery.

### D-04: Client local records — Dexie version(6), two non-synced tables
**Decision:** `db.version(6)` adds `assessmentAttempts: 'attemptId, questionId, assessmentId, status, submittedAt'` (local attempt log incl. answer + grade — the only local place the answer lives) and `assessmentContentCache: 'assessmentId'` (the redacted `GET /v1/assessments/{id}` response verbatim; AC1). Neither table syncs (calibrationCache precedent). New event constants `QUESTION_ATTEMPTED`/`QUESTION_GRADED` in `EventStore.ts` + payload types in `sync/types.ts` matching durable-events exactly.
**Rationale:** rule 31 version-up; events stay thin (AC2 redaction); cache mirrors the approved API shape so #40 can consume it unchanged.

### D-05: Attempt/grade event flow through the existing spine
**Decision:** on answer submit: write local `assessmentAttempts` row (status `queued`) + append `QuestionAttempted` via `useSync().logEvent` (SyncEngine queues it offline automatically). Online: POST submission (idempotent by clientAttemptId) → POST grade → poll job → on result: update local row (status `graded`, grade), append `QuestionGraded` event. Offline: flow deferred; a reconnect hook (SyncEngine status → idle + pending submissions) drains queued attempts. Retry mints a **fresh** attemptId/clientAttemptId row — history is never rewritten.
**Rationale:** map #10 semantics verbatim; reuses SyncEngine idempotency/retry rather than inventing a channel.

### D-06: Taking UI on `AssessmentDetail` — lean, honest states
**Decision:** answer controls per objective subtype (mcq = radio list reusing the #34 option-row styling vocabulary; multi_select = checkboxes; true_false = two-button toggle; cloze/numeric = text/number input), Submit with `Idempotency-Key`, then honest status line: `Queued (offline — will grade when connected)` / `Grading…` / result line `Score X · <skill> correct/not yet` (per-skill chips). Retry question button appends a fresh attempt (D-05). No drawer/split-pane chrome — that is #40's.
**Rationale:** AC2/AC3 visible without front-running #40's approved prototype surface.

### D-07: Restore + account switching ride existing machinery
**Decision:** fresh device: events restore via the existing snapshot/remote-event path; attempts refetch via `GET /v1/assessments/{id}/attempts` (D-02) into `assessmentAttempts` when the detail page loads and the local table is empty for that assessment. Account switching is already isolated (per-user Dexie naming, `EventStoreProvider`); tests mirror `SyncProvider` test patterns.
**Rationale:** no new restore channel; server rows are the durable attempt record.

## Files-touched index

| File | Change |
|---|---|
| `services/intelligence/contracts/phase2/openapi.yaml` | P1 — attempt submit/read routes + schemas (D-02) |
| `services/intelligence/contracts/phase2/fixtures/` + `tests/` | P1 — attempt + graded fixtures, contracts test |
| `apps/app/supabase/migrations/025_question_attempts.sql` | P2 — table + RLS + grants (D-01) |
| `services/intelligence/app/grading/` (new: `grader.py`, `worker.py`) | P2 — deterministic grader + grading arm |
| `services/intelligence/app/worker_main.py` | P2 — third arm wiring |
| `services/intelligence/app/routers/assessments.py` (+ new `attempts.py`) | P3 — submit/read/grade routes + job result |
| `services/intelligence/tests/` | P3 — pytest for routes + grader + worker |
| `apps/app/src/events/EventStoreProvider.tsx` | P4 — version(6) tables (D-04) |
| `apps/app/src/events/EventStore.ts`, `apps/app/src/sync/types.ts` | P4 — event constants + payload types |
| `apps/app/src/assessments/attemptClient.ts` (new), `assessmentCache.ts` (new) | P4 — submission/grade polling + cache writer |
| `apps/app/src/pages/assessments/AssessmentDetail.tsx` | P5 — taking UI + honest states (D-06) |
| `apps/app/src/pages/assessments/*.test.tsx`, `apps/app/src/events/*.test.ts`, `apps/app/src/sync/*` offline tests | P4/P6 — AC4 matrix |

## Phases

### Phase 1 — Contract amendment (openapi + fixtures + contracts test) `☐ Not started`
1. Add routes per D-02; `QuestionGradedResult` reuses the API `QuestionGraded` schema (with perSkill).
2. Fixtures: `attempt-submit.json`, `attempt-graded.json`; extend `contracts/phase2/tests/test_contracts.py`.
3. Update the local mirror `.work/specs/phase2-tickets/07-…md` only if the ACs' wording changes (they do not).
**Verification:** `uv run pytest services/intelligence/contracts/phase2/tests -q` green; `openapi.yaml` lint if configured.

### Phase 2 — Migration 025 + grading domain + worker arm `☐ Not started`
1. Migration per D-01 (follow the 018/022 grant style; RLS `auth.uid()`).
2. `app/grading/grader.py`: pure `grade_question(question_row, answer) → QuestionGraded-public` + per-subtype normalizers (D-03) — unit-test heavily here (TDD seam).
3. `pgmq.create('grading')` in migration; `app/grading/worker.py` arm polls, locks attempt (`status='queued'`), grades, writes result; job lifecycle via existing `ingestion_jobs` kind='grading'.
4. Wire the third arm in `worker_main.py` (mirror generation arm construction, `GRADING_*` env optional).
**Verification:** `uv run pytest services/intelligence/tests -q` green (new grader + worker tests); migration applies clean on the dev Supabase (rule 36 discipline; dry-run first per rule 80 if scripted).

### Phase 3 — Service API routes `☐ Not started`
1. `POST /v1/assessments/{assessmentId}/questions/{questionId}/attempts` (validate ownership + question format is objective; 409 on duplicate clientAttemptId → return existing attemptId); `GET /v1/assessments/{assessmentId}/attempts`; `POST /v1/attempts/{attemptId}/grade` (enqueue grading job, 202 AsyncJob).
2. Job `result` = public QuestionGraded; ensure serialization never touches anything but `grade` public fields (AC3 grep in P6).
**Verification:** pytest (route matrix incl. 401/403/404/409), redaction spot-check in responses.

### Phase 4 — Client data layer (TDD seam) `☐ Not started`
1. Dexie version(6) + stores (D-04); `QUESTION_ATTEMPTED`/`QUESTION_GRADED` constants + payload types.
2. `attemptClient.ts` (narrow DI interfaces like `materialClient.ts`; typed errors; idempotency key; job polling) + `assessmentCache.ts` (cache writer reading the redacted detail response).
3. Offline queue + reconnect drain (D-05) hooking SyncEngine status.
**Verification:** vitest for Dexie stores (open/close, version-upgrade from seeded v5 DB), event payload shape vs durable-events schema, offline append→queue→drain, retry-mints-fresh-attempt, account-switch isolation (rule 32/34 patterns).

### Phase 5 — Taking UI `☐ Not started`
1. Answer controls + submit + status/result line + retry per D-06; wire `assessmentContentCache` as the offline read source (AC1) — detail page renders from cache when offline.
**Verification:** vitest component tests (mock supabase + clients, mirror `AssessmentDetail.test.tsx`); typecheck/lint green.

### Phase 6 — Verification sweep + live pass `☐ Not started`
1. `pnpm typecheck` + `pnpm lint` + `pnpm --filter app test`; `uv run pytest`; contracts tests.
2. Redaction grep: no `answer_block`/`correctIndex`/`correct_index` in anything client-side or in cached payloads (`apps/app/src/`, excluding service mirrors).
3. Live (rule 10/53): restart full-app, take the #38 question online → graded result; toggle offline (devtools) → queue → reconnect → auto-grade; second device profile → restore; account switch isolation. Screenshots to `plan/evidence/`.
4. AC tick-down in VERIFICATION.md; then wayfinder resolution (comment + close #39 + map #4 line).

## Out of scope
- Written/coding grading (#41/#42), the #34 review surface (#40), mastery/BKT update (#43), guide/reveal, Socratic anything.
- Any change to `public.events` schema or SyncEngine's wire protocol.
- Non-objective attempt answers beyond storing them opaquely (they are #41/#42 concerns).

## Open questions
- None blocking. If the `grading` queue name or AsyncJob result placement contradicts the live 018–024 migrations during P2, STOP and surface (contract-freeze discipline).
