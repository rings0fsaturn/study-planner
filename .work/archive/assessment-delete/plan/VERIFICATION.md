# Verification – assessment-delete (P4)

_Plan: `plan/PLAN.md` · Spec: `.work/specs/issues/assessment-delete.md` · Updated: 2026-10-10_

## Gates

- [x] P4.1 focused app suites green. Evidence: `pnpm --filter app test --run src/library/ src/assessments/ src/pages/assessments/ src/pages/practice/PracticeRun.test.tsx` → 15 files, 247 passed. Includes the new second-X guard test.
- [x] P4.1 backend slice green. Evidence: `uv run pytest` on `test_deletion_worker.py test_assessments_api.py test_repository.py test_worker_main.py contracts/test_contracts.py` → 135 passed.
- [x] P4.1 typecheck + lint clean. Evidence: `pnpm --filter app typecheck` (tsc clean); `pnpm --filter app lint` (eslint clean).
- [x] P4.2 migration 034 pushed + live-verified. Evidence: `db push` applied `034_assessment_deletion.sql`; `schema_migrations` holds `034`; live `ingestion_jobs_kind_check` includes `deletion`; `ingestion_jobs_open_deletion_unique` present; `enqueue_assessment_deletion(text, text, text)` signature confirmed.
- [x] P4.3 live delete spec green at both viewports. Evidence: `e2e/assessment-delete-live.spec.ts --project=app --workers=1` → 2 passed (desktop 44.9 s, phone 32.1 s), zero console errors, request-id join asserted in-run for both.
- [x] Full app suite: no regressions beyond the 2 pre-existing TZ flakes. Evidence: `pnpm --filter app test --run` → 1133 passed, 2 failed, both `src/dev/seedTestData.test.ts` (browser-local date key / local-today booking; pre-existing at HEAD per state.md baseline).
- [x] P4 reviews PASS. Evidence: guard-fix review PASS (no must-fix); live-spec review PASS vs rules 16 + 11 (two LOW suggestions recorded below, neither blocking).

## AC matrix

| AC | Statement | Evidence | Verdict |
|----|-----------|----------|---------|
| AC1 | Hover/focus reveals a red X on every assessment card state at 1280 and 375 with no layout shift; keyboard-only flow reaches it. | Unit: X on ready/generating/failed/unavailable + rest-opacity-0 + stylesheet reveal selectors (`AssessmentLibrary.test.tsx` class + stylesheet contract); dialog focus-Cancel + cancel focus-restore tests. Live: real pointer click on the X of a titled card (stretched-link hit-test) at both viewports; screenshots `evidence/assessment-delete-desktop.png`, `evidence/assessment-delete-mobile.png`; `assertNoOverflow` both. | PASS |
| AC2 | Confirm modal centered, trapped, Esc/backdrop-safe, honest copy, focus-restoring; destructive button never autofocused. | Unit: `AssessmentDeleteDialog.test.tsx` (trap incl. confirming shell, Esc/backdrop/inner-click, opener restore, generating warning, error alert, confirming locks). Live: dialog asserted by role/name, Cancel initial focus (`toBeFocused`), Delete confirm clicked, no console errors. | PASS |
| AC3 | Confirm mints one request id reused across retries, surfaces it on the typed error, joins frontend-to-backend logs (rule 17). | Live: delete POST `X-Request-ID` captured per viewport and joined via `grepIntelligenceLog` (>0 lines asserted in-run). Phone join still queryable after the run: `POST /v1/assessments/cc56bd2f-7247-4112-8cfa-4120a959289b/delete status 202` for request `5645fc81-794e-4ba5-a625-3de22577a88a`. Unit: Idempotency-Key reuse + 404/409/requestId tests in `assessmentClient.test.ts`. | PASS |
| AC4 | Backend deletes assessment + questions + attempts + flags in one owner-scoped path; cross-owner reads `not_found`; double-submit idempotent. | Backend tests: owner delete + dependents gone, cross-owner `not_found`, second confirm `conflict` (partial unique index → 23505 → 409), orphan archive, request_id on errors (135 green). Live: 202 enqueue → worker DELETE → hub row gone; service-role window cleanup verified zero remaining rows + cascaded attempts. | PASS |
| AC5 | Library repaints without the deleted row (tombstone masked, cache evicted); practice history referencing it stays readable as unavailable. | Unit: success tombstone + cache eviction + row drop; `libraryModel` mixed-run tombstone → `unavailable`; hook 404 self-heal + evict + mask. Live: card count for the deleted id → 0 after worker confirm (`toHaveCount(0)`). | PASS |
| AC6 | Unit + live E2E green (library delete spec, shared-account cleanup per rule 16), no console errors at both viewports. | Live spec 2/2 green with window-scoped service-role cleanup (frozen material untouched) and `errors()` empty at both viewports. Full app 1133 + 2 pre-existing flakes. | PASS |

## Review log

- P4 guard-fix review (code-reviewer): PASS, no must-fix. Phase table confirms idle/confirming/error retarget allowed, submitting/polling ignored; test proves dialog keeps first target + one enqueue. Suggestions (non-blocking): reword the guard comment ("ignored" not "waits"); `handleConfirm` same-tick double-confirm is mitigated by disabled button + backend `conflict`.
- P4 live-spec review (code-reviewer vs rules 16 + 11): PASS, no must-fix. Skip/viewport scoping per-describe, actionTimeout set, no `isVisible` sampling, href-scoped locators, window cleanup + frozen material untouched, errors fixture, justified 600 s budget. LOW suggestions: bare `.materials-grid` over `.first()` on the singleton grid; `test.skip` when the service-role key is missing instead of throwing in cleanup. Neither blocks; recorded for a follow-up.
- P4 exploration (3 parallel agents): backend slice confirmed endpoint/RPC/worker/contract shape; two notable edges recorded as known limitations, not P4 scope: (1) deleting a `generating` row archives the generation message without failing its `ingestion_jobs` row, so a `GET /v1/jobs/{genId}` poll would hang - the delete-job poll itself is unaffected; (2) the openapi `IdempotencyKey` required-header annotation has no matching router header param (same as regenerate) - live accepts with or without.
- Frontend exploration defect fixed in P4: second-X while submitting/polling overwrote the flow and dropped the first job id (no tombstone). Fixed by the phase guard + pinning test (`AssessmentLibrary.tsx:77-80`, test `ignores a second card X while a delete job is in flight`).

## Live-run note

- The managed runtime predated the P4 guard edit, so `./full-app restart full` served the fresh bundle before the live run (rule 53); all health checks green (intelligence :8000, app :5173, sidecar :8200 GPU, piston :2000).
