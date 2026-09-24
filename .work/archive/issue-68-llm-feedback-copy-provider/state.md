# State - issue-68-llm-feedback-copy-provider
_Spec: https://github.com/rings0fsaturn/study-planner/issues/68 (map #4) · Decision contract: .work/archive/issue-50-learner-feedback-contract/plan/DECISIONS.md · Plan: archive/issue-68-llm-feedback-copy-provider/plan/PLAN.md · STATUS row: issue-68-llm-feedback-copy-provider · Status: done · Updated: 2026-09-24_

## Current state & next
- **Done + wrapped 2026-09-24.** All six ACs met; #68 closed; map #4 remote body + local snapshot gained the #68 line.
- Next: #49 Phase 2 Integrated Verification (unblocked). Follow-up tickets (not this one): OpenRouter 18+ attestation for the contract model; unowned-material roadmap 404 note.

## Done so far
- Backend: `POST /v1/feedback/copy` + `feedback-v1` builder/schema + factory `model` kwarg + registration; 12 contract tests green; ruff clean; OCR review fixed 2 minors.
- Frontend: `getFeedbackCopy` + fake/script/factory + `llmFeedbackProvider` (5 tests) + section LLM default with key-stabilized identity + `settled` gate (hook + effect) with 3 more tests; app 1008/1008, tsc/eslint clean; OCR reviews clean.
- Live: `e2e/feedback-copy-live.spec.ts` 3/3 at 1280 + 375 (LLM copy + log join, forced-500 fallback, stacked layout), zero console errors; evidence PNGs in `plan/evidence/`.
- Wayfinder exit: resolution comment + #68 closed + map #4 line (remote body + local snapshot).

## Flow trace
1. Ticket #68 = build on closed #50 contract over live #47 seam (`FeedbackCopyInput` -> `FeedbackCopy`).
2. Endpoint: updated-only, owner-scoped union check, one repair, typed errors; `source` server-set from `FEEDBACK_MODEL` (default `meta/muse-spark-1.3-contributor`).
3. Client: POST with `X-Request-ID` + `Idempotency-Key`, Rule 22 reuse, 15 s timeout kept (fallback covers slowness).
4. Section: LLM default, static fallback, settled first-paint gate (hook flag + effect skip) against the live-found cold flash.
5. Live spec seeds a throwaway ACCA roadmap (adopted `updated` from empty cache), deep-links by selection (newest unterminated wins), abandons afterward.

## Files affected
- `services/intelligence/app/routers/feedback.py` (new) - endpoint.
- `services/intelligence/app/generation/prompts.py` - `feedback-v1` builder + schema + version.
- `services/intelligence/app/generation/factory.py` (untracked #67 file) - optional `model` kwarg.
- `services/intelligence/app/main.py` - router registration (kept worktree guide line).
- `services/intelligence/tests/test_feedback_copy.py` (new) - 12 tests.
- `apps/app/src/assessments/assessmentClient.ts` + `.test.ts` - `getFeedbackCopy`.
- `apps/app/src/assessments/testing/fakeAssessmentClient.ts` - fake + script + `feedbackCopy()` factory.
- `apps/app/src/roadmap/feedback/llmFeedbackProvider.ts` + `.test.ts` (new) - LLM provider.
- `apps/app/src/roadmap/feedback/RoadmapFeedbackSection.tsx` - LLM default + settled gate.
- `apps/app/src/roadmap/feedback/useRoadmapFeedback.ts` + tests - `settled` flag.
- `e2e/feedback-copy-live.spec.ts` (new) - 3 live scenarios.
- `.work/active/issue-68-llm-feedback-copy-provider/plan/evidence/` - desktop/mobile PNGs.

## Pitfalls & rules
- Must export `FEEDBACK_MODEL` in the same shell command as `./full-app restart full`; a later bare restart drops it and the contract model 403s (needs OpenRouter 18+ attestation).
- Raw IndexedDB writes bypass Dexie `liveQuery`: seed-then-navigate in live specs, never seed-into-live-page (proven invisible).
- Cold Supabase auth can trip the 500 ms session fallback and bounce a fresh goto home; `gotoRoadmap` retries with a warm session.
- `page.route` 500s log Chromium resource errors; the AC3 test asserts only that scoped noise.
- Rule 17/22/41 honored throughout; no migration, no Dexie bump, no durable events (AC6).
- OCR review ran between every executed phase; impeccable caught the cold-flash (settled gate).

## Decisions in force
- Decided Python builder + `feedback-v1`, not Jinja, because product code has zero Jinja (2026-09-24).
- Decided `FEEDBACK_*` env prefix via factory defaults for isolated budget (2026-09-24).
- Decided LLM-with-static-fallback as the section default per AC1 (2026-09-24).
- Decided merged backend phase (endpoint + template in one) to avoid double-touching files (2026-09-24).
- Decided no `.env.example` change, following the undocumented `GUIDE_*` precedent (2026-09-24).
- Decided reused client 15 s timeout; revisit only on live timeouts (2026-09-24).

## Open
- Follow-up (post-wrap, 2026-09-24): user completed the OpenRouter 18+ attestation; verification found and fixed two issues in the same session:
  1. Unlisted adapter codes crashed `service_error` (`provider_error` is not an `IngestionError` code -> `ValueError` -> 500 `internal_error`); `_provider_error` now falls back to `provider_unavailable` and logs the original `provider_code` (plus a regression test).
  2. The contract model REJECTS reasoning-off (`Reasoning is mandatory for this endpoint`, 400 `unsupported_request`); the arm needs `FEEDBACK_REASONING_EFFORT=low` (factory knob, no code change). Verified live: 200 with `source=meta/muse-spark-1.3-contributor`, request-id echo green. Backend 13 tests green.
- Operator rule: export `FEEDBACK_REASONING_EFFORT=low` in the same shell command as any `./full-app` restart (bare restarts drop it); `FEEDBACK_MODEL` stays unset for the contract default.
- Shared account's pre-existing roadmap holds a material invisible to the owner read (correct 404 into static) - candidate follow-up ticket.
- none otherwise.
