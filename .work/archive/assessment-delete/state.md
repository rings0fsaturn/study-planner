# State – assessment-delete
_Spec: .work/specs/issues/assessment-delete.md · Plan: .work/archive/assessment-delete/plan/ · STATUS row: assessment-delete · Status: done · Updated: 2026-10-10_

## Current state & next
- P3 complete 2026-10-10: UI tests written (new `AssessmentDeleteDialog.test.tsx` + `AssessmentLibrary.test.tsx` delete-flow suite + hook/model/client additions); 3-review round run (open-code-review-delegate + thermo-nuclear), all findings fixed, verification re-review APPROVE-WITH-MINORS with the 4 residual unpinned LOWs now pinned by tests.
- Focused delete suites 113 pass; full app suite 1132 pass with only the 2 pre-existing `src/dev/seedTestData.test.ts` TZ failures (confirmed at HEAD via a clean worktree); `pnpm --filter app typecheck` + `lint` clean.
- P4 complete 2026-10-10: migration 034 pushed + live-verified; live delete spec 2/2 green at 1280 + 375 with request-id join; evidence + AC1-AC6 matrix in `plan/VERIFICATION.md`; both P4 reviews PASS; full app 1133 pass with only the 2 pre-existing TZ flakes; second-X phase guard + pinning test fixed in scope.
- Next: wrap (move to archive, flip STATUS to Done). No code work remains.

## Done so far
- 2026-10-10 planning: spec, UX research, prototype, PLAN.md (P0-P4); P0 decisions locked exactly as planned.
- 2026-10-10 P1 migration: `034_assessment_deletion.sql` - kind CHECK extended with 'deletion' (live name `ingestion_jobs_kind_check` verified via `supabase db query`), partial unique index `ingestion_jobs_open_deletion_unique` (second confirm -> 23505 -> PostgREST 409), `pgmq.create('assessment_delete')`, owner-checked `enqueue_assessment_deletion` (P0002, advisory lock, attempt max+1, row-shape JSONB, REVOKE/GRANT).
- 2026-10-10 P1 API: `POST /v1/assessments/{assessmentId}/delete` (202 AsyncJob), `UserScopedClient.enqueue_deletion` (403/404 -> not_found, 409 -> conflict, >=400 -> retryable provider_unavailable).
- 2026-10-10 P1 worker: `app/deletion/worker.py` (poll, service-role DELETE, job running -> succeeded, archive; missing row = 204 = success) + `app/ingestion/arm.py` shared `run_assessment_arm_once`/`fail_job`; `worker_main` deletion thread.
- 2026-10-10 P1 review round 1 APPROVE-WITH-MINORS; findings 1-3 + 5 fixed (repo-level idempotency test, `trace_id` on all arm log lines, shared `run_assessment_arm_once`, malformed-message job failure); 159 focused tests green, ruff clean.
- 2026-10-10 P2 client: `types.ts` `JobKind` + 'deletion'; `assessmentClient.ts` `deleteAssessment` + Http 404 -> non-retryable `not_found`; `fakeAssessmentClient.ts` `deleteAssessment` + `scriptDelete`; client tests 27, contract suite 33.
- 2026-10-10 P2 review round (code-reviewer + thermo-nuclear) fixed: `errorBody` prefers the service body `message` for 404/409, extracted `private post<T>`, a real wire request-id reuse test, Idempotency-Key length assert, and a contract test pinning the openapi/schema kind enums.
- 2026-10-10 P3 model + data layer: `ASSESSMENT_DELETED` const, `AssessmentDeletedPayload`, `deletedAssessmentIds` + pointer masking; `attemptFlow.evictAssessment`; `useLibraryRows` masks run-row envelopes for tombstoned ids, exports `POLL_INTERVAL_MS`, returns `evictAssessment`.
- 2026-10-10 P3 UI code: `AssessmentDeleteDialog.tsx` (portal overlay, focus trap/Esc/backdrop/opener restore, initial focus Cancel, confirming locks both buttons, `role=alert` error, generating warning); `library.css` `.library-card-delete` (absolute top-right, rust circle, hover/`:focus-within`/`:focus-visible` reveal, `z-index: 1`, coarse-pointer 44px hit area, reduced-motion off) + dialog styles; `LibraryCards.tsx` `AssessmentCard` `onDelete`/`deleting` props + exported `assessmentMeta`; `AssessmentLibrary.tsx` owns the delete flow.
- 2026-10-10 P3 UI tests: `AssessmentDeleteDialog.test.tsx` (10: accessible body + copy, closed/null, scroll lock, Tab trap incl. confirming-with-disabled-buttons shell focus, Esc/backdrop/inner click, generating warning + error alert, confirming locks, opener restore via activeElement and via explicit prop); `AssessmentLibrary.test.tsx` delete-flow describe (X on ready/generating/failed/unavailable + class contract, rest-hidden opacity + stylesheet reveal contract, dialog open/focus Cancel, cancel + focus restore without pre-focus, success tombstone + cache eviction + row drop, typed conflict inline, in-flight lock, failed job, non-retryable poll, retry after inline error, transient then success, overlap guard one-request/one-tombstone, enqueue not_found finalize, record-failure copy, account-switch drop); `libraryModel.test.ts` mixed-run tombstone cases; `useLibraryRows.test.tsx` 404 tombstone+evict+mask and `getAssessment` never called for tombstoned run ids; `assessmentClient.test.ts` Idempotency-Key reuse + 404 message/fallback + `afterEach unstubAllGlobals`.
- 2026-10-10 P3 review round (3 parallel reviewers: UI slice, client+model slice, thermo-nuclear structural) all CHANGES-REQUESTED; every critical/high/medium finding fixed; re-review APPROVE-WITH-MINORS, then the 4 residual unpinned behaviors pinned by their own tests.
- 2026-10-10 P4: second-X phase guard in `handleDeleteOpen` + pinning test (27/27); 247 focused app tests, 135 backend tests, typecheck + lint clean; migration 034 pushed + live-verified; live spec `e2e/assessment-delete-live.spec.ts` 2/2 green with request-id join; `plan/VERIFICATION.md` AC1-AC6 all PASS; guard-fix + live-spec reviews PASS; full app 1133 pass + 2 pre-existing TZ flakes.

## Flow trace
1. Card X (`onDelete(assessmentId, opener)`) -> page opens the dialog with the X as the opener and snapshots the row (`title`/`meta`/`generating`) into `DeleteFlow.target`.
2. Confirm -> (P2) typed `deleteAssessment` -> `POST /v1/assessments/{id}/delete`; a late response after an account switch is dropped by the initiating-store guard.
3. Router `get_assessment` guard (404 on missing/foreign) -> `enqueue_assessment_deletion`: owner check P0002, advisory lock per material, attempt max+1, INSERT kind='deletion' (partial unique index makes a concurrent second open delete 23505 -> 409), `pgmq.send('assessment_delete', {jobId, assessmentId, correlationId})`.
4. `DeletionWorker` polls via shared `run_assessment_arm_once`; service-role DELETE; cascades wipe `questions` (018), `question_attempts` (025), `jev_review_flags` (033); job running -> succeeded; message archived.
5. Generation/grading messages for the deleted id become orphans and archive via their terminal guards (generation `worker.py:330-353`; grading via the shared runner).
6. Page polls `GET /v1/jobs/{id}` every 3 s with an in-flight guard; `succeeded` appends `AssessmentDeleted`, evicts the Dexie envelope + attempts + in-memory copies, and closes. Terminal statuses (`failed`/`cancelled`/`partial`) and non-retryable typed poll errors stop the loop with an error copy; an enqueue `not_found` finalizes locally (already deleted elsewhere).
7. `listAssessmentPointers` masks tombstoned ids; `uniqueIds` excludes them from the fetch/poll union; `useLibraryRows` nulls tombstoned envelopes for run rows, so practice history reads `unavailable`, never resurrects.
8. A `not_found` from any hydration/poll read is server-authoritative: `hydrateEnvelopes` evicts the cached envelope + local attempts, appends `AssessmentDeleted`, and drops the id from in-memory state (cross-device deletes self-heal).
9. `buildPracticeRunRow` treats a tombstoned ungraded problem as terminal-missing: a partially deleted run reads `unavailable`, never a forever-`generating` poll loop.

## Files affected
- `.work/specs/issues/assessment-delete.md`, `plan/PLAN.md`, `plan/prototype-delete-assessment.html`, `research/ux-assessment.md` - task contract + planning deliverables.
- `apps/app/supabase/migrations/034_assessment_deletion.sql` - new migration (kind CHECK, open-job unique index, queue, enqueue RPC).
- `services/intelligence/app/deletion/worker.py` (+ `__init__.py`) - new deletion arm.
- `services/intelligence/app/ingestion/arm.py` - new shared arm fault-policy loop.
- `services/intelligence/app/grading/worker.py` - `run_once` delegates to the shared runner.
- `services/intelligence/app/ingestion/repository.py` - `delete_assessment`.
- `services/intelligence/app/userrest.py` - `enqueue_deletion`.
- `services/intelligence/app/routers/assessments.py` - delete endpoint.
- `services/intelligence/app/worker_main.py` - deletion factory + thread.
- `services/intelligence/contracts/phase2/openapi.yaml`, `async-job.schema.json`, `tests/test_contracts.py` - delete operation + kind enum 'deletion' + parity test.
- `services/intelligence/tests/test_deletion_worker.py`, `test_repository.py`, `test_assessments_api.py`, `test_worker_main.py` - P1 suites.
- `apps/app/src/assessments/types.ts` - `JobKind` + 'deletion'.
- `apps/app/src/assessments/assessmentClient.ts` - `deleteAssessment`, `private post<T>`, `errorBody`, 404 branch.
- `apps/app/src/assessments/assessmentClient.test.ts` - delete/404/conflict/request-id/Idempotency-Key/afterEach-unstub tests.
- `apps/app/src/assessments/testing/fakeAssessmentClient.ts` - `deleteAssessment` + `scriptDelete`.
- `apps/app/src/assessments/attemptFlow.ts` - `evictAssessment` (cache + attempts deletes in parallel).
- `apps/app/src/events/EventStore.ts` - `ASSESSMENT_DELETED` const (only added const; Dexie versions untouched).
- `apps/app/src/sync/types.ts` - `AssessmentDeletedPayload`.
- `apps/app/src/library/libraryModel.ts` (+ test) - `deletedAssessmentIds`, pointer masking, tombstoned run problem = terminal-missing.
- `apps/app/src/library/useLibraryRows.ts` (+ test) - tombstone exclusion from `uniqueIds`, hydration-404 tombstone + evict + drop, `eventStore` into `hydrateEnvelopes`, terminal `not_found` logging, exported `POLL_INTERVAL_MS`, `evictAssessment`.
- `apps/app/src/library/LibraryCards.tsx` - `AssessmentCard` X button with opener element, `onDelete`/`deleting`, exported `assessmentMeta`.
- `apps/app/src/library/library.css` - `.library-card-delete` + assessment-delete dialog styles.
- `apps/app/src/library/AssessmentDeleteDialog.tsx` (+ new test) - portal confirm dialog, zero-focusable Tab fallback, explicit opener.
`apps/app/src/pages/assessments/AssessmentLibrary.tsx` (+ test) - `DeleteFlow` phase union, ownership guard, guarded poll, finalize/error copies, second-X in-flight guard (P4).
- `e2e/assessment-delete-live.spec.ts` (new) - live delete round trip at 1280 + 375, request-id join, window cleanup.
- `plan/VERIFICATION.md` (new) - AC1-AC6 matrix, all PASS; `plan/evidence/` - desktop + mobile delete screenshots.

## Pitfalls & rules
- Must keep `AssessmentCreated` history additive; deletion is a tombstone event (rule 30). No Dexie version bump (rule 42); `EventStore.ts` gained one const only.
- New migration only; never rewrite applied 018-033 (rule 35). Migration 034 is pushed to the hosted DB (2026-10-10, verified live).
- Live kind CHECK name is `ingestion_jobs_kind_check`; `DROP IF EXISTS` + re-ADD keeps it authoritative.
- PostgREST mapping relied on: P0002 -> 404 (`not_found`), 23505 -> 409 (`conflict`), `Prefer: return=minimal` DELETE -> 204 even for 0 rows (idempotent orphan).
- `.library-card-delete` needs `z-index: 1` or the title link's stretched `::after` (`inset: 0`) swallows every click; `fireEvent.click` bypasses hit testing, so the live spec must click the X on a card with a title link to prove it.
- The dialog must keep `onCancel` identity-stable (page `useCallback`); with both buttons disabled while confirming the trap focuses the dialog shell via `tabIndex={-1}` (zero-focusable fallback).
- The page passes the X explicitly as the dialog opener; browsers such as Safari do not focus a button on mouse click, so `document.activeElement` alone is not enough.
- The delete-job poll needs its own in-flight guard (hook precedent) or a slow `getJob` overlaps ticks and can double-append the tombstone; enqueue can resolve after an account switch, so the initiating-store guard is mandatory.
- Hydration `not_found` is server-authoritative: tombstone + evict + drop, or a seeded cache resurrects a ghost ready row that cannot be deleted.
- `uniqueIds` must exclude tombstoned run-referenced ids, and `buildPracticeRunRow` must read a tombstoned problem as terminal-missing, or deleted problems poll/render forever.
- jsdom never matches `:hover`/`:focus-within`; hover-reveal coverage asserts the class contract + stylesheet selectors and the rest opacity via a real-stylesheet injection.
- Hook tests: wait for `loading` done first, then wait for the masked state; the pre-hydration empty row list also satisfies `assessments === ''` and would race the tombstone assertion.
- Rule 17: poll/enqueue each carry their own `X-Request-ID`; the typed error surfaces it. Rule 22: client errors stay typed; the AbortError/TypeError/unknown trio is re-tested for delete.

## Decisions in force
- Decided `POST /v1/assessments/{id}/delete` + 202 AsyncJob because the user asked for a job and regenerate is the precedent (2026-10-10).
- Decided conflict via partial unique index `ingestion_jobs_open_deletion_unique` (DB-atomic, race-free) instead of a router pre-check (2026-10-10).
- Decided shared `run_assessment_arm_once` for the retry/terminal policy; generation keeps its own loop (2026-10-10, review finding).
- Decided one shared `private post<T>` for every POST route and 404/409 messages prefer the service body `message` (2026-10-10, P2 reviews).
- Decided tombstone masking feeds `listAssessmentPointers`, the fetch/poll union, and run-row envelopes through `deletedAssessmentIds` (2026-10-10).
- Decided a hydration/poll 404 is a server-authoritative delete: tombstone + evict + drop in `hydrateEnvelopes`; enqueue `not_found` finalizes the same way (2026-10-10, P3 review).
- Decided the page owns a `DeleteFlow` phase union (idle/confirming/submitting/polling/error) as the single source of the dialog/card affordances (2026-10-10, thermo review).
- Decided the delete-job poll stops on terminal statuses (incl. `partial`) and non-retryable typed errors, with an in-flight guard (2026-10-10, P3 review).
- Decided a tombstoned ungraded problem makes a partially deleted run `unavailable`, never `generating`, while a live generating sibling still reads `generating` (2026-10-10, P3 review).
- Decided the dialog takes an explicit `opener` element (fallback to `document.activeElement`) because click-focus is browser-dependent (2026-10-10, P3 review).
- Decided to keep `AssessmentDeleted` on local `eventStore.append` (the `AssessmentCreated` precedent) rather than `logEvent`; cross-device ghosts self-heal via hydration 404 (2026-10-10).

## Open
- 2026-10-10 P4 done: wrap only (move to archive, flip STATUS).
- Deferred review suggestions (recorded, not blocking): extract a shared dialog-focus hook from `ProgressLabModal` + `AssessmentDeleteDialog`, and a shared interval-poll hook from `useLibraryRows` + the page; the two call sites have divergent contracts today, so the minimum guards stand until a third consumer appears.
- Known limitation: `AssessmentDeleted` is not queued through `SyncEngine.logEvent`, so it reaches the cloud only via a later full snapshot; a warm device with a stale envelope self-heals on the next hydration 404 (the harmful direction is covered).
- Pre-existing suite failures at HEAD, separate fix task: app `src/dev/seedTestData.test.ts` x2 (runtime `process.env.TZ` mutation does not apply inside vitest worker threads), `test_retrieval_probe.py` x2 (root pytest `pythonpath`), 5 calibration golden drifts in `test_v1_integration.py`.
