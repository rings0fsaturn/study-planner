# Assessment delete (card hover X + confirm modal + backend delete job)

Status: spec (planning only, no code yet).
Task folder: `.work/active/assessment-delete/`.
Mode: Operate (library hub task UI, Marginalia world preserved).

## Problem

The `/assessments` hub has no way to remove an assessment.
Failed, stale, or duplicate generations accumulate with no honest exit.
The existing card (`apps/app/src/library/LibraryCards.tsx:43 AssessmentCard`)
only offers Retry / Start-new-run in terminal states.

## UX contract

1. Every `AssessmentCard` carries a delete affordance: a red `X` (`times`)
   button in the card corner, hidden until card hover or control focus
   ( precedent: `apps/app/src/roadmap/RoadmapCalendar.tsx:639` +
   `apps/app/src/roadmap/roadmap.css:811 dir-detach` ).
2. The control is always in the DOM (touch + keyboard reachable), visually
   revealed on `:hover` / `:focus-visible` / `:focus-within`, never
   `display:none` toggled by JS hover state.
3. Click opens a centered confirm modal: title `Confirm delete this
   assessment?`, body names the assessment (material title + family + date)
   and lists what goes away (questions, attempts incl. local rows, practice-run
   references become unavailable, cached envelope evicted).
4. Modal is `role="dialog" aria-modal="true"`, focus-trapped, Esc + backdrop
   click cancel, destructive confirm is NOT autofocused (precedent:
   `apps/app/src/components/ProgressLabModal.tsx:188` focus/ trap/ restore).
5. Confirm submits one backend delete job; the card enters a `deleting` state
   (dots + disabled X, `aria-busy`, `aria-live` status) until the job resolves.
6. Mobile (375px): X is smaller but always reachable; modal is full-width
   sheet with 16px margins, no clipped actions. Desktop (1280px): modal
   centered, max-width ~440px, Marginalia `--shadow-modal`.
7. Copy stays honest: `generating` rows warn deletion also drops the queued
   generation message (worker already archives orphan messages, see
   `services/intelligence/app/generation/worker.py:333`); `failed` rows keep
   the existing Start-new-run path untouched.

## Backend contract

1. New owner-scoped endpoint `POST /v1/assessments/{id}/delete` (name TBD in
   plan; alternatives `DELETE /v1/assessments/{id}` evaluated in plan).
   Returns `202` + AsyncJob, mirroring `POST .../regenerate`
   (`services/intelligence/app/routers/assessments.py:253`).
2. Enqueue is DB-atomic via a new `enqueue_assessment_deletion` RPC
   (pattern: `enqueue_assessment_generation`, migration `018`), owner-checked
   with `auth.uid()`, advisory lock per rule 42 where needed.
3. The worker deletes the assessment row through the service role; existing
   `ON DELETE CASCADE` removes dependents with no new FK work:
   `questions` (018), `question_attempts` (025), `jev_review_flags` (033).
   Generation/grading queue messages for the id become orphans and are
   archived by the existing terminal guards (generation worker `:369`
   re-entry guard + `:333` orphan archive; grading arm same pattern).
4. `GET /v1/assessments/{id}` after delete answers `not_found`; the client
   treats that as deleted (not retryable), evicts the Dexie envelope +
   local attempts, and appends the local tombstone event (see plan).
5. Errors reuse `service_error` with `request_id` (rule 17) and typed
   `AssessmentServiceError` codes (rule 22): `not_found`, `conflict` (already
   deleting), `unauthorized`, retryable `service`/`network`/`timeout`.
6. No migration rewrites an applied migration (rule 35); new RPC + any job-kind
   support land in a new migration with RLS owner predicates on read/write.

## Local-first contract

- Assessments are server-owned; the local `AssessmentCreated` pointer is the
  durable history (rule 30, additive events, never rewritten).
- Deletion appends a new tombstone event (e.g. `AssessmentDeleted`) rather
  than editing the pointer; `listAssessmentPointers` + `buildAssessmentRow`
  mask tombstoned ids with a legacy fallback (rule 42: widen the pointer,
  not the reader; no Dexie version bump).
- Practice runs are pointer-scoped (rule 42): runs referencing a deleted
  assessment resolve it lazily as missing and render `unavailable` history,
  never cascade-delete the run.
- Dexie `assessmentContentCache` + `assessmentAttempts` rows for the id are
  evicted on confirmed delete (precedent: cache is advisory, rule text in
  `apps/app/src/events/EventStoreProvider.tsx:57`).

## Acceptance

- AC1: hover/focus reveals a red X on every assessment card state at 1280
  and 375 with no layout shift; keyboard-only flow reaches it.
- AC2: confirm modal is centered, trapped, Esc/backdrop-safe, honest copy,
  and focus-restoring; destructive button never autofocused.
- AC3: confirm mints one request id reused across retries, surfaces it on
  the typed error, and joins frontend-to-backend logs (rule 17).
- AC4: backend deletes assessment + questions + attempts + flags in one
  owner-scoped path; cross-owner delete answers `not_found`; double-submit
  is idempotent (second confirm = `conflict` or idempotent replay).
- AC5: library repaints without the deleted row (tombstone masked, cache
  evicted); practice history referencing it stays readable as unavailable.
- AC6: unit + live E2E green (library delete spec, shared-account cleanup
  per rule 16), no console errors at both viewports.

## Out of scope

- Bulk delete, undo window, material delete changes (`deleteMaterial` stays
  as-is), run-pointer deletion, new design language (Marginalia tokens only).

## References

- Cards: `apps/app/src/library/LibraryCards.tsx`, hub:
  `apps/app/src/pages/assessments/AssessmentLibrary.tsx`, rows:
  `apps/app/src/library/useLibraryRows.ts` + `libraryModel.ts`.
- Client: `apps/app/src/assessments/assessmentClient.ts` (rule 22 pattern).
- Backend: `services/intelligence/app/routers/assessments.py`,
  `app/userrest.py`, `app/generation/worker.py`, `app/routers/jobs.py`.
- Precedents: roadmap `dir-detach` (`roadmap.css:811`), `ProgressLabModal`
  focus/backdrop contract, `deleteMaterial` in `materialClient.ts:418`.
- Cascade base: migrations `018` + `025` + `033` (all `ON DELETE CASCADE`).
