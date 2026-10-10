# PLAN - assessment delete (hover X + confirm modal + backend delete job)

Status: planning only, no source edits in this session.
Spec: `.work/specs/issues/assessment-delete.md`.
Prototype: `plan/prototype-delete-assessment.html` (open in a browser, hover a card).
UX rationale: `research/ux-assessment.md` (Operate mode, Marginalia preserved).

## P0 - decisions to lock before code (15 minutes)

1. Endpoint shape: `POST /v1/assessments/{id}/delete` returning `202` + AsyncJob.
   Reason: the user asked for a job; `POST .../regenerate` (`routers/assessments.py:253`)
   is the exact precedent (same file, same AsyncJob shape, same Idempotency-Key
   header). A sync `DELETE` looks smaller but cannot run on the caller token:
   migration `018` grants `authenticated` only `SELECT, INSERT` on `assessments`
   and no write at all on `questions` / `question_attempts`, so any delete path
   needs a privileged arm regardless. The job reuses `GET /v1/jobs/{id}` polling
   instead of inventing a status channel.
2. Tombstone event: `AssessmentDeleted` with payload `{ assessmentId }`.
   Reason: keeps `AssessmentCreated` history additive (rule 30) and reuses the
   rule-42 "widen the pointer, not the reader" discipline (optional-field style
   fallback, no Dexie version bump).
3. Worker reuses the existing generation/grading worker process (new queue
   `assessment_delete`, same `WorkQueue` + `TelemetrySink` pattern), not a new
   service. Reason: one deploy, one log contract, orphan-message guards already
   proven there.

## P1 - backend: enqueue RPC + endpoint + worker (the load-bearing slice)

1. New migration `034_assessment_deletion.sql` (never touch applied `018`-`033`):
   - `pgmq.create('assessment_delete')` (pattern `018:105`).
   - `enqueue_assessment_deletion(p_assessment_id, p_job_id, p_correlation_id)`
     `SECURITY DEFINER`: verify owner via `assessments.user_id = auth.uid()`
     (pattern `018:128`), else raise `P0002` so the API maps to `not_found`
     (cross-owner reads as missing, never "forbidden").
     Insert `ingestion_jobs` row `kind='deletion'` with attempt `max+1` under the
     `032` advisory lock (rule 42: keep the lock, else concurrent deletes race
     the `UNIQUE (kind, material_id, attempt)` constraint from `018:20`).
     `pgmq.send` the `{jobId, assessmentId, correlationId}` message, return the
     AsyncJob JSONB (pattern `018:149`).
   - `GRANT EXECUTE ... TO authenticated`, `REVOKE ALL ... FROM PUBLIC`
     (pattern `018:161`).
2. `routers/assessments.py`: `POST /v1/assessments/{assessmentId}/delete`.
   Guards: missing row -> `not_found`; already-deleting (open deletion job for
   the id) -> `conflict` (idempotent second click); `generating` rows allowed
   with the modal copy warning the queued message dies too. Every return goes
   through `service_error` with `request_id` (rule 17).
3. `userrest.py`: `enqueue_deletion(assessment_id, job_id, correlation_id)`
   mirroring `enqueue_generation` (`userrest.py:120`), same
   `provider_unavailable` retryable mapping on 5xx.
4. Worker arm (generation worker file or a sibling `deletion/` module reusing
   its `GenerationRepo`/`WorkQueue` seams): poll `assessment_delete`, then with
   the service role `DELETE FROM assessments WHERE id=...` (cascades wipe
   `questions` via `018:61`, `question_attempts` via `025:19`, `jev_review_flags`
   via `033:34` - no FK work needed), then mark the job `succeeded` in the same
   transaction where the repo supports it. Terminal-guard first: if the row is
   already gone, archive the message (pattern `worker.py:333` orphan archive;
   this exact crash - 276 redeliveries after a cleanup deleted an in-flight
   assessment - is documented at `worker.py:338`). Log every line with
   `trace_id` via the shared `configure_logging()` (rule 17), never `print`.
5. Backend tests (mirror the assessment router suite): owner deletes own row +
   dependents gone; cross-owner gets `not_found`; double-submit gets `conflict`;
   orphan message archives instead of redelivering; `request_id` present on
   error bodies. Dry-run any operator script per rule 80 before spending budget.

## P2 - client: typed delete call (rule 22 pattern, no new fetch logic)

1. `assessmentClient.ts`: `deleteAssessment(assessmentId): Promise<AsyncJob>`
   shaped exactly like `regenerateAssessment` (`:253`): `POST` with
   `Content-Type`, fresh `X-Request-ID`, fresh `Idempotency-Key`, wrapped in
   `run()` so normalization stays centralized. Map post-delete `GET` 404 to
   `not_found` (deleted, not retryable) at the hook layer, never as a raw 404.
2. `AssessmentClientLike` + `fakeAssessmentClient.ts` gain the method the same
   day (contract + fake ship together, per the DI precedent in `types`/tests).
3. Client tests: `AbortError`-named subclass -> `timeout`, rejected `TypeError`
   -> `network` retryable, unknown non-Error -> `unknown` (rule 22 trio); 409
   body `conflict` preserved; `requestId` surfaced on the thrown error (rule 17).

## P3 - UI: corner X + confirm modal + tombstone wiring (refinement, not redesign)

1. `library.css`: `.library-card-delete` block modeled on `dir-detach`
   (`roadmap.css:811`): absolute top-right, rust-filled circle, paper `times`
   glyph, `opacity:0` resting, revealed on card `:hover`, card `:focus-within`,
   control `:focus-visible`. Mandatory companion rule: `position:relative;
   z-index:1` on the button, because `.library-title-link::after`
   (`library.css:52`) is a stretched link covering the whole card (`inset:0`)
   and will swallow every click without it (same fix as
   `.library-card-actions` at `library.css:89`). Coarse-pointer 44px target
   (tokens rule `components.css:87`), `prefers-reduced-motion` kills the
   transition (library.css `:130` precedent).
2. `LibraryCards.tsx` `AssessmentCard`: new `onDelete(assessmentId)` +
   `deleting: boolean` props. Button `aria-label="Delete {title} assessment"`,
   `aria-busy` + `GeneratingDots` + `role="status"` "Deleting..." while the job
   runs, X disabled in that window (no double-submit). Title gets
   `padding-right` so long titles never slide under the X. `PracticeRunCard`
   untouched (runs die by pointer-expiry, never by cascade - rule 42).
3. New `AssessmentDeleteDialog.tsx` beside the cards (props: `open`, `target`
   `{title, meta, generating}`, `confirming`, `error`, `onCancel`,
   `onConfirm`): overlay + shell copied from `ProgressLabModal.css:6`
   (`fixed inset-0`, `place-items:center`, `rgba(42,31,24,.58)` + blur, 16px
   safe-area padding) with `width:min(440px,100%)` instead of the Lab shell;
   focus trap + Esc + backdrop-click + opener restore copied from
   `ProgressLabModal.tsx:188`; initial focus on Cancel, never on Delete.
   Copy from the spec (user words first, what-goes-away list, generating
   warning line). Buttons reuse `.btn-secondary` + `.btn-destructive`
   (`components.css:70`) - no new variants.
4. `AssessmentLibrary.tsx`: owns dialog state (`pendingId`), calls
   `assessments.deleteAssessment`, polls `getJob` on the hub's 3s cadence
   (reuse `POLL_INTERVAL_MS` discipline, poll the one job id only), then on
   success appends `AssessmentDeleted` to the EventStore, evicts the Dexie
   `assessmentContentCache` + `assessmentAttempts` rows for the id (advisory,
   cache-miss-tolerant like `seedFromCache`), and drops the pointer from local
   state. Failure keeps the card and renders the typed error inline via
   `logger.warn` (rule 17: `logger`, never `console`).
5. `libraryModel.ts`: `listAssessmentPointers` masks ids present in an
   `AssessmentDeleted` set (same newest-wins + materialId-filter shape);
   `buildPracticeRunRow` needs no change (missing envelope already reads as
   `unavailable`, which is the specified run-history outcome). No Dexie version
   bump (rule 31 untouched).
6. UI tests (mirror `AssessmentLibrary.test.tsx` + `libraryModel.test.ts`):
   X present on all four row states; hover/focus reveal assertions via
   computed style or class contract; dialog trap/Esc/backdrop/focus-restore;
   confirm disabled while in flight; tombstone masks the pointer; run rows
   referencing the id render `unavailable`, not crash; live spec follows rule
   16 (scoped locators, ready-state waits, shared-account cleanup, own
   `test.setTimeout` only if it uploads fixtures - this one needs none).

## P4 - verification (smallest relevant check first, per repo habit)

1. `pnpm --filter app test` for the touched suites, then `uv run pytest` for
   the service slice, then `pnpm typecheck` + `pnpm lint`.
2. Live: `./full-app start full`, restart after edits (rule 53 stale-Vite),
   smallest Playwright delete spec first at 1280 + 375, zero console errors,
   `X-Request-ID` from the typed error joined via `./full-app logs
   intelligence --grep <id>` (rule 17 join check).
3. Record evidence under `active/assessment-delete/plan/evidence/` and an
   AC1-AC6 matrix in `plan/VERIFICATION.md` (precedent:
   `assessment-library-cache/plan/VERIFICATION.md`).

## Edge cases the plan already answers

- Delete while `generating`: allowed; worker orphan guard archives the
  generation message; modal says so upfront.
- Delete while grading in flight: grading completion RPC targets a gone
  attempt row; worker treats it as terminal (same orphan discipline), no retry
  storm.
- Double click / retry after success: second call answers `conflict` or
  replays the same job id via `Idempotency-Key`; UI disables the confirm while
  `confirming`.
- Cross-user: owner check inside the RPC; wrong owner sees `not_found`.
- Offline: confirm is online-only; offline click surfaces the typed `network`
  error honestly and keeps the card (no fake removal).
- Account switch mid-delete: flow recreation precedent in `useLibraryRows.ts:110`
  (state resets on store change) covers it; the job id is re-polled only while
  the owning store is active.

## Files the build will touch (nothing else)

- Backend: `apps/app/supabase/migrations/034_assessment_deletion.sql` (new),
  `services/intelligence/app/routers/assessments.py`,
  `services/intelligence/app/userrest.py`, worker arm + tests.
- Frontend: `apps/app/src/assessments/assessmentClient.ts` (+ fake + tests),
  `apps/app/src/library/LibraryCards.tsx`, `apps/app/src/library/library.css`,
  `apps/app/src/library/AssessmentDeleteDialog.tsx` (new),
  `apps/app/src/pages/assessments/AssessmentLibrary.tsx`,
  `apps/app/src/library/libraryModel.ts` (+ tests), live spec under `e2e/`.
- Explicitly not touched: `EventStore.ts` kinds file except one added const,
  Dexie versions, practice run model, material client, design tokens.
